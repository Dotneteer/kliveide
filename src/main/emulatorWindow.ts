import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { captureWindowState, applyWindowState, getCachedSettings } from './settingsManager'
import { WindowState } from '../common/abstractions/WindowState'

let emulatorWindow: BrowserWindow | null = null

export async function saveEmulatorState(): Promise<void> {
  if (emulatorWindow && !emulatorWindow.isDestroyed()) {
    const state = captureWindowState(emulatorWindow)
    // Return the state so it can be saved by the main process
    return state as any
  }
  return undefined as any
}

export function getEmulatorState(): WindowState | undefined {
  if (emulatorWindow && !emulatorWindow.isDestroyed()) {
    return captureWindowState(emulatorWindow)
  }
  return undefined
}

export function createEmulatorWindow(onClose: () => void): BrowserWindow {
  // Get saved state
  const savedSettings = getCachedSettings()
  const savedState = savedSettings.windowStates?.emuWindow

  // Create the emulator browser window with default or saved dimensions
  const defaultWidth = 800
  const defaultHeight = 600
  
  emulatorWindow = new BrowserWindow({
    width: savedState?.width || defaultWidth,
    height: savedState?.height || defaultHeight,
    x: savedState?.x,
    y: savedState?.y,
    show: false,
    autoHideMenuBar: true,
    title: 'Klive Emulator',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Apply saved state (maximized, fullscreen, etc.)
  if (savedState) {
    applyWindowState(emulatorWindow, savedState)
  }

  emulatorWindow.on('ready-to-show', () => {
    emulatorWindow?.show()
  })

  emulatorWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    emulatorWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/index.html?emu')
  } else {
    emulatorWindow.loadFile(join(__dirname, '../renderer/index.html?emu'))
  }

  emulatorWindow.on('close', async (event) => {
    // Prevent the window from closing immediately
    event.preventDefault()
    
    // Trigger the close handler which will save all states and quit
    onClose()
  })

  emulatorWindow.on('closed', () => {
    emulatorWindow = null
  })

  return emulatorWindow
}

export function getEmulatorWindow(): BrowserWindow | null {
  return emulatorWindow
}

export function destroyEmulatorWindow(): void {
  if (emulatorWindow && !emulatorWindow.isDestroyed()) {
    emulatorWindow.destroy()
  }
  emulatorWindow = null
}
