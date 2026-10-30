import { useMemo, useState } from 'react'
import { CheckCircle2, FileDown, Loader2, ReceiptText, Search, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { setOrderPagado, useOrders } from '../store/ordersStore'
import { generateInvoicePdf } from '../utils/invoicePdf'
import { inPeriod, periodPhrase, todayISODate } from '../utils/dates'
import { formatQ } from '../utils/money'
import { confirmDialog, errorMessage, toast } from '../components/ui/feedback'
import PeriodPicker from '../components/PeriodPicker'
import type { Order } from '../types/order'

const DATE_FORMAT = new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

type Vista = 'periodo' | 'pendientes'

interface ClientGroup {
  clientId: string
  clientName: string
  orders: Order[]
}

export default function FacturacionPage() {
  const allOrders = useOrders()
  const [periodo, setPeriodo] = useState(() => todayISODate().slice(0, 7))
  const [vista, setVista] = useState<Vista>('periodo')
  const [search, setSearch] = useState('')
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [pagandoId, setPagandoId] = useState<string | null>(null)

  const finalizadas = useMemo(
    () => allOrders
      .filter(o => o.status === 'Finalizado')
      .sort((a, b) => (b.finalizedAt ?? b.updatedAt).localeCompare(a.finalizedAt ?? a.updatedAt)),
    [allOrders]
  )

  const enPeriodo = periodPhrase(periodo)
  const cobradoPeriodo = finalizadas.filter(o => o.pagado && inPeriod(o.pagadoAt, periodo)).reduce((s, o) => s + o.totalPrice, 0)
  const finalizadoPeriodo = finalizadas.filter(o => inPeriod(o.finalizedAt, periodo)).reduce((s, o) => s + o.totalPrice, 0)
  const pendientes = finalizadas.filter(o => !o.pagado)
  const totalPendiente = pendientes.reduce((s, o) => s + o.totalPrice, 0)

  const filtered = useMemo(() => {
    let rows = vista === 'pendientes' ? finalizadas.filter(o => !o.pagado) : finalizadas.filter(o => inPeriod(o.finalizedAt, periodo))
    const term = search.trim().toLowerCase()
    if (term) rows = rows.filter(o => o.clientName.toLowerCase().includes(term) || o.orderNo.toLowerCase().includes(term))
    return rows
  }, [finalizadas, vista, periodo, search])

  const groups = useMemo(() => {
    const map = new Map<string, ClientGroup>()
    for (const o of filtered) {
      if (!map.has(o.clientId)) map.set(o.clientId, { clientId: o.clientId, clientName: o.clientName || 'Cliente sin nombre', orders: [] })
      map.get(o.clientId)!.orders.push(o)
    }
    return Array.from(map.values())
  }, [filtered])

  const handleGenerate = async (order: Order) => {
    setGeneratingId(order.id)
    try {
      await generateInvoicePdf(order)
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo generar el comprobante.'))
    } finally {
      setGeneratingId(null)
    }
  }

  const handlePago = async (order: Order) => {
    const marcarPagada = !order.pagado
    const ok = await confirmDialog(marcarPagada
      ? { title: `¿Registrar el pago de ${order.orderNo}?`, message: `${order.clientName} · ${formatQ(order.totalPrice)}. Contará como cobrado hoy.`, confirmLabel: 'Sí, está pagada' }
      : { title: `¿Deshacer el pago de ${order.orderNo}?`, message: 'La orden volverá a quedar pendiente de cobro.', confirmLabel: 'Deshacer pago', danger: true })
    if (!ok) return
    setPagandoId(order.id)
    try {
      await setOrderPagado(order.id, marcarPagada)
      toast.success(marcarPagada ? `${order.orderNo} registrada como pagada.` : `${order.orderNo} volvió a pendiente.`)
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo actualizar el pago.'))
    } finally {
      setPagandoId(null)
    }
  }

  const renderPago = (order: Order) => order.pagado ? (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={13} /> Pagada{order.pagadoAt ? ` · ${DATE_FORMAT.format(new Date(order.pagadoAt))}` : ''}
      </span>
      <button type="button" className="rounded-md p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700 disabled:opacity-40" title="Deshacer pago" aria-label="Deshacer pago" disabled={pagandoId === order.id} onClick={() => handlePago(order)}>
        <Undo2 size={14} />
      </button>
    </span>
  ) : (
    <button type="button" className="btn-secondary !min-h-0 !px-3 !py-1.5 text-xs" disabled={pagandoId === order.id} onClick={() => handlePago(order)}>
      {pagandoId === order.id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Registrar pago
    </button>
  )

  const renderComprobante = (order: Order) => (
    <button
      type="button"
      className="btn-secondary !min-h-0 !px-3 !py-1.5 text-xs"
      disabled={generatingId === order.id}
      onClick={() => handleGenerate(order)}
      title="Descargar comprobante en PDF"
    >
      {generatingId === order.id ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />} Comprobante
    </button>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="page-title">Cobros</h2>
          <p className="mt-1 text-sm text-stone-500">Órdenes finalizadas de clientes y su pago.</p>
        </div>
        <PeriodPicker value={periodo} onChange={p => { setPeriodo(p); setVista('periodo') }} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="card p-4 sm:p-5">
          <p className="text-xs text-stone-500 sm:text-sm">Cobrado {enPeriodo}</p>
          <p className="stat-value mt-1 truncate max-sm:text-lg sm:mt-2 sm:max-xl:text-2xl text-emerald-600">{formatQ(cobradoPeriodo)}</p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="text-xs text-stone-500 sm:text-sm">Órdenes finalizadas {enPeriodo}</p>
          <p className="stat-value mt-1 truncate max-sm:text-lg sm:mt-2 sm:max-xl:text-2xl">{formatQ(finalizadoPeriodo)}</p>
        </div>
        <button type="button" className={`card col-span-2 p-4 text-left transition sm:col-span-1 sm:p-5 hover:border-red-300 ${vista === 'pendientes' ? 'ring-2 ring-red-200' : ''}`} onClick={() => setVista('pendientes')}>
          <p className="text-xs text-stone-500 sm:text-sm">Pendiente de cobro</p>
          <p className="stat-value mt-1 truncate max-sm:text-lg sm:mt-2 sm:max-xl:text-2xl text-red-600">{formatQ(totalPendiente)}</p>
          {pendientes.length > 0 && <p className="mt-1 text-xs text-stone-500">{pendientes.length} {pendientes.length === 1 ? 'orden' : 'órdenes'} sin cobrar (de cualquier fecha) · ver</p>}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-3">
          <div className="scrollbar-none flex w-full overflow-x-auto sm:w-auto">
            <SegmentButton active={vista === 'periodo'} onClick={() => setVista('periodo')} label={`Finalizadas ${enPeriodo}`} />
            <SegmentButton active={vista === 'pendientes'} onClick={() => setVista('pendientes')} label={`Pendientes de cobro${pendientes.length ? ` (${pendientes.length})` : ''}`} />
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 sm:w-auto">
            <Search size={15} className="text-stone-400" />
            <input className="w-full bg-transparent sm:w-44 text-sm outline-none" placeholder="Buscar cliente o folio..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {groups.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
            <ReceiptText size={22} className="mb-2 text-stone-300" />
            <p className="text-sm text-stone-500">
              {search
                ? `Sin resultados para "${search}".`
                : vista === 'pendientes' ? 'No hay órdenes pendientes de cobro.' : `No se finalizaron órdenes ${enPeriodo}.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {groups.map(group => {
              const subtotal = group.orders.reduce((sum, o) => sum + o.totalPrice, 0)
              const subtotalPendiente = group.orders.filter(o => !o.pagado).reduce((sum, o) => sum + o.totalPrice, 0)
              return (
                <div key={group.clientId} className="p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Link to={`/clientes/${group.clientId}`} className="font-semibold text-stone-900 hover:underline">{group.clientName}</Link>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-stone-500">{group.orders.length} {group.orders.length === 1 ? 'orden' : 'órdenes'}</span>
                      <span className="font-semibold text-stone-900">{formatQ(subtotal)}</span>
                      {subtotalPendiente > 0 && <span className="font-semibold text-red-600">{formatQ(subtotalPendiente)} pendiente</span>}
                    </div>
                  </div>
                  <ul className="space-y-2 md:hidden">
                    {group.orders.map(order => (
                      <li key={order.id} className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link to={`/clientes/ordenes/${order.id}`} className="font-semibold text-stone-900 hover:underline">{order.orderNo}</Link>
                            <p className="text-xs text-stone-500">Finalizada {order.finalizedAt ? DATE_FORMAT.format(new Date(order.finalizedAt)) : '—'}</p>
                          </div>
                          <p className="shrink-0 text-lg font-bold text-stone-900">{formatQ(order.totalPrice)}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          {renderPago(order)}
                          {renderComprobante(order)}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto rounded-xl bg-stone-50 md:block">
                    <table className="w-full min-w-[600px] text-left text-sm">
                      <thead>
                        <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                          <th className="px-3 pb-2 pt-3">Folio</th>
                          <th className="px-3 pb-2 pt-3">Finalizada</th>
                          <th className="px-3 pb-2 pt-3">Total</th>
                          <th className="px-3 pb-2 pt-3">Pago</th>
                          <th className="px-3 pb-2 pt-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-200">
                        {group.orders.map(order => (
                          <tr key={order.id}>
                            <td className="px-3 py-2.5 font-semibold text-stone-900">
                              <Link to={`/clientes/ordenes/${order.id}`} className="hover:underline">{order.orderNo}</Link>
                            </td>
                            <td className="px-3 py-2.5 text-stone-500">{order.finalizedAt ? DATE_FORMAT.format(new Date(order.finalizedAt)) : '—'}</td>
                            <td className="px-3 py-2.5 font-semibold text-stone-900">{formatQ(order.totalPrice)}</td>
                            <td className="px-3 py-2.5">{renderPago(order)}</td>
                            <td className="px-3 py-2.5 text-right">{renderComprobante(order)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SegmentButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button type="button" onClick={e => { onClick(); e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }) }} className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}>
      {label}
    </button>
  )
}
