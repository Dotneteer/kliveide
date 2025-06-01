import { describe, it, expect } from 'vitest'
import type { KliveSettings, WindowState } from '../src/common/abstractions/KliveSettings'

describe('KliveSettings Types', () => {
  it('should create a valid WindowState object', () => {
    const windowState: WindowState = {
      x: 100,
      y: 200,
      width: 800,
      height: 600,
      isMaximized: false,
      isFullScreen: false,
      displayBounds: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080
      }
    }

    expect(windowState.x).toBe(100)
    expect(windowState.y).toBe(200)
    expect(windowState.width).toBe(800)
    expect(windowState.height).toBe(600)
    expect(windowState.isMaximized).toBe(false)
    expect(windowState.isFullScreen).toBe(false)
    expect(windowState.displayBounds).toBeDefined()
    expect(windowState.displayBounds?.width).toBe(1920)
  })

  it('should create a valid KliveSettings object with default values', () => {
    const settings: KliveSettings = {
      theme: 'dark',
      showKeyboard: true,
      showIdeToolbar: true,
      showEmuToolbar: true,
      clockMultiplier: 1,
      soundLevel: 0.5,
      windowStates: {
        ideZoomFactor: 1.0,
        emuZoomFactor: 1.0,
        showIdeOnStartup: true,
        ideWindow: {
          x: 100,
          y: 100,
          width: 1200,
          height: 800,
          isMaximized: false,
          isFullScreen: false
        },
        emuWindow: {
          x: 150,
          y: 150,
          width: 800,
          height: 600,
          isMaximized: false,
          isFullScreen: false
        }
      },
      recentProjects: [],
      showShadowScreen: false,
      showInstantScreen: false,
      emuStayOnTop: false,
      startScreenDisplayed: false,
      machineId: 'spectrum48'
    }

    expect(settings.theme).toBe('dark')
    expect(settings.windowStates).toBeDefined()
    expect(settings.windowStates?.ideWindow).toBeDefined()
    expect(settings.windowStates?.emuWindow).toBeDefined()
    expect(settings.windowStates?.ideWindow?.width).toBe(1200)
    expect(settings.windowStates?.emuWindow?.width).toBe(800)
    expect(settings.recentProjects).toHaveLength(0)
    expect(settings.clockMultiplier).toBe(1)
    expect(settings.soundLevel).toBe(0.5)
  })

  it('should handle optional properties correctly', () => {
    const minimalSettings: KliveSettings = {}

    expect(minimalSettings.theme).toBeUndefined()
    expect(minimalSettings.windowStates).toBeUndefined()
    expect(minimalSettings.recentProjects).toBeUndefined()
  })

  it('should create WindowState with minimal properties', () => {
    const minimalWindow: WindowState = {
      width: 640,
      height: 480
    }

    expect(minimalWindow.width).toBe(640)
    expect(minimalWindow.height).toBe(480)
    expect(minimalWindow.x).toBeUndefined()
    expect(minimalWindow.y).toBeUndefined()
    expect(minimalWindow.isMaximized).toBeUndefined()
  })
})
