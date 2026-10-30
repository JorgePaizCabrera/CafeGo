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
  await prisma.inventarioStock.upsert({ where: { material }, create: { material, cantidadLb }, update: { cantidadLb } })
}

async function setEmpaqueStock(tipo: string, cantidad: number) {
  await prisma.inventarioEmpaqueStock.upsert({ where: { tipo }, create: { tipo, cantidad }, update: { cantidad } })
}

describe('GET /api/produccion/blend/validar-plan', () => {
  it('calcula 35% pergamino / 65% segunda y marca isValid según el stock', async () => {
    await setStock('pergamino', 100)
    await setStock('oro', 100)
    const res = await request(app).get('/api/produccion/blend/validar-plan').set(authHeader(token)).query({ cantidadLb: 100, segundaType: 'oro' })
    expect(res.status).toBe(200)
    expect(res.body.pergaminoLb).toBeCloseTo(35, 2)
    expect(res.body.segundaLb).toBeCloseTo(65, 2)
    expect(res.body.isValid).toBe(true)
  })

  it('marca isValid en false y reporta el faltante cuando no alcanza el stock', async () => {
    await setStock('pergamino', 10)
    await setStock('natural', 10)
    const res = await request(app).get('/api/produccion/blend/validar-plan').set(authHeader(token)).query({ cantidadLb: 100, segundaType: 'natural' })
    expect(res.body.isValid).toBe(false)
    expect(res.body.pergaminoFaltante).toBeCloseTo(25, 2) // 35 - 10
    expect(res.body.segundaFaltante).toBeCloseTo(55, 2) // 65 - 10
  })
})

describe('POST /api/produccion/blend', () => {
  it('rechaza iniciar el lote si el inventario no alcanza', async () => {
    await setStock('pergamino', 5)
    await setStock('oro', 5)
    const res = await request(app).post('/api/produccion/blend').set(authHeader(token)).send({ fecha: '2026-01-01', cantidadPlanificadaLb: 100, segundaType: 'oro', notas: '' })
    expect(res.status).toBe(400)
  })

  it('crea el lote con code GB-0001 y las cantidades de materia prima calculadas', async () => {
    await setStock('pergamino', 100)
    await setStock('oro', 100)
    const res = await request(app).post('/api/produccion/blend').set(authHeader(token)).send({ fecha: '2026-01-01', cantidadPlanificadaLb: 100, segundaType: 'oro', notas: '' })
    expect(res.status).toBe(201)
    expect(res.body.code).toBe('GB-0001')
    expect(Number(res.body.pergaminoUsedLb)).toBeCloseTo(35, 2)
    expect(Number(res.body.segundaUsedLb)).toBeCloseTo(65, 2)
  })
})

describe('POST /api/produccion/blend/:id/finalizar', () => {
  async function startLote() {
    await setStock('pergamino', 100)
    await setStock('oro', 100)
    const res = await request(app).post('/api/produccion/blend').set(authHeader(token)).send({ fecha: '2026-01-01', cantidadPlanificadaLb: 100, segundaType: 'oro', notas: '' })
    return res.body.id as string
  }

  it('descuenta pergamino + segunda y agrega bolsas de blend terminado', async () => {
    const id = await startLote()
    await setEmpaqueStock('blend', 10)
    await request(app).patch(`/api/produccion/blend/${id}`).set(authHeader(token)).send({ molidoMezclaWeightLb: 40, actualFullBags: 10, actualRemainderGrams: 0 })

    const res = await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('terminada')

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    const byMaterial = Object.fromEntries(stock.body.map((s: any) => [s.material, s.cantidadLb]))
    expect(byMaterial.pergamino).toBeCloseTo(65, 2) // 100 - 35
    expect(byMaterial.oro).toBeCloseTo(35, 2) // 100 - 65
    expect(byMaterial.blend_bolsas).toBeCloseTo((10 * 350) / 453.59237, 2)
  })

  it('rechaza finalizar si las bolsas pesan más que lo molido y no mueve inventario', async () => {
    const id = await startLote()
    await setEmpaqueStock('blend', 50)
    await request(app).patch(`/api/produccion/blend/${id}`).set(authHeader(token)).send({ molidoMezclaWeightLb: 10, actualFullBags: 40, actualRemainderGrams: 0 })

    const res = await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(400)

    const lote = await request(app).get(`/api/produccion/blend/${id}`).set(authHeader(token))
    expect(lote.body.status).toBe('en_proceso')
    const empaque = await request(app).get('/api/inventario/empaque/stock').set(authHeader(token))
    expect(empaque.body.find((s: any) => s.tipo === 'blend').cantidad).toBe(50)
  })

  it('el sobrante de cada lote queda como café suelto y no se puede enviar como bolsa', async () => {
    await setEmpaqueStock('blend', 6)
    for (let i = 0; i < 2; i++) {
      const id = await startLote()
      await request(app).patch(`/api/produccion/blend/${id}`).set(authHeader(token)).send({ molidoMezclaWeightLb: 40, actualFullBags: 3, actualRemainderGrams: 300 })
      expect((await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))).status).toBe(200)
    }

    const empacado = await request(app).get('/api/inventario/empacado').set(authHeader(token))
    expect(empacado.body.blend).toBe(6)
    expect(Math.abs(empacado.body.blendSueltoGramos - 600)).toBeLessThan(5)

    const excede = await request(app).post('/api/inventario/blend/salida').set(authHeader(token)).send({ bolsas: 7, motivo: 'Venta' })
    expect(excede.status).toBe(400)
    const todas = await request(app).post('/api/inventario/blend/salida').set(authHeader(token)).send({ bolsas: 6, motivo: 'Venta' })
    expect(todas.status).toBe(204)

    const despues = await request(app).get('/api/inventario/empacado').set(authHeader(token))
    expect(despues.body.blend).toBe(0)
    expect(Math.abs(despues.body.blendSueltoGramos - 600)).toBeLessThan(5)
  })

  it('empaca el café suelto de Blend en bolsas llenas y descuenta la bolsa vacía', async () => {
    await setEmpaqueStock('blend', 6)
    for (let i = 0; i < 2; i++) {
      const id = await startLote()
      await request(app).patch(`/api/produccion/blend/${id}`).set(authHeader(token)).send({ molidoMezclaWeightLb: 40, actualFullBags: 3, actualRemainderGrams: 350 - 0.5 })
      await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    }
    await setEmpaqueStock('blend', 5)

    const demasiadas = await request(app).post('/api/inventario/blend/empacar-sobrante').set(authHeader(token)).send({ bolsas: 3, motivo: '' })
    expect(demasiadas.status).toBe(400)
    const ok = await request(app).post('/api/inventario/blend/empacar-sobrante').set(authHeader(token)).send({ bolsas: 2, motivo: '' })
    expect(ok.status).toBe(204)

    const empacado = await request(app).get('/api/inventario/empacado').set(authHeader(token))
    expect(empacado.body.blend).toBe(8)
    expect(empacado.body.blendSueltoGramos).toBeLessThan(5)
    const empaque = await request(app).get('/api/inventario/empaque/stock').set(authHeader(token))
    expect(empaque.body.find((s: any) => s.tipo === 'blend').cantidad).toBe(3)
  })

  it('descuenta de su propia bolsa de Blend, no de las bolsas Comercial/Especial de Gourmet', async () => {
    const id = await startLote()
    await setEmpaqueStock('comercial', 20) // no deben tocarse
    await setEmpaqueStock('especial', 20)
    await setEmpaqueStock('blend', 10)
    await request(app).patch(`/api/produccion/blend/${id}`).set(authHeader(token)).send({ molidoMezclaWeightLb: 40, actualFullBags: 10, actualRemainderGrams: 0 })

    const res = await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(200)

    const empaque = await request(app).get('/api/inventario/empaque/stock').set(authHeader(token))
    const byTipo = Object.fromEntries(empaque.body.map((s: any) => [s.tipo, s.cantidad]))
    expect(byTipo.blend).toBe(0)
    expect(byTipo.comercial).toBe(20)
    expect(byTipo.especial).toBe(20)
  })

  it('falla al finalizar si no hay suficientes bolsas de Blend', async () => {
    const id = await startLote()
    await setEmpaqueStock('blend', 2)
    await request(app).patch(`/api/produccion/blend/${id}`).set(authHeader(token)).send({ molidoMezclaWeightLb: 40, actualFullBags: 10, actualRemainderGrams: 0 })

    const res = await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(400)
  })

  it('falla si falta pergamino o la segunda al momento de finalizar, y no aplica ningún movimiento', async () => {
    const id = await startLote()
    await setStock('oro', 0) // alguien más se lo llevó mientras el lote estaba en proceso

    const res = await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(400)

    const stock = await request(app).get('/api/inventario/stock').set(authHeader(token))
    const pergamino = stock.body.find((s: any) => s.material === 'pergamino')
    expect(pergamino.cantidadLb).toBe(100) // no se tocó nada
  })

  it('dos "finalizar" simultáneos: solo uno se aplica y el inventario se descuenta una sola vez', async () => {
    const id = await startLote()
    const [a, b] = await Promise.all([
      request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token)),
      request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token)),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 400])
    const stock = await prisma.inventarioStock.findUnique({ where: { material: 'pergamino' } })
    expect(stock?.cantidadLb.toNumber()).toBe(65) // 100 - 35, una sola vez
  })

  it('no permite modificar ni borrar un lote ya finalizado', async () => {
    const id = await startLote()
    await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    const patch = await request(app).patch(`/api/produccion/blend/${id}`).set(authHeader(token)).send({ actualFullBags: 99 })
    expect(patch.status).toBe(400)
    const del = await request(app).delete(`/api/produccion/blend/${id}`).set(authHeader(token))
    expect(del.status).toBe(400)
  })

  it('no permite finalizar dos veces', async () => {
    const id = await startLote()
    await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    const segunda = await request(app).post(`/api/produccion/blend/${id}/finalizar`).set(authHeader(token))
    expect(segunda.status).toBe(400)
  })
})
