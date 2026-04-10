'use strict'

const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const cors = require('cors')
const EventEmitter = require('events')
const { loadSettings } = require('./loadSettings')

// ─── Config ───────────────────────────────────────────────────────────────────

const settings = loadSettings()
const HTTP_PORT = process.env.BRIDGE_HTTP_PORT ? Number(process.env.BRIDGE_HTTP_PORT) : 4000



// ─── Internal Event Bus ───────────────────────────────────────────────────────

const bus = new EventEmitter()
bus.setMaxListeners(50)

// ─── WebSocket Client ─────────────────────────────────────────────────────────

let wsClient = null
let wsReady = false
let wsUrl = ''                // 실제 연결에 사용되는 전체 URL (stationId 포함)
let reconnectTimer = null
let reconnectDelay = 1000     // 1s → 최대 30s (exponential backoff)
let statusUpdateTimer = null  // 5분 주기 status:update 타이머
let wasConnected = false      // 한 번이라도 연결된 적 있는지 (stopAll 조건 판단용)

/**
 * data/setting.json에서 첫 번째 stationId를 읽어 반환합니다.
 */
async function getStationId() {
  try {
    const fs = require('fs')
    const path = require('path')
    const data = fs.readFileSync(path.join(__dirname, '../data/setting.json'), 'utf-8')
    const json = JSON.parse(data)
    if (Array.isArray(json) && json.length > 0 && json[0].stationId) {
      return json[0].stationId
    }
  } catch (err) {
    console.warn('[Bridge][WS] stationId 읽기 실패:', err.message)
  }
  return 'UNKNOWN'
}

function connectWS() {
  if (wsClient) {
    wsClient.removeAllListeners()
    wsClient.terminate()
  }

  console.log(`[Bridge][WS] Connecting to ${wsUrl} ...`)
  wsClient = new WebSocket(wsUrl)

  wsClient.on('open', () => {
    console.log('[Bridge][WS] Connected')
    wsReady = true
    wasConnected = true
    reconnectDelay = 1000
    bus.emit('ws:status', { connected: true, url: wsUrl })

    // 연결 직후 즉시 상태 전송
    sendStatusUpdate().catch(() => { })

    // 5분 주기 status:update 타이머 시작
    startStatusUpdateTimer()
  })

  wsClient.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      console.log('[Bridge][WS] ←', msg)
      bus.emit('ws:message', msg)
    } catch {
      console.warn('[Bridge][WS] Non-JSON message:', data.toString())
    }
  })

  wsClient.on('close', (code) => {
    wsReady = false
    console.warn(`[Bridge][WS] Closed (${code}). Reconnecting in ${reconnectDelay}ms …`)
    bus.emit('ws:status', { connected: false })
    stopStatusUpdateTimer()
    scheduleReconnect()
  })

  wsClient.on('error', (err) => {
    console.error('[Bridge][WS] Error:', err.message)
  })
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer)
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
    connectWS()
  }, reconnectDelay)
}

function sendWS(payload) {
  if (!wsClient || !wsReady) throw new Error('WebSocket not connected')
  const raw = JSON.stringify(payload)
  console.log('[Bridge][WS] →', raw)
  wsClient.send(raw)
}

// ─── status:update 전송 ───────────────────────────────────────────────────────

/**
 * 현재 시설물 상태를 읽어 서버에 status:update로 전송합니다.
 * WS가 연결되지 않은 경우 조용히 무시합니다.
 */
async function sendStatusUpdate() {
  if (!wsReady) return
  try {
    const baseUrl = settings.legacyServer?.baseUrl || ''
    if (!baseUrl) return

    const res = await fetch(`${baseUrl}/Status`)
    const resData = await res.json()

    sendWS({ type: 'status:update', data: resData.data || [], cameras: [] })

    console.log(`[Bridge][WS] → status:update 전송 완료`)
  } catch (err) {
    console.warn('[Bridge][WS] status:update 전송 실패:', err.message)
  }
}

function startStatusUpdateTimer() {
  stopStatusUpdateTimer()
  const FIVE_MIN = 5 * 60 * 1000
  statusUpdateTimer = setInterval(() => {
    sendStatusUpdate().catch(() => { })
  }, FIVE_MIN)
  console.log('[Bridge][WS] status:update 주기 타이머 시작 (5분)')
}

function stopStatusUpdateTimer() {
  if (statusUpdateTimer) {
    clearInterval(statusUpdateTimer)
    statusUpdateTimer = null
  }
}

// ─── SSE Helpers ──────────────────────────────────────────────────────────────

const sseClients = new Set()

function pushSSE(event, data) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) res.write(chunk)
}

bus.on('ws:message', (msg) => pushSSE('message', msg))
bus.on('ws:status', (s) => pushSSE('ws-status', s))

// ─── 시설물 제어 공통 함수 ────────────────────────────────────────────────────

/**
 * WS control 메시지의 optCode를 내부 facilityOptCode로 변환합니다.
 * CLIENT_INTERFACE.md 기준:
 *   wind_mode → wind
 *   set_temp  → temp
 */
function normalizeOptCode(optCode) {
  const map = { wind_mode: 'wind', set_temp: 'temp' }
  return map[optCode] ?? optCode
}

/**
 * 시설물 제어 공통 처리:
 *  1. facilities.json 상태 저장
 *  2. Modbus RTU / AC Modbus 전송
 *  3. SSE 상태 변경 알림
 *
 * @param {string} stationId
 * @param {string} facilityId
 * @param {Array<{control: string, value: string}>} facilityOpt  - 내부 코드(power/mode/wind/temp)
 * @returns {Promise<object>} dataStore.applyControl 결과
 */
async function applyFacilityControl(stationId, facilityId, facilityOpt) {
  // ── HTTP 프록시: 외부 서버로 포워딩 ──────────────────────
  const baseUrl = settings.legacyServer?.baseUrl || ''
  if (!baseUrl) throw new Error('external API URL not configured')

  console.log(`[Bridge][Control] 외부 API를 통한 제어 모드 → ${baseUrl}`)
  for (const opt of facilityOpt) {
    const payload = {
      facilityId,
      facilityOptCode: opt.control,
      facilityOptValue: String(opt.value),
    }

    const res = await fetch(`${baseUrl}/Control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error(`[Bridge] 외부 API 제어 실패:`, errText)
      throw new Error(`External API Control Failed: ${res.status}`)
    }
  }

  // SSE 구독자에게 상태 변경 알림 (외부 서버 최신 상태 로드)
  try {
    const statusRes = await fetch(`${baseUrl}/Status`)
    const parsed = await statusRes.json()
    pushSSE('status-update', parsed.data || [])
  } catch (e) {
    console.warn('SSE status sync failed:', e.message)
  }

  return { success: true }
}

// ─── WebSocket 메시지 핸들러 ──────────────────────────────────────────────────

bus.on('ws:message', async (msg) => {
  // ── status:request: 서버가 즉시 상태 보고를 요청 ──────────────────────────
  if (msg.type === 'status:request') {
    console.log('[Bridge][WS] status:request 수신 → status:update 전송')
    await sendStatusUpdate()
    return
  }

  // ── control: 서버가 시설물 제어 명령 전달 ─────────────────────────────────
  if (msg.type === 'control') {
    const { facilityId, optCode, optValue } = msg

    if (!facilityId || !optCode || optValue === undefined) {
      console.warn('[Bridge][WS] control 메시지 필드 누락:', msg)
      return
    }

    // WS optCode → 내부 코드 변환
    const internalCode = normalizeOptCode(optCode)
    const facilityOpt = [{ control: internalCode, value: String(optValue) }]

    try {
      // stationId는 stations.json에서 읽음
      const stationId = await getStationId()
      await applyFacilityControl(stationId, facilityId, facilityOpt)

      // 제어 성공 응답
      const ackPayload = { type: 'control:ack', facilityId, success: true }
      console.log(`[Bridge][ACK] 전송 →`, JSON.stringify(ackPayload))
      try {
        sendWS(ackPayload)
      } catch (e) {
        console.error(`[Bridge][ACK] 전송 실패:`, e.message)
      }

      // 상태 동기화
      await sendStatusUpdate()

      console.log(`[Bridge][WS] control 처리 완료: ${facilityId} ${optCode}=${optValue}`)
    } catch (err) {
      console.error(`[Bridge][WS] control 처리 실패: ${facilityId}`, err.message)
      const ackPayload = { type: 'control:ack', facilityId, success: false, reason: err.message }
      console.log(`[Bridge][ACK] 전송 →`, JSON.stringify(ackPayload))
      try {
        sendWS(ackPayload)
      } catch (e) {
        console.error(`[Bridge][ACK] 전송 실패:`, e.message)
      }
    }
    return
  }

  // ── schedule:sync: 무시 (더 이상 로컬 스케줄 없음) ───────────────
  if (msg.type === 'schedule:sync') {
    sendWS({ type: 'schedule:synced', count: 0 })
    return
  }
})

// ─── Express App ──────────────────────────────────────────────────────────────

const app = express()

app.use(cors({ origin: '*' }))
app.use(express.json())

// ── Interface API (INTERFACE.md) ──────────────────────────────────────────────

app.get('/List', async (_req, res) => {
  try {
    const baseUrl = settings.legacyServer?.baseUrl || ''
    if (!baseUrl) return res.json({ resultCd: '200', data: [] })
    const extRes = await fetch(`${baseUrl}/List`)
    const data = await extRes.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ resultCd: '500', resultMsg: 'Error', resultDesc: e.message, data: null })
  }
})

/**
 * GET /Status
 */
app.get('/Status', async (req, res) => {
  try {
    const { stationId } = req.query
    const baseUrl = settings.legacyServer?.baseUrl || ''
    if (!baseUrl) return res.json({ resultCd: '200', data: [] })
    const url = stationId ? `${baseUrl}/Status?stationId=${stationId}` : `${baseUrl}/Status`
    const extRes = await fetch(url)
    const data = await extRes.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ resultCd: '500', resultMsg: 'Error', resultDesc: e.message, data: null })
  }
})

/**
 * POST /Control
 * Sends control commands to a specific facility and persists the new state.
 * body: { stationId, facilityId, facilityOpt: [{ control, value }] }
 */
app.post('/Control', async (req, res) => {
  const { stationId, facilityId, facilityOpt } = req.body ?? {}

  if (!stationId || !facilityId || !Array.isArray(facilityOpt)) {
    return res.status(400).json({
      resultCd: '400',
      resultMsg: 'Bad Request',
      resultDesc: 'stationId, facilityId, and facilityOpt[] are required',
    })
  }

  try {
    const result = await applyFacilityControl(stationId, facilityId, facilityOpt)

    // WS 연결 중이면 서버에 상태 동기화
    await sendStatusUpdate()

    res.json(result)
  } catch (e) {
    res.status(500).json({ resultCd: '500', resultMsg: 'Error', resultDesc: e.message })
  }
})



// ── Health ────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, wsConnected: wsReady, wsUrl, timestamp: new Date().toISOString() })
})

// ── WebSocket 상태 ─────────────────────────────────────────────────────────────

app.get('/api/ws/status', (_req, res) => {
  res.json({ connected: wsReady, url: wsUrl })
})

// ── WebSocket 직접 전송 ────────────────────────────────────────────────────────

app.post('/api/ws/send', (req, res) => {
  try {
    sendWS(req.body)
    res.json({ ok: true })
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message })
  }
})

// ── SSE — 실시간 이벤트 스트림 ────────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.flushHeaders()
  res.write(`event: ws-status\ndata: ${JSON.stringify({ connected: wsReady })}\n\n`)

  sseClients.add(res)
  console.log(`[Bridge][SSE] Client connected (total: ${sseClients.size})`)

  req.on('close', () => {
    sseClients.delete(res)
    console.log(`[Bridge][SSE] Client disconnected (total: ${sseClients.size})`)
  })
})

// ─── HTTP Server ──────────────────────────────────────────────────────────────

const server = http.createServer(app)

async function start({ connectWebSocket = true } = {}) {
  server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`[Bridge] Listening on http://localhost:${HTTP_PORT}`)
    console.log(`[Bridge]   GET /List    → data/stations.json`)
    console.log(`[Bridge]   GET /Status  → data/facilities.json`)
  })



  if (connectWebSocket) {
    // stationId를 읽어 WS URL 구성 후 연결
    const stationId = await getStationId()
    wsUrl = process.env.BRIDGE_WS_URL || `${settings.wsBaseUrl}/ws/shelter/${stationId}`
    console.log(`[Bridge][WS] 대상 URL: ${wsUrl} (stationId: ${stationId})`)
    connectWS()
  }
}

function stop() {
  clearTimeout(reconnectTimer)
  stopStatusUpdateTimer()
  if (wsClient) {
    wsClient.removeAllListeners()
    wsClient.terminate()
  }
  for (const res of sseClients) res.end()
  sseClients.clear()

  server.close()
  console.log('[Bridge] Stopped')
}

module.exports = { start, stop }

// ─── Standalone Entry Point ───────────────────────────────────────────────────
// node server/bridge.js              → data-only mode (no WebSocket)
// node server/bridge.js --ws         → also connects to WebSocket backend

if (require.main === module) {
  const connectWebSocket = process.argv.includes('--ws')
  start({ connectWebSocket })
}
