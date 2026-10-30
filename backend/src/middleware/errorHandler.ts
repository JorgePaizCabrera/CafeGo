import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from '../errors'

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada.' })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Datos inválidos.', details: err.flatten() })
    return
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    res.status(404).json({ error: 'Registro relacionado no encontrado.' })
    return
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    res.status(409).json({ error: 'Ya existe un registro con ese valor.' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor.' })
}
