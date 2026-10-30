import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Coffee, Loader2, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BAG_GRAMS, MAX_ROAST_LB, packagedWeightLb, packagingFromLb } from '../utils/production'
import { formatISODate, todayISODate } from '../utils/dates'
import { GOURMET_STEPS, ROAST_TYPES, ROAST_TYPE_LABELS, gourmetMermaLb, roastedAllocatedLb, type GourmetStep, type RoastBatch, type RoastType } from '../types/production'
import {
  finalizeGourmetProduction,
  startGourmetProduction,
  updateGourmetProduction,
  useGourmetProduction,
  useProductionsLoaded,
} from '../store/productionStore'
import { getRawMaterialStock, useInventory } from '../store/inventoryStore'
import DatePickerField from '../components/DatePickerField'
import { Field, SectionTitle, Stat } from '../components/FormParts'
import PageLoader from '../components/ui/PageLoader'
import WizardSteps, { WizardNav } from '../components/ui/WizardSteps'

type RoastForm = { id: number, weightLb: number | '', notes: string }
const emptyRoast = (id: number): RoastForm => ({ id, weightLb: '', notes: '' })
const toRoast = (r: RoastForm): RoastBatch => ({ id: r.id, weightLb: Number(r.weightLb) || 0, notes: r.notes })

export default function NuevaProduccionGourmetPage() {
  const { id } = useParams<{ id?: string }>()
  const productionsReady = useProductionsLoaded()
  if (id && !productionsReady) return <PageLoader />
  return <GourmetForm id={id} />
}

function GourmetForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  useInventory()
  const existing = useGourmetProduction(id)
  const notFound = Boolean(id && !existing)
  const isFinalized = existing?.status === 'terminada'

  const [productionId, setProductionId] = useState<string | null>(existing?.id ?? null)
  const [step, setStep] = useState(() => {
    if (!existing) return 0
    const idx = GOURMET_STEPS.indexOf(existing.currentStepName)
    return idx >= 0 ? idx : 0
  })
  const [pageError, setPageError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isNewDraft = !productionId

  const [fecha, setFecha] = useState(() => existing?.fecha ?? todayISODate())
  const [pergaminoUsedStr, setPergaminoUsedStr] = useState(() => existing ? String(existing.pergaminoUsedLb) : '')

  const [trilladoWeight, setTrilladoWeight] = useState(() => existing?.trilladoWeightLb ? String(existing.trilladoWeightLb) : '')
  const [roastType, setRoastType] = useState<RoastType>(() => existing?.roastType ?? 'medio')
  const [roasts, setRoasts] = useState<RoastForm[]>(() => existing && existing.roasts.length ? existing.roasts : [emptyRoast(1)])
  const [pesoTuesteResult, setPesoTuesteResult] = useState(() => existing?.pesoTuesteResultLb ? String(existing.pesoTuesteResultLb) : '')
  const [reservaCafeteria, setReservaCafeteria] = useState(() => existing?.reservaCafeteriaLb ? String(existing.reservaCafeteriaLb) : '0')
  const [molidoWeight, setMolidoWeight] = useState(() => existing?.molidoWeightLb ? String(existing.molidoWeightLb) : '')
  const [actualFullBags, setActualFullBags] = useState<number | ''>(() => existing?.actualFullBags ?? '')
  const [actualRemainderGrams, setActualRemainderGrams] = useState<number | ''>(() => existing?.actualRemainderGrams ?? '')
  const [comercialBagsStr, setComercialBagsStr] = useState<number | ''>(() => existing?.comercialBags ?? '')
  const [especialBagsStr, setEspecialBagsStr] = useState<number | ''>(() => existing?.especialBags ?? '')

  const pergaminoAvailable = getRawMaterialStock('pergamino')
  const pergaminoUsed = Number(pergaminoUsedStr) || 0
  const trilladoLb = Number(trilladoWeight) || 0
  const roastedTotal = useMemo(() => roastedAllocatedLb(roasts.map(toRoast)), [roasts])
  const pesoTuesteResultLb = Number(pesoTuesteResult) || 0
  const reservaLb = Number(reservaCafeteria) || 0
  const restanteParaMolido = Math.max(pesoTuesteResultLb - reservaLb, 0)
  const molidoLb = Number(molidoWeight) || 0
  const suggestedPackaging = useMemo(() => packagingFromLb(molidoLb), [molidoLb])
  const effectiveFullBags = actualFullBags === '' ? suggestedPackaging.fullBags : actualFullBags
  const effectiveRemainder = actualRemainderGrams === '' ? suggestedPackaging.remainderGrams : actualRemainderGrams
  const effectiveComercialBags = comercialBagsStr === '' ? 0 : comercialBagsStr
  const effectiveEspecialBags = especialBagsStr === '' ? 0 : especialBagsStr
  const allocatedBags = effectiveComercialBags + effectiveEspecialBags
  const bagsPending = Math.max(effectiveFullBags - allocatedBags, 0)
  const hasPackageOverAllocation = allocatedBags > effectiveFullBags
  const merma = gourmetMermaLb({ pergaminoUsedLb: pergaminoUsed, trilladoWeightLb: trilladoLb, roasts: roasts.map(toRoast), pesoTuesteResultLb, reservaCafeteriaLb: reservaLb, molidoWeightLb: molidoLb })

  const roastValidation = useMemo(() => {
    let allocated = 0
    const errors: Record<number, string> = {}
    for (const r of roasts) {
      const weight = Number(r.weightLb) || 0
      if (weight <= 0) continue
      if (weight > MAX_ROAST_LB) { errors[r.id] = `El máximo permitido por tueste es ${MAX_ROAST_LB} lb.`; continue }
      const pendingBefore = Math.max(trilladoLb - allocated, 0)
      if (weight > pendingBefore) { errors[r.id] = `Solo quedan ${pendingBefore.toFixed(2)} lb pendientes por asignar.`; continue }
      allocated += weight
    }
    return { allocated, remaining: Math.max(trilladoLb - allocated, 0), errors, hasErrors: Object.keys(errors).length > 0 }
  }, [roasts, trilladoLb])
  const roastFullyAllocated = !roastValidation.hasErrors && roastValidation.remaining <= 0 && roastedTotal > 0

  useEffect(() => {
    if (notFound) navigate('/produccion', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound])

  useEffect(() => {
    if (isFinalized && productionId) navigate(`/produccion/${productionId}`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinalized, productionId])

  if (notFound || isFinalized) return null

  const buildPatch = () => ({
    fecha,
    pergaminoUsedLb: pergaminoUsed,
    trilladoWeightLb: trilladoLb,
    roastType,
    roasts: roasts.map(toRoast),
    pesoTuesteResultLb,
    reservaCafeteriaLb: reservaLb,
    molidoWeightLb: molidoLb,
    actualFullBags: effectiveFullBags,
    actualRemainderGrams: effectiveRemainder,
    comercialBags: effectiveComercialBags,
    especialBags: effectiveEspecialBags,
    notas: '',
    currentStepName: GOURMET_STEPS[step],
  })

  const persistNow = async () => {
    if (submitting || !productionId) return
    setSubmitting(true)
    try {
      await updateGourmetProduction(productionId, buildPatch())
    } finally {
      setSubmitting(false)
    }
  }

  const handleStart = async () => {
    setPageError('')
    if (submitting) return
    const usedLb = Number(pergaminoUsedStr) || 0
    if (usedLb <= 0) { setPageError('Ingresa la cantidad de Pergamino que se usará en este lote.'); return }
    if (usedLb > pergaminoAvailable) { setPageError(`Solo hay ${pergaminoAvailable.toFixed(2)} lb de Pergamino disponibles en inventario.`); return }
    setSubmitting(true)
    try {
      const created = await startGourmetProduction({ fecha, pergaminoUsedLb: usedLb, notas: '' })
      setProductionId(created.id)
      navigate(`/produccion/gourmet/${created.id}/editar`, { replace: true })
      setStep(1)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo iniciar la producción.')
    } finally {
      setSubmitting(false)
    }
  }

  const validateStep = (current: GourmetStep): boolean => {
    setPageError('')
    if (current === 'Pergamino') {
      if (pergaminoUsed <= 0) { setPageError('Ingresa la cantidad de Pergamino que se usará en este lote.'); return false }
    }
    if (current === 'Trillado') {
      if (trilladoLb <= 0) { setPageError('Ingresa un peso válido después de trillado.'); return false }
      if (trilladoLb > pergaminoUsed) { setPageError(`No puede superar el Pergamino usado (${pergaminoUsed.toFixed(2)} lb).`); return false }
    }
    if (current === 'Tueste') {
      if (roastValidation.hasErrors) { setPageError('Corrige los pesos inválidos de los tuestes antes de continuar.'); return false }
      if (roastValidation.remaining > 0.001) { setPageError(`Todavía quedan ${roastValidation.remaining.toFixed(2)} lb pendientes de asignar a tuestes.`); return false }
      if (roastedTotal <= 0) { setPageError('Registra el peso de al menos un tueste.'); return false }
      if (pesoTuesteResultLb <= 0) { setPageError('Ingresa el peso después del tueste.'); return false }
      if (pesoTuesteResultLb > roastedTotal) { setPageError(`El peso después del tueste no puede superar las ${roastedTotal.toFixed(2)} lb que entraron al tostador.`); return false }
    }
    if (current === 'Reserva para cafetería') {
      if (reservaLb < 0) { setPageError('La reserva no puede ser negativa.'); return false }
      if (reservaLb > pesoTuesteResultLb) { setPageError(`La reserva no puede superar las ${pesoTuesteResultLb.toFixed(2)} lb obtenidas tras el tueste.`); return false }
    }
    if (current === 'Molido') {
      if (molidoLb <= 0) { setPageError('Ingresa un peso válido después de molido.'); return false }
      if (molidoLb > restanteParaMolido) { setPageError(`No puede superar las ${restanteParaMolido.toFixed(2)} lb disponibles tras la reserva.`); return false }
    }
    if (current === 'Empaque') {
      if (effectiveFullBags < 0 || effectiveRemainder < 0) { setPageError('Las bolsas y el sobrante no pueden ser negativos.'); return false }
      if (effectiveRemainder >= BAG_GRAMS) { setPageError(`El sobrante debe ser menor a ${BAG_GRAMS} g; si llega a ${BAG_GRAMS} g cuenta como una bolsa completa.`); return false }
      const empacadoLb = packagedWeightLb(effectiveFullBags, effectiveRemainder)
      if (empacadoLb > molidoLb + 0.01) { setPageError(`Las bolsas y el sobrante suman ${empacadoLb.toFixed(2)} lb, más que las ${molidoLb.toFixed(2)} lb molidas.`); return false }
      if (hasPackageOverAllocation) { setPageError(`Has distribuido ${allocatedBags} bolsas, pero el resultado real tiene ${effectiveFullBags} bolsas completas.`); return false }
      if (bagsPending > 0) { setPageError(`Todavía faltan ${bagsPending} bolsas completas por asignar a Comercial o Especial.`); return false }
    }
    return true
  }

  const goNext = async () => {
    setPageError('')
    if (!validateStep(GOURMET_STEPS[step])) return
    try {
      await persistNow()
      setStep(s => Math.min(GOURMET_STEPS.length - 1, s + 1))
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo guardar el lote.')
    }
  }
  const goPrev = async () => {
    setPageError('')
    try {
      await persistNow()
      setStep(s => Math.max(0, s - 1))
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo guardar el lote.')
    }
  }

  const handleFinalize = async () => {
    if (!validateStep('Empaque')) return
    if (!productionId || submitting) return
    setSubmitting(true)
    try {
      await updateGourmetProduction(productionId, buildPatch())
      await finalizeGourmetProduction(productionId)
      navigate(`/produccion/${productionId}`)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo finalizar la producción.')
    } finally {
      setSubmitting(false)
    }
  }

  const updateRoast = (rid: number, key: keyof RoastForm, value: string) => {
    setPageError('')
    setRoasts(prev => prev.map(r => r.id === rid ? { ...r, [key]: key === 'notes' ? value : (value === '' ? '' : Number(value)) } : r))
  }
  const addRoast = () => {
    setPageError('')
    if (roastValidation.hasErrors) { setPageError('Corrige el peso marcado en rojo antes de agregar otro tueste.'); return }
    if (roastValidation.remaining <= 0) { setPageError('El peso disponible ya fue asignado por completo.'); return }
    setRoasts(prev => [...prev, emptyRoast(prev.length + 1)])
  }
  const removeRoast = (rid: number) => {
    setRoasts(prev => prev.length === 1 ? prev : prev.filter(r => r.id !== rid).map((r, i) => ({ ...r, id: i + 1 })))
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Link to="/produccion" className="shrink-0 rounded-xl border border-stone-200 bg-white p-2.5"><ArrowLeft size={18} /></Link>
        <div className="min-w-0 flex-1">
          <h2 className="page-title">Producción Gourmet</h2>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-lg bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">Lote {existing?.code ?? <><span className="sm:hidden">nuevo</span><span className="hidden sm:inline">Se asigna al guardar</span></>}</span>
      </div>

      <WizardSteps steps={GOURMET_STEPS} current={step} />

      {pageError && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={19} /><span>{pageError}</span>
        </div>
      )}

      {GOURMET_STEPS[step] === 'Pergamino' && (
        <section className="card p-6">
          <SectionTitle title="1. Pergamino" subtitle="Café de primera que se usará como base de este lote de Gourmet." />
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Pergamino disponible en inventario" value={`${pergaminoAvailable.toFixed(2)} lb`} />
            <Stat label="Fecha del lote" value={formatISODate(fecha)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Fecha"><DatePickerField value={fecha} onChange={setFecha} /></Field>
            <Field label="Pergamino a usar (lb)"><input type="number" min="0" step="0.01" className="input disabled:bg-stone-100 disabled:text-stone-500" disabled={!isNewDraft} value={pergaminoUsedStr} onChange={e => { setPageError(''); setPergaminoUsedStr(e.target.value) }} /></Field>
          </div>
          {!isNewDraft && <p className="mt-2 text-xs text-stone-500">La cantidad de Pergamino se fija al iniciar el lote y ya no se puede cambiar.</p>}
          {isNewDraft && (
            <button className="btn-primary mt-5 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} onClick={handleStart}>
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <Coffee size={17} />} Confirmar e iniciar producción
            </button>
          )}
        </section>
      )}

      {GOURMET_STEPS[step] === 'Trillado' && (
        <section className="card p-6">
          <SectionTitle title="2. Trillado" subtitle="Peso registrado tras el proceso de trillado." />
          <div className="max-w-md">
            <Field label="Peso después de trillado (lb)">
              <input type="number" min="0" max={pergaminoUsed} step="0.01" className={`input ${trilladoLb > pergaminoUsed && pergaminoUsed > 0 ? '!border-red-400 !bg-red-50' : ''}`} value={trilladoWeight} onChange={e => { setPageError(''); setTrilladoWeight(e.target.value) }} />
            </Field>
            <p className="mt-2 text-sm text-stone-500">Pergamino usado: {pergaminoUsed.toFixed(2)} lb{trilladoLb > 0 ? ` · Merma: ${Math.max(pergaminoUsed - trilladoLb, 0).toFixed(2)} lb` : ''}</p>
          </div>
        </section>
      )}

      {GOURMET_STEPS[step] === 'Tueste' && (
        <section className="space-y-4">
          <div className="card p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Disponible para tostar" value={`${trilladoLb.toFixed(2)} lb`} />
              <Stat label="Asignado a tuestes" value={`${roastValidation.allocated.toFixed(2)} lb`} />
              <Stat label="Pendiente" value={`${roastValidation.remaining.toFixed(2)} lb`} />
            </div>
            {roastFullyAllocated && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">✓ Todo el café disponible ya fue asignado a tuestes. Total tostado: {roastedTotal.toFixed(2)} lb.</div>
            )}
          </div>

          <div className="card p-6">
            <Field label="Tipo de tueste">
              <select className="select max-w-xs" value={roastType} onChange={e => setRoastType(e.target.value as RoastType)}>
                {ROAST_TYPES.map(t => <option key={t} value={t}>{ROAST_TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
            <p className="mt-2 text-sm text-stone-500">El café que se reserve para cafetería se guarda por separado según este tipo de tueste.</p>
          </div>

          {roasts.map(r => {
            const err = roastValidation.errors[r.id]
            return (
              <div className="card p-6" key={r.id}>
                <div className="mb-5 flex items-center justify-between">
                  <div><h3 className="font-bold">Tueste No. {r.id}</h3><p className="text-sm text-stone-500">Máximo permitido: {MAX_ROAST_LB} lb por servicio.</p></div>
                  <button className="rounded-xl border border-stone-200 p-2 text-stone-500" onClick={() => removeRoast(r.id)}><Trash2 size={17} /></button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Peso (lb)">
                    <input type="number" max={MAX_ROAST_LB} min="0" step="0.01" className={`input ${err ? '!border-red-400 !bg-red-50' : ''}`} value={r.weightLb} onChange={e => updateRoast(r.id, 'weightLb', e.target.value)} />
                    {err && <span className="mt-1.5 block text-xs font-medium text-red-600">{err}</span>}
                  </Field>
                  <Field label="Notas"><input className="input" value={r.notes} onChange={e => updateRoast(r.id, 'notes', e.target.value)} /></Field>
                </div>
              </div>
            )
          })}

          <button className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" onClick={addRoast} disabled={roastValidation.hasErrors || roastValidation.remaining <= 0}>
            <Plus size={17} /> Agregar tueste
          </button>

          {roastFullyAllocated && (
            <div className="card p-6">
              <SectionTitle title="Peso después del tueste" subtitle="" />
              <div className="max-w-md">
                <Field label="Peso después del tueste (lb)">
                  <input type="number" min="0" max={roastedTotal} step="0.01" className={`input ${pesoTuesteResultLb > roastedTotal ? '!border-red-400 !bg-red-50' : ''}`} value={pesoTuesteResult} onChange={e => { setPageError(''); setPesoTuesteResult(e.target.value) }} />
                </Field>
                <p className="mt-2 text-sm text-stone-500">Peso que entró al tostador: {roastedTotal.toFixed(2)} lb{pesoTuesteResultLb > 0 ? ` · Merma: ${Math.max(roastedTotal - pesoTuesteResultLb, 0).toFixed(2)} lb` : ''}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {GOURMET_STEPS[step] === 'Reserva para cafetería' && (
        <section className="card p-6">
          <SectionTitle title="4. Reserva para cafetería" subtitle="Parte del café tostado puede separarse en grano para abastecer a la Cafeteria." />
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Peso después del tueste" value={`${pesoTuesteResultLb.toFixed(2)} lb`} />
            <Stat label="Tipo de tueste" value={ROAST_TYPE_LABELS[roastType]} />
            <Stat label="Continúa a molido" value={`${restanteParaMolido.toFixed(2)} lb`} />
          </div>
          <div className="max-w-md">
            <Field label="Libras en (Grano) a reservar para cafetería">
              <input type="number" min="0" max={pesoTuesteResultLb} step="0.01" className="input" value={reservaCafeteria} onChange={e => { setPageError(''); setReservaCafeteria(e.target.value) }} />
            </Field>
          </div>
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Estas libras pasarán al inventario de café en grano — Tueste {ROAST_TYPE_LABELS[roastType]} cuando se finalice el lote.</p>
        </section>
      )}

      {GOURMET_STEPS[step] === 'Molido' && (
        <section className="card p-6">
          <SectionTitle title="5. Molido" subtitle="Peso registrado tras el proceso de molido, listo para empaque." />
          <div className="max-w-md">
            <Field label="Peso después de molido (lb)">
              <input type="number" min="0" max={restanteParaMolido} step="0.01" className={`input ${molidoLb > restanteParaMolido && restanteParaMolido > 0 ? '!border-red-400 !bg-red-50' : ''}`} value={molidoWeight} onChange={e => { setPageError(''); setMolidoWeight(e.target.value) }} />
            </Field>
            <p className="mt-2 text-sm text-stone-500">Disponible tras reserva: {restanteParaMolido.toFixed(2)} lb</p>
          </div>
        </section>
      )}

      {GOURMET_STEPS[step] === 'Empaque' && (
        <section className="space-y-4">
          <div className="card p-6">
            <SectionTitle title="6. Empaque" subtitle="Resultado del sistema a partir del peso molido." />
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <Stat label="Peso final en gramos" value={`${suggestedPackaging.grams.toFixed(1)} g`} />
              <Stat label="Bolsas estimadas" value={`${suggestedPackaging.fullBags} bolsas`} />
              <Stat label="Sobrante estimado" value={`${suggestedPackaging.remainderGrams.toFixed(1)} g`} />
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h4 className="font-bold text-stone-900">Resultado real del empaque</h4>
              <p className="mt-1 text-sm text-stone-600">Puedes corregir estos valores si el resultado físico fue diferente al cálculo sugerido.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Bolsas completas (350 g)"><input type="number" min="0" step="1" className="input" placeholder={String(suggestedPackaging.fullBags)} value={actualFullBags} onChange={e => { setPageError(''); setActualFullBags(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0))) }} /></Field>
                <Field label="Sobrante (g)"><input type="number" min="0" max="349.99" step="0.1" className={`input ${effectiveRemainder >= BAG_GRAMS ? '!border-red-400 !bg-red-50' : ''}`} placeholder={suggestedPackaging.remainderGrams.toFixed(1)} value={actualRemainderGrams} onChange={e => { setPageError(''); setActualRemainderGrams(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0)) }} /></Field>
              </div>
              <p className="mt-3 text-sm text-stone-700"><b>Resultado registrado:</b> {effectiveFullBags} bolsas completas{effectiveRemainder > 0 ? ` + sobrante de ${effectiveRemainder.toFixed(1)} g` : ''}.</p>
            </div>
          </div>

          <div className="card p-6">
            <SectionTitle title="Distribución por tipo de bolsa" subtitle="Comercial y Especial no son productos distintos — es el mismo café Gourmet; distribuye las bolsas completas entre los dos tipos de empaque." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bolsas Comercial"><input type="number" min="0" step="1" className="input" value={comercialBagsStr} placeholder="0" onChange={e => { setPageError(''); setComercialBagsStr(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0))) }} /></Field>
              <Field label="Bolsas Especial"><input type="number" min="0" step="1" className="input" value={especialBagsStr} placeholder="0" onChange={e => { setPageError(''); setEspecialBagsStr(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0))) }} /></Field>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat label="Bolsas completas" value={`${effectiveFullBags}`} />
              <Stat label="Distribuidas" value={`${allocatedBags}`} />
              <Stat label={hasPackageOverAllocation ? 'Exceso' : 'Pendientes'} value={`${hasPackageOverAllocation ? allocatedBags - effectiveFullBags : bagsPending}`} />
            </div>
            {hasPackageOverAllocation && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">La distribución supera las {effectiveFullBags} bolsas completas registradas.</p>}
            {!hasPackageOverAllocation && bagsPending === 0 && effectiveFullBags > 0 && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">✓ Todas las bolsas completas fueron asignadas a Comercial o Especial.</p>}
          </div>
        </section>
      )}

      {GOURMET_STEPS[step] === 'Resumen' && (
        <section className="card p-6">
          <SectionTitle title="7. Resumen del lote" subtitle="Revisa los datos antes de finalizar. Al finalizar se actualiza el inventario." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pergamino usado" value={`${pergaminoUsed.toFixed(2)} lb`} />
            <Stat label="Después de trillado" value={`${trilladoLb.toFixed(2)} lb`} />
            <Stat label="Tipo de tueste" value={ROAST_TYPE_LABELS[roastType]} />
            <Stat label="Peso después del tueste" value={`${pesoTuesteResultLb.toFixed(2)} lb`} />
            <Stat label="Reserva cafetería" value={`${reservaLb.toFixed(2)} lb`} />
            <Stat label="Después de molido" value={`${molidoLb.toFixed(2)} lb`} />
            <Stat label="Bolsas completas" value={`${effectiveFullBags}`} />
            <Stat label="Comercial" value={`${effectiveComercialBags} bolsas`} />
            <Stat label="Especial" value={`${effectiveEspecialBags} bolsas`} />
            <Stat label="Fecha" value={formatISODate(fecha)} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Merma en trillado" value={`${merma.mermaTrillado.toFixed(2)} lb`} />
            <Stat label="Merma en tueste" value={`${merma.mermaTueste.toFixed(2)} lb`} />
            <Stat label="Merma en molido" value={`${merma.mermaMolido.toFixed(2)} lb`} />
            <Stat label="Merma total" value={`${merma.total.toFixed(2)} lb`} />
          </div>
          <button className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} onClick={handleFinalize}>
            {submitting && <Loader2 size={16} className="animate-spin" />} Finalizar producción
          </button>
        </section>
      )}

      <WizardNav>
        <button className="btn-secondary disabled:opacity-40" disabled={step === 0 || submitting} onClick={goPrev}>Anterior</button>
        <button className="btn-secondary disabled:opacity-40" disabled={step === GOURMET_STEPS.length - 1 || (isNewDraft && step === 0) || submitting} onClick={goNext}>Siguiente</button>
      </WizardNav>
    </div>
  )
}

