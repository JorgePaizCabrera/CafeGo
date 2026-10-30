import { useEffect, useState } from 'react'
import { Copy, Loader2, MapPin, Phone, Send, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from './ui/feedback'
import type { Order } from '../types/order'
import { activarSeguimiento } from '../store/ordersStore'
import { esCelular, formatTelefonoGt, mensajeSeguimiento, seguimientoUrl, whatsappNumero, whatsappUrl } from '../utils/seguimiento'

export interface OfrecerSeguimientoState { ofrecerSeguimiento: true }

// Abre la ventana cuando se llega a la página justo después de crear la orden (estado de navegación).
export function useOfertaSeguimiento(order: Order | undefined) {
  const location = useLocation()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const ofrecer = (location.state as Partial<OfrecerSeguimientoState> | null)?.ofrecerSeguimiento === true

  useEffect(() => {
    if (!ofrecer || !order) return
    navigate(location.pathname, { replace: true, state: null })
    if (!order.seguimientoActivo) setAbierto(true)
  }, [ofrecer, order, navigate, location.pathname])

  return { abierto, cerrar: () => setAbierto(false) }
}

function WhatsAppIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.27.49 1.7.63.72.23 1.37.2 1.88.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.05 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43a9.38 9.38 0 0 1 6.67 2.77 9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.47A11.3 11.3 0 0 0 12.05.7C5.79.7.7 5.79.7 12.04c0 2 .52 3.95 1.52 5.66L.6 23.3l5.74-1.5a11.3 11.3 0 0 0 5.7 1.45h.01c6.25 0 11.34-5.09 11.35-11.34a11.27 11.27 0 0 0-3.32-8.03z" />
    </svg>
  )
}

export default function SeguimientoWhatsAppModal({ order, onClose }: { order: Order, onClose: () => void }) {
  const numero = whatsappNumero(order.phone)
  const mensaje = mensajeSeguimiento(order)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, enviando])

  // WhatsApp se abre dentro del mismo clic (si se espera al servidor, el navegador bloquea la pestaña).
  // En computadora se reutiliza siempre la misma pestaña de WhatsApp Web.
  const enviar = async () => {
    if (!numero || enviando) return
    setEnviando(true)
    const activacion = activarSeguimiento(order.id)
    window.open(whatsappUrl(numero, mensaje), esCelular() ? '_blank' : 'gocafe-whatsapp', 'noopener')
    try {
      await activacion
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? `${err.message} El enlace aún no funciona: vuelve a intentarlo.` : 'No se pudo activar el seguimiento.')
      setEnviando(false)
    }
  }

  const copiar = async () => {
    if (enviando) return
    setEnviando(true)
    try {
      await activarSeguimiento(order.id)
      await navigator.clipboard.writeText(seguimientoUrl(order.seguimientoToken))
      toast.success('Enlace de seguimiento copiado.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo copiar el enlace.')
      setEnviando(false)
    }
  }

  const inicial = (order.clientName || '?').trim().charAt(0).toUpperCase()

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-stone-950/60 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !enviando && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seguimiento-titulo"
        className="animate-slide-up max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-[#25D366] via-[#1fb855] to-[#128C7E] px-6 pb-7 pt-6 text-white">
          <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15" />
          <div className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-white/10" />
          <button className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 text-white transition hover:bg-white/30 disabled:opacity-50" onClick={onClose} disabled={enviando} aria-label="Cerrar">
            <X size={16} />
          </button>
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#25D366] shadow-lg shadow-black/10">
            <WhatsAppIcon size={30} />
          </div>
          <h3 id="seguimiento-titulo" className="relative mt-4 text-xl font-bold leading-tight">
            {numero ? '¿Darle seguimiento por WhatsApp?' : 'Seguimiento del pedido'}
          </h3>
          <p className="relative mt-1 text-sm text-white/85">
            El cliente verá desde su celular en qué paso va la orden <b className="font-semibold text-white">{order.orderNo}</b>.
          </p>
        </div>

        <div className="space-y-4 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:pb-6">
          <div className="flex items-center gap-3 rounded-2xl border border-stone-200 p-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base font-bold text-amber-800">{inicial}</span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-stone-900">{order.clientName || 'Cliente sin nombre'}</p>
              <p className="flex items-center gap-1.5 text-sm text-stone-500">
                <Phone size={13} /> {numero ? formatTelefonoGt(numero) : (order.phone || 'Sin teléfono')}
                {order.city && <><span className="text-stone-300">·</span><MapPin size={13} /> <span className="truncate">{order.city}</span></>}
              </p>
            </div>
          </div>

          {numero ? (
            <>
              <div className="rounded-2xl bg-[#efeae2] p-3">
                <div className="ml-auto max-w-[94%] whitespace-pre-line break-words rounded-2xl rounded-tr-md bg-[#d9fdd3] px-3.5 py-2.5 text-[13px] leading-relaxed text-stone-800 shadow-sm">
                  {mensaje}
                </div>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[#25D366] px-4 text-base font-bold text-white shadow-md shadow-[#25D366]/30 transition hover:bg-[#1ebe5b] active:scale-[0.98] disabled:opacity-70"
                  onClick={enviar}
                  disabled={enviando}
                >
                  {enviando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Enviar por WhatsApp
                </button>
                <button type="button" className="min-h-11 rounded-2xl text-sm font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50" onClick={onClose} disabled={enviando}>
                  No
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
                Este cliente no tiene un número de Guatemala válido. Puedes copiar el enlace y mandárselo por otro medio.
              </p>
              <div className="grid gap-2">
                <button type="button" className="btn-primary min-h-12 justify-center rounded-2xl text-base" onClick={copiar} disabled={enviando}>
                  {enviando ? <Loader2 size={18} className="animate-spin" /> : <Copy size={18} />} Copiar enlace
                </button>
                <button type="button" className="min-h-11 rounded-2xl text-sm font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-50" onClick={onClose} disabled={enviando}>
                  No
                </button>
              </div>
            </>
          )}

          <p className="text-center text-xs text-stone-400">Si eliges No, esta orden no tendrá seguimiento.</p>
        </div>
      </div>
    </div>
  )
}
