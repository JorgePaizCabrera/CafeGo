// Debe mantenerse sincronizado con frontend/src/types/order.ts.
export const PACKAGE_TYPES = [
  'transparente',
  'laminada',
  'trilaminada sin válvula',
  'trilaminada con válvula',
  'kraft sin válvula',
  'kraft con válvula',
] as const

export type PackageType = (typeof PACKAGE_TYPES)[number]

export const ORDER_STEPS = ['Recepción', 'Limpieza', 'Trillado', 'Tuestes', 'Postproceso', 'Empaque', 'Resumen'] as const
export const ORDER_ROAST_TYPES = ['claro', 'medio', 'oscuro'] as const
export const GRIND_TYPES = ['gruesa', 'media', 'fina'] as const
