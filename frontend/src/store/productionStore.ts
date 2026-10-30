import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { apiFetch } from '../api/client'
import { getRawMaterialStock, refreshInventory } from './inventoryStore'
import {
  blendRequiredRawMaterial,
  roastedAllocatedLb,
  type BlendProduction,
  type BlendStep,
  type GourmetProduction,
  type GourmetStep,
  type Production,
  type ProductionStatus,
  type RoastBatch,
  type RoastType,
  type SegundaType,
} from '../types/production'

function toDateOnly(isoLike: string): string {
  return isoLike.slice(0, 10)
}

interface ProductionRoastDto {
  seq: number
  weightLb: string
  notes: string
}

function fromRoastDto(r: ProductionRoastDto): RoastBatch {
  return { id: r.seq, weightLb: Number(r.weightLb), notes: r.notes }
}

function toRoastBody(r: RoastBatch) {
  const { id: _id, ...rest } = r
  return rest
}

interface GourmetDto {
  id: string
  code: string
  status: ProductionStatus
  currentStepName: string
  fecha: string
  pergaminoUsedLb: string
  trilladoWeightLb: string
  roastType: RoastType
  pesoTuesteResultLb: string
  reservaCafeteriaLb: string
  molidoWeightLb: string
  actualFullBags: number
  actualRemainderGrams: string
  comercialBags: number
  especialBags: number
  notas: string
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
  roasts: ProductionRoastDto[]
}

interface BlendDto {
  id: string
  code: string
  status: ProductionStatus
  currentStepName: string
  fecha: string
  cantidadPlanificadaLb: string
  segundaType: SegundaType
  pergaminoUsedLb: string
  segundaUsedLb: string
  trilladoWeightLb: string
  pesoTuesteResultLb: string
  molidoMezclaWeightLb: string
  actualFullBags: number
  actualRemainderGrams: string
  notas: string
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
  roasts: ProductionRoastDto[]
}

function fromGourmetDto(dto: GourmetDto): GourmetProduction {
  return {
    id: dto.id,
    code: dto.code,
    type: 'gourmet',
    status: dto.status,
    currentStepName: dto.currentStepName as GourmetStep,
    fecha: toDateOnly(dto.fecha),
    pergaminoUsedLb: Number(dto.pergaminoUsedLb),
    trilladoWeightLb: Number(dto.trilladoWeightLb),
    roastType: dto.roastType,
    roasts: dto.roasts.map(fromRoastDto),
    pesoTuesteResultLb: Number(dto.pesoTuesteResultLb),
    reservaCafeteriaLb: Number(dto.reservaCafeteriaLb),
    molidoWeightLb: Number(dto.molidoWeightLb),
    actualFullBags: dto.actualFullBags,
    actualRemainderGrams: Number(dto.actualRemainderGrams),
    comercialBags: dto.comercialBags,
    especialBags: dto.especialBags,
    notas: dto.notas,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    finalizedAt: dto.finalizedAt,
  }
}

function fromBlendDto(dto: BlendDto): BlendProduction {
  return {
    id: dto.id,
    code: dto.code,
    type: 'blend',
    status: dto.status,
    currentStepName: dto.currentStepName as BlendStep,
    fecha: toDateOnly(dto.fecha),
    cantidadPlanificadaLb: Number(dto.cantidadPlanificadaLb),
    segundaType: dto.segundaType,
    pergaminoUsedLb: Number(dto.pergaminoUsedLb),
    segundaUsedLb: Number(dto.segundaUsedLb),
    trilladoWeightLb: Number(dto.trilladoWeightLb),
    roasts: dto.roasts.map(fromRoastDto),
    pesoTuesteResultLb: Number(dto.pesoTuesteResultLb),
    molidoMezclaWeightLb: Number(dto.molidoMezclaWeightLb),
    actualFullBags: dto.actualFullBags,
    actualRemainderGrams: Number(dto.actualRemainderGrams),
    notas: dto.notas,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    finalizedAt: dto.finalizedAt,
  }
}

type Listener = () => void
const listeners = new Set<Listener>()

let gourmetProductions: GourmetProduction[] = []
let blendProductions: BlendProduction[] = []
let loaded = false
let loadingPromise: Promise<void> | null = null

// Si los datos cambian mientras llega una recarga en segundo plano, esa respuesta ya viene atrasada y se descarta.
let version = 0

function notify() {
  version++
  listeners.forEach(l => l())
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isProductionsLoaded() {
  return loaded
}

export function ensureProductionsLoaded(): Promise<void> {
  if (loaded) return Promise.resolve()
  if (!loadingPromise) {
    loadingPromise = Promise.all([
      apiFetch<GourmetDto[]>('/api/produccion/gourmet'),
      apiFetch<BlendDto[]>('/api/produccion/blend'),
    ])
      .then(([g, b]) => {
        gourmetProductions = g.map(fromGourmetDto)
        blendProductions = b.map(fromBlendDto)
        loaded = true
        notify()
      })
      .catch(err => {
        loadingPromise = null
        throw err
      })
  }
  return loadingPromise
}

export async function recargarProducciones(): Promise<void> {
  if (!loaded) return
  const vista = version
  const [g, b] = await Promise.all([
    apiFetch<GourmetDto[]>('/api/produccion/gourmet'),
    apiFetch<BlendDto[]>('/api/produccion/blend'),
  ])
  if (vista !== version) return
  gourmetProductions = g.map(fromGourmetDto)
  blendProductions = b.map(fromBlendDto)
  notify()
}

export function getGourmetProductions(): GourmetProduction[] {
  return gourmetProductions
}

export function getBlendProductions(): BlendProduction[] {
  return blendProductions
}

export function getGourmetProduction(id: string): GourmetProduction | undefined {
  return gourmetProductions.find(p => p.id === id)
}

export function getBlendProduction(id: string): BlendProduction | undefined {
  return blendProductions.find(p => p.id === id)
}

export function getProduction(id: string): Production | undefined {
  return getGourmetProduction(id) ?? getBlendProduction(id)
}

export function useGourmetProductions(): GourmetProduction[] {
  useEffect(() => { ensureProductionsLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getGourmetProductions)
}

export function useBlendProductions(): BlendProduction[] {
  useEffect(() => { ensureProductionsLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getBlendProductions)
}

export function useProductionsLoaded(): boolean {
  useEffect(() => { ensureProductionsLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, isProductionsLoaded)
}

export function useAllProductions(): Production[] {
  const gourmet = useGourmetProductions()
  const blend = useBlendProductions()
  return useMemo(
    () => [...gourmet, ...blend].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [gourmet, blend]
  )
}

export function useGourmetProduction(id: string | undefined): GourmetProduction | undefined {
  const all = useGourmetProductions()
  return useMemo(() => (id ? all.find(p => p.id === id) : undefined), [all, id])
}

export function useBlendProduction(id: string | undefined): BlendProduction | undefined {
  const all = useBlendProductions()
  return useMemo(() => (id ? all.find(p => p.id === id) : undefined), [all, id])
}

export function useProduction(id: string | undefined): Production | undefined {
  const gourmet = useGourmetProduction(id)
  const blend = useBlendProduction(id)
  return gourmet ?? blend
}

export async function startGourmetProduction(input: { fecha: string, pergaminoUsedLb: number, notas: string }): Promise<GourmetProduction> {
  const dto = await apiFetch<GourmetDto>('/api/produccion/gourmet', { method: 'POST', body: input })
  const production = fromGourmetDto(dto)
  gourmetProductions = [production, ...gourmetProductions]
  notify()
  return production
}

type GourmetPatch = Partial<Omit<GourmetProduction, 'id' | 'code' | 'type' | 'status' | 'createdAt' | 'finalizedAt'>>

export async function updateGourmetProduction(id: string, patch: GourmetPatch): Promise<GourmetProduction> {
  const body: Record<string, unknown> = {}
  if (patch.fecha !== undefined) body.fecha = patch.fecha
  if (patch.currentStepName !== undefined) body.currentStepName = patch.currentStepName
  if (patch.trilladoWeightLb !== undefined) body.trilladoWeightLb = patch.trilladoWeightLb
  if (patch.roastType !== undefined) body.roastType = patch.roastType
  if (patch.roasts !== undefined) body.roasts = patch.roasts.map(toRoastBody)
  if (patch.pesoTuesteResultLb !== undefined) body.pesoTuesteResultLb = patch.pesoTuesteResultLb
  if (patch.reservaCafeteriaLb !== undefined) body.reservaCafeteriaLb = patch.reservaCafeteriaLb
  if (patch.molidoWeightLb !== undefined) body.molidoWeightLb = patch.molidoWeightLb
  if (patch.actualFullBags !== undefined) body.actualFullBags = patch.actualFullBags
  if (patch.actualRemainderGrams !== undefined) body.actualRemainderGrams = patch.actualRemainderGrams
  if (patch.comercialBags !== undefined) body.comercialBags = patch.comercialBags
  if (patch.especialBags !== undefined) body.especialBags = patch.especialBags
  if (patch.notas !== undefined) body.notas = patch.notas

  const dto = await apiFetch<GourmetDto>(`/api/produccion/gourmet/${id}`, { method: 'PATCH', body })
  const production = fromGourmetDto(dto)
  gourmetProductions = gourmetProductions.map(p => (p.id === id ? production : p))
  notify()
  return production
}

export async function finalizeGourmetProduction(id: string): Promise<GourmetProduction> {
  const dto = await apiFetch<GourmetDto>(`/api/produccion/gourmet/${id}/finalizar`, { method: 'POST' })
  const production = fromGourmetDto(dto)
  gourmetProductions = gourmetProductions.map(p => (p.id === id ? production : p))
  notify()
  await refreshInventory()
  return production
}

export async function deleteGourmetProduction(id: string): Promise<void> {
  await apiFetch<void>(`/api/produccion/gourmet/${id}`, { method: 'DELETE' })
  gourmetProductions = gourmetProductions.filter(p => p.id !== id)
  notify()
}

export interface BlendValidation {
  pergaminoLb: number
  segundaLb: number
  pergaminoAvailable: number
  segundaAvailable: number
  pergaminoFaltante: number
  segundaFaltante: number
  isValid: boolean
}

export function validateBlendPlan(cantidadLb: number, segundaType: SegundaType): BlendValidation {
  const { pergaminoLb, segundaLb } = blendRequiredRawMaterial(cantidadLb)
  const pergaminoAvailable = getRawMaterialStock('pergamino')
  const segundaAvailable = getRawMaterialStock(segundaType)
  const pergaminoFaltante = Math.max(pergaminoLb - pergaminoAvailable, 0)
  const segundaFaltante = Math.max(segundaLb - segundaAvailable, 0)
  return {
    pergaminoLb,
    segundaLb,
    pergaminoAvailable,
    segundaAvailable,
    pergaminoFaltante,
    segundaFaltante,
    isValid: pergaminoFaltante === 0 && segundaFaltante === 0 && cantidadLb > 0,
  }
}

export async function startBlendProduction(input: { fecha: string, cantidadPlanificadaLb: number, segundaType: SegundaType, notas: string }): Promise<BlendProduction> {
  const dto = await apiFetch<BlendDto>('/api/produccion/blend', { method: 'POST', body: input })
  const production = fromBlendDto(dto)
  blendProductions = [production, ...blendProductions]
  notify()
  return production
}

type BlendPatch = Partial<Omit<BlendProduction, 'id' | 'code' | 'type' | 'status' | 'createdAt' | 'finalizedAt'>>

export async function updateBlendProduction(id: string, patch: BlendPatch): Promise<BlendProduction> {
  const body: Record<string, unknown> = {}
  if (patch.fecha !== undefined) body.fecha = patch.fecha
  if (patch.currentStepName !== undefined) body.currentStepName = patch.currentStepName
  if (patch.trilladoWeightLb !== undefined) body.trilladoWeightLb = patch.trilladoWeightLb
  if (patch.roasts !== undefined) body.roasts = patch.roasts.map(toRoastBody)
  if (patch.pesoTuesteResultLb !== undefined) body.pesoTuesteResultLb = patch.pesoTuesteResultLb
  if (patch.molidoMezclaWeightLb !== undefined) body.molidoMezclaWeightLb = patch.molidoMezclaWeightLb
  if (patch.actualFullBags !== undefined) body.actualFullBags = patch.actualFullBags
  if (patch.actualRemainderGrams !== undefined) body.actualRemainderGrams = patch.actualRemainderGrams
  if (patch.notas !== undefined) body.notas = patch.notas

  const dto = await apiFetch<BlendDto>(`/api/produccion/blend/${id}`, { method: 'PATCH', body })
  const production = fromBlendDto(dto)
  blendProductions = blendProductions.map(p => (p.id === id ? production : p))
  notify()
  return production
}

export async function finalizeBlendProduction(id: string): Promise<BlendProduction> {
  const dto = await apiFetch<BlendDto>(`/api/produccion/blend/${id}/finalizar`, { method: 'POST' })
  const production = fromBlendDto(dto)
  blendProductions = blendProductions.map(p => (p.id === id ? production : p))
  notify()
  await refreshInventory()
  return production
}

export async function deleteBlendProduction(id: string): Promise<void> {
  await apiFetch<void>(`/api/produccion/blend/${id}`, { method: 'DELETE' })
  blendProductions = blendProductions.filter(p => p.id !== id)
  notify()
}

export { roastedAllocatedLb }
export type { GourmetStep, BlendStep, RoastBatch, RoastType }
