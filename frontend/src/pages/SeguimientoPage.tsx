import { useCallback, useEffect, useState, type ComponentType } from 'react'
import { useParams } from 'react-router-dom'
import { CalendarCheck, CalendarDays, Check, ClipboardCheck, Coffee, Cog, Flame, Loader2, Package, PackageCheck, RefreshCw, Scale, SearchX, Wheat } from 'lucide-react'
import { API_URL } from '../api/client'
import { orderStatusFromBackend } from '../store/ordersStore'
import { COFFEE_TYPE_LABELS, STATUS_ORDER, type CoffeeType, type OrderStatus } from '../types/order'
import { formatISODate } from '../utils/dates'

interface Seguimiento {
  orderNo: string
  clienteNombre: string
  coffeeType: CoffeeType
  initialWeight: string
  receivedDate: string
  estimatedDate: string
  status: OrderStatus
  updatedAt: string
  wallet: boolean
}

function GoogleWalletIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="3" fill="#fff" />
      <path d="M2 9.5h20V7a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3z" fill="#4285F4" />
      <path d="M2 12.5h20v-3H2z" fill="#34A853" />
      <path d="M2 15.5h20v-3H2z" fill="#FBBC04" />
      <path d="M2 17a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-1.5H2z" fill="#EA4335" />
    </svg>
  )
}

type Icono = ComponentType<{ size?: number, className?: string }>

const PASOS: Record<OrderStatus, { titulo: string, detalle: string, icono: Icono }> = {
  'Recibido': { titulo: 'Recibido', detalle: 'Recibimos su café en planta', icono: ClipboardCheck },
  'En preparación': { titulo: 'En preparación', detalle: 'Limpieza y trillado del grano', icono: Wheat },
  'En tueste': { titulo: 'En tueste', detalle: 'Su café se está tostando', icono: Flame },
  'En molienda': { titulo: 'En molienda', detalle: 'Molido al punto elegido', icono: Cog },
  'En empaque': { titulo: 'En empaque', detalle: 'Empacando su café', icono: Package },
  'Finalizado': { titulo: 'Listo para recoger', detalle: 'Ya puede pasar por su pedido', icono: PackageCheck },
}

const ACTUALIZAR_CADA_MS = 60_000
const HORA = new Intl.DateTimeFormat('es-GT', { hour: 'numeric', minute: '2-digit' })

export default function SeguimientoPage() {
  const { token = '' } = useParams<{ token: string }>()
  const [datos, setDatos] = useState<Seguimiento | null>(null)
  const [error, setError] = useState('')
  const [consultadoAt, setConsultadoAt] = useState<Date | null>(null)
  const [cargando, setCargando] = useState(false)
  const [abriendoWallet, setAbriendoWallet] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(new URL(`/api/seguimiento/${encodeURIComponent(token)}`, API_URL))
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(typeof body?.error === 'string' ? body.error : 'No se pudo consultar el pedido.')
        if (res.status === 404) setDatos(null)
        return
      }
      setDatos({ ...body, status: orderStatusFromBackend(body.status) })
      setError('')
      setConsultadoAt(new Date())
    } catch {
      setError('Sin conexión. Revise su internet; la página volverá a intentarlo sola.')
    } finally {
      setCargando(false)
    }
  }, [token])

  useEffect(() => {
    cargar()
    const intervalo = setInterval(cargar, ACTUALIZAR_CADA_MS)
    const alVolver = () => { if (document.visibilityState === 'visible') cargar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => { clearInterval(intervalo); document.removeEventListener('visibilitychange', alVolver) }
  }, [cargar])

  const agregarAWallet = async () => {
    setAbriendoWallet(true)
    try {
      const res = await fetch(new URL(`/api/seguimiento/${encodeURIComponent(token)}/wallet`, API_URL))
      const body = await res.json().catch(() => null)
      if (!res.ok || typeof body?.url !== 'string') throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo preparar la tarjeta.')
      window.location.href = body.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar la tarjeta.')
      setAbriendoWallet(false)
    }
  }

  useEffect(() => {
    if (datos) document.title = `Pedido ${datos.orderNo} · Go Café`
  }, [datos])

  const actual = datos ? STATUS_ORDER.indexOf(datos.status) : -1
  const listo = datos?.status === 'Finalizado'
  const progreso = datos ? Math.round(((actual + 1) / STATUS_ORDER.length) * 100) : 0
  const paso = datos ? PASOS[datos.status] : null
  const IconoActual = paso?.icono ?? Coffee

  return (
    <div className="min-h-dvh bg-[#f6f1ea]">
      <header className="relative overflow-hidden bg-gradient-to-br from-[#3a2314] via-[#24160d] to-[#120b07] px-4 pb-24 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-orange-700/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-lg items-center gap-3">
          <span className="rounded-full bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 p-0.5 shadow-md shadow-black/40">
            <img src="/images/cafelogo.jpg" alt="Logo Go Café" className="h-11 w-11 rounded-full border-2 border-[#1c120c] bg-white object-cover" />
          </span>
          <div className="leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200/80">Go Café</p>
            <p className="text-base font-semibold text-white/90">Seguimiento de pedido</p>
          </div>
        </div>
        {datos && (
          <div className="relative mx-auto mt-6 max-w-lg">
            <p className="text-sm text-amber-100/80">Hola{datos.clienteNombre ? `, ${datos.clienteNombre}` : ''} 👋</p>
            <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight">Orden {datos.orderNo}</h1>
          </div>
        )}
      </header>

      <main className="relative mx-auto -mt-16 max-w-lg space-y-4 px-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {!datos && !error && (
          <div className="card flex min-h-56 items-center justify-center rounded-3xl"><Loader2 size={28} className="animate-spin text-amber-600" /></div>
        )}

        {!datos && error && (
          <div className="card flex flex-col items-center rounded-3xl p-8 text-center">
            <div className="mb-4 rounded-full bg-stone-100 p-5 text-stone-500"><SearchX size={32} /></div>
            <h1 className="text-lg font-bold text-stone-900">Pedido no disponible</h1>
            <p className="mt-1 max-w-xs text-sm text-stone-500">{error}</p>
          </div>
        )}

        {datos && paso && (
          <>
            <section className={`card overflow-hidden rounded-3xl ${listo ? 'ring-2 ring-emerald-300' : ''}`}>
              <div className={`flex items-center gap-4 p-5 ${listo ? 'bg-gradient-to-br from-emerald-50 to-white' : 'bg-gradient-to-br from-amber-50 to-white'}`}>
                <div className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${listo ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/30'}`}>
                  <IconoActual size={30} />
                  {!listo && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-400"><span className="absolute inset-0 animate-ping rounded-full bg-amber-400" /></span>}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-wide ${listo ? 'text-emerald-600' : 'text-amber-700'}`}>
                    {listo ? '¡Pedido listo!' : `Paso ${actual + 1} de ${STATUS_ORDER.length}`}
                  </p>
                  <p className="text-xl font-extrabold leading-tight text-stone-900">{paso.titulo}</p>
                  <p className="text-sm text-stone-500">{paso.detalle}</p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-4">
                <div className="mb-1.5 flex justify-between text-xs font-semibold">
                  <span className="text-stone-500">Avance</span>
                  <span className={listo ? 'text-emerald-600' : 'text-amber-700'}>{progreso}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${listo ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500'}`}
                    style={{ width: `${progreso}%` }}
                  />
                </div>
                <div className={`mt-4 flex items-center gap-3 rounded-2xl p-3 ${listo ? 'bg-emerald-500 text-white' : 'bg-stone-900 text-white'}`}>
                  {listo ? <PackageCheck size={20} className="shrink-0" /> : <CalendarCheck size={20} className="shrink-0 text-amber-300" />}
                  <p className="text-sm">
                    {listo
                      ? <>Ya puede pasar a recoger su café.</>
                      : <>Entrega estimada: <b className="font-bold">{formatISODate(datos.estimatedDate)}</b></>}
                  </p>
                </div>
              </div>
            </section>

            {datos.wallet && (
              <button
                type="button"
                onClick={agregarAWallet}
                disabled={abriendoWallet}
                className="flex w-full items-center justify-center gap-3 rounded-full bg-black px-5 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-black/20 transition hover:bg-stone-800 active:scale-[0.99] disabled:opacity-70"
              >
                {abriendoWallet ? <Loader2 size={22} className="animate-spin" /> : <GoogleWalletIcon />}
                Agregar a Google Wallet
              </button>
            )}

            <section className="card rounded-3xl p-5">
              <h2 className="mb-5 font-bold text-stone-900">Avance de su pedido</h2>
              <ol>
                {STATUS_ORDER.map((estado, i) => {
                  const hecho = i < actual || (listo && i === actual)
                  const enCurso = i === actual && !listo
                  const Icono = PASOS[estado].icono
                  return (
                    <li key={estado} className="relative flex gap-4 pb-6 last:pb-0">
                      {i < STATUS_ORDER.length - 1 && (
                        <span className={`absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 rounded-full ${i < actual ? 'bg-emerald-400' : 'bg-stone-200'}`} aria-hidden="true" />
                      )}
                      <span className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        hecho ? 'bg-emerald-500 text-white' : enCurso ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white ring-4 ring-amber-100' : 'bg-stone-100 text-stone-400'
                      }`}>
                        {hecho ? <Check size={18} strokeWidth={3} /> : <Icono size={18} />}
                      </span>
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-2 pt-1">
                        <div>
                          <p className={`text-sm font-semibold ${hecho || enCurso ? 'text-stone-900' : 'text-stone-400'}`}>{PASOS[estado].titulo}</p>
                          <p className={`text-xs ${hecho || enCurso ? 'text-stone-500' : 'text-stone-400'}`}>{PASOS[estado].detalle}</p>
                        </div>
                        {enCurso && <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">Ahora</span>}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>

            <section className="card grid grid-cols-3 divide-x divide-stone-100 rounded-3xl p-1 text-center">
              {[
                { icono: Coffee, etiqueta: 'Café', valor: COFFEE_TYPE_LABELS[datos.coffeeType] },
                { icono: Scale, etiqueta: 'Peso', valor: `${Number(datos.initialWeight).toFixed(0)} lb` },
                { icono: CalendarDays, etiqueta: 'Recibido', valor: formatISODate(datos.receivedDate) },
              ].map(({ icono: I, etiqueta, valor }) => (
                <div key={etiqueta} className="px-2 py-3">
                  <I size={16} className="mx-auto text-amber-700" />
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{etiqueta}</p>
                  <p className="mt-0.5 text-sm font-bold leading-tight text-stone-900">{valor}</p>
                </div>
              ))}
            </section>

            <div className="flex flex-col items-center gap-2 pt-1 text-center">
              <button
                type="button"
                onClick={cargar}
                disabled={cargando}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm ring-1 ring-stone-200 transition hover:bg-stone-50 disabled:opacity-60"
              >
                <RefreshCw size={14} className={cargando ? 'animate-spin' : ''} /> Actualizar
              </button>
              <p className="text-xs text-stone-500">
                {error || <>Se actualiza sola{consultadoAt ? ` · última consulta ${HORA.format(consultadoAt)}` : ''}</>}
              </p>
              <p className="mt-2 text-xs font-medium text-stone-400">Go Café · Gracias por su confianza ☕</p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
