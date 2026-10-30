import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler'
import { requireAuth } from '../../middleware/auth'
import * as authService from './auth.service'

export const authRouter = Router()

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo.' },
})

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body)
    const result = await authService.login(username, password)
    res.json(result)
  })
)

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user!.sub, username: req.user!.username })
})
