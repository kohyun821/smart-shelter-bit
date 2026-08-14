'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Hls from 'hls.js'
import { MapPin, Calendar, Info, Video } from 'lucide-react'
import { LogPanel } from '@/components/log-panel'

// ─── Theme tokens (light / dark) ──────────────────────────────────────────────
const LIGHT = {
  isDark:       false,
  bg:           '#FDFDFC', // Rectangle 1 background
  card:         '#FCFCFD', // Rectangle 90 background
  text:         '#25304E', // Standard dark blue color
  muted:        '#7B8494', // Standard muted color
  border:       '#E9ECF2', // Card borders
  divider:      '#EBEDF3', // Row divider borders
  primary:      '#165CFD', // Blue point / Soon arriving theme
  point:        '#FF0004', // Red point / Ozone ellipse
  headerBg:     '#FDFDFC',
  soonBg:       'rgba(0, 77, 255, 0.03)', // Rectangle 96
  soonBorder:   '#165CFD', // Rectangle 95
  rowLeftBg:    '#FDFDFC',
  footerBar:    '#25304E',
  footerScroll: '#FCFCFD',
  footerText:   '#7B8494',
  noNext:       '#EBEDF3',
  weatherColor: '#25304E',
  lastBusBg:    '#FFF7ED',
  lastBusText:  '#C2410C',
  lastBusBorder:'#FED7AA',
  urgentColor:  '#25304E',
  nightCardBg:  '#0F1117',
  nightBorder:  'rgba(255,255,255,0.08)',
  nightLeftBg:  'rgba(255,255,255,0.03)',
  nightBadgeBg: 'rgba(255,255,255,0.1)',
  nightBadgeText:'#E8EDF8',
  nightShadow:  'none',
  cardShadow:   'none',
  busGreen:     '#489E64',
  busTown:      '#52C546',
}

const DARK = {
  isDark:       true,
  bg:           '#0F1117',
  card:         '#181D2A',
  text:         '#E8EDF8',
  muted:        '#8B9CC8',
  border:       'rgba(255,255,255,0.07)',
  divider:      'rgba(255,255,255,0.1)',
  primary:      '#4B7BF5',
  point:        '#F25C54',
  headerBg:     '#0A0E1F',
  soonBg:       'rgba(75, 123, 245, 0.08)',
  soonBorder:   '#4B7BF5',
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
  busGreen:     '#489E64',
  busTown:      '#52C546',
}

type Theme = typeof LIGHT

// 렌더 사이클마다 갱신되는 현재 테마 참조
let _theme: Theme = LIGHT
const T = () => _theme

// ─── Types ────────────────────────────────────────────────────────────────────
interface WeatherData {
  temp: number | null
  sky: number | null
  pty: number
}

interface AirQualityData {
  pm10Value: number | null
  pm10Grade: number | null
  pm10GradeText: string
  pm10GradeColor: string
  pm25Value: number | null
  pm25Grade: number | null
  pm25GradeText: string
  pm25GradeColor: string
  o3Value: number | null
  o3Grade: number | null
  o3GradeText: string
  o3GradeColor: string
  dataTime: string | null
  stationName: string
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
  arrivalSec: number | null   // null = 위치 API 기반 (도착 시간 미제공)
  restStopCount: number
  isLowFloor: boolean
  isLastBus: boolean
  currentStop: number
  totalStops: number
  latestStopName?: string
  destination?: string
  viaStopsText?: string
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
  return (a.arrivalSec ?? Infinity) <= 239 || a.restStopCount <= 2
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
function weatherImageSrc(sky: number | null, pty: number): string {
  if (pty === 4) return '/weather-shower.png'   // 소나기
  if (pty === 1) return '/weather-rainy.png'    // 비
  if (pty === 2) return '/weather-sleet.png'    // 비/눈
  if (pty === 3) return '/weather-snowy.png'    // 눈
  if (sky === 3) return '/weather-cloudy.png'   // 구름많음
  if (sky === 4) return '/weather-overcast.png' // 흐림
  return '/weather-sunny.png'                   // 맑음
}

function WeatherIcon({ sky, pty, size = 40 }: { sky: number | null; pty: number; size?: number }) {
  return (
    <img
      src={weatherImageSrc(sky, pty)}
      alt="날씨"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
    />
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function BitHeader({ now, weather, airQuality }: {
  now: Date; weather: WeatherData | null; airQuality: AirQualityData | null
}) {
  const th = T()
  const DAYS = ['일', '월', '화', '수', '목', '금', '토']
  const dateStr = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.(${DAYS[now.getDay()]})`
  const h = pad2(now.getHours())
  const m = pad2(now.getMinutes())

  return (
    <header
      className="shrink-0 w-full flex items-center justify-between"
      style={{
        boxSizing: 'border-box',
        padding: '24px 40px',
        background: th.headerBg,
        height: '130px',
      }}
    >
      {/* 왼쪽: 강화군 로고 */}
      <div className="flex flex-col items-center gap-1" style={{ width: '78px' }}>
        <img
          src="/logo-symbol.png"
          alt="강화군"
          className="object-contain"
          style={{ height: '54px', width: 'auto' }}
        />
        <span style={{ fontSize: '17px', fontWeight: 700, color: th.text, letterSpacing: '0.01em', marginTop: '2px' }}>
          강화군
        </span>
      </div>

      {/* 가운데: 대기 상태 정보 */}
      <div className="flex items-center justify-center gap-12">
        {/* 미세먼지 (PM10) */}
        <div className="flex flex-col items-center justify-between" style={{ height: '76px' }}>
          <span style={{ fontSize: '19px', fontWeight: 500, color: th.text }}>미세먼지</span>
          <div className="flex items-center gap-1.5">
            <span className="w-[18px] h-[18px] rounded-full inline-block" style={{ background: airQuality?.pm10GradeColor ?? '#9E9E9E' }} />
            <span style={{ fontSize: '24px', fontWeight: 600, color: airQuality ? th.text : th.muted }}>
              {airQuality?.pm10GradeText ?? '정보없음'}
            </span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500, color: th.muted }}>
            {airQuality?.pm10Value != null ? `${airQuality.pm10Value}㎍/㎥` : '\u00A0'}
          </span>
        </div>

        {/* 초미세먼지 (PM2.5) */}
        <div className="flex flex-col items-center justify-between" style={{ height: '76px' }}>
          <span style={{ fontSize: '19px', fontWeight: 500, color: th.text }}>초미세먼지</span>
          <div className="flex items-center gap-1.5">
            <span className="w-[18px] h-[18px] rounded-full inline-block" style={{ background: airQuality?.pm25GradeColor ?? '#9E9E9E' }} />
            <span style={{ fontSize: '24px', fontWeight: 600, color: airQuality ? th.text : th.muted }}>
              {airQuality?.pm25GradeText ?? '정보없음'}
            </span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500, color: th.muted }}>
            {airQuality?.pm25Value != null ? `${airQuality.pm25Value}㎍/㎥` : '\u00A0'}
          </span>
        </div>

        {/* 오존지수 (O3) */}
        <div className="flex flex-col items-center justify-between" style={{ height: '76px' }}>
          <span style={{ fontSize: '19px', fontWeight: 500, color: th.text }}>오존지수</span>
          <div className="flex items-center gap-1.5">
            <span className="w-[18px] h-[18px] rounded-full inline-block" style={{ background: airQuality?.o3GradeColor ?? '#9E9E9E' }} />
            <span style={{ fontSize: '24px', fontWeight: 600, color: airQuality ? th.text : th.muted }}>
              {airQuality?.o3GradeText ?? '정보없음'}
            </span>
          </div>
          <span style={{ fontSize: '13px', fontWeight: 500, color: th.muted }}>
            {airQuality?.o3Value != null ? `${airQuality.o3Value}ppm` : '\u00A0'}
          </span>
        </div>
      </div>

      {/* 오른쪽: 날씨 + 날짜 + 시간 */}
      <div className="flex items-center gap-8">
        {weather != null && (
          <div className="flex flex-col items-center justify-between" style={{ height: '76px' }}>
            <span style={{ fontSize: '19px', fontWeight: 500, color: th.text }}>날씨</span>
            <WeatherIcon sky={weather.sky} pty={weather.pty} size={36} />
            <span className="font-semibold tabular-nums" style={{ fontSize: '20px', color: th.text }}>
              {weather.temp != null ? `${Math.round(weather.temp)}°C` : ' '}
            </span>
          </div>
        )}
        <div className="flex flex-col items-end justify-between" style={{ height: '76px' }}>
          <span style={{ fontSize: '19px', fontWeight: 500, color: th.text }}>{dateStr}</span>
          <span className="font-bold tabular-nums" style={{ fontSize: '46px', lineHeight: '1', letterSpacing: '0.05em', color: th.text }}>
            {h}:{m}
          </span>
          <span style={{ fontSize: '13px', color: 'transparent' }}>&nbsp;</span>
        </div>
      </div>
    </header>
  )
}

// ─── CCTV (HLS Live) — 상단 전폭 배치 ────────────────────────────────────────
function CctvView({ url }: { url: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [connected, setConnected] = useState(false)

  const src = url ? (url.endsWith('.m3u8') ? url : url.replace(/\/?$/, '/') + 'index.m3u8') : ''

  useEffect(() => {
    if (!src) return
    const video = videoRef.current
    if (!video) return
    let hls: Hls | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const start = () => {
      if (cancelled) return
      if (Hls.isSupported()) {
        hls = new Hls({ liveSyncDurationCount: 2, manifestLoadingRetryDelay: 3000 })
        hls.loadSource(src)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setConnected(true)
          video.play().catch(() => { })
        })
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            hls?.destroy()
            hls = null
            setConnected(false)
            retryTimer = setTimeout(start, 5000)
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src
        setConnected(true)
        video.play().catch(() => { })
      }
    }
    start()
    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      hls?.destroy()
    }
  }, [src])

  return (
    <section
      className="shrink-0 mx-auto rounded-[14px] overflow-hidden relative shadow-sm"
      style={{
        width: '1000px',
        height: '456px',
        background: '#dfe3ee',
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        poster="/cctv-placeholder.png"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#000' }}
      />
      {/* 실시간 도로영상 Badge Overlay */}
      <div
        className="absolute top-[16px] left-[16px] flex items-center justify-center gap-2"
        style={{
          width: '197px',
          height: '43px',
          background: 'rgba(255, 255, 255, 0.9)',
          borderRadius: '8px',
          boxSizing: 'border-box',
          padding: '0 12px',
        }}
      >
        <Video size={18} className="text-[#25304E]" style={{ fill: '#25304E' }} />
        <span style={{ fontSize: '19px', fontWeight: 600, color: '#25304E', lineHeight: '19px' }}>
          실시간 도로영상
        </span>
      </div>

      {!connected && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: 'url(/cctv-placeholder.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            pointerEvents: 'none',
          }}
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px]" />
          <span className="relative z-10 font-semibold" style={{ fontSize: '24px', color: '#FFF' }}>
            실시간 도로영상 연결 중…
          </span>
        </div>
      )}
    </section>
  )
}

// ─── Soon Arriving ────────────────────────────────────────────────────────────
function SoonArriving({ arrivals }: { arrivals: BusArrival[] }) {
  const th = T()
  const soon = arrivals.filter(isSoonArriving)

  return (
    <section
      className="shrink-0 flex items-center gap-4 px-8"
      style={{ background: th.soonBg, borderBottom: `1px solid ${th.soonBorder}`, height: '5vh', minHeight: '60px' }}
    >
      <div className="flex items-center gap-2.5 shrink-0">
        <span className="relative flex h-4 w-4">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ background: th.point }}
          />
          <span className="relative inline-flex rounded-full h-4 w-4" style={{ background: th.point }} />
        </span>
        <span className="font-black tracking-wide whitespace-nowrap" style={{ color: th.point, fontSize: '17px' }}>
          잠시 후 도착
        </span>
      </div>

      <div className="w-px self-stretch my-2" style={{ background: th.divider }} />

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
                  fontSize: '18px',
                } : {
                  background: `${style.bg}28`,
                  borderColor: style.bg,
                  color: style.bg,
                  fontSize: '18px',
                }}
              >
                {displayNo}
              </span>
            )
          })
        ) : (
          <span className="font-medium" style={{ color: th.muted, fontSize: '0.95rem' }}>
            3분 이내 도착 예정 버스 없음
          </span>
        )}
      </div>
    </section>
  )
}

// ─── Column Labels ────────────────────────────────────────────────────────────
// Figma 디자인에 따라 ColumnLabels는 사용되지 않으므로 null을 반환합니다.
function ColumnLabels() {
  return null
}

const VIA_STOPS_FALLBACK: Record<string, string> = {
  '10A': '강화군청 · 수문면',
  '19': '강화터미널',
  '21A': '강화터미널 · 수문면',
  '24': '강화문화원, 종합전시관',
  '901-1': '역사고등학교 (강화읍교회)',
  '45': '수협앞 · 강화버스터미널',
  '37': '강화읍사무소 · 고려산입구',
  '48': '양도면사무소 · 용정리',
  '26': '생설미 · 내리',
  '57': '장안말 · 온천스파입구',
  '25': '인화리 · 선원면사무소',
  '13': '강화터미널 방면',
  '62': '강화종합전시관 방면',
  '10': '강화군청 · 수문면',
  '31A': '강화터미널 방면',
  '39': '강화읍사무소 방면',
  '32': '강화문화원 방면',
  '54': '강화군청 방면'
}

// ─── Bus Row ──────────────────────────────────────────────────────────────────
function BusRow({ arrival }: { arrival: BusArrival }) {
  const th = T()
  const sec = arrival.arrivalSec
  const hasEta = sec != null
  const mins = hasEta ? Math.floor(sec / 60) : 0

  // 곧 도착 판정: 2분 이하 또는 1정류장 전
  const isImmediate = (hasEta && sec <= 120) || arrival.restStopCount <= 1

  const cleanNo = arrival.routeNo.replace(/\s*\(.*?\)\s*/g, '').trim()

  // 마을버스(routeType '6') 여부 판단
  const isTownBus = arrival.routeType === '6' || cleanNo === '901-1'
  const routeColor = isTownBus ? th.busTown : th.busGreen

  // 방향 (Figma: 중앙시장 방면)
  const dirText = arrival.destination ? `${arrival.destination} 방면` : '중앙시장 방면'

  // 경유지 텍스트
  const viaText = arrival.viaStopsText || VIA_STOPS_FALLBACK[cleanNo] || (arrival.latestStopName ? `${arrival.latestStopName} 방면` : '강화군 인근')

  return (
    <div
      className="flex items-center justify-between relative transition-all duration-200"
      style={{
        height: '120px',
        background: isImmediate ? th.soonBg : 'transparent',
        boxSizing: 'border-box',
        padding: '0 32px',
      }}
    >
      {/* 곧 도착 시 세로 파란 선 */}
      {isImmediate && (
        <div
          className="absolute left-0 top-0 bottom-0"
          style={{ width: '4px', background: th.primary }}
        />
      )}

      {/* 왼쪽: 버스 번호 */}
      <div className="flex items-center gap-4" style={{ width: '210px', flexShrink: 0 }}>
        <img src="/bus-icon.png" alt="" width={36} height={48} className="shrink-0 object-contain" style={{ filter: isTownBus ? 'hue-rotate(30deg) saturate(1.3)' : 'none' }} />
        <span
          className="font-bold tracking-tighter"
          style={{ fontSize: '50px', color: routeColor, lineHeight: '50px' }}
        >
          {cleanNo}
        </span>
        {isTownBus && (
          <span
            className="flex items-center justify-center font-semibold shrink-0"
            style={{
              background: '#52C546',
              borderRadius: '12px',
              width: '48px',
              height: '24px',
              fontSize: '16px',
              color: '#FCFCFD',
            }}
          >
            마을
          </span>
        )}
      </div>

      {/* 중간: 방향 및 경유지 */}
      <div className="flex-1 flex flex-col justify-center ml-12 gap-1">
        <span
          className="font-semibold"
          style={{ fontSize: '26px', color: th.text, letterSpacing: '-0.02em', lineHeight: '30px' }}
        >
          {dirText}
        </span>
        <span
          className="font-medium"
          style={{ fontSize: '22px', color: th.muted, letterSpacing: '0.05em', lineHeight: '26px' }}
        >
          {viaText}
        </span>
      </div>

      {/* 오른쪽: 도착 시간 및 남은 정류장 */}
      <div className="shrink-0 flex items-center justify-end">
        {isImmediate ? (
          <div className="flex items-center gap-4">
            <span
              className="flex items-center justify-center font-bold"
              style={{
                background: th.primary,
                borderRadius: '17.5px',
                width: '92px',
                height: '35px',
                fontSize: '20px',
                color: '#FFFFFF',
                letterSpacing: '0.4px',
              }}
            >
              곧 도착
            </span>
            <span
              className="font-semibold"
              style={{ fontSize: '20px', color: th.muted, letterSpacing: '0.05em' }}
            >
              {arrival.restStopCount}정류장 전
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <span
              className="font-semibold"
              style={{ fontSize: '35px', color: th.text, letterSpacing: '-0.02em', lineHeight: '35px' }}
            >
              {hasEta ? `${mins}분` : '정보없음'}
            </span>
            <span
              className="font-medium"
              style={{ fontSize: '16px', color: th.muted, letterSpacing: '0.05em', lineHeight: '20px' }}
            >
              {hasEta ? `${arrival.restStopCount}정류장 전` : '정보없음'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main List ────────────────────────────────────────────────────────────────
function MainList({ arrivals, serviceEnded }: { arrivals: BusArrival[]; serviceEnded: boolean }) {
  const th = T()
  const [page, setPage] = useState(0)
  const itemsPerPage = 5

  useEffect(() => {
    if (arrivals.length <= itemsPerPage) { setPage(0); return }
    const t = setInterval(() => {
      setPage(p => (p + 1) % Math.ceil(arrivals.length / itemsPerPage))
    }, 10000)
    return () => clearInterval(t)
  }, [arrivals.length])

  if (serviceEnded) {
    return (
      <section className="mx-auto rounded-[14px] overflow-hidden relative shadow-sm flex flex-col justify-center items-center"
        style={{
          width: '1004px',
          height: '687px',
          background: th.card,
          border: `3px solid ${th.border}`,
          boxSizing: 'border-box',
        }}
      >
        <span style={{ fontSize: '3rem', lineHeight: 1 }}>🌙</span>
        <span className="font-black tracking-tight mt-4" style={{ fontSize: '2.25rem', color: th.text }}>운행 종료</span>
        <span className="font-medium text-base mt-2" style={{ color: th.muted }}>금일 버스 운행이 모두 종료되었습니다</span>
      </section>
    )
  }

  const totalPages = Math.ceil(arrivals.length / itemsPerPage)
  const visible = arrivals.slice(page * itemsPerPage, (page + 1) * itemsPerPage)

  return (
    <section
      className="mx-auto rounded-[14px] overflow-hidden relative shadow-sm flex flex-col"
      style={{
        width: '1004px',
        height: '687px',
        background: th.card,
        border: `3px solid ${th.border}`,
        boxSizing: 'border-box',
      }}
    >
      {/* 버스 도착 정보 카드 헤더 */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          height: '68px',
          padding: '0 32px',
          borderBottom: `3px solid ${th.divider}`,
        }}
      >
        <span style={{ fontSize: '26px', fontWeight: 700, color: th.text, letterSpacing: '-0.05em', whiteSpace: 'pre' }}>
          {'버스  도착  정보'}
        </span>
        <span style={{ fontSize: '22px', fontWeight: 500, color: th.muted, letterSpacing: '-0.04em' }}>
          교통상황에 따라 도착시간이 달라질 수 있습니다.
        </span>
      </div>

      {/* 버스 노선 목록 */}
      <div className="flex-1 flex flex-col">
        {visible.map((arr, index) => (
          <div key={arr.id} style={{ display: 'flex', flexDirection: 'column' }}>
            <BusRow arrival={arr} />
            {index < visible.length - 1 && (
              <div style={{ height: '0px', borderBottom: `3px solid ${th.divider}` }} />
            )}
          </div>
        ))}
      </div>

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
  const total = useScenario ? activeBlocks.length : 1

  useEffect(() => { setIdx(0); setVisible(true) }, [scenario?.scenarioId])

  const advance = useCallback(() => {
    if (total <= 1) return
    setVisible(false)
    setTimeout(() => { setIdx(i => (i + 1) % total); setVisible(true) }, 400)
  }, [total])

  useEffect(() => {
    if (total <= 1) return
    const ms = useScenario ? (activeBlocks[idx % activeBlocks.length]?.displaySec ?? 5) * 1000 : 5000
    const t = setTimeout(advance, ms)
    return () => clearTimeout(t)
  }, [idx, advance, useScenario, total])

  if (useScenario) {
    const block = activeBlocks[idx % activeBlocks.length]
    return (
      <section className="w-full h-full rounded-[14px] overflow-hidden border shadow-sm"
        style={{ background: '#000', borderColor: th.border }}
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

  return (
    <section className="w-full h-full rounded-[14px] overflow-hidden flex items-center justify-center border shadow-sm"
      style={{ borderColor: th.border }}
    >
      <div className="w-full h-full transition-opacity duration-[400ms]"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <img src="/promo-placeholder.png" alt="강화군 홍보" className="w-full h-full object-cover" />
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
    <footer
      className="shrink-0 flex items-stretch rounded-2xl overflow-hidden border shadow-sm"
      style={{ margin: '0 32px 16px', borderColor: th.border, minHeight: '5vh' }}
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
  const [airQuality, setAirQuality] = useState<AirQualityData | null>(null)
  const [promoScenario, setPromoScenario] = useState<PromoScenario | null>(null)
  const [tickerText, setTickerText] = useState<string | null>(null)
  const [winSize, setWinSize] = useState<{ w: number; h: number } | null>(null)
  const [showDebugOverlay, setShowDebugOverlay] = useState(false)
  const [cctvUrl, setCctvUrl] = useState<string | null>(null)

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
      .then(json => {
        if (json.showDebugOverlay) setShowDebugOverlay(true)
        if (json.cctvUrl) setCctvUrl(json.cctvUrl)
      })
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
    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    const tryLoad = async () => {
      try {
        const r = await fetch(`${BRIDGE_URL}/api/air-quality`)
        const json = await r.json()
        if (cancelled) return
        if (json.data) {
          setAirQuality(json.data)
          pollTimer = setInterval(async () => {
            try {
              const r2 = await fetch(`${BRIDGE_URL}/api/air-quality`)
              const j2 = await r2.json()
              if (!cancelled && j2.data) setAirQuality(j2.data)
            } catch { /* noop */ }
          }, 30 * 60 * 1000)
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
    <div
      className="flex flex-col overflow-hidden mx-auto relative shadow-2xl"
      style={{
        width: '1080px',
        height: '1920px',
        background: th.bg,
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Header (로고, 미세먼지 정보, 날씨, 날짜/시간) */}
      <BitHeader now={now} weather={weather} airQuality={airQuality} />

      {/* Vector 1 (Horizontal Divider) */}
      <div className="w-[1080px] shrink-0" style={{ borderBottom: '3px solid #EBEDF3', height: '0px' }} />

      {/* 2. Stop Title Row (정류소 정보: Map Pin + 정류소명 + 방면 및 단축 ID) */}
      <div className="flex items-center shrink-0 w-full animate-fade-in" style={{ padding: '24px 40px', gap: '16px' }}>
        <MapPin size={44} className="text-[#165CFD] shrink-0" style={{ fill: 'rgba(22, 92, 253, 0.1)' }} />
        <span className="font-bold tracking-tight" style={{ fontSize: '54px', color: '#25304E', lineHeight: '60px' }}>
          {stopName ?? '강화군청'}
        </span>
        <span className="font-semibold" style={{ fontSize: '24px', color: '#7B8494', lineHeight: '50px', marginLeft: '12px' }}>
          중앙시장 방면 · 정류소 ID {shortBstopId ?? '43065'}
        </span>
      </div>

      {/* 3. 실시간 도로영상 (CCTV) */}
      <CctvView url={cctvUrl} />

      {/* Spacer / Gap */}
      <div className="shrink-0" style={{ height: '20px' }} />

      {/* 4. 버스 도착 정보 (Main List) */}
      <MainList arrivals={arrivals} serviceEnded={serviceEnded} />

      {/* Spacer / Gap */}
      <div className="shrink-0" style={{ height: '20px' }} />

      {/* 5. 홍보물 영역 (Promo Area) */}
      <div
        className="mx-auto rounded-[14px] overflow-hidden shadow-sm shrink-0 border border-gray-100"
        style={{ width: '1003px', height: '477px' }}
      >
        <PromoArea scenario={promoScenario} />
      </div>

      {/* LogPanel은 디버깅 오버레이로 하단에 오버레이 배치 */}
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
