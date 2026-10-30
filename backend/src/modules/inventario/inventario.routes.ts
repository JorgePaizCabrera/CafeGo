import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/asyncHandler'
import { AppError } from '../../errors'
import * as inventarioService from './inventario.service'
import * as empaqueService from './empaque.service'
import * as gastosService from './gastos.service'
import { ALL_MATERIALS, RAW_MATERIALS, type RawMaterialType, type StockMaterial } from './inventario.constants'
import { EMPAQUE_TYPES, type EmpaqueType } from './empaque.constants'

export const inventarioRouter = Router()

function parseRawMaterial(value: string): RawMaterialType {
  if (!RAW_MATERIALS.includes(value as RawMaterialType)) {
    throw new AppError(`Material inválido: ${value}. Debe ser uno de: ${RAW_MATERIALS.join(', ')}.`)
  }
  return value as RawMaterialType
}

function parseEmpaqueType(value: string): EmpaqueType {
  if (!(EMPAQUE_TYPES as readonly string[]).includes(value)) {
    throw new AppError(`Tipo de empaque inválido: ${value}.`)
  }
  return value as EmpaqueType
}

const ROAST_TYPES = ['claro', 'medio', 'oscuro'] as const

function parseFecha(value: unknown, campo: string): Date {
  const fecha = typeof value === 'string' ? new Date(value) : new Date(NaN)
  if (Number.isNaN(fecha.getTime())) throw new AppError(`Fecha inválida en "${campo}".`)
  return fecha
}

inventarioRouter.get(
  '/gastos',
  asyncHandler(async (req, res) => {
    const desde = parseFecha(req.query.desde, 'desde')
    const hasta = parseFecha(req.query.hasta, 'hasta')
    if (hasta <= desde) throw new AppError('"hasta" debe ser posterior a "desde".')
    res.json(await gastosService.getGastos(desde, hasta))
  })
)

inventarioRouter.get(
  '/stock',
  asyncHandler(async (_req, res) => {
    res.json(await inventarioService.getStockSnapshot())
  })
)

inventarioRouter.get(
  '/alertas',
  asyncHandler(async (_req, res) => {
    res.json(await inventarioService.getInventoryAlerts())
  })
)

inventarioRouter.get(
  '/movimientos',
  asyncHandler(async (req, res) => {
    const { material, desde, hasta } = req.query
    if (typeof material === 'string' && !(ALL_MATERIALS as string[]).includes(material)) {
      throw new AppError(`Material inválido: ${material}.`)
    }
    res.json(
      await inventarioService.getMovimientos({
        material: typeof material === 'string' ? (material as StockMaterial) : undefined,
        desde: typeof desde === 'string' ? new Date(desde) : undefined,
        hasta: typeof hasta === 'string' ? new Date(hasta) : undefined,
      })
    )
  })
)

const cantidadMotivoSchema = z.object({ cantidadLb: z.number().positive(), motivo: z.string().default('') })
const costoTotalSchema = z.number().nonnegative().max(9_999_999_999).optional()

inventarioRouter.post(
  '/materia-prima/:material/entrada',
  asyncHandler(async (req, res) => {
    const material = parseRawMaterial(req.params.material)
    const { cantidadLb, motivo, costoTotal } = cantidadMotivoSchema.extend({ costoTotal: costoTotalSchema }).parse(req.body)
    await inventarioService.registrarEntradaMateriaPrima(material, cantidadLb, motivo, costoTotal)
    res.status(204).end()
  })
)

const corregirCostoSchema = z.object({ costoTotal: z.number().nonnegative().max(9_999_999_999).nullable() })

inventarioRouter.patch(
  '/movimientos/:id/costo',
  asyncHandler(async (req, res) => {
    const { costoTotal } = corregirCostoSchema.parse(req.body)
    await gastosService.corregirCostoMateriaPrima(req.params.id, costoTotal)
    res.status(204).end()
  })
)

inventarioRouter.post(
  '/materia-prima/:material/salida',
  asyncHandler(async (req, res) => {
    const material = parseRawMaterial(req.params.material)
    const { cantidadLb, motivo } = cantidadMotivoSchema.parse(req.body)
    await inventarioService.registrarSalidaMateriaPrima(material, cantidadLb, motivo)
    res.status(204).end()
  })
)

inventarioRouter.patch(
  '/materia-prima/:material/umbral',
  asyncHandler(async (req, res) => {
    const material = parseRawMaterial(req.params.material)
    const { minimoLb } = z.object({ minimoLb: z.number().min(0) }).parse(req.body)
    await inventarioService.updateUmbral(material, minimoLb)
    res.status(204).end()
  })
)

inventarioRouter.get(
  '/grano-cafeteria/umbral',
  asyncHandler(async (_req, res) => {
    res.json({ minimoLb: await inventarioService.getGranoMinimo() })
  })
)

inventarioRouter.patch(
  '/grano-cafeteria/umbral',
  asyncHandler(async (req, res) => {
    const { minimoLb } = z.object({ minimoLb: z.number().min(0) }).parse(req.body)
    await inventarioService.updateGranoMinimo(minimoLb)
    res.status(204).end()
  })
)

inventarioRouter.post(
  '/grano-cafeteria/:tipo/salida',
  asyncHandler(async (req, res) => {
    const tipo = req.params.tipo
    if (!ROAST_TYPES.includes(tipo as any)) throw new AppError(`Tueste inválido: ${tipo}.`)
    const { cantidadLb, motivo } = cantidadMotivoSchema.parse(req.body)
    await inventarioService.descontarGranoCafeteria(`grano_${tipo}` as any, cantidadLb, motivo)
    res.status(204).end()
  })
)

const gourmetBolsasSchema = z.object({
  tipoBolsa: z.enum(inventarioService.GOURMET_BAG_TYPES),
  bolsas: z.number().int().positive(),
  motivo: z.string().default(''),
})

inventarioRouter.get(
  '/empacado',
  asyncHandler(async (_req, res) => {
    res.json(await inventarioService.getProductoEmpacado())
  })
)

inventarioRouter.post(
  '/gourmet/salida',
  asyncHandler(async (req, res) => {
    const { tipoBolsa, bolsas, motivo } = gourmetBolsasSchema.parse(req.body)
    await inventarioService.descontarGourmetTerminado(tipoBolsa, bolsas, motivo)
    res.status(204).end()
  })
)

inventarioRouter.post(
  '/gourmet/empacar-sobrante',
  asyncHandler(async (req, res) => {
    const { tipoBolsa, bolsas, motivo } = gourmetBolsasSchema.parse(req.body)
    await inventarioService.empacarSobrante(tipoBolsa, bolsas, motivo)
    res.status(204).end()
  })
)

inventarioRouter.post(
  '/blend/empacar-sobrante',
  asyncHandler(async (req, res) => {
    const { bolsas, motivo } = z.object({ bolsas: z.number().int().positive(), motivo: z.string().default('') }).parse(req.body)
    await inventarioService.empacarSobrante('blend', bolsas, motivo)
    res.status(204).end()
  })
)

inventarioRouter.post(
  '/blend/salida',
  asyncHandler(async (req, res) => {
    const { bolsas, motivo } = z.object({ bolsas: z.number().int().positive(), motivo: z.string().default('') }).parse(req.body)
    await inventarioService.enviarBlendTerminado(bolsas, motivo)
    res.status(204).end()
  })
)

const cantidadMotivoEmpaqueSchema = z.object({ cantidad: z.number().int().positive(), motivo: z.string().default('') })

inventarioRouter.get(
  '/empaque/stock',
  asyncHandler(async (_req, res) => {
    res.json(await empaqueService.getEmpaqueStockSnapshot())
  })
)

inventarioRouter.get(
  '/empaque/alertas',
  asyncHandler(async (_req, res) => {
    res.json(await empaqueService.getEmpaqueAlerts())
  })
)

inventarioRouter.get(
  '/empaque/movimientos',
  asyncHandler(async (req, res) => {
    const { tipo, desde, hasta } = req.query
    res.json(
      await empaqueService.getEmpaqueMovimientos({
        tipo: typeof tipo === 'string' ? parseEmpaqueType(tipo) : undefined,
        desde: typeof desde === 'string' ? new Date(desde) : undefined,
        hasta: typeof hasta === 'string' ? new Date(hasta) : undefined,
      })
    )
  })
)

inventarioRouter.patch(
  '/empaque/movimientos/:id/costo',
  asyncHandler(async (req, res) => {
    const { costoTotal } = corregirCostoSchema.parse(req.body)
    await gastosService.corregirCostoEmpaque(req.params.id, costoTotal)
    res.status(204).end()
  })
)

inventarioRouter.post(
  '/empaque/:tipo/entrada',
  asyncHandler(async (req, res) => {
    const tipo = parseEmpaqueType(req.params.tipo)
    const { cantidad, motivo, costoTotal } = cantidadMotivoEmpaqueSchema.extend({ costoTotal: costoTotalSchema }).parse(req.body)
    await empaqueService.registrarEntradaEmpaque(tipo, cantidad, motivo, costoTotal)
    res.status(204).end()
  })
)

inventarioRouter.post(
  '/empaque/:tipo/salida',
  asyncHandler(async (req, res) => {
    const tipo = parseEmpaqueType(req.params.tipo)
    const { cantidad, motivo } = cantidadMotivoEmpaqueSchema.parse(req.body)
    await empaqueService.registrarSalidaEmpaque(tipo, cantidad, motivo)
    res.status(204).end()
  })
)

inventarioRouter.patch(
  '/empaque/:tipo/umbral',
  asyncHandler(async (req, res) => {
    const tipo = parseEmpaqueType(req.params.tipo)
    const { minimo } = z.object({ minimo: z.number().int().min(0) }).parse(req.body)
    await empaqueService.updateEmpaqueUmbral(tipo, minimo)
    res.status(204).end()
  })
)
