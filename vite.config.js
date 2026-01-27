import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true, // Fail if port is already in use instead of trying another
    host: '127.0.0.1', // Bind to loopback interface only
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    css: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.jsx',
    env: {
      VITE_API_KEY: 'test-api-key',
      VITE_API_URL: 'http://localhost:8787',
    },
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: [
        'src/**/*.test.{js,jsx}',
        'src/setupTests.js',
        'src/main.jsx',
        'src/mocks/**',
      ],
      thresholds: {
        lines: 50,
        functions: 40,
        branches: 70,
        statements: 50,
      },
      all: true,
    },
  },
})
