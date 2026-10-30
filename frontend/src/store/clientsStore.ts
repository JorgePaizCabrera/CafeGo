import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { Client, ClientWithOrders } from '../types/order'
import { apiFetch } from '../api/client'
import { deleteOrdersByClient, useOrders } from './ordersStore'

interface ClienteDto {
  id: string
  nombre: string
  ciudad: string
  telefono: string
  createdAt: string
  updatedAt: string
}

function fromDto(c: ClienteDto): Client {
  return { id: c.id, name: c.nombre, city: c.ciudad, phone: c.telefono, createdAt: c.createdAt, updatedAt: c.updatedAt }
}

type Listener = () => void
const listeners = new Set<Listener>()

let clients: Client[] = []
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
  return clients
}

export function isClientsLoaded() {
  return loaded
}

export function ensureClientsLoaded(): Promise<void> {
  if (loaded) return Promise.resolve()
  if (!loadingPromise) {
    loadingPromise = apiFetch<ClienteDto[]>('/api/clientes')
      .then(rows => {
        clients = rows.map(fromDto)
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

export async function recargarClientes(): Promise<void> {
  if (!loaded) return
  const vista = version
  const rows = await apiFetch<ClienteDto[]>('/api/clientes')
  if (vista !== version) return
  clients = rows.map(fromDto)
  notify()
}

export function getClients(): Client[] {
  return clients
}

export function getClient(id: string): Client | undefined {
  return clients.find(c => c.id === id)
}

type CreateClientInput = { name: string, city: string, phone: string }

export async function createClient(input: CreateClientInput): Promise<Client> {
  const dto = await apiFetch<ClienteDto>('/api/clientes', {
    method: 'POST',
    body: { nombre: input.name, ciudad: input.city, telefono: input.phone },
  })
  const client = fromDto(dto)
  clients = [client, ...clients]
  notify()
  return client
}

export async function updateClient(id: string, patch: Partial<CreateClientInput>): Promise<Client> {
  const body: Record<string, string> = {}
  if (patch.name !== undefined) body.nombre = patch.name
  if (patch.city !== undefined) body.ciudad = patch.city
  if (patch.phone !== undefined) body.telefono = patch.phone

  const dto = await apiFetch<ClienteDto>(`/api/clientes/${id}`, { method: 'PATCH', body })
  const client = fromDto(dto)
  clients = clients.map(c => (c.id === id ? client : c))
  notify()
  return client
}

export async function deleteClient(id: string): Promise<void> {
  await apiFetch<void>(`/api/clientes/${id}`, { method: 'DELETE' })
  clients = clients.filter(c => c.id !== id)
  notify()
  deleteOrdersByClient(id)
}

export function useClients(): Client[] {
  useEffect(() => { ensureClientsLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function useClientsLoaded(): boolean {
  useEffect(() => { ensureClientsLoaded().catch(() => {}) }, [])
  return useSyncExternalStore(subscribe, isClientsLoaded)
}

export function useClient(id: string | undefined): Client | undefined {
  const all = useClients()
  return useMemo(() => (id ? all.find(c => c.id === id) : undefined), [all, id])
}

export function useClientsWithOrders(): ClientWithOrders[] {
  const allClients = useClients()
  const allOrders = useOrders()

  return useMemo(() => {
    const list = allClients.map(client => ({
      ...client,
      orders: allOrders.filter(o => o.clientId === client.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }))
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [allClients, allOrders])
}
