import { useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Popover from './ui/Popover'
import {
  CalendarFooter, CalendarHeader, DAY_PICKER_CLASSES, DAY_PICKER_MODIFIERS, FooterButton, MonthGrid, weekdayName,
} from './ui/calendar'
import { formatPeriod, fromISODate, isDayPeriod, localISODate, monthKey, MONTHS_LONG, todayISODate } from '../utils/dates'

function shiftPeriod(period: string, delta: number): string {
  const [y, m, d] = period.split('-').map(Number)
  if (d) return localISODate(new Date(y, m - 1, d + delta))
  const target = new Date(y, m - 1 + delta, 1)
  return monthKey(target.getFullYear(), target.getMonth())
}

function periodMonth(period: string): Date {
  const [y, m] = (period || todayISODate()).split('-').map(Number)
  return new Date(y, m - 1, 1)
}

export default function PeriodPicker({ value, onChange, allowAll = false }: {
  value: string
  onChange: (period: string) => void
  allowAll?: boolean
}) {
  const today = todayISODate()
  const currentMonth = today.slice(0, 7)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months'>('days')
  const [month, setMonth] = useState<Date>(() => periodMonth(value))
  const anchorRef = useRef<HTMLDivElement>(null)

  const isDay = isDayPeriod(value)
  const selectedDay = isDay ? fromISODate(value) : undefined
  const atLimit = value !== '' && value >= (isDay ? today : currentMonth)

  const toggle = () => {
    if (!open) {
      setMonth(periodMonth(value))
      setView('days')
    }
    setOpen(o => !o)
  }
  const choose = (period: string) => { onChange(period); setOpen(false) }
  const shiftMonth = (delta: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const displayedMonthKey = monthKey(month.getFullYear(), month.getMonth())

  return (
    <div ref={anchorRef} className="flex h-10 w-full items-stretch rounded-xl border border-stone-300 bg-white shadow-sm sm:inline-flex sm:w-auto">
      {value && (
        <button type="button" aria-label={isDay ? 'Día anterior' : 'Mes anterior'} title={isDay ? 'Día anterior' : 'Mes anterior'} onClick={() => onChange(shiftPeriod(value, -1))}
          className="flex w-9 items-center justify-center rounded-l-xl border-r border-stone-200 text-stone-500 transition hover:bg-stone-50 hover:text-stone-900">
          <ChevronLeft size={16} />
        </button>
      )}
      <button type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open}
        className={`flex min-w-0 flex-1 items-center justify-between gap-2 px-3 sm:min-w-44 sm:flex-none text-sm font-semibold text-stone-800 transition hover:bg-stone-50 ${value ? '' : 'rounded-xl'} ${open ? 'bg-stone-50' : ''}`}>
        <span className="flex items-center gap-2">
          <CalendarDays size={15} className="text-stone-400" />
          {value ? formatPeriod(value) : 'Todo el historial'}
        </span>
        <ChevronDown size={15} className={`text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {value && (
        <button type="button" aria-label={isDay ? 'Día siguiente' : 'Mes siguiente'} title={isDay ? 'Día siguiente' : 'Mes siguiente'} disabled={atLimit} onClick={() => onChange(shiftPeriod(value, 1))}
          className="flex w-9 items-center justify-center rounded-r-xl border-l border-stone-200 text-stone-500 transition hover:bg-stone-50 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent">
          <ChevronRight size={16} />
        </button>
      )}

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={anchorRef} align="end">
        {view === 'days' ? (
          <>
            <CalendarHeader
              title={`${MONTHS_LONG[month.getMonth()]} ${month.getFullYear()}`}
              titleHint="Elegir otro mes o año"
              onTitleClick={() => setView('months')}
              onPrev={() => shiftMonth(-1)}
              onNext={() => shiftMonth(1)}
              nextDisabled={displayedMonthKey >= currentMonth}
            />
            <DayPicker
              mode="single"
              locale={es}
              month={month}
              onMonthChange={setMonth}
              hideNavigation
              showOutsideDays
              fixedWeeks
              disabled={{ after: fromISODate(today)! }}
              selected={selectedDay}
              onSelect={date => { if (date) choose(localISODate(date)) }}
              classNames={DAY_PICKER_CLASSES}
              modifiersClassNames={DAY_PICKER_MODIFIERS}
              formatters={{ formatWeekdayName: weekdayName }}
            />
          </>
        ) : (
          <>
            <CalendarHeader
              title={String(month.getFullYear())}
              onPrev={() => setMonth(m => new Date(m.getFullYear() - 1, m.getMonth(), 1))}
              onNext={() => setMonth(m => new Date(m.getFullYear() + 1, m.getMonth(), 1))}
              nextDisabled={month.getFullYear() >= Number(currentMonth.slice(0, 4))}
            />
            <MonthGrid
              year={month.getFullYear()}
              selectedKey={value ? value.slice(0, 7) : undefined}
              currentKey={currentMonth}
              maxKey={currentMonth}
              onSelect={key => {
                setMonth(periodMonth(key))
                setView('days')
              }}
            />
          </>
        )}
        <CalendarFooter>
          <FooterButton onClick={() => choose(displayedMonthKey)}>Todo {MONTHS_LONG[month.getMonth()].toLowerCase()}</FooterButton>
          <FooterButton onClick={() => choose(today)}>Hoy</FooterButton>
          {allowAll && <FooterButton muted onClick={() => choose('')}>Todo el historial</FooterButton>}
        </CalendarFooter>
      </Popover>
    </div>
  )
}
