import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../env'
import { UnauthorizedError } from '../errors'

export interface AuthPayload {
  sub: string
  username: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
  if (!token) throw new UnauthorizedError('Falta el token de autenticación.')

  try {
    req.user = jwt.verify(token, env.jwtSecret) as AuthPayload
    next()
  } catch {
    throw new UnauthorizedError('Token inválido o vencido.')
  }
}
