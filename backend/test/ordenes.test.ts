import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '../src/lib/prisma'
import { resetDb, disconnectDb } from './helpers/db'
import { request, app, createAdminAndLogin, authHeader } from './helpers/testApp'

async function setEmpaqueStock(tipo: string, cantidad: number) {
  await prisma.inventarioEmpaqueStock.upsert({ where: { tipo }, create: { tipo, cantidad }, update: { cantidad } })
}

let token: string
let clienteId: string

beforeEach(async () => {
  await resetDb()
  token = await createAdminAndLogin()
  const cliente = await request(app)
    .post('/api/clientes')
    .set(authHeader(token))
    .send({ nombre: 'Cliente de prueba', ciudad: 'Antigua', telefono: '0000-0000' })
  clienteId = cliente.body.id
})
afterAll(disconnectDb)

function baseOrden(overrides: Record<string, unknown> = {}) {
  return {
    clienteId,
    receivedDate: '2026-01-01',
    estimatedDate: '2026-01-10',
    coffeeType: 'pergamino',
    initialWeight: 100,
    humidity: 12,
    finalWeight: 80,
    roastType: 'medio',
    grindType: 'media',
    packageAllocation: {},
    incompletePackageType: 'transparente',
    currentStepName: 'Recepción',
    ...overrides,
  }
}

describe('POST /api/ordenes', () => {
  it('crea una orden con folio GC-0001 y estado derivado del paso actual', async () => {
    const res = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    expect(res.status).toBe(201)
    expect(res.body.orderNo).toBe('GC-0001')
    expect(res.body.status).toBe('Recibido')
    expect(res.body.pagado).toBe(false)
  })

  it('los folios son consecutivos entre órdenes', async () => {
    await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    const second = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    expect(second.body.orderNo).toBe('GC-0002')
  })

  it('guarda los tuestes en orden', async () => {
    const res = await request(app)
      .post('/api/ordenes')
      .set(authHeader(token))
      .send(
        baseOrden({
          roasts: [
            {
              weightLb: 10,
              initialTemp: 20,
              returnTemp: 150,
              returnTime: '02:00',
              dehydrationTemp: 160,
              dehydrationTime: '05:00',
              caramelizationTemp: 190,
              caramelizationTime: '08:00',
              crackTemp: 200,
              crackTime: '10:00',
              finalTemp: 205,
              finalTime: '12:00',
              notes: 'primer tueste',
            },
          ],
        })
      )
    expect(res.status).toBe(201)
    expect(res.body.roasts).toHaveLength(1)
    expect(res.body.roasts[0].notes).toBe('primer tueste')
  })

  it('rechaza una fecha vacía o inválida en vez de tronar contra Prisma (400)', async () => {
    const vacia = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden({ receivedDate: '' }))
    expect(vacia.status).toBe(400)
    const invalida = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden({ estimatedDate: 'no-es-una-fecha' }))
    expect(invalida.status).toBe(400)
  })

  it('rechaza datos inválidos (400)', async () => {
    const res = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden({ coffeeType: 'no-existe' }))
    expect(res.status).toBe(400)
  })

  it('rechaza un clienteId inexistente', async () => {
    const res = await request(app)
      .post('/api/ordenes')
      .set(authHeader(token))
      .send(baseOrden({ clienteId: '00000000-0000-0000-0000-000000000000' }))
    expect(res.status).toBe(404)
  })
})

describe('GET /api/ordenes', () => {
  it('filtra por clienteId', async () => {
    const otroCliente = await request(app)
      .post('/api/clientes')
      .set(authHeader(token))
      .send({ nombre: 'Otro cliente', ciudad: 'Guatemala', telefono: '1111-1111' })

    await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden({ clienteId: otroCliente.body.id }))

    const res = await request(app).get('/api/ordenes').set(authHeader(token)).query({ clienteId })
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].clienteId).toBe(clienteId)
  })
})

describe('PATCH /api/ordenes/:id', () => {
  it('avanzar de paso actualiza el estado derivado', async () => {
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    const res = await request(app)
      .patch(`/api/ordenes/${created.body.id}`)
      .set(authHeader(token))
      .send({ currentStepName: 'Tuestes' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('EnTueste')
    expect(res.body.currentStepName).toBe('Tuestes')
  })

  it('404 si la orden no existe', async () => {
    const res = await request(app)
      .patch('/api/ordenes/00000000-0000-0000-0000-000000000000')
      .set(authHeader(token))
      .send({ currentStepName: 'Tuestes' })
    expect(res.status).toBe(404)
  })
})

describe('POST /api/ordenes/:id/finalizar', () => {
  it('marca la orden como Finalizado y registra finalizedAt', async () => {
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    const res = await request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Finalizado')
    expect(res.body.finalizedAt).toBeTruthy()
  })

  it('una orden finalizada no vuelve atrás de estado aunque se le mande otro currentStepName', async () => {
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    await request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token))

    const res = await request(app)
      .patch(`/api/ordenes/${created.body.id}`)
      .set(authHeader(token))
      .send({ currentStepName: 'Recepción' })
    expect(res.status).toBe(400)
    const orden = await request(app).get(`/api/ordenes/${created.body.id}`).set(authHeader(token))
    expect(orden.body.status).toBe('Finalizado')
  })

  it('no permite finalizar dos veces la misma orden', async () => {
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    await request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token))
    const segunda = await request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token))
    expect(segunda.status).toBe(400)
  })

  it('descuenta del inventario de empaque las bolsas distribuidas + la bolsa incompleta, al finalizar', async () => {
    await setEmpaqueStock('transparente', 5)
    await setEmpaqueStock('laminada', 3)
    const created = await request(app)
      .post('/api/ordenes')
      .set(authHeader(token))
      .send(
        baseOrden({
          actualFullBags: 5,
          actualRemainderGrams: 120,
          packageAllocation: { transparente: 3, laminada: 2 },
          incompletePackageType: 'laminada',
        })
      )

    const res = await request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(200)

    const empaque = await request(app).get('/api/inventario/empaque/stock').set(authHeader(token))
    const byTipo = Object.fromEntries(empaque.body.map((s: any) => [s.tipo, s.cantidad]))
    expect(byTipo.transparente).toBe(2) // 5 - 3
    expect(byTipo.laminada).toBe(0) // 3 - 2 (distribuidas) - 1 (incompleta)

    const movimientos = await request(app).get('/api/inventario/empaque/movimientos').set(authHeader(token))
    const deLaOrden = movimientos.body.filter((m: any) => m.referenciaId === created.body.orderNo)
    expect(deLaOrden).toHaveLength(2) // transparente + laminada
  })

  it('dos "finalizar" simultáneos: solo uno se aplica y las bolsas se descuentan una sola vez', async () => {
    await setEmpaqueStock('transparente', 10)
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden({ actualFullBags: 3, packageAllocation: { transparente: 3 } }))
    const [a, b] = await Promise.all([
      request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token)),
      request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token)),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 400])
    const stock = await prisma.inventarioEmpaqueStock.findUnique({ where: { tipo: 'transparente' } })
    expect(stock?.cantidad).toBe(7)
  })

  it('rechaza finalizar si las bolsas distribuidas no suman las bolsas completas', async () => {
    await setEmpaqueStock('transparente', 10)
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden({ actualFullBags: 5, packageAllocation: { transparente: 3 } }))
    const res = await request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(400)
    const orden = await request(app).get(`/api/ordenes/${created.body.id}`).set(authHeader(token))
    expect(orden.body.status).not.toBe('Finalizado')
  })

  it('falla al finalizar si no hay suficientes bolsas del tipo distribuido, sin aplicar nada', async () => {
    await setEmpaqueStock('transparente', 1)
    const created = await request(app)
      .post('/api/ordenes')
      .set(authHeader(token))
      .send(baseOrden({ actualFullBags: 3, actualRemainderGrams: 0, packageAllocation: { transparente: 3 } }))

    const res = await request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token))
    expect(res.status).toBe(400)

    const orden = await request(app).get(`/api/ordenes/${created.body.id}`).set(authHeader(token))
    expect(orden.body.status).not.toBe('Finalizado')
  })
})

describe('PATCH /api/ordenes/:id/pagado', () => {
  it('marca y desmarca el pago, guardando la fecha de pago', async () => {
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())

    const marcado = await request(app).patch(`/api/ordenes/${created.body.id}/pagado`).set(authHeader(token)).send({ pagado: true })
    expect(marcado.body.pagado).toBe(true)
    expect(marcado.body.pagadoAt).toBeTruthy()

    const otraVez = await request(app).patch(`/api/ordenes/${created.body.id}/pagado`).set(authHeader(token)).send({ pagado: true })
    expect(otraVez.body.pagadoAt).toBe(marcado.body.pagadoAt)

    const desmarcado = await request(app).patch(`/api/ordenes/${created.body.id}/pagado`).set(authHeader(token)).send({ pagado: false })
    expect(desmarcado.body.pagado).toBe(false)
    expect(desmarcado.body.pagadoAt).toBeNull()
  })
})

describe('orden finalizada: protegida', () => {
  async function ordenFinalizada() {
    await setEmpaqueStock('transparente', 10)
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden({ actualFullBags: 2, packageAllocation: { transparente: 2 } }))
    await request(app).post(`/api/ordenes/${created.body.id}/finalizar`).set(authHeader(token))
    return created.body.id as string
  }

  it('no se puede borrar', async () => {
    const id = await ordenFinalizada()
    const res = await request(app).delete(`/api/ordenes/${id}`).set(authHeader(token))
    expect(res.status).toBe(400)
  })

  it('no se puede modificar ningún dato, pero sí marcar el pago', async () => {
    const id = await ordenFinalizada()
    const empaque = await request(app).patch(`/api/ordenes/${id}`).set(authHeader(token)).send({ packageAllocation: { transparente: 1, laminada: 1 } })
    expect(empaque.status).toBe(400)

    const precio = await request(app).patch(`/api/ordenes/${id}`).set(authHeader(token)).send({ totalPrice: 150 })
    expect(precio.status).toBe(400)

    const pagado = await request(app).patch(`/api/ordenes/${id}/pagado`).set(authHeader(token)).send({ pagado: true })
    expect(pagado.status).toBe(200)
    expect(pagado.body.pagado).toBe(true)
    expect(Number(pagado.body.totalPrice)).not.toBe(150)
  })

  it('su cliente no se puede borrar', async () => {
    await ordenFinalizada()
    const res = await request(app).delete(`/api/clientes/${clienteId}`).set(authHeader(token))
    expect(res.status).toBe(400)
    const cliente = await request(app).get(`/api/clientes/${clienteId}`).set(authHeader(token))
    expect(cliente.status).toBe(200)
  })
})

describe('validaciones', () => {
  it('rechaza pesos negativos, tipos inexistentes y fechas invertidas', async () => {
    const casos = [
      baseOrden({ cleaningWeight: -1 }),
      baseOrden({ totalPrice: -10 }),
      baseOrden({ roastType: 'quemado' }),
      baseOrden({ grindType: 'polvo' }),
      baseOrden({ currentStepName: 'Inventado' }),
      baseOrden({ receivedDate: '2026-01-10', estimatedDate: '2026-01-01' }),
    ]
    for (const body of casos) {
      const res = await request(app).post('/api/ordenes').set(authHeader(token)).send(body)
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
  })

  it('el teléfono del cliente debe tener 8 dígitos', async () => {
    const malo = await request(app).post('/api/clientes').set(authHeader(token)).send({ nombre: 'A', ciudad: 'B', telefono: '123' })
    expect(malo.status).toBe(400)
  })
})

describe('integridad en la base de datos', () => {
  it('rechaza dejar existencias negativas aunque el código lo intente', async () => {
    await setEmpaqueStock('laminada', 1)
    await expect(prisma.inventarioEmpaqueStock.update({ where: { tipo: 'laminada' }, data: { cantidad: -1 } })).rejects.toThrow()
  })
})

describe('DELETE /api/ordenes/:id', () => {
  it('borra la orden', async () => {
    const created = await request(app).post('/api/ordenes').set(authHeader(token)).send(baseOrden())
    const res = await request(app).delete(`/api/ordenes/${created.body.id}`).set(authHeader(token))
    expect(res.status).toBe(204)

    const get = await request(app).get(`/api/ordenes/${created.body.id}`).set(authHeader(token))
    expect(get.status).toBe(404)
  })
})
