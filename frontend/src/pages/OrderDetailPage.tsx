import { useState } from 'react'
import { ArrowLeft, FileDown, Loader2, Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import PageLoader from '../components/ui/PageLoader'
import { errorMessage, toast } from '../components/ui/feedback'
import { useOrder, useOrdersLoaded } from '../store/ordersStore'
import { generateInvoicePdf } from '../utils/invoicePdf'
import StatusProgressBar from '../components/StatusProgressBar'
import OrderSummary from '../components/OrderSummary'
import SeguimientoWhatsAppModal, { useOfertaSeguimiento } from '../components/SeguimientoWhatsAppModal'

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const loaded = useOrdersLoaded()
  const order = useOrder(id)
  const [generating, setGenerating] = useState(false)
  const seguimiento = useOfertaSeguimiento(order)

  if (!loaded) return <PageLoader />

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/clientes" className="rounded-xl border border-stone-200 bg-white p-2.5 inline-flex"><ArrowLeft size={18} /></Link>
        <div className="card p-6 text-center text-stone-600">Orden no encontrada.</div>
      </div>
    )
  }

  const isFinalized = order.status === 'Finalizado'

  const handleGenerateInvoice = async () => {
    setGenerating(true)
    try {
      await generateInvoicePdf(order)
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo generar el comprobante.'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Link to={`/clientes/${order.clientId}`} className="rounded-xl border border-stone-200 bg-white p-2.5" aria-label="Volver al cliente" title="Volver al cliente"><ArrowLeft size={18} /></Link>
          <div>
            <h2 className="page-title">{order.clientName || 'Cliente sin nombre'}</h2>
            <p className="text-sm text-stone-500">Orden {order.orderNo} · Tel. {order.phone}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isFinalized && <Link to={`/clientes/ordenes/${order.id}/editar`} className="btn-secondary"><Pencil size={16} /> Continuar</Link>}
          {isFinalized && (
            <button className="btn-primary" disabled={generating} title="Descargar comprobante en PDF" onClick={handleGenerateInvoice}>
              {generating ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              Comprobante
            </button>
          )}
        </div>
      </div>

      <div className="card p-5">
        <StatusProgressBar status={order.status} />
      </div>

      <OrderSummary order={order} />

      {seguimiento.abierto && <SeguimientoWhatsAppModal order={order} onClose={seguimiento.cerrar} />}
    </div>
  )
}
