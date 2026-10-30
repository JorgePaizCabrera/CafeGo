const TOKEN_KEY = 'gocafe.auth.token.v1'

type Listener = () => void
const listeners = new Set<Listener>()

// La sesión vive en sessionStorage: al cerrar la ventana o la pestaña hay que volver a iniciar sesión.
function loadToken(): string | null {
  try {
    localStorage.removeItem(TOKEN_KEY)
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function tokenExpiresAt(t: string): number | null {
  try {
    const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

let expiryTimer: ReturnType<typeof setTimeout> | undefined

function scheduleExpiry(t: string | null) {
  clearTimeout(expiryTimer)
  if (!t) return
  const expiresAt = tokenExpiresAt(t)
  if (expiresAt !== null) expiryTimer = setTimeout(clearToken, Math.max(0, expiresAt - Date.now()))
}

let token: string | null = loadToken()
if (token && (tokenExpiresAt(token) ?? Infinity) <= Date.now()) {
  token = null
  try { sessionStorage.removeItem(TOKEN_KEY) } catch { /* almacenamiento no disponible */ }
}
scheduleExpiry(token)

export function subscribeToken(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToken(): string | null {
  return token
}

export function setToken(next: string): void {
  token = next
  sessionStorage.setItem(TOKEN_KEY, next)
  scheduleExpiry(next)
  listeners.forEach(l => l())
}

export function clearToken(): void {
  token = null
  sessionStorage.removeItem(TOKEN_KEY)
  scheduleExpiry(null)
  listeners.forEach(l => l())
}
