export const LB_TO_GRAMS = 453.59237
export const BAG_GRAMS = 350
export const MAX_ROAST_LB = 15

export function lbToGrams(lb: number) {
  return lb * LB_TO_GRAMS
}

export function packagingFromLb(lb: number) {
  const grams = lbToGrams(lb)
  const fullBags = Math.floor(grams / BAG_GRAMS)
  const remainderGrams = grams - fullBags * BAG_GRAMS
  return { grams, fullBags, remainderGrams }
}

export function bagsToLb(bags: number): number {
  return (bags * BAG_GRAMS) / LB_TO_GRAMS
}

export function packagedWeightLb(fullBags: number, remainderGrams: number): number {
  return (fullBags * BAG_GRAMS + remainderGrams) / LB_TO_GRAMS
}

export interface RoastBatchLike {
  weightLb: number
}

export function roastedAllocatedLb(roasts: RoastBatchLike[]): number {
  return roasts.reduce((sum, r) => sum + (Number(r.weightLb) || 0), 0)
}

export const BLEND_PERGAMINO_RATIO = 0.35
export const BLEND_SEGUNDA_RATIO = 0.65

export function blendRequiredRawMaterial(cantidadLb: number): { pergaminoLb: number; segundaLb: number } {
  const pergaminoLb = Math.round(cantidadLb * BLEND_PERGAMINO_RATIO * 100) / 100
  const segundaLb = Math.round((cantidadLb - pergaminoLb) * 100) / 100
  return { pergaminoLb, segundaLb }
}

export function gourmetMermaLb(p: {
  pergaminoUsedLb: number
  trilladoWeightLb: number
  roasts: RoastBatchLike[]
  pesoTuesteResultLb: number
  reservaCafeteriaLb: number
  molidoWeightLb: number
}): number {
  const roastedTotal = roastedAllocatedLb(p.roasts)
  const restanteParaMolido = Math.max(p.pesoTuesteResultLb - p.reservaCafeteriaLb, 0)
  const mermaTrillado = Math.max(p.pergaminoUsedLb - p.trilladoWeightLb, 0)
  const mermaTueste = Math.max(roastedTotal - p.pesoTuesteResultLb, 0)
  const mermaMolido = Math.max(restanteParaMolido - p.molidoWeightLb, 0)
  return mermaTrillado + mermaTueste + mermaMolido
}

export function blendMermaLb(p: {
  pergaminoUsedLb: number
  segundaUsedLb: number
  trilladoWeightLb: number
  roasts: RoastBatchLike[]
  pesoTuesteResultLb: number
  molidoMezclaWeightLb: number
}): number {
  const totalRawInput = p.pergaminoUsedLb + p.segundaUsedLb
  const roastedTotal = roastedAllocatedLb(p.roasts)
  const mermaTrillado = Math.max(totalRawInput - p.trilladoWeightLb, 0)
  const mermaTueste = Math.max(roastedTotal - p.pesoTuesteResultLb, 0)
  const mermaMolido = Math.max(p.pesoTuesteResultLb - p.molidoMezclaWeightLb, 0)
  return mermaTrillado + mermaTueste + mermaMolido
}
