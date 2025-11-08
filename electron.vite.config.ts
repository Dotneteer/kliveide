import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
// @ts-ignore - xmlui plugin types
import xmluiPlugin from 'xmlui/vite-xmlui-plugin'

const rendererConfig = {
  resolve: {
    alias: {
      '@': resolve('src'),
      '@common': resolve('src/common'),
      '@abstr': resolve('src/common/abstractions'),
      '@state': resolve('src/common/state'),
      '@messaging': resolve('src/common/messaging'),
      '@emu': resolve('src/emu'),
      '@emuabstr': resolve('src/emu/abstractions'),
      '@main': resolve('src/main'),
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
    resolve: {
      alias: {
        '@': resolve('src'),
        '@common': resolve('src/common'),
        '@abstr': resolve('src/common/abstractions'),
        '@state': resolve('src/common/state'),
        '@messaging': resolve('src/common/messaging'),
        '@emu': resolve('src/emu'),
        '@emuabstr': resolve('src/emu/abstractions'),
        '@main': resolve('src/main')
      }
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@': resolve('src'),
        '@common': resolve('src/common'),
        '@abstr': resolve('src/common/abstractions'),
        '@state': resolve('src/common/state'),
        '@messaging': resolve('src/common/messaging'),
        '@emu': resolve('src/emu'),
        '@emuabstr': resolve('src/emu/abstractions'),
        '@main': resolve('src/main')
      }
    }
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
