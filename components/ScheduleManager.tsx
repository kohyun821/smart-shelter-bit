'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Trash2, ChevronDown, ChevronUp, Snowflake, Lightbulb, Flame, DoorOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { type Schedule, saveSchedulesToStorage } from '@/hooks/use-scheduler'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FacilityInfo {
  id: string
  name: string
  type: string
}

interface ScheduleManagerProps {
  facilities: FacilityInfo[]
  stationId: string
  /** Called after any schedule change so the parent can re-sync the scheduler. */
  onScheduleChange?: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BRIDGE_URL = 'http://localhost:4000'

const FACILITY_ICON: Record<string, LucideIcon> = {
  inner_led:                  Lightbulb,
  outter_led:                 Lightbulb,
  air_conditioner:            Snowflake,
  heat_seat:                  Flame,
  auto_door:                  DoorOpen,
  auto_door_power_controller: DoorOpen,
  auto_door_manual_open:      DoorOpen,
}

// Human-readable label for an action+value pair
function actionLabel(action: string, value: string): string {
  if (action === 'power') return value === 'true' ? '전원 켜기' : '전원 끄기'
  if (action === 'temp') return `온도 ${value}°C`
  if (action === 'mode') {
    const map: Record<string, string> = { cool: '냉방', hot: '난방', normal: '송풍' }
    return `모드: ${map[value] ?? value}`
  }
  if (action === 'wind') {
    const map: Record<string, string> = { auto: '자동', light: '약풍', moderate: '중풍', strong: '강풍' }
    return `풍속: ${map[value] ?? value}`
  }
  return `${action}=${value}`
}

// ─── Action options per facility type ────────────────────────────────────────

interface ActionOption {
  action: string
  value: string
  label: string
}

function getActionOptions(facilityType: string): ActionOption[] {
  const base: ActionOption[] = [
    { action: 'power', value: 'true', label: '전원 켜기' },
    { action: 'power', value: 'false', label: '전원 끄기' },
  ]
  if (facilityType !== 'air_conditioner') return base

  return [
    ...base,
    { action: 'temp', value: '18', label: '온도 18°C' },
    { action: 'temp', value: '20', label: '온도 20°C' },
    { action: 'temp', value: '22', label: '온도 22°C' },
    { action: 'temp', value: '24', label: '온도 24°C' },
    { action: 'temp', value: '26', label: '온도 26°C' },
    { action: 'temp', value: '28', label: '온도 28°C' },
    { action: 'mode', value: 'cool', label: '모드: 냉방' },
    { action: 'mode', value: 'hot', label: '모드: 난방' },
    { action: 'mode', value: 'normal', label: '모드: 송풍' },
    { action: 'wind', value: 'auto', label: '풍속: 자동' },
    { action: 'wind', value: 'light', label: '풍속: 약풍' },
    { action: 'wind', value: 'moderate', label: '풍속: 중풍' },
    { action: 'wind', value: 'strong', label: '풍속: 강풍' },
  ]
}

// ─── ScheduleRow ──────────────────────────────────────────────────────────────

function ScheduleRow({
  schedule,
  facilityName,
  facilityType,
  onToggle,
  onDelete,
}: {
  schedule: Schedule
  facilityName: string
  facilityType: string
  onToggle: () => void
  onDelete: () => void
}) {
  const Icon = FACILITY_ICON[facilityType] ?? Lightbulb

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-2xl border transition-colors',
        schedule.isActive
          ? 'bg-white border-slate-200'
          : 'bg-slate-50 border-slate-100 opacity-60',
      )}
    >
      {/* Time badge */}
      <span className="min-w-[3.5rem] text-center font-mono text-sm font-bold bg-[#9E2B25]/10 text-[#9E2B25] px-2 py-0.5 rounded-lg">
        {schedule.executeTime}
      </span>

      {/* Facility icon + name */}
      <div className="flex items-center gap-1.5 min-w-[7rem]">
        <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span className="text-xs text-slate-600 truncate">{facilityName}</span>
      </div>

      {/* Action description */}
      <span className="flex-1 text-sm text-slate-700 font-medium truncate">
        {actionLabel(schedule.action, schedule.value)}
      </span>

      {/* Active toggle */}
      <Switch
        checked={schedule.isActive}
        onCheckedChange={onToggle}
        className="scale-90 data-[state=checked]:bg-[#9E2B25] data-[state=unchecked]:bg-slate-200"
      />

      {/* Delete */}
      <button
        onClick={onDelete}
        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        title="삭제"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── AddScheduleForm ──────────────────────────────────────────────────────────

function AddScheduleForm({
  facilities,
  stationId,
  onAdd,
  onCancel,
}: {
  facilities: FacilityInfo[]
  stationId: string
  onAdd: (s: Schedule) => void
  onCancel: () => void
}) {
  const [facilityId, setFacilityId] = useState(facilities[0]?.id ?? '')
  const [executeTime, setExecuteTime] = useState('09:00')
  const [actionKey, setActionKey] = useState('power|true') // "action|value"

  const selectedFacility = facilities.find((f) => f.id === facilityId)
  const actionOptions = getActionOptions(selectedFacility?.type ?? '')

  // Reset action when facility changes
  function handleFacilityChange(id: string) {
    setFacilityId(id)
    setActionKey('power|true')
  }

  function handleSubmit() {
    const [action, value] = actionKey.split('|')
    const newSchedule: Schedule = {
      scheduleId: '', // server will assign
      facilityId,
      stationId,
      action,
      value,
      executeTime,
      isActive: true,
    }
    onAdd(newSchedule)
  }

  return (
    <div className="border border-[#9E2B25]/20 bg-[#9E2B25]/5 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-xs font-bold text-[#9E2B25] uppercase tracking-widest">새 스케줄 추가</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* Facility */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">시설물</label>
          <select
            value={facilityId}
            onChange={(e) => handleFacilityChange(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#9E2B25]/30"
          >
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        {/* Time */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">실행 시간</label>
          <input
            type="time"
            value={executeTime}
            onChange={(e) => setExecuteTime(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#9E2B25]/30"
          />
        </div>

        {/* Action */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">동작</label>
          <select
            value={actionKey}
            onChange={(e) => setActionKey(e.target.value)}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#9E2B25]/30"
          >
            {actionOptions.map((o) => (
              <option key={`${o.action}|${o.value}`} value={`${o.action}|${o.value}`}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors"
        >
          취소
        </button>
        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 rounded-xl text-sm font-semibold bg-[#9E2B25] text-white hover:bg-[#7e221d] transition-colors"
        >
          추가
        </button>
      </div>
    </div>
  )
}

// ─── ScheduleManager ──────────────────────────────────────────────────────────

export function ScheduleManager({ facilities, stationId, onScheduleChange }: ScheduleManagerProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [expanded, setExpanded] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  // ── Fetch schedules from server ─────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${BRIDGE_URL}/Schedule?stationId=${stationId}`)
      const json = await res.json()
      if (json.resultCd === '200' && Array.isArray(json.data)) {
        setSchedules(json.data)
        saveSchedulesToStorage(json.data) // keep localStorage in sync
      }
    } catch {
      /* bridge offline — keep current state */
    } finally {
      setLoading(false)
    }
  }, [stationId])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggle(scheduleId: string) {
    const target = schedules.find((s) => s.scheduleId === scheduleId)
    if (!target) return

    const updated = { ...target, isActive: !target.isActive }
    // Optimistic update
    setSchedules((prev) => prev.map((s) => (s.scheduleId === scheduleId ? updated : s)))

    try {
      await fetch(`${BRIDGE_URL}/Schedule/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updated.isActive }),
      })
    } catch { /* offline — local only until next sync */ }

    // Sync localStorage
    const next = schedules.map((s) => (s.scheduleId === scheduleId ? updated : s))
    saveSchedulesToStorage(next)
    onScheduleChange?.()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(scheduleId: string) {
    setSchedules((prev) => prev.filter((s) => s.scheduleId !== scheduleId))

    try {
      await fetch(`${BRIDGE_URL}/Schedule/${scheduleId}`, { method: 'DELETE' })
    } catch { /* offline */ }

    const next = schedules.filter((s) => s.scheduleId !== scheduleId)
    saveSchedulesToStorage(next)
    onScheduleChange?.()
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  async function handleAdd(draft: Schedule) {
    try {
      const res = await fetch(`${BRIDGE_URL}/Schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json()
      if (json.resultCd === '200' && json.data) {
        const next = [...schedules, json.data as Schedule]
        // Sort by time for readability
        next.sort((a, b) => a.executeTime.localeCompare(b.executeTime))
        setSchedules(next)
        saveSchedulesToStorage(next)
        onScheduleChange?.()
      }
    } catch {
      // Offline: generate a temporary ID and add locally
      const offlineEntry: Schedule = {
        ...draft,
        scheduleId: `sch_local_${Date.now()}`,
      }
      const next = [...schedules, offlineEntry].sort((a, b) =>
        a.executeTime.localeCompare(b.executeTime),
      )
      setSchedules(next)
      saveSchedulesToStorage(next)
      onScheduleChange?.()
    }
    setShowAddForm(false)
  }

  // ── Facility lookup helper ─────────────────────────────────────────────────

  function facilityInfo(facilityId: string) {
    return facilities.find((f) => f.id === facilityId)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#9E2B25]/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-[#9E2B25]" />
          </div>
          <div className="text-left">
            <p className="font-bold text-slate-800 text-sm">자동 스케줄</p>
            <p className="text-xs text-slate-400">
              {loading ? '불러오는 중…' : `${schedules.length}개 항목 · ${schedules.filter((s) => s.isActive).length}개 활성`}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-2">
          {/* Empty state */}
          {schedules.length === 0 && !loading && (
            <div className="text-center py-6 text-slate-400 text-sm">
              등록된 스케줄이 없습니다.
            </div>
          )}

          {/* Schedule rows — sorted by executeTime */}
          {schedules
            .slice()
            .sort((a, b) => a.executeTime.localeCompare(b.executeTime))
            .map((s) => {
              const info = facilityInfo(s.facilityId)
              return (
                <ScheduleRow
                  key={s.scheduleId}
                  schedule={s}
                  facilityName={info?.name ?? s.facilityId}
                  facilityType={info?.type ?? ''}
                  onToggle={() => handleToggle(s.scheduleId)}
                  onDelete={() => handleDelete(s.scheduleId)}
                />
              )
            })}

          {/* Add form */}
          {showAddForm ? (
            <AddScheduleForm
              facilities={facilities}
              stationId={stationId}
              onAdd={handleAdd}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl border border-dashed border-slate-300 text-slate-400 hover:border-[#9E2B25]/40 hover:text-[#9E2B25] hover:bg-[#9E2B25]/5 transition-colors text-sm font-medium mt-1"
            >
              <Plus className="w-4 h-4" />
              스케줄 추가
            </button>
          )}
        </div>
      )}
    </div>
  )
}
