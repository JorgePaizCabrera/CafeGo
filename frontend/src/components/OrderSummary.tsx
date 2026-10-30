import { COFFEE_TYPE_LABELS, PACKAGE_TYPES, coffeeTypeHasCleaningStep, orderMermaLb, type Order, type Roast } from '../types/order'
import { Stat } from './FormParts'
import { formatQ } from '../utils/money'
import { capitalize } from '../utils/text'

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-5 text-sm leading-7">
      <h4 className="mb-2 font-bold text-stone-900">{title}</h4>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string, value: React.ReactNode }) {
  return <p><b>{label}:</b> {value ?? '—'}</p>
}

function RoastSummaryCard({ roast }: { roast: Roast }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="mb-2 font-bold text-stone-900">Tueste No. {roast.id} — {roast.weightLb} lb</p>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <Row label="T° inicial" value={roast.initialTemp} />
        <Row label="Retorno" value={`${roast.returnTemp}° / ${roast.returnTime || '—'}`} />
        <Row label="Deshidratación" value={`${roast.dehydrationTemp}° / ${roast.dehydrationTime || '—'}`} />
        <Row label="Caramelización" value={`${roast.caramelizationTemp}° / ${roast.caramelizationTime || '—'}`} />
        <Row label="Crack" value={`${roast.crackTemp}° / ${roast.crackTime || '—'}`} />
        <Row label="Final" value={`${roast.finalTemp}° / ${roast.finalTime || '—'}`} />
      </div>
      {roast.notes && <p className="mt-2 text-stone-600"><b>Observaciones:</b> {roast.notes}</p>}
    </div>
  )
}

export default function OrderSummary({ order }: { order: Order }) {
  const hasIncompleteBag = order.actualRemainderGrams > 0
  const hasCleaning = coffeeTypeHasCleaningStep(order.coffeeType)
  const merma = orderMermaLb(order)

  return (
    <div className="space-y-4">
      <Section title="Recepción">
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <Row label="Cliente" value={order.clientName} />
          <Row label="Orden" value={order.orderNo} />
          <Row label="Teléfono" value={order.phone} />
          <Row label="Ciudad" value={order.city} />
          <Row label="Café" value={COFFEE_TYPE_LABELS[order.coffeeType]} />
          <Row label="Fecha recibido" value={order.receivedDate} />
          <Row label="Fecha estimada" value={order.estimatedDate} />
          <Row label="Peso inicial" value={`${order.initialWeight} lb`} />
          <Row label="% humedad" value={order.humidity} />
        </div>
      </Section>

      <Section title="Limpieza / Trillado">
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {hasCleaning && <Row label="Peso después de limpieza" value={`${order.cleaningWeight} lb`} />}
          <Row label="Peso después de trillado" value={`${order.threshingWeight} lb`} />
        </div>
      </Section>

      <Section title="Tuestes">
        <div className="space-y-3">
          {order.roasts.map(roast => <RoastSummaryCard key={roast.id} roast={roast} />)}
        </div>
      </Section>

      <Section title="Postproceso">
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <Row label="Peso final" value={`${order.finalWeight} lb`} />
          <Row label="Tipo de tueste" value={capitalize(order.roastType)} />
          <Row label="Tipo de molienda" value={capitalize(order.grindType)} />
        </div>
      </Section>

      <Section title="Merma por paso">
        <div className={`grid grid-cols-2 gap-3 ${hasCleaning ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
          {hasCleaning && <Stat label="En limpieza" value={`${merma.mermaLimpieza.toFixed(2)} lb`} />}
          <Stat label="En trillado" value={`${merma.mermaTrillado.toFixed(2)} lb`} />
          <Stat label="En tueste y molido" value={`${merma.mermaTueste.toFixed(2)} lb`} />
          <Stat label="Total" value={`${merma.total.toFixed(2)} lb`} />
        </div>
      </Section>

      <Section title="Empaque">
        <Row label="Gramaje de bolsa" value={`${order.bagSizeGrams} g`} />
        <Row label="Resultado real" value={`${order.actualFullBags} bolsas completas${hasIncompleteBag ? ` + 1 bolsa incompleta de ${order.actualRemainderGrams.toFixed(1)} g` : ''}`} />
        <div className="mt-2 border-t border-stone-200 pt-2">
          <b>Distribución:</b>
          {PACKAGE_TYPES.filter(type => order.packageAllocation[type] > 0).map(type => (
            <p key={type}>• {order.packageAllocation[type]} completas — {capitalize(type)}</p>
          ))}
          {hasIncompleteBag && <p>• 1 incompleta ({order.actualRemainderGrams.toFixed(1)} g) — {capitalize(order.incompletePackageType)}</p>}
        </div>
      </Section>

      <Section title="Cobro">
        <Row label="Total a cobrar" value={order.totalPrice ? formatQ(order.totalPrice) : '—'} />
        <Row label="Estado" value={order.status === 'Finalizado' ? (order.pagado ? 'Finalizada · Pagada' : 'Finalizada · Pendiente de cobro') : order.status} />
      </Section>
    </div>
  )
}
