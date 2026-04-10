'use client'

import { useEffect, useRef, useCallback } from 'react'

const BRIDGE_URL = 'http://localhost:4000'
const STORAGE_KEY = 'smart_shelter_schedules'
const LOG_KEY = 'smart_shelter_schedule_logs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Schedule {
  scheduleId: string
  facilityId: string
  stationId: string
  action: string   // "power" | "set_temp" | "mode" | "wind_mode"
  value: string    // "true" | "false" | "24" | "cooler" | "strong" …
  executeTime: string  // "HH:MM"
  isActive: boolean
}

export interface ScheduleLog {
  scheduleId: string
  facilityId: string
  executeTime: string
  executedAt: string  // ISO timestamp
  success: boolean
  offline: boolean
  synced: boolean
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

export function loadSchedulesFromStorage(): Schedule[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function saveSchedulesToStorage(schedules: Schedule[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules))
  } catch { /* quota exceeded – ignore */ }
}

export function loadLogsFromStorage(): ScheduleLog[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]')
  } catch {
    return []
  }
}

function appendLog(log: ScheduleLog) {
  try {
    const logs = loadLogsFromStorage()
    // keep last 200 entries
    const next = [...logs, log].slice(-200)
    localStorage.setItem(LOG_KEY, JSON.stringify(next))
  } catch { /* ignore */ }
}

// ─── Time helper ──────────────────────────────────────────────────────────────

function nowHHMM(): string {
  const d = new Date()
  return (
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useScheduler
 *
 * - Fetches schedules from the server on mount and every 30 minutes.
 * - Saves them to localStorage so they survive network outages.
 * - Checks the current time every minute; when it matches a schedule's
 *   executeTime the hook fires a POST /Control request automatically.
 * - Logs every execution (success or failure, online or offline) to
 *   localStorage for later review.
 *
 * @param stationId  Optional station filter passed to GET /Schedule.
 * @returns          { sync } — call sync() externally to force a re-fetch
 *                   (e.g. after the user saves a new schedule in the UI).
 */
export function useScheduler(stationId?: string) {
  const lastMinute = useRef<string>('')
  // Tracks which scheduleIds already fired this minute to prevent double-execution.
  const executedThisMinute = useRef(new Set<string>())

  // ── Execute one schedule ──────────────────────────────────────────────────

  const executeSchedule = useCallback(async (schedule: Schedule) => {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    const executedAt = new Date().toISOString()
    let success = false

    try {
      const res = await fetch(`${BRIDGE_URL}/Control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: schedule.stationId,
          facilityId: schedule.facilityId,
          facilityOpt: [{ control: schedule.action, value: schedule.value }],
        }),
      })
      const json = await res.json()
      success = json.resultCd === '200'
    } catch {
      success = false
    }

    appendLog({
      scheduleId: schedule.scheduleId,
      facilityId: schedule.facilityId,
      executeTime: schedule.executeTime,
      executedAt,
      success,
      offline,
      synced: false,
    })

    console.info(
      `[Scheduler] ${schedule.scheduleId} (${schedule.facilityId} ${schedule.action}=${schedule.value}) @ ${schedule.executeTime} → ${success ? 'OK' : 'FAIL'}`,
    )
  }, [])

  // ── Tick: runs every minute ───────────────────────────────────────────────

  const tick = useCallback(() => {
    const now = nowHHMM()

    // New minute → reset the "already executed" guard
    if (now !== lastMinute.current) {
      executedThisMinute.current.clear()
      lastMinute.current = now
    }

    const schedules = loadSchedulesFromStorage()
    for (const s of schedules) {
      if (!s.isActive) continue
      if (s.executeTime !== now) continue
      if (executedThisMinute.current.has(s.scheduleId)) continue

      executedThisMinute.current.add(s.scheduleId)
      executeSchedule(s)
    }
  }, [executeSchedule])

  // ── Sync: fetch server schedules and persist locally ─────────────────────

  const sync = useCallback(async () => {
    try {
      const qs = stationId ? `?stationId=${encodeURIComponent(stationId)}` : ''
      const res = await fetch(`${BRIDGE_URL}/Schedule${qs}`)
      const json = await res.json()
      if (json.resultCd === '200' && Array.isArray(json.data)) {
        saveSchedulesToStorage(json.data)
      }
    } catch {
      // Offline — keep the copy already in localStorage
    }
  }, [stationId])

  // ── Mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    sync()

    // Re-sync from server every 30 minutes
    const syncId = setInterval(sync, 30 * 60 * 1000)

    // Check schedules every minute
    const tickId = setInterval(tick, 60 * 1000)

    return () => {
      clearInterval(syncId)
      clearInterval(tickId)
    }
  }, [sync, tick])

  return { sync }
}
