'use strict'

// ─── Log buffer ───────────────────────────────────────────────────────────────

const LOG_MAX = 500

/** @type {Array<{t: number, level: 'info'|'warn'|'error', msg: string}>} */
const logBuffer = []

/** @type {Set<import('http').ServerResponse>} */
const sseClients = new Set()

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
}

// ─── console 패치 (require 시 즉시 적용) ─────────────────────────────────────

const _log   = console.log.bind(console)
const _warn  = console.warn.bind(console)
const _error = console.error.bind(console)

console.log   = (...args) => { _log(...args);   addEntry('info',  args) }
console.warn  = (...args) => { _warn(...args);  addEntry('warn',  args) }
console.error = (...args) => { _error(...args); addEntry('error', args) }

// ─── SSE 클라이언트 관리 ──────────────────────────────────────────────────────

/**
 * SSE 클라이언트를 등록하고 기존 로그 히스토리를 즉시 전송합니다.
 * @param {import('http').ServerResponse} res
 */
function registerSseClient(res) {
  sseClients.add(res)
  res.write(`event: history\ndata: ${JSON.stringify(logBuffer)}\n\n`)
}

/**
 * SSE 클라이언트를 제거합니다.
 * @param {import('http').ServerResponse} res
 */
function unregisterSseClient(res) {
  sseClients.delete(res)
}

module.exports = { registerSseClient, unregisterSseClient }
