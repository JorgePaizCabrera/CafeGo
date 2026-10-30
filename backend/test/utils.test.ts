import { describe, it, expect } from 'vitest'
import { formatFolio, parseFolioSeq } from '../src/utils/folio'
import { statusForCompletedStep } from '../src/utils/orderStatus'
import {
  bagsToLb, blendMermaLb, blendRequiredRawMaterial, gourmetMermaLb, packagedWeightLb, packagingFromLb,
} from '../src/utils/production'

describe('folio', () => {
  it('rellena el número con ceros a la izquierda hasta 4 dígitos', () => {
    expect(formatFolio('GC', 1)).toBe('GC-0001')
    expect(formatFolio('GG', 42)).toBe('GG-0042')
  })

  it('no trunca números de más de 4 dígitos', () => {
    expect(formatFolio('GB', 12345)).toBe('GB-12345')
  })

  it('parsea el número de secuencia de un folio válido', () => {
    expect(parseFolioSeq('GC-0001')).toBe(1)
    expect(parseFolioSeq('GG-0042')).toBe(42)
  })

  it('devuelve null para texto que no calza con el formato', () => {
    expect(parseFolioSeq('no-es-un-folio')).toBeNull()
    expect(parseFolioSeq('')).toBeNull()
  })
})

describe('statusForCompletedStep', () => {
  it('mapea cada paso conocido a su estado', () => {
    expect(statusForCompletedStep('Recepción')).toBe('Recibido')
    expect(statusForCompletedStep('Limpieza')).toBe('EnPreparacion')
    expect(statusForCompletedStep('Trillado')).toBe('EnPreparacion')
    expect(statusForCompletedStep('Tuestes')).toBe('EnTueste')
    expect(statusForCompletedStep('Postproceso')).toBe('EnMolienda')
    expect(statusForCompletedStep('Empaque')).toBe('EnEmpaque')
    expect(statusForCompletedStep('Resumen')).toBe('EnEmpaque')
  })

  it('cae a Recibido para un paso desconocido', () => {
    expect(statusForCompletedStep('Paso inventado')).toBe('Recibido')
  })
})

describe('conversiones de bolsas/libras', () => {
  it('bagsToLb es la inversa de packagingFromLb para bolsas completas', () => {
    const lb = bagsToLb(10)
    expect(packagingFromLb(lb).fullBags).toBe(10)
    expect(packagingFromLb(lb).remainderGrams).toBeCloseTo(0, 6)
  })

  it('packagedWeightLb combina bolsas completas y sobrante', () => {
    const onlyBags = packagedWeightLb(5, 0)
    expect(onlyBags).toBeCloseTo(bagsToLb(5), 6)
    const withRemainder = packagedWeightLb(0, 350)
    expect(withRemainder).toBeCloseTo(bagsToLb(1), 6)
  })

  it('packagingFromLb separa bolsas completas y sobrante en gramos', () => {
    const { fullBags, remainderGrams } = packagingFromLb(bagsToLb(3) + 0.1)
    expect(fullBags).toBe(3)
    expect(remainderGrams).toBeGreaterThan(0)
  })
})

describe('blendRequiredRawMaterial', () => {
  it('reparte 35% pergamino / 65% segunda', () => {
    const { pergaminoLb, segundaLb } = blendRequiredRawMaterial(100)
    expect(pergaminoLb).toBeCloseTo(35, 2)
    expect(segundaLb).toBeCloseTo(65, 2)
    expect(pergaminoLb + segundaLb).toBeCloseTo(100, 2)
  })
})

describe('gourmetMermaLb', () => {
  it('es 0 cuando no hay pérdida en ninguna etapa', () => {
    const merma = gourmetMermaLb({
      pergaminoUsedLb: 100,
      trilladoWeightLb: 100,
      roasts: [{ weightLb: 100 }],
      pesoTuesteResultLb: 100,
      reservaCafeteriaLb: 0,
      molidoWeightLb: 100,
    })
    expect(merma).toBe(0)
  })

  it('suma la merma de trillado + tueste + molido, sin contar la reserva de cafetería', () => {
    const merma = gourmetMermaLb({
      pergaminoUsedLb: 100,
      trilladoWeightLb: 90, // -10 trillado
      roasts: [{ weightLb: 90 }],
      pesoTuesteResultLb: 80, // -10 tueste
      reservaCafeteriaLb: 20,
      molidoWeightLb: 55, // restante para moler = 80-20=60, -5 molido
    })
    expect(merma).toBeCloseTo(25, 2)
  })
})

describe('blendMermaLb', () => {
  it('suma la merma de trillado + tueste + molido sobre el total de materia prima', () => {
    const merma = blendMermaLb({
      pergaminoUsedLb: 35,
      segundaUsedLb: 65,
      trilladoWeightLb: 95, // total 100 -> -5 trillado
      roasts: [{ weightLb: 90 }], // igual al resultado del tueste -> 0 merma de tueste
      pesoTuesteResultLb: 90,
      molidoMezclaWeightLb: 85, // -5 molido
    })
    expect(merma).toBeCloseTo(10, 2)
  })
})
