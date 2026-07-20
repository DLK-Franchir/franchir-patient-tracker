import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('.', import.meta.url)) },
      {
        find: '@franchir/synthesis-contract',
        replacement: fileURLToPath(
          new URL('./packages/synthesis-contract/src/index.ts', import.meta.url),
        ),
      },
      {
        find: '@franchir/imaging',
        replacement: fileURLToPath(
          new URL('./packages/imaging/src/index.ts', import.meta.url),
        ),
      },
      // Exact matches only — a string alias is prefix-based and breaks `/engine`.
      {
        find: /^@franchir\/imaging-viewer$/,
        replacement: fileURLToPath(
          new URL('./packages/imaging-viewer/src/index.ts', import.meta.url),
        ),
      },
      {
        find: /^@franchir\/imaging-viewer\/engine$/,
        replacement: fileURLToPath(
          new URL('./packages/imaging-viewer/src/engine.ts', import.meta.url),
        ),
      },
      {
        find: /^@franchir\/imaging-viewer\/ui$/,
        replacement: fileURLToPath(
          new URL('./packages/imaging-viewer/src/ui/index.ts', import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: 'node',
    include: [
      'lib/**/*.test.ts',
      'components/**/*.test.tsx',
      'app/**/*.test.ts',
      'packages/**/*.test.ts',
      'packages/**/*.test.tsx',
    ],
  },
})
