import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler'
import * as clientesService from './clientes.service'

export const clientesRouter = Router()

const clienteInputSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  ciudad: z.string().trim().min(1).max(120),
  telefono: z
    .string()
    .trim()
    .refine(v => /^[\d\s-]+$/.test(v) && v.replace(/\D/g, '').length === 8, { message: 'El teléfono debe tener 8 dígitos.' }),
})

clientesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await clientesService.listClientes())
  })
)

clientesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await clientesService.getClienteConOrdenes(req.params.id))
  })
)

clientesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = clienteInputSchema.parse(req.body)
    res.status(201).json(await clientesService.createCliente(input))
  })
)

clientesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const patch = clienteInputSchema.partial().parse(req.body)
    res.json(await clientesService.updateCliente(req.params.id, patch))
  })
)

clientesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await clientesService.deleteCliente(req.params.id)
    res.status(204).end()
  })
)
