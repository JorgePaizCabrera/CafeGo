import { app } from './app'
import { env } from './env'

const onListening = () => console.log(`Go Café API escuchando en http://localhost:${env.port}`)

if (env.host) app.listen(env.port, env.host, onListening)
else app.listen(env.port, onListening)
