import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { CoffeeType, Order, OrderStatus, PackageAllocation, PackageType, Roast } from '../types/order'
import { PACKAGE_TYPES } from '../types/order'
import { apiFetch } from '../api/client'
import { ensureClientsLoaded, getClient, subscribe as subscribeClients } from './clientsStore'
import { refreshInventory } from './inventoryStore'

const STATUS_FROM_BACKEND: Record<string, OrderStatus> = {
  Recibido: 'Recibido',
  EnPreparacion: 'En preparación',
  EnTueste: 'En tueste',
  EnMolienda: 'En molienda',
  EnEmpaque: 'En empaque',
  Finalizado: 'Finalizado',
}

export function orderStatusFromBackend(status: string): OrderStatus {
  return STATUS_FROM_BACKEND[status] ?? 'Recibido'
}

interface RoastDto {
  seq: number
  weightLb: string
  initialTemp: string
  returnTemp: string
  returnTime: string
  dehydrationTemp: string
  dehydrationTime: string
  caramelizationTemp: string
  caramelizationTime: string
  crackTemp: string
  crackTime: string
  finalTemp: string
  finalTime: string
  notes: string
}

interface OrdenDto {
  id: string
  orderNo: string
  clienteId: string
  receivedDate: string
  estimatedDate: string
  coffeeType: CoffeeType
  initialWeight: string
  humidity: string
  cleaningWeight: string
  threshingWeight: string
  finalWeight: string
  roastType: string
  grindType: string
  totalPrice: string
  pagado: boolean
  bagSizeGrams: string
  actualFullBags: number
  actualRemainderGrams: string
  packageAllocation: Partial<PackageAllocation>
  incompletePackageType: PackageType
  status: string
  currentStepName: string
  createdAt: string
  updatedAt: string
  finalizedAt: string | null
  pagadoAt: string | null
  seguimientoToken: string
  seguimientoActivo: boolean
  roasts: RoastDto[]
}

function emptyAllocation(): PackageAllocation {
  return Object.fromEntries(PACKAGE_TYPES.map(t => [t, 0])) as PackageAllocation
}

function fromRoastDto(r: RoastDto): Roast {
  return {
    id: r.seq,
    weightLb: Number(r.weightLb),
    initialTemp: Number(r.initialTemp),
    returnTemp: Number(r.returnTemp),
    returnTime: r.returnTime,
    dehydrationTemp: Number(r.dehydrationTemp),
    dehydrationTime: r.dehydrationTime,
    caramelizationTemp: Number(r.caramelizationTemp),
    caramelizationTime: r.caramelizationTime,
    crackTemp: Number(r.crackTemp),
    crackTime: r.crackTime,
    finalTemp: Number(r.finalTemp),
    finalTime: r.finalTime,
    notes: r.notes,
  }
}

function toRoastBody(r: Roast) {
  const { id: _id, ...rest } = r
  return rest
}

// Las columnas @db.Date llegan como datetime ISO; solo se conserva la fecha.
function toDateOnly(isoLike: string): string {
  return isoLike.slice(0, 10)
}

function fromDto(dto: OrdenDto): Order {
  const client = getClient(dto.clienteId)
  return {
    id: dto.id,
    orderNo: dto.orderNo,
    clientId: dto.clienteId,
    clientName: client?.name ?? '',
    phone: client?.phone ?? '',
    city: client?.city ?? '',
    receivedDate: toDateOnly(dto.receivedDate),
    estimatedDate: toDateOnly(dto.estimatedDate),
    coffeeType: dto.coffeeType,
    initialWeight: Number(dto.initialWeight),
    humidity: Number(dto.humidity),
    cleaningWeight: Number(dto.cleaningWeight),
    threshingWeight: Number(dto.threshingWeight),
    roasts: dto.roasts.map(fromRoastDto),
    finalWeight: Number(dto.finalWeight),
    roastType: dto.roastType,
    grindType: dto.grindType,
    totalPrice: Number(dto.totalPrice),
    pagado: dto.pagado,
    bagSizeGrams: Number(dto.bagSizeGrams),
    actualFullBags: dto.actualFullBags,
    actualRemainderGrams: Number(dto.actualRemainderGrams),
    packageAllocation: { ...emptyAllocation(), ...dto.packageAllocation },
    incompletePackageType: dto.incompletePackageType,
    status: orderStatusFromBackend(dto.status),
    currentStepName: dto.currentStepName,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    finalizedAt: dto.finalizedAt,
    pagadoAt: dto.pagadoAt,
    seguimientoToken: dto.seguimientoToken,
    seguimientoActivo: dto.seguimientoActivo,
  }
}

type Listener = () => void
const listeners = new Set<Listener>()

let orders: Order[] = []
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

export function getSnapshot() {
  return orders
}

export function isOrdersLoaded() {
  return loaded
}

let clientsWatchStarted = false

function watchClientChanges() {
  if (clientsWatchStarted) return
  clientsWatchStarted = true
  subscribeClients(() => {
    if (!loaded || orders.length === 0) return
    let changed = false
    orders = orders.map(o => {
      const client = getClient(o.clientId)
      if (!client || (client.name === o.clientName && client.phone === o.phone && client.city === o.city)) return o
      changed = true
      return { ...o, clientName: client.name, phone: client.phone, city: client.city }
    })
    if (changed) notify()
  })
}

export function ensureOrdersLoaded(): Promise<void> {
  watchClientChanges()
  if (loaded) return Promise.resolve()
  if (!loadingPromise) {
    loadingPromise = ensureClientsLoaded()
      .then(() => apiFetch<OrdenDto[]>('/api/ordenes'))
      .then(rows => {
        orders = rows.map(fromDto)
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

export async function recargarOrdenes(): Promise<void> {
  if (!loaded) return
  const vista = version
  const rows = await apiFetch<OrdenDto[]>('/api/ordenes')
  if (vista !== version) return
  orders = rows.map(fromDto)
  notify()
}

export function getOrders(): Order[] {
  return orders
}

export function getOrder(id: string): Order | undefined {
  return orders.find(o => o.id === id)
}

export function getClientOrders(clientId: string): Order[] {
  return orders.filter(o => o.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

type CreateOrderInput = Omit<Order, 'id' | 'orderNo' | 'status' | 'createdAt' | 'updatedAt' | 'finalizedAt' | 'pagado' | 'pagadoAt' | 'seguimientoToken' | 'seguimientoActivo'>

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const dto = await apiFetch<OrdenDto>('/api/ordenes', {
    method: 'POST',
    body: {
      clienteId: input.clientId,
      receivedDate: input.receivedDate,
      estimatedDate: input.estimatedDate,
      coffeeType: input.coffeeType,
      initialWeight: input.initialWeight,
      humidity: input.humidity,
      cleaningWeight: input.cleaningWeight,
      threshingWeight: input.threshingWeight,
      roasts: input.roasts.map(toRoastBody),
      finalWeight: input.finalWeight,
      roastType: input.roastType,
      grindType: input.grindType,
      totalPrice: input.totalPrice,
      bagSizeGrams: input.bagSizeGrams,
      actualFullBags: input.actualFullBags,
      actualRemainderGrams: input.actualRemainderGrams,
      packageAllocation: input.packageAllocation,
      incompletePackageType: input.incompletePackageType,
      currentStepName: input.currentStepName,
    },
  })
  const order = fromDto(dto)
  orders = [order, ...orders]
  notify()
  return order
}

export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order> {
  const body: Record<string, unknown> = {}
  if (patch.receivedDate !== undefined) body.receivedDate = patch.receivedDate
  if (patch.estimatedDate !== undefined) body.estimatedDate = patch.estimatedDate
  if (patch.coffeeType !== undefined) body.coffeeType = patch.coffeeType
  if (patch.initialWeight !== undefined) body.initialWeight = patch.initialWeight
  if (patch.humidity !== undefined) body.humidity = patch.humidity
  if (patch.cleaningWeight !== undefined) body.cleaningWeight = patch.cleaningWeight
  if (patch.threshingWeight !== undefined) body.threshingWeight = patch.threshingWeight
  if (patch.roasts !== undefined) body.roasts = patch.roasts.map(toRoastBody)
  if (patch.finalWeight !== undefined) body.finalWeight = patch.finalWeight
  if (patch.roastType !== undefined) body.roastType = patch.roastType
  if (patch.grindType !== undefined) body.grindType = patch.grindType
  if (patch.totalPrice !== undefined) body.totalPrice = patch.totalPrice
  if (patch.bagSizeGrams !== undefined) body.bagSizeGrams = patch.bagSizeGrams
  if (patch.actualFullBags !== undefined) body.actualFullBags = patch.actualFullBags
  if (patch.actualRemainderGrams !== undefined) body.actualRemainderGrams = patch.actualRemainderGrams
  if (patch.packageAllocation !== undefined) body.packageAllocation = patch.packageAllocation
  if (patch.incompletePackageType !== undefined) body.incompletePackageType = patch.incompletePackageType
  if (patch.currentStepName !== undefined) body.currentStepName = patch.currentStepName
  if (patch.pagado !== undefined) body.pagado = patch.pagado

  const dto = await apiFetch<OrdenDto>(`/api/ordenes/${id}`, { method: 'PATCH', body })
  const order = fromDto(dto)
  orders = orders.map(o => (o.id === id ? order : o))
  notify()
  return order
}

export async function finalizeOrder(id: string): Promise<Order> {
  const dto = await apiFetch<OrdenDto>(`/api/ordenes/${id}/finalizar`, { method: 'POST' })
  const order = fromDto(dto)
  orders = orders.map(o => (o.id === id ? order : o))
  notify()
  // Al finalizar se descuentan bolsas de empaque: el inventario en memoria debe reflejarlo de inmediato.
  await refreshInventory()
  return order
}

export async function setOrderPagado(id: string, pagado: boolean): Promise<Order> {
  const dto = await apiFetch<OrdenDto>(`/api/ordenes/${id}/pagado`, { method: 'PATCH', body: { pagado } })
  const order = fromDto(dto)
  orders = orders.map(o => (o.id === id ? order : o))
  notify()
  return order
}

export async function activarSeguimiento(id: string): Promise<Order> {
  const dto = await apiFetch<OrdenDto>(`/api/ordenes/${id}/seguimiento`, { method: 'POST' })
  const order = fromDto(dto)
  orders = orders.map(o => (o.id === id ? order : o))
  notify()
  return order
}

export async function deleteOrder(id: string): Promise<void> {
  await apiFetch<void>(`/api/ordenes/${id}`, { method: 'DELETE' })
  orders = orders.filter(o => o.id !== id)
  notify()
}

export function deleteOrdersByClient(clientId: string): void {
  orders = orders.filter(o => o.clientId !== clientId)
  notify()
}

export function useOrders(): Order[] {
  useEffect(() => { ensureOrdersLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function useOrdersLoaded(): boolean {
  useEffect(() => { ensureOrdersLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, isOrdersLoaded)
}

export function useOrder(id: string | undefined): Order | undefined {
  const all = useOrders()
  return useMemo(() => (id ? all.find(o => o.id === id) : undefined), [all, id])
}

export function useClientOrders(clientId: string | undefined): Order[] {
  const all = useOrders()
  return useMemo(
    () => (clientId ? all.filter(o => o.clientId === clientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [all, clientId]
  )
}
