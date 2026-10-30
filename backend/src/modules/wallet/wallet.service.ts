import { readFileSync } from 'node:fs'
import jwt from 'jsonwebtoken'
import { OrderStatus, type Orden } from '@prisma/client'
import { env } from '../../env'
import { formatFolio } from '../../utils/folio'

// Tarjeta de Google Wallet del pedido: el cliente la guarda desde la página de seguimiento y
// se actualiza sola cuando la orden avanza; al finalizar le llega un aviso al teléfono.

const API = 'https://walletobjects.googleapis.com/walletobjects/v1'
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'

interface Credenciales { client_email: string, private_key: string }

const PASOS: Record<OrderStatus, { titulo: string, detalle: string }> = {
  Recibido: { titulo: 'Recibido', detalle: 'Recibimos su café en planta' },
  EnPreparacion: { titulo: 'En preparación', detalle: 'Limpieza y trillado del grano' },
  EnTueste: { titulo: 'En tueste', detalle: 'Su café se está tostando' },
  EnMolienda: { titulo: 'En molienda', detalle: 'Molido al punto elegido' },
  EnEmpaque: { titulo: 'En empaque', detalle: 'Empacando su café' },
  Finalizado: { titulo: 'Listo para recoger', detalle: 'Ya puede pasar por su pedido' },
}
const ORDEN_PASOS = Object.keys(PASOS) as OrderStatus[]
const CAFE: Record<string, string> = { pergamino: 'Pergamino', natural: 'Natural', oro: 'Oro' }
const FECHA = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

let credenciales: Credenciales | null | undefined

function cargarCredenciales(): Credenciales | null {
  if (credenciales !== undefined) return credenciales
  credenciales = null
  if (!env.walletIssuerId) return null
  try {
    const crudo = env.walletCredentials || (env.walletKeyFile ? readFileSync(env.walletKeyFile, 'utf8') : '')
    if (!crudo) return null
    const datos = JSON.parse(crudo) as Partial<Credenciales>
    if (datos.client_email && datos.private_key) credenciales = { client_email: datos.client_email, private_key: datos.private_key }
  } catch (err) {
    console.error('[wallet] No se pudo leer la clave de Google Wallet:', (err as Error).message)
  }
  if (!credenciales) console.error('[wallet] Google Wallet desactivado: falta una clave válida de cuenta de servicio.')
  return credenciales
}

export function walletHabilitado(): boolean {
  return cargarCredenciales() !== null
}

const claseId = () => `${env.walletIssuerId}.gocafe_pedido`
const objetoId = (token: string) => `${env.walletIssuerId}.orden_${token}`
const seguimientoUrl = (token: string) => `${env.publicUrl}/seguimiento/${token}`
// Google descarga imágenes y abre enlaces desde sus servidores: en desarrollo (localhost) se omiten.
const urlPublica = () => env.publicUrl.startsWith('https://')

function texto(valor: string) {
  return { defaultValue: { language: 'es', value: valor } }
}

function objetoPedido(orden: Orden) {
  const paso = PASOS[orden.status]
  const numero = ORDEN_PASOS.indexOf(orden.status) + 1
  const listo = orden.status === OrderStatus.Finalizado
  const orderNo = formatFolio('GC', orden.seq)
  return {
    id: objetoId(orden.seguimientoToken),
    classId: claseId(),
    state: 'ACTIVE',
    hexBackgroundColor: listo ? '#047857' : '#2b1a10',
    cardTitle: texto('Go Café'),
    subheader: texto(`Orden ${orderNo}`),
    header: texto(paso.titulo),
    ...(urlPublica() && { logo: { sourceUri: { uri: `${env.publicUrl}/icons/icon-512.png` } } }),
    textModulesData: [
      { id: 'avance', header: listo ? 'Estado' : `Paso ${numero} de ${ORDEN_PASOS.length}`, body: paso.detalle },
      { id: 'entrega', header: 'Entrega estimada', body: FECHA.format(orden.estimatedDate) },
      { id: 'cafe', header: 'Café', body: `${CAFE[orden.coffeeType] ?? orden.coffeeType} · ${orden.initialWeight.toFixed(0)} lb` },
    ],
    barcode: {
      type: 'QR_CODE',
      value: urlPublica() ? seguimientoUrl(orden.seguimientoToken) : orderNo,
      alternateText: orderNo,
    },
    ...(urlPublica() && {
      linksModuleData: { uris: [{ id: 'seguimiento', uri: seguimientoUrl(orden.seguimientoToken), description: 'Ver seguimiento del pedido' }] },
    }),
  }
}

const clase = () => ({
  id: claseId(),
  classTemplateInfo: {
    cardTemplateOverride: {
      cardRowTemplateInfos: [{
        twoItems: {
          startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['avance']" }] } },
          endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['entrega']" }] } },
        },
      }, {
        oneItem: { item: { firstValue: { fields: [{ fieldPath: "object.textModulesData['cafe']" }] } } },
      }],
    },
  },
})

let accesoCache: { token: string, venceMs: number } | null = null

async function tokenDeAcceso(cred: Credenciales): Promise<string> {
  if (accesoCache && accesoCache.venceMs > Date.now() + 60_000) return accesoCache.token
  const ahora = Math.floor(Date.now() / 1000)
  const assertion = jwt.sign(
    { iss: cred.client_email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 },
    cred.private_key,
    { algorithm: 'RS256' },
  )
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  const body = await res.json() as { access_token?: string, expires_in?: number, error_description?: string }
  if (!res.ok || !body.access_token) throw new Error(`Google no entregó el token de acceso: ${body.error_description ?? res.status}`)
  accesoCache = { token: body.access_token, venceMs: Date.now() + (body.expires_in ?? 3600) * 1000 }
  return accesoCache.token
}

async function llamar(cred: Credenciales, metodo: string, ruta: string, cuerpo?: unknown): Promise<Response> {
  return fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${await tokenDeAcceso(cred)}`, 'Content-Type': 'application/json' },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
}

async function errorDe(res: Response): Promise<Error> {
  const detalle = await res.text().catch(() => '')
  return new Error(`Google Wallet respondió ${res.status}: ${detalle.slice(0, 300)}`)
}

// La clase (el diseño común de todas las tarjetas) se crea una vez y se mantiene al día.
let claseLista = false
async function asegurarClase(cred: Credenciales) {
  if (claseLista) return
  let res = await llamar(cred, 'PUT', `/genericClass/${claseId()}`, clase())
  if (res.status === 404) res = await llamar(cred, 'POST', '/genericClass', clase())
  if (!res.ok) throw await errorDe(res)
  claseLista = true
}

// Enlace "Agregar a Google Wallet": un JWT firmado que lleva la tarjeta completa.
export async function enlaceGuardar(orden: Orden): Promise<string> {
  const cred = cargarCredenciales()
  if (!cred) throw new Error('Google Wallet no está configurado.')
  await asegurarClase(cred)
  const token = jwt.sign(
    {
      iss: cred.client_email,
      aud: 'google',
      typ: 'savetowallet',
      origins: [new URL(env.publicUrl).origin],
      payload: { genericObjects: [objetoPedido(orden)] },
    },
    cred.private_key,
    { algorithm: 'RS256' },
  )
  return `https://pay.google.com/gp/v/save/${token}`
}

// Actualiza la tarjeta si el cliente la guardó. No interrumpe nunca la operación de la orden.
export async function actualizarTarjeta(orden: Orden): Promise<void> {
  const cred = cargarCredenciales()
  if (!cred || !orden.seguimientoActivo) return
  try {
    const id = objetoId(orden.seguimientoToken)
    const res = await llamar(cred, 'PUT', `/genericObject/${id}`, objetoPedido(orden))
    if (res.status === 404) return // el cliente todavía no guardó la tarjeta
    if (!res.ok) throw await errorDe(res)

    if (orden.status === OrderStatus.Finalizado) {
      const aviso = await llamar(cred, 'POST', `/genericObject/${id}/addMessage`, {
        message: {
          id: 'pedido_listo',
          header: '¡Su pedido está listo!',
          body: `Su orden ${formatFolio('GC', orden.seq)} ya puede pasar a recogerla en Go Café.`,
          messageType: 'TEXT_AND_NOTIFY',
        },
      })
      if (!aviso.ok) throw await errorDe(aviso)
    }
  } catch (err) {
    console.error('[wallet] No se pudo actualizar la tarjeta:', (err as Error).message)
  }
}
