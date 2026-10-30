import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Coffee, Loader2, Package, Wallet } from 'lucide-react'
import { fetchGastos, type GastoItem, type GastosResumen } from '../store/inventoryStore'
import { errorMessage } from '../components/ui/feedback'
import { formatPeriod, periodPhrase, periodRange, todayISODate } from '../utils/dates'
import PeriodPicker from '../components/PeriodPicker'
import { formatQ } from '../utils/money'

export default function GastosPage() {
  const [periodo, setPeriodo] = useState(() => todayISODate().slice(0, 7))
  const [data, setData] = useState<GastosResumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const [desde, hasta] = periodRange(periodo)
    fetchGastos(desde, hasta)
      .then(r => { if (!cancelled) setData(r) })
      .catch(err => { if (!cancelled) setError(errorMessage(err, 'No se pudieron cargar los gastos.')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [periodo])

  const materia = data?.items.filter(i => i.categoria === 'materia_prima') ?? []
  const empaque = data?.items.filter(i => i.categoria === 'empaque') ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="page-title">Control de gastos</h2>
          <p className="mt-1 text-sm text-stone-500">Lo que se pagó en compras de café y bolsas</p>
        </div>
        <PeriodPicker value={periodo} onChange={setPeriodo} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <SummaryCard label={`Total gastado (${formatPeriod(periodo)})`} value={data?.total} icon={Wallet} highlight className="col-span-2 sm:col-span-1" />
        <SummaryCard label="Materia prima" value={data?.totalMateriaPrima} icon={Coffee} />
        <SummaryCard label="Bolsas" value={data?.totalEmpaque} icon={Package} />
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}

      {!!data?.entradasSinCosto && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            {data.entradasSinCosto === 1 ? 'Hay 1 entrada' : `Hay ${data.entradasSinCosto} entradas`} {periodPhrase(periodo)} sin costo registrado, así que el total puede ser mayor.
            El costo se captura al registrar la entrada en <Link to="/inventario" className="font-semibold underline">Inventario</Link>.
          </p>
        </div>
      )}

      {loading && !data ? (
        <div className="flex min-h-40 items-center justify-center"><Loader2 size={24} className="animate-spin text-stone-400" /></div>
      ) : (
        <div className={`grid gap-6 xl:grid-cols-2 ${loading ? 'opacity-60' : ''}`}>
          <GastosTable title="Materia prima" items={materia} total={data?.totalMateriaPrima ?? 0} unidad="lb" periodo={periodo} />
          <GastosTable title="Bolsas" items={empaque} total={data?.totalEmpaque ?? 0} unidad="bolsa" periodo={periodo} />
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon: Icon, highlight = false, className = '' }: { label: string, value: number | undefined, icon: typeof Wallet, highlight?: boolean, className?: string }) {
  return (
    <div className={`card p-4 sm:p-5 ${highlight ? 'ring-2 ring-amber-300' : ''} ${className}`}>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-stone-500 sm:text-sm">{label}</p>
          <p className="mt-1 truncate text-xl font-bold text-stone-900 sm:mt-2 sm:text-2xl xl:text-3xl">{value === undefined ? '—' : formatQ(value)}</p>
        </div>
        <div className="w-fit shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700 sm:p-3"><Icon size={20} /></div>
      </div>
    </div>
  )
}

function GastosTable({ title, items, total, unidad, periodo }: { title: string, items: GastoItem[], total: number, unidad: 'lb' | 'bolsa', periodo: string }) {
  const formatCantidad = (i: GastoItem) => unidad === 'lb' ? `${i.cantidad.toFixed(2)} lb` : `${i.cantidad} bolsas`
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-stone-200 p-4"><h4 className="font-bold">{title}</h4></div>
      {items.length === 0 ? (
        <p className="p-6 text-center text-sm text-stone-500">Sin compras de {title.toLowerCase()} {periodPhrase(periodo)}.</p>
      ) : (
        <>
        <ul className="divide-y divide-stone-100 md:hidden">
          {items.map(i => (
            <li key={i.clave} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-medium text-stone-900">{i.label}</p>
                <p className="text-xs text-stone-500">
                  {formatCantidad(i)} · {i.entradas === 1 ? '1 compra' : `${i.entradas} compras`}{i.entradasSinCosto > 0 && ` · ${i.entradasSinCosto} sin costo`}
                </p>
                {i.precioPromedio !== null && <p className="text-xs text-stone-500">Promedio {formatQ(i.precioPromedio)} / {unidad}</p>}
              </div>
              <p className="shrink-0 font-semibold text-stone-900">{formatQ(i.costoTotal)}</p>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 bg-stone-50 p-4 font-bold">
            <span>Total {title.toLowerCase()}</span>
            <span className="text-stone-900">{formatQ(total)}</span>
          </li>
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 pb-2 pt-4">{unidad === 'lb' ? 'Material' : 'Tipo de bolsa'}</th>
                <th className="px-4 pb-2 pt-4">Entró</th>
                <th className="px-4 pb-2 pt-4">Precio promedio</th>
                <th className="px-4 pb-2 pt-4 text-right">Gasto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {items.map(i => (
                <tr key={i.clave}>
                  <td className="px-4 py-2.5 font-medium text-stone-900">
                    {i.label}
                    <span className="block text-xs font-normal text-stone-500">
                      {i.entradas === 1 ? '1 compra' : `${i.entradas} compras`}{i.entradasSinCosto > 0 && ` · ${i.entradasSinCosto} sin costo`}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">{formatCantidad(i)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">{i.precioPromedio === null ? <span className="text-stone-400">—</span> : `${formatQ(i.precioPromedio)} / ${unidad}`}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-stone-900">{formatQ(i.costoTotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200 bg-stone-50">
                <td className="px-4 py-3 font-bold" colSpan={3}>Total {title.toLowerCase()}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-stone-900">{formatQ(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
