import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/utils.ts',
        'src/scenarios/index.ts',
        'src/stores/uiStore.ts',
        'src/stores/settingsStore.ts',
        'src/stores/storyStore.ts',
        'src/stores/authStore.ts',
      ],
      exclude: ['src/stores/index.ts'],
      thresholds: {
        lines: 65,
        functions: 75,
        statements: 65,
      },
    },
  },
})
