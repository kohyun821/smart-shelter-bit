'use client'

import { useState, useEffect, useRef } from 'react'

interface LogEntry {
  t: number
  level: 'info' | 'warn' | 'error'
  msg: string
}

const BRIDGE_URL = 'http://localhost:4000'

const LEVEL_COLOR: Record<LogEntry['level'], string> = {
  info:  '#4ade80', // green-400
  warn:  '#facc15', // yellow-400
  error: '#f87171', // red-400
}

function timestamp(t: number) {
  return new Date(t).toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function LogPanel() {
  const [open, setOpen]   = useState(false)
  const [logs, setLogs]   = useState<LogEntry[]>([])
  const bottomRef         = useRef<HTMLDivElement>(null)
  const sourceRef         = useRef<EventSource | null>(null)

  // l 키로 패널 토글
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') setOpen(v => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 패널 열릴 때 SSE 연결, 닫힐 때 해제
  useEffect(() => {
    if (!open) {
      sourceRef.current?.close()
      sourceRef.current = null
      return
    }

    const es = new EventSource(`${BRIDGE_URL}/api/logs/stream`)
    sourceRef.current = es

    es.addEventListener('history', (e) => {
      try { setLogs(JSON.parse(e.data)) } catch { /* noop */ }
    })

    es.addEventListener('log', (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data)
        setLogs(prev => [...prev.slice(-499), entry])
      } catch { /* noop */ }
    })

    return () => { es.close(); sourceRef.current = null }
  }, [open])

  // 새 로그 진입 시 자동 스크롤
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [logs, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.93)', fontFamily: 'monospace' }}
    >
      {/* 헤더 */}
      <div
        className="shrink-0 flex items-center justify-between px-5 py-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold tracking-widest" style={{ color: '#4ade80' }}>
            ● SYSTEM LOG
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {logs.length}개 항목
          </span>
        </div>
        <div className="flex items-center gap-5">
          <button
            onClick={() => setLogs([])}
            className="text-xs transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
          >
            CLEAR
          </button>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            L 키로 닫기
          </span>
        </div>
      </div>

      {/* 로그 목록 */}
      <div className="flex-1 overflow-y-auto px-5 py-3 text-xs leading-6">
        {logs.length === 0 && (
          <p style={{ color: 'rgba(255,255,255,0.2)' }}>로그가 없습니다.</p>
        )}
        {logs.map((entry, i) => (
          <div key={i} className="flex gap-4 min-w-0">
            <span className="shrink-0 tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
              {timestamp(entry.t)}
            </span>
            <span
              className="shrink-0 w-10 font-bold uppercase"
              style={{ color: LEVEL_COLOR[entry.level] }}
            >
              {entry.level}
            </span>
            <span className="break-all" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {entry.msg}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
