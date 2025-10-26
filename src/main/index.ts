import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let emulatorWindow: BrowserWindow | null = null
let ideWindow: BrowserWindow | null = null

function createEmulatorWindow(): void {
  // Create the emulator browser window.
  emulatorWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'Klive Emulator',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

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

  emulatorWindow.on('closed', () => {
    emulatorWindow = null
  })
}

function createIdeWindow(): void {
  // Create the IDE browser window.
  ideWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    title: 'Klive IDE',
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

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const ideUrl = process.env['ELECTRON_RENDERER_URL'] + '/index.html?ide'
    console.log('Loading IDE from URL:', ideUrl)
    ideWindow.loadURL(ideUrl)
  } else {
    ideWindow.loadFile(join(__dirname, '../renderer/index.html?ide'))
  }

  ideWindow.on('closed', () => {
    ideWindow = null
  })
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

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createEmulatorWindow()
  createIdeWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createEmulatorWindow()
      createIdeWindow()
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
