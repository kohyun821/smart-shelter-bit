'use client'

import { useState, useEffect } from 'react'
import { Sun } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Color palette ────────────────────────────────────────────────────────────
const MAIN  = '#1A237E' // deep navy
const SUB   = '#E8EAF6' // soft sky blue
const POINT = '#ED1C24' // red

// ─── Types ────────────────────────────────────────────────────────────────────
interface BusArrival {
  id: string
  routeNo: string
  arrivalSec: number      // ARRIVALESTIMATETIME (seconds)
  restStopCount: number   // REST_STOP_COUNT
  isLowFloor: boolean     // LOW_TP_CD === 'Y'
  isLastBus: boolean      // LASTBUSYN === 'Y'
  currentStop: number     // LATEST_STOPSEQ (1-based)
  totalStops: number      // total stops on route
}

// ─── Mock data (replace with real API in production) ─────────────────────────
const MOCK_ARRIVALS: BusArrival[] = [
  { id: 'a1', routeNo: '33',    arrivalSec: 29,   restStopCount: 1,  isLowFloor: true,  isLastBus: false, currentStop: 13, totalStops: 14 },
  { id: 'a2', routeNo: '60',    arrivalSec: 148,  restStopCount: 3,  isLowFloor: false, isLastBus: false, currentStop: 9,  totalStops: 12 },
  { id: 'a3', routeNo: '700-1', arrivalSec: 480,  restStopCount: 5,  isLowFloor: false, isLastBus: true,  currentStop: 3,  totalStops: 8  },
  { id: 'a4', routeNo: '700',   arrivalSec: 920,  restStopCount: 8,  isLowFloor: false, isLastBus: false, currentStop: 2,  totalStops: 10 },
  { id: 'a5', routeNo: '33',    arrivalSec: 1080, restStopCount: 11, isLowFloor: true,  isLastBus: false, currentStop: 3,  totalStops: 14 },
  { id: 'a6', routeNo: '3000',  arrivalSec: 1440, restStopCount: 6,  isLowFloor: false, isLastBus: false, currentStop: 1,  totalStops: 6  },
]

// ─── Utilities ────────────────────────────────────────────────────────────────
function pad2(n: number) {
  return String(n).padStart(2, '0')
}

// ─── Header ───────────────────────────────────────────────────────────────────
function BitHeader({ now }: { now: Date }) {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const dateStr = `${now.getFullYear()}.${pad2(now.getMonth() + 1)}.${pad2(now.getDate())} (${days[now.getDay()]})`
  const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`

  return (
    <header
      className="shrink-0 flex items-center justify-between px-8"
      style={{ background: MAIN, height: '13vh' }}
    >
      {/* Left — logo + station name */}
      <div className="flex items-center gap-4">
        <div
          className="shrink-0 rounded-2xl flex items-center justify-center bg-white/20"
          style={{ width: '3.25rem', height: '3.25rem' }}
        >
          <span className="text-white font-black text-xl select-none">강</span>
        </div>
        <div>
          <p className="text-white/50 text-xs font-bold tracking-[0.2em] uppercase">
            Ganghwa-gun · Bus Stop
          </p>
          <h1 className="text-white font-black tracking-tight" style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)' }}>
            강화터미널
          </h1>
        </div>
      </div>

      {/* Right — live badge, weather, clock */}
      <div className="flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-3">
          {/* Live indicator */}
          <div className="flex items-center gap-2 rounded-full px-3 py-1 bg-white/10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
            </span>
            <span className="text-white/70 text-[10px] font-black tracking-[0.2em] uppercase">LIVE</span>
          </div>
          {/* Weather */}
          <div className="flex items-center gap-1.5 text-white/80">
            <Sun className="w-4 h-4 text-yellow-300" />
            <span className="text-base font-bold">12°C</span>
          </div>
        </div>
        <p className="text-white/50 text-xs">{dateStr}</p>
        <p className="font-mono font-black tabular-nums text-white" style={{ fontSize: 'clamp(1.25rem, 2vw, 1.75rem)' }}>
          {timeStr}
        </p>
      </div>
    </header>
  )
}

// ─── Soon Arriving ────────────────────────────────────────────────────────────
function SoonArriving({ arrivals }: { arrivals: BusArrival[] }) {
  const soon = arrivals.filter(a => a.arrivalSec <= 180)

  return (
    <section
      className="shrink-0 flex items-center gap-4 px-8"
      style={{ background: SUB, height: '9vh' }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-2 w-2">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ background: POINT }}
          />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: POINT }} />
        </span>
        <span className="text-xs font-black tracking-[0.15em] uppercase" style={{ color: MAIN }}>
          곧 도착
        </span>
      </div>
      <div className="w-px h-5" style={{ background: `${MAIN}30` }} />
      <div className="flex flex-wrap gap-2">
        {soon.length > 0 ? (
          soon.map(a => (
            <Badge
              key={a.id}
              className="rounded-full text-white text-sm font-black px-4 py-1 border-0"
              style={{ background: MAIN }}
            >
              {a.routeNo}
            </Badge>
          ))
        ) : (
          <span className="text-sm font-medium" style={{ color: `${MAIN}60` }}>
            3분 이내 도착 예정 버스 없음
          </span>
        )}
      </div>
    </section>
  )
}

// ─── Location progress bar: ●─●─[🚌]─○─○ ─────────────────────────────────
function LocationBar({ currentStop, totalStops }: { currentStop: number; totalStops: number }) {
  const MAX_NODES = 9
  const nodeCount = Math.min(totalStops, MAX_NODES)
  const ratio = totalStops <= 1 ? 0 : (currentStop - 1) / (totalStops - 1)
  const busPos = Math.round(ratio * (nodeCount - 1))

  return (
    <div className="flex items-center w-full max-w-[280px]">
      {Array.from({ length: nodeCount }, (_, i) => (
        <div key={i} className="flex items-center flex-1 first:flex-none last:flex-none">
          {/* Connector line before each node (except first) */}
          {i > 0 && (
            <div
              className="flex-1 h-px"
              style={{ background: i <= busPos ? MAIN : '#D1D5DB' }}
            />
          )}
          {/* Node */}
          {i === busPos ? (
            <span className="text-base leading-none select-none">🚌</span>
          ) : i < busPos ? (
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: MAIN }} />
          ) : (
            <div
              className="w-2.5 h-2.5 rounded-full border-2 shrink-0 bg-white"
              style={{ borderColor: '#D1D5DB' }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Route row ────────────────────────────────────────────────────────────────
function RouteRow({ arrival, zebra }: { arrival: BusArrival; zebra: boolean }) {
  const { arrivalSec: sec, restStopCount, isLowFloor, isLastBus, routeNo, currentStop, totalStops } = arrival
  const isImmediate = sec < 60
  const min = Math.floor(sec / 60)
  const isUrgent = sec < 600

  return (
    <div
      className={cn(
        'flex items-center gap-5 px-6 py-4 rounded-2xl border transition-colors',
        zebra ? 'bg-white border-white' : 'border-[#E8EAF6]',
      )}
      style={{ background: zebra ? '#ffffff' : SUB }}
    >
      {/* Route number chip */}
      <div
        className="shrink-0 rounded-xl flex items-center justify-center shadow-sm"
        style={{ background: MAIN, width: '4rem', height: '4rem' }}
      >
        <span className="text-white font-black text-center leading-tight" style={{ fontSize: 'clamp(0.85rem, 1.5vw, 1rem)' }}>
          {routeNo}
        </span>
      </div>

      {/* Middle — arrival time + badges + location bar */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        {/* Top: time + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {isImmediate ? (
            <span className="font-black animate-pulse" style={{ color: POINT, fontSize: '1.5rem' }}>
              곧 도착
            </span>
          ) : (
            <div className="flex items-baseline gap-0.5">
              <span
                className="font-black tabular-nums"
                style={{ color: isUrgent ? POINT : MAIN, fontSize: '1.75rem' }}
              >
                {min}
              </span>
              <span className="text-base font-bold" style={{ color: isUrgent ? POINT : MAIN }}>분</span>
            </div>
          )}
          {!isImmediate && restStopCount > 0 && (
            <span className="text-xs text-gray-400 font-medium">{restStopCount}정거장 전</span>
          )}
          {isLowFloor && (
            <Badge
              className="rounded-full text-white text-xs font-bold px-2.5 py-0.5 border-0"
              style={{ background: POINT }}
            >
              ♿ 저상
            </Badge>
          )}
          {isLastBus && (
            <Badge
              className="rounded-full text-white text-xs font-bold px-2.5 py-0.5 border-0"
              style={{ background: POINT }}
            >
              막차
            </Badge>
          )}
        </div>
        {/* Location bar */}
        <LocationBar currentStop={currentStop} totalStops={totalStops} />
      </div>
    </div>
  )
}

// ─── Main list ────────────────────────────────────────────────────────────────
function MainList({ arrivals }: { arrivals: BusArrival[] }) {
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
  const [arrivals, setArrivals] = useState(MOCK_ARRIVALS)

  // Real-time clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Simulate 20-second polling cycle (replace with real API)
  useEffect(() => {
    const t = setInterval(() => {
      setArrivals(prev =>
        prev.map(a => ({
          ...a,
          arrivalSec: Math.max(0, a.arrivalSec - 20),
          currentStop:
            a.arrivalSec <= 20
              ? Math.min(a.totalStops, a.currentStop + 1)
              : a.currentStop,
        })),
      )
    }, 20_000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <BitHeader now={now} />
      <SoonArriving arrivals={arrivals} />
      <MainList arrivals={arrivals} />
      <PromoArea />
      <FooterTicker />
    </div>
  )
}
