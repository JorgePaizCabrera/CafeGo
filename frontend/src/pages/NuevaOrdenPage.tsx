import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Loader2, MapPin, Phone, Plus, Trash2, UserRound } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BAG_GRAMS, LB_TO_GRAMS, MAX_ROAST_LB, packagingFromLb } from '../utils/production'
import { COFFEE_TYPE_LABELS, PACKAGE_TYPES, coffeeTypeHasCleaningStep, orderMermaLb, statusForCompletedStep, type CoffeeType, type Order, type PackageAllocation, type PackageType, type Roast } from '../types/order'
import { createOrder, deleteOrder, finalizeOrder, updateOrder, useOrder, useOrdersLoaded } from '../store/ordersStore'
import { useClient, useClientsLoaded } from '../store/clientsStore'
import OrderSummary from '../components/OrderSummary'
import DatePickerField from '../components/DatePickerField'
import { Field, SectionTitle, Stat } from '../components/FormParts'
import PageLoader from '../components/ui/PageLoader'
import WizardSteps, { WizardNav } from '../components/ui/WizardSteps'
import { confirmDialog, toast } from '../components/ui/feedback'
import SeguimientoWhatsAppModal, { useOfertaSeguimiento, type OfrecerSeguimientoState } from '../components/SeguimientoWhatsAppModal'

const STEPS_WITHOUT_CLEANING = ['Recepción', 'Trillado', 'Tuestes', 'Postproceso', 'Empaque', 'Resumen']
const STEPS_WITH_CLEANING = ['Recepción', 'Limpieza', 'Trillado', 'Tuestes', 'Postproceso', 'Empaque', 'Resumen']

type RoastForm = {
  id: number
  weightLb: number | ''
  initialTemp: number | ''
  returnTemp: number | ''
  returnTime: string
  dehydrationTemp: number | ''
  dehydrationTime: string
  caramelizationTemp: number | ''
  caramelizationTime: string
  crackTemp: number | ''
  crackTime: string
  finalTemp: number | ''
  finalTime: string
  notes: string
}

const emptyRoast = (id: number): RoastForm => ({
  id,
  weightLb: '',
  initialTemp: '',
  returnTemp: '',
  returnTime: '',
  dehydrationTemp: '',
  dehydrationTime: '',
  caramelizationTemp: '',
  caramelizationTime: '',
  crackTemp: '',
  crackTime: '',
  finalTemp: '',
  finalTime: '',
  notes: '',
})

function toRoast(r: RoastForm): Roast {
  return {
    id: r.id,
    weightLb: Number(r.weightLb) || 0,
    initialTemp: Number(r.initialTemp) || 0,
    returnTemp: Number(r.returnTemp) || 0,
    returnTime: r.returnTime,
    dehydrationTemp: Number(r.dehydrationTemp) || 0,
    dehydrationTime: r.dehydrationTime,
    caramelizationTemp: Number(r.caramelizationTemp) || 0,
    caramelizationTime: r.caramelizationTime,
    crackTemp: Number(r.crackTemp) || 0,
    crackTime: r.crackTime,
    finalTemp: Number(r.finalTemp) || 0,
    finalTime: r.finalTime,
    notes: r.notes,
  }
}

const emptyAllocation = (): PackageAllocation => ({
  transparente: 0,
  laminada: 0,
  'trilaminada sin válvula': 0,
  'trilaminada con válvula': 0,
  'kraft sin válvula': 0,
  'kraft con válvula': 0,
})

export default function NuevaOrdenPage() {
  const { clientId, id } = useParams<{ clientId?: string, id?: string }>()
  const ordersReady = useOrdersLoaded()
  const clientsReady = useClientsLoaded()
  if ((id && !ordersReady) || !clientsReady) return <PageLoader />
  return <OrderForm clientId={clientId} id={id} />
}

function OrderForm({ clientId, id }: { clientId?: string, id?: string }) {
  const navigate = useNavigate()
  const existingOrder = useOrder(id)
  const seguimiento = useOfertaSeguimiento(existingOrder)
  const isEditing = Boolean(id)
  // Una orden finalizada ya aplicó sus movimientos de inventario: no se edita, solo se consulta en su detalle.
  const isFinalized = existingOrder?.status === 'Finalizado'
  // Los valores de empaque guardados solo se respetan si la orden ya pasó por ese paso.
  const empaqueAlreadyVisited = (() => {
    if (!existingOrder) return false
    const stepsForType = coffeeTypeHasCleaningStep(existingOrder.coffeeType) ? STEPS_WITH_CLEANING : STEPS_WITHOUT_CLEANING
    return stepsForType.indexOf(existingOrder.currentStepName) >= stepsForType.indexOf('Empaque')
  })()
  const resolvedClientId = existingOrder?.clientId ?? clientId
  const client = useClient(resolvedClientId)

  const [orderId, setOrderId] = useState<string | null>(() => existingOrder?.id ?? null)
  const [step, setStep] = useState(() => {
    if (!existingOrder) return 0
    const stepsForType = coffeeTypeHasCleaningStep(existingOrder.coffeeType) ? STEPS_WITH_CLEANING : STEPS_WITHOUT_CLEANING
    const idx = stepsForType.indexOf(existingOrder.currentStepName)
    return idx >= 0 ? idx : 0
  })
  const [pageError, setPageError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [coffeeType, setCoffeeType] = useState<CoffeeType>(() => existingOrder?.coffeeType ?? 'pergamino')
  const steps = useMemo(() => coffeeTypeHasCleaningStep(coffeeType) ? STEPS_WITH_CLEANING : STEPS_WITHOUT_CLEANING, [coffeeType])
  const [receivedDate, setReceivedDate] = useState(() => existingOrder?.receivedDate ?? '')
  const [estimatedDate, setEstimatedDate] = useState(() => existingOrder?.estimatedDate ?? '')
  const [initialWeightStr, setInitialWeightStr] = useState(() => existingOrder ? String(existingOrder.initialWeight) : '')
  const [humidityStr, setHumidityStr] = useState(() => existingOrder?.humidity ? String(existingOrder.humidity) : '')
  const [cleaningWeight, setCleaningWeight] = useState(() => existingOrder?.cleaningWeight ? String(existingOrder.cleaningWeight) : '')
  const [threshingWeight, setThreshingWeight] = useState(() => existingOrder?.threshingWeight ? String(existingOrder.threshingWeight) : '')
  const [roasts, setRoasts] = useState<RoastForm[]>(() => existingOrder && existingOrder.roasts.length ? existingOrder.roasts : [emptyRoast(1)])
  const [finalWeight, setFinalWeight] = useState(() => existingOrder?.finalWeight ? String(existingOrder.finalWeight) : '')
  const [roastType, setRoastType] = useState(() => existingOrder?.roastType ?? 'medio')
  const [grindType, setGrindType] = useState(() => existingOrder?.grindType ?? 'media')
  const [totalPrice, setTotalPrice] = useState(() => existingOrder?.totalPrice ? String(existingOrder.totalPrice) : '')
  const [bagSizeGramsStr, setBagSizeGramsStr] = useState(() => String(existingOrder?.bagSizeGrams ?? BAG_GRAMS))
  const bagSizeGrams = Number(bagSizeGramsStr) || BAG_GRAMS

  const suggestedPackaging = useMemo(() => packagingFromLb(Number(finalWeight) || 0, bagSizeGrams), [finalWeight, bagSizeGrams])
  const [actualFullBags, setActualFullBags] = useState<number | ''>(() => (existingOrder && empaqueAlreadyVisited) ? existingOrder.actualFullBags : '')
  const [actualRemainderGrams, setActualRemainderGrams] = useState<number | ''>(() => (existingOrder && empaqueAlreadyVisited) ? existingOrder.actualRemainderGrams : '')
  const [packageAllocation, setPackageAllocation] = useState<PackageAllocation>(() => existingOrder?.packageAllocation ?? emptyAllocation())
  const [incompletePackageType, setIncompletePackageType] = useState<PackageType>(() => existingOrder?.incompletePackageType ?? 'transparente')

  const initialWeight = Number(initialWeightStr) || 0
  const cleaningLb = Number(cleaningWeight) || 0
  const availableLb = Number(threshingWeight) || 0
  const previousTrilladoWeight = coffeeTypeHasCleaningStep(coffeeType) ? cleaningLb : initialWeight
  const finalLb = Number(finalWeight) || 0
  const merma = orderMermaLb({ coffeeType, initialWeight, cleaningWeight: cleaningLb, threshingWeight: availableLb, finalWeight: finalLb })

  const roastValidation = useMemo(() => {
    let allocated = 0
    const errors: Record<number, string> = {}

    for (const roast of roasts) {
      const weight = Number(roast.weightLb) || 0
      if (weight <= 0) continue

      if (weight > MAX_ROAST_LB) {
        errors[roast.id] = `El máximo permitido por tueste es ${MAX_ROAST_LB} lb.`
        continue
      }

      const pendingBefore = Math.max(availableLb - allocated, 0)
      if (weight > pendingBefore) {
        errors[roast.id] = `Solo quedan ${pendingBefore.toFixed(2)} lb pendientes por asignar.`
        continue
      }

      allocated += weight
    }

    return {
      allocated,
      remaining: Math.max(availableLb - allocated, 0),
      errors,
      hasErrors: Object.keys(errors).length > 0,
    }
  }, [roasts, availableLb])

  const effectiveFullBags = actualFullBags === '' ? suggestedPackaging.fullBags : Number(actualFullBags)
  const effectiveRemainder = actualRemainderGrams === '' ? suggestedPackaging.remainderGrams : Number(actualRemainderGrams)
  const allocatedBags = Object.values(packageAllocation).reduce((sum, qty) => sum + (Number(qty) || 0), 0)
  const bagsPending = Math.max(effectiveFullBags - allocatedBags, 0)
  const hasPackageOverAllocation = allocatedBags > effectiveFullBags
  const hasIncompleteBag = effectiveRemainder > 0

  const notFound = Boolean(id && !existingOrder) || Boolean(!isEditing && clientId && !client)

  useEffect(() => {
    if (notFound) navigate('/clientes', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound])

  useEffect(() => {
    if (isFinalized && orderId) navigate(`/clientes/ordenes/${orderId}`, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinalized, orderId])

  if (notFound || isFinalized || !client) return null

  const buildOrderPayload = () => ({
    clientId: client.id,
    clientName: client.name,
    phone: client.phone,
    city: client.city,
    receivedDate,
    estimatedDate,
    coffeeType,
    initialWeight,
    humidity: Number(humidityStr) || 0,
    cleaningWeight: cleaningLb,
    threshingWeight: availableLb,
    roasts: roasts.map(toRoast),
    finalWeight: Number(finalWeight) || 0,
    roastType,
    grindType,
    totalPrice: Number(totalPrice) || 0,
    bagSizeGrams,
    actualFullBags: effectiveFullBags,
    actualRemainderGrams: effectiveRemainder,
    packageAllocation,
    incompletePackageType,
    currentStepName: steps[step],
  })

  const buildPreviewOrder = (): Order => ({
    ...buildOrderPayload(),
    id: orderId ?? '',
    orderNo: existingOrder?.orderNo ?? 'Se asigna al guardar',
    status: statusForCompletedStep(steps[step]),
    pagado: existingOrder?.pagado ?? false,
    pagadoAt: existingOrder?.pagadoAt ?? null,
    createdAt: '',
    updatedAt: '',
    finalizedAt: null,
    seguimientoToken: existingOrder?.seguimientoToken ?? '',
    seguimientoActivo: existingOrder?.seguimientoActivo ?? false,
  })

  const persistNow = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const payload = buildOrderPayload()
      if (orderId) {
        await updateOrder(orderId, payload)
      } else {
        const created = await createOrder(payload)
        setOrderId(created.id)
        navigate(`/clientes/ordenes/${created.id}/editar`, { replace: true, state: { ofrecerSeguimiento: true } satisfies OfrecerSeguimientoState })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleFinalize = async () => {
    if (!validateStepBeforeLeaving(step)) return
    if (submitting) return
    const sinTotal = (Number(totalPrice) || 0) <= 0
    const ok = await confirmDialog({
      title: '¿Finalizar la orden?',
      message: 'Revisa que todos los datos estén correctos. Al finalizar se descuentan las bolsas del inventario y la orden ya no se podrá modificar.'
        + (sinTotal ? ' El total a cobrar es Q0.00: el comprobante saldrá en cero y la orden no quedará como pendiente de cobro.' : ''),
      confirmLabel: 'Sí, finalizar orden',
      cancelLabel: 'Revisar de nuevo',
    })
    if (!ok) return
    setSubmitting(true)
    const payload = buildOrderPayload()
    try {
      if (orderId) {
        await updateOrder(orderId, payload)
        await finalizeOrder(orderId)
        navigate(`/clientes/ordenes/${orderId}`)
      } else {
        const created = await createOrder(payload)
        await finalizeOrder(created.id)
        navigate(`/clientes/ordenes/${created.id}`, { state: { ofrecerSeguimiento: true } satisfies OfrecerSeguimientoState })
      }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo finalizar la orden.')
    } finally {
      setSubmitting(false)
    }
  }

  const updateRoast = (id: number, key: keyof RoastForm, value: string) => {
    setPageError('')
    setRoasts(prev => prev.map(r => r.id === id
      ? { ...r, [key]: key === 'notes' || String(key).includes('Time') ? value : value === '' ? '' : Number(value) }
      : r))
  }

  const addRoast = () => {
    setPageError('')
    if (roastValidation.hasErrors) {
      setPageError('Corrige el peso del tueste marcado en rojo antes de agregar otro tueste.')
      return
    }
    if (roastValidation.remaining <= 0) {
      setPageError('La cantidad disponible ya fue asignada por completo. No se pueden agregar más tuestes.')
      return
    }
    setRoasts(prev => [...prev, emptyRoast(prev.length + 1)])
  }

  const removeRoast = (id: number) => {
    setPageError('')
    setRoasts(prev => prev.length === 1 ? prev : prev.filter(r => r.id !== id).map((r, i) => ({ ...r, id: i + 1 })))
  }

  const updatePackageAllocation = (type: PackageType, rawValue: string) => {
    const value = rawValue === '' ? 0 : Math.max(0, Math.floor(Number(rawValue) || 0))
    setPackageAllocation(prev => ({ ...prev, [type]: value }))
  }

  const validateStepBeforeLeaving = (currentStep: number) => {
    setPageError('')
    const current = steps[currentStep]

    if (current === 'Recepción') {
      if (!receivedDate) {
        setPageError('Selecciona la fecha en que se recibió el café.')
        return false
      }
      if (!estimatedDate) {
        setPageError('Selecciona la fecha estimada de entrega.')
        return false
      }
      if (initialWeight <= 0) {
        setPageError('Ingresa un peso inicial válido mayor que 0 lb.')
        return false
      }
      const humidity = Number(humidityStr) || 0
      if (humidity <= 0 || humidity > 100) {
        setPageError('Ingresa un % de humedad válido entre 0 y 100.')
        return false
      }
    }

    if (current === 'Limpieza') {
      if (cleaningLb <= 0) {
        setPageError('Ingresa un peso válido después de limpieza.')
        return false
      }
      if (cleaningLb > initialWeight) {
        setPageError(`El peso después de limpieza no puede ser mayor al peso inicial de ${initialWeight.toFixed(2)} lb.`)
        return false
      }
    }

    if (current === 'Trillado') {
      if (availableLb <= 0) {
        setPageError('Ingresa un peso válido después de trillado.')
        return false
      }
      if (availableLb > previousTrilladoWeight) {
        setPageError(`El peso después de trillado no puede ser mayor al peso anterior de ${previousTrilladoWeight.toFixed(2)} lb.`)
        return false
      }
    }

    if (current === 'Tuestes') {
      if (roastValidation.hasErrors) {
        setPageError('Corrige los pesos inválidos de los tuestes antes de continuar.')
        return false
      }
      if (roastValidation.remaining > 0.001) {
        setPageError(`Todavía quedan ${roastValidation.remaining.toFixed(2)} lb pendientes de asignar a tuestes.`)
        return false
      }
    }

    if (current === 'Postproceso') {
      if (finalLb <= 0) {
        setPageError('Ingresa un peso final válido mayor que 0 lb.')
        return false
      }
      if (finalLb > availableLb) {
        setPageError(`El peso final no puede superar el peso antes del tueste (${availableLb.toFixed(2)} lb).`)
        return false
      }
    }

    if (current === 'Empaque') {
      if (effectiveFullBags < 0 || effectiveRemainder < 0) {
        setPageError('Las bolsas y el sobrante no pueden tener valores negativos.')
        return false
      }
      if (bagSizeGrams <= 0) {
        setPageError('Ingresa un gramaje de bolsa válido mayor que 0.')
        return false
      }
      if (effectiveRemainder >= bagSizeGrams) {
        setPageError(`La bolsa incompleta debe tener menos de ${bagSizeGrams} g. Si llega a ${bagSizeGrams} g, debe contarse como una bolsa completa.`)
        return false
      }
      const empacadoLb = (effectiveFullBags * bagSizeGrams + effectiveRemainder) / LB_TO_GRAMS
      if (empacadoLb > finalLb + 0.01) {
        setPageError(`Las bolsas y el sobrante suman ${empacadoLb.toFixed(2)} lb, más que el peso final de ${finalLb.toFixed(2)} lb.`)
        return false
      }
      if (hasPackageOverAllocation) {
        setPageError(`Has distribuido ${allocatedBags} bolsas, pero el resultado real tiene ${effectiveFullBags} bolsas completas.`)
        return false
      }
      if (bagsPending > 0) {
        setPageError(`Todavía faltan ${bagsPending} bolsas completas por asignar a un tipo de empaque.`)
        return false
      }
    }

    return true
  }

  const goNext = async () => {
    setPageError('')
    if (!validateStepBeforeLeaving(step)) return
    try {
      await persistNow()
      setStep(s => Math.min(steps.length - 1, s + 1))
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo guardar la orden.')
    }
  }

  const handleDelete = async () => {
    if (!orderId) return
    const folio = existingOrder?.orderNo ?? 'esta orden'
    const ok = await confirmDialog({ title: `¿Eliminar la orden ${folio}?`, message: 'Se borra todo lo registrado en ella. Esta acción no se puede deshacer.', confirmLabel: 'Eliminar orden', danger: true })
    if (!ok) return
    try {
      await deleteOrder(orderId)
      toast.success(`Orden ${folio} eliminada.`)
      navigate(`/clientes/${client.id}`, { replace: true })
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo eliminar la orden.')
    }
  }

  const goPrev = async () => {
    setPageError('')
    try {
      await persistNow()
      setStep(s => Math.max(0, s - 1))
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'No se pudo guardar la orden.')
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/clientes/${client.id}`} className="rounded-xl border border-stone-200 bg-white p-2.5"><ArrowLeft size={18} /></Link>
        <h2 className="page-title flex-1">{isEditing ? 'Editar orden de trabajo' : 'Nueva orden de trabajo'}</h2>
        {orderId && (
          <button type="button" className="btn-secondary !text-red-600 hover:!bg-red-50" onClick={handleDelete}><Trash2 size={16} /> <span className="hidden sm:inline">Eliminar orden</span></button>
        )}
      </div>

      <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900"><UserRound size={15} className="text-amber-600" /> {client.name}</span>
        <span className="inline-flex items-center gap-1.5 text-sm text-stone-500"><Phone size={14} /> {client.phone}</span>
        <span className="inline-flex items-center gap-1.5 text-sm text-stone-500"><MapPin size={14} /> {client.city}</span>
        <span className="ml-auto rounded-lg bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">No. de orden {existingOrder?.orderNo ?? 'Se asigna al guardar'}</span>
      </div>

      <WizardSteps steps={steps} current={step} />

      {pageError && (
        <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          <AlertTriangle className="mt-0.5 shrink-0" size={19} />
          <span>{pageError}</span>
        </div>
      )}

      {steps[step] === 'Recepción' && (
        <section className="card p-6">
          <SectionTitle title="1. Recepción del cliente" subtitle="" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Fecha recibido"><DatePickerField value={receivedDate} onChange={setReceivedDate} /></Field>
            <Field label="Fecha estimada de entrega"><DatePickerField value={estimatedDate} onChange={setEstimatedDate} /></Field>
            <Field label="Tipo de café"><select className="select" value={coffeeType} onChange={e => { setCoffeeType(e.target.value as CoffeeType); setCleaningWeight(''); setThreshingWeight(''); setRoasts([emptyRoast(1)]); setPageError('') }}><option value="pergamino">Pergamino</option><option value="natural">Natural</option><option value="oro">Oro</option></select></Field>
            <Field label="Peso inicial (lb)"><input type="number" min="0" step="0.01" className="input" value={initialWeightStr} onChange={e => setInitialWeightStr(e.target.value)} /></Field>
            <Field label="% humedad"><input type="number" min="0" max="100" step="0.1" className="input" value={humidityStr} onChange={e => { setPageError(''); setHumidityStr(e.target.value) }} /></Field>
          </div>
        </section>
      )}

      {steps[step] === 'Limpieza' && (
        <section className="card p-6">
          <SectionTitle title={`${step + 1}. Proceso de limpieza`} subtitle="Peso registrado tras el proceso de limpieza, previo al trillado." />
          <div className="max-w-md">
            <Field label="Peso después de limpieza (lb)">
              <input
                type="number"
                min="0"
                max={initialWeight || undefined}
                step="0.01"
                className={`input ${cleaningLb > initialWeight && initialWeight > 0 ? '!border-red-400 !bg-red-50' : ''}`}
                value={cleaningWeight}
                onChange={e => { setPageError(''); setCleaningWeight(e.target.value) }}
              />
            </Field>
            {cleaningLb > initialWeight && initialWeight > 0 ? (
              <p className="mt-2 text-sm font-medium text-red-600">No puede superar el peso inicial de {initialWeight.toFixed(2)} lb.</p>
            ) : (
              <p className="mt-2 text-sm text-stone-500">Peso inicial: {initialWeight.toFixed(2)} lb{cleaningLb > 0 ? ` · Merma: ${merma.mermaLimpieza.toFixed(2)} lb` : ''}</p>
            )}
          </div>
        </section>
      )}

      {steps[step] === 'Trillado' && (
        <section className="card p-6">
          <SectionTitle title={`${step + 1}. Proceso de trillado`} subtitle="Peso registrado tras el proceso de trillado." />
          <div className="max-w-md">
            <Field label="Peso después de trillado (lb)">
              <input
                type="number"
                min="0"
                max={previousTrilladoWeight || undefined}
                step="0.01"
                className={`input ${availableLb > previousTrilladoWeight && previousTrilladoWeight > 0 ? '!border-red-400 !bg-red-50' : ''}`}
                value={threshingWeight}
                onChange={e => { setPageError(''); setThreshingWeight(e.target.value) }}
              />
            </Field>
            {availableLb > previousTrilladoWeight && previousTrilladoWeight > 0 ? (
              <p className="mt-2 text-sm font-medium text-red-600">No puede superar el peso anterior de {previousTrilladoWeight.toFixed(2)} lb.</p>
            ) : (
              <p className="mt-2 text-sm text-stone-500">{coffeeTypeHasCleaningStep(coffeeType) ? 'Peso después de limpieza' : 'Peso inicial'}: {previousTrilladoWeight.toFixed(2)} lb{availableLb > 0 ? ` · Merma: ${merma.mermaTrillado.toFixed(2)} lb` : ''}</p>
            )}
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Este valor se utilizará como base disponible para la distribución de tuestes.</p>
          </div>
        </section>
      )}

      {steps[step] === 'Tuestes' && (
        <section className="space-y-4">
          <div className="card p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Disponible para tostar" value={`${availableLb.toFixed(2)} lb`} />
              <Stat label="Asignado" value={`${roastValidation.allocated.toFixed(2)} lb`} />
              <Stat label="Pendiente" value={`${roastValidation.remaining.toFixed(2)} lb`} />
            </div>
            {roastValidation.hasErrors && (
              <div className="mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertTriangle size={18} />
                <span>Los pesos inválidos no se descuentan del pendiente. Corrígelos para continuar.</span>
              </div>
            )}
            {!roastValidation.hasErrors && roastValidation.remaining <= 0 && availableLb > 0 && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">✓ Todo el café disponible ya fue asignado a tuestes.</div>
            )}
          </div>

          {roasts.map(r => {
            const roastError = roastValidation.errors[r.id]
            return (
              <div className="card p-6" key={r.id}>
                <div className="mb-5 flex items-center justify-between">
                  <div><h3 className="font-bold">Tueste No. {r.id}</h3><p className="text-sm text-stone-500">Máximo permitido: {MAX_ROAST_LB} lb por servicio.</p></div>
                  <button className="rounded-xl border border-stone-200 p-2 text-stone-500" onClick={() => removeRoast(r.id)}><Trash2 size={17} /></button>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Field label="Peso (lb)">
                    <input type="number" max={MAX_ROAST_LB} min="0" step="0.01" className={`input ${roastError ? '!border-red-400 !bg-red-50' : ''}`} value={r.weightLb} onChange={e => updateRoast(r.id, 'weightLb', e.target.value)} />
                    {roastError && <span className="mt-1.5 block text-xs font-medium text-red-600">{roastError}</span>}
                  </Field>
                  <Field label="T° inicial"><input type="number" className="input" value={r.initialTemp} onChange={e => updateRoast(r.id, 'initialTemp', e.target.value)} /></Field>
                  <Field label="Retorno T°"><input type="number" className="input" value={r.returnTemp} onChange={e => updateRoast(r.id, 'returnTemp', e.target.value)} /></Field>
                  <Field label="Retorno tiempo"><input className="input" placeholder="mm:ss" value={r.returnTime} onChange={e => updateRoast(r.id, 'returnTime', e.target.value)} /></Field>
                  <Field label="Deshidratación T°"><input type="number" className="input" value={r.dehydrationTemp} onChange={e => updateRoast(r.id, 'dehydrationTemp', e.target.value)} /></Field>
                  <Field label="Deshidratación tiempo"><input className="input" placeholder="mm:ss" value={r.dehydrationTime} onChange={e => updateRoast(r.id, 'dehydrationTime', e.target.value)} /></Field>
                  <Field label="Caramelización T°"><input type="number" className="input" value={r.caramelizationTemp} onChange={e => updateRoast(r.id, 'caramelizationTemp', e.target.value)} /></Field>
                  <Field label="Caramelización tiempo"><input className="input" placeholder="mm:ss" value={r.caramelizationTime} onChange={e => updateRoast(r.id, 'caramelizationTime', e.target.value)} /></Field>
                  <Field label="Crack T°"><input type="number" className="input" value={r.crackTemp} onChange={e => updateRoast(r.id, 'crackTemp', e.target.value)} /></Field>
                  <Field label="Crack tiempo"><input className="input" placeholder="mm:ss" value={r.crackTime} onChange={e => updateRoast(r.id, 'crackTime', e.target.value)} /></Field>
                  <Field label="Final T°"><input type="number" className="input" value={r.finalTemp} onChange={e => updateRoast(r.id, 'finalTemp', e.target.value)} /></Field>
                  <Field label="Final tiempo"><input className="input" placeholder="mm:ss" value={r.finalTime} onChange={e => updateRoast(r.id, 'finalTime', e.target.value)} /></Field>
                </div>
                <Field label="Observaciones"><textarea className="input mt-4 min-h-20" value={r.notes} onChange={e => updateRoast(r.id, 'notes', e.target.value)} /></Field>
              </div>
            )
          })}

          <div className="flex items-center gap-3">
            <button className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40" onClick={addRoast} disabled={roastValidation.hasErrors || roastValidation.remaining <= 0}>
              <Plus size={17} /> Agregar tueste
            </button>
            {roastValidation.remaining <= 0 && !roastValidation.hasErrors && <span className="text-sm font-medium text-emerald-700">Tuestes completados</span>}
          </div>
        </section>
      )}

      {steps[step] === 'Postproceso' && (
        <section className="card p-6">
          <SectionTitle title={`${step + 1}. Postproceso`} subtitle="Pesaje final y especificaciones del producto." />
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Peso final después del tueste/molido (lb)"><input type="number" min="0" max={availableLb || undefined} step="0.01" className={`input ${Number(finalWeight) > availableLb && availableLb > 0 ? '!border-red-400 !bg-red-50' : ''}`} value={finalWeight} onChange={e => { setPageError(''); setFinalWeight(e.target.value) }} /></Field>
            <Field label="Tipo de tueste"><select className="select" value={roastType} onChange={e => setRoastType(e.target.value)}><option value="claro">Claro</option><option value="medio">Medio</option><option value="oscuro">Oscuro</option></select></Field>
            <Field label="Tipo de molienda"><select className="select" value={grindType} onChange={e => setGrindType(e.target.value)}><option value="gruesa">Gruesa</option><option value="media">Media</option><option value="fina">Fina</option></select></Field>
          </div>
          {finalLb > availableLb && availableLb > 0 ? (
            <p className="mt-2 text-sm font-medium text-red-600">No puede superar el peso antes del tueste de {availableLb.toFixed(2)} lb.</p>
          ) : (
            <p className="mt-2 text-sm text-stone-500">Peso que entró al tostador: {availableLb.toFixed(2)} lb{finalLb > 0 ? ` · Merma: ${merma.mermaTueste.toFixed(2)} lb · Merma total de la orden: ${merma.total.toFixed(2)} lb` : ''}</p>
          )}
        </section>
      )}

      {steps[step] === 'Empaque' && (
        <section className="space-y-4">
          <div className="card p-6">
            <SectionTitle title={`${step + 1}. Empaque`} subtitle="Cálculo de bolsas según el peso final." />

            <div className="max-w-xs">
              <Field label="Gramaje de bolsa (g)">
                <input type="number" min="1" step="1" className="input" value={bagSizeGramsStr} onChange={e => { setPageError(''); setBagSizeGramsStr(e.target.value) }} />
              </Field>
              <p className="mt-1.5 text-xs text-stone-500">Este cliente puede pedir un gramaje distinto al estándar de {BAG_GRAMS} g.</p>
            </div>

            <div className="mb-5 mt-5 grid gap-3 sm:grid-cols-3">
              <Stat label="Peso final en gramos" value={`${suggestedPackaging.grams.toFixed(1)} g`} />
              <Stat label="Bolsas estimadas" value={`${suggestedPackaging.fullBags} bolsas`} />
              <Stat label="Sobrante estimado" value={`${suggestedPackaging.remainderGrams.toFixed(1)} g`} />
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h4 className="font-bold text-stone-900">Resultado real del empaque</h4>
              <p className="mt-1 text-sm text-stone-600">Puedes corregir estos valores si el resultado físico fue diferente al cálculo sugerido.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label={`Bolsas completas (${bagSizeGrams} g)`}><input type="number" min="0" step="1" className="input" placeholder={String(suggestedPackaging.fullBags)} value={actualFullBags} onChange={e => { setPageError(''); setActualFullBags(e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0))) }} /></Field>
                <Field label="Bolsa incompleta / sobrante (g)"><input type="number" min="0" max={bagSizeGrams - 0.01} step="0.1" className={`input ${effectiveRemainder >= bagSizeGrams ? '!border-red-400 !bg-red-50' : ''}`} placeholder={suggestedPackaging.remainderGrams.toFixed(1)} value={actualRemainderGrams} onChange={e => { setPageError(''); setActualRemainderGrams(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0)) }} /></Field>
              </div>
              <p className="mt-3 text-sm text-stone-700"><b>Resultado registrado:</b> {effectiveFullBags} bolsas completas{hasIncompleteBag ? ` + 1 bolsa incompleta de ${effectiveRemainder.toFixed(1)} g` : ''}.</p>
            </div>
          </div>

          <div className="card p-6">
            <SectionTitle title="Distribución por tipo de empaque" subtitle="Distribuye todas las bolsas completas entre los empaques utilizados." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {PACKAGE_TYPES.map(type => (
                <Field key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                  <input type="number" min="0" step="1" className="input" value={packageAllocation[type] || ''} placeholder="0 bolsas" onChange={e => updatePackageAllocation(type, e.target.value)} />
                </Field>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat label="Bolsas completas" value={`${effectiveFullBags}`} />
              <Stat label="Distribuidas" value={`${allocatedBags}`} />
              <Stat label={hasPackageOverAllocation ? 'Exceso' : 'Pendientes'} value={`${hasPackageOverAllocation ? allocatedBags - effectiveFullBags : bagsPending}`} />
            </div>

            {hasPackageOverAllocation && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">La distribución supera las {effectiveFullBags} bolsas completas registradas.</p>}
            {!hasPackageOverAllocation && bagsPending === 0 && effectiveFullBags > 0 && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">✓ Todas las bolsas completas fueron asignadas a un tipo de empaque.</p>}

            {hasIncompleteBag && (
              <div className="mt-5 max-w-md rounded-2xl bg-stone-100 p-4">
                <Field label={`Empaque de la bolsa incompleta (${effectiveRemainder.toFixed(1)} g)`}>
                  <select className="select" value={incompletePackageType} onChange={e => setIncompletePackageType(e.target.value as PackageType)}>
                    {PACKAGE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        </section>
      )}

      {steps[step] === 'Resumen' && (
        <section className="card p-6">
          <SectionTitle title={`${step + 1}. Resumen y cobro`} subtitle="Revisa los datos antes de finalizar. Al finalizar se descuentan las bolsas del inventario y la orden ya no se podrá modificar." />
          <div className="grid gap-5 lg:grid-cols-2">
            <OrderSummary order={buildPreviewOrder()} />
            <div>
              <Field label="Total a cobrar (Q)"><input type="number" min="0" step="0.01" className="input" value={totalPrice} onChange={e => setTotalPrice(e.target.value)} /></Field>
              <button className="btn-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} onClick={handleFinalize}>
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null} Finalizar orden
              </button>
            </div>
          </div>
        </section>
      )}

      <WizardNav>
        <button className="btn-secondary disabled:opacity-40" disabled={step === 0 || submitting} onClick={goPrev}>Anterior</button>
        <button className="btn-secondary disabled:opacity-40" disabled={step === steps.length - 1 || submitting} onClick={goNext}>Siguiente</button>
      </WizardNav>

      {seguimiento.abierto && existingOrder && <SeguimientoWhatsAppModal order={existingOrder} onClose={seguimiento.cerrar} />}
    </div>
  )
}

