'use strict'

const fs   = require('fs')
const path = require('path')

// ─── Log buffer ───────────────────────────────────────────────────────────────

const LOG_MAX = 500

/** @type {Array<{t: number, level: 'info'|'warn'|'error', msg: string}>} */
const logBuffer = []

/** @type {Set<import('http').ServerResponse>} */
const sseClients = new Set()

// ─── File logging state ───────────────────────────────────────────────────────

let fileEnabled  = false
let fileStream   = null   // 현재 열린 WriteStream
let currentDay   = ''     // 'YYYY-MM-DD'
let logDir       = ''
let maxSizeBytes = 10 * 1024 * 1024  // 기본 10 MB
let keepDays     = 7
let bytesWritten = 0

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowStr() {
  const d = new Date()
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`
  return { date, time, datetime: `${date} ${time}` }
}

function openStream(day) {
  if (fileStream) { try { fileStream.end() } catch {} }
  const filePath = path.join(logDir, `bridge-${day}.log`)
  fileStream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' })
  fileStream.on('error', err => { console.error('[Logger] 파일 쓰기 오류:', err.message) })
  bytesWritten = fs.existsSync(filePath) ? (fs.statSync(filePath).size) : 0
  currentDay = day
}

function deleteOldLogs() {
  try {
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000
    for (const f of fs.readdirSync(logDir)) {
      if (!f.startsWith('bridge-') || !f.endsWith('.log')) continue
      const full = path.join(logDir, f)
      if (fs.statSync(full).mtimeMs < cutoff) fs.unlinkSync(full)
    }
  } catch {}
}

function writeToFile(level, msg) {
  if (!fileEnabled || !fileStream) return
  try {
    const { date, datetime } = nowStr()

    // 날짜 바뀌면 새 파일로 교체
    if (date !== currentDay) {
      openStream(date)
      deleteOldLogs()
    }

    // 크기 초과 시 같은 날 파일에 rotate suffix 붙여 교체
    if (bytesWritten >= maxSizeBytes) {
      const suffix = Date.now()
      try { fs.renameSync(path.join(logDir, `bridge-${currentDay}.log`),
                          path.join(logDir, `bridge-${currentDay}-${suffix}.log`)) } catch {}
      openStream(currentDay)
    }

    const line = `[${datetime}] [${level.toUpperCase().padEnd(5)}] ${msg}\n`
    fileStream.write(line)
    bytesWritten += Buffer.byteLength(line)
  } catch {}
}

// ─── Core entry ───────────────────────────────────────────────────────────────

function addEntry(level, args) {
  const msg = args
    .map(a => (a !== null && typeof a === 'object' ? JSON.stringify(a) : String(a)))
    .join(' ')

  const entry = { t: Date.now(), level, msg }
  logBuffer.push(entry)
  if (logBuffer.length > LOG_MAX) logBuffer.shift()

  const chunk = `event: log\ndata: ${JSON.stringify(entry)}\n\n`
  for (const res of sseClients) {
    try { res.write(chunk) } catch { sseClients.delete(res) }
  }

  writeToFile(level, msg)
}

// ─── console 패치 (require 시 즉시 적용) ─────────────────────────────────────

const _log   = console.log.bind(console)
const _warn  = console.warn.bind(console)
const _error = console.error.bind(console)

console.log   = (...args) => { _log(...args);   addEntry('info',  args) }
console.warn  = (...args) => { _warn(...args);  addEntry('warn',  args) }
console.error = (...args) => { _error(...args); addEntry('error', args) }

// ─── 파일 로깅 초기화 (bridge.js 에서 settings 로드 후 호출) ─────────────────

/**
 * @param {{ enableFile?: boolean, maxSizeMb?: number, keepDays?: number }} opts
 * @param {string} dataDir  data/ 디렉토리 절대 경로
 */
function initFileLogging(opts, dataDir) {
  if (!opts || !opts.enableFile) return
  try {
    logDir = path.join(dataDir, 'logs')
    fs.mkdirSync(logDir, { recursive: true })
    maxSizeBytes = (opts.maxSizeMb || 10) * 1024 * 1024
    keepDays     = opts.keepDays || 7
    fileEnabled  = true
    openStream(nowStr().date)
    deleteOldLogs()
    console.log(`[Logger] 파일 로그 활성화 → ${logDir}`)
  } catch (err) {
    console.error('[Logger] 파일 로그 초기화 실패:', err.message)
  }
}

// ─── SSE 클라이언트 관리 ──────────────────────────────────────────────────────

function registerSseClient(res) {
  sseClients.add(res)
  res.write(`event: history\ndata: ${JSON.stringify(logBuffer)}\n\n`)
}

function unregisterSseClient(res) {
  sseClients.delete(res)
}

module.exports = { registerSseClient, unregisterSseClient, initFileLogging }
