import { app, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let emuWindow: BrowserWindow | null = null
let ideWindow: BrowserWindow | null = null

function createEmulatorWindow(): void {
  // Create the emulator window
  emuWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Klive Emulator',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: join(__dirname, '../../resources/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  emuWindow.on('ready-to-show', () => {
    emuWindow?.show()
    emuWindow?.focus() // Focus the emulator window
  })

  emuWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // Load the renderer content
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    emuWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/emulator/`)
  } else {
    emuWindow.loadFile(join(__dirname, '../renderer/emulator.html'))
  }

  emuWindow.on('closed', () => {
    emuWindow = null
  })
}

function createIDEWindow(): void {
  // Create the IDE window
  ideWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Klive IDE',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: join(__dirname, '../../resources/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  ideWindow.on('ready-to-show', () => {
    ideWindow?.show()
  })

  ideWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // Load the renderer content
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    ideWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/ide/`)
  } else {
    ideWindow.loadFile(join(__dirname, '../renderer/ide.html'))
  }

  ideWindow.on('closed', () => {
    ideWindow = null
  })
}

function createWindows(): void {
  createEmulatorWindow()
  createIDEWindow()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindows()

  app.on('activate', function () {
    // On macOS it's common to re-create windows in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindows()
    }
  })
})

// Quit when all windows are closed on all platforms
app.on('window-all-closed', () => {
  app.quit()
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
