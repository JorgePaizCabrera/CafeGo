import { useMemo, useState } from 'react'
import { ChevronRight, Plus, Search, UserRound, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useClientsWithOrders } from '../store/clientsStore'
import { capitalize } from '../utils/text'

export default function ClientesPage() {
  const clients = useClientsWithOrders()
  const [search, setSearch] = useState('')

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clients
    const digits = term.replace(/\D/g, '')
    return clients.filter(c =>
      c.name.toLowerCase().includes(term) || (digits && c.phone.replace(/\D/g, '').includes(digits))
    )
  }, [clients, search])

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><h2 className="page-title">Clientes</h2><p className="mt-1 text-sm text-stone-500">{clients.length} {clients.length === 1 ? 'cliente registrado' : 'clientes registrados'}</p></div>
        <Link className="btn-primary" to="/clientes/nuevo"><Plus size={18} /> Nuevo cliente</Link>
      </div>
      <div className="card overflow-hidden">
        <div className="border-b border-stone-200 p-4">
          <div className="flex max-w-sm items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
            <Search size={17} className="text-stone-400" />
            <input
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {clients.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="mb-3 rounded-2xl bg-stone-100 p-4 text-stone-500"><Users size={28} /></div>
            <h3 className="font-bold">Aún no hay clientes registrados</h3>
            <p className="mt-1 max-w-md text-sm text-stone-500">Agrega tu primer cliente para empezar.</p>
          </div>
        )}

        {clients.length > 0 && filteredClients.length === 0 && (
          <div className="flex min-h-40 flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-stone-500">Sin resultados para "{search}".</p>
          </div>
        )}

        {filteredClients.length > 0 && (
          <div className="divide-y divide-stone-100">
            {filteredClients.map(client => {
              const enProceso = client.orders.filter(o => o.status !== 'Finalizado').length
              const porCobrar = client.orders.filter(o => o.status === 'Finalizado' && !o.pagado).length
              return (
                <Link key={client.id} to={`/clientes/${client.id}`} className="flex w-full items-center gap-3 p-4 transition hover:bg-stone-50 active:bg-stone-100 sm:gap-4">
                  <div className="rounded-xl bg-stone-100 p-2.5 text-stone-500"><UserRound size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-900">{client.name || 'Sin nombre'}</p>
                    <p className="text-sm text-stone-500">{client.phone || '—'}{client.city && ` · ${capitalize(client.city)}`}</p>
                    {(enProceso > 0 || porCobrar > 0) && (
                      <div className="mt-1 flex flex-wrap gap-1.5 sm:hidden">
                        {enProceso > 0 && <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{enProceso} en proceso</span>}
                        {porCobrar > 0 && <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">{porCobrar} por cobrar</span>}
                      </div>
                    )}
                  </div>
                  <div className="hidden shrink-0 flex-wrap justify-end gap-1.5 sm:flex">
                    {enProceso > 0 && <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{enProceso} en proceso</span>}
                    {porCobrar > 0 && <span className="rounded-lg bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{porCobrar} por cobrar</span>}
                    {enProceso === 0 && porCobrar === 0 && <span className="text-xs text-stone-400">{client.orders.length} {client.orders.length === 1 ? 'orden' : 'órdenes'}</span>}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-stone-300" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
