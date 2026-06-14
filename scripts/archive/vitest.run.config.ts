import { defineConfig } from 'vitest/config'
import path from 'path'

/** One-off runner config — not for CI. */
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['scripts/register-schematest-003.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
})
