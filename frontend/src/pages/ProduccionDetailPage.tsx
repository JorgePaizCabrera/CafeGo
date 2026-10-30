import { useEffect } from 'react'
import { ArrowLeft, Blend, Coffee } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PageLoader from '../components/ui/PageLoader'
import { useProduction, useProductionsLoaded } from '../store/productionStore'
import { ROAST_TYPE_LABELS, blendMermaLb, gourmetMermaLb } from '../types/production'
import { Stat } from '../components/FormParts'
import { formatISODate } from '../utils/dates'

const DATE_FORMAT = new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })

export default function ProduccionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const loaded = useProductionsLoaded()
  const production = useProduction(id)

  useEffect(() => {
    if (production && production.status === 'en_proceso') {
      navigate(`/produccion/${production.type}/${production.id}/editar`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [production?.id, production?.status])

  if (!loaded) return <PageLoader />

  if (!production) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to="/produccion" className="inline-flex rounded-xl border border-stone-200 bg-white p-2.5"><ArrowLeft size={18} /></Link>
        <div className="card p-6 text-center text-stone-600">Producción no encontrada.</div>
      </div>
    )
  }

  if (production.status === 'en_proceso') return null

  const isGourmet = production.type === 'gourmet'
  const merma = isGourmet ? gourmetMermaLb(production) : blendMermaLb(production)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/produccion" className="rounded-xl border border-stone-200 bg-white p-2.5"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h2 className="page-title flex items-center gap-2">{isGourmet ? <Coffee size={22} className="text-amber-600" /> : <Blend size={22} className="text-amber-600" />} {production.code}</h2>
          <p className="text-sm text-stone-500">{isGourmet ? 'Producción Gourmet' : 'Producción Blend'} · Finalizada el {production.finalizedAt ? DATE_FORMAT.format(new Date(production.finalizedAt)) : '—'}</p>
        </div>
        <span className="rounded-lg bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">Terminada</span>
      </div>

      <div className="card p-4 sm:p-6">
        <h3 className="mb-4 font-bold">Trazabilidad del lote</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Fecha" value={formatISODate(production.fecha)} />
          {isGourmet ? (
            <>
              <Stat label="Pergamino usado" value={`${production.pergaminoUsedLb.toFixed(2)} lb`} />
              <Stat label="Después de trillado" value={`${production.trilladoWeightLb.toFixed(2)} lb`} />
              <Stat label="Tipo de tueste" value={ROAST_TYPE_LABELS[production.roastType]} />
              <Stat label="Peso después del tueste" value={`${production.pesoTuesteResultLb.toFixed(2)} lb`} />
              <Stat label="Reserva para cafetería" value={`${production.reservaCafeteriaLb.toFixed(2)} lb`} />
              <Stat label="Después de molido" value={`${production.molidoWeightLb.toFixed(2)} lb`} />
              <Stat label="Bolsas completas" value={`${production.actualFullBags}`} />
              <Stat label="Sobrante" value={`${production.actualRemainderGrams.toFixed(1)} g`} />
              <Stat label="Comercial" value={`${production.comercialBags} bolsas`} />
              <Stat label="Especial" value={`${production.especialBags} bolsas`} />
            </>
          ) : (
            <>
              <Stat label="Café de segunda usado" value={`${production.segundaType === 'oro' ? 'Oro' : 'Natural'} · ${production.segundaUsedLb.toFixed(2)} lb`} />
              <Stat label="Pergamino usado" value={`${production.pergaminoUsedLb.toFixed(2)} lb`} />
              <Stat label="Planificado" value={`${production.cantidadPlanificadaLb.toFixed(2)} lb`} />
              <Stat label="Después de trillado" value={`${production.trilladoWeightLb.toFixed(2)} lb`} />
              <Stat label="Peso después del tueste" value={`${production.pesoTuesteResultLb.toFixed(2)} lb`} />
              <Stat label="Molido y mezcla (real)" value={`${production.molidoMezclaWeightLb.toFixed(2)} lb`} />
              <Stat label="Bolsas completas" value={`${production.actualFullBags}`} />
              <Stat label="Sobrante" value={`${production.actualRemainderGrams.toFixed(1)} g`} />
            </>
          )}
        </div>
        <h3 className="mb-4 mt-6 font-bold">Merma por paso</h3>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="En trillado" value={`${merma.mermaTrillado.toFixed(2)} lb`} />
          <Stat label="En tueste" value={`${merma.mermaTueste.toFixed(2)} lb`} />
          <Stat label={isGourmet ? 'En molido' : 'En molido y mezcla'} value={`${merma.mermaMolido.toFixed(2)} lb`} />
          <Stat label="Total" value={`${merma.total.toFixed(2)} lb`} />
        </div>
      </div>

      {production.roasts.length > 0 && (
        <div className="card p-4 sm:p-6">
          <h3 className="mb-4 font-bold">Tuestes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  <th className="pb-2">No.</th>
                  <th className="pb-2">Peso</th>
                  <th className="pb-2">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {production.roasts.map(r => (
                  <tr key={r.id}>
                    <td className="py-2 font-semibold">{r.id}</td>
                    <td className="py-2">{r.weightLb.toFixed(2)} lb</td>
                    <td className="py-2 text-stone-500">{r.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {production.notas && (
        <div className="card p-4 sm:p-6">
          <h3 className="mb-2 font-bold">Notas</h3>
          <p className="text-sm text-stone-600">{production.notas}</p>
        </div>
      )}
    </div>
  )
}

