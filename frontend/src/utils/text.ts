export function capitalize(value: string | null | undefined): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—'
}
