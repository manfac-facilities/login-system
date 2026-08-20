import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Thread única: o pool de workers do Vitest 4 estoura
    // "Timeout waiting for worker to respond" no Windows quando o Node em uso
    // é mais novo que o 20 do .nvmrc. Sem paralelismo o problema não ocorre,
    // e a suíte é pequena o bastante para o custo ser irrelevante.
    pool: 'threads',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
})
