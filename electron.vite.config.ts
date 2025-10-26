import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
// @ts-ignore - xmlui plugin types
import xmluiPlugin from 'xmlui/vite-xmlui-plugin'

const rendererConfig = {
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.VITE_DEV_MODE': 'true'
  },
  plugins: [
    // @ts-ignore
    xmluiPlugin.default ? xmluiPlugin.default() : xmluiPlugin(),
    react()
  ]
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          klive: resolve(__dirname, 'src/renderer/index.html'),
        }
      }
    },
    ...rendererConfig
  }
})
