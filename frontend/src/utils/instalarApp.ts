import { confirmDialog, toast } from '../components/ui/feedback'

const CLAVE_INSTALADA = 'gocafe-app-instalada'

interface EventoInstalar extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let eventoInstalar: EventoInstalar | null = null

function recordarInstalada(instalada: boolean) {
  try {
    if (instalada) localStorage.setItem(CLAVE_INSTALADA, '1')
    else localStorage.removeItem(CLAVE_INSTALADA)
  } catch { /* sin almacenamiento solo se pierde el aviso de "ya instalada" */ }
}

function recuerdaInstalada(): boolean {
  try {
    return localStorage.getItem(CLAVE_INSTALADA) === '1'
  } catch {
    return false
  }
}

// El navegador avisa una sola vez y muy pronto, por eso se escucha antes de montar React.
// Si vuelve a ofrecer la instalación es porque la app no está (o la desinstalaron).
export function escucharInstalacion() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault()
    eventoInstalar = e as EventoInstalar
    recordarInstalada(false)
  })
  window.addEventListener('appinstalled', () => {
    eventoInstalar = null
    recordarInstalada(true)
  })
}

// El .exe (127.0.0.1) y el acceso por IP en la red local (http) no pueden instalarse como app.
export function puedeInstalarse(): boolean {
  return window.isSecureContext && window.location.hostname !== '127.0.0.1'
}

function abiertaComoApp(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

async function yaInstalada(): Promise<boolean> {
  if (recuerdaInstalada()) return true
  const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<unknown[]> }
  try {
    return ((await nav.getInstalledRelatedApps?.()) ?? []).length > 0
  } catch {
    return false
  }
}

const AVISO_INSTALADA = 'La app ya ha sido instalada en este dispositivo.'

export async function instalarApp() {
  if (abiertaComoApp()) {
    toast.info(AVISO_INSTALADA)
    return
  }

  if (eventoInstalar) {
    const evento = eventoInstalar
    eventoInstalar = null
    await evento.prompt()
    const { outcome } = await evento.userChoice
    if (outcome === 'accepted') {
      recordarInstalada(true)
      toast.success('App instalada. Ya puedes abrir Go Café desde tu escritorio o pantalla de inicio.')
    }
    return
  }

  if (await yaInstalada()) {
    toast.info(AVISO_INSTALADA)
    return
  }

  const iphone = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  await confirmDialog({
    title: 'Instalar Go Café',
    message: iphone
      ? 'En Safari toca el botón Compartir y elige "Agregar a inicio".'
      : 'Abre el menú del navegador (⋮) y elige "Instalar Go Café" o "Agregar a la pantalla principal". Funciona en Chrome y Edge.',
    confirmLabel: 'Entendido',
    soloConfirmar: true,
  })
}
