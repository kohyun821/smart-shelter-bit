'use client'

import { useState, useEffect } from 'react'
import { Sun, Cloud, CloudRain, CloudSnow } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { LogPanel } from '@/components/log-panel'

// ─── Color palette ────────────────────────────────────────────────────────────
const MAIN = '#1A237E' // deep navy
const SUB = '#E8EAF6' // soft sky blue
const POINT = '#ED1C24' // red
/** 헤더 전용: 평면 네이비보다 깊이감 있게 */
const HEADER_GRADIENT =
  'linear-gradient(168deg, #283593 0%, #1A237E 42%, #0d1447 100%)'
const HEADER_MUTED = 'rgba(232, 234, 246, 0.62)'
const HEADER_WEATHER = '#FFE082' // 앰버 — 쨍한 노랑보다 네이비와 잘 어울림

// ─── Types ────────────────────────────────────────────────────────────────────
interface WeatherData {
  temp: number | null
  minTemp: number | null
  maxTemp: number | null
  sky: number | null  // 1=맑음, 3=구름많음, 4=흐림
  pty: number         // 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기
}

interface BusArrival {
  id: string
  routeNo: string
  routeType: string       // ROUTETPCD
  arrivalSec: number      // ARRIVALESTIMATETIME (seconds)
  restStopCount: number   // REST_STOP_COUNT
  isLowFloor: boolean     // LOW_TP_CD === 'Y'
  isLastBus: boolean      // LASTBUSYN === 'Y'
  currentStop: number     // LATEST_STOPSEQ (1-based)
  totalStops: number      // total stops on route
  latestStopName?: string
}

const BRIDGE_URL = 'http://localhost:4000'

// ─── Utilities ────────────────────────────────────────────────────────────────
function pad2(n: number) {
  return String(n).padStart(2, '0')
}

// ─── 날씨 아이콘 ──────────────────────────────────────────────────────────────
function WeatherIcon({ sky, pty }: { sky: number | null; pty: number }) {
  const iconProps = {
    className: 'shrink-0 opacity-95' as const,
    style: { width: 'clamp(1.1rem, 2.6vh, 1.75rem)', height: 'clamp(1.1rem, 2.6vh, 1.75rem)' },
    strokeWidth: 2.25,
  }
  if (pty > 0) {
    if (pty === 3) return <CloudSnow {...iconProps} />
    return <CloudRain {...iconProps} />
  }
  if (sky === 3 || sky === 4) return <Cloud {...iconProps} />
  return <Sun {...iconProps} />
}

// ─── Header ───────────────────────────────────────────────────────────────────
function BitHeader({ now, stopName, shortBstopId, weather }: { now: Date; stopName: string | null; shortBstopId: string | null; weather: WeatherData | null }) {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const dateStr = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())} (${days[now.getDay()]})`
  const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`

  return (
    <header
      className="shrink-0 grid grid-cols-3 items-stretch gap-3 px-6 sm:px-8 w-full min-w-0 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08)]"
      style={{ background: HEADER_GRADIENT, height: '15vh', minHeight: '5.5rem' }}
    >
      {/* 1/3 — symbol (헤더 세로의 대부분을 쓰도록) */}
      <div className="flex min-w-0 min-h-0 items-center justify-center py-[1vh]">
        <div
          className="shrink-0 rounded-2xl p-[0.35vh] shadow-lg max-h-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(145deg, #ffffff 0%, #f0f2fa 100%)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.35)',
          }}
        >
          <img
            src="/symbol.jpg"
            alt="강화군"
            className="shrink-0 rounded-xl object-contain bg-white max-h-full w-auto"
            style={{
              height: 'min(12.5vh, 88%)',
              maxWidth: 'min(30vw, 12rem)',
            }}
          />
        </div>
      </div>

      {/* 1/3 — station name */}
      <div className="flex min-w-0 min-h-0 flex-col items-center justify-center text-center px-2 border-x border-white/[0.08] gap-[0.6vh] py-[0.5vh]">
        <p
          className="font-bold tracking-[0.2em] uppercase leading-none"
          style={{
            color: HEADER_MUTED,
            fontSize: 'clamp(0.7rem, 1.85vh, 1.05rem)',
          }}
        >
          [{shortBstopId ?? '12345'}]
        </p>
        <h1
          className="font-black tracking-tight line-clamp-2 leading-[1.08] drop-shadow-sm max-w-full"
          style={{
            color: SUB,
            fontSize: 'clamp(1.85rem, 5vh, 4rem)',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        >
          {stopName ?? '—'}
        </h1>
      </div>

      {/* 1/3 — weather + date / time (세로 균등 배치로 띠 높이 활용) */}
      <div className="flex min-w-0 min-h-0 flex-col items-center justify-evenly text-center py-[0.75vh]">
        {/* 날씨 아이콘 + 현재 기온 + 최저~최고 기온 */}
        <div className="flex flex-col items-center gap-[0.25vh] leading-none">
          <div
            className="flex items-center justify-center gap-[0.5vh] font-bold tabular-nums"
            style={{ color: HEADER_WEATHER, fontSize: 'clamp(0.9rem, 2.3vh, 1.5rem)' }}
          >
            <WeatherIcon sky={weather?.sky ?? null} pty={weather?.pty ?? 0} />
            <span>{weather?.temp != null ? `${Math.round(weather.temp)}°C` : '—'}</span>
          </div>
          <div
            className="tabular-nums font-medium"
            style={{ color: HEADER_MUTED, fontSize: 'clamp(0.6rem, 1.5vh, 0.9rem)' }}
          >
            {weather?.minTemp != null && weather?.maxTemp != null
              ? `${Math.round(weather.minTemp)}° ~ ${Math.round(weather.maxTemp)}°`
              : '최저 ~ 최고'}
          </div>
        </div>
        <p
          className="font-semibold leading-tight px-1"
          style={{
            color: HEADER_MUTED,
            fontSize: 'clamp(0.75rem, 2vh, 1.2rem)',
          }}
        >
          {dateStr}
        </p>
        <div
          className="rounded-xl px-[1.2vw] py-[0.45vh]"
          style={{
            background: 'rgba(0,0,0,0.22)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <p
            className="font-mono font-bold tabular-nums tracking-[0.06em] leading-none"
            style={{
              color: SUB,
              fontSize: 'clamp(1.45rem, 3.8vh, 2.85rem)',
            }}
          >
            {timeStr}
          </p>
        </div>
      </div>
    </header>
  )
}

function getRouteColor(routeType: string) {
  if (routeType === '0') return '#13908f'
  if (routeType === '1') return '#011ff6'
  if (routeType === '6') return '#b6982a'
  if (routeType === '9') return '#3d9c3e'
  return MAIN
}

function getRouteTypeName(routeType: string) {
  switch (routeType) {
    case '0': return '일반' // 정보 없음을 일반으로 취급
    case '1': return '지선'
    case '2': return '간선'
    case '3': return '좌석'
    case '4': return '광역'
    case '5': return '리무진'
    case '6': return '마을버스'
    case '7': return '순환'
    case '8': return '급행간선'
    case '9': return '지선(순환)'
    default: return '일반'
  }
}

// ─── Soon Arriving ────────────────────────────────────────────────────────────
/** 3분 59초 이하이거나 2정거장 이내 */
function isSoonArriving(a: BusArrival) {
  return a.arrivalSec <= 239 || a.restStopCount <= 2
}

function SoonArriving({ arrivals }: { arrivals: BusArrival[] }) {
  const soon = arrivals.filter(isSoonArriving)

  return (
    <section
      className="shrink-0 flex items-center gap-5 px-6"
      style={{ background: SUB, height: '6.5vh' }}
    >
      <div className="flex items-center gap-3 shrink-0">
        <span className="relative flex h-5 w-5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: POINT }}
          />
          <span className="relative inline-flex rounded-full h-5 w-5" style={{ background: POINT }} />
        </span>
        <span className="text-2xl font-black tracking-[0.1em] uppercase whitespace-nowrap" style={{ color: MAIN }}>
          곧 도착
        </span>
      </div>
      <div className="w-1 h-8 rounded-full" style={{ background: `${MAIN}30` }} />
      <div className="flex flex-wrap gap-3">
        {soon.length > 0 ? (
          soon.map(a => (
            <Badge
              key={a.id}
              className="rounded-full text-white text-2xl font-black px-6 py-2 border-0 shadow-sm"
              style={{ background: getRouteColor(a.routeType) }}
            >
              {a.routeNo.replace(/\s*\(.*?\)\s*/g, '')}
            </Badge>
          ))
        ) : (
          <span className="text-2xl font-bold" style={{ color: `${MAIN}60` }}>
            3분 이내 도착 예정 버스 없음
          </span>
        )}
      </div>
    </section>
  )
}

// ─── Location progress bar: ●─●─[🚌]─○─○ ─────────────────────────────────
function LocationBar({ currentStop, totalStops, restStopCount }: { currentStop: number; totalStops: number; restStopCount: number }) {
  const safeRestStopCount = Math.max(0, restStopCount)
  const isCompressed = safeRestStopCount > 6
  const nodeCount = 6

  // Right-to-Left progression. Leftmost node (0) is "1정거장 전"
  const busPos = isCompressed ? 5 : Math.max(0, safeRestStopCount - 1)

  return (
    <div className="flex items-center w-full">
      {Array.from({ length: nodeCount }, (_, i) => {
        // If compressed, ellipsis is right after node 0
        const isLongSeg = isCompressed && i === 1
        const isFirst = i === 0

        // Node values: 1, 2, 3... moving right. If compressed, node 1..5 map to n-4..n
        const nodeValue = isCompressed
          ? (i === 0 ? 1 : safeRestStopCount - (5 - i))
          : i + 1

        return (
          <div
            key={i}
            className={cn(
              'flex items-center relative',
              isFirst ? 'flex-none w-8' : isLongSeg ? 'flex-1' : (isCompressed ? 'flex-none w-[4.5rem]' : 'flex-1'),
            )}
          >
            {/* Connector line before each node (except first) */}
            {i > 0 && (
              isLongSeg ? (
                <div
                  className="flex-1 h-2"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #D1D5DB 3px, transparent 3px)',
                    backgroundSize: '12px 8px',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'repeat-x'
                  }}
                />
              ) : (
                <div className="flex-1 h-2" style={{ background: '#D1D5DB' }} />
              )
            )}

            {/* Node */}
            <div className="w-8 shrink-0 flex justify-center items-center h-8 relative">
              {i === busPos ? (
                <span className="text-6xl leading-none select-none drop-shadow-sm absolute z-10">
                  🚌
                </span>
              ) : (
                <div
                  className="w-8 h-8 rounded-full border-[4px] bg-white shadow-sm z-0 flex items-center justify-center"
                  style={{ borderColor: '#D1D5DB' }}
                >
                  <span className="text-[13px] font-black tracking-tighter" style={{ color: '#4B5563', lineHeight: '1' }}>
                    {nodeValue}
                  </span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Route row ────────────────────────────────────────────────────────────────
function RouteRow({ arrival, zebra }: { arrival: BusArrival; zebra: boolean }) {
  const { arrivalSec: sec, restStopCount, isLowFloor, isLastBus, routeNo, routeType, currentStop, totalStops, latestStopName } = arrival
  const isImmediate = sec < 60
  const min = Math.floor(sec / 60)
  const isUrgent = sec < 600
  const displayRouteNo = routeNo.replace(/\s*\(.*?\)\s*/g, '')

  const routeColor = getRouteColor(routeType)

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-6 py-3 rounded-[1.5rem] border transition-colors shadow-sm',
        zebra ? 'bg-white border-white' : 'border-[#E8EAF6]',
      )}
      style={{ background: zebra ? '#ffffff' : SUB }}
    >
      {/* Route number chip */}
      <div
        className="shrink-0 rounded-[1rem] flex items-center justify-center shadow-md pb-0.5"
        style={{ background: routeColor, width: '7rem', height: '7rem' }}
      >
        <span className="text-white font-black text-center leading-tight drop-shadow-sm" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)' }}>
          {displayRouteNo}
        </span>
      </div>

      {/* Middle — arrival time + badges + location bar */}
      <div className="flex-1 flex items-center gap-6 min-w-0 pl-2">
        {/* Left: time + badges */}
        <div className="flex items-center gap-3 shrink-0 min-w-[200px]">
          <div className="w-[10rem] shrink-0 flex items-center justify-start">
            {isImmediate ? (
              <span className="font-black animate-pulse tracking-tighter whitespace-nowrap" style={{ color: POINT, fontSize: '3.2rem' }}>
                곧 도착
              </span>
            ) : (
              <div className="flex items-baseline gap-1">
                <span
                  className="font-black tabular-nums tracking-tighter"
                  style={{ color: isUrgent ? POINT : MAIN, fontSize: '4.8rem', lineHeight: '1' }}
                >
                  {min}
                </span>
                <span className="text-3xl font-black tracking-tight whitespace-nowrap" style={{ color: isUrgent ? POINT : MAIN }}>분</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 justify-center">
            <div className="flex items-center gap-2">
              {isLowFloor && (
                <Badge
                  className="rounded-full text-white text-base font-bold px-3 py-1 border-0 leading-none shadow-sm"
                  style={{ background: POINT }}
                >
                  ♿ 저상
                </Badge>
              )}
              {isLastBus && (
                <Badge
                  className="rounded-full text-white text-base font-bold px-3 py-1 border-0 leading-none shadow-sm"
                  style={{ background: POINT }}
                >
                  막차
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-0.5 mt-0.5">
              {!isImmediate && restStopCount > 0 && (
                <span className="text-xl text-slate-800 font-black tracking-tight whitespace-nowrap">
                  {restStopCount}정거장 전
                </span>
              )}
              <span className="text-base font-bold tracking-tight whitespace-nowrap" style={{ color: routeColor }}>
                {getRouteTypeName(routeType)}
              </span>
            </div>
          </div>
        </div>

        {/* Location bar stretches here */}
        <div className="flex-1 flex items-center pl-6 pr-4 relative mt-10">
          {latestStopName && (
            <div className="absolute bottom-full mb-2 right-4">
              <span className="text-xl font-black tracking-tight text-slate-700">
                {latestStopName}
              </span>
            </div>
          )}
          <LocationBar currentStop={currentStop} totalStops={totalStops} restStopCount={restStopCount} />
        </div>
      </div>
    </div>
  )
}

// ─── Main list ────────────────────────────────────────────────────────────────
function MainList({ arrivals, serviceEnded }: { arrivals: BusArrival[]; serviceEnded: boolean }) {
  const [page, setPage] = useState(0)
  const itemsPerPage = 5

  useEffect(() => {
    if (arrivals.length <= itemsPerPage) {
      setPage(0)
      return
    }
    const t = setInterval(() => {
      setPage(p => {
        const totalPages = Math.ceil(arrivals.length / itemsPerPage)
        return (p + 1) % totalPages
      })
    }, 10000) // 10 seconds active duration per page
    return () => clearInterval(t)
  }, [arrivals.length, itemsPerPage])

  useEffect(() => {
    const totalPages = Math.ceil(arrivals.length / itemsPerPage)
    if (page >= totalPages && totalPages > 0) {
      setPage(0)
    }
  }, [arrivals.length, page, itemsPerPage])

  if (serviceEnded) {
    return (
      <section
        className="flex-1 flex flex-col items-center justify-center gap-4 py-10"
        style={{ background: '#F1F3FA' }}
      >
        <div
          className="rounded-3xl flex flex-col items-center justify-center gap-3 px-12 py-10 shadow-lg"
          style={{ background: MAIN }}
        >
          <span style={{ fontSize: '3rem', lineHeight: 1 }}>🌙</span>
          <span className="text-white font-black tracking-tight" style={{ fontSize: '2.25rem' }}>
            운행 종료
          </span>
          <span className="text-white/60 font-medium text-base">
            금일 버스 운행이 모두 종료되었습니다
          </span>
        </div>
      </section>
    )
  }

  const startIndex = page * itemsPerPage
  const visibleArrivals = arrivals.slice(startIndex, Math.min(startIndex + itemsPerPage, arrivals.length))
  const totalPages = Math.ceil(arrivals.length / itemsPerPage)

  return (
    <section
      className="flex-1 px-4 py-3 flex flex-col gap-2 relative transition-all duration-300 overflow-hidden"
      style={{ background: '#F1F3FA' }}
    >
      {/* Page indicator dot system */}
      {totalPages > 1 && (
        <div className="absolute top-1 right-6 flex gap-1.5 z-10 p-1">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-colors",
                i === page ? "bg-[#1A237E]" : "bg-[#1A237E]/20"
              )}
            />
          ))}
        </div>
      )}

      {visibleArrivals.map((a, i) => (
        <RouteRow key={a.id} arrival={a} zebra={i % 2 === 0} />
      ))}
    </section>
  )
}

// ─── Promo area ───────────────────────────────────────────────────────────────
const PROMO_SLIDES = [
  { text: '강화도 고인돌 — 유네스코 세계문화유산', gradient: 'linear-gradient(135deg, #1B5E20, #388E3C)' },
  { text: '2026 강화 딸기 축제 · 4.18 ~ 4.20', gradient: 'linear-gradient(135deg, #B71C1C, #E53935)' },
  { text: '강화 역사관  매일 09:00 ~ 18:00', gradient: `linear-gradient(135deg, ${MAIN}, #3949AB)` },
]

function PromoArea() {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % PROMO_SLIDES.length)
        setVisible(true)
      }, 400)
    }, 5000)
    return () => clearInterval(t)
  }, [])

  return (
    <section
      className="shrink-0 mx-4 mb-3 rounded-[2rem] overflow-hidden flex items-center justify-center shadow-lg"
      style={{ background: '#ffffff', height: '30vh' }}
    >
      <div
        className="w-full h-full flex items-center justify-center px-10 transition-opacity duration-400"
        style={{
          background: PROMO_SLIDES[idx].gradient,
          opacity: visible ? 1 : 0,
        }}
      >
        <p className="text-white font-black text-center break-keep" style={{ fontSize: 'clamp(2rem, 5.5vh, 4rem)', textShadow: '0 3px 6px rgba(0,0,0,0.3)' }}>
          {PROMO_SLIDES[idx].text}
        </p>
      </div>
    </section>
  )
}

// ─── Footer ticker ────────────────────────────────────────────────────────────
const NOTICES = [
  '강화터미널 버스 도착 정보는 실시간으로 제공됩니다.',
  '기상 악화 시 버스 운행 지연이 발생할 수 있습니다.',
  '버스 내에서는 음식물 섭취를 자제해 주세요.',
  '노약자 및 임산부에게 자리를 양보해 주세요.',
  '인천광역시 강화군 버스 정보 안내 단말기',
].join('    ·    ')

function FooterTicker() {
  return (
    <footer
      className="shrink-0 flex items-center overflow-hidden"
      style={{ background: MAIN, height: '6vh' }}
    >
      {/* Label */}
      <div
        className="shrink-0 flex items-center px-4 h-full border-r"
        style={{ borderColor: 'rgba(255,255,255,0.15)' }}
      >
        <span className="text-white/60 text-[10px] font-black tracking-[0.2em] uppercase">공지</span>
      </div>
      {/* Scrolling text */}
      <div className="flex-1 overflow-hidden h-full flex items-center">
        <div className="marquee-ticker whitespace-nowrap text-white/80 text-sm font-medium">
          <span>{NOTICES}&emsp;&emsp;&emsp;&emsp;</span>
          <span>{NOTICES}&emsp;&emsp;&emsp;&emsp;</span>
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
  const [winSize, setWinSize] = useState<{ w: number; h: number } | null>(null)
  const [showDebugOverlay, setShowDebugOverlay] = useState(false)

  // Real-time clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Capture viewport size (for kiosk debugging)
  useEffect(() => {
    const update = () => setWinSize({ w: window.innerWidth, h: window.innerHeight })
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // 설정값 로드 (showDebugOverlay 등)
  useEffect(() => {
    fetch(`${BRIDGE_URL}/api/settings`)
      .then(r => r.json())
      .then(json => { if (json.showDebugOverlay) setShowDebugOverlay(true) })
      .catch(() => {})
  }, [])

  // 정류소 이름 + 단축 ID (브리지 기동 직후·재시작 등으로 첫 응답이 비어 있을 수 있어 몇 차례 재시도)
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
      } catch {
        /* noop */
      }
      if (!cancelled) {
        window.setTimeout(() => void load(attempt + 1), 2000)
      }
    }

    void load(0)
    return () => {
      cancelled = true
    }
  }, [])

  // 날씨 정보 로드 — 서버 준비 전이면 3초마다 재시도, 성공 후 10분 주기 갱신
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
          // 성공 시 10분 주기 갱신 시작
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
      // 데이터 없으면 3초 후 재시도
      if (!cancelled) retryTimer = setTimeout(tryLoad, 3000)
    }

    void tryLoad()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [])

  // TTS — 곧 도착 버스가 있을 때마다 음성 공지 (arrivals 갱신 주기마다)
  useEffect(() => {
    const soonRoutes = arrivals
      .filter(isSoonArriving)
      .map(a => a.routeNo.replace(/\(.*?\)/g, '').trim()) // 괄호 제거: "13(강화)" → "13"
    if (soonRoutes.length === 0) return

    const routeText = soonRoutes.length === 1
      ? `${soonRoutes[0]}번`
      : `${soonRoutes.slice(0, -1).join('번, ')}번, ${soonRoutes.at(-1)}번`
    const text = `잠시 후 도착 버스는 ${routeText} 입니다.`

    const audio = new Audio(`${BRIDGE_URL}/api/tts/speak?${new URLSearchParams({ text })}`)
    audio.play().catch(() => {})
  }, [arrivals])

  // SSE 구독 — 서버에서 20초마다 푸시
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
    <div className="flex-1 flex flex-col overflow-hidden">
      <BitHeader now={now} stopName={stopName} shortBstopId={shortBstopId} weather={weather} />
      <SoonArriving arrivals={arrivals} />
      <MainList arrivals={arrivals} serviceEnded={serviceEnded} />
      <PromoArea />
      <FooterTicker />
      <LogPanel />
      {/* setting.json showDebugOverlay: true 일 때만 표시 */}
      {showDebugOverlay && winSize && (
        <div className="fixed bottom-2 left-2 z-[9999] bg-black/70 text-white text-sm font-mono px-3 py-1.5 rounded-lg pointer-events-none">
          {winSize.w} × {winSize.h} px
        </div>
      )}
    </div>
  )
}
