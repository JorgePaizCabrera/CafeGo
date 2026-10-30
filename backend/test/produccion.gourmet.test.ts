import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../src/lib/prisma'
import { resetDb, disconnectDb } from './helpers/db'
import { request, app, createAdminAndLogin, authHeader } from './helpers/testApp'

let token: string

beforeEach(async () => {
  await resetDb()
  token = await createAdminAndLogin()
})
afterAll(disconnectDb)

async function setStock(material: string, cantidadLb: number) {
  await prisma.inventarioStock.upsert({
    where: { material },
    create: { material, cantidadLb },
    update: { cantidadLb },
  })
}

async function setEmpaqueStock(tipo: string, cantidad: number) {
  await prisma.inventarioEmpaqueStock.upsert({ where: { tipo }, create: { tipo, cantidad }, update: { cantidad } })
}

describe('POST /api/produccion/gourmet', () => {
  it('rechaza pergaminoUsedLb <= 0', async () => {
    const res = await request(app).post('/api/produccion/gourmet').set(authHeader(token)).send({ fecha: '2026-01-01', pergaminoUsedLb: 0, notas: '' })
    expect(res.status).toBe(400)
  })

  it('rechaza si no hay suficiente pergamino disponible', async () => {
    await setStock('pergamino', 10)
    const res = await request(app).post('/api/produccion/gourmet').set(authHeader(token)).send({ fecha: '2026-01-01', pergaminoUsedLb: 50, notas: '' })
    expect(res.status).toBe(400)
  })

  it('crea el lote en_proceso con code GG-0001 cuando hay stock suficiente', async () => {
    await setStock('pergamino', 100)
    const res = await request(app).post('/api/produccion/gourmet').set(authHeader(token)).send({ fecha: '2026-01-01', pergaminoUsedLb: 50, notas: 'lote de prueba' })
    expect(res.status).toBe(201)
    expect(res.body.code).toBe('GG-0001')
    expect(res.body.status).toBe('en_proceso')
    expect(res.body.currentStepName).toBe('Trillado')
  })

  it('no descuenta inventario al solo iniciar el lote (el inventario se mueve al finalizar)', async () => {
    await setStock('pergamino', 100)
    await request(app).post('/api/produccion/gourmet').set(authHeader(token)).send({ fecha: '2026-01-01', pergaminoUsedLb: 50, notas: '' })
    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    const pergamino = stock.body.find((s: any) => s.material === 'pergamino')
    expect(pergamino.cantidadLb).toBe(100)
  })
})

describe('POST /api/produccion/gourmet/:id/finalizar', () => {
  async function startLote(pergaminoUsedLb = 50) {
    await setStock('pergamino', 100)
    const res = await request(app).post('/api/produccion/gourmet').set(authHeader(token)).send({ fecha: '2026-01-01', pergaminoUsedLb, notas: '' })
    return res.body.id as string
  }

  it('descuenta el pergamino y agrega la reserva de cafetería + empaque terminado, todo junto', async () => {
    const id = await startLote(50)
    await setEmpaqueStock('comercial', 10)
    await request(app)
      .patch(`/api/produccion/gourmet/${id}`)
      .set(authHeader(token))
      .send({ roastType: 'medio', reservaCafeteriaLb: 5, molidoWeightLb: 40, actualFullBags: 10, actualRemainderGrams: 0, comercialBags: 10 })

    const res = await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('terminada')
    expect(res.body.finalizedAt).toBeTruthy()

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    const byMaterial = Object.fromEntries(stock.body.map((s: any) => [s.material, s.cantidadLb]))
    expect(byMaterial.pergamino).toBe(50) // 100 - 50 usado
    expect(byMaterial.grano_medio).toBe(5) // reserva de cafetería
    expect(byMaterial.gourmet).toBeCloseTo((10 * 350) / 453.59237, 2)

    const movimientos = await request(app).get('/api/inventario/movimientos').set(authHeader(token))
    const referenciaIds = movimientos.body.map((m: any) => m.referenciaId)
    expect(referenciaIds.filter((id: string) => id === 'GG-0001')).toHaveLength(3) // salida pergamino + entrada reserva + entrada gourmet
  })

  it('descuenta bolsas comercial/especial del inventario de empaque al finalizar', async () => {
    const id = await startLote(50)
    await setEmpaqueStock('comercial', 20)
    await setEmpaqueStock('especial', 5)
    await request(app)
      .patch(`/api/produccion/gourmet/${id}`)
      .set(authHeader(token))
      .send({ molidoWeightLb: 40, actualFullBags: 17, actualRemainderGrams: 0, comercialBags: 12, especialBags: 5 })

    const res = await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(200)

    const empaque = await request(app).get('/api/inventario/empaque/stock').set(authHeader(token))
    const byTipo = Object.fromEntries(empaque.body.map((s: any) => [s.tipo, s.cantidad]))
    expect(byTipo.comercial).toBe(8) // 20 - 12
    expect(byTipo.especial).toBe(0) // 5 - 5

    const empacado = await request(app).get('/api/inventario/empacado').set(authHeader(token))
    expect(empacado.body.comercial).toBe(12)
    expect(empacado.body.especial).toBe(5)
    expect(empacado.body.sueltoGramos).toBeLessThan(3)
  })

  it('rechaza finalizar si Comercial + Especial no suma las bolsas completas, sin aplicar nada', async () => {
    const id = await startLote(50)
    await setEmpaqueStock('comercial', 20)
    await request(app)
      .patch(`/api/produccion/gourmet/${id}`)
      .set(authHeader(token))
      .send({ molidoWeightLb: 40, actualFullBags: 10, actualRemainderGrams: 0, comercialBags: 7 })

    const res = await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(400)
    const lote = await request(app).get(`/api/produccion/gourmet/${id}`).set(authHeader(token))
    expect(lote.body.status).toBe('en_proceso')
  })

  it('falla al finalizar si no hay suficientes bolsas de empaque, sin aplicar nada', async () => {
    const id = await startLote(50)
    await setEmpaqueStock('comercial', 3)
    await request(app)
      .patch(`/api/produccion/gourmet/${id}`)
      .set(authHeader(token))
      .send({ molidoWeightLb: 40, actualFullBags: 12, actualRemainderGrams: 0, comercialBags: 12 })

    const res = await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(400)

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    expect(stock.body.find((s: any) => s.material === 'pergamino').cantidadLb).toBe(100) // no se movió nada

    const lote = await request(app).get(`/api/produccion/gourmet/${id}`).set(authHeader(token))
    expect(lote.body.status).toBe('en_proceso')
  })

  it('dos "finalizar" simultáneos: solo uno se aplica y el inventario se descuenta una sola vez', async () => {
    const id = await startLote(30)
    const [a, b] = await Promise.all([
      request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token)),
      request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token)),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 400])
    const stock = await prisma.inventarioStock.findUnique({ where: { material: 'pergamino' } })
    expect(stock?.cantidadLb.toNumber()).toBe(70) // 100 - 30, una sola vez
  })

  it('no permite modificar un lote ya finalizado', async () => {
    const id = await startLote(50)
    await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    const res = await request(app).patch(`/api/produccion/gourmet/${id}`).set(authHeader(token)).send({ actualFullBags: 99 })
    expect(res.status).toBe(400)
    const lote = await request(app).get(`/api/produccion/gourmet/${id}`).set(authHeader(token))
    expect(lote.body.actualFullBags).toBe(0)
  })

  it('rechaza pesos negativos y pasos inexistentes', async () => {
    const id = await startLote(50)
    const negativo = await request(app).patch(`/api/produccion/gourmet/${id}`).set(authHeader(token)).send({ molidoWeightLb: -5 })
    expect(negativo.status).toBe(400)
    const paso = await request(app).patch(`/api/produccion/gourmet/${id}`).set(authHeader(token)).send({ currentStepName: 'Inventado' })
    expect(paso.status).toBe(400)
  })

  it('no permite finalizar dos veces el mismo lote', async () => {
    const id = await startLote(50)
    await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    const segunda = await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    expect(segunda.status).toBe(400)
  })

  it('si el inventario bajó entre el inicio y el finalizar, la transacción falla completa (no queda a medias)', async () => {
    const id = await startLote(50)
    await setStock('pergamino', 10)

    const res = await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(400)

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    const pergamino = stock.body.find((s: any) => s.material === 'pergamino')
    expect(pergamino.cantidadLb).toBe(10) // no se movió nada

    const lote = await request(app).get(`/api/produccion/gourmet/${id}`).set(authHeader(token))
    expect(lote.body.status).toBe('en_proceso')
  })

  it('no se puede borrar un lote ya finalizado', async () => {
    const id = await startLote(50)
    await request(app).post(`/api/produccion/gourmet/${id}/finalizar`).set(authHeader(token))
    const res = await request(app).delete(`/api/produccion/gourmet/${id}`).set(authHeader(token))
    expect(res.status).toBe(400)
  })

  it('un lote en proceso sí se puede borrar', async () => {
    const id = await startLote(50)
    const res = await request(app).delete(`/api/produccion/gourmet/${id}`).set(authHeader(token))
    expect(res.status).toBe(204)
  })
})
