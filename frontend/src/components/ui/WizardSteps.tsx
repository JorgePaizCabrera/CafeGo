import { Check } from 'lucide-react'

export function WizardNav({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-stone-200 bg-stone-100/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      {children}
    </div>
  )
}

export default function WizardSteps({ steps, current, onStepClick }: {
  steps: readonly string[]
  current: number
  onStepClick?: (index: number) => void
}) {
  return (
    <>
      <div className="card p-4 lg:hidden">
        {onStepClick ? (
          <select className="select" value={current} onChange={e => onStepClick(Number(e.target.value))} aria-label="Ir al paso">
            {steps.map((s, i) => <option key={s} value={i}>Paso {i + 1} de {steps.length}: {s}</option>)}
          </select>
        ) : (
          <p className="text-sm font-semibold text-stone-900">
            <span className="text-stone-500">Paso {current + 1} de {steps.length}:</span> {steps[current]}
          </p>
        )}
        <div className="mt-3 flex gap-1" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${i < current ? 'bg-amber-400' : i === current ? 'bg-stone-900' : 'bg-stone-200'}`} />
          ))}
        </div>
      </div>

      <nav aria-label="Pasos" className="card hidden overflow-x-auto p-3 lg:block">
        <ol className="flex min-w-[700px] gap-2">
          {steps.map((s, i) => {
            const className = `flex w-full items-center rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${
              current === i ? 'bg-stone-900 text-white' : i < current ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-500'
            }`
            const content = (
              <>
                <span className={`mr-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${current === i ? 'bg-white/20' : 'bg-white/60'}`}>
                  {i < current ? <Check size={14} /> : i + 1}
                </span>
                {s}
              </>
            )
            return (
              <li key={s} className="flex-1" aria-current={current === i ? 'step' : undefined}>
                {onStepClick
                  ? <button type="button" className={`${className} hover:brightness-95`} onClick={() => onStepClick(i)}>{content}</button>
                  : <div className={className}>{content}</div>}
              </li>
            )
          })}
        </ol>
      </nav>
    </>
  )
}
