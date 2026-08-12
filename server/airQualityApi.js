'use strict'

const path = require('path')

function getResourcesPath() {
  try {
    const { app } = require('electron')
    if (app && app.isPackaged) return process.resourcesPath
  } catch { }
  return path.join(__dirname, '..')
}

require('dotenv').config({ path: path.join(getResourcesPath(), '.env') })

// 측정소명: .env의 AIRQUALITY_STATION_NAME 또는 기본값 '강화'
const STATION_NAME = process.env.AIRQUALITY_STATION_NAME || '강화'

// ─── 등급 변환 헬퍼 ────────────────────────────────────────────────────────────

function gradeText(grade) {
  const g = parseInt(grade)
  if (g === 1) return '좋음'
  if (g === 2) return '보통'
  if (g === 3) return '나쁨'
  if (g === 4) return '매우나쁨'
  return '-'
}

function gradeColor(grade) {
  const g = parseInt(grade)
  if (g === 1) return '#165CFD'  // 좋음: 파랑
  if (g === 2) return '#00C853'  // 보통: 초록
  if (g === 3) return '#FFC300'  // 나쁨: 노랑
  if (g === 4) return '#FF0004'  // 매우나쁨: 빨강
  return '#9E9E9E'               // 알 수 없음: 회색
}

/**
 * 에어코리아 측정소별 실시간 대기질 조회
 * @returns {{ pm10Value, pm10Grade, pm10GradeText, pm10GradeColor,
 *             pm25Value, pm25Grade, pm25GradeText, pm25GradeColor,
 *             o3Value, o3Grade, o3GradeText, o3GradeColor,
 *             dataTime, stationName } | null}
 */
async function fetchAirQuality() {
  const serviceKey = process.env.AIR_SERVICE_KEY || process.env.API_SERVICE_KEY
  const url =
    `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty` +
    `?serviceKey=${serviceKey}` +
    `&returnType=json` +
    `&numOfRows=1&pageNo=1` +
    `&stationName=${encodeURIComponent(STATION_NAME)}` +
    `&dataTerm=DAILY` +
    `&ver=1.0`

  const logUrl = url.replace(/serviceKey=[^&]+/, 'serviceKey=***')
  console.log(`[AirQuality] 요청: ${logUrl}`)

  const res = await fetch(url)
  console.log(`[AirQuality] HTTP 상태: ${res.status}`)

  const json = await res.json()
  const resultCode = json?.response?.header?.resultCode
  const resultMsg  = json?.response?.header?.resultMsg
  console.log(`[AirQuality] 응답: resultCode=${resultCode}, resultMsg=${resultMsg}`)

  const items = json?.response?.body?.items ?? []
  if (!items.length) {
    console.warn('[AirQuality] 측정 데이터 없음')
    return null
  }

  const item = items[0]

  const num = (v) => (v && v !== '-' ? parseFloat(v) : null)

  const result = {
    pm10Value:      num(item.pm10Value),
    pm10Grade:      parseInt(item.pm10Grade) || null,
    pm10GradeText:  gradeText(item.pm10Grade),
    pm10GradeColor: gradeColor(item.pm10Grade),
    pm25Value:      num(item.pm25Value),
    pm25Grade:      parseInt(item.pm25Grade) || null,
    pm25GradeText:  gradeText(item.pm25Grade),
    pm25GradeColor: gradeColor(item.pm25Grade),
    o3Value:        num(item.o3Value),
    o3Grade:        parseInt(item.o3Grade) || null,
    o3GradeText:    gradeText(item.o3Grade),
    o3GradeColor:   gradeColor(item.o3Grade),
    dataTime:       item.dataTime ?? null,
    stationName:    STATION_NAME,
  }

  console.log(`[AirQuality] 결과: PM10=${result.pm10Value}(${result.pm10GradeText}), PM2.5=${result.pm25Value}(${result.pm25GradeText}), O3=${result.o3Value}(${result.o3GradeText})`)
  return result
}

module.exports = { fetchAirQuality }
