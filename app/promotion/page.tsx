'use client'

import React, { useState, useRef, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import {
  UploadCloud,
  Play,
  Lock,
  ChevronDown,
  ChevronRight,
  X,
  GripVertical,
  CalendarIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import type { DateRange } from 'react-day-picker'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaFile {
  id: string
  name: string
  type: 'image' | 'video'
  url: string
  durationSeconds?: number
}

interface TimelineItem {
  id: string
  fileId: string
  displaySeconds: number
  dateRange?: DateRange
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_GROUPS = [
  {
    groupId: 'A',
    groupNm: '그룹 A (인천)',
    stations: [
      { stationId: 'ST001', stationNm: 'ST001 주인공원' },
      { stationId: 'ST002', stationNm: 'ST002 미추홀 광장' },
    ],
  },
  {
    groupId: 'B',
    groupNm: '그룹 B (서울)',
    stations: [
      { stationId: 'ST003', stationNm: 'ST003 여의도공원' },
    ],
  },
]

const BLOCK_COLORS = [
  'bg-[#90BEDE]/20 border-[#90BEDE]/60',
  'bg-[#E5E1EE]/60 border-[#E5E1EE]',
  'bg-blue-100/60 border-blue-300',
  'bg-purple-100/60 border-purple-300',
  'bg-teal-100/60 border-teal-300',
]

// ─── MediaDraggable ───────────────────────────────────────────────────────────

function MediaDraggable({ file }: { file: MediaFile }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `media-${file.id}`,
    data: { type: 'media', file },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'relative rounded-lg overflow-hidden border border-slate-200 cursor-grab active:cursor-grabbing',
        'bg-white shadow-sm hover:shadow-md transition-shadow select-none',
        isDragging && 'opacity-40',
      )}
    >
      <div className="aspect-video bg-slate-100 flex items-center justify-center relative">
        {file.url ? (
          file.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <video src={file.url} className="w-full h-full object-cover" />
          )
        ) : (
          <span className="text-slate-400 text-xs">{file.type === 'image' ? '이미지' : '영상'}</span>
        )}
        {file.type === 'video' && (
          <>
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
            {file.durationSeconds !== undefined && (
              <Badge className="absolute top-1 right-1 text-[9px] py-0 px-1 bg-black/60 text-white border-0 h-4">
                {Math.floor(file.durationSeconds / 60)}:{String(file.durationSeconds % 60).padStart(2, '0')}
              </Badge>
            )}
          </>
        )}
      </div>
      <p className="text-[10px] text-slate-600 px-2 py-1 truncate">{file.name}</p>
    </div>
  )
}

// ─── TimelineDropZone ─────────────────────────────────────────────────────────

function TimelineDropZone({
  children,
  isEmpty,
  isOver,
}: {
  children: React.ReactNode
  isEmpty: boolean
  isOver: boolean
}) {
  return (
    <div
      className={cn(
        'min-h-[108px] rounded-xl border-2 border-dashed p-3 transition-colors flex items-start gap-3 overflow-x-auto',
        isEmpty
          ? isOver
            ? 'border-[#90BEDE] bg-[#90BEDE]/10 justify-center items-center'
            : 'border-slate-300 bg-slate-50 justify-center items-center'
          : isOver
            ? 'border-[#90BEDE] bg-[#90BEDE]/5'
            : 'border-slate-200 bg-white',
      )}
    >
      {isEmpty && !isOver ? (
        <p className="text-sm text-slate-400 select-none">미디어를 여기로 드래그하세요</p>
      ) : isEmpty && isOver ? (
        <p className="text-sm text-[#90BEDE] select-none">여기에 놓으세요</p>
      ) : (
        children
      )}
    </div>
  )
}

// ─── SortableTimelineItem ──────────────────────────────────────────────────────

function SortableTimelineItem({
  item,
  file,
  isSelected,
  colorClass,
  onSelect,
  onRemove,
}: {
  item: TimelineItem
  file: MediaFile | undefined
  isSelected: boolean
  colorClass: string
  onSelect: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: 'timeline-item', item },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onSelect}
      className={cn(
        'flex-shrink-0 w-28 rounded-lg border-2 overflow-hidden cursor-pointer transition-shadow select-none',
        colorClass,
        isSelected && 'ring-2 ring-[#90BEDE] ring-offset-1 shadow-md',
        isDragging && 'opacity-40',
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        onClick={e => e.stopPropagation()}
        className="flex items-center justify-center py-0.5 bg-white/40 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-3 h-3 text-slate-400" />
      </div>

      {/* Thumbnail */}
      <div className="aspect-video bg-white/50 flex items-center justify-center relative overflow-hidden">
        {file?.url && (
          file.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
          ) : (
            <video src={file.url} className="w-full h-full object-cover" />
          )
        )}
        {file?.type === 'video' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <Play className="w-4 h-4 text-white fill-white drop-shadow" />
          </div>
        )}
      </div>

      {/* Name + remove */}
      <div className="flex items-center justify-between px-1.5 py-1 gap-1">
        <p className="text-[9px] truncate text-slate-700 leading-tight">{file?.name ?? '알 수 없음'}</p>
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}

// ─── DragOverlayContent ────────────────────────────────────────────────────────

function DragOverlayMediaCard({ file }: { file: MediaFile }) {
  return (
    <div className="w-28 rounded-lg border border-[#90BEDE] shadow-xl bg-white overflow-hidden opacity-95 rotate-2">
      <div className="aspect-video bg-slate-100 flex items-center justify-center relative">
        {file.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
        ) : (
          <>
            <video src={file.url} className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
          </>
        )}
      </div>
      <p className="text-[9px] px-2 py-1 truncate text-slate-600">{file.name}</p>
    </div>
  )
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

function DateRangePicker({
  value,
  onChange,
}: {
  value?: DateRange
  onChange: (range?: DateRange) => void
}) {
  const [open, setOpen] = useState(false)

  const label =
    value?.from && value?.to
      ? `${format(value.from, 'yy.MM.dd')} ~ ${format(value.to, 'yy.MM.dd')}`
      : value?.from
        ? `${format(value.from, 'yy.MM.dd')} ~`
        : '기간 선택'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-left text-xs font-normal border-slate-200 h-8 gap-2"
        >
          <CalendarIcon className="w-3 h-3 text-slate-400" />
          <span className={cn(!value?.from && 'text-slate-400')}>{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
          classNames={{
            day_selected:
              'bg-[#90BEDE] text-white hover:bg-[#90BEDE] hover:text-white focus:bg-[#90BEDE] focus:text-white',
            day_range_middle:
              'aria-selected:bg-[#90BEDE]/20 aria-selected:text-slate-700',
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PromotionPage() {
  // ── Media ──────────────────────────────────────────────────────────────────
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadDragOver, setUploadDragOver] = useState(false)

  // ── Timeline ───────────────────────────────────────────────────────────────
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // ── DnD ───────────────────────────────────────────────────────────────────
  const [activeDrag, setActiveDrag] = useState<{ type: 'media'; file: MediaFile } | { type: 'timeline'; item: TimelineItem } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  // ── Timeline droppable ────────────────────────────────────────────────────
  const { setNodeRef: setTimelineRef, isOver: isTimelineOver } = useDroppable({
    id: 'timeline-droppable',
  })

  // ── Ticker ─────────────────────────────────────────────────────────────────
  const [ticker, setTicker] = useState('')

  // ── Targeting ──────────────────────────────────────────────────────────────
  const [targetingMode, setTargetingMode] = useState<'all' | 'group'>('all')
  const [selectedStations, setSelectedStations] = useState<Set<string>>(new Set())
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['A']))

  // ── File upload ────────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(f => {
      const isVideo = f.type.startsWith('video')
      const type: 'image' | 'video' = isVideo ? 'video' : 'image'
      const url = URL.createObjectURL(f)
      const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      if (isVideo) {
        const el = document.createElement('video')
        el.src = url
        el.onloadedmetadata = () => {
          setMediaFiles(prev => [
            ...prev,
            { id, name: f.name, type, url, durationSeconds: Math.round(el.duration) },
          ])
        }
        el.onerror = () => setMediaFiles(prev => [...prev, { id, name: f.name, type, url }])
      } else {
        setMediaFiles(prev => [...prev, { id, name: f.name, type, url }])
      }
    })
  }, [])

  const handleUploadZoneDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setUploadDragOver(false)
      addFiles(e.dataTransfer.files)
    },
    [addFiles],
  )

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current
    if (d?.type === 'media') setActiveDrag({ type: 'media', file: d.file as MediaFile })
    else if (d?.type === 'timeline-item') setActiveDrag({ type: 'timeline', item: d.item as TimelineItem })
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null)
    const { active, over } = e
    if (!over) return

    const activeType = active.data.current?.type

    // Media dropped onto timeline area (droppable zone or over an existing item)
    if (activeType === 'media') {
      const overIsTimeline =
        over.id === 'timeline-droppable' ||
        timelineItems.some(i => i.id === over.id)
      if (!overIsTimeline) return

      const file = active.data.current!.file as MediaFile
      const newItem: TimelineItem = {
        id: `tl-${Date.now()}`,
        fileId: file.id,
        displaySeconds:
          file.type === 'video' && file.durationSeconds ? file.durationSeconds : 10,
      }
      setTimelineItems(prev => [...prev, newItem])
      setSelectedItemId(newItem.id)
      return
    }

    // Timeline item reorder
    if (activeType === 'timeline-item' && active.id !== over.id) {
      const overIsItem = timelineItems.some(i => i.id === over.id)
      if (!overIsItem) return
      setTimelineItems(prev => {
        const oldIdx = prev.findIndex(i => i.id === active.id)
        const newIdx = prev.findIndex(i => i.id === over.id)
        if (oldIdx === -1 || newIdx === -1) return prev
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  // ── Timeline helpers ───────────────────────────────────────────────────────

  const selectedItem = timelineItems.find(i => i.id === selectedItemId)
  const selectedFile = selectedItem ? mediaFiles.find(f => f.id === selectedItem.fileId) : undefined
  const isVideoSelected = selectedFile?.type === 'video'

  const updateSelectedItem = (patch: Partial<TimelineItem>) => {
    if (!selectedItemId) return
    setTimelineItems(prev =>
      prev.map(i => (i.id === selectedItemId ? { ...i, ...patch } : i)),
    )
  }

  const removeTimelineItem = (id: string) => {
    setTimelineItems(prev => prev.filter(i => i.id !== id))
    if (selectedItemId === id) setSelectedItemId(null)
  }

  // ── Targeting helpers ──────────────────────────────────────────────────────

  const allStationIds = SAMPLE_GROUPS.flatMap(g => g.stations.map(s => s.stationId))

  const toggleStation = (id: string) =>
    setSelectedStations(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })

  const toggleGroup = (group: (typeof SAMPLE_GROUPS)[0]) => {
    const ids = group.stations.map(s => s.stationId)
    const allChecked = ids.every(id => selectedStations.has(id))
    setSelectedStations(prev => {
      const next = new Set(prev)
      if (allChecked) { ids.forEach(id => next.delete(id)) } else { ids.forEach(id => next.add(id)) }
      return next
    })
  }

  const toggleAll = () => {
    setSelectedStations(prev =>
      prev.size === allStationIds.length ? new Set() : new Set(allStationIds),
    )
  }

  const toggleGroupExpand = (groupId: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) { next.delete(groupId) } else { next.add(groupId) }
      return next
    })

  const handleReset = () => {
    setTimelineItems([])
    setSelectedItemId(null)
    setTicker('')
    setTargetingMode('all')
    setSelectedStations(new Set())
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">

        {/* ── Page header ── */}
        <div className="px-6 py-4 bg-white border-b border-slate-200 flex-shrink-0">
          <h1 className="text-base font-bold text-slate-800">프로모션 관리</h1>
          <p className="text-xs text-slate-500 mt-0.5">미디어를 업로드하고 시나리오를 구성하여 쉘터 화면에 송출합니다.</p>
        </div>

        {/* ── 3-column content ── */}
        <div className="flex-1 overflow-auto p-5">
          <div className="flex flex-col lg:flex-row gap-5 min-h-full">

            {/* ────── Left: 미디어 자산 ────── */}
            <div className="lg:w-60 flex-shrink-0">
              <Card className="rounded-xl shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-slate-800">미디어 자산</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 flex flex-col gap-3">

                  {/* Upload Zone */}
                  <div
                    className={cn(
                      'border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2',
                      'cursor-pointer transition-colors bg-[#E5E1EE]/40',
                      uploadDragOver
                        ? 'border-[#90BEDE] bg-[#90BEDE]/10'
                        : 'border-slate-300 hover:border-[#90BEDE] hover:bg-[#90BEDE]/5',
                    )}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setUploadDragOver(true) }}
                    onDragLeave={() => setUploadDragOver(false)}
                    onDrop={handleUploadZoneDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className={cn('w-7 h-7 transition-colors', uploadDragOver ? 'text-[#90BEDE]' : 'text-slate-400')} />
                    <p className="text-xs text-slate-600 text-center leading-snug">
                      파일을 드래그하거나<br />클릭하여 업로드
                    </p>
                    <p className="text-[10px] text-slate-400">JPG, PNG, MP4 지원</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,video/mp4,video/quicktime,video/webm"
                    multiple
                    className="hidden"
                    onChange={e => { addFiles(e.target.files); e.target.value = '' }}
                  />

                  {/* Thumbnail grid */}
                  {mediaFiles.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 max-h-[calc(100vh-360px)] overflow-y-auto pr-0.5">
                      {mediaFiles.map(file => (
                        <MediaDraggable key={file.id} file={file} />
                      ))}
                    </div>
                  )}

                  {mediaFiles.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center pb-1">
                      업로드한 파일이 여기 표시됩니다
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ────── Center: 시나리오 구성 ────── */}
            <div className="flex-1 min-w-0">
              <Card className="rounded-xl shadow-sm h-full">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold text-slate-800">시나리오 구성</CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 flex flex-col gap-5">

                  {/* Timeline */}
                  <div>
                    <Label className="text-xs text-slate-500 mb-2 block">타임라인</Label>
                    <div ref={setTimelineRef}>
                      <SortableContext
                        items={timelineItems.map(i => i.id)}
                        strategy={horizontalListSortingStrategy}
                      >
                        <TimelineDropZone
                          isEmpty={timelineItems.length === 0}
                          isOver={isTimelineOver && activeDrag?.type === 'media'}
                        >
                          {timelineItems.map((item, idx) => (
                            <SortableTimelineItem
                              key={item.id}
                              item={item}
                              file={mediaFiles.find(f => f.id === item.fileId)}
                              isSelected={selectedItemId === item.id}
                              colorClass={BLOCK_COLORS[idx % BLOCK_COLORS.length]}
                              onSelect={() =>
                                setSelectedItemId(prev => (prev === item.id ? null : item.id))
                              }
                              onRemove={() => removeTimelineItem(item.id)}
                            />
                          ))}
                        </TimelineDropZone>
                      </SortableContext>
                    </div>
                  </div>

                  {/* Options panel — animated slide-in when item selected */}
                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-300 ease-in-out',
                      selectedItem ? 'max-h-52 opacity-100' : 'max-h-0 opacity-0',
                    )}
                  >
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-4">
                      <p className="text-xs font-semibold text-slate-600 truncate">
                        블록 옵션: {selectedFile?.name ?? '선택된 항목'}
                      </p>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Display seconds */}
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs text-slate-500 flex items-center gap-1">
                            송출 시간 (초)
                            {isVideoSelected && <Lock className="w-3 h-3 text-slate-400" />}
                          </Label>
                          {isVideoSelected ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={selectedFile?.durationSeconds ?? 0}
                                disabled
                                className="h-8 text-xs bg-slate-100 text-center"
                              />
                              <span className="text-[10px] text-slate-400 whitespace-nowrap leading-tight">
                                영상 길이<br />자동 적용
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 flex-shrink-0 text-base"
                                onClick={() =>
                                  selectedItem &&
                                  updateSelectedItem({
                                    displaySeconds: Math.max(1, selectedItem.displaySeconds - 1),
                                  })
                                }
                              >
                                −
                              </Button>
                              <Input
                                type="number"
                                value={selectedItem?.displaySeconds ?? 10}
                                onChange={e =>
                                  updateSelectedItem({
                                    displaySeconds: Math.max(1, parseInt(e.target.value) || 1),
                                  })
                                }
                                className="h-8 text-xs text-center"
                                min={1}
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 flex-shrink-0 text-base"
                                onClick={() =>
                                  selectedItem &&
                                  updateSelectedItem({
                                    displaySeconds: selectedItem.displaySeconds + 1,
                                  })
                                }
                              >
                                +
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Date range */}
                        <div className="flex flex-col gap-1.5">
                          <Label className="text-xs text-slate-500">송출 기간</Label>
                          <DateRangePicker
                            value={selectedItem?.dateRange}
                            onChange={range => updateSelectedItem({ dateRange: range })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Ticker */}
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs text-slate-500">자막 (티커)</Label>
                    <Textarea
                      value={ticker}
                      onChange={e => setTicker(e.target.value)}
                      placeholder="화면 하단에 흘러갈 자막 내용을 입력하세요..."
                      className="text-sm resize-none h-16"
                    />
                    {/* Marquee preview */}
                    <div className="rounded-lg bg-slate-900 h-8 overflow-hidden flex items-center px-3">
                      {ticker ? (
                        <span className="text-white text-xs whitespace-nowrap animate-marquee">
                          {ticker}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs italic">자막 미리보기</span>
                      )}
                    </div>
                  </div>

                </CardContent>
              </Card>
            </div>

            {/* ────── Right: 타겟팅 ────── */}
            <div className="lg:w-68 flex-shrink-0" style={{ width: '17rem' }}>
              <Card className="rounded-xl shadow-sm h-full">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold text-slate-800">타겟팅</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <RadioGroup
                    value={targetingMode}
                    onValueChange={v => setTargetingMode(v as 'all' | 'group')}
                    className="flex flex-col gap-3"
                  >
                    {/* 전체 송출 */}
                    <label
                      className={cn(
                        'flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                        targetingMode === 'all'
                          ? 'border-l-[3px] border-[#90BEDE] bg-[#90BEDE]/5'
                          : 'border-slate-200 hover:border-slate-300',
                      )}
                    >
                      <RadioGroupItem value="all" id="target-all" className="mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800 leading-tight">전체 송출</p>
                        <p className="text-xs text-slate-500 mt-0.5">모든 쉘터에 동일하게 적용됩니다</p>
                      </div>
                    </label>

                    {/* 그룹/개별 송출 */}
                    <div
                      className={cn(
                        'rounded-lg border-2 transition-all overflow-hidden',
                        targetingMode === 'group'
                          ? 'border-l-[3px] border-[#90BEDE]'
                          : 'border-slate-200',
                      )}
                    >
                      <label className="flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors">
                        <RadioGroupItem value="group" id="target-group" className="mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-slate-800 leading-tight">그룹 / 개별 송출</p>
                          <p className="text-xs text-slate-500 mt-0.5">특정 그룹 또는 쉘터를 선택합니다</p>
                        </div>
                      </label>

                      {/* Tree — slide in when group mode selected */}
                      <div
                        className={cn(
                          'overflow-hidden transition-all duration-300 ease-in-out',
                          targetingMode === 'group' ? 'max-h-96' : 'max-h-0',
                        )}
                      >
                        <div className="px-3 pb-3 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-xs border-[#E5E1EE] hover:bg-[#E5E1EE]/50"
                            onClick={toggleAll}
                          >
                            {selectedStations.size === allStationIds.length ? '전체 해제' : '전체 선택'}
                          </Button>

                          {SAMPLE_GROUPS.map(group => {
                            const ids = group.stations.map(s => s.stationId)
                            const allChecked = ids.every(id => selectedStations.has(id))
                            const someChecked = ids.some(id => selectedStations.has(id))
                            const isExpanded = expandedGroups.has(group.groupId)

                            return (
                              <div key={group.groupId}>
                                <div
                                  className="flex items-center gap-1.5 py-1 px-1 rounded cursor-pointer hover:bg-slate-50 transition-colors"
                                  onClick={() => toggleGroupExpand(group.groupId)}
                                >
                                  {isExpanded
                                    ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  }
                                  <Checkbox
                                    checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                                    onCheckedChange={() => toggleGroup(group)}
                                    onClick={e => e.stopPropagation()}
                                    className="h-3.5 w-3.5 flex-shrink-0"
                                  />
                                  <span className="text-xs font-medium text-slate-700">{group.groupNm}</span>
                                </div>

                                {isExpanded && (
                                  <div className="ml-6 flex flex-col gap-0.5">
                                    {group.stations.map(station => (
                                      <div
                                        key={station.stationId}
                                        className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-slate-50 transition-colors"
                                        onClick={() => toggleStation(station.stationId)}
                                      >
                                        <Checkbox
                                          checked={selectedStations.has(station.stationId)}
                                          onCheckedChange={() => toggleStation(station.stationId)}
                                          onClick={e => e.stopPropagation()}
                                          className="h-3.5 w-3.5 flex-shrink-0"
                                        />
                                        <span className="text-xs text-slate-600">{station.stationNm}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>

        {/* ── Sticky footer ── */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-6 py-3 flex items-center justify-between shadow-[0_-1px_4px_rgba(0,0,0,0.04)]">
          <Badge
            variant="secondary"
            className="text-xs bg-[#E5E1EE] text-slate-700 font-medium"
          >
            총 {timelineItems.length}개 항목
          </Badge>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-[#E5E1EE] text-slate-600 hover:bg-[#E5E1EE]/40"
              onClick={handleReset}
            >
              초기화
            </Button>
            <Button
              size="sm"
              className="text-white font-semibold hover:opacity-90"
              style={{ background: '#90BEDE' }}
            >
              저장 및 송출
            </Button>
          </div>
        </div>

      </main>

      {/* DragOverlay */}
      <DragOverlay dropAnimation={null}>
        {activeDrag?.type === 'media' ? (
          <DragOverlayMediaCard file={activeDrag.file} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
