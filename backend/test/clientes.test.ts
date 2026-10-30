import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { resetDb, disconnectDb } from './helpers/db'
import { request, app, createAdminAndLogin, authHeader } from './helpers/testApp'

let token: string

beforeEach(async () => {
  await resetDb()
  token = await createAdminAndLogin()
})
afterAll(disconnectDb)

const cliente = { nombre: 'Café Don Pepe', ciudad: 'Antigua', telefono: '5555-1234' }

describe('POST /api/clientes', () => {
  it('crea un cliente', async () => {
    const res = await request(app).post('/api/clientes').set(authHeader(token)).send(cliente)
    expect(res.status).toBe(201)
    expect(res.body.nombre).toBe(cliente.nombre)
    expect(res.body.id).toBeTruthy()
  })

  it('rechaza datos incompletos con 400', async () => {
    const res = await request(app).post('/api/clientes').set(authHeader(token)).send({ nombre: 'Sin ciudad ni teléfono' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/clientes', () => {
  it('lista los clientes ordenados por actualización más reciente', async () => {
    await request(app).post('/api/clientes').set(authHeader(token)).send({ ...cliente, nombre: 'Primero' })
    await request(app).post('/api/clientes').set(authHeader(token)).send({ ...cliente, nombre: 'Segundo' })

    const res = await request(app).get('/api/clientes').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0].nombre).toBe('Segundo')
  })
})

describe('GET /api/clientes/:id', () => {
  it('404 si no existe', async () => {
    const res = await request(app).get('/api/clientes/00000000-0000-0000-0000-000000000000').set(authHeader(token))
    expect(res.status).toBe(404)
  })

  it('incluye las órdenes del cliente', async () => {
    const created = await request(app).post('/api/clientes').set(authHeader(token)).send(cliente)
    const res = await request(app).get(`/api/clientes/${created.body.id}`).set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.ordenes).toEqual([])
  })
})

describe('PATCH /api/clientes/:id', () => {
  it('actualiza parcialmente', async () => {
    const created = await request(app).post('/api/clientes').set(authHeader(token)).send(cliente)
    const res = await request(app).patch(`/api/clientes/${created.body.id}`).set(authHeader(token)).send({ ciudad: 'Guatemala' })
    expect(res.status).toBe(200)
    expect(res.body.ciudad).toBe('Guatemala')
    expect(res.body.nombre).toBe(cliente.nombre)
  })

  it('404 si no existe', async () => {
    const res = await request(app).patch('/api/clientes/00000000-0000-0000-0000-000000000000').set(authHeader(token)).send({ ciudad: 'X' })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/clientes/:id', () => {
  it('borra el cliente y, en cascada, sus órdenes', async () => {
    const created = await request(app).post('/api/clientes').set(authHeader(token)).send(cliente)

    await request(app)
      .post('/api/ordenes')
      .set(authHeader(token))
      .send({
        clienteId: created.body.id,
        receivedDate: '2026-01-01',
        estimatedDate: '2026-01-10',
        coffeeType: 'pergamino',
        initialWeight: 10,
        humidity: 12,
        roastType: 'medio',
        grindType: 'media',
        packageAllocation: {},
        incompletePackageType: 'transparente',
        currentStepName: 'Recepción',
      })

    const del = await request(app).delete(`/api/clientes/${created.body.id}`).set(authHeader(token))
    expect(del.status).toBe(204)

    const ordenes = await request(app).get('/api/ordenes').set(authHeader(token))
    expect(ordenes.body).toHaveLength(0)
  })

  it('404 si no existe', async () => {
    const res = await request(app).delete('/api/clientes/00000000-0000-0000-0000-000000000000').set(authHeader(token))
    expect(res.status).toBe(404)
  })
})
