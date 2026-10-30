import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../../src/app'
import { prisma } from '../../src/lib/prisma'

export const ADMIN_USERNAME = 'admin_test'
export const ADMIN_PASSWORD = 'admin-test-password'

export async function createAdminAndLogin(): Promise<string> {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 4)
  await prisma.usuario.create({ data: { username: ADMIN_USERNAME, passwordHash } })
  const res = await request(app).post('/api/auth/login').send({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD })
  if (res.status !== 200) throw new Error(`No se pudo iniciar sesión en el helper de test: ${res.status} ${JSON.stringify(res.body)}`)
  return res.body.token as string
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export { app, request }
