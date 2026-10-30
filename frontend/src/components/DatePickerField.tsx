import { useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { CalendarDays, ChevronDown } from 'lucide-react'
import Popover from './ui/Popover'
import {
  CalendarFooter, CalendarHeader, DAY_PICKER_CLASSES, DAY_PICKER_MODIFIERS, FooterButton, MonthGrid, weekdayName,
} from './ui/calendar'
import { fromISODate, localISODate, monthKey, MONTHS_LONG, todayISODate } from '../utils/dates'

const DISPLAY_FORMAT = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })

export default function DatePickerField({
  value,
  onChange,
  placeholder = 'Seleccionar fecha',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'days' | 'months'>('days')
  const selected = value ? fromISODate(value) : undefined
  const [month, setMonth] = useState<Date>(() => selected ?? new Date())
  const buttonRef = useRef<HTMLButtonElement>(null)

  const toggle = () => {
    if (!open) {
      setMonth(selected ?? new Date())
      setView('days')
    }
    setOpen(o => !o)
  }

  const pick = (date: Date) => {
    onChange(localISODate(date))
    setOpen(false)
  }

  const shiftMonth = (delta: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))
  const shiftYear = (delta: number) => setMonth(m => new Date(m.getFullYear() + delta, m.getMonth(), 1))
  const today = new Date()

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={`input flex items-center justify-between gap-2 text-left ${open ? '!border-amber-500 !ring-4 !ring-amber-500/10' : ''}`}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={`flex min-w-0 items-center gap-2 ${selected ? 'text-stone-900' : 'text-stone-400'}`}>
          <CalendarDays size={16} className="shrink-0 text-stone-400" />
          <span className="truncate">{selected ? DISPLAY_FORMAT.format(selected) : placeholder}</span>
        </span>
        <ChevronDown size={16} className={`shrink-0 text-stone-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <Popover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef}>
        {view === 'days' ? (
          <>
            <CalendarHeader
              title={`${MONTHS_LONG[month.getMonth()]} ${month.getFullYear()}`}
              titleHint="Elegir otro mes o año"
              onTitleClick={() => setView('months')}
              onPrev={() => shiftMonth(-1)}
              onNext={() => shiftMonth(1)}
            />
            <DayPicker
              mode="single"
              locale={es}
              month={month}
              onMonthChange={setMonth}
              hideNavigation
              showOutsideDays
              fixedWeeks
              selected={selected}
              onSelect={date => { if (date) pick(date) }}
              classNames={DAY_PICKER_CLASSES}
              modifiersClassNames={DAY_PICKER_MODIFIERS}
              formatters={{ formatWeekdayName: weekdayName }}
            />
          </>
        ) : (
          <>
            <CalendarHeader title={String(month.getFullYear())} onPrev={() => shiftYear(-1)} onNext={() => shiftYear(1)} />
            <MonthGrid
              year={month.getFullYear()}
              selectedKey={selected ? monthKey(selected.getFullYear(), selected.getMonth()) : undefined}
              currentKey={monthKey(today.getFullYear(), today.getMonth())}
              onSelect={key => {
                const [y, m] = key.split('-').map(Number)
                setMonth(new Date(y, m - 1, 1))
                setView('days')
              }}
            />
          </>
        )}
        <CalendarFooter>
          <FooterButton onClick={() => pick(fromISODate(todayISODate())!)}>Hoy</FooterButton>
          <FooterButton muted onClick={() => setOpen(false)}>Cerrar</FooterButton>
        </CalendarFooter>
      </Popover>
    </div>
  )
}
