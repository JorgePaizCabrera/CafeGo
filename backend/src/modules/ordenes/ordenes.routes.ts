import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler'
import * as ordenesService from './ordenes.service'
import { GRIND_TYPES, ORDER_ROAST_TYPES, ORDER_STEPS, PACKAGE_TYPES } from './ordenes.constants'

export const ordenesRouter = Router()

const peso = z.number().nonnegative()
const temp = z.number().nonnegative()
const tiempo = z.string().max(20)

const roastSchema = z.object({
  weightLb: peso,
  initialTemp: temp,
  returnTemp: temp,
  returnTime: tiempo,
  dehydrationTemp: temp,
  dehydrationTime: tiempo,
  caramelizationTemp: temp,
  caramelizationTime: tiempo,
  crackTemp: temp,
  crackTime: tiempo,
  finalTemp: temp,
  finalTime: tiempo,
  notes: z.string().max(1000).default(''),
})

const packageAllocationSchema = z.record(z.enum(PACKAGE_TYPES), z.number().int().min(0))

const isoDateString = z.string().refine(v => !isNaN(new Date(v).getTime()), { message: 'Fecha inválida.' })

const ordenFields = z.object({
  clienteId: z.string().uuid(),
  receivedDate: isoDateString,
  estimatedDate: isoDateString,
  coffeeType: z.enum(['pergamino', 'natural', 'oro']),
  initialWeight: z.number().positive(),
  humidity: z.number().min(0).max(100),
  cleaningWeight: peso.optional(),
  threshingWeight: peso.optional(),
  roasts: z.array(roastSchema).max(200).optional(),
  finalWeight: peso.optional(),
  roastType: z.enum(ORDER_ROAST_TYPES),
  grindType: z.enum(GRIND_TYPES),
  totalPrice: z.number().nonnegative().optional(),
  bagSizeGrams: z.number().positive().optional(),
  actualFullBags: z.number().int().nonnegative().optional(),
  actualRemainderGrams: z.number().nonnegative().optional(),
  packageAllocation: packageAllocationSchema,
  incompletePackageType: z.enum(PACKAGE_TYPES),
  currentStepName: z.enum(ORDER_STEPS),
})

function fechasEnOrden(o: { receivedDate?: string; estimatedDate?: string }, ctx: z.RefinementCtx) {
  if (o.receivedDate && o.estimatedDate && new Date(o.estimatedDate) < new Date(o.receivedDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['estimatedDate'], message: 'La fecha estimada de entrega no puede ser anterior a la de recepción.' })
  }
}

const createOrdenSchema = ordenFields.superRefine(fechasEnOrden)

const updateOrdenSchema = ordenFields
  .omit({ clienteId: true })
  .partial()
  .extend({ pagado: z.boolean().optional() })
  .superRefine(fechasEnOrden)

ordenesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const clienteId = typeof req.query.clienteId === 'string' ? req.query.clienteId : undefined
    res.json(await ordenesService.listOrdenes({ clienteId }))
  })
)

ordenesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => res.json(await ordenesService.getOrden(req.params.id)))
)

ordenesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createOrdenSchema.parse(req.body)
    res.status(201).json(await ordenesService.createOrden(input))
  })
)

ordenesRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const patch = updateOrdenSchema.parse(req.body)
    res.json(await ordenesService.updateOrden(req.params.id, patch))
  })
)

ordenesRouter.post(
  '/:id/finalizar',
  asyncHandler(async (req, res) => res.json(await ordenesService.finalizeOrden(req.params.id)))
)

ordenesRouter.patch(
  '/:id/pagado',
  asyncHandler(async (req, res) => {
    const { pagado } = z.object({ pagado: z.boolean() }).parse(req.body)
    res.json(await ordenesService.setOrdenPagado(req.params.id, pagado))
  })
)

ordenesRouter.post(
  '/:id/seguimiento',
  asyncHandler(async (req, res) => res.json(await ordenesService.activarSeguimiento(req.params.id)))
)

ordenesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await ordenesService.deleteOrden(req.params.id)
    res.status(204).end()
  })
)
