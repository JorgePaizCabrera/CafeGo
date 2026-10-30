import path from 'node:path'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './env'
import { authRouter } from './modules/auth/auth.routes'
import { clientesRouter } from './modules/clientes/clientes.routes'
import { ordenesRouter } from './modules/ordenes/ordenes.routes'
import { produccionRouter } from './modules/produccion/produccion.routes'
import { inventarioRouter } from './modules/inventario/inventario.routes'
import { seguimientoRouter } from './modules/seguimiento/seguimiento.routes'
import { requireAuth } from './middleware/auth'
import { notFoundHandler, errorHandler } from './middleware/errorHandler'

export const app = express()
if (env.trustProxy) app.set('trust proxy', 1)

// upgrade-insecure-requests se desactiva para permitir el acceso por HTTP desde la red local.
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }))
app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())
app.use(morgan('dev'))

app.get('/health', (_req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api/seguimiento', seguimientoRouter)

app.use('/api/clientes', requireAuth, clientesRouter)
app.use('/api/ordenes', requireAuth, ordenesRouter)
app.use('/api/produccion', requireAuth, produccionRouter)
app.use('/api/inventario', requireAuth, inventarioRouter)

if (env.staticDir) {
  const staticDir = path.resolve(env.staticDir)
  const indexHtml = path.join(staticDir, 'index.html')
  app.use(express.static(staticDir, { index: false }))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(indexHtml))
}

app.use(notFoundHandler)
app.use(errorHandler)
