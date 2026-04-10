'use strict'

const path = require('path')
const fs = require('fs')

function getConfigPath() {
  try {
    const { app } = require('electron')
    if (app && app.isPackaged) {
      return path.join(process.resourcesPath, 'config', 'settings.json')
    }
  } catch {
    // standalone node process (e.g. node server/bridge.js)
  }
  return path.join(__dirname, '..', 'config', 'settings.json')
}

const CONFIG_PATH = getConfigPath()

const DEFAULTS = {
  websocket: {
    host: 'localhost',
    port: 1470,
  },
  serial: {
    port: 'COM3',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
  },
  acSerial: {
    port: 'COM4',
    baudRate: 9600,
    dataBits: 8,
    stopBits: 1,
    parity: 'none',
  },
  modbus: {
    pollInterval: 30000,  // ms — 코일 상태 읽기 주기 (기본 30초)
  },
  mediamtx: {
    apiUrl: 'http://127.0.0.1:9997',   // MediaMTX REST API
    hlsUrl: 'http://127.0.0.1:8888',   // MediaMTX HLS 베이스 URL
  },
  cameras: [],  // [{ camId: 1, rtsp: 'rtsp://...' }, ...]
  // ── 제어 모드 ──────────────────────────────────────────────────────────────
  // 'modbus'     : 직접 Modbus RTU 시리얼 통신 (신규 PC 기본값)
  // 'http_proxy' : 구형 미니PC의 HTTP REST API로 제어 명령 포워딩
  controlMode: 'modbus',
  legacyServer: {
    baseUrl: 'http://localhost:8080',  // 구형 미니PC HTTP 서버 주소
    timeout: 10000,                    // 요청 타임아웃 (ms)
  },
}

/**
 * 설정 파일(config/settings.json)을 읽어서 반환합니다.
 * 파일이 없거나 파싱 실패 시 기본값을 사용합니다.
 * 환경 변수 BRIDGE_WS_URL 이 있으면 WebSocket URL을 덮어씁니다.
 * @returns {{ websocket: { host: string, port: number }, serial: object, acSerial: object, wsUrl: string }}
 */
function loadSettings() {
  let raw = { ...DEFAULTS }

  try {
    const fullPath = path.resolve(CONFIG_PATH)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const parsed = JSON.parse(content)
      if (parsed.websocket) {
        raw.websocket = { ...DEFAULTS.websocket, ...parsed.websocket }
      }
      if (parsed.serial) {
        raw.serial = { ...DEFAULTS.serial, ...parsed.serial }
      }
      if (parsed.acSerial) {
        raw.acSerial = { ...DEFAULTS.acSerial, ...parsed.acSerial }
      }
      if (parsed.modbus) {
        raw.modbus = { ...DEFAULTS.modbus, ...parsed.modbus }
      }
      if (parsed.mediamtx) {
        raw.mediamtx = { ...DEFAULTS.mediamtx, ...parsed.mediamtx }
      }
      if (Array.isArray(parsed.cameras)) {
        raw.cameras = parsed.cameras
      }
      if (parsed.controlMode) {
        raw.controlMode = parsed.controlMode
      }
      if (parsed.legacyServer) {
        raw.legacyServer = { ...DEFAULTS.legacyServer, ...parsed.legacyServer }
      }
    }
  } catch (err) {
    console.warn('[Settings] Could not load config/settings.json:', err.message)
  }

  const host = String(raw.websocket.host || DEFAULTS.websocket.host).trim()
  const port = Number(raw.websocket.port) || DEFAULTS.websocket.port

  // wsBaseUrl: stationId 경로를 제외한 기본 URL
  // 환경변수 BRIDGE_WS_URL이 있으면 그대로 사용 (stationId 경로 포함 가정)
  const wsBaseUrl = `ws://${host}:${port}`
  const wsUrl = process.env.BRIDGE_WS_URL || wsBaseUrl

  return {
    websocket: { host, port },
    serial: { ...raw.serial },
    acSerial: { ...raw.acSerial },
    modbus: { ...raw.modbus },
    mediamtx: { ...raw.mediamtx },
    cameras: raw.cameras || [],
    controlMode: raw.controlMode || 'modbus',
    legacyServer: { ...raw.legacyServer },
    wsBaseUrl,  // ws://host:port (stationId 경로 미포함)
    wsUrl,      // 환경변수 BRIDGE_WS_URL 우선 적용 시 사용
  }
}

module.exports = { loadSettings, CONFIG_PATH, DEFAULTS }
