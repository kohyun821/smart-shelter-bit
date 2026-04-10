const { app, BrowserWindow, protocol } = require('electron')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

const bridge = require('./server/bridge')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const isDev = !app.isPackaged
const outDir = path.join(__dirname, 'out')

function getWindowSettings() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'data', 'setting.json'), 'utf-8')
    const json = JSON.parse(data)
    if (Array.isArray(json) && json.length > 0) {
      return {
        width: typeof json[0].width === 'number' ? json[0].width : 1280,
        height: typeof json[0].height === 'number' ? json[0].height : 800,
        alwaysOnTop: typeof json[0].alwaysOnTop === 'boolean' ? json[0].alwaysOnTop : true
      }
    }
  } catch (err) {
    console.warn('Failed to read setting.json for window config:', err.message)
  }
  return { width: 1280, height: 800, alwaysOnTop: true }
}

function createWindow() {
  const winSettings = getWindowSettings()

  const mainWindow = new BrowserWindow({
    width: winSettings.width,
    height: winSettings.height,
    x: 0,
    y: 0,
    alwaysOnTop: winSettings.alwaysOnTop,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // 키오스크 모드에서 ESC 키를 눌러 종료할 수 있도록 이벤트 등록
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      app.quit()
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3300')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadURL('app://./index.html')
  }
}

app.whenReady().then(() => {
  bridge.start()
  if (!isDev) {
    protocol.handle('app', (request) => {
      const url = request.url.slice('app://'.length)
      const decoded = decodeURIComponent(url)
      const filePath = path.join(outDir, decoded === '/' || decoded === '' ? 'index.html' : decoded)
      if (!filePath.startsWith(outDir)) return new Response('Forbidden', { status: 403 })
      try {
        const data = fs.readFileSync(filePath)
        const ext = path.extname(filePath)
        const mime = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : ext === '.json' ? 'application/json' : 'application/octet-stream'
        return new Response(data, { headers: { 'Content-Type': mime } })
      } catch (_) {
        return new Response('Not Found', { status: 404 })
      }
    })
  }
  createWindow()
})

app.on('window-all-closed', () => {
  bridge.stop()
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
