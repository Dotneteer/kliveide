import { app, BrowserWindow, screen } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { AppSettings } from '../common/abstractions/AppSettings'
import { WindowState } from '../common/abstractions/WindowState'

const SETTINGS_DIR = join(app.getPath('home'), 'Klive')
const SETTINGS_FILE = join(SETTINGS_DIR, 'klive.settings')

let cachedSettings: AppSettings = {}

/**
 * Ensures the settings directory exists
 */
async function ensureSettingsDirectory(): Promise<void> {
  try {
    await fs.mkdir(SETTINGS_DIR, { recursive: true })
  } catch (error) {
    console.error('Failed to create settings directory:', error)
    throw error
  }
}

/**
 * Loads settings from the JSON file
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    await ensureSettingsDirectory()
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8')
    cachedSettings = JSON.parse(data)
    console.log('Settings loaded successfully')
    return cachedSettings
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.log('No settings file found, using defaults')
      cachedSettings = {}
      return cachedSettings
    }
    console.error('Failed to load settings:', error)
    cachedSettings = {}
    return cachedSettings
  }
}

/**
 * Saves settings to the JSON file
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await ensureSettingsDirectory()
    const json = JSON.stringify(settings, null, 2)
    await fs.writeFile(SETTINGS_FILE, json, 'utf-8')
    cachedSettings = settings
    console.log('Settings saved successfully')
  } catch (error) {
    console.error('Failed to save settings:', error)
    throw error
  }
}

/**
 * Gets cached settings
 */
export function getCachedSettings(): AppSettings {
  return cachedSettings
}

/**
 * Captures the current state of a BrowserWindow
 */
export function captureWindowState(window: BrowserWindow): WindowState {
  const bounds = window.getBounds()
  const display = screen.getDisplayMatching(bounds)
  
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    isMaximized: window.isMaximized(),
    isFullScreen: window.isFullScreen(),
    displayBounds: {
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height
    }
  }
}

/**
 * Applies saved window state to a BrowserWindow
 */
export function applyWindowState(window: BrowserWindow, state: WindowState | undefined): void {
  if (!state) {
    return
  }

  // Check if the saved position is still valid (display might have changed)
  const displays = screen.getAllDisplays()
  const isValidPosition = displays.some(display => {
    return (
      state.x >= display.bounds.x &&
      state.x < display.bounds.x + display.bounds.width &&
      state.y >= display.bounds.y &&
      state.y < display.bounds.y + display.bounds.height
    )
  })

  if (isValidPosition) {
    window.setBounds({
      x: state.x,
      y: state.y,
      width: state.width,
      height: state.height
    })
  } else {
    // If position is invalid, just set size and let OS position it
    window.setBounds({
      width: state.width,
      height: state.height
    })
  }

  if (state.isMaximized) {
    window.maximize()
  }

  if (state.isFullScreen) {
    window.setFullScreen(true)
  }
}
