import { useMemo, useState } from 'react'
import { Blend, Boxes, Coffee, PackageCheck, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PRODUCTION_STATUS_LABELS, roastedAllocatedLb, type Production } from '../types/production'
import { deleteBlendProduction, deleteGourmetProduction, useAllProductions } from '../store/productionStore'
import { packagedWeightLb } from '../utils/production'
import { formatISODate, formatPeriod, inPeriod, periodPhrase, todayISODate } from '../utils/dates'
import { confirmDialog, errorMessage, toast } from '../components/ui/feedback'
import PeriodPicker from '../components/PeriodPicker'

type Tab = 'gourmet' | 'blend'

export default function ProduccionPage() {
  const navigate = useNavigate()
  const all = useAllProductions()
  const [tab, setTab] = useState<Tab>('gourmet')
  const [periodoFiltro, setPeriodoFiltro] = useState(() => todayISODate().slice(0, 7))

  const list = useMemo(() => all.filter(p => p.type === tab && inPeriod(p.fecha, periodoFiltro)), [all, tab, periodoFiltro])
  const enProceso = useMemo(() => all.filter(p => p.status === 'en_proceso'), [all])

  const periodo = useMemo(() => {
    const terminadas = all.filter(p => p.status === 'terminada' && inPeriod(p.fecha, periodoFiltro))
    const gourmet = terminadas.filter((p): p is Extract<Production, { type: 'gourmet' }> => p.type === 'gourmet')
    const blend = terminadas.filter((p): p is Extract<Production, { type: 'blend' }> => p.type === 'blend')
    return {
      lb: terminadas.reduce((sum, p) => sum + finishedWeight(p), 0),
      gourmetComercial: gourmet.reduce((sum, p) => sum + p.comercialBags, 0),
      gourmetEspecial: gourmet.reduce((sum, p) => sum + p.especialBags, 0),
      blend: blend.reduce((sum, p) => sum + p.actualFullBags, 0),
    }
  }, [all, periodoFiltro])

  const handleDelete = async (e: React.MouseEvent, p: Production) => {
    e.stopPropagation()
    const ok = await confirmDialog({
      title: `¿Eliminar el lote ${p.code}?`,
      message: 'Todavía no había afectado el inventario, así que no se mueve nada. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar lote',
      danger: true,
    })
    if (!ok) return
    try {
      if (p.type === 'gourmet') await deleteGourmetProduction(p.id)
      else await deleteBlendProduction(p.id)
      toast.success(`Lote ${p.code} eliminado.`)
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo eliminar el lote.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="page-title">Producción propia</h2>
          <p className="mt-1 text-sm text-stone-500">Lotes de Gourmet y Blend · resumen de <b className="font-semibold text-stone-700">{formatPeriod(periodoFiltro)}</b></p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <button className="btn-secondary whitespace-nowrap" onClick={() => navigate('/produccion/gourmet/nueva')}><Coffee size={17} /> Nuevo Gourmet</button>
          <button className="btn-primary whitespace-nowrap" onClick={() => navigate('/produccion/blend/nueva')}><Blend size={17} /> Nuevo Blend</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:gap-4 lg:grid-cols-5">
        <div className="card col-span-2 p-4 sm:col-span-3 sm:p-5 lg:col-span-1">
          <div className="flex items-center justify-between gap-3 sm:items-start">
            <div className="min-w-0"><p className="text-xs text-stone-500 sm:text-sm">Lotes en proceso</p><p className="mt-1 truncate text-xl font-bold text-stone-900 sm:mt-2 sm:text-3xl">{enProceso.length}</p></div>
            <div className="w-fit shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700 sm:p-3"><Boxes size={20} /></div>
          </div>
        </div>
        <div className="card p-4 sm:col-span-3 sm:p-5 lg:col-span-1">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="text-xs text-stone-500 sm:text-sm">Producido</p><p className="mt-1 truncate text-xl font-bold text-stone-900 sm:mt-2 sm:text-3xl">{periodo.lb.toFixed(1)} lb</p></div>
            <div className="w-fit shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700 sm:p-3"><Coffee size={20} /></div>
          </div>
        </div>
        <div className="card p-4 sm:col-span-2 sm:p-5 lg:col-span-1">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="text-xs text-stone-500 sm:text-sm">Bolsas Gourmet Comercial</p><p className="mt-1 truncate text-xl font-bold text-stone-900 sm:mt-2 sm:text-3xl">{periodo.gourmetComercial}</p></div>
            <div className="w-fit shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700 sm:p-3"><PackageCheck size={20} /></div>
          </div>
        </div>
        <div className="card p-4 sm:col-span-2 sm:p-5 lg:col-span-1">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="text-xs text-stone-500 sm:text-sm">Bolsas Gourmet Especial</p><p className="mt-1 truncate text-xl font-bold text-stone-900 sm:mt-2 sm:text-3xl">{periodo.gourmetEspecial}</p></div>
            <div className="w-fit shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700 sm:p-3"><PackageCheck size={20} /></div>
          </div>
        </div>
        <div className="card p-4 sm:col-span-2 sm:p-5 lg:col-span-1">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0"><p className="text-xs text-stone-500 sm:text-sm">Bolsas de Blend</p><p className="mt-1 truncate text-xl font-bold text-stone-900 sm:mt-2 sm:text-3xl">{periodo.blend}</p></div>
            <div className="w-fit shrink-0 rounded-xl bg-amber-100 p-2.5 text-amber-700 sm:p-3"><PackageCheck size={20} /></div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-3">
          <div className="flex">
            <TabButton active={tab === 'gourmet'} onClick={() => setTab('gourmet')} icon={Coffee} label="Gourmet" />
            <TabButton active={tab === 'blend'} onClick={() => setTab('blend')} icon={Blend} label="Blend" />
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <PeriodPicker value={periodoFiltro} onChange={setPeriodoFiltro} allowAll />
          </div>
        </div>

        {list.length === 0 && (
          <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <div className="mb-3 rounded-2xl bg-stone-100 p-4 text-stone-500">{tab === 'gourmet' ? <Coffee size={28} /> : <Blend size={28} />}</div>
            <h3 className="font-bold">{periodoFiltro ? `Sin lotes de ${tab === 'gourmet' ? 'Gourmet' : 'Blend'} ${periodPhrase(periodoFiltro)}` : `Aún no hay producciones de ${tab === 'gourmet' ? 'Gourmet' : 'Blend'}`}</h3>
            <p className="mt-1 max-w-md text-sm text-stone-500">{periodoFiltro ? 'Prueba con otra fecha o elige "Todo el historial".' : 'Inicia un nuevo lote para comenzar a llevar el control.'}</p>
          </div>
        )}

        {list.length > 0 && (
          <div className="divide-y divide-stone-100">
            {list.map(p => {
              const isFinalized = p.status === 'terminada'
              const editHref = `/produccion/${p.type}/${p.id}/editar`
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-4 sm:gap-4">
                  <div className="rounded-xl bg-stone-100 p-2.5 text-stone-500">{p.type === 'gourmet' ? <Coffee size={18} /> : <Blend size={18} />}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-stone-900">{p.code}</p>
                    <p className="text-sm text-stone-500">{summaryLine(p)}</p>
                  </div>
                  <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-4">
                    <span className="hidden shrink-0 text-xs text-stone-400 sm:inline">{formatISODate(p.fecha || p.createdAt)}</span>
                    <span className={`mr-auto shrink-0 rounded-lg px-3 py-1 text-xs font-semibold sm:mr-0 ${isFinalized ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {PRODUCTION_STATUS_LABELS[p.status]}
                      <span className="font-normal sm:hidden"> · {formatISODate(p.fecha || p.createdAt)}</span>
                    </span>
                    {!isFinalized && (
                      <button type="button" className="icon-btn-danger shrink-0" title="Eliminar lote" onClick={e => handleDelete(e, p)}><Trash2 size={16} /></button>
                    )}
                    {isFinalized ? (
                      <Link to={`/produccion/${p.id}`} className="btn-secondary shrink-0">Ver detalle</Link>
                    ) : (
                      <Link to={editHref} className="btn-primary shrink-0">Continuar</Link>
                    )}
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

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: typeof Coffee, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${active ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}
    >
      <Icon size={16} /> {label}
    </button>
  )
}

function finishedWeight(p: Production): number {
  if (p.type === 'gourmet') return packagedWeightLb(p.actualFullBags, p.actualRemainderGrams)
  return p.molidoMezclaWeightLb
}

function summaryLine(p: Production): string {
  if (p.type === 'gourmet') {
    const roasted = roastedAllocatedLb(p.roasts)
    return p.status === 'terminada'
      ? `${p.actualFullBags} bolsas (${p.comercialBags} Comercial + ${p.especialBags} Especial)`
      : `${p.pergaminoUsedLb.toFixed(1)} lb Pergamino · en paso "${p.currentStepName}"${roasted ? ` · ${roasted.toFixed(1)} lb tostadas` : ''}`
  }
  return p.status === 'terminada'
    ? `${p.actualFullBags} bolsas de 350 g (${p.segundaType === 'oro' ? 'Oro' : 'Natural'})`
    : `${p.cantidadPlanificadaLb.toFixed(1)} lb planificadas con ${p.segundaType === 'oro' ? 'Oro' : 'Natural'} · en paso "${p.currentStepName}"`
}
