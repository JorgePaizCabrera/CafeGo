import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { resetDb, disconnectDb } from './helpers/db'
import { request, app, createAdminAndLogin, authHeader } from './helpers/testApp'

let token: string
let clienteId: string

beforeEach(async () => {
  await resetDb()
  token = await createAdminAndLogin()
  const cliente = await request(app)
    .post('/api/clientes')
    .set(authHeader(token))
    .send({ nombre: 'Finca El Roble', ciudad: 'Antigua', telefono: '5555-1234' })
  clienteId = cliente.body.id
})
afterAll(disconnectDb)

function crearOrden(overrides: Record<string, unknown> = {}) {
  return request(app).post('/api/ordenes').set(authHeader(token)).send({
    clienteId,
    receivedDate: '2026-01-01',
    estimatedDate: '2026-01-10',
    coffeeType: 'pergamino',
    initialWeight: 100,
    humidity: 12,
    roastType: 'medio',
    grindType: 'media',
    totalPrice: 450,
    packageAllocation: {},
    incompletePackageType: 'transparente',
    currentStepName: 'Recepción',
    ...overrides,
  })
}

function activar(ordenId: string) {
  return request(app).post(`/api/ordenes/${ordenId}/seguimiento`).set(authHeader(token))
}

describe('token de seguimiento', () => {
  it('cada orden recibe un token propio de 32 caracteres', async () => {
    const a = await crearOrden()
    const b = await crearOrden()
    expect(a.body.seguimientoToken).toMatch(/^[0-9a-f]{32}$/)
    expect(b.body.seguimientoToken).toMatch(/^[0-9a-f]{32}$/)
    expect(a.body.seguimientoToken).not.toBe(b.body.seguimientoToken)
  })
})

describe('activar seguimiento', () => {
  it('las órdenes nuevas empiezan con el seguimiento apagado', async () => {
    const orden = await crearOrden()
    expect(orden.body.seguimientoActivo).toBe(false)
    expect((await request(app).get(`/api/seguimiento/${orden.body.seguimientoToken}`)).status).toBe(404)
  })

  it('al activarlo el enlace empieza a funcionar', async () => {
    const orden = await crearOrden()
    const res = await activar(orden.body.id)
    expect(res.status).toBe(200)
    expect(res.body.seguimientoActivo).toBe(true)
    expect((await request(app).get(`/api/seguimiento/${orden.body.seguimientoToken}`)).status).toBe(200)
  })

  it('requiere sesión y una orden existente', async () => {
    const orden = await crearOrden()
    expect((await request(app).post(`/api/ordenes/${orden.body.id}/seguimiento`)).status).toBe(401)
    expect((await request(app).post('/api/ordenes/00000000-0000-0000-0000-000000000000/seguimiento').set(authHeader(token))).status).toBe(404)
  })
})

describe('GET /api/seguimiento/:token', () => {
  it('es público y muestra el estado del pedido sin precios', async () => {
    const orden = await crearOrden()
    await activar(orden.body.id)
    const res = await request(app).get(`/api/seguimiento/${orden.body.seguimientoToken}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ orderNo: 'GC-0001', clienteNombre: 'Finca El Roble', coffeeType: 'pergamino', status: 'Recibido' })
    expect(res.body).not.toHaveProperty('totalPrice')
    expect(res.body).not.toHaveProperty('id')
    expect(res.body).not.toHaveProperty('seguimientoToken')
  })

  it('refleja el avance de la orden', async () => {
    const orden = await crearOrden()
    await activar(orden.body.id)
    await request(app)
      .patch(`/api/ordenes/${orden.body.id}`)
      .set(authHeader(token))
      .send({ currentStepName: 'Tuestes' })
    const res = await request(app).get(`/api/seguimiento/${orden.body.seguimientoToken}`)
    expect(res.body.status).toBe('EnTueste')
  })

  it('sin Google Wallet configurado no ofrece la tarjeta', async () => {
    const orden = await crearOrden()
    await activar(orden.body.id)
    const res = await request(app).get(`/api/seguimiento/${orden.body.seguimientoToken}`)
    expect(res.body.wallet).toBe(false)
    expect((await request(app).get(`/api/seguimiento/${orden.body.seguimientoToken}/wallet`)).status).toBe(404)
  })

  it('responde 404 con un token inexistente o mal formado', async () => {
    await crearOrden()
    expect((await request(app).get(`/api/seguimiento/${'0'.repeat(32)}`)).status).toBe(404)
    expect((await request(app).get('/api/seguimiento/GC-0001')).status).toBe(404)
  })
})
