import { prisma } from '../../lib/prisma'
import { NotFoundError } from '../../errors'
import { formatFolio } from '../../utils/folio'
import { env } from '../../env'
import * as walletService from '../wallet/wallet.service'

const TOKEN_FORMATO = /^[0-9a-f]{32}$/

// Vista pública de una orden: solo lo que el cliente necesita para seguir su pedido (sin precios ni datos del proceso).
async function ordenActiva(token: string) {
  const orden = TOKEN_FORMATO.test(token)
    ? await prisma.orden.findUnique({ where: { seguimientoToken: token }, include: { cliente: { select: { nombre: true } } } })
    : null
  if (!orden || !orden.seguimientoActivo) throw new NotFoundError('No encontramos este pedido. Revisa que el enlace esté completo.')
  return orden
}

export async function getSeguimiento(token: string) {
  const orden = await ordenActiva(token)

  return {
    orderNo: formatFolio('GC', orden.seq),
    clienteNombre: orden.cliente.nombre,
    coffeeType: orden.coffeeType,
    initialWeight: orden.initialWeight,
    receivedDate: orden.receivedDate,
    estimatedDate: orden.estimatedDate,
    status: orden.status,
    finalizedAt: orden.finalizedAt,
    updatedAt: orden.updatedAt,
    wallet: env.walletBoton && walletService.walletHabilitado(),
  }
}

export async function getEnlaceWallet(token: string) {
  const orden = await ordenActiva(token)
  if (!walletService.walletHabilitado()) throw new NotFoundError('Google Wallet no está disponible.')
  return { url: await walletService.enlaceGuardar(orden) }
}
