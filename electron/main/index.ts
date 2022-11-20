process.env.DIST_ELECTRON = join(__dirname, '../..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST_ELECTRON, '../public')

import { RequestMessage } from '@messaging/message-types'
import { Unsubscribe } from '@state/redux-light'
import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { release } from 'os'
import { join } from 'path'
import { setupMenu, updateMenuState } from '../app-menu'
import { processEmuToMainMessages } from '../EmuToMainProcessor'
import { mainStore } from '../main-store'
import { registerMainToEmuMessenger } from '../MainToEmuMessenger'

// Disable GPU Acceleration for Windows 7
if (release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let emuWindow: BrowserWindow | null = null;
let storeUnsubscribe: Unsubscribe | undefined;

// Here, you can also use other preload
const preload = join(__dirname, '../preload/index.js')
const url = process.env.VITE_DEV_SERVER_URL
const indexHtml = join(process.env.DIST, 'index.html')

async function createWindow() {
  // --- Create the emulator window
  emuWindow = new BrowserWindow({
    title: 'Main window',
    icon: join(process.env.PUBLIC, 'favicon.svg'),
    minWidth: 480,
    minHeight: 320,
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // --- Initialize messaging from the main process to the emulator window
  registerMainToEmuMessenger(emuWindow);

  // --- Prepare the main menu. Update items on application state change
  setupMenu();
  storeUnsubscribe = mainStore.subscribe(() => {
    updateMenuState();
  });

  if (process.env.VITE_DEV_SERVER_URL) { // electron-vite-vue#298
    emuWindow.loadURL(url)
    // Open devTool if the app is not packaged
    emuWindow.webContents.openDevTools()
  } else {
    emuWindow.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  emuWindow.webContents.on('did-finish-load', () => {
    emuWindow?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  emuWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  storeUnsubscribe();
  emuWindow = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (emuWindow) {
    // Focus on the main window if the user tried to open another
    if (emuWindow.isMinimized()) emuWindow.restore()
    emuWindow.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow();
  }
})

// --- This channel processes emulator requests and sends the results back
ipcMain.on("EmuToMain", async (_ev, msg: RequestMessage) => {
  const response = await processEmuToMainMessages(msg);
  response.correlationId = msg.correlationId;
  if (emuWindow?.isDestroyed() === false) {
    emuWindow.webContents.send("EmuToMainResponse", response);
  }
});
