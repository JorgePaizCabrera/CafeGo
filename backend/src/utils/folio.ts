// El folio no se almacena: se deriva de la columna autoincremental "seq".
export function formatFolio(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, '0')}`
}

export function parseFolioSeq(folio: string): number | null {
  const match = /^[A-Z]+-(\d+)$/.exec(folio.trim())
  if (!match) return null
  return parseInt(match[1], 10)
}
