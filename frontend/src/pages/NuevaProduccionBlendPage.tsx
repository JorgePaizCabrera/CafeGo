import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Blend, Loader2, Plus, Trash2 } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BAG_GRAMS, MAX_ROAST_LB, packagedWeightLb, packagingFromLb } from '../utils/production'
import { formatISODate, todayISODate } from '../utils/dates'
import { BLEND_STEPS, RAW_MATERIAL_LABELS, blendMermaLb, roastedAllocatedLb, type BlendStep, type RoastBatch, type SegundaType } from '../types/production'
import {
  finalizeBlendProduction,
  startBlendProduction,
  updateBlendProduction,
  useBlendProduction,
  useProductionsLoaded,
  validateBlendPlan,
} from '../store/productionStore'
import { useEmpaqueStock, useInventory } from '../store/inventoryStore'
import DatePickerField from '../components/DatePickerField'
import { Field, SectionTitle, Stat } from '../components/FormParts'
import PageLoader from '../components/ui/PageLoader'
import WizardSteps, { WizardNav } from '../components/ui/WizardSteps'

type RoastForm = { id: number, weightLb: number | '', notes: string }
const emptyRoast = (id: number): RoastForm => ({ id, weightLb: '', notes: '' })
const toRoast = (r: RoastForm): RoastBatch => ({ id: r.id, weightLb: Number(r.weightLb) || 0, notes: r.notes })

export default function NuevaProduccionBlendPage() {
  const { id } = useParams<{ id?: string }>()
  const productionsReady = useProductionsLoaded()
  if (id && !productionsReady) return <PageLoader />
  return <BlendForm id={id} />
}

function BlendForm({ id }: { id?: string }) {
  const navigate = useNavigate()
  useInventory()
  const existing = useBlendProduction(id)
  const notFound = Boolean(id && !existing)
  const isFinalized = existing?.status === 'terminada'

  const [productionId, setProductionId] = useState<string | null>(existing?.id ?? null)
  const [step, setStep] = useState(() => {
    if (!existing) return 0
    const idx = BLEND_STEPS.indexOf(existing.currentStepName)
    return idx >= 0 ? idx : 0
  })
  const [pageError, setPageError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const isNewDraft = !productionId

  const [fecha, setFecha] = useState(() => existing?.fecha ?? todayISODate())
  const [cantidadStr, setCantidadStr] = useState(() => existing ? String(existing.cantidadPlanificadaLb) : '')
  const [segundaType, setSegundaType] = useState<SegundaType>(() => existing?.segundaType ?? 'oro')

  const [trilladoWeight, setTrilladoWeight] = useState(() => existing?.trilladoWeightLb ? String(existing.trilladoWeightLb) : '')
  const [roasts, setRoasts] = useState<RoastForm[]>(() => existing && existing.roasts.length ? existing.roasts : [emptyRoast(1)])
  const [pesoTuesteResult, setPesoTuesteResult] = useState(() => existing?.pesoTuesteResultLb ? String(existing.pesoTuesteResultLb) : '')
  const [molidoMezclaWeight, setMolidoMezclaWeight] = useState(() => existing?.molidoMezclaWeightLb ? String(existing.molidoMezclaWeightLb) : '')
  const [actualFullBags, setActualFullBags] = useState<number | ''>(() => existing?.actualFullBags ?? '')
  const [actualRemainderGrams, setActualRemainderGrams] = useState<number | ''>(() => existing?.actualRemainderGrams ?? '')
  const bolsasBlendDisponibles = useEmpaqueStock().find(e => e.tipo === 'blend')?.cantidad ?? 0

  const cantidadLb = Number(cantidadStr) || 0
  const plan = useMemo(() => validateBlendPlan(cantidadLb, segundaType), [cantidadLb, segundaType])

  const pergaminoUsed = plan.pergaminoLb
  const segundaUsed = plan.segundaLb
  const totalRawInput = pergaminoUsed + segundaUsed
  const trilladoLb = Number(trilladoWeight) || 0
  const roastedTotal = useMemo(() => roastedAllocatedLb(roasts.map(toRoast)), [roasts])
  const pesoTuesteResultLb = Number(pesoTuesteResult) || 0
  const molidoMezclaLb = Number(molidoMezclaWeight) || 0
  const suggestedPackaging = useMemo(() => packagingFromLb(molidoMezclaLb), [molidoMezclaLb])

  const lastSynced = useRef<{ fullBags: number, remainderGrams: number } | null>(null)
  useEffect(() => {
    const roundedRemainder = Number(suggestedPackaging.remainderGrams.toFixed(1))
    const untouchedFullBags = actualFullBags === '' || (lastSynced.current !== null && Number(actualFullBags) === lastSynced.current.fullBags)
    const untouchedRemainder = actualRemainderGrams === '' || (lastSynced.current !== null && Number(actualRemainderGrams) === lastSynced.current.remainderGrams)
    if (untouchedFullBags) setActualFullBags(suggestedPackaging.fullBags)
    if (untouchedRemainder) setActualRemainderGrams(roundedRemainder)
    lastSynced.current = { fullBags: suggestedPackaging.fullBags, remainderGrams: roundedRemainder }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedPackaging.fullBags, suggestedPackaging.remainderGrams])

  const effectiveFullBags = actualFullBags === '' ? suggestedPackaging.fullBags : Number(actualFullBags)
  const effectiveRemainder = actualRemainderGrams === '' ? suggestedPackaging.remainderGrams : Number(actualRemainderGrams)
  const merma = blendMermaLb({ pergaminoUsedLb: pergaminoUsed, segundaUsedLb: segundaUsed, trilladoWeightLb: trilladoLb, roasts: roasts.map(toRoast), pesoTuesteResultLb, molidoMezclaWeightLb: molidoMezclaLb })

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
    cantidadPlanificadaLb: cantidadLb,
    segundaType,
    pergaminoUsedLb: pergaminoUsed,
    segundaUsedLb: segundaUsed,
    trilladoWeightLb: trilladoLb,
    roasts: roasts.map(toRoast),
    pesoTuesteResultLb,
    molidoMezclaWeightLb: molidoMezclaLb,
    actualFullBags: effectiveFullBags,
    actualRemainderGrams: effectiveRemainder,
    notas: '',
    currentStepName: BLEND_STEPS[step],
  })

  const persistNow = async () => {
    if (submitting || !productionId) return
    setSubmitting(true)
    try {
      await updateBlendProduction(productionId, buildPatch())
    } finally {
      setSubmitting(false)
    }
  }

  const handleStart = async () => {
    setPageError('')
    if (submitting) return
    if (!plan.isValid) {
      setPageError(cantidadLb <= 0
        ? 'Ingresa la cantidad de Blend que deseas producir.'
        : `Inventario insuficiente. Faltan ${plan.pergaminoFaltante.toFixed(2)} lb de Pergamino y ${plan.segundaFaltante.toFixed(2)} lb de ${RAW_MATERIAL_LABELS[segundaType]}.`)
      return
    }
    setSubmitting(true)
    try {
      const created = await startBlendProduction({ fecha, cantidadPlanificadaLb: cantidadLb, segundaType, notas: '' })
      setProductionId(created.id)
      navigate(`/produccion/blend/${created.id}/editar`, { replace: true })
      setStep(1)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo iniciar la producción.')
    } finally {
      setSubmitting(false)
    }
  }

  const validateStep = (current: BlendStep): boolean => {
    setPageError('')
    if (current === 'Trillado') {
      if (trilladoLb <= 0) { setPageError('Ingresa un peso válido después de trillado.'); return false }
      if (trilladoLb > totalRawInput) { setPageError(`No puede superar la materia prima usada (${totalRawInput.toFixed(2)} lb).`); return false }
    }
    if (current === 'Tueste') {
      if (roastValidation.hasErrors) { setPageError('Corrige los pesos inválidos de los tuestes antes de continuar.'); return false }
      if (roastValidation.remaining > 0.001) { setPageError(`Todavía quedan ${roastValidation.remaining.toFixed(2)} lb pendientes de asignar a tuestes.`); return false }
      if (roastedTotal <= 0) { setPageError('Registra el peso de al menos un tueste.'); return false }
      if (pesoTuesteResultLb <= 0) { setPageError('Ingresa el peso después del tueste.'); return false }
      if (pesoTuesteResultLb > roastedTotal) { setPageError(`El peso después del tueste no puede superar las ${roastedTotal.toFixed(2)} lb que entraron al tostador.`); return false }
    }
    if (current === 'Molido y mezcla') {
      if (molidoMezclaLb <= 0) { setPageError('Ingresa el peso real obtenido tras moler y mezclar.'); return false }
      if (molidoMezclaLb > pesoTuesteResultLb) { setPageError(`No puede superar las ${pesoTuesteResultLb.toFixed(2)} lb obtenidas tras el tueste.`); return false }
    }
    if (current === 'Empaque') {
      if (effectiveFullBags < 0 || effectiveRemainder < 0) { setPageError('Las bolsas y el sobrante no pueden ser negativos.'); return false }
      if (effectiveRemainder >= BAG_GRAMS) { setPageError(`El sobrante debe ser menor a ${BAG_GRAMS} g; si llega a ${BAG_GRAMS} g cuenta como una bolsa completa.`); return false }
      const empacadoLb = packagedWeightLb(effectiveFullBags, effectiveRemainder)
      if (empacadoLb > molidoMezclaLb + 0.01) { setPageError(`Las bolsas y el sobrante suman ${empacadoLb.toFixed(2)} lb, más que las ${molidoMezclaLb.toFixed(2)} lb molidas y mezcladas.`); return false }
    }
    return true
  }

  const goNext = async () => {
    setPageError('')
    if (!validateStep(BLEND_STEPS[step])) return
    try {
      await persistNow()
      setStep(s => Math.min(BLEND_STEPS.length - 1, s + 1))
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
      await updateBlendProduction(productionId, buildPatch())
      await finalizeBlendProduction(productionId)
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
          <h2 className="page-title">Producción Blend</h2>
          <p className="text-sm text-stone-500">35% Pergamino + 65% Oro o Natural</p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-lg bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">Lote {existing?.code ?? <><span className="sm:hidden">nuevo</span><span className="hidden sm:inline">Se asigna al guardar</span></>}</span>
      </div>

      <WizardSteps steps={BLEND_STEPS} current={step} />

      {pageError && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={19} /><span>{pageError}</span>
        </div>
      )}

      {BLEND_STEPS[step] === 'Planificación' && (
        <section className="card p-6">
          <SectionTitle title="1. Planificación del Blend" subtitle="Indica cuánto Blend deseas producir; el sistema calcula la materia prima necesaria según la fórmula fija (35% / 65%)." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Fecha"><DatePickerField value={fecha} onChange={setFecha} /></Field>
            <Field label="Cantidad de Blend deseada (lb)"><input type="number" min="0" step="0.01" className="input disabled:bg-stone-100 disabled:text-stone-500" disabled={!isNewDraft} value={cantidadStr} onChange={e => { setPageError(''); setCantidadStr(e.target.value) }} /></Field>
            <Field label="Café de segunda">
              <select className="select disabled:bg-stone-100 disabled:text-stone-500" disabled={!isNewDraft} value={segundaType} onChange={e => setSegundaType(e.target.value as SegundaType)}>
                <option value="oro">Oro</option>
                <option value="natural">Natural</option>
              </select>
            </Field>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pergamino necesario (35%)" value={`${pergaminoUsed.toFixed(2)} lb`} />
            <Stat label={`${RAW_MATERIAL_LABELS[segundaType]} necesario (65%)`} value={`${segundaUsed.toFixed(2)} lb`} />
            <Stat label="Pergamino disponible" value={`${plan.pergaminoAvailable.toFixed(2)} lb`} />
            <Stat label={`${RAW_MATERIAL_LABELS[segundaType]} disponible`} value={`${plan.segundaAvailable.toFixed(2)} lb`} />
          </div>

          {cantidadLb > 0 && !plan.isValid && (
            <div className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <AlertTriangle className="mt-0.5 shrink-0" size={19} />
              <span>
                Inventario insuficiente para este plan.
                {plan.pergaminoFaltante > 0 && ` Faltan ${plan.pergaminoFaltante.toFixed(2)} lb de Pergamino.`}
                {plan.segundaFaltante > 0 && ` Faltan ${plan.segundaFaltante.toFixed(2)} lb de ${RAW_MATERIAL_LABELS[segundaType]}.`}
              </span>
            </div>
          )}
          {cantidadLb > 0 && plan.isValid && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">✓ Hay inventario suficiente para producir este plan.</div>
          )}

          {!isNewDraft && <p className="mt-3 text-xs text-stone-500">La cantidad y el café de segunda se fijan al iniciar el lote y ya no se pueden cambiar.</p>}

          {isNewDraft && (
            <button className="btn-primary mt-5 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} onClick={handleStart}>
              {submitting ? <Loader2 size={17} className="animate-spin" /> : <Blend size={17} />} Confirmar e iniciar producción
            </button>
          )}
        </section>
      )}

      {BLEND_STEPS[step] === 'Trillado' && (
        <section className="card p-6">
          <SectionTitle title="2. Trillado" subtitle="Peso registrado tras el proceso de trillado de la materia prima combinada." />
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Pergamino usado" value={`${pergaminoUsed.toFixed(2)} lb`} />
            <Stat label={`${RAW_MATERIAL_LABELS[segundaType]} usado`} value={`${segundaUsed.toFixed(2)} lb`} />
          </div>
          <div className="max-w-md">
            <Field label="Peso después de trillado (lb)">
              <input type="number" min="0" max={totalRawInput} step="0.01" className={`input ${trilladoLb > totalRawInput && totalRawInput > 0 ? '!border-red-400 !bg-red-50' : ''}`} value={trilladoWeight} onChange={e => { setPageError(''); setTrilladoWeight(e.target.value) }} />
            </Field>
            <p className="mt-2 text-sm text-stone-500">Materia prima total: {totalRawInput.toFixed(2)} lb</p>
          </div>
        </section>
      )}

      {BLEND_STEPS[step] === 'Tueste' && (
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
              <SectionTitle title="Peso después del tueste" subtitle="Peso real obtenido una vez terminado el tueste" />
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

      {BLEND_STEPS[step] === 'Molido y mezcla' && (
        <section className="card p-6">
          <SectionTitle title="4. Molido y mezcla" subtitle="En esta etapa se incorporan el Pergamino tostado y el café de segunda tostado. Registra el peso real final." />
          <div className="mb-4">
            <Stat label="Peso después del tueste" value={`${pesoTuesteResultLb.toFixed(2)} lb`} />
          </div>
          <div className="max-w-md">
            <Field label="Peso real tras moler y mezclar (lb)">
              <input type="number" min="0" max={pesoTuesteResultLb} step="0.01" className={`input ${molidoMezclaLb > pesoTuesteResultLb && pesoTuesteResultLb > 0 ? '!border-red-400 !bg-red-50' : ''}`} value={molidoMezclaWeight} onChange={e => { setPageError(''); setMolidoMezclaWeight(e.target.value) }} />
            </Field>
            <p className="mt-2 text-sm text-stone-500">Total disponible tras tueste: {pesoTuesteResultLb.toFixed(2)} lb</p>
          </div>
        </section>
      )}

      {BLEND_STEPS[step] === 'Empaque' && (
        <section className="card p-6">
          <SectionTitle title="5. Empaque" subtitle="Presentación fija de 350 g por bolsa. El cálculo se actualiza con el peso real obtenido." />
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Peso final en gramos" value={`${suggestedPackaging.grams.toFixed(1)} g`} />
            <Stat label="Bolsas estimadas" value={`${suggestedPackaging.fullBags} bolsas`} />
            <Stat label="Sobrante estimado" value={`${suggestedPackaging.remainderGrams.toFixed(1)} g`} />
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h4 className="font-bold text-stone-900">Resultado real del empaque</h4>
            <p className="mt-1 text-sm text-stone-600">Corrige estos valores si el resultado físico fue diferente al cálculo sugerido.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Bolsas completas (350 g)"><input type="number" min="0" step="1" className="input" placeholder={String(suggestedPackaging.fullBags)} value={actualFullBags} onChange={e => { setPageError(''); setActualFullBags(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0))) }} /></Field>
              <Field label="Sobrante (g)"><input type="number" min="0" max="349.99" step="0.1" className={`input ${effectiveRemainder >= BAG_GRAMS ? '!border-red-400 !bg-red-50' : ''}`} placeholder={suggestedPackaging.remainderGrams.toFixed(1)} value={actualRemainderGrams} onChange={e => { setPageError(''); setActualRemainderGrams(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0)) }} /></Field>
            </div>
            <p className="mt-3 text-sm text-stone-700"><b>Resultado registrado:</b> {effectiveFullBags} bolsas completas{effectiveRemainder > 0 ? ` + sobrante de ${effectiveRemainder.toFixed(1)} g` : ''}.</p>
          </div>

          <p className={`mt-5 rounded-xl p-3 text-sm ${effectiveFullBags > bolsasBlendDisponibles ? 'border border-red-200 bg-red-50 font-medium text-red-700' : 'bg-stone-100 text-stone-600'}`}>
            Al finalizar se descontarán <b>{effectiveFullBags}</b> bolsas de Blend del inventario de empaque (hay <b>{bolsasBlendDisponibles}</b> en bodega).
            {effectiveFullBags > bolsasBlendDisponibles && ' No alcanzan: registra la compra en Inventario → Empaque antes de finalizar.'}
          </p>
        </section>
      )}

      {BLEND_STEPS[step] === 'Resumen' && (
        <section className="card p-6">
          <SectionTitle title="6. Resumen del lote" subtitle="Revisa los datos antes de finalizar. Al finalizar se suma al inventario de producto terminado." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Pergamino usado" value={`${pergaminoUsed.toFixed(2)} lb`} />
            <Stat label={`${RAW_MATERIAL_LABELS[segundaType]} usado`} value={`${segundaUsed.toFixed(2)} lb`} />
            <Stat label="Después de trillado" value={`${trilladoLb.toFixed(2)} lb`} />
            <Stat label="Peso después del tueste" value={`${pesoTuesteResultLb.toFixed(2)} lb`} />
            <Stat label="Molido y mezcla" value={`${molidoMezclaLb.toFixed(2)} lb`} />
            <Stat label="Bolsas completas" value={`${effectiveFullBags}`} />
            <Stat label="Sobrante" value={`${effectiveRemainder.toFixed(1)} g`} />
            <Stat label="Fecha" value={formatISODate(fecha)} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Merma en trillado" value={`${merma.mermaTrillado.toFixed(2)} lb`} />
            <Stat label="Merma en tueste" value={`${merma.mermaTueste.toFixed(2)} lb`} />
            <Stat label="Merma en molido y mezcla" value={`${merma.mermaMolido.toFixed(2)} lb`} />
            <Stat label="Merma total" value={`${merma.total.toFixed(2)} lb`} />
          </div>
          <button className="btn-primary mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} onClick={handleFinalize}>
            {submitting && <Loader2 size={16} className="animate-spin" />} Finalizar producción
          </button>
        </section>
      )}

      <WizardNav>
        <button className="btn-secondary disabled:opacity-40" disabled={step === 0 || submitting} onClick={goPrev}>Anterior</button>
        <button className="btn-secondary disabled:opacity-40" disabled={step === BLEND_STEPS.length - 1 || (isNewDraft && step === 0) || submitting} onClick={goNext}>Siguiente</button>
      </WizardNav>
    </div>
  )
}

