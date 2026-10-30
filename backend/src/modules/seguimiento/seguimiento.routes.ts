import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../../middleware/asyncHandler'
import * as seguimientoService from './seguimiento.service'

export const seguimientoRouter = Router()

const seguimientoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas. Espera un momento e intenta de nuevo.' },
})

seguimientoRouter.get(
  '/:token/wallet',
  seguimientoLimiter,
  asyncHandler(async (req, res) => res.json(await seguimientoService.getEnlaceWallet(req.params.token)))
)

seguimientoRouter.get(
  '/:token',
  seguimientoLimiter,
  asyncHandler(async (req, res) => res.json(await seguimientoService.getSeguimiento(req.params.token)))
)
