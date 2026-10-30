import type { Order } from '../types/order'

const CODIGO_PAIS = '502'

export function seguimientoUrl(token: string): string {
  const base = (import.meta.env.VITE_PUBLIC_URL || window.location.origin).replace(/\/+$/, '')
  return `${base}/seguimiento/${token}`
}

// Todos los clientes son de Guatemala: un número de 8 dígitos se completa con el código de país.
export function whatsappNumero(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '')
  if (digitos.length === 8) return CODIGO_PAIS + digitos
  if (digitos.length === 11 && digitos.startsWith(CODIGO_PAIS)) return digitos
  return null
}

export function formatTelefonoGt(numero: string): string {
  const local = numero.slice(CODIGO_PAIS.length)
  return `+${CODIGO_PAIS} ${local.slice(0, 4)}-${local.slice(4)}`
}

export function mensajeSeguimiento(order: Pick<Order, 'clientName' | 'orderNo' | 'seguimientoToken'>): string {
  const saludo = order.clientName ? `Hola, ${order.clientName}.` : 'Hola.'
  return `${saludo} En Go Café recibimos su café (orden ${order.orderNo}). `
    + `Aquí puede ver en qué paso va su pedido: ${seguimientoUrl(order.seguimientoToken)}\n\n`
    + 'Le avisaremos cuando esté listo para recoger.'
}

// En celular wa.me abre la app directo; en computadora muestra una página intermedia,
// así que ahí se va directo al chat de WhatsApp Web.
export function esCelular(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export function whatsappUrl(numero: string, mensaje: string): string {
  const texto = encodeURIComponent(mensaje)
  return esCelular()
    ? `https://wa.me/${numero}?text=${texto}`
    : `https://web.whatsapp.com/send?phone=${numero}&text=${texto}`
}
