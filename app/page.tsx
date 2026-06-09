'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sun, Cloud, CloudRain, CloudSnow, Bus, Wifi, MapPin, Calendar, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogPanel } from '@/components/log-panel'

// ─── Figma Design Tokens ──────────────────────────────────────────────────────
const FG_BG = '#F0F2F5'
const FG_CARD = '#FFFFFF'
const FG_TEXT = '#212529'
const FG_MUTED = '#6c757d'
const FG_BORDER = 'rgba(0,0,0,0.08)'
const FG_PRIMARY = '#1a56db'
const FG_POINT = '#DC3545'

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

function getRouteTypeName(routeType: string) {
  switch (routeType) {
    case '0': return '일반'
    case '1': return '지선'
    case '6': return '마을버스'
    case '9': return '순환'
    default: return '일반'
  }
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
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']
  const dateStr = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())} (${DAYS[now.getDay()]})`
  const h = pad2(now.getHours())
  const m = pad2(now.getMinutes())
  const s = pad2(now.getSeconds())

  return (
    <header
      className="shrink-0 w-full px-8 py-4 grid items-center gap-4"
      style={{
        background: FG_CARD,
        borderBottom: `1px solid ${FG_BORDER}`,
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
        <div>
          {/* <p className="text-xs font-bold tracking-widest uppercase" style={{ color: FG_PRIMARY }}>
            Bus Information Terminal
          </p> */}
          {/* <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl border mt-1"
            style={{ background: '#F0FDF4', borderColor: '#BBF7D0', width: 'fit-content' }}
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <Wifi size={12} className="text-green-600" />
            <span className="text-xs font-semibold text-green-700">실시간 연결됨</span>
          </div> */}
        </div>
      </div>

      {/* 가운데: 정류소명 */}
      <div className="flex flex-col items-center justify-center text-center gap-1">
        {shortBstopId && (
          <span className="text-xs font-bold tracking-widest" style={{ color: FG_MUTED }}>
            [{shortBstopId}]
          </span>
        )}
        <h1 className="font-black leading-tight" style={{ fontSize: '2.2rem', color: FG_TEXT }}>
          {stopName ?? '—'}
        </h1>
        <div className="flex items-center gap-1.5" style={{ color: FG_MUTED }}>
          <MapPin size={13} className="shrink-0" />
          <span className="text-xs font-medium">강화군 버스정보안내</span>
        </div>
      </div>

      {/* 오른쪽: 날씨 + 날짜 + 시간 */}
      <div className="flex flex-col items-end gap-1.5">
        {/* 날씨 */}
        <div className="flex items-center gap-2">
          <span style={{ color: '#D97706' }}>
            <WeatherIcon sky={weather?.sky ?? null} pty={weather?.pty ?? 0} size={20} />
          </span>
          <span className="font-bold tabular-nums" style={{ fontSize: '1.2rem', color: FG_TEXT }}>
            {weather?.temp != null ? `${Math.round(weather.temp)}°C` : '—'}
          </span>
          <span className="text-xs font-medium" style={{ color: FG_MUTED }}>
            {weather?.minTemp != null && weather?.maxTemp != null
              ? `${Math.round(weather.minTemp)}° ~ ${Math.round(weather.maxTemp)}°`
              : ''}
          </span>
        </div>
        {/* 날짜 */}
        <div className="flex items-center gap-1.5" style={{ color: FG_MUTED }}>
          <Calendar size={13} />
          <span className="text-sm font-medium">{dateStr}</span>
        </div>
        {/* 시간 */}
        <div className="flex items-baseline gap-0.5">
          <span className="font-black tabular-nums tracking-tight" style={{ fontSize: '2.6rem', lineHeight: 1, color: FG_TEXT }}>
            {h}:{m}
          </span>
        </div>
      </div>
    </header>
  )
}

// ─── Soon Arriving ────────────────────────────────────────────────────────────
function SoonArriving({ arrivals }: { arrivals: BusArrival[] }) {
  const soon = arrivals.filter(isSoonArriving)

  return (
    <section
      className="shrink-0 flex items-center gap-4 px-8 border-b"
      style={{ background: '#FFF8F8', borderColor: '#FFD6D6', height: '7vh', minHeight: '3.5rem' }}
    >
      {/* 라이브 인디케이터 + 라벨 */}
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="relative flex h-4 w-4">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: FG_POINT }}
          />
          <span className="relative inline-flex rounded-full h-4 w-4" style={{ background: FG_POINT }} />
        </span>
        <span className="font-black tracking-wide whitespace-nowrap" style={{ color: FG_POINT, fontSize: '1.05rem' }}>
          잠시 후 도착
        </span>
      </div>

      {/* 구분선 */}
      <div className="w-px self-stretch my-2" style={{ background: '#FFBBBB' }} />

      {/* 노선 칩 목록 */}
      <div className="flex items-center gap-2 flex-wrap">
        {soon.length > 0 ? (
          soon.map(a => {
            const displayNo = a.routeNo.replace(/\s*\(.*?\)\s*/g, '')
            const style = getRouteStyle(a.routeType)
            return (
              <span
                key={a.id}
                className="inline-flex items-center px-4 py-1 rounded-full font-black border"
                style={{
                  background: `${style.bg}18`,
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
          <span className="font-medium" style={{ color: '#FFAAAA', fontSize: '0.95rem' }}>
            3분 이내 도착 예정 버스 없음
          </span>
        )}
      </div>
    </section>
  )
}

// ─── Column Labels ────────────────────────────────────────────────────────────
function ColumnLabels() {
  return (
    <div className="shrink-0 px-8 pt-5 pb-2 flex items-center" style={{ background: FG_BG }}>
      <div style={{ minWidth: '140px' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: FG_MUTED }}>노선</span>
      </div>
      <div className="flex-1 flex">
        <div className="flex-1 text-center text-xs font-bold uppercase tracking-widest" style={{ color: FG_MUTED }}>
          다음 버스
        </div>
        <div className="flex-1 text-center text-xs font-bold uppercase tracking-widest" style={{ color: FG_MUTED }}>
          그 다음 버스
        </div>
      </div>
      <div style={{ width: '52px' }} />
    </div>
  )
}

// ─── Arrival Card ─────────────────────────────────────────────────────────────
function ArrivalCard({ arrival, isPrimary }: { arrival: BusArrival; isPrimary: boolean }) {
  const sec = arrival.arrivalSec
  const mins = Math.floor(sec / 60)
  const secs = sec % 60
  const isImmediate = sec < 60
  const isUrgent = sec < 600

  const mainColor = isImmediate ? FG_POINT : isUrgent ? '#D97706' : FG_TEXT
  const subColor = isImmediate ? FG_POINT : isUrgent ? '#D97706' : FG_MUTED

  return (
    <div className={cn('flex flex-col items-center justify-center gap-2', isPrimary ? 'min-w-[200px]' : 'min-w-[160px]')}>
      {isImmediate ? (
        <span className="font-black animate-pulse tracking-tight"
          style={{ fontSize: isPrimary ? '2.6rem' : '1.7rem', color: FG_POINT, lineHeight: 1 }}
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

      {/* 상태 뱃지 — 막차만 표시 */}
      {arrival.isLastBus && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}
        >막차</span>
      )}

      {/* 현재 위치 */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {arrival.restStopCount > 0 && !isImmediate && (
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: isPrimary ? '1rem' : '0.8rem', color: FG_MUTED }}
          >
            {arrival.restStopCount}정류소 전
          </span>
        )}
        {arrival.latestStopName && (
          <div className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
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
  const { routeNo, routeType, arrivals } = group
  const displayNo = routeNo.replace(/\s*\(.*?\)\s*/g, '')
  const style = getRouteStyle(routeType)
  const isNight = displayNo.startsWith('N') || displayNo.startsWith('n')

  return (
    <div
      className="flex items-center rounded-2xl overflow-hidden border transition-all duration-200"
      style={{
        background: isNight ? '#EFF6FF' : FG_CARD,
        borderColor: isNight ? '#BFDBFE' : FG_BORDER,
        boxShadow: isNight
          ? '0 1px 4px rgba(59,130,246,0.08)'
          : '0 1px 4px rgba(0,0,0,0.05)',
      }}
    >
      {/* 왼쪽: 노선번호 */}
      <div
        className="flex flex-col items-center justify-center gap-2 py-5 px-5 self-stretch border-r"
        style={{
          minWidth: '140px',
          background: isNight ? 'rgba(191,219,254,0.35)' : '#F9FAFB',
          borderColor: isNight ? '#BFDBFE' : FG_BORDER,
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
            style={{ background: 'rgba(191,219,254,0.6)', color: '#1D4ED8' }}
          >심야</span>
        )}
      </div>

      {/* 도착 정보 2칸 */}
      <div className="flex items-center flex-1">
        <div className="flex-1 flex items-center justify-center py-4 px-4 border-r" style={{ borderColor: FG_BORDER }}>
          {arrivals[0]
            ? <ArrivalCard arrival={arrivals[0]} isPrimary={true} />
            : <span className="text-sm" style={{ color: FG_MUTED }}>정보 없음</span>
          }
        </div>
        <div className="flex-1 flex items-center justify-center py-4 px-4 opacity-80">
          {arrivals[1]
            ? <ArrivalCard arrival={arrivals[1]} isPrimary={false} />
            : <span className="text-sm" style={{ color: '#D1D5DB' }}>다음 버스 정보 없음</span>
          }
        </div>
      </div>

    </div>
  )
}

// ─── Main List ────────────────────────────────────────────────────────────────
function MainList({ arrivals, serviceEnded }: { arrivals: BusArrival[]; serviceEnded: boolean }) {
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
      <section className="flex-1 flex flex-col items-center justify-center gap-4 py-10" style={{ background: FG_BG }}>
        <div className="rounded-3xl flex flex-col items-center justify-center gap-3 px-12 py-10 border shadow-sm"
          style={{ background: FG_CARD, borderColor: FG_BORDER }}
        >
          <span style={{ fontSize: '3rem', lineHeight: 1 }}>🌙</span>
          <span className="font-black tracking-tight" style={{ fontSize: '2.25rem', color: FG_TEXT }}>운행 종료</span>
          <span className="font-medium text-base" style={{ color: FG_MUTED }}>금일 버스 운행이 모두 종료되었습니다</span>
        </div>
      </section>
    )
  }

  const totalPages = Math.ceil(groups.length / itemsPerPage)
  const visible = groups.slice(page * itemsPerPage, (page + 1) * itemsPerPage)

  return (
    <section className="flex-1 px-8 py-3 flex flex-col gap-3 relative overflow-hidden" style={{ background: FG_BG }}>
      {totalPages > 1 && (
        <div className="absolute top-2 right-10 flex gap-1.5 z-10">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div key={i} className="w-2 h-2 rounded-full transition-colors"
              style={{ background: i === page ? FG_PRIMARY : '#D1D5DB' }}
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
        style={{ background: '#000', height: '28vh', borderColor: FG_BORDER }}
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
      style={{ borderColor: FG_BORDER, height: '28vh' }}
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
  const messages = tickerText ? [tickerText] : NOTICES
  const fullText = messages.join('     ·     ')

  return (
    <footer className="shrink-0 mx-8 mb-4 flex items-stretch rounded-2xl overflow-hidden border shadow-sm"
      style={{ borderColor: '#D1D5DB', minHeight: '6vh' }}
    >
      <div className="flex items-center gap-2 px-5 shrink-0" style={{ background: '#1F2937', minWidth: '130px' }}>
        <Info size={16} className="text-yellow-300 shrink-0" />
        <span className="text-sm font-bold text-white whitespace-nowrap">운행 정보</span>
      </div>
      <div className="flex-1 overflow-hidden flex items-center" style={{ background: '#374151' }}>
        <div className="marquee-ticker whitespace-nowrap text-white font-medium" style={{ fontSize: '0.95rem' }}>
          <span>{fullText}&emsp;&emsp;&emsp;&emsp;</span>
          <span>{fullText}&emsp;&emsp;&emsp;&emsp;</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: FG_BG }}>
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
    </div>
  )
}
