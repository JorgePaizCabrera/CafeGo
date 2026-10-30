import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../../lib/prisma'
import { env } from '../../env'
import { UnauthorizedError } from '../../errors'

export async function login(username: string, password: string) {
  const usuario = await prisma.usuario.findUnique({ where: { username } })
  if (!usuario) throw new UnauthorizedError('Usuario o contraseña incorrectos.')

  const valid = await bcrypt.compare(password, usuario.passwordHash)
  if (!valid) throw new UnauthorizedError('Usuario o contraseña incorrectos.')

  const token = jwt.sign({ sub: usuario.id, username: usuario.username }, env.jwtSecret, { expiresIn: '12h' })
  return { token, usuario: { id: usuario.id, username: usuario.username } }
}
