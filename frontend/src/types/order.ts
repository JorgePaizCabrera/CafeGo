export const PACKAGE_TYPES = [
  'transparente',
  'laminada',
  'trilaminada sin válvula',
  'trilaminada con válvula',
  'kraft sin válvula',
  'kraft con válvula',
] as const

export type PackageType = typeof PACKAGE_TYPES[number]
export type PackageAllocation = Record<PackageType, number>

export type CoffeeType = 'pergamino' | 'natural' | 'oro'

export const COFFEE_TYPE_LABELS: Record<CoffeeType, string> = {
  pergamino: 'Pergamino',
  natural: 'Natural',
  oro: 'Oro',
}

export function coffeeTypeHasCleaningStep(coffeeType: CoffeeType): boolean {
  return coffeeType === 'natural' || coffeeType === 'oro'
}

export interface Roast {
  id: number
  weightLb: number
  initialTemp: number
  returnTemp: number
  returnTime: string
  dehydrationTemp: number
  dehydrationTime: string
  caramelizationTemp: number
  caramelizationTime: string
  crackTemp: number
  crackTime: string
  finalTemp: number
  finalTime: string
  notes: string
}

export const STATUS_ORDER = [
  'Recibido',
  'En preparación',
  'En tueste',
  'En molienda',
  'En empaque',
  'Finalizado',
] as const

export type OrderStatus = typeof STATUS_ORDER[number]

export interface Order {
  id: string
  orderNo: string
  clientId: string
  clientName: string
  phone: string
  city: string
  receivedDate: string
  estimatedDate: string
  coffeeType: CoffeeType
  initialWeight: number
  humidity: number
  cleaningWeight: number
  threshingWeight: number
  roasts: Roast[]
  finalWeight: number
  roastType: string
  grindType: string
  totalPrice: number
  pagado: boolean
  pagadoAt: string | null
  bagSizeGrams: number
  actualFullBags: number
  actualRemainderGrams: number
  packageAllocation: PackageAllocation
  incompletePackageType: PackageType
  status: OrderStatus
  currentStepName: string
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
  seguimientoToken: string
  seguimientoActivo: boolean
}

export interface Client {
  id: string
  name: string
  city: string
  phone: string
  createdAt: string
  updatedAt: string
}

export interface ClientWithOrders extends Client {
  orders: Order[]
}

const STEP_STATUS_MAP: Record<string, OrderStatus> = {
  'Recepción': 'Recibido',
  'Limpieza': 'En preparación',
  'Trillado': 'En preparación',
  'Tuestes': 'En tueste',
  'Postproceso': 'En molienda',
  'Empaque': 'En empaque',
  'Resumen': 'En empaque',
}

export function statusForCompletedStep(stepName: string): OrderStatus {
  return STEP_STATUS_MAP[stepName] ?? 'Recibido'
}

export function statusProgressFraction(status: OrderStatus): number {
  return (STATUS_ORDER.indexOf(status) + 1) / STATUS_ORDER.length
}

export interface OrderMermaBreakdown {
  mermaLimpieza: number
  mermaTrillado: number
  mermaTueste: number
  total: number
}

// El peso final del postproceso ya incluye tueste y molido, por eso su merma se calcula en un solo paso.
export function orderMermaLb(o: Pick<Order, 'coffeeType' | 'initialWeight' | 'cleaningWeight' | 'threshingWeight' | 'finalWeight'>): OrderMermaBreakdown {
  const hasCleaning = coffeeTypeHasCleaningStep(o.coffeeType)
  const mermaLimpieza = hasCleaning && o.cleaningWeight > 0 ? Math.max(o.initialWeight - o.cleaningWeight, 0) : 0
  const antesDeTrillado = hasCleaning ? o.cleaningWeight : o.initialWeight
  const mermaTrillado = o.threshingWeight > 0 ? Math.max(antesDeTrillado - o.threshingWeight, 0) : 0
  const mermaTueste = o.finalWeight > 0 ? Math.max(o.threshingWeight - o.finalWeight, 0) : 0
  return { mermaLimpieza, mermaTrillado, mermaTueste, total: mermaLimpieza + mermaTrillado + mermaTueste }
}
