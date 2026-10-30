import { OrderStatus } from '@prisma/client'

const STEP_STATUS_MAP: Record<string, OrderStatus> = {
  Recepción: OrderStatus.Recibido,
  Limpieza: OrderStatus.EnPreparacion,
  Trillado: OrderStatus.EnPreparacion,
  Tuestes: OrderStatus.EnTueste,
  Postproceso: OrderStatus.EnMolienda,
  Empaque: OrderStatus.EnEmpaque,
  Resumen: OrderStatus.EnEmpaque,
}

export function statusForCompletedStep(stepName: string): OrderStatus {
  return STEP_STATUS_MAP[stepName] ?? OrderStatus.Recibido
}
