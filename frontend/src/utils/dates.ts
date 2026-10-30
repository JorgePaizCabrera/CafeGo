export const MONTHS_LONG = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const DATE_FORMAT = new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })
const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatISODate(value: string | null | undefined): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) return '—'
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return DATE_FORMAT.format(new Date(y, m - 1, d))
}

export function isOverdue(value: string | null | undefined): boolean {
  return Boolean(value) && value!.slice(0, 10) < todayISODate()
}

// Fecha en hora local; toISOString() usa UTC y puede desplazar el día.
export function localISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISODate(): string {
  return localISODate(new Date())
}

export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

export function fromISODate(value: string): Date | undefined {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return y && m ? `${MONTHS_LONG[m - 1]} ${y}` : ''
}

export function isDayPeriod(period: string): boolean {
  return period.length === 10
}

export function inPeriod(date: string | Date | null | undefined, period: string): boolean {
  if (!period) return true
  if (!date) return false
  const local = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : localISODate(new Date(date))
  return local.startsWith(period)
}

export function formatPeriod(period: string): string {
  if (!period) return 'todo el historial'
  return isDayPeriod(period) ? DAY_LABEL_FORMAT.format(fromISODate(period)!) : formatMonthKey(period)
}

export function periodPhrase(period: string): string {
  return `${isDayPeriod(period) ? 'el' : 'en'} ${formatPeriod(period)}`
}

export function periodRange(period: string): [Date, Date] {
  const [y, m, d] = period.split('-').map(Number)
  return d ? [new Date(y, m - 1, d), new Date(y, m - 1, d + 1)] : [new Date(y, m - 1, 1), new Date(y, m, 1)]
}
