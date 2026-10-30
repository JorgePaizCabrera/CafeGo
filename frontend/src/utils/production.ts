export const LB_TO_GRAMS = 453.59237
export const BAG_GRAMS = 350
export const MAX_ROAST_LB = 15

export function lbToGrams(lb: number) { return lb * LB_TO_GRAMS }
export function packagingFromLb(lb: number, bagGrams: number = BAG_GRAMS) {
  const grams = lbToGrams(lb)
  const fullBags = Math.floor(grams / bagGrams)
  const remainderGrams = grams - fullBags * bagGrams
  return { grams, fullBags, remainderGrams }
}

export function bagsToLb(bags: number): number {
  return (bags * BAG_GRAMS) / LB_TO_GRAMS
}

export function packagedWeightLb(fullBags: number, remainderGrams: number): number {
  return (fullBags * BAG_GRAMS + remainderGrams) / LB_TO_GRAMS
}
