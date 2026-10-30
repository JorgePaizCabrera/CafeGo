import type { RoastType } from '@prisma/client'

export const RAW_MATERIALS = ['pergamino', 'oro', 'natural'] as const
export type RawMaterialType = (typeof RAW_MATERIALS)[number]

export type StockMaterial =
  | RawMaterialType
  | 'grano_claro'
  | 'grano_medio'
  | 'grano_oscuro'
  | 'gourmet'
  | 'blend_bolsas'

export const ALL_MATERIALS: StockMaterial[] = [
  'pergamino',
  'oro',
  'natural',
  'grano_claro',
  'grano_medio',
  'grano_oscuro',
  'gourmet',
  'blend_bolsas',
]

export const STOCK_LABELS: Record<StockMaterial, string> = {
  pergamino: 'Pergamino',
  oro: 'Oro',
  natural: 'Natural',
  grano_claro: 'Café en grano — Tueste Claro',
  grano_medio: 'Café en grano — Tueste Medio',
  grano_oscuro: 'Café en grano — Tueste Oscuro',
  gourmet: 'Gourmet (terminado)',
  blend_bolsas: 'Blend (bolsas de 350 g)',
}

export const GRANO_MATERIALS = ['grano_claro', 'grano_medio', 'grano_oscuro'] as const
export type GranoMaterial = (typeof GRANO_MATERIALS)[number]

export const MATERIA_PRIMA_MINIMO_DEFAULT_LB = 25

export const GRANO_MINIMO_CLAVE = 'grano_cafeteria_minimo_lb'
export const GRANO_MINIMO_DEFAULT_LB = 5

export function granoMaterial(tipo: RoastType): StockMaterial {
  return `grano_${tipo}` as StockMaterial
}
