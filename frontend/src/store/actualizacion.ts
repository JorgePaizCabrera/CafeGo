import { useEffect } from 'react'
import { recargarClientes } from './clientsStore'
import { recargarInventario } from './inventoryStore'
import { recargarOrdenes } from './ordersStore'
import { recargarProducciones } from './productionStore'

// Varias personas pueden trabajar a la vez: los datos se traen de nuevo en segundo plano.
// Los formularios guardan su propia copia, así que esto no toca lo que alguien esté escribiendo.
const ACTUALIZAR_CADA_MS = 30_000

const oyentes = new Set<() => void>()
let recargando = false

async function recargarTodo() {
  if (recargando || document.visibilityState !== 'visible') return
  recargando = true
  try {
    await Promise.allSettled([recargarClientes(), recargarOrdenes(), recargarProducciones(), recargarInventario()])
    oyentes.forEach(oyente => oyente())
  } finally {
    recargando = false
  }
}

export function alActualizarDatos(oyente: () => void) {
  oyentes.add(oyente)
  return () => { oyentes.delete(oyente) }
}

export function useActualizacionAutomatica() {
  useEffect(() => {
    const intervalo = setInterval(recargarTodo, ACTUALIZAR_CADA_MS)
    document.addEventListener('visibilitychange', recargarTodo)
    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', recargarTodo)
    }
  }, [])
}
