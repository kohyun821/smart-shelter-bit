const { app, BrowserWindow, protocol, screen } = require('electron')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

// 키오스크에서 사용자 제스처 없이 오디오 자동 재생 허용 (TTS)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const bridge = require('./server/bridge')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const isDev = !app.isPackaged
const outDir = path.join(__dirname, 'out')

function getWindowSettings() {
  try {
    const dataPath = app.isPackaged
      ? path.join(process.resourcesPath, 'data', 'setting.json')
      : path.join(__dirname, 'data', 'setting.json')
    const data = fs.readFileSync(dataPath, 'utf-8')
    const json = JSON.parse(data)
    if (Array.isArray(json) && json.length > 0) {
      return {
        width:           typeof json[0].width === 'number'   ? json[0].width        : 1280,
        height:          typeof json[0].height === 'number'  ? json[0].height       : 800,
        alwaysOnTop:     typeof json[0].alwaysOnTop === 'boolean' ? json[0].alwaysOnTop : true,
        hideTaskbar:     typeof json[0].hideTaskbar === 'boolean' ? json[0].hideTaskbar  : false,
        showDebugOverlay: typeof json[0].showDebugOverlay === 'boolean' ? json[0].showDebugOverlay : false,
      }
    }
  } catch (err) {
    console.warn('Failed to read setting.json for window config:', err.message)
  }
  return { width: 1280, height: 800, alwaysOnTop: true, hideTaskbar: false, showDebugOverlay: false }
}

function createWindow() {
  const winSettings = getWindowSettings()

  // 설계 해상도 (1080×1920)
  const DESIGN_W = winSettings.width
  const DESIGN_H = winSettings.height

  // 실제 화면 크기로 배율 계산
  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = winSettings.hideTaskbar
    ? display.bounds       // 키오스크: 작업표시줄 포함 전체
    : display.workAreaSize // 일반: 작업표시줄 제외
  const scale = Math.min(screenW / DESIGN_W, screenH / DESIGN_H)
  const actualW = Math.round(DESIGN_W * scale)
  const actualH = Math.round(DESIGN_H * scale)

  const mainWindow = new BrowserWindow({
    width: actualW,
    height: actualH,
    x: 0,
    y: 0,
    alwaysOnTop: winSettings.alwaysOnTop,
    frame: false,
    skipTaskbar: winSettings.hideTaskbar,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: scale,  // 초기 배율 적용 (페이지 로드 전)
    },
    show: false,
  })

  if (winSettings.hideTaskbar) {
    mainWindow.setKiosk(true)
  }

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
