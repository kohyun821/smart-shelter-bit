const { app, BrowserWindow, protocol, screen } = require('electron')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

// 키오스크에서 사용자 제스처 없이 오디오 자동 재생 허용 (TTS)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

const bridge = require('./server/bridge')
const { getDataDir } = require('./server/appPaths')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

const isDev = !app.isPackaged
const outDir = path.join(__dirname, 'out')

// 워치독(1분 주기)·자동 업데이트 재실행으로 두 번째 인스턴스가 뜨면 브리지 포트(4000) 충돌 → 바로 종료
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

function getWindowSettings() {
  try {
    const dataPath = path.join(getDataDir(), 'setting.json')
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
    },
    show: false,
  })

  if (winSettings.hideTaskbar) {
    mainWindow.setKiosk(true)
  }

  // webPreferences.zoomFactor는 로드 전 배율이 적용되지 않는 경우가 있어
  // did-finish-load 이후 webContents.setZoomFactor로 확실히 적용
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(scale)
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  // 서버 원격 확인용 화면 캡처 (창 내용만 캡처 — OS 화면 녹화 권한 불필요)
  bridge.setScreenCapturer(async (width) => {
    if (mainWindow.isDestroyed()) return null
    let img = await mainWindow.webContents.capturePage()
    if (img.isEmpty()) return null
    if (img.getSize().width > width) img = img.resize({ width, quality: 'good' })
    const size = img.getSize()
    return { jpeg: img.toJPEG(70), width: size.width, height: size.height }
  })

  // 렌더러 프로세스만 죽는 경우(전체 앱 프로세스는 살아있음) 자동 복구
  mainWindow.webContents.on('render-process-gone', () => mainWindow.reload())
  mainWindow.webContents.on('unresponsive', () => mainWindow.reload())

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

function checkForUpdates() {
  const { autoUpdater } = require('electron-updater')
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'kohyun821',
    repo: 'smart-shelter-bit',
    private: true,
    token: process.env.GH_TOKEN,
  })
  autoUpdater.on('checking-for-update', () => logUpdater(`확인 시작 (현재 ${app.getVersion()})`))
  autoUpdater.on('update-not-available', (info) => logUpdater(`최신 버전 (${info.version})`))
  autoUpdater.on('update-available', (info) => logUpdater(`새 버전 발견: ${info.version} → 다운로드`))
  autoUpdater.on('update-downloaded', (info) => {
    logUpdater(`다운로드 완료: ${info.version} → 설치 후 재시작`)
    autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater]', err.message)
    logUpdater(`오류: ${err.message}`)
  })
  autoUpdater.checkForUpdates()
}

// 지점 PC에서 업데이트 결과를 확인할 수 있도록 userData/logs/updater.log 에 남김
function logUpdater(message) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(path.join(dir, 'updater.log'), `${new Date().toISOString()} ${message}\n`)
  } catch (_) {
    // 로그 실패가 업데이트를 막지 않도록 무시
  }
}

app.whenReady().then(() => {
  if (!gotLock) return
  bridge.start()
  if (!isDev) {
    checkForUpdates()
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
