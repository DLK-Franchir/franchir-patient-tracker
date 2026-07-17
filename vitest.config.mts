import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      '@franchir/synthesis-contract': fileURLToPath(
        new URL('./packages/synthesis-contract/src/index.ts', import.meta.url),
      ),
      '@franchir/imaging': fileURLToPath(
        new URL('./packages/imaging/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'components/**/*.test.tsx',
      'app/**/*.test.ts',
      'packages/**/*.test.ts',
    ],
  },
})
