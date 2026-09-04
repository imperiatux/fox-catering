import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    exclude: ['dist/**', 'dist-server/**', 'node_modules/**'],
  },
})
