import { useState } from 'react'
import { AlertTriangle, ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageLoader from '../components/ui/PageLoader'
import { confirmDialog, errorMessage, toast } from '../components/ui/feedback'
import { createClient, deleteClient, updateClient, useClient, useClientsLoaded } from '../store/clientsStore'
import { useClientOrders } from '../store/ordersStore'
import { formatGuatemalaPhone, phoneDigits } from '../utils/phone'

export default function ClienteFormPage() {
  const { clientId } = useParams<{ clientId?: string }>()
  const loaded = useClientsLoaded()
  if (!loaded) return <PageLoader />
  return <ClienteForm clientId={clientId} />
}

function ClienteForm({ clientId }: { clientId?: string }) {
  const navigate = useNavigate()
  const existingClient = useClient(clientId)
  const clientOrders = useClientOrders(clientId)
  const finalizadas = clientOrders.filter(o => o.status === 'Finalizado').length
  const isEditing = Boolean(clientId)

  const [name, setName] = useState(existingClient?.name ?? '')
  const [city, setCity] = useState(existingClient?.city ?? '')
  const [phone, setPhone] = useState(existingClient?.phone ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isEditing && !existingClient) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/clientes" className="rounded-xl border border-stone-200 bg-white p-2.5 inline-flex"><ArrowLeft size={18} /></Link>
        <div className="card p-6 text-center text-stone-600">Cliente no encontrado.</div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!name.trim()) return setError('Ingresa el nombre del cliente.')
    if (!city.trim()) return setError('Ingresa la ciudad del cliente.')
    if (phoneDigits(phone).length !== 8) return setError('El teléfono debe contener exactamente 8 dígitos.')

    setSubmitting(true)
    try {
      if (isEditing && existingClient) {
        await updateClient(existingClient.id, { name: name.trim(), city: city.trim(), phone })
        toast.success('Cliente actualizado.')
        navigate(`/clientes/${existingClient.id}`)
      } else {
        const created = await createClient({ name: name.trim(), city: city.trim(), phone })
        toast.success(`Cliente ${created.name} registrado.`)
        navigate(`/clientes/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.')
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!existingClient) return
    const ok = await confirmDialog({
      title: `¿Eliminar a ${existingClient.name || 'este cliente'}?`,
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar cliente',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteClient(existingClient.id)
      toast.success(`${existingClient.name || 'Cliente'} eliminado.`)
      navigate('/clientes', { replace: true })
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo eliminar el cliente.'))
    }
  }

  const backTo = isEditing && existingClient ? `/clientes/${existingClient.id}` : '/clientes'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to={backTo} className="rounded-xl border border-stone-200 bg-white p-2.5"><ArrowLeft size={18} /></Link>
        <div>
          <h2 className="page-title">{isEditing ? 'Editar cliente' : 'Agregar nuevo cliente'}</h2>

        </div>
      </div>

      {error && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={19} />
          <span>{error}</span>
        </div>
      )}

      <form className="card space-y-4 p-6" onSubmit={handleSubmit}>
        <label className="block">
          <span className="label">Nombre</span>
          <input className="input" value={name} onChange={e => { setError(''); setName(e.target.value) }} placeholder="Ej. Juan Pérez" />
        </label>
        <label className="block">
          <span className="label">Ciudad</span>
          <input className="input" value={city} onChange={e => { setError(''); setCity(e.target.value) }} placeholder="Ej. Zacapa" />
        </label>
        <label className="block">
          <span className="label">Teléfono</span>
          <input
            inputMode="numeric"
            className="input"
            value={phone}
            onChange={e => { setError(''); setPhone(formatGuatemalaPhone(e.target.value)) }}
            placeholder="Ej. 5555-1234"
          />
        </label>
        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} {isEditing ? 'Guardar cambios' : 'Guardar cliente'}
        </button>
      </form>

      {isEditing && existingClient && (
        <div className="card border-red-200 p-6">
          <h3 className="font-bold text-red-700">Eliminar cliente</h3>
          {finalizadas > 0 ? (
            <p className="mt-1 text-sm text-stone-500">
              No se puede eliminar: tiene {finalizadas} {finalizadas === 1 ? 'orden finalizada' : 'órdenes finalizadas'} con comprobante, y se perdería ese historial de cobros.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-stone-500">
                {clientOrders.length > 0
                  ? `También se eliminarán sus ${clientOrders.length} ${clientOrders.length === 1 ? 'orden en proceso' : 'órdenes en proceso'}. `
                  : ''}
                Esta acción no se puede deshacer.
              </p>
              <button type="button" className="btn-danger mt-4" onClick={handleDelete}><Trash2 size={16} /> Eliminar cliente</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
