import { defineConfig } from 'vitest/config'
import { config as loadEnv } from 'dotenv'

const parsed = loadEnv({ path: '.env.test' }).parsed ?? {}

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    env: parsed,
    fileParallelism: false,
    hookTimeout: 20000,
    testTimeout: 20000,
  },
})
