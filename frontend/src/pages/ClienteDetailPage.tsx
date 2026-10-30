import { ArrowLeft, ChevronRight, MapPin, Pencil, Phone, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useClient, useClientsLoaded } from '../store/clientsStore'
import { useClientOrders } from '../store/ordersStore'
import StatusProgressBar from '../components/StatusProgressBar'
import PageLoader from '../components/ui/PageLoader'
import { formatQ } from '../utils/money'
import { formatISODate, isOverdue } from '../utils/dates'

export default function ClienteDetailPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const loaded = useClientsLoaded()
  const client = useClient(clientId)
  const orders = useClientOrders(clientId)

  if (!loaded) return <PageLoader />

  if (!client) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Link to="/clientes" className="rounded-xl border border-stone-200 bg-white p-2.5 inline-flex" aria-label="Volver a clientes"><ArrowLeft size={18} /></Link>
        <div className="card p-6 text-center text-stone-600">Cliente no encontrado.</div>
      </div>
    )
  }

  const enProceso = orders.filter(o => o.status !== 'Finalizado').length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Link to="/clientes" className="rounded-xl border border-stone-200 bg-white p-2.5" aria-label="Volver a clientes" title="Volver a clientes"><ArrowLeft size={18} /></Link>
          <div>
            <h2 className="page-title">{client.name || 'Sin nombre'}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-500">
              <span className="inline-flex items-center gap-1"><Phone size={14} /> {client.phone || '—'}</span>
              <span className="inline-flex items-center gap-1"><MapPin size={14} /> {client.city || '—'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/clientes/${client.id}/editar`} className="btn-secondary"><Pencil size={16} /> Editar datos</Link>
          <Link to={`/clientes/${client.id}/ordenes/nueva`} className="btn-primary"><Plus size={18} /> Nueva orden</Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-stone-200 p-4">
          <h3 className="font-bold">Órdenes</h3>
          <p className="text-sm text-stone-500">
            {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}{enProceso > 0 && ` · ${enProceso} en proceso`}
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-stone-500">Este cliente todavía no tiene órdenes.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {orders.map(order => {
              const isFinalized = order.status === 'Finalizado'
              const atrasada = !isFinalized && isOverdue(order.estimatedDate)
              const href = isFinalized ? `/clientes/ordenes/${order.id}` : `/clientes/ordenes/${order.id}/editar`
              return (
                <Link key={order.id} to={href} className="flex flex-wrap items-center gap-4 p-4 transition hover:bg-stone-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{order.orderNo}</p>
                    <p className="text-xs text-stone-500">
                      Recibida {formatISODate(order.receivedDate)}
                      {!isFinalized && order.estimatedDate && (
                        <> · <span className={atrasada ? 'font-semibold text-red-600' : ''}>{atrasada ? 'Atrasada, era para el' : 'Entrega'} {formatISODate(order.estimatedDate)}</span></>
                      )}
                    </p>
                  </div>
                  {isFinalized ? (
                    <div className="text-right text-sm">
                      <p className="font-semibold text-stone-900">{formatQ(order.totalPrice)}</p>
                      <p className={`text-xs font-semibold ${order.pagado ? 'text-emerald-600' : 'text-red-600'}`}>{order.pagado ? 'Pagada' : 'Pendiente de cobro'}</p>
                    </div>
                  ) : (
                    <div className="w-44 shrink-0"><StatusProgressBar status={order.status} compact /></div>
                  )}
                  <span className={`shrink-0 text-sm font-semibold ${isFinalized ? 'text-stone-500' : 'text-amber-700'}`}>
                    <span className="inline-flex items-center gap-0.5">{isFinalized ? 'Ver' : 'Continuar'} <ChevronRight size={16} /></span>
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
