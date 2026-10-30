import { PACKAGE_TYPES } from '../ordenes/ordenes.constants'

export const CLIENT_PACKAGE_TYPES = PACKAGE_TYPES

export const PRODUCTION_PACKAGE_TYPES = ['comercial', 'especial', 'blend'] as const
export type ProductionPackageType = (typeof PRODUCTION_PACKAGE_TYPES)[number]

export const EMPAQUE_TYPES = [...CLIENT_PACKAGE_TYPES, ...PRODUCTION_PACKAGE_TYPES] as const
export type EmpaqueType = (typeof EMPAQUE_TYPES)[number]

export const EMPAQUE_LABELS: Record<EmpaqueType, string> = {
  transparente: 'Transparente',
  laminada: 'Laminada',
  'trilaminada sin válvula': 'Trilaminada sin válvula',
  'trilaminada con válvula': 'Trilaminada con válvula',
  'kraft sin válvula': 'Kraft sin válvula',
  'kraft con válvula': 'Kraft con válvula',
  comercial: 'Bolsa Comercial (Producción propia)',
  especial: 'Bolsa Especial (Producción propia)',
  blend: 'Bolsa Blend (Producción propia)',
}
