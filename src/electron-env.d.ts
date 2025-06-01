/// <reference types="vite/client" />

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production'
    readonly VITE_DEV_SERVER_URL: string
  }
}

interface Window {
  // expose in the `electron/preload/index.ts`
  electron: ElectronAPI
  api: unknown
}
