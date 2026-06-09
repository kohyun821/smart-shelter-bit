'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sun, Cloud, CloudRain, CloudSnow, MapPin, Calendar, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogPanel } from '@/components/log-panel'

// ─── Theme tokens (light / dark) ──────────────────────────────────────────────
const LIGHT = {
  isDark:       false,
  bg:           '#F0F2F5',
  card:         '#FFFFFF',
  text:         '#212529',
  muted:        '#6c757d',
  border:       'rgba(0,0,0,0.08)',
  primary:      '#1a56db',
  point:        '#DC3545',
  headerBg:     '#FFFFFF',
  soonBg:       '#FFF8F8',
  soonBorder:   '#FFD6D6',
  soonDivider:  '#FFBBBB',
  soonEmpty:    '#FFAAAA',
  rowLeftBg:    '#F9FAFB',
  footerBar:    '#1F2937',
  footerScroll: '#374151',
  footerText:   '#FFFFFF',
  noNext:       '#D1D5DB',
  weatherColor: '#D97706',
  lastBusBg:    '#FFF7ED',
  lastBusText:  '#C2410C',
  lastBusBorder:'#FED7AA',
  urgentColor:  '#D97706',
  nightCardBg:  '#EFF6FF',
  nightBorder:  '#BFDBFE',
  nightLeftBg:  'rgba(191,219,254,0.35)',
  nightBadgeBg: 'rgba(191,219,254,0.6)',
  nightBadgeText:'#1D4ED8',
  nightShadow:  '0 1px 4px rgba(59,130,246,0.08)',
  cardShadow:   '0 1px 4px rgba(0,0,0,0.05)',
}

const DARK = {
  isDark:       true,
  bg:           '#0F1117',
  card:         '#181D2A',
  text:         '#E8EDF8',
  muted:        '#8B9CC8',
  border:       'rgba(255,255,255,0.07)',
  primary:      '#4B7BF5',
  point:        '#F25C54',
  headerBg:     '#0A0E1F',
  soonBg:       '#1A0E0E',
  soonBorder:   '#3D1515',
  soonDivider:  '#3D1515',
  soonEmpty:    '#5A3030',
  rowLeftBg:    '#141828',
  footerBar:    '#080D18',
  footerScroll: '#101520',
  footerText:   '#6B7FA8',
  noNext:       '#2D3A5A',
  weatherColor: '#FFCA28',
  lastBusBg:    '#2D1A0A',
  lastBusText:  '#FB923C',
  lastBusBorder:'#7C3B0A',
  urgentColor:  '#F59E0B',
  nightCardBg:  '#0F1A2E',
  nightBorder:  '#1E3A5A',
  nightLeftBg:  'rgba(30,58,90,0.5)',
  nightBadgeBg: 'rgba(30,58,90,0.7)',
  nightBadgeText:'#60A5FA',
  nightShadow:  '0 1px 4px rgba(0,60,120,0.15)',
  cardShadow:   '0 1px 4px rgba(0,0,0,0.3)',
}

type Theme = typeof LIGHT

// 렌더 사이클마다 갱신되는 현재 테마 참조
let _theme: Theme = LIGHT
const T = () => _theme

// ─── Types ────────────────────────────────────────────────────────────────────
interface WeatherData {
  temp: number | null
  minTemp: number | null
  maxTemp: number | null
  sky: number | null
  pty: number
}

interface PromoBlock {
  sortOrder: number
  displaySec: number
  fileType: 'image' | 'video'
  mediaUrl: string
  broadcastStart: string | null
  broadcastEnd: string | null
}

interface PromoScenario {
  scenarioId: string
  scenarioNm: string
  tickerText: string | null
  blocks: PromoBlock[]
}

interface BusArrival {
  id: string
  routeNo: string
  routeType: string
  arrivalSec: number
  restStopCount: number
  isLowFloor: boolean
  isLastBus: boolean
  currentStop: number
  totalStops: number
  latestStopName?: string
}

interface GroupedRoute {
  routeNo: string
  routeType: string
  arrivals: BusArrival[]
}

const BRIDGE_URL = 'http://localhost:4000'

// ─── Utilities ────────────────────────────────────────────────────────────────
function pad2(n: number) { return String(n).padStart(2, '0') }

function toSinoKorean(numStr: string): string {
  const n = parseInt(numStr, 10)
  if (isNaN(n) || n <= 0) return numStr
  const d = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const h = Math.floor(n / 100)
  const t = Math.floor((n % 100) / 10)
  const o = n % 10
  let r = ''
  if (h === 1) r += '백'
  else if (h > 1) r += d[h] + '백'
  if (t === 1) r += '십'
  else if (t > 1) r += d[t] + '십'
  if (o > 0) r += d[o]
  return r + numStr.replace(/^\d+/, '')
}

function isSoonArriving(a: BusArrival) {
  return a.arrivalSec <= 239 || a.restStopCount <= 2
}

function isBlockActive(block: PromoBlock): boolean {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  if (block.broadcastStart && today < block.broadcastStart) return false
  if (block.broadcastEnd && today > block.broadcastEnd) return false
  return true
}

function groupByRoute(arrivals: BusArrival[]): GroupedRoute[] {
  const map = new Map<string, GroupedRoute>()
  for (const a of arrivals) {
    if (!map.has(a.routeNo)) map.set(a.routeNo, { routeNo: a.routeNo, routeType: a.routeType, arrivals: [] })
    const g = map.get(a.routeNo)!
    if (g.arrivals.length < 2) g.arrivals.push(a)
  }
  return Array.from(map.values())
}

function getRouteStyle(routeType: string) {
  if (routeType === '0') return { bg: '#1B6840', text: '#fff' }
  if (routeType === '1') return { bg: '#1E3A8A', text: '#fff' }
  if (routeType === '6') return { bg: '#92400E', text: '#fff' }
  if (routeType === '9') return { bg: '#166534', text: '#fff' }
  return { bg: '#374151', text: '#fff' }
}

// ─── 날씨 아이콘 ──────────────────────────────────────────────────────────────
function WeatherIcon({ sky, pty, size = 16 }: { sky: number | null; pty: number; size?: number }) {
  const p = { size, strokeWidth: 2, className: 'shrink-0' } as const
  if (pty > 0) return pty === 3 ? <CloudSnow {...p} /> : <CloudRain {...p} />
  if (sky === 3 || sky === 4) return <Cloud {...p} />
  return <Sun {...p} />
}

// ─── Header ───────────────────────────────────────────────────────────────────
function BitHeader({ now, stopName, shortBstopId, weather }: {
  now: Date; stopName: string | null; shortBstopId: string | null; weather: WeatherData | null
}) {
  const th = T()
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']
  const dateStr = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())} (${DAYS[now.getDay()]})`
  const h = pad2(now.getHours())
  const m = pad2(now.getMinutes())

  return (
    <header
      className="shrink-0 w-full px-8 py-4 grid items-center gap-4"
      style={{
        background: th.headerBg,
        borderBottom: `1px solid ${th.border}`,
        gridTemplateColumns: '1fr 1fr 1fr',
      }}
    >
      {/* 왼쪽: 강화군 로고 */}
      <div className="flex items-center gap-3">
        <div
          className="shrink-0 rounded-2xl p-1 shadow-md flex items-center justify-center"
          style={{ background: '#fff', border: '1px solid #E5E7EB' }}
        >
          <img
            src="/symbol.jpg"
            alt="강화군"
            className="rounded-xl object-contain"
            style={{ height: '3.8rem', width: 'auto' }}
          />
        </div>
      </div>

      {/* 가운데: 정류소명 */}
      <div className="flex flex-col items-center justify-center text-center gap-1">
        {shortBstopId && (
          <span className="text-xs font-bold tracking-widest" style={{ color: th.muted }}>
            [{shortBstopId}]
          </span>
        )}
        <h1 className="font-black leading-tight" style={{ fontSize: '2.2rem', color: th.text }}>
          {stopName ?? '—'}
        </h1>
        <div className="flex items-center gap-1.5" style={{ color: th.muted }}>
          <MapPin size={13} className="shrink-0" />
          <span className="text-xs font-medium">강화군 버스정보안내</span>
        </div>
      </div>

      {/* 오른쪽: 날씨 + 날짜 + 시간 */}
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-2">
          <span style={{ color: th.weatherColor }}>
            <WeatherIcon sky={weather?.sky ?? null} pty={weather?.pty ?? 0} size={20} />
          </span>
          <span className="font-bold tabular-nums" style={{ fontSize: '1.2rem', color: th.text }}>
            {weather?.temp != null ? `${Math.round(weather.temp)}°C` : '—'}
          </span>
          <span className="text-xs font-medium" style={{ color: th.muted }}>
            {weather?.minTemp != null && weather?.maxTemp != null
              ? `${Math.round(weather.minTemp)}° ~ ${Math.round(weather.maxTemp)}°`
              : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5" style={{ color: th.muted }}>
          <Calendar size={13} />
          <span className="text-sm font-medium">{dateStr}</span>
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="font-black tabular-nums tracking-tight" style={{ fontSize: '2.6rem', lineHeight: 1, color: th.text }}>
            {h}:{m}
          </span>
        </div>
      </div>
    </header>
  )
}

// ─── Soon Arriving ────────────────────────────────────────────────────────────
function SoonArriving({ arrivals }: { arrivals: BusArrival[] }) {
  const th = T()
  const soon = arrivals.filter(isSoonArriving)

  return (
    <section
      className="shrink-0 flex items-center gap-4 px-8 border-b"
      style={{ background: th.soonBg, borderColor: th.soonBorder, height: '7vh', minHeight: '3.5rem' }}
    >
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="relative flex h-4 w-4">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: th.point }}
          />
          <span className="relative inline-flex rounded-full h-4 w-4" style={{ background: th.point }} />
        </span>
        <span className="font-black tracking-wide whitespace-nowrap" style={{ color: th.point, fontSize: '1.05rem' }}>
          잠시 후 도착
        </span>
      </div>

      <div className="w-px self-stretch my-2" style={{ background: th.soonDivider }} />

      <div className="flex items-center gap-2 flex-wrap">
        {soon.length > 0 ? (
          soon.map(a => {
            const displayNo = a.routeNo.replace(/\s*\(.*?\)\s*/g, '')
            const style = getRouteStyle(a.routeType)
            return (
              <span
                key={a.id}
                className="inline-flex items-center px-4 py-1 rounded-full font-black border"
                style={th.isDark ? {
                  background: style.bg,
                  borderColor: style.bg,
                  color: '#ffffff',
                  fontSize: '1.1rem',
                } : {
                  background: `${style.bg}28`,
                  borderColor: style.bg,
                  color: style.bg,
                  fontSize: '1.1rem',
                }}
              >
                {displayNo}
              </span>
            )
          })
        ) : (
          <span className="font-medium" style={{ color: th.soonEmpty, fontSize: '0.95rem' }}>
            3분 이내 도착 예정 버스 없음
          </span>
        )}
      </div>
    </section>
  )
}

// ─── Column Labels ────────────────────────────────────────────────────────────
function ColumnLabels() {
  const th = T()
  return (
    <div className="shrink-0 px-8 pt-5 pb-2 flex items-center" style={{ background: th.bg }}>
      <div style={{ minWidth: '140px' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: th.muted }}>노선</span>
      </div>
      <div className="flex-1 flex">
        <div className="flex-1 text-center text-xs font-bold uppercase tracking-widest" style={{ color: th.muted }}>
          다음 버스
        </div>
        <div className="flex-1 text-center text-xs font-bold uppercase tracking-widest" style={{ color: th.muted }}>
          그 다음 버스
        </div>
      </div>
      <div style={{ width: '52px' }} />
    </div>
  )
}

// ─── Arrival Card ─────────────────────────────────────────────────────────────
function ArrivalCard({ arrival, isPrimary }: { arrival: BusArrival; isPrimary: boolean }) {
  const th = T()
  const sec = arrival.arrivalSec
  const mins = Math.floor(sec / 60)
  const secs = sec % 60
  const isImmediate = sec < 60
  const isUrgent = sec < 600

  const mainColor = isImmediate ? th.point : isUrgent ? th.urgentColor : th.text
  const subColor = isImmediate ? th.point : isUrgent ? th.urgentColor : th.muted

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', isPrimary ? 'min-w-[200px]' : 'min-w-[160px]')}>
      {isImmediate ? (
        <span className="font-black animate-pulse tracking-tight"
          style={{ fontSize: isPrimary ? '2.6rem' : '1.7rem', color: th.point, lineHeight: 1 }}
        >
          곧 도착
        </span>
      ) : (
        <div className={cn('flex items-baseline gap-0.5', !isPrimary && 'opacity-75')}>
          <span className="font-extrabold tabular-nums"
            style={{ fontSize: isPrimary ? '3rem' : '1.9rem', lineHeight: 1, color: mainColor }}
          >
            {mins}
          </span>
          <span className="font-semibold" style={{ fontSize: isPrimary ? '1.1rem' : '0.85rem', color: subColor }}>분</span>
          <span className="font-bold tabular-nums ml-0.5"
            style={{ fontSize: isPrimary ? '1.7rem' : '1.1rem', lineHeight: 1, color: subColor }}
          >
            {pad2(secs)}
          </span>
          <span className="font-semibold" style={{ fontSize: isPrimary ? '1.1rem' : '0.85rem', color: subColor }}>초</span>
        </div>
      )}

      {arrival.isLastBus && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: th.lastBusBg, color: th.lastBusText, border: `1px solid ${th.lastBusBorder}` }}
        >막차</span>
      )}

      <div className="flex items-center gap-2 flex-wrap justify-center">
        {arrival.restStopCount > 0 && !isImmediate && (
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: isPrimary ? '1rem' : '0.8rem', color: th.muted }}
          >
            {arrival.restStopCount}정류소 전
          </span>
        )}
        {arrival.latestStopName && (
          <div className="flex items-center gap-1 text-xs" style={{ color: th.muted }}>
            <MapPin size={10} />
            <span className="truncate max-w-[120px]">{arrival.latestStopName}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bus Row ──────────────────────────────────────────────────────────────────
function BusRow({ group }: { group: GroupedRoute }) {
  const th = T()
  const { routeNo, routeType, arrivals } = group
  const displayNo = routeNo.replace(/\s*\(.*?\)\s*/g, '')
  const style = getRouteStyle(routeType)
  const isNight = displayNo.startsWith('N') || displayNo.startsWith('n')

  return (
    <div
      className="flex items-center rounded-2xl overflow-hidden border transition-all duration-200"
      style={{
        background: isNight ? th.nightCardBg : th.card,
        borderColor: isNight ? th.nightBorder : th.border,
        boxShadow: isNight ? th.nightShadow : th.cardShadow,
      }}
    >
      {/* 왼쪽: 노선번호 */}
      <div
        className="flex flex-col items-center justify-center gap-2 py-5 px-5 self-stretch border-r"
        style={{
          minWidth: '140px',
          background: isNight ? th.nightLeftBg : th.rowLeftBg,
          borderColor: isNight ? th.nightBorder : th.border,
        }}
      >
        <div className="flex items-center justify-center rounded-xl px-3 py-1.5" style={{ background: style.bg }}>
          <span className="font-black tracking-tight"
            style={{ fontSize: '1.6rem', lineHeight: 1.2, color: style.text }}
          >
            {displayNo}
          </span>
        </div>
        {isNight && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: th.nightBadgeBg, color: th.nightBadgeText }}
          >심야</span>
        )}
      </div>

      {/* 도착 정보 2칸 */}
      <div className="flex items-center flex-1">
        <div className="flex-1 flex items-center justify-center py-4 px-4 border-r" style={{ borderColor: th.border }}>
          {arrivals[0]
            ? <ArrivalCard arrival={arrivals[0]} isPrimary={true} />
            : <span className="text-sm" style={{ color: th.muted }}>정보 없음</span>
          }
        </div>
        <div className="flex-1 flex items-center justify-center py-4 px-4 opacity-80">
          {arrivals[1]
            ? <ArrivalCard arrival={arrivals[1]} isPrimary={false} />
            : <span className="text-sm" style={{ color: th.noNext }}>다음 버스 정보 없음</span>
          }
        </div>
      </div>

    </div>
  )
}

// ─── Main List ────────────────────────────────────────────────────────────────
function MainList({ arrivals, serviceEnded }: { arrivals: BusArrival[]; serviceEnded: boolean }) {
  const th = T()
  const [page, setPage] = useState(0)
  const itemsPerPage = 4
  const groups = groupByRoute(arrivals)

  useEffect(() => {
    if (groups.length <= itemsPerPage) { setPage(0); return }
    const t = setInterval(() => {
      setPage(p => (p + 1) % Math.ceil(groups.length / itemsPerPage))
    }, 10000)
    return () => clearInterval(t)
  }, [groups.length])

  if (serviceEnded) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center gap-4 py-10" style={{ background: th.bg }}>
        <div className="rounded-3xl flex flex-col items-center justify-center gap-3 px-12 py-10 border shadow-sm"
          style={{ background: th.card, borderColor: th.border }}
        >
          <span style={{ fontSize: '3rem', lineHeight: 1 }}>🌙</span>
          <span className="font-black tracking-tight" style={{ fontSize: '2.25rem', color: th.text }}>운행 종료</span>
          <span className="font-medium text-base" style={{ color: th.muted }}>금일 버스 운행이 모두 종료되었습니다</span>
        </div>
      </section>
    )
  }

  const totalPages = Math.ceil(groups.length / itemsPerPage)
  const visible = groups.slice(page * itemsPerPage, (page + 1) * itemsPerPage)

  return (
    <section className="flex-1 px-8 py-3 flex flex-col gap-3 relative overflow-hidden" style={{ background: th.bg }}>
      {totalPages > 1 && (
        <div className="absolute top-2 right-10 flex gap-1.5 z-10">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full transition-colors"
              style={{ background: i === page ? th.primary : th.noNext }}
            />
          ))}
        </div>
      )}

      {visible.map(g => <BusRow key={g.routeNo} group={g} />)}

    </section>
  )
}

// ─── Promo Area ───────────────────────────────────────────────────────────────
const PROMO_SLIDES = [
  { text: '강화도 고인돌 — 유네스코 세계문화유산', gradient: 'linear-gradient(135deg, #1E3A5F 0%, #2B5276 100%)' },
  { text: '2026 강화 딸기 축제 · 4.18 ~ 4.20', gradient: 'linear-gradient(135deg, #7C1D1D 0%, #991B1B 100%)' },
  { text: '강화 역사관  매일 09:00 ~ 18:00', gradient: 'linear-gradient(135deg, #064E3B 0%, #065F46 100%)' },
]

function PromoArea({ scenario }: { scenario: PromoScenario | null }) {
  const th = T()
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  const activeBlocks = scenario
    ? scenario.blocks.filter(isBlockActive).sort((a, b) => a.sortOrder - b.sortOrder)
    : []
  const useScenario = activeBlocks.length > 0
  const total = useScenario ? activeBlocks.length : PROMO_SLIDES.length

  useEffect(() => { setIdx(0); setVisible(true) }, [scenario?.scenarioId])

  const advance = useCallback(() => {
    setVisible(false)
    setTimeout(() => { setIdx(i => (i + 1) % total); setVisible(true) }, 400)
  }, [total])

  useEffect(() => {
    const ms = useScenario ? (activeBlocks[idx % activeBlocks.length]?.displaySec ?? 5) * 1000 : 5000
    const t = setTimeout(advance, ms)
    return () => clearTimeout(t)
  }, [idx, advance, useScenario])

  if (useScenario) {
    const block = activeBlocks[idx % activeBlocks.length]
    return (
      <section className="shrink-0 mx-8 mb-3 rounded-2xl overflow-hidden border shadow-sm"
        style={{ background: '#000', height: '28vh', borderColor: th.border }}
      >
        <div className="w-full h-full transition-opacity duration-[400ms]" style={{ opacity: visible ? 1 : 0 }}>
          {block.fileType === 'video'
            ? <video key={block.mediaUrl} src={block.mediaUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
            : <img key={block.mediaUrl} src={block.mediaUrl} alt="" className="w-full h-full object-cover" />
          }
        </div>
      </section>
    )
  }

  const slide = PROMO_SLIDES[idx % PROMO_SLIDES.length]
  return (
    <section className="shrink-0 mx-8 mb-3 rounded-2xl overflow-hidden flex items-center justify-center border shadow-sm"
      style={{ borderColor: th.border, height: '28vh' }}
    >
      <div className="w-full h-full flex items-center justify-center px-10 transition-opacity duration-[400ms]"
        style={{ background: slide.gradient, opacity: visible ? 1 : 0 }}
      >
        <p className="text-white font-black text-center break-keep drop-shadow-md"
          style={{ fontSize: 'clamp(1.8rem, 4.5vh, 3.5rem)' }}
        >
          {slide.text}
        </p>
      </div>
    </section>
  )
}

// ─── Footer Ticker ────────────────────────────────────────────────────────────
const NOTICES = [
  '버스 도착 정보는 실제와 다를 수 있습니다.',
  '버스 내에서는 뛰지 마시고 안전하게 이용해 주세요.',
  '노약자석은 노인·임산부·장애인을 위한 자리입니다.',
  '버스를 기다리실 때는 차도에서 한 걸음 물러서 주세요.',
  '기상 악화 시 버스 운행 지연이 발생할 수 있습니다.',
]

function FooterTicker({ tickerText }: { tickerText: string | null }) {
  const th = T()
  const messages = tickerText ? [tickerText] : NOTICES
  const fullText = messages.join('     ·     ')

  return (
    <footer className="shrink-0 mx-8 mb-4 flex items-stretch rounded-2xl overflow-hidden border shadow-sm"
      style={{ borderColor: th.border, minHeight: '6vh' }}
    >
      <div className="flex items-center gap-2 px-5 shrink-0" style={{ background: th.footerBar, minWidth: '130px' }}>
        <Info size={16} className="text-yellow-300 shrink-0" />
        <span className="text-sm font-bold whitespace-nowrap" style={{ color: th.footerText }}>운행 정보</span>
      </div>
      <div className="flex-1 overflow-hidden flex items-center" style={{ background: th.footerScroll }}>
        <div className="marquee-ticker whitespace-nowrap font-medium" style={{ fontSize: '0.95rem', color: th.footerText }}>
          <span>{fullText}&emsp;&emsp;&emsp;&emsp;</span>
          <span>{fullText}&emsp;&emsp;&emsp;&emsp;</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [isDark, setIsDark] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [arrivals, setArrivals] = useState<BusArrival[]>([])
  const [serviceEnded, setServiceEnded] = useState(false)
  const [stopName, setStopName] = useState<string | null>(null)
  const [shortBstopId, setShortBstopId] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [promoScenario, setPromoScenario] = useState<PromoScenario | null>(null)
  const [tickerText, setTickerText] = useState<string | null>(null)
  const [winSize, setWinSize] = useState<{ w: number; h: number } | null>(null)
  const [showDebugOverlay, setShowDebugOverlay] = useState(false)

  // 테마 동기화 — 렌더 전에 전역 참조 갱신
  _theme = isDark ? DARK : LIGHT

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const update = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // D 키로 다크모드 토글
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setIsDark(v => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    fetch(`${BRIDGE_URL}/api/settings`)
      .then(r => r.json())
      .then(json => { if (json.showDebugOverlay) setShowDebugOverlay(true) })
      .catch(() => { })
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async (attempt: number) => {
      if (cancelled || attempt > 10) return
      try {
        const r = await fetch(`${BRIDGE_URL}/api/bus/stop-name`)
        const json = await r.json()
        if (cancelled) return
        if (json.data?.bstopNm) setStopName(json.data.bstopNm)
        if (json.data?.shortBstopId) setShortBstopId(json.data.shortBstopId)
        if (json.data?.bstopNm && json.data?.shortBstopId) return
      } catch { /* noop */ }
      if (!cancelled) window.setTimeout(() => void load(attempt + 1), 2000)
    }
    void load(0)
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    const tryLoad = async () => {
      try {
        const r = await fetch(`${BRIDGE_URL}/api/weather`)
        const json = await r.json()
        if (cancelled) return
        if (json.data) {
          setWeather(json.data)
          pollTimer = setInterval(async () => {
            try {
              const r2 = await fetch(`${BRIDGE_URL}/api/weather`)
              const j2 = await r2.json()
              if (!cancelled && j2.data) setWeather(j2.data)
            } catch { /* noop */ }
          }, 10 * 60 * 1000)
          return
        }
      } catch { /* noop */ }
      if (!cancelled) retryTimer = setTimeout(tryLoad, 3000)
    }
    void tryLoad()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [])

  useEffect(() => {
    const soonRoutes = arrivals
      .filter(isSoonArriving)
      .map(a => toSinoKorean(a.routeNo.replace(/\(.*?\)/g, '').trim()))
    if (soonRoutes.length === 0) return
    const routeText = soonRoutes.length === 1
      ? `${soonRoutes[0]}번`
      : `${soonRoutes.slice(0, -1).join('번, ')}번, ${soonRoutes.at(-1)}번`
    const text = `잠시 후 도착 버스는 ${routeText} 입니다.`
    const audio = new Audio(`${BRIDGE_URL}/api/tts/speak?${new URLSearchParams({ text })}`)
    audio.play().catch(() => { })
  }, [arrivals])

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    function connect() {
      es = new EventSource(`${BRIDGE_URL}/api/promo/stream`)
      es.addEventListener('promo', (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'scenario') { setPromoScenario(msg.data); setTickerText(msg.data.tickerText ?? null) }
          else if (msg.type === 'stop') { setPromoScenario(null); setTickerText(null) }
        } catch { /* noop */ }
      })
      es.onerror = () => { es?.close(); es = null; retryTimer = setTimeout(connect, 3000) }
    }
    connect()
    return () => { if (retryTimer) clearTimeout(retryTimer); es?.close() }
  }, [])

  useEffect(() => {
    const es = new EventSource(`${BRIDGE_URL}/api/bus/arrivals/stream`)
    es.addEventListener('arrivals', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (Array.isArray(data.arrivals)) {
          setArrivals(data.arrivals)
          setServiceEnded(data.serviceEnded ?? false)
        }
      } catch { /* noop */ }
    })
    return () => es.close()
  }, [])

  const th = T()

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: th.bg }}>
      <BitHeader now={now} stopName={stopName} shortBstopId={shortBstopId} weather={weather} />
      <SoonArriving arrivals={arrivals} />
      <ColumnLabels />
      <MainList arrivals={arrivals} serviceEnded={serviceEnded} />
      <PromoArea scenario={promoScenario} />
      <FooterTicker tickerText={tickerText} />
      <LogPanel />
      {showDebugOverlay && winSize && (
        <div className="fixed bottom-2 left-2 z-[9999] bg-black/70 text-white text-sm font-mono px-3 py-1.5 rounded-lg pointer-events-none">
          {winSize.w} × {winSize.h} px
        </div>
      )}
      {/* 다크모드 상태 표시 (개발용) */}
      <div
        className="fixed bottom-2 right-2 z-[9999] text-xs font-mono px-3 py-1.5 rounded-lg pointer-events-none"
        style={{ background: th.card, color: th.muted, border: `1px solid ${th.border}` }}
      >
        {isDark ? '🌙 Dark' : '☀️ Light'} · D키 전환
      </div>
    </div>
  )
}
