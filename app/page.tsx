'use client'

import { useState, useEffect } from 'react'
import { Sun } from 'lucide-react'
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
}

const BRIDGE_URL = 'http://localhost:4000'

// ─── Utilities ────────────────────────────────────────────────────────────────
function pad2(n: number) {
  return String(n).padStart(2, '0')
}

// ─── Header ───────────────────────────────────────────────────────────────────
function BitHeader({ now, stopName, shortBstopId }: { now: Date; stopName: string | null; shortBstopId: string | null }) {
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
        <div
          className="flex items-center justify-center gap-[0.6vh] font-bold tabular-nums leading-none"
          style={{ color: HEADER_WEATHER, fontSize: 'clamp(1rem, 2.6vh, 1.65rem)' }}
        >
          <Sun
            className="shrink-0 opacity-95"
            style={{ width: 'clamp(1.15rem, 2.8vh, 1.85rem)', height: 'clamp(1.15rem, 2.8vh, 1.85rem)' }}
            strokeWidth={2.25}
          />
          <span>12°C</span>
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
function SoonArriving({ arrivals }: { arrivals: BusArrival[] }) {
  const soon = arrivals.filter(a => a.arrivalSec <= 180)

  return (
    <section
      className="shrink-0 flex items-center gap-8 px-10"
      style={{ background: SUB, height: '12vh' }}
    >
      <div className="flex items-center gap-4 shrink-0">
        <span className="relative flex h-6 w-6">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: POINT }}
          />
          <span className="relative inline-flex rounded-full h-6 w-6" style={{ background: POINT }} />
        </span>
        <span className="text-3xl font-black tracking-[0.15em] uppercase" style={{ color: MAIN }}>
          곧 도착
        </span>
      </div>
      <div className="w-1.5 h-12 rounded-full" style={{ background: `${MAIN}30` }} />
      <div className="flex flex-wrap gap-4">
        {soon.length > 0 ? (
          soon.map(a => (
            <Badge
              key={a.id}
              className="rounded-full text-white text-3xl font-black px-8 py-2.5 border-0 shadow-sm"
              style={{ background: getRouteColor(a.routeType) }}
            >
              {a.routeNo.replace(/\s*\(.*?\)\s*/g, '')}
            </Badge>
          ))
        ) : (
          <span className="text-3xl font-bold" style={{ color: `${MAIN}60` }}>
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
        'flex items-center gap-8 px-10 py-6 rounded-[2.5rem] border transition-colors shadow-sm',
        zebra ? 'bg-white border-white' : 'border-[#E8EAF6]',
      )}
      style={{ background: zebra ? '#ffffff' : SUB }}
    >
      {/* Route number chip */}
      <div
        className="shrink-0 rounded-[1.5rem] flex items-center justify-center shadow-md pb-1"
        style={{ background: routeColor, width: '10.5rem', height: '10.5rem' }}
      >
        <span className="text-white font-black text-center leading-tight drop-shadow-sm" style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)' }}>
          {displayRouteNo}
        </span>
      </div>

      {/* Middle — arrival time + badges + location bar */}
      <div className="flex-1 flex items-center gap-12 min-w-0 pl-6">
        {/* Left: time + badges */}
        <div className="flex items-center gap-8 shrink-0 min-w-[340px]">
          <div className="w-[17rem] shrink-0 flex items-center justify-start">
            {isImmediate ? (
              <span className="font-black animate-pulse tracking-tighter whitespace-nowrap" style={{ color: POINT, fontSize: '6rem' }}>
                곧 도착
              </span>
            ) : (
              <div className="flex items-baseline gap-2">
                <span
                  className="font-black tabular-nums tracking-tighter"
                  style={{ color: isUrgent ? POINT : MAIN, fontSize: '7.5rem', lineHeight: '1' }}
                >
                  {min}
                </span>
                <span className="text-5xl font-black tracking-tight whitespace-nowrap" style={{ color: isUrgent ? POINT : MAIN }}>분</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 justify-center">
            <div className="flex items-center gap-3">
              {isLowFloor && (
                <Badge
                  className="rounded-full text-white text-2xl font-bold px-5 py-2 border-0 leading-none shadow-sm"
                  style={{ background: POINT }}
                >
                  ♿ 저상
                </Badge>
              )}
              {isLastBus && (
                <Badge
                  className="rounded-full text-white text-2xl font-bold px-5 py-2 border-0 leading-none shadow-sm"
                  style={{ background: POINT }}
                >
                  막차
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-1.5 mt-1">
              {!isImmediate && restStopCount > 0 && (
                <span className="text-3xl text-slate-800 font-black tracking-tight whitespace-nowrap">
                  {restStopCount}정거장 전
                </span>
              )}
              <span className="text-2xl font-bold tracking-tight whitespace-nowrap" style={{ color: routeColor }}>
                {getRouteTypeName(routeType)}
              </span>
            </div>
          </div>
        </div>

        {/* Location bar stretches here */}
        <div className="flex-1 flex items-center pl-12 pr-6 relative mt-16">
          {latestStopName && (
            <div className="absolute bottom-full mb-3 right-8">
              <span className="text-[2.2rem] font-black tracking-tight text-slate-800">
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
  if (serviceEnded) {
    return (
      <section
        className="flex-1 flex flex-col items-center justify-center gap-4"
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

  return (
    <section
      className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2"
      style={{ background: '#F1F3FA' }}
    >
      {arrivals.map((a, i) => (
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
      className="shrink-0 mx-4 mb-3 rounded-2xl overflow-hidden flex items-center justify-center"
      style={{ height: '18vh' }}
    >
      <div
        className="w-full h-full flex items-center justify-center px-8 transition-opacity duration-400"
        style={{
          background: PROMO_SLIDES[idx].gradient,
          opacity: visible ? 1 : 0,
        }}
      >
        <p className="text-white font-black text-center" style={{ fontSize: 'clamp(1rem, 2vw, 1.5rem)' }}>
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

  // Real-time clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
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
      <BitHeader now={now} stopName={stopName} shortBstopId={shortBstopId} />
      <SoonArriving arrivals={arrivals} />
      <MainList arrivals={arrivals} serviceEnded={serviceEnded} />
      <PromoArea />
      <FooterTicker />
      <LogPanel />
    </div>
  )
}
