const UNITS = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
const TEENS = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
const TWENTIES = ['VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const TENS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const HUNDREDS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function threeDigitsToWords(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CIEN'

  const hundred = Math.floor(n / 100)
  const rest = n % 100
  let words = HUNDREDS[hundred]

  if (rest > 0) {
    if (words) words += ' '
    if (rest < 10) words += UNITS[rest]
    else if (rest < 20) words += TEENS[rest - 10]
    else if (rest < 30) words += TWENTIES[rest - 20]
    else {
      const ten = Math.floor(rest / 10)
      const unit = rest % 10
      words += TENS[ten]
      if (unit > 0) words += ` Y ${UNITS[unit]}`
    }
  }

  return words
}

function integerToWords(n: number): string {
  if (n === 0) return 'CERO'

  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000

  const parts: string[] = []

  if (millions > 0) {
    parts.push(millions === 1 ? 'UN MILLÓN' : `${threeDigitsToWords(millions)} MILLONES`)
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'MIL' : `${threeDigitsToWords(thousands)} MIL`)
  }
  if (rest > 0) {
    parts.push(threeDigitsToWords(rest))
  }

  return parts.join(' ')
}

export function amountToWords(amount: number): string {
  const safeAmount = Math.max(0, amount)
  const integerPart = Math.floor(safeAmount)
  const cents = Math.round((safeAmount - integerPart) * 100)
  const centsStr = String(cents).padStart(2, '0')
  return `${integerToWords(integerPart)} QUETZALES CON ${centsStr}/100`
}
