export type RawMaterialType = 'pergamino' | 'oro' | 'natural'

export const RAW_MATERIAL_LABELS: Record<RawMaterialType, string> = {
  pergamino: 'Pergamino',
  oro: 'Oro',
  natural: 'Natural',
}

export type SegundaType = Extract<RawMaterialType, 'oro' | 'natural'>

export const ROAST_TYPES = ['claro', 'medio', 'oscuro'] as const
export type RoastType = typeof ROAST_TYPES[number]

export const ROAST_TYPE_LABELS: Record<RoastType, string> = {
  claro: 'Claro',
  medio: 'Medio',
  oscuro: 'Oscuro',
}

export type ProductionStatus = 'en_proceso' | 'terminada'

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  en_proceso: 'En proceso',
  terminada: 'Terminada',
}

export interface RoastBatch {
  id: number
  weightLb: number
  notes: string
}

export const GOURMET_STEPS = ['Pergamino', 'Trillado', 'Tueste', 'Reserva para cafetería', 'Molido', 'Empaque', 'Resumen'] as const
export type GourmetStep = typeof GOURMET_STEPS[number]

export interface GourmetProduction {
  id: string
  code: string
  type: 'gourmet'
  status: ProductionStatus
  currentStepName: GourmetStep
  fecha: string
  pergaminoUsedLb: number
  trilladoWeightLb: number
  roastType: RoastType
  roasts: RoastBatch[]
  pesoTuesteResultLb: number
  reservaCafeteriaLb: number
  molidoWeightLb: number
  actualFullBags: number
  actualRemainderGrams: number
  comercialBags: number
  especialBags: number
  notas: string
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
}

export const BLEND_STEPS = ['Planificación', 'Trillado', 'Tueste', 'Molido y mezcla', 'Empaque', 'Resumen'] as const
export type BlendStep = typeof BLEND_STEPS[number]

export interface BlendProduction {
  id: string
  code: string
  type: 'blend'
  status: ProductionStatus
  currentStepName: BlendStep
  fecha: string
  cantidadPlanificadaLb: number
  segundaType: SegundaType
  pergaminoUsedLb: number
  segundaUsedLb: number
  trilladoWeightLb: number
  roasts: RoastBatch[]
  pesoTuesteResultLb: number
  molidoMezclaWeightLb: number
  actualFullBags: number
  actualRemainderGrams: number
  notas: string
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
}

export type Production = GourmetProduction | BlendProduction

export function roastedAllocatedLb(roasts: RoastBatch[]): number {
  return roasts.reduce((sum, r) => sum + (Number(r.weightLb) || 0), 0)
}

export const BLEND_PERGAMINO_RATIO = 0.35
export const BLEND_SEGUNDA_RATIO = 0.65

export function blendRequiredRawMaterial(cantidadLb: number): { pergaminoLb: number, segundaLb: number } {
  const pergaminoLb = Math.round(cantidadLb * BLEND_PERGAMINO_RATIO * 100) / 100
  const segundaLb = Math.round((cantidadLb - pergaminoLb) * 100) / 100
  return { pergaminoLb, segundaLb }
}

export interface MermaBreakdown {
  mermaTrillado: number
  mermaTueste: number
  mermaMolido: number
  total: number
}

export function gourmetMermaLb(p: Pick<GourmetProduction, 'pergaminoUsedLb' | 'trilladoWeightLb' | 'roasts' | 'pesoTuesteResultLb' | 'reservaCafeteriaLb' | 'molidoWeightLb'>): MermaBreakdown {
  const roastedTotal = roastedAllocatedLb(p.roasts)
  const restanteParaMolido = Math.max(p.pesoTuesteResultLb - p.reservaCafeteriaLb, 0)
  const mermaTrillado = Math.max(p.pergaminoUsedLb - p.trilladoWeightLb, 0)
  const mermaTueste = Math.max(roastedTotal - p.pesoTuesteResultLb, 0)
  const mermaMolido = Math.max(restanteParaMolido - p.molidoWeightLb, 0)
  return { mermaTrillado, mermaTueste, mermaMolido, total: mermaTrillado + mermaTueste + mermaMolido }
}

export function blendMermaLb(p: Pick<BlendProduction, 'pergaminoUsedLb' | 'segundaUsedLb' | 'trilladoWeightLb' | 'roasts' | 'pesoTuesteResultLb' | 'molidoMezclaWeightLb'>): MermaBreakdown {
  const totalRawInput = p.pergaminoUsedLb + p.segundaUsedLb
  const roastedTotal = roastedAllocatedLb(p.roasts)
  const mermaTrillado = Math.max(totalRawInput - p.trilladoWeightLb, 0)
  const mermaTueste = Math.max(roastedTotal - p.pesoTuesteResultLb, 0)
  const mermaMolido = Math.max(p.pesoTuesteResultLb - p.molidoMezclaWeightLb, 0)
  return { mermaTrillado, mermaTueste, mermaMolido, total: mermaTrillado + mermaTueste + mermaMolido }
}
