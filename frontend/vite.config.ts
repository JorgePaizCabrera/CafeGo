import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:4000',
    },
  },
})
