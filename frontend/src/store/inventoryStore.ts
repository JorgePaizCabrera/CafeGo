import { useEffect, useSyncExternalStore } from 'react'
import { BAG_GRAMS, LB_TO_GRAMS } from '../utils/production'
import type { RawMaterialType, RoastType } from '../types/production'
import { apiFetch } from '../api/client'

export type StockMaterial =
  | RawMaterialType
  | 'granoCafeteria_claro' | 'granoCafeteria_medio' | 'granoCafeteria_oscuro'
  | 'gourmet'
  | 'blendBolsas'

export const STOCK_LABELS: Record<StockMaterial, string> = {
  pergamino: 'Pergamino',
  oro: 'Oro',
  natural: 'Natural',
  granoCafeteria_claro: 'Café en grano — Tueste Claro',
  granoCafeteria_medio: 'Café en grano — Tueste Medio',
  granoCafeteria_oscuro: 'Café en grano — Tueste Oscuro',
  gourmet: 'Gourmet (terminado)',
  blendBolsas: 'Blend (bolsas de 350 g)',
}

export const RAW_MATERIALS: RawMaterialType[] = ['pergamino', 'oro', 'natural']

const BACKEND_TO_FRONTEND_MATERIAL: Record<string, StockMaterial> = {
  pergamino: 'pergamino',
  oro: 'oro',
  natural: 'natural',
  grano_claro: 'granoCafeteria_claro',
  grano_medio: 'granoCafeteria_medio',
  grano_oscuro: 'granoCafeteria_oscuro',
  gourmet: 'gourmet',
  blend_bolsas: 'blendBolsas',
}

interface Stock {
  pergamino: number
  oro: number
  natural: number
  granoCafeteria: Record<RoastType, number>
  gourmetLb: number
  blendFinishedLb: number
}

interface Thresholds {
  pergamino: number
  oro: number
  natural: number
  granoCafeteria: number
}

interface InventoryState {
  stock: Stock
  thresholds: Thresholds
}

export type MovementKind = 'entrada' | 'salida'

export interface InventoryMovement {
  id: string
  fecha: string
  material: StockMaterial
  tipo: MovementKind
  cantidad: number
  motivo: string
  referenciaId?: string
  saldoResultante: number
  costoTotal: number | null
  esCompra: boolean
  costoCorregidoAt: string | null
}

function emptyState(): InventoryState {
  return {
    stock: { pergamino: 0, oro: 0, natural: 0, granoCafeteria: { claro: 0, medio: 0, oscuro: 0 }, gourmetLb: 0, blendFinishedLb: 0 },
    thresholds: { pergamino: 25, oro: 25, natural: 25, granoCafeteria: 5 },
  }
}

interface StockDto {
  material: string
  label: string
  cantidadLb: number
  minimoLb: number | null
}

interface MovimientoDto {
  id: string
  fecha: string
  material: string
  tipo: MovementKind
  cantidadLb: string
  motivo: string
  referenciaId: string | null
  saldoResultante: string
  costoTotal: string | null
  referenciaTipo: string | null
  costoCorregidoAt: string | null
}

function buildState(rows: StockDto[]): InventoryState {
  const s = emptyState()
  for (const row of rows) {
    const cantidad = Number(row.cantidadLb)
    switch (row.material) {
      case 'pergamino': s.stock.pergamino = cantidad; if (row.minimoLb != null) s.thresholds.pergamino = Number(row.minimoLb); break
      case 'oro': s.stock.oro = cantidad; if (row.minimoLb != null) s.thresholds.oro = Number(row.minimoLb); break
      case 'natural': s.stock.natural = cantidad; if (row.minimoLb != null) s.thresholds.natural = Number(row.minimoLb); break
      case 'grano_claro': s.stock.granoCafeteria.claro = cantidad; break
      case 'grano_medio': s.stock.granoCafeteria.medio = cantidad; break
      case 'grano_oscuro': s.stock.granoCafeteria.oscuro = cantidad; break
      case 'gourmet': s.stock.gourmetLb = cantidad; break
      case 'blend_bolsas': s.stock.blendFinishedLb = cantidad; break
    }
  }
  return s
}

function fromMovementDto(m: MovimientoDto): InventoryMovement {
  return {
    id: m.id,
    fecha: m.fecha,
    material: BACKEND_TO_FRONTEND_MATERIAL[m.material] ?? (m.material as StockMaterial),
    tipo: m.tipo,
    cantidad: Number(m.cantidadLb),
    motivo: m.motivo,
    referenciaId: m.referenciaId ?? undefined,
    saldoResultante: Number(m.saldoResultante),
    costoTotal: m.costoTotal == null ? null : Number(m.costoTotal),
    esCompra: m.tipo === 'entrada' && m.referenciaTipo === 'manual',
    costoCorregidoAt: m.costoCorregidoAt,
  }
}

export interface EmpaqueStockItem {
  tipo: string
  label: string
  cantidad: number
  minimo: number | null
}

export interface EmpaqueMovement {
  id: string
  fecha: string
  tipoEmpaque: string
  tipo: MovementKind
  cantidad: number
  motivo: string
  referenciaId?: string
  saldoResultante: number
  costoTotal: number | null
  esCompra: boolean
  costoCorregidoAt: string | null
}

interface EmpaqueMovimientoDto {
  id: string
  fecha: string
  tipoEmpaque: string
  tipo: MovementKind
  cantidad: number
  motivo: string
  referenciaId: string | null
  saldoResultante: number
  costoTotal: string | null
  referenciaTipo: string | null
  costoCorregidoAt: string | null
}

function fromEmpaqueMovementDto(m: EmpaqueMovimientoDto): EmpaqueMovement {
  return {
    id: m.id,
    fecha: m.fecha,
    tipoEmpaque: m.tipoEmpaque,
    tipo: m.tipo,
    cantidad: m.cantidad,
    motivo: m.motivo,
    referenciaId: m.referenciaId ?? undefined,
    saldoResultante: m.saldoResultante,
    costoTotal: m.costoTotal == null ? null : Number(m.costoTotal),
    esCompra: m.tipo === 'entrada' && m.referenciaTipo === 'manual',
    costoCorregidoAt: m.costoCorregidoAt,
  }
}

type Listener = () => void
const listeners = new Set<Listener>()

let state: InventoryState = emptyState()
let movements: InventoryMovement[] = []
let empaqueStock: EmpaqueStockItem[] = []
let empaqueMovements: EmpaqueMovement[] = []
let productoEmpacado: ProductoEmpacado = { comercial: 0, especial: 0, sueltoGramos: 0, blend: 0, blendSueltoGramos: 0 }
let loaded = false
let loadingPromise: Promise<void> | null = null

// Si los datos cambian mientras llega una recarga en segundo plano, esa respuesta ya viene atrasada y se descarta.
let version = 0

function notify() {
  version++
  listeners.forEach(l => l())
}

async function refresh(descartarSiCambia = false): Promise<void> {
  const vista = version
  const [stockRows, movRows, empaqueStockRows, empaqueMovRows, empacadoRow, granoUmbral] = await Promise.all([
    apiFetch<StockDto[]>('/api/inventario/stock'),
    apiFetch<MovimientoDto[]>('/api/inventario/movimientos'),
    apiFetch<EmpaqueStockItem[]>('/api/inventario/empaque/stock'),
    apiFetch<EmpaqueMovimientoDto[]>('/api/inventario/empaque/movimientos'),
    apiFetch<ProductoEmpacado>('/api/inventario/empacado'),
    apiFetch<{ minimoLb: number }>('/api/inventario/grano-cafeteria/umbral'),
  ])
  if (descartarSiCambia && vista !== version) return
  state = buildState(stockRows)
  state.thresholds.granoCafeteria = granoUmbral.minimoLb
  movements = movRows.map(fromMovementDto)
  empaqueStock = empaqueStockRows
  empaqueMovements = empaqueMovRows.map(fromEmpaqueMovementDto)
  productoEmpacado = empacadoRow
  notify()
}

export function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot() {
  return state
}

export function getMovementsSnapshot() {
  return movements
}

export function isInventoryLoaded() {
  return loaded
}

export function ensureInventoryLoaded(): Promise<void> {
  if (loaded) return Promise.resolve()
  if (!loadingPromise) {
    loadingPromise = refresh()
      .then(() => { loaded = true })
      .catch(err => {
        loadingPromise = null
        throw err
      })
  }
  return loadingPromise
}

export async function refreshInventory(): Promise<void> {
  await refresh()
  loaded = true
}

export async function recargarInventario(): Promise<void> {
  if (loaded) await refresh(true)
}

export function useInventory(): InventoryState {
  useEffect(() => { ensureInventoryLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function useInventoryLoaded(): boolean {
  useEffect(() => { ensureInventoryLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, isInventoryLoaded)
}

export function useMovements(): InventoryMovement[] {
  useEffect(() => { ensureInventoryLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getMovementsSnapshot)
}

export function getEmpaqueStockSnapshot() {
  return empaqueStock
}

export function getEmpaqueMovementsSnapshot() {
  return empaqueMovements
}

export function useEmpaqueStock(): EmpaqueStockItem[] {
  useEffect(() => { ensureInventoryLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getEmpaqueStockSnapshot)
}

export function useEmpaqueMovements(): EmpaqueMovement[] {
  useEffect(() => { ensureInventoryLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getEmpaqueMovementsSnapshot)
}

export function getRawMaterialStock(material: RawMaterialType): number {
  return state.stock[material]
}

export async function corregirCostoMateriaPrima(movimientoId: string, costoTotal: number | null): Promise<void> {
  await apiFetch<void>(`/api/inventario/movimientos/${encodeURIComponent(movimientoId)}/costo`, { method: 'PATCH', body: { costoTotal } })
  await refresh()
}

export async function registrarEntradaMateriaPrima(material: RawMaterialType, cantidadLb: number, motivo: string, costoTotal?: number): Promise<void> {
  await apiFetch<void>(`/api/inventario/materia-prima/${material}/entrada`, { method: 'POST', body: { cantidadLb, motivo, costoTotal } })
  await refresh()
}

export async function registrarSalidaMateriaPrima(material: RawMaterialType, cantidadLb: number, motivo: string): Promise<void> {
  await apiFetch<void>(`/api/inventario/materia-prima/${material}/salida`, { method: 'POST', body: { cantidadLb, motivo } })
  await refresh()
}

export async function updateThreshold(material: RawMaterialType, value: number): Promise<void> {
  await apiFetch<void>(`/api/inventario/materia-prima/${material}/umbral`, { method: 'PATCH', body: { minimoLb: Math.max(0, value) } })
  await refresh()
}

export async function descontarGranoCafeteria(tipo: RoastType, cantidadLb: number, motivo: string): Promise<void> {
  await apiFetch<void>(`/api/inventario/grano-cafeteria/${tipo}/salida`, { method: 'POST', body: { cantidadLb, motivo } })
  await refresh()
}

export async function updateGranoThreshold(value: number): Promise<void> {
  await apiFetch<void>(`/api/inventario/grano-cafeteria/umbral`, { method: 'PATCH', body: { minimoLb: Math.max(0, value) } })
  await refresh()
}

export function granoTotalLb(stock: Stock): number {
  return stock.granoCafeteria.claro + stock.granoCafeteria.medio + stock.granoCafeteria.oscuro
}

export type GourmetBagType = 'comercial' | 'especial'

export interface ProductoEmpacado {
  comercial: number
  especial: number
  sueltoGramos: number
  blend: number
  blendSueltoGramos: number
}

export function getProductoEmpacadoSnapshot() {
  return productoEmpacado
}

export function useProductoEmpacado(): ProductoEmpacado {
  useEffect(() => { ensureInventoryLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getProductoEmpacadoSnapshot)
}

export async function descontarGourmetTerminado(tipoBolsa: GourmetBagType, bolsas: number, motivo: string): Promise<void> {
  await apiFetch<void>(`/api/inventario/gourmet/salida`, { method: 'POST', body: { tipoBolsa, bolsas, motivo } })
  await refresh()
}

export async function empacarSobranteGourmet(tipoBolsa: GourmetBagType, bolsas: number, motivo: string): Promise<void> {
  await apiFetch<void>(`/api/inventario/gourmet/empacar-sobrante`, { method: 'POST', body: { tipoBolsa, bolsas, motivo } })
  await refresh()
}

export async function empacarSobranteBlend(bolsas: number, motivo: string): Promise<void> {
  await apiFetch<void>(`/api/inventario/blend/empacar-sobrante`, { method: 'POST', body: { bolsas, motivo } })
  await refresh()
}

export async function enviarBlendTerminado(bolsas: number, motivo: string): Promise<void> {
  await apiFetch<void>(`/api/inventario/blend/salida`, { method: 'POST', body: { bolsas, motivo } })
  await refresh()
}

export type AlertSeverity = 'critico'

export interface InventoryAlert {
  material: RawMaterialType | 'granoCafeteria'
  severity: AlertSeverity
  title: string
  message: string
}

export function getInventoryAlerts(): InventoryAlert[] {
  const alerts: InventoryAlert[] = []
  for (const material of RAW_MATERIALS) {
    const current = state.stock[material]
    const min = state.thresholds[material]
    if (current < min) {
      const label = STOCK_LABELS[material]
      alerts.push({
        material,
        severity: 'critico',
        title: `Pocas existencias de ${label}`,
        message: `Quedan ${current.toFixed(2)} lb de ${label}, por debajo del mínimo de ${min.toFixed(2)} lb.`,
      })
    }
  }
  const grano = granoTotalLb(state.stock)
  if (grano < state.thresholds.granoCafeteria) {
    alerts.push({
      material: 'granoCafeteria',
      severity: 'critico',
      title: 'Poco café en grano para cafetería',
      message: `Quedan ${grano.toFixed(2)} lb de café en grano (todos los tuestes), por debajo del mínimo de ${state.thresholds.granoCafeteria.toFixed(2)} lb.`,
    })
  }
  return alerts
}

export async function registrarEntradaEmpaque(tipo: string, cantidad: number, motivo: string, costoTotal?: number): Promise<void> {
  await apiFetch<void>(`/api/inventario/empaque/${encodeURIComponent(tipo)}/entrada`, { method: 'POST', body: { cantidad, motivo, costoTotal } })
  await refresh()
}

export async function corregirCostoEmpaque(movimientoId: string, costoTotal: number | null): Promise<void> {
  await apiFetch<void>(`/api/inventario/empaque/movimientos/${encodeURIComponent(movimientoId)}/costo`, { method: 'PATCH', body: { costoTotal } })
  await refresh()
}

export async function registrarSalidaEmpaque(tipo: string, cantidad: number, motivo: string): Promise<void> {
  await apiFetch<void>(`/api/inventario/empaque/${encodeURIComponent(tipo)}/salida`, { method: 'POST', body: { cantidad, motivo } })
  await refresh()
}

export async function updateEmpaqueUmbral(tipo: string, minimo: number): Promise<void> {
  await apiFetch<void>(`/api/inventario/empaque/${encodeURIComponent(tipo)}/umbral`, { method: 'PATCH', body: { minimo: Math.max(0, Math.floor(minimo)) } })
  await refresh()
}

export interface EmpaqueAlert {
  tipo: string
  title: string
  message: string
}

export function getEmpaqueAlerts(): EmpaqueAlert[] {
  const alerts: EmpaqueAlert[] = []
  for (const item of empaqueStock) {
    if (item.minimo != null && item.cantidad < item.minimo) {
      alerts.push({
        tipo: item.tipo,
        title: `Pocas bolsas de ${item.label}`,
        message: `Quedan ${item.cantidad} bolsas de ${item.label}, por debajo del mínimo de ${item.minimo}.`,
      })
    }
  }
  return alerts
}

export interface GastoItem {
  categoria: 'materia_prima' | 'empaque'
  clave: string
  label: string
  unidad: 'lb' | 'bolsas'
  cantidad: number
  cantidadConCosto: number
  costoTotal: number
  precioPromedio: number | null
  entradas: number
  entradasSinCosto: number
}

export interface GastosResumen {
  items: GastoItem[]
  totalMateriaPrima: number
  totalEmpaque: number
  total: number
  entradasSinCosto: number
}

export function fetchGastos(desde: Date, hasta: Date): Promise<GastosResumen> {
  const qs = new URLSearchParams({ desde: desde.toISOString(), hasta: hasta.toISOString() })
  return apiFetch<GastosResumen>(`/api/inventario/gastos?${qs}`)
}
