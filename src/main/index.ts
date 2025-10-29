import { app, BrowserWindow, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import {
  createEmulatorWindow,
  destroyEmulatorWindow,
  getEmulatorState,
  loadEmulatorContent
} from './emulatorWindow'
import {
  createIdeWindow,
  destroyIdeWindow,
  getIdeState,
  loadIdeContent
} from './ideWindow'
import { loadSettings, saveSettings } from './settingsManager'
import { AppSettings } from '../common/abstractions/AppSettings'
import { getMainStore } from './mainStore'
import type { Action } from '../common/state/Action'
import { emuFocusedAction, ideFocusedAction } from '../common/state/actions'

// Helper functions to send actions to renderers
function sendActionToEmu(action: Action, sourceProcess: string = 'main'): void {
  const emulatorWindow = BrowserWindow.getAllWindows().find(w => 
    w.webContents.getURL().includes('?emu')
  );
  if (emulatorWindow) {
    emulatorWindow.webContents.send('ForwardActionToRenderer', { 
      action, 
      sourceProcess 
    });
  }
}

function sendActionToIde(action: Action, sourceProcess: string = 'main'): void {
  const ideWindow = BrowserWindow.getAllWindows().find(w => 
    w.webContents.getURL().includes('?ide')
  );
  if (ideWindow) {
    ideWindow.webContents.send('ForwardActionToRenderer', { 
      action, 
      sourceProcess 
    });
  }
}

// Initialize main store with forwarders
const mainStore = getMainStore(sendActionToEmu, sendActionToIde);

// Save all window states with timeout
async function saveAllStates(): Promise<void> {
  const saveTimeout = 3000

  try {
    // Capture current window states
    const emulatorState = getEmulatorState()
    const ideState = getIdeState()

    // Build settings object
    const settings: AppSettings = {
      windowStates: {
        emuWindow: emulatorState,
        ideWindow: ideState
      }
    }

    // Save to disk with timeout
    await Promise.race([
      saveSettings(settings),
      new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Save timeout')), saveTimeout)
      )
    ])

    console.log('All window states saved successfully')
  } catch (error) {
    console.error('Failed to save window states:', error)
  }
}

// Handle window close - called by both windows
async function handleWindowClose(): Promise<void> {
  // Save states before closing
  await saveAllStates()
  
  // Now close both windows
  destroyIdeWindow()
  destroyEmulatorWindow()
  
  // Quit the app
  app.quit()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Load settings before creating windows
  await loadSettings()

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Create windows first (but don't load content yet)
  const emuWindow = createEmulatorWindow(handleWindowClose)
  const ideWindow = createIdeWindow(handleWindowClose)

  // Set up focus tracking for both windows
  emuWindow.on('focus', () => {
    mainStore.dispatch(emuFocusedAction(true), 'main');
  });

  emuWindow.on('blur', () => {
    mainStore.dispatch(emuFocusedAction(false), 'main');
  });

  ideWindow.on('focus', () => {
    mainStore.dispatch(ideFocusedAction(true), 'main');
  });

  ideWindow.on('blur', () => {
    mainStore.dispatch(ideFocusedAction(false), 'main');
  });

  // Set up IPC handler for forwarding Redux actions between renderers
  // This must be done AFTER windows are created but BEFORE content is loaded
  ipcMain.handle('ForwardAction', async (_event, data) => {
    const { action, sourceProcess } = data;
    
    // Dispatch to main store (which will update main state and forward to renderers)
    // Pass sourceProcess so the forwarder knows where it came from
    mainStore.dispatch(action, sourceProcess);
  });

  // Now that IPC infrastructure is ready, load the window contents
  loadEmulatorContent()
  loadIdeContent()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createEmulatorWindow(handleWindowClose)
      createIdeWindow(handleWindowClose)
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
