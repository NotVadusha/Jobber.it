import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Restricted to source unit tests: the default pattern would also collect
  // the Playwright specs under e2e/, which need a browser and a server.
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
