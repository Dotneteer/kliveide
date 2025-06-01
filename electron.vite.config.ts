import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    css: {
      modules: {
        localsConvention: 'camelCase'
      }
    },
    build: {
      rollupOptions: {
        input: {
          emulator: resolve(__dirname, 'src/renderer/emulator/index.html'),
          ide: resolve(__dirname, 'src/renderer/ide/index.html')
        }
      }
    }
  }
})
