import { BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { captureWindowState, applyWindowState, appSettings } from './settingsManager'
import { WindowState } from '../common/abstractions/WindowState'

let ideWindow: BrowserWindow | null = null

// Export the singleton window reference
export { ideWindow }

export async function saveIdeState(): Promise<void> {
  if (ideWindow && !ideWindow.isDestroyed()) {
    const state = captureWindowState(ideWindow)
    // Return the state so it can be saved by the main process
    return state as any
  }
  return undefined as any
}

export function getIdeState(): WindowState | undefined {
  if (ideWindow && !ideWindow.isDestroyed()) {
    return captureWindowState(ideWindow)
  }
  return undefined
}

export function createIdeWindow(onClose: () => void): BrowserWindow {
  // Return existing window if it exists and is not destroyed
  if (ideWindow && !ideWindow.isDestroyed()) {
    return ideWindow
  }

  // Get saved state
  const savedSettings = appSettings;
  const savedState = savedSettings.windowStates?.ideWindow

  // Create the IDE browser window with default or saved dimensions
  const defaultWidth = 1200
  const defaultHeight = 800
  
  ideWindow = new BrowserWindow({
    width: savedState?.width || defaultWidth,
    height: savedState?.height || defaultHeight,
    minWidth: 640,
    minHeight: 480,
    x: savedState?.x,
    y: savedState?.y,
    show: false,
    autoHideMenuBar: true,
    title: 'Klive IDE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Apply saved state (maximized, fullscreen, etc.)
  if (savedState) {
    applyWindowState(ideWindow, savedState)
  }

  ideWindow.on('ready-to-show', () => {
    ideWindow?.show()
  })

  ideWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // NOTE: Do NOT load URL here - let the caller load it after IPC is ready

  ideWindow.on('close', async (event) => {
    // Prevent the window from closing immediately
    event.preventDefault()
    
    // Trigger the close handler which will save all states and quit
    onClose()
  })

  ideWindow.on('closed', () => {
    ideWindow = null
  })

  return ideWindow
}

/**
 * Loads the content into the IDE window.
 * Should be called after IPC infrastructure is ready.
 */
export function loadIdeContent(): void {
  if (!ideWindow) {
    throw new Error('IDE window not created');
  }

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const ideUrl = process.env['ELECTRON_RENDERER_URL'] + '/index.html?ide'
    console.log('Loading IDE from URL:', ideUrl)
    ideWindow.loadURL(ideUrl)
  } else {
    ideWindow.loadFile(join(__dirname, '../renderer/index.html?ide'))
  }
}

export function getIdeWindow(): BrowserWindow | null {
  return ideWindow
}

export function destroyIdeWindow(): void {
  if (ideWindow && !ideWindow.isDestroyed()) {
    ideWindow.destroy()
  }
  ideWindow = null
}
