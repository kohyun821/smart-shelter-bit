'use strict'

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

const fs = require('fs')
const path = require('path')

// ─── Base URLs (lib/api/bus.ts와 동일하게 유지) ───────────────────────────────

const BASE_STATION_URL = 'http://apis.data.go.kr/6280000/busStationService'
const BASE_ROUTE_URL   = 'http://apis.data.go.kr/6280000/busRouteService'
const BASE_ARRIVAL_URL = 'http://apis.data.go.kr/6280000/busArrivalService'

// ─── In-memory cache ──────────────────────────────────────────────────────────

/** @type {Array|null} 경유 노선 목록 캐시 */
let viaRouteCache = null

/** @type {string|null} 정류소 명칭 (BSTOPNM) */
let bstopNmCache = null

/** @type {string|null} 단축 정류소 ID (SHORT_BSTOPID) */
let shortBstopIdCache = null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getServiceKey() {
  const key = process.env.API_SERVICE_KEY
  if (!key) throw new Error('API_SERVICE_KEY가 .env 파일에 설정되지 않았습니다.')
  return key
}

/**
 * data/setting.json에서 bus_stop_id를 읽어 반환합니다.
 * @returns {string}
 */
function loadBusStopId() {
  const filePath = path.join(__dirname, '..', 'data', 'setting.json')
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(raw)
    if (Array.isArray(json) && json.length > 0 && json[0].bus_stop_id) {
      return String(json[0].bus_stop_id)
    }
  } catch (err) {
    console.warn('[BusApi] setting.json 읽기 실패:', err.message)
  }
  throw new Error('[BusApi] bus_stop_id가 data/setting.json에 없습니다')
}

// ─── XML 파싱 (lib/api/bus.ts는 raw string 반환 → 여기서 구조화) ──────────────

/**
 * XML에서 단일 태그 값을 추출합니다.
 * @param {string} xml
 * @param {string} tag
 * @returns {string}
 */
function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))
  return m ? m[1].trim() : ''
}

/**
 * XML에서 <itemList>...</itemList> 블록을 배열로 추출합니다.
 * @param {string} xml
 * @returns {string[]}
 */
function extractItemLists(xml) {
  const blocks = []
  const re = /<itemList>([\s\S]*?)<\/itemList>/g
  let m
  while ((m = re.exec(xml)) !== null) blocks.push(m[1])
  return blocks
}

const ROUTE_FIELDS = [
  'BSTOPID', 'BSTOPNM', 'ROUTEID', 'ROUTENO',
  'PATHSEQ', 'BSTOPSEQ', 'DIRCD', 'ROUTETPCD',
  'DEST_BSTOPID', 'DESTINATION',
]

const SECTION_FIELDS = ['BSTOPID', 'BSTOPNM', 'PATHSEQ', 'BSTOPSEQ', 'DIRCD']

const ROUTE_ID_FIELDS = ['ROUTEID', 'ROUTENO', 'FBUS_DEPHMS', 'LBUS_DEPHMS']

function parseXml(xml, fields) {
  const resultCode = extractTag(xml, 'resultCode')
  if (resultCode !== '0') {
    const resultMsg = extractTag(xml, 'resultMsg')
    throw new Error(`API 오류 (code=${resultCode}): ${resultMsg}`)
  }
  return extractItemLists(xml).map(block => {
    const obj = {}
    for (const field of fields) obj[field] = extractTag(block, field)
    return obj
  })
}

// ─── API 호출 (lib/api/bus.ts의 getBusStationViaRouteList와 동일한 URL 구성) ──

/**
 * 정류소 경유 노선 목록 조회 — lib/api/bus.ts의 getBusStationViaRouteList에 대응.
 * lib/api/bus.ts는 raw XML string을 반환하지만, 여기서는 파싱 후 배열로 반환합니다.
 * @param {string} bstopId
 * @param {number} pageNo
 * @param {number} numOfRows
 * @returns {Promise<Array>}
 */
async function getBusStationViaRouteList(bstopId, pageNo = 1, numOfRows = 100) {
  const serviceKey = getServiceKey()
  const url = `${BASE_STATION_URL}/getBusStationViaRouteList?serviceKey=${serviceKey}&bstopId=${bstopId}&pageNo=${pageNo}&numOfRows=${numOfRows}`

  console.log(`[BusApi] ▶ GET getBusStationViaRouteList  bstopId=${bstopId}  pageNo=${pageNo}  numOfRows=${numOfRows}`)

  const t0 = Date.now()
  const response = await fetch(url)
  const elapsed = Date.now() - t0

  console.log(`[BusApi] ◀ HTTP ${response.status} (${elapsed}ms)`)
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

  const xml = await response.text()
  const routes = parseXml(xml, ROUTE_FIELDS)

  console.log(`[BusApi] ✔ 파싱 완료: ${routes.length}개 노선`)
  routes.forEach((r, i) => {
    const dir = r.DIRCD === '0' ? '상행' : r.DIRCD === '1' ? '하행' : '순환'
    console.log(`[BusApi]   [${String(i + 1).padStart(2)}] ${r.ROUTENO.padEnd(10)} ROUTEID=${r.ROUTEID}  PATHSEQ=${r.PATHSEQ}    BSTOPSEQ=${r.BSTOPSEQ}    방향=${dir}  종점=${r.DESTINATION}`)
  })

  return routes
}

// ─── getBusRouteSectionList ───────────────────────────────────────────────────

/**
 * 노선 전체 정류소 목록 조회 — lib/api/bus.ts의 getBusRouteSectionList에 대응.
 * 내 정류소(myBstopSeq) 이하의 정류소만 반환합니다.
 * @param {string} routeId
 * @param {number} myBstopSeq  내 정류소의 BSTOPSEQ (이 값 이하만 보존)
 * @param {number} numOfRows
 * @returns {Promise<Array>}
 */
async function getBusRouteSectionList(routeId, myBstopSeq, numOfRows = 500) {
  const serviceKey = getServiceKey()
  const url = `${BASE_ROUTE_URL}/getBusRouteSectionList?serviceKey=${serviceKey}&routeId=${routeId}&pageNo=1&numOfRows=${numOfRows}`

  console.log(`[BusApi]   ▶ GET getBusRouteSectionList  routeId=${routeId}  (myBstopSeq≤${myBstopSeq})`)

  const t0 = Date.now()
  const response = await fetch(url)
  const elapsed = Date.now() - t0

  console.log(`[BusApi]   ◀ HTTP ${response.status} (${elapsed}ms)`)
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

  const xml = await response.text()
  const allStops = parseXml(xml, SECTION_FIELDS)

  // 내 정류소(BSTOPSEQ) 이하만 보존
  const stops = allStops.filter(s => parseInt(s.BSTOPSEQ) <= myBstopSeq)

  console.log(`[BusApi]   ✔ 전체 ${allStops.length}개 정류소 → 내 정류소까지 ${stops.length}개 저장`)

  return stops
}

// ─── getBusRouteId ────────────────────────────────────────────────────────────

/**
 * 노선 첫차/막차 시각 조회 — FBUS_DEPHMS, LBUS_DEPHMS (hhmm 4자리)
 * @param {string} routeId
 * @returns {Promise<{ROUTEID:string, ROUTENO:string, FBUS_DEPHMS:string, LBUS_DEPHMS:string}|null>}
 */
async function getBusRouteId(routeId) {
  const serviceKey = getServiceKey()
  const url = `${BASE_ROUTE_URL}/getBusRouteId?serviceKey=${serviceKey}&routeId=${routeId}&pageNo=1&numOfRows=1`

  console.log(`[BusApi]   ▶ GET getBusRouteId  routeId=${routeId}`)

  const t0 = Date.now()
  const response = await fetch(url)
  const elapsed = Date.now() - t0

  console.log(`[BusApi]   ◀ HTTP ${response.status} (${elapsed}ms)`)
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

  const xml = await response.text()
  const items = parseXml(xml, ROUTE_ID_FIELDS)
  return items[0] ?? null
}

// ─── getBusStationIdList ──────────────────────────────────────────────────────

/**
 * 정류소 ID로 정류소 상세 정보를 직접 조회합니다 — interface.md 1-3.
 * getBusStationNmList와 응답 필드 동일 (BSTOPID, BSTOPNM, SHORT_BSTOPID 등)
 * @param {string} bstopId
 * @returns {Promise<{BSTOPID:string, BSTOPNM:string, SHORT_BSTOPID:string}|null>}
 */
async function getBusStationIdList(bstopId) {
  const serviceKey = getServiceKey()
  const url = `${BASE_STATION_URL}/getBusStationIdList?serviceKey=${serviceKey}&bstopId=${bstopId}&pageNo=1&numOfRows=1`

  console.log(`[BusApi] ▶ GET getBusStationIdList  bstopId=${bstopId}`)

  const t0 = Date.now()
  const response = await fetch(url)
  const elapsed = Date.now() - t0

  console.log(`[BusApi] ◀ HTTP ${response.status} (${elapsed}ms)`)
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

  const xml = await response.text()
  const items = parseXml(xml, NM_LIST_FIELDS)
  return items[0] ?? null
}

// ─── getBusStationNmList ──────────────────────────────────────────────────────

const NM_LIST_FIELDS = ['BSTOPID', 'BSTOPNM', 'SHORT_BSTOPID']

/**
 * 정류소명으로 정류소 목록 조회 — lib/api/bus.ts의 getBusStationNmList에 대응.
 * @param {string} bstopNm 정류소 명칭 (부분 일치)
 * @param {number} numOfRows
 * @returns {Promise<Array>}
 */
async function getBusStationNmList(bstopNm, numOfRows = 255) {
  const serviceKey = getServiceKey()
  const url = `${BASE_STATION_URL}/getBusStationNmList?serviceKey=${serviceKey}&bstopNm=${encodeURIComponent(bstopNm)}&pageNo=1&numOfRows=${numOfRows}`

  console.log(`[BusApi] ▶ GET getBusStationNmList  bstopNm=${bstopNm}`)

  const t0 = Date.now()
  const response = await fetch(url)
  const elapsed = Date.now() - t0

  console.log(`[BusApi] ◀ HTTP ${response.status} (${elapsed}ms)`)
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

  const xml = await response.text()
  return parseXml(xml, NM_LIST_FIELDS)
}

// ─── getAllRouteBusArrivalList ────────────────────────────────────────────────

const ARRIVAL_FIELDS = [
  'ROUTEID', 'BUSID', 'ARRIVALESTIMATETIME', 'REST_STOP_COUNT',
  'LOW_TP_CD', 'LASTBUSYN', 'DIRCD', 'LATEST_STOP_ID', 'LATEST_STOP_NAME'
]

/**
 * 정류소 실시간 도착 정보 전체 조회 — lib/api/bus.ts의 getAllRouteBusArrivalList에 대응.
 * @param {string} bstopId
 * @returns {Promise<Array>}
 */
async function fetchAllRouteBusArrivalList(bstopId) {
  const serviceKey = getServiceKey()
  const url = `${BASE_ARRIVAL_URL}/getAllRouteBusArrivalList?serviceKey=${serviceKey}&bstopId=${bstopId}&pageNo=1&numOfRows=100`

  console.log(`[BusApi] ▶ GET getAllRouteBusArrivalList  bstopId=${bstopId}`)

  const t0 = Date.now()
  const response = await fetch(url)
  const elapsed = Date.now() - t0

  console.log(`[BusApi] ◀ HTTP ${response.status} (${elapsed}ms)`)
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

  const xml = await response.text()
  return parseXml(xml, ARRIVAL_FIELDS)
}

/**
 * 현재 운행 중인 ROUTEID Set만 반환합니다. (재시도 우선순위 결정용)
 * @param {string} bstopId
 * @returns {Promise<Set<string>>}
 */
async function fetchActiveRouteIds(bstopId) {
  const items = await fetchAllRouteBusArrivalList(bstopId)
  return new Set(items.map(i => i.ROUTEID).filter(Boolean))
}

// ─── 재시도 로직 ──────────────────────────────────────────────────────────────

// 재시도 간격 (ms): 5초 → 15초 → 30초 → 60초 → 120초
const RETRY_DELAYS = [5_000, 15_000, 30_000, 60_000, 120_000]

/**
 * 실패한 노선들의 정류소 목록을 백그라운드에서 순차 재시도합니다.
 * 성공한 노선은 즉시 viaRouteCache에 반영됩니다.
 * @param {Array} pending  재시도할 노선 목록
 * @param {number} attempt 현재 시도 횟수 (0-based)
 */
function scheduleRetry(pending, attempt = 0) {
  if (attempt >= RETRY_DELAYS.length) {
    console.warn(`[BusApi] ✖ 재시도 한계 도달 — 포기: ${pending.map(r => r.ROUTENO).join(', ')}`)
    return
  }

  const delaySec = RETRY_DELAYS[attempt] / 1000
  console.log(`[BusApi] ↻ ${pending.length}개 노선 재시도 예약 — ${delaySec}초 후 (${attempt + 1}/${RETRY_DELAYS.length}회차)`)

  setTimeout(async () => {
    // 재시도 직전 도착 정보 조회 → 현재 운행 중인 노선을 앞으로 정렬
    let ordered = [...pending]
    try {
      const bstopId = loadBusStopId()
      const activeIds = await fetchActiveRouteIds(bstopId)
      const active   = ordered.filter(r => activeIds.has(r.ROUTEID))
      const inactive = ordered.filter(r => !activeIds.has(r.ROUTEID))
      ordered = [...active, ...inactive]

      console.log(`[BusApi] ↻ 재시도 시작 (${attempt + 1}/${RETRY_DELAYS.length}회차) — 우선순위: [${active.map(r => r.ROUTENO).join(', ')}] 활성 / [${inactive.map(r => r.ROUTENO).join(', ')}] 비활성`)
    } catch (err) {
      console.warn(`[BusApi]   도착 정보 조회 실패, 우선순위 미적용: ${err.message}`)
      console.log(`[BusApi] ↻ 재시도 시작 (${attempt + 1}/${RETRY_DELAYS.length}회차): ${ordered.map(r => r.ROUTENO).join(', ')}`)
    }

    const stillFailed = []

    for (const route of ordered) {
      try {
        const myBstopSeq = parseInt(route.BSTOPSEQ)
        const stops = await getBusRouteSectionList(route.ROUTEID, myBstopSeq)

        // 캐시에서 해당 노선을 찾아 stops 업데이트
        if (viaRouteCache) {
          const idx = viaRouteCache.findIndex(r => r.ROUTEID === route.ROUTEID)
          if (idx !== -1) viaRouteCache[idx] = { ...viaRouteCache[idx], stops }
        }

        console.log(`[BusApi] ✔ 재시도 성공: 노선 ${route.ROUTENO}(${route.ROUTEID}) — ${stops.length}개 정류소 저장`)
      } catch (err) {
        console.warn(`[BusApi]   재시도 실패 (${attempt + 1}회차): 노선 ${route.ROUTENO}(${route.ROUTEID}) — ${err.message}`)
        stillFailed.push(route)
      }
    }

    if (stillFailed.length > 0) {
      scheduleRetry(stillFailed, attempt + 1)
    } else {
      console.log(`[BusApi] ✔ 모든 재시도 완료`)
    }
  }, RETRY_DELAYS[attempt])
}

// ─── 초기화 ───────────────────────────────────────────────────────────────────

/**
 * Step 0만 수행: BSTOPNM / SHORT_BSTOPID 캐시.
 * HTTP 서버를 열기 전에 await 하면 /api/bus/stop-name 경쟁(null 응답)을 막을 수 있습니다.
 */
async function initStopMetaOnly() {
  const bstopId = loadBusStopId()
  console.log(`[BusApi] Step 0: 정류소 메타 조회 (bus_stop_id=${bstopId})`)
  try {
    const stopInfo = await getBusStationIdList(bstopId)
    if (stopInfo) {
      bstopNmCache      = stopInfo.BSTOPNM       || null
      shortBstopIdCache = stopInfo.SHORT_BSTOPID || null
      console.log(`[BusApi] ✔ Step 0: BSTOPNM=${bstopNmCache}  SHORT_BSTOPID=${shortBstopIdCache}`)
    } else {
      console.warn(`[BusApi]   Step 0: 정류소 정보 없음 (bstopId=${bstopId})`)
    }
  } catch (err) {
    console.warn(`[BusApi]   Step 0 실패: ${err.message}`)
  }
}

/**
 * Step 1–3: 경유 노선·구간 캐시 + 막차 시각(백그라운드). 실패한 노선은 재시도 예약.
 */
async function initBusRoutesAndStops() {
  const bstopId = loadBusStopId()
  try {
    console.log(`[BusApi] Step 1–2: 경유 노선·정류소 캐시 초기화 (bus_stop_id=${bstopId})`)

    const routes = await getBusStationViaRouteList(bstopId)

    console.log(`[BusApi] Step 2: ${routes.length}개 노선 정류소 목록 조회 (순차)`)
    const routesWithStops = []
    const failed = []

    for (const route of routes) {
      try {
        const myBstopSeq = parseInt(route.BSTOPSEQ)
        const stops = await getBusRouteSectionList(route.ROUTEID, myBstopSeq)
        routesWithStops.push({ ...route, stops })
      } catch (err) {
        console.warn(`[BusApi]   노선 ${route.ROUTENO}(${route.ROUTEID}) 실패 → 재시도 예약: ${err.message}`)
        routesWithStops.push({ ...route, stops: [] })
        failed.push(route)
      }
    }

    viaRouteCache = routesWithStops
    console.log(`[BusApi] ✔ 기반 정보 초기화 완료: ${routesWithStops.length}개 노선 캐시 (실패 ${failed.length}개 재시도 예약)`)

    if (failed.length > 0) {
      scheduleRetry(failed)
    }

    ;(async () => {
      console.log(`[BusApi] Step 3: ${routesWithStops.length}개 노선 막차 시각 조회 시작`)
      for (const route of routesWithStops) {
        try {
          const info = await getBusRouteId(route.ROUTEID)
          if (info) {
            route.fbusDephms = info.FBUS_DEPHMS || ''
            route.lbusDephms = info.LBUS_DEPHMS || ''
            console.log(`[BusApi]   ✔ ${route.ROUTENO}: 첫차=${route.fbusDephms} 막차=${route.lbusDephms}`)
          } else {
            route.fbusDephms = ''
            route.lbusDephms = ''
          }
        } catch (err) {
          console.warn(`[BusApi]   ${route.ROUTENO}(${route.ROUTEID}) 막차 시각 조회 실패: ${err.message}`)
          route.fbusDephms = ''
          route.lbusDephms = ''
        }
      }
      console.log(`[BusApi] ✔ Step 3 완료`)
    })()
  } catch (err) {
    console.error('[BusApi] 경유 노선 초기화 실패:', err.message)
    viaRouteCache = []
  }
}

/**
 * 프로그램 시작 시 경유 노선 목록 + 각 노선의 내 정류소까지 정류소 목록을 초기화합니다.
 * 실패한 노선은 백그라운드에서 자동 재시도됩니다.
 */
async function initBusBaseInfo() {
  await initStopMetaOnly()
  await initBusRoutesAndStops()
}

/**
 * 캐시된 경유 노선 목록을 반환합니다.
 * @returns {Array|null} 초기화 전이면 null
 */
function getViaRouteCache() {
  return viaRouteCache
}

function getBstopNm() {
  return bstopNmCache
}

function getStopShortId() {
  return shortBstopIdCache
}

module.exports = {
  initBusBaseInfo,
  initStopMetaOnly,
  initBusRoutesAndStops,
  getBusStationIdList,
  getBusStationViaRouteList,
  getBusStationNmList,
  getBusRouteSectionList,
  fetchAllRouteBusArrivalList,
  getViaRouteCache,
  getBstopNm,
  getStopShortId,
  loadBusStopId,
}
