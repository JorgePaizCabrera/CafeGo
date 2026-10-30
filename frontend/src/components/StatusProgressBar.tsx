import { STATUS_ORDER, type OrderStatus } from '../types/order'

export default function StatusProgressBar({ status, compact = false }: { status: OrderStatus, compact?: boolean }) {
  const currentIndex = STATUS_ORDER.indexOf(status)

  return (
    <div>
      <div className={`flex gap-1 ${compact ? 'h-1.5' : 'h-2'}`}>
        {STATUS_ORDER.map((s, i) => (
          <span
            key={s}
            className={`flex-1 rounded-full ${i <= currentIndex ? (status === 'Finalizado' ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-stone-200'}`}
          />
        ))}
      </div>
      <p className={`mt-1.5 font-semibold ${compact ? 'text-xs' : 'text-sm'} ${status === 'Finalizado' ? 'text-emerald-700' : 'text-stone-700'}`}>
        {status}
      </p>
    </div>
  )
}
