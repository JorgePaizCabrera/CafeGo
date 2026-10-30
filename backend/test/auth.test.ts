import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { prisma } from '../src/lib/prisma'
import { resetDb, disconnectDb } from './helpers/db'
import { request, app, ADMIN_USERNAME, ADMIN_PASSWORD, createAdminAndLogin, authHeader } from './helpers/testApp'

beforeEach(resetDb)
afterAll(disconnectDb)

describe('POST /api/auth/login', () => {
  it('rechaza credenciales cuando el usuario no existe', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'nadie', password: 'lo-que-sea' })
    expect(res.status).toBe(401)
  })

  it('rechaza la contraseña incorrecta', async () => {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 4)
    await prisma.usuario.create({ data: { username: ADMIN_USERNAME, passwordHash } })

    const res = await request(app).post('/api/auth/login').send({ username: ADMIN_USERNAME, password: 'incorrecta' })
    expect(res.status).toBe(401)
  })

  it('devuelve un token y el usuario con credenciales correctas', async () => {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 4)
    await prisma.usuario.create({ data: { username: ADMIN_USERNAME, passwordHash } })

    const res = await request(app).post('/api/auth/login').send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    expect(typeof res.body.token).toBe('string')
    expect(res.body.usuario.username).toBe(ADMIN_USERNAME)
  })

  it('valida el body con zod (400 si faltan campos)', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/auth/me', () => {
  it('rechaza sin token', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })

  it('rechaza un token inválido', async () => {
    const res = await request(app).get('/api/auth/me').set(authHeader('esto-no-es-un-jwt'))
    expect(res.status).toBe(401)
  })

  it('devuelve el usuario autenticado con un token válido', async () => {
    const token = await createAdminAndLogin()
    const res = await request(app).get('/api/auth/me').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.username).toBe(ADMIN_USERNAME)
  })
})

describe('rutas protegidas', () => {
  it('cualquier módulo aparte de auth exige token', async () => {
    const res = await request(app).get('/api/clientes')
    expect(res.status).toBe(401)
  })
})
