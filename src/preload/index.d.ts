import type { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      /** A dropped file's path on disk (`webUtils.getPathForFile`) */
      getPathForFile?: (file: File) => string
    }
  }
}
