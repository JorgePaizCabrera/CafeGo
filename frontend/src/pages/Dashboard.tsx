import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardList, ReceiptText, Wallet, Warehouse } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useOrders } from '../store/ordersStore'
import { useAllProductions } from '../store/productionStore'
import { fetchGastos, getEmpaqueAlerts, getInventoryAlerts, useEmpaqueStock, useProductoEmpacado, useInventory } from '../store/inventoryStore'
import { formatQ } from '../utils/money'
import { formatISODate, isOverdue, todayISODate } from '../utils/dates'

const MONTH_FORMAT = new Intl.DateTimeFormat('es-GT', { month: 'long' })

export default function Dashboard() {
  const orders = useOrders()
  const productions = useAllProductions()
  const { stock, thresholds } = useInventory()
  const empaqueStock = useEmpaqueStock()
  const empacado = useProductoEmpacado()
  const alerts = useMemo(() => [...getInventoryAlerts(), ...getEmpaqueAlerts()], [stock, thresholds, empaqueStock])
  const gastoMes = useGastoDelMes()

  const porEntregar = useMemo(
    () => orders
      .filter(o => o.status !== 'Finalizado')
      .sort((a, b) => (a.estimatedDate || '9999').localeCompare(b.estimatedDate || '9999')),
    [orders]
  )
  const atrasadas = porEntregar.filter(o => isOverdue(o.estimatedDate)).length
  const pendientesCobro = orders.filter(o => o.status === 'Finalizado' && !o.pagado)
  const totalPorCobrar = pendientesCobro.reduce((s, o) => s + o.totalPrice, 0)
  const rawMaterialLb = stock.pergamino + stock.oro + stock.natural
  const lotesEnProceso = productions.filter(p => p.status === 'en_proceso').length
  const mesLabel = MONTH_FORMAT.format(new Date())
  const hoy = todayISODate()

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2b1a10] via-[#1c120c] to-stone-950 p-5 text-white shadow-lg shadow-stone-900/20 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-amber-500/25 blur-3xl" />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-amber-200/70">{saludo()}</p>
        <h2 className="relative mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Resumen general</h2>
        <p className="relative mt-1 text-sm text-stone-300">{fechaDeHoy()}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <SummaryCard to="/clientes" label="Órdenes en proceso" value={String(porEntregar.length)} icon={ClipboardList}
          note={atrasadas > 0 ? <span className="font-semibold text-red-600">{atrasadas} {atrasadas === 1 ? 'atrasada' : 'atrasadas'}</span> : 'Ninguna atrasada'} />
        <SummaryCard to="/facturacion" label="Por cobrar" value={formatQ(totalPorCobrar)} icon={ReceiptText} valueClass={totalPorCobrar > 0 ? 'text-red-600' : ''}
          note={`${pendientesCobro.length} ${pendientesCobro.length === 1 ? 'orden' : 'órdenes'}`} />
        <SummaryCard to="/gastos" label={`Gastos de ${mesLabel}`} value={gastoMes === null ? '—' : formatQ(gastoMes)} icon={Wallet} note="Compras de café y bolsas" />
        <SummaryCard to="/inventario" label="Materia prima" value={`${rawMaterialLb.toFixed(0)} lb`} icon={Warehouse}
          note={`Pergamino ${stock.pergamino.toFixed(0)} · Oro ${stock.oro.toFixed(0)} · Natural ${stock.natural.toFixed(0)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-stone-200 p-4">
            <h3 className="font-bold">Órdenes por entregar</h3>
            <Link to="/clientes" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline">Clientes <ArrowRight size={14} /></Link>
          </div>
          {porEntregar.length === 0 ? (
            <p className="p-6 text-center text-sm text-stone-500">No hay órdenes en proceso.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {porEntregar.slice(0, 6).map(o => {
                const late = isOverdue(o.estimatedDate)
                const esHoy = o.estimatedDate?.slice(0, 10) === hoy
                return (
                  <Link key={o.id} to={`/clientes/ordenes/${o.id}/editar`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-stone-900">{o.clientName || 'Sin nombre'}</p>
                      <p className="text-xs text-stone-500">{o.orderNo} · {o.status}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold ${late ? 'bg-red-100 text-red-700' : esHoy ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
                      {!o.estimatedDate ? 'Sin fecha' : late ? `Atrasada · ${formatISODate(o.estimatedDate)}` : esHoy ? 'Entrega hoy' : formatISODate(o.estimatedDate)}
                    </span>
                  </Link>
                )
              })}
              {porEntregar.length > 6 && <p className="px-4 py-2.5 text-xs text-stone-500">y {porEntregar.length - 6} más.</p>}
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Alertas de inventario</h3>
              <Link to="/inventario" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline">Inventario <ArrowRight size={14} /></Link>
            </div>
            {alerts.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> Todo por encima del mínimo.</p>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 4).map((a, i) => (
                  <div key={i} className="flex gap-2 rounded-xl bg-red-50 p-2.5 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 shrink-0" size={15} />
                    <span>{a.message}</span>
                  </div>
                ))}
                {alerts.length > 4 && <p className="text-xs text-stone-500">y {alerts.length - 4} más.</p>}
              </div>
            )}
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">Producción propia</h3>
              <Link to="/produccion" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline">Producción <ArrowRight size={14} /></Link>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Lotes en proceso" value={lotesEnProceso} />
              <MiniStat label="Bolsas Gourmet" value={empacado.comercial + empacado.especial} />
              <MiniStat label="Bolsas Blend" value={empacado.blend} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const FECHA_LARGA = new Intl.DateTimeFormat('es-GT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function fechaDeHoy(): string {
  const texto = FECHA_LARGA.format(new Date())
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function saludo(): string {
  const hora = new Date().getHours()
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'
}

function useGastoDelMes(): number | null {
  const [total, setTotal] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    const now = new Date()
    fetchGastos(new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1))
      .then(r => { if (!cancelled) setTotal(r.total) })
      .catch(() => { /* la tarjeta muestra "—" */ })
    return () => { cancelled = true }
  }, [])
  return total
}

function SummaryCard({ to, label, value, icon: Icon, note, valueClass = '' }: { to: string, label: string, value: string, icon: typeof Wallet, note?: React.ReactNode, valueClass?: string }) {
  return (
    <Link to={to} className="card block p-4 transition hover:border-amber-300 hover:shadow-md active:scale-[0.98] sm:p-5">
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-stone-500 sm:text-sm">{label}</p>
          <p className={`mt-1 truncate text-xl font-bold tracking-tight text-stone-900 sm:mt-2 sm:text-3xl ${valueClass}`}>{value}</p>
        </div>
        <div className="w-fit shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700 sm:p-3"><Icon size={20} /></div>
      </div>
      {note && <p className="mt-2 truncate text-xs text-stone-500">{note}</p>}
    </Link>
  )
}

function MiniStat({ label, value }: { label: string, value: number }) {
  return (
    <div className="rounded-xl bg-stone-100 p-3">
      <p className="text-xl font-bold text-stone-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium leading-tight text-stone-500">{label}</p>
    </div>
  )
}
