import { ChevronLeft, ChevronRight } from 'lucide-react'
import { monthKey } from '../../utils/dates'

export const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('es-GT', { weekday: 'short' })

export function weekdayName(date: Date): string {
  const s = WEEKDAY_FORMAT.format(date)
  return s.charAt(0).toUpperCase() + s.charAt(1)
}

export const DAY_PICKER_CLASSES = {
  root: 'select-none',
  months: '',
  month: '',
  month_caption: 'sr-only',
  month_grid: 'border-collapse',
  weekdays: '',
  weekday: 'h-8 w-10 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-400',
  weeks: '',
  week: '',
  day: 'p-0.5 text-center',
  day_button: 'inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm text-stone-700 transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
}

export const DAY_PICKER_MODIFIERS = {
  today: '[&>button]:font-bold [&>button]:text-amber-700 [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-amber-300',
  outside: '[&>button]:text-stone-300',
  disabled: '[&>button]:cursor-not-allowed [&>button]:!text-stone-300 [&>button]:hover:bg-transparent',
  selected: '[&>button]:!bg-amber-500 [&>button]:!font-semibold [&>button]:!text-stone-950 [&>button]:!ring-0 [&>button]:shadow-sm',
}

export function CalendarHeader({ title, onTitleClick, onPrev, onNext, prevDisabled, nextDisabled, titleHint }: {
  title: string
  onTitleClick?: () => void
  onPrev: () => void
  onNext: () => void
  prevDisabled?: boolean
  nextDisabled?: boolean
  titleHint?: string
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <NavButton label="Anterior" onClick={onPrev} disabled={prevDisabled}><ChevronLeft size={16} /></NavButton>
      {onTitleClick ? (
        <button type="button" onClick={onTitleClick} title={titleHint} className="rounded-lg px-2.5 py-1 text-sm font-semibold text-stone-900 transition hover:bg-stone-100">
          {title}
        </button>
      ) : (
        <span className="px-2.5 py-1 text-sm font-semibold text-stone-900">{title}</span>
      )}
      <NavButton label="Siguiente" onClick={onNext} disabled={nextDisabled}><ChevronRight size={16} /></NavButton>
    </div>
  )
}

function NavButton({ label, onClick, disabled, children }: { label: string, onClick: () => void, disabled?: boolean, children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}

export function MonthGrid({ year, selectedKey, currentKey, maxKey, onSelect }: {
  year: number
  selectedKey?: string
  currentKey: string
  maxKey?: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="grid w-64 grid-cols-3 gap-1.5">
      {MONTHS_SHORT.map((name, i) => {
        const key = monthKey(year, i)
        const selected = key === selectedKey
        const current = key === currentKey
        const disabled = maxKey !== undefined && key > maxKey
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(key)}
            className={`h-10 rounded-lg text-sm transition disabled:cursor-not-allowed disabled:text-stone-300 disabled:hover:bg-transparent ${
              selected
                ? 'bg-amber-500 font-semibold text-stone-950'
                : current
                  ? 'font-semibold text-amber-700 ring-1 ring-inset ring-amber-300 hover:bg-amber-50'
                  : 'text-stone-700 hover:bg-stone-100'
            }`}
          >
            {name}
          </button>
        )
      })}
    </div>
  )
}

export function CalendarFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5">{children}</div>
}

export function FooterButton({ onClick, children, muted = false }: { onClick: () => void, children: React.ReactNode, muted?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${muted ? 'text-stone-500 hover:bg-stone-100 hover:text-stone-800' : 'text-amber-700 hover:bg-amber-50'}`}>
      {children}
    </button>
  )
}
