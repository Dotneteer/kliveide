/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[local]' // Use original class names in tests
    },
    preprocessorOptions: {
      scss: {
        // --- Enable SCSS processing in tests
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'out', 'release'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,ts,jsx,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main/**',
        'src/preload/**',
        'src/renderer/index.html',
        'src/renderer/main.tsx',
        'src/renderer/emulator/main.tsx',
        'src/renderer/ide/main.tsx'
      ]
    }
  },
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
      '@common': path.resolve(__dirname, './src/common'),
      '@': path.resolve(__dirname, './src')
    }
  }
})
