import { useEffect, useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Blend, Coffee, Loader2, Package, PackageCheck, Pencil, Warehouse, X } from 'lucide-react'
import { RAW_MATERIAL_LABELS, ROAST_TYPES, ROAST_TYPE_LABELS } from '../types/production'
import type { RawMaterialType, RoastType } from '../types/production'
import { PACKAGE_TYPES } from '../types/order'
import { BAG_GRAMS } from '../utils/production'
import { inPeriod, periodPhrase, todayISODate } from '../utils/dates'
import {
  RAW_MATERIALS,
  STOCK_LABELS,
  corregirCostoEmpaque,
  corregirCostoMateriaPrima,
  descontarGourmetTerminado,
  descontarGranoCafeteria,
  empacarSobranteBlend,
  empacarSobranteGourmet,
  enviarBlendTerminado,
  getEmpaqueAlerts,
  getInventoryAlerts,
  granoTotalLb,
  isInventoryLoaded,
  refreshInventory,
  registrarEntradaEmpaque,
  registrarEntradaMateriaPrima,
  registrarSalidaEmpaque,
  registrarSalidaMateriaPrima,
  updateEmpaqueUmbral,
  updateGranoThreshold,
  updateThreshold,
  useEmpaqueMovements,
  useEmpaqueStock,
  useProductoEmpacado,
  useInventory,
  useMovements,
  type EmpaqueMovement,
  type EmpaqueStockItem,
  type GourmetBagType,
  type ProductoEmpacado,
  type InventoryMovement,
  type StockMaterial,
} from '../store/inventoryStore'
import { formatQ, parseCosto } from '../utils/money'
import { errorMessage, toast } from '../components/ui/feedback'
import PeriodPicker from '../components/PeriodPicker'

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const INVENTORY_TABS = [
  { id: 'materia-prima', label: 'Materia prima', icon: Coffee },
  { id: 'grano-cafeteria', label: 'Café en grano', icon: Coffee },
  { id: 'terminado', label: 'Producto terminado', icon: PackageCheck },
  { id: 'empaque', label: 'Bolsas', icon: Package },
] as const

type InventoryTab = (typeof INVENTORY_TABS)[number]['id']

export default function InventarioPage() {
  const { stock, thresholds } = useInventory()
  const empaqueStock = useEmpaqueStock()
  const alerts = useMemo(() => getInventoryAlerts(), [stock, thresholds])
  const empaqueAlerts = useMemo(() => getEmpaqueAlerts(), [empaqueStock])
  const [tab, setTab] = useState<InventoryTab>('materia-prima')

  const [entradaMaterial, setEntradaMaterial] = useState<RawMaterialType | null>(null)
  const [editarMaterial, setEditarMaterial] = useState<RawMaterialType | null>(null)
  const [retiroGranoOpen, setRetiroGranoOpen] = useState(false)
  const empacado = useProductoEmpacado()
  const [blendSalidaOpen, setBlendSalidaOpen] = useState(false)
  const [gourmetSalidaOpen, setGourmetSalidaOpen] = useState(false)
  const [empacarSobrante, setEmpacarSobrante] = useState<'gourmet' | 'blend' | null>(null)
  const [entradaEmpaque, setEntradaEmpaque] = useState<EmpaqueStockItem | null>(null)
  const [editarEmpaque, setEditarEmpaque] = useState<EmpaqueStockItem | null>(null)

  // El inventario se guarda en memoria: al entrar se vuelve a pedir para ver lo registrado desde otro equipo.
  useEffect(() => { if (isInventoryLoaded()) refreshInventory().catch(() => {}) }, [])

  const alertCount: Partial<Record<InventoryTab, number>> = {
    'materia-prima': alerts.filter(a => a.material !== 'granoCafeteria').length,
    'grano-cafeteria': alerts.filter(a => a.material === 'granoCafeteria').length,
    empaque: empaqueAlerts.length,
  }

  const blendBags = { fullBags: empacado.blend, remainderGrams: empacado.blendSueltoGramos }
  const sueltoAlcanzaPara = alcanzaParaBolsas(empacado.sueltoGramos)
  const blendSueltoAlcanzaPara = alcanzaParaBolsas(empacado.blendSueltoGramos)

  const empaqueClientes = empaqueStock.filter(e => (PACKAGE_TYPES as readonly string[]).includes(e.tipo))
  const empaqueProduccion = empaqueStock.filter(e => !(PACKAGE_TYPES as readonly string[]).includes(e.tipo))
  const empaqueGourmet = empaqueProduccion.filter(e => e.tipo === 'comercial' || e.tipo === 'especial')
  const bolsasBlendVacias = empaqueStock.find(e => e.tipo === 'blend')?.cantidad ?? 0

  return (
    <div className="space-y-6">
      <h2 className="page-title">Inventario</h2>

      <div className="card overflow-hidden">
        <div className="scrollbar-none flex gap-1 overflow-x-auto border-b border-stone-200 p-3">
          {INVENTORY_TABS.map(t => (
            <TabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} alert={alertCount[t.id] ?? 0} />
          ))}
        </div>

        <div className="space-y-4 p-3 sm:p-5">
          {tab === 'materia-prima' && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {RAW_MATERIALS.map(material => (
                  <RawMaterialCard
                    key={material}
                    material={material}
                    stockLb={stock[material]}
                    thresholdLb={thresholds[material]}
                    onEntrada={() => setEntradaMaterial(material)}
                    onEditar={() => setEditarMaterial(material)}
                    onThresholdChange={v => updateThreshold(material, v)}
                  />
                ))}
              </div>
              <MonthlyHistory title="Movimientos de materia prima" materials={['pergamino', 'oro', 'natural']} showCosto />
            </>
          )}

          {tab === 'grano-cafeteria' && (
            <>
              <div className="max-w-md">
                <GranoTotalCard totalLb={granoTotalLb(stock)} thresholdLb={thresholds.granoCafeteria} />
              </div>
              <p className="text-sm text-stone-500">Separado por tipo de tueste.</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {ROAST_TYPES.map(tipo => (
                  <div key={tipo} className="card p-3 sm:p-5">
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0"><p className="text-xs text-stone-500 sm:text-sm">Tueste {ROAST_TYPE_LABELS[tipo]}</p><p className="mt-1 text-base font-bold text-stone-900 sm:mt-2 sm:text-2xl">{stock.granoCafeteria[tipo].toFixed(2)} lb</p></div>
                      <div className="hidden rounded-xl bg-amber-100 p-3 text-amber-700 sm:block"><Coffee size={20} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-secondary" onClick={() => setRetiroGranoOpen(true)}><ArrowDownCircle size={16} /> Enviar a cafetería</button>
              <MonthlyHistory title="Movimientos de café en grano" materials={['granoCafeteria_claro', 'granoCafeteria_medio', 'granoCafeteria_oscuro']} />
            </>
          )}

          {tab === 'terminado' && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="card p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-stone-500">Gourmet empacado</p>
                      <p className="stat-value mt-2">{empacado.comercial + empacado.especial} bolsas <span className="text-base font-semibold text-stone-400">· {stock.gourmetLb.toFixed(2)} lb</span></p>
                    </div>
                    <div className="rounded-xl bg-amber-100 p-3 text-amber-700"><Coffee size={20} /></div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-stone-100 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Comercial</p><p className="mt-1 text-xl font-bold text-stone-900">{empacado.comercial}</p></div>
                    <div className="rounded-xl bg-stone-100 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Especial</p><p className="mt-1 text-xl font-bold text-stone-900">{empacado.especial}</p></div>
                  </div>
                  <p className="mt-3 text-xs text-stone-500">
                    Sobrante sin empacar: <b className="text-stone-700">{empacado.sueltoGramos.toFixed(1)} g</b>
                    {sueltoAlcanzaPara > 0 && <> — alcanza para {sueltoAlcanzaPara} bolsa{sueltoAlcanzaPara === 1 ? '' : 's'} más</>}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Bolsas vacías: {empaqueGourmet.map(i => `${i.label.replace(' (Producción propia)', '').replace('Bolsa ', '')} ${i.cantidad}`).join(' · ')}
                  </p>
                  <div className="mt-4 grid gap-2 xl:grid-cols-2">
                    <button className="btn-secondary w-full" disabled={empacado.comercial + empacado.especial <= 0} onClick={() => setGourmetSalidaOpen(true)}><ArrowDownCircle size={16} /> Enviar a cafetería</button>
                    <button className="btn-secondary w-full" disabled={sueltoAlcanzaPara <= 0} onClick={() => setEmpacarSobrante('gourmet')}><Package size={16} /> Empacar sobrante</button>
                  </div>
                </div>
                <FinishedStockCard label="Blend empacado" icon={Blend} lb={stock.blendFinishedLb} bags={blendBags} alcanzaPara={blendSueltoAlcanzaPara} bolsasVacias={bolsasBlendVacias} onSalida={() => setBlendSalidaOpen(true)} onEmpacar={() => setEmpacarSobrante('blend')} actionLabel="Enviar al mayoreo" />
              </div>
              <MonthlyHistory title="Movimientos de producto terminado" materials={['gourmet', 'blendBolsas']} />
            </>
          )}

          {tab === 'empaque' && (
            <>
              <EmpaqueTable title="Para clientes" items={empaqueClientes} onEntrada={setEntradaEmpaque} onEditar={setEditarEmpaque} />
              <EmpaqueTable title="Para producción propia (Gourmet y Blend)" items={empaqueProduccion} onEntrada={setEntradaEmpaque} onEditar={setEditarEmpaque} />
              <EmpaqueHistory />
            </>
          )}
        </div>
      </div>

      {entradaMaterial && <EntradaModal material={entradaMaterial} onClose={() => setEntradaMaterial(null)} />}
      {editarMaterial && <EditarStockModal material={editarMaterial} stockLb={stock[editarMaterial]} onClose={() => setEditarMaterial(null)} />}
      {retiroGranoOpen && <RetiroGranoModal onClose={() => setRetiroGranoOpen(false)} />}
      {blendSalidaOpen && <BlendSalidaModal availableFullBags={blendBags.fullBags} onClose={() => setBlendSalidaOpen(false)} />}
      {gourmetSalidaOpen && <GourmetSalidaModal empacado={empacado} onClose={() => setGourmetSalidaOpen(false)} />}
      {empacarSobrante && (
        <EmpacarSobranteModal
          producto={empacarSobrante}
          sueltoGramos={empacarSobrante === 'blend' ? empacado.blendSueltoGramos : empacado.sueltoGramos}
          alcanzaPara={empacarSobrante === 'blend' ? blendSueltoAlcanzaPara : sueltoAlcanzaPara}
          empaqueStock={empaqueProduccion}
          onClose={() => setEmpacarSobrante(null)}
        />
      )}
      {entradaEmpaque && <EmpaqueEntradaModal item={entradaEmpaque} onClose={() => setEntradaEmpaque(null)} />}
      {editarEmpaque && <EmpaqueEditarModal item={editarEmpaque} onClose={() => setEditarEmpaque(null)} />}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label, alert = 0 }: { active: boolean, onClick: () => void, icon: typeof Coffee, label: string, alert?: number }) {
  return (
    <button
      type="button"
      onClick={e => { onClick(); e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }) }}
      className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'}`}
      title={alert > 0 ? `${alert} ${alert === 1 ? 'alerta' : 'alertas'}: por debajo del mínimo` : undefined}
    >
      <Icon size={16} /> {label}
      {alert > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{alert}</span>}
    </button>
  )
}

function MinimoEditor({ value, display, onSave, compact = false }: { value: number, display: string, onSave: (v: number) => Promise<void>, compact?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [str, setStr] = useState(String(value))

  const save = async () => {
    try {
      await onSave(Number(str) || 0)
      setEditing(false)
      toast.success('Mínimo actualizado.')
    } catch (err) {
      toast.error(errorMessage(err, 'No se pudo actualizar el mínimo.'))
    }
  }

  if (!editing) {
    return (
      <button className={`${compact ? '' : 'mt-3'} group flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-amber-700`} title="Cambiar el mínimo para la alerta" onClick={() => { setStr(String(value)); setEditing(true) }}>
        {compact ? display : `Mínimo: ${display}`} <Pencil size={11} className="opacity-50 group-hover:opacity-100" />
      </button>
    )
  }
  return (
    <div className={`${compact ? 'max-w-48' : 'mt-3'} flex items-center gap-2`}>
      <input
        type="number" min="0" step="1" autoFocus className="input !py-1.5" value={str}
        onChange={e => setStr(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false) }}
      />
      <button className="btn-secondary shrink-0 !min-h-0 !px-3 !py-1.5" onClick={save}>Guardar</button>
    </div>
  )
}

function GranoTotalCard({ totalLb, thresholdLb }: { totalLb: number, thresholdLb: number }) {
  const low = totalLb < thresholdLb
  return (
    <div className={`card p-5 ${low ? 'border-red-300' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-500">Total en grano (todos los tuestes)</p>
          <p className={`mt-2 text-3xl font-bold ${low ? 'text-red-600' : 'text-stone-900'}`}>{totalLb.toFixed(2)} <span className="text-base font-semibold text-stone-400">lb</span></p>
        </div>
        <div className={`rounded-xl p-3 ${low ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}><Coffee size={20} /></div>
      </div>
      <MinimoEditor value={thresholdLb} display={`${thresholdLb.toFixed(2)} lb`} onSave={updateGranoThreshold} />
    </div>
  )
}

function RawMaterialCard({ material, stockLb, thresholdLb, onEntrada, onEditar, onThresholdChange }: {
  material: RawMaterialType
  stockLb: number
  thresholdLb: number
  onEntrada: () => void
  onEditar: () => void
  onThresholdChange: (v: number) => Promise<void>
}) {
  const low = stockLb < thresholdLb

  return (
    <div className={`card p-5 ${low ? 'border-red-300' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-500">{RAW_MATERIAL_LABELS[material]}</p>
          <p className={`mt-2 text-3xl font-bold ${low ? 'text-red-600' : 'text-stone-900'}`}>{stockLb.toFixed(2)} <span className="text-base font-semibold text-stone-400">lb</span></p>
        </div>
        <div className={`rounded-xl p-3 ${low ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}><Coffee size={20} /></div>
      </div>

      <MinimoEditor value={thresholdLb} display={`${thresholdLb.toFixed(2)} lb`} onSave={onThresholdChange} />

      <button className="btn-primary mt-4 w-full" onClick={onEntrada}><ArrowUpCircle size={16} /> Registrar entrada</button>
      <button
        className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={stockLb <= 0}
        onClick={onEditar}
      >
        <Pencil size={12} /> Ajustar existencia
      </button>
    </div>
  )
}

function EmpaqueTable({ title, items, onEntrada, onEditar }: { title: string, items: EmpaqueStockItem[], onEntrada: (item: EmpaqueStockItem) => void, onEditar: (item: EmpaqueStockItem) => void }) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-stone-200 p-4"><h4 className="font-bold">{title}</h4></div>
      <ul className="divide-y divide-stone-100 md:hidden">
        {items.map(item => {
          const low = item.minimo != null && item.cantidad < item.minimo
          return (
            <li key={item.tipo} className={`p-4 ${low ? 'bg-red-50/60' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 font-medium text-stone-900">{item.label.replace(' (Producción propia)', '')}</p>
                <p className={`shrink-0 font-bold ${low ? 'text-red-600' : 'text-stone-900'}`}>{item.cantidad} bolsas</p>
              </div>
              {low && <span className="mt-1 inline-block rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">Bajo el mínimo</span>}
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1 text-xs text-stone-500">
                  <span>Mínimo:</span>
                  <MinimoEditor compact value={item.minimo ?? 0} display={item.minimo != null ? `${item.minimo} bolsas` : 'Sin configurar'} onSave={v => updateEmpaqueUmbral(item.tipo, v)} />
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button className="icon-btn" title="Ajustar existencia" aria-label={`Ajustar existencia de ${item.label}`} disabled={item.cantidad <= 0} onClick={() => onEditar(item)}><Pencil size={15} /></button>
                  <button className="btn-primary !min-h-0 !px-3 !py-1.5 text-xs" onClick={() => onEntrada(item)}><ArrowUpCircle size={14} /> Entrada</button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[600px] table-fixed text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              <th className="w-[30%] px-4 pb-2 pt-3">Tipo de bolsa</th>
              <th className="w-[22%] px-4 pb-2 pt-3">Existencia</th>
              <th className="w-[20%] px-4 pb-2 pt-3">Mínimo</th>
              <th className="w-[28%] px-4 pb-2 pt-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map(item => {
              const low = item.minimo != null && item.cantidad < item.minimo
              return (
                <tr key={item.tipo} className={low ? 'bg-red-50/60' : ''}>
                  <td className="px-4 py-3 font-medium text-stone-900">{item.label.replace(' (Producción propia)', '')}</td>
                  <td className={`whitespace-nowrap px-4 py-3 font-bold ${low ? 'text-red-600' : 'text-stone-900'}`}>
                    {item.cantidad} bolsas
                    {low && <span className="ml-2 rounded-md bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">Bajo el mínimo</span>}
                  </td>
                  <td className="px-4 py-3">
                    <MinimoEditor compact value={item.minimo ?? 0} display={item.minimo != null ? `${item.minimo} bolsas` : 'Sin configurar'} onSave={v => updateEmpaqueUmbral(item.tipo, v)} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button className="icon-btn mr-1.5" title="Ajustar existencia" aria-label={`Ajustar existencia de ${item.label}`} disabled={item.cantidad <= 0} onClick={() => onEditar(item)}><Pencil size={15} /></button>
                    <button className="btn-primary !min-h-0 !px-3 !py-1.5 text-xs" onClick={() => onEntrada(item)}><ArrowUpCircle size={14} /> Entrada</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EmpaqueHistory() {
  const allMovements = useEmpaqueMovements()
  const empaqueStock = useEmpaqueStock()
  const [corrigiendo, setCorrigiendo] = useState<EmpaqueMovement | null>(null)
  const [tipoFiltro, setTipoFiltro] = useState<string>('all')
  const [periodo, setPeriodo] = useState(todayISODate().slice(0, 7))

  const shown = useMemo(() => {
    let rows = allMovements
    if (tipoFiltro !== 'all') rows = rows.filter(m => m.tipoEmpaque === tipoFiltro)
    if (periodo) rows = rows.filter(m => inPeriod(m.fecha, periodo))
    return rows
  }, [allMovements, tipoFiltro, periodo])

  const labelFor = (tipo: string) => empaqueStock.find(e => e.tipo === tipo)?.label ?? tipo

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
        <h4 className="font-bold">Movimientos de bolsas</h4>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="w-full sm:w-52">
            <select className="select !py-2 text-sm" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>
              <option value="all">Todas las bolsas</option>
              {empaqueStock.map(e => <option key={e.tipo} value={e.tipo}>{e.label}</option>)}
            </select>
          </div>
          <PeriodPicker value={periodo} onChange={setPeriodo} allowAll />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center">
          <Warehouse size={22} className="mb-2 text-stone-300" />
          <p className="text-sm text-stone-500">{periodo ? `Sin movimientos ${periodPhrase(periodo)}.` : 'Sin movimientos registrados.'}</p>
        </div>
      ) : (
        <>
        <ul className="divide-y divide-stone-100 lg:hidden">
          {shown.map(m => (
            <li key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{labelFor(m.tipoEmpaque)}</p>
                  <p className="text-xs text-stone-500">{DATE_TIME_FORMAT.format(new Date(m.fecha))}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {m.tipo === 'entrada' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />} {m.tipo === 'entrada' ? '+' : '−'}{m.cantidad}
                </span>
              </div>
              {m.motivo && <p className="mt-1 text-sm text-stone-500">{m.motivo}</p>}
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-stone-500">
                {m.esCompra ? <CostoCell mov={m} unidad="bolsa" onCorregir={() => setCorrigiendo(m)} /> : <span />}
                <span>Saldo <b className="text-stone-900">{m.saldoResultante}</b></span>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 pb-2 pt-4">Fecha</th>
                <th className="px-4 pb-2 pt-4">Tipo de bolsa</th>
                <th className="px-4 pb-2 pt-4">Movimiento</th>
                <th className="px-4 pb-2 pt-4">Cantidad</th>
                <th className="px-4 pb-2 pt-4">Costo</th>
                <th className="px-4 pb-2 pt-4">Motivo</th>
                <th className="px-4 pb-2 pt-4">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shown.map(m => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-stone-500">{DATE_TIME_FORMAT.format(new Date(m.fecha))}</td>
                  <td className="px-4 py-2.5 font-medium text-stone-900">{labelFor(m.tipoEmpaque)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {m.tipo === 'entrada' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />} {m.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{m.cantidad} bolsas</td>
                  <td className="whitespace-nowrap px-4 py-2.5"><CostoCell mov={m} unidad="bolsa" onCorregir={() => setCorrigiendo(m)} /></td>
                  <td className="min-w-44 px-4 py-2.5 text-stone-500">{m.motivo}</td>
                  <td className="px-4 py-2.5 font-semibold text-stone-900">{m.saldoResultante}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {corrigiendo && (
        <CorregirCostoModal mov={corrigiendo} titulo={labelFor(corrigiendo.tipoEmpaque)} unidad="bolsa" onSave={costo => corregirCostoEmpaque(corrigiendo.id, costo)} onClose={() => setCorrigiendo(null)} />
      )}
    </div>
  )
}

function CostoTotalField({ value, onChange, cantidad, unidad }: { value: string, onChange: (v: string) => void, cantidad: number, unidad: 'lb' | 'bolsa' }) {
  const costo = parseCosto(value)
  const unitario = typeof costo === 'number' && cantidad > 0 ? costo / cantidad : null
  return (
    <label className="mt-4 block">
      <span className="label">Costo total (Q) — opcional</span>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">Q</span>
        <input type="number" min="0" step="0.01" inputMode="decimal" className="input !pl-8" placeholder="0.00" value={value} onChange={e => onChange(e.target.value)} />
      </div>
      <span className="mt-1 block text-xs text-stone-500">
        {unitario !== null
          ? <>Sale a <b className="text-stone-700">{formatQ(unitario)}</b> por {unidad}.</>
          : 'Lo que se pagó por todo lo que entra (ej. el saco completo). Déjalo vacío si no fue una compra.'}
      </span>
    </label>
  )
}

function EmpaqueEntradaModal({ item, onClose }: { item: EmpaqueStockItem, onClose: () => void }) {
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const cantidadNum = Math.floor(Number(cantidad) || 0)
    if (cantidadNum <= 0) { setError('Ingresa una cantidad mayor que 0.'); return }
    const costoTotal = parseCosto(costo)
    if (costoTotal === null) { setError('El costo debe ser un número mayor o igual a 0.'); return }
    setSubmitting(true)
    try {
      await registrarEntradaEmpaque(item.tipo, cantidadNum, motivo, costoTotal)
      toast.success(`Se registraron ${cantidadNum} bolsas de ${item.label}${costoTotal !== undefined ? ` (${formatQ(costoTotal)})` : ''}.`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrada.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Entrada de ${item.label}`} onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block"><span className="label">Cantidad (bolsas)</span><input type="number" min="0" step="1" autoFocus className="input" value={cantidad} onChange={e => { setError(''); setCantidad(e.target.value) }} /></label>
        <CostoTotalField value={costo} onChange={v => { setError(''); setCosto(v) }} cantidad={Math.floor(Number(cantidad) || 0)} unidad="bolsa" />
        <label className="mt-4 block"><span className="label">Motivo (opcional)</span><input className="input" placeholder="Compra a proveedor..." value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
        <button type="submit" className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Registrar entrada
        </button>
      </form>
    </Modal>
  )
}

function EmpaqueEditarModal({ item, onClose }: { item: EmpaqueStockItem, onClose: () => void }) {
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const cantidadNum = Math.floor(Number(cantidad) || 0)
    if (cantidadNum <= 0) { setError('Ingresa una cantidad mayor que 0.'); return }
    if (cantidadNum > item.cantidad) { setError(`Solo hay ${item.cantidad} bolsas disponibles.`); return }
    setSubmitting(true)
    try {
      await registrarSalidaEmpaque(item.tipo, cantidadNum, motivo.trim() || 'Corrección de captura')
      toast.success(`Se restaron ${cantidadNum} bolsas de ${item.label}.`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la corrección.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Ajustar existencia de ${item.label}`} onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <p className="mb-4 text-sm text-stone-500">Existencia actual: <b className="text-stone-700">{item.cantidad} bolsas</b>. Para corregir una entrada capturada de más: escribe cuánto sobra (lo que hay que restar), no el total correcto.</p>
      <form onSubmit={handleSubmit}>
        <label className="block"><span className="label">Cantidad a restar (bolsas)</span><input type="number" min="0" max={item.cantidad} step="1" autoFocus className="input" value={cantidad} onChange={e => { setError(''); setCantidad(e.target.value) }} /></label>
        <label className="mt-4 block"><span className="label">Motivo (opcional)</span><input className="input" placeholder="Corrección de captura" value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
        <button type="submit" className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Restar del inventario
        </button>
      </form>
    </Modal>
  )
}

function alcanzaParaBolsas(sueltoGramos: number): number {
  return Math.floor((sueltoGramos + 3) / BAG_GRAMS)
}

function FinishedStockCard({ label, lb, bags, alcanzaPara, bolsasVacias, onSalida, onEmpacar, icon: Icon = PackageCheck, actionLabel = 'Enviar a cafetería' }: { label: string, lb: number, bags: { fullBags: number, remainderGrams: number }, alcanzaPara: number, bolsasVacias?: number, onSalida: () => void, onEmpacar: () => void, icon?: typeof PackageCheck, actionLabel?: string }) {
  return (
    <div className="card flex flex-col p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-500">{label}</p>
          <p className="stat-value mt-2">{bags.fullBags} bolsas <span className="text-base font-semibold text-stone-400">· {lb.toFixed(2)} lb</span></p>
        </div>
        <div className="rounded-xl bg-amber-100 p-3 text-amber-700"><Icon size={20} /></div>
      </div>
      <p className="mt-3 text-xs text-stone-500">
        Sobrante sin empacar: <b className="text-stone-700">{bags.remainderGrams.toFixed(1)} g</b>
        {alcanzaPara > 0 && <> — alcanza para {alcanzaPara} bolsa{alcanzaPara === 1 ? '' : 's'} más</>}
      </p>
      {bolsasVacias !== undefined && <p className="mt-1 text-xs text-stone-500">Bolsas vacías: {bolsasVacias}</p>}
      <div className="mt-4 grid gap-2 xl:grid-cols-2">
        <button className="btn-secondary w-full" disabled={bags.fullBags <= 0} onClick={onSalida}><ArrowDownCircle size={16} /> {actionLabel}</button>
        <button className="btn-secondary w-full" disabled={alcanzaPara <= 0} onClick={onEmpacar}><Package size={16} /> Empacar sobrante</button>
      </div>
    </div>
  )
}

interface MovimientoConCosto { id: string, tipo: 'entrada' | 'salida', cantidad: number, costoTotal: number | null, esCompra: boolean, costoCorregidoAt: string | null }

function CostoCell({ mov, unidad, onCorregir }: { mov: MovimientoConCosto, unidad: 'lb' | 'bolsa', onCorregir: () => void }) {
  if (!mov.esCompra) return <span className="text-stone-300">—</span>
  return (
    <span className="flex items-start gap-1.5">
      {mov.costoTotal === null ? (
        <span className="text-xs text-stone-400">Sin costo</span>
      ) : (
        <span>
          <b className="text-stone-900">{formatQ(mov.costoTotal)}</b>
          {mov.cantidad > 0 && <span className="block text-xs text-stone-500">{formatQ(mov.costoTotal / mov.cantidad)} / {unidad}</span>}
          {mov.costoCorregidoAt && (
            <span className="block text-[11px] text-amber-700" title={`Corregido el ${DATE_TIME_FORMAT.format(new Date(mov.costoCorregidoAt))}`}>Corregido</span>
          )}
        </span>
      )}
      <button type="button" className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-amber-700" onClick={onCorregir} title={mov.costoTotal === null ? 'Agregar costo' : 'Corregir costo'} aria-label={mov.costoTotal === null ? 'Agregar costo' : 'Corregir costo'}>
        <Pencil size={13} />
      </button>
    </span>
  )
}

function CorregirCostoModal({ mov, titulo, unidad, onSave, onClose }: { mov: MovimientoConCosto, titulo: string, unidad: 'lb' | 'bolsa', onSave: (costo: number | null) => Promise<void>, onClose: () => void }) {
  const [costo, setCosto] = useState(mov.costoTotal === null ? '' : String(mov.costoTotal))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const guardar = async (valor: number | null) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onSave(valor)
      toast.success(valor === null ? 'Se quitó el costo de la entrada.' : `Costo actualizado a ${formatQ(valor)}.`)
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'No se pudo corregir el costo.'))
      setSubmitting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseCosto(costo)
    if (valor === null) { setError('El costo debe ser un número mayor o igual a 0.'); return }
    if (valor === undefined) { setError('Ingresa el costo, o usa "Quitar costo" si no fue una compra.'); return }
    void guardar(valor)
  }

  const cantidadTexto = unidad === 'lb' ? `${mov.cantidad.toFixed(2)} lb` : `${mov.cantidad} bolsas`
  return (
    <Modal title={`Corregir costo — ${titulo}`} onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <p className="text-sm text-stone-500">
        Entrada de <b className="text-stone-700">{cantidadTexto}</b>. Costo actual: <b className="text-stone-700">{mov.costoTotal === null ? 'sin costo' : formatQ(mov.costoTotal)}</b>.
        Solo cambia el costo; el inventario no se mueve.
      </p>
      <form onSubmit={handleSubmit}>
        <CostoTotalField value={costo} onChange={v => { setError(''); setCosto(v) }} cantidad={mov.cantidad} unidad={unidad} />
        <button type="submit" className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Guardar costo
        </button>
        {mov.costoTotal !== null && (
          <button type="button" className="btn-secondary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} onClick={() => void guardar(null)}>
            Quitar costo (no fue una compra)
          </button>
        )}
      </form>
    </Modal>
  )
}

function MonthlyHistory({ title, materials, showCosto = false }: { title: string, materials: StockMaterial[], showCosto?: boolean }) {
  const allMovements = useMovements()
  const [corrigiendo, setCorrigiendo] = useState<InventoryMovement | null>(null)
  const [materialFiltro, setMaterialFiltro] = useState<StockMaterial | 'all'>('all')
  const [periodo, setPeriodo] = useState(todayISODate().slice(0, 7))

  const relevant = useMemo(() => allMovements.filter(m => materials.includes(m.material)), [allMovements, materials])
  const hasMaterialFilter = materials.length > 1

  const shown = useMemo(() => {
    let rows = relevant
    if (hasMaterialFilter && materialFiltro !== 'all') rows = rows.filter(m => m.material === materialFiltro)
    if (periodo) rows = rows.filter(m => inPeriod(m.fecha, periodo))
    return rows
  }, [relevant, hasMaterialFilter, materialFiltro, periodo])

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 p-4">
        <h4 className="font-bold">{title}</h4>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {hasMaterialFilter && (
            <div className="w-full sm:w-40"><select className="select !py-2 text-sm" value={materialFiltro} onChange={e => setMaterialFiltro(e.target.value as StockMaterial | 'all')}>
              <option value="all">Todos</option>
              {materials.map(m => <option key={m} value={m}>{STOCK_LABELS[m]}</option>)}
            </select></div>
          )}
          <PeriodPicker value={periodo} onChange={setPeriodo} allowAll />
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="flex min-h-32 flex-col items-center justify-center p-6 text-center">
          <Warehouse size={22} className="mb-2 text-stone-300" />
          <p className="text-sm text-stone-500">{periodo ? `Sin movimientos ${periodPhrase(periodo)}.` : 'Sin movimientos registrados.'}</p>
        </div>
      ) : (
        <>
        <ul className="divide-y divide-stone-100 lg:hidden">
          {shown.map(m => (
            <li key={m.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900">{materials.length > 1 ? STOCK_LABELS[m.material] : m.tipo === 'entrada' ? 'Entrada' : 'Salida'}</p>
                  <p className="text-xs text-stone-500">{DATE_TIME_FORMAT.format(new Date(m.fecha))}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {m.tipo === 'entrada' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />} {m.tipo === 'entrada' ? '+' : '−'}{m.cantidad.toFixed(2)} lb
                </span>
              </div>
              {m.motivo && <p className="mt-1 text-sm text-stone-500">{m.motivo}</p>}
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-stone-500">
                {showCosto && m.esCompra ? <CostoCell mov={m} unidad="lb" onCorregir={() => setCorrigiendo(m)} /> : <span />}
                <span>Saldo <b className="text-stone-900">{m.saldoResultante.toFixed(2)} lb</b></span>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-4 pb-2 pt-4">Fecha</th>
                {materials.length > 1 && <th className="px-4 pb-2 pt-4">Material</th>}
                <th className="px-4 pb-2 pt-4">Movimiento</th>
                <th className="px-4 pb-2 pt-4">Cantidad</th>
                {showCosto && <th className="px-4 pb-2 pt-4">Costo</th>}
                <th className="px-4 pb-2 pt-4">Motivo</th>
                <th className="px-4 pb-2 pt-4">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shown.map(m => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-stone-500">{DATE_TIME_FORMAT.format(new Date(m.fecha))}</td>
                  {materials.length > 1 && <td className="px-4 py-2.5 font-medium text-stone-900">{STOCK_LABELS[m.material]}</td>}
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${m.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {m.tipo === 'entrada' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />} {m.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{m.cantidad.toFixed(2)} lb</td>
                  {showCosto && <td className="whitespace-nowrap px-4 py-2.5"><CostoCell mov={m} unidad="lb" onCorregir={() => setCorrigiendo(m)} /></td>}
                  <td className="min-w-44 px-4 py-2.5 text-stone-500">{m.motivo}</td>
                  <td className="px-4 py-2.5 font-semibold text-stone-900">{m.saldoResultante.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      {corrigiendo && (
        <CorregirCostoModal mov={corrigiendo} titulo={STOCK_LABELS[corrigiendo.material]} unidad="lb" onSave={costo => corregirCostoMateriaPrima(corrigiendo.id, costo)} onClose={() => setCorrigiendo(null)} />
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string, onClose: () => void, children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="animate-fade-in fixed inset-0 z-40 flex items-end justify-center bg-stone-950/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-slide-up max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:pb-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <button className="icon-btn shrink-0" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function EntradaModal({ material, onClose }: { material: RawMaterialType, onClose: () => void }) {
  const [cantidad, setCantidad] = useState('')
  const [costo, setCosto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const cantidadLb = Number(cantidad) || 0
    if (cantidadLb <= 0) { setError('Ingresa una cantidad mayor que 0.'); return }
    const costoTotal = parseCosto(costo)
    if (costoTotal === null) { setError('El costo debe ser un número mayor o igual a 0.'); return }
    setSubmitting(true)
    try {
      await registrarEntradaMateriaPrima(material, cantidadLb, motivo, costoTotal)
      toast.success(`Entrada de ${cantidadLb} lb de ${RAW_MATERIAL_LABELS[material]} registrada${costoTotal !== undefined ? ` (${formatQ(costoTotal)})` : ''}.`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la entrada.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Entrada de ${RAW_MATERIAL_LABELS[material]}`} onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block"><span className="label">Cantidad (lb)</span><input type="number" min="0" step="0.01" autoFocus className="input" value={cantidad} onChange={e => { setError(''); setCantidad(e.target.value) }} /></label>
        <CostoTotalField value={costo} onChange={v => { setError(''); setCosto(v) }} cantidad={Number(cantidad) || 0} unidad="lb" />
        <label className="mt-4 block"><span className="label">Motivo (opcional)</span><input className="input" placeholder="Compra a proveedor..." value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
        <button type="submit" className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Registrar entrada
        </button>
      </form>
    </Modal>
  )
}

function EditarStockModal({ material, stockLb, onClose }: { material: RawMaterialType, stockLb: number, onClose: () => void }) {
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const cantidadLb = Number(cantidad) || 0
    if (cantidadLb <= 0) { setError('Ingresa una cantidad mayor que 0.'); return }
    if (cantidadLb > stockLb) { setError(`Solo hay ${stockLb.toFixed(2)} lb disponibles.`); return }
    setSubmitting(true)
    try {
      await registrarSalidaMateriaPrima(material, cantidadLb, motivo.trim() || 'Corrección de captura')
      toast.success(`Se restaron ${cantidadLb} lb de ${RAW_MATERIAL_LABELS[material]}.`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la corrección.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Ajustar existencia de ${RAW_MATERIAL_LABELS[material]}`} onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <p className="mb-4 text-sm text-stone-500">Existencia actual: <b className="text-stone-700">{stockLb.toFixed(2)} lb</b>. Para corregir una entrada capturada de más: escribe cuánto sobra (lo que hay que restar), no el total correcto.</p>
      <form onSubmit={handleSubmit}>
        <label className="block"><span className="label">Cantidad a restar (lb)</span><input type="number" min="0" max={stockLb} step="0.01" autoFocus className="input" value={cantidad} onChange={e => { setError(''); setCantidad(e.target.value) }} /></label>
        <label className="mt-4 block"><span className="label">Motivo (opcional)</span><input className="input" placeholder="Corrección de captura" value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
        <button type="submit" className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Restar del inventario
        </button>
      </form>
    </Modal>
  )
}

function RetiroGranoModal({ onClose }: { onClose: () => void }) {
  const [tipo, setTipo] = useState<RoastType>('medio')
  const [cantidad, setCantidad] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const cantidadLb = Number(cantidad) || 0
    if (cantidadLb <= 0) { setError('Ingresa una cantidad mayor que 0.'); return }
    setSubmitting(true)
    try {
      await descontarGranoCafeteria(tipo, cantidadLb, `Envío a cafetería — Tueste ${ROAST_TYPE_LABELS[tipo]}`)
      toast.success(`Envío de ${cantidadLb} lb a cafetería registrado.`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el envío.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Envío de café en grano a cafetería" onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block"><span className="label">Tipo de tueste</span>
          <select className="select" value={tipo} onChange={e => setTipo(e.target.value as RoastType)}>
            {ROAST_TYPES.map(t => <option key={t} value={t}>{ROAST_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <label className="mt-4 block"><span className="label">Cantidad (lb)</span><input type="number" min="0" step="0.01" autoFocus className="input" value={cantidad} onChange={e => { setError(''); setCantidad(e.target.value) }} /></label>
        <button type="submit" className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Registrar envío
        </button>
      </form>
    </Modal>
  )
}

const NOTA_MAX_LENGTH = 140
const GOURMET_BAG_LABELS: Record<GourmetBagType, string> = { comercial: 'Comercial', especial: 'Especial' }

function NotaField({ nota, setNota }: { nota: string, setNota: (v: string) => void }) {
  return (
    <label className="mt-4 block">
      <span className="label">Nota (opcional)</span>
      <input className="input" maxLength={NOTA_MAX_LENGTH} value={nota} onChange={e => setNota(e.target.value)} />
      <span className="mt-1 block text-right text-xs text-stone-400">{nota.length}/{NOTA_MAX_LENGTH}</span>
    </label>
  )
}

function BlendSalidaModal({ availableFullBags, onClose }: { availableFullBags: number, onClose: () => void }) {
  const [bolsas, setBolsas] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const bolsasNum = Math.max(0, Math.floor(Number(bolsas) || 0))
    if (bolsasNum <= 0) { setError('Ingresa una cantidad de bolsas mayor que 0.'); return }
    if (bolsasNum > availableFullBags) { setError(`Solo hay ${availableFullBags} bolsas completas disponibles.`); return }
    setSubmitting(true)
    try {
      await enviarBlendTerminado(bolsasNum, nota.trim() ? `Envío al mayoreo — ${nota.trim()}` : 'Envío al mayoreo')
      toast.success(`${bolsasNum} bolsas de Blend enviadas al mayoreo.`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el envío.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Enviar bolsas de Blend al mayoreo" onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <p className="mb-3 text-sm text-stone-500">Bolsas completas disponibles: <b className="text-stone-700">{availableFullBags}</b></p>
      <form onSubmit={handleSubmit}>
        <label className="block"><span className="label">Bolsas a enviar</span><input type="number" min="0" max={availableFullBags} step="1" autoFocus className="input" value={bolsas} onChange={e => { setError(''); setBolsas(e.target.value) }} /></label>
        <NotaField nota={nota} setNota={setNota} />
        <button type="submit" className="btn-primary mt-1 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Registrar envío
        </button>
      </form>
    </Modal>
  )
}

function GourmetSalidaModal({ empacado, onClose }: { empacado: ProductoEmpacado, onClose: () => void }) {
  const [tipo, setTipo] = useState<GourmetBagType>(empacado.comercial > 0 ? 'comercial' : 'especial')
  const [bolsas, setBolsas] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const disponibles = empacado[tipo]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const bolsasNum = Math.max(0, Math.floor(Number(bolsas) || 0))
    if (bolsasNum <= 0) { setError('Ingresa una cantidad de bolsas mayor que 0.'); return }
    if (bolsasNum > disponibles) { setError(`Solo hay ${disponibles} bolsas ${GOURMET_BAG_LABELS[tipo]} llenas.`); return }
    setSubmitting(true)
    try {
      await descontarGourmetTerminado(tipo, bolsasNum, nota.trim() ? `Envío a cafetería — ${nota.trim()}` : 'Envío a cafetería')
      toast.success(`${bolsasNum} bolsas ${GOURMET_BAG_LABELS[tipo]} enviadas a cafetería.`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el envío.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Enviar Gourmet a cafetería" onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <form onSubmit={handleSubmit}>
        <label className="block"><span className="label">Tipo de bolsa</span>
          <select className="select" value={tipo} onChange={e => { setError(''); setTipo(e.target.value as GourmetBagType) }}>
            <option value="comercial">Comercial ({empacado.comercial} llenas)</option>
            <option value="especial">Especial ({empacado.especial} llenas)</option>
          </select>
        </label>
        <label className="mt-4 block"><span className="label">Bolsas a enviar</span><input type="number" min="0" max={disponibles} step="1" autoFocus className="input" value={bolsas} onChange={e => { setError(''); setBolsas(e.target.value) }} /></label>
        <NotaField nota={nota} setNota={setNota} />
        <button type="submit" className="btn-primary mt-1 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Registrar envío
        </button>
      </form>
    </Modal>
  )
}

function EmpacarSobranteModal({ producto, sueltoGramos, alcanzaPara, empaqueStock, onClose }: { producto: 'gourmet' | 'blend', sueltoGramos: number, alcanzaPara: number, empaqueStock: EmpaqueStockItem[], onClose: () => void }) {
  const [tipo, setTipo] = useState<GourmetBagType | 'blend'>(producto === 'blend' ? 'blend' : 'comercial')
  const [bolsas, setBolsas] = useState(String(alcanzaPara))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const vacias = empaqueStock.find(e => e.tipo === tipo)?.cantidad ?? 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    const bolsasNum = Math.max(0, Math.floor(Number(bolsas) || 0))
    if (bolsasNum <= 0) { setError('Ingresa una cantidad de bolsas mayor que 0.'); return }
    if (bolsasNum > alcanzaPara) { setError(`El café suelto solo alcanza para ${alcanzaPara} bolsa${alcanzaPara === 1 ? '' : 's'}.`); return }
    if (bolsasNum > vacias) { setError(`Solo hay ${vacias} bolsas ${tipo === 'blend' ? 'Blend' : GOURMET_BAG_LABELS[tipo]} vacías en bodega.`); return }
    setSubmitting(true)
    try {
      if (tipo === 'blend') await empacarSobranteBlend(bolsasNum, '')
      else await empacarSobranteGourmet(tipo, bolsasNum, '')
      toast.success(`${bolsasNum} bolsa${bolsasNum === 1 ? '' : 's'} de café suelto empacada${bolsasNum === 1 ? '' : 's'}.`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el empaque.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title={`Empacar ${producto === 'blend' ? 'Blend' : 'Gourmet'} suelto (sobrante)`} onClose={onClose}>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      <p className="mb-4 text-sm text-stone-500">Hay <b className="text-stone-700">{sueltoGramos.toFixed(1)} g</b> de café suelto, que alcanza para <b className="text-stone-700">{alcanzaPara}</b> bolsa{alcanzaPara === 1 ? '' : 's'} de {BAG_GRAMS} g. Regístralo cuando ya las hayan llenado: pasan a bolsas llenas y se descuenta la bolsa vacía.</p>
      <form onSubmit={handleSubmit}>
        {producto === 'gourmet' ? (
          <label className="mb-4 block"><span className="label">Tipo de bolsa</span>
            <select className="select" value={tipo} onChange={e => { setError(''); setTipo(e.target.value as GourmetBagType) }}>
              {(['comercial', 'especial'] as const).map(t => (
                <option key={t} value={t}>{GOURMET_BAG_LABELS[t]} ({empaqueStock.find(e => e.tipo === t)?.cantidad ?? 0} vacías)</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mb-4 text-sm text-stone-500">Bolsas Blend vacías en bodega: <b className="text-stone-700">{vacias}</b></p>
        )}
        <label className="block"><span className="label">Bolsas llenadas</span><input type="number" min="1" max={alcanzaPara} step="1" autoFocus className="input" value={bolsas} onChange={e => { setError(''); setBolsas(e.target.value) }} /></label>
        <button type="submit" className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
          {submitting && <Loader2 size={16} className="animate-spin" />} Registrar empaque
        </button>
      </form>
    </Modal>
  )
}
