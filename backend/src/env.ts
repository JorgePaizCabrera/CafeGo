import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Falta la variable de entorno ${name} (revisa tu .env, usa .env.example como base).`)
  return value
}

export const env = {
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || '',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  staticDir: process.env.STATIC_DIR || '',
  // Detrás del proxy de Render (u otro) la IP real del cliente llega en X-Forwarded-For.
  trustProxy: process.env.RENDER === 'true' || process.env.TRUST_PROXY === '1',
  // Dirección pública del frontend: los enlaces de seguimiento y las tarjetas de Google Wallet apuntan aquí.
  publicUrl: (process.env.PUBLIC_URL || (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',')[0]).trim().replace(/\/+$/, ''),
  // Google Wallet (opcional): sin estas variables la tarjeta simplemente no se ofrece.
  walletIssuerId: process.env.GOOGLE_WALLET_ISSUER_ID || '',
  walletKeyFile: process.env.GOOGLE_WALLET_KEY_FILE || '',
  walletCredentials: process.env.GOOGLE_WALLET_CREDENTIALS || '',
  // Mientras Google no aprueba el acceso de publicación, solo las cuentas de prueba pueden guardar
  // la tarjeta: con "no" se oculta el botón a los clientes (las tarjetas ya guardadas se siguen actualizando).
  walletBoton: process.env.GOOGLE_WALLET_BOTON !== 'no',
}
