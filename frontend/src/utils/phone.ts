export function phoneDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function formatGuatemalaPhone(value: string) {
  const digits = phoneDigits(value).slice(0, 8)
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits
}
