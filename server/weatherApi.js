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

// ─── 기상청 격자 좌표 ──────────────────────────────────────────────────────────
const WEATHER_NX = 51
const WEATHER_NY = 130

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function formatHHMM(h, m = 0) {
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`
}

/**
 * 단기예보 base_time: 02, 05, 08, 11, 14, 17, 20, 23시 발표 (정시 10분 후 제공)
 */
function getVilageFcstBaseDateTime() {
  const BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()

  for (let i = BASE_HOURS.length - 1; i >= 0; i--) {
    const bh = BASE_HOURS[i]
    if (h > bh || (h === bh && m >= 10)) {
      return { date: formatDate(now), time: formatHHMM(bh) }
    }
  }
  // 00:00 ~ 02:09 → 전날 23:00 발표 사용
  const yesterday = new Date(now.getTime() - 86400000)
  return { date: formatDate(yesterday), time: '2300' }
}

/**
 * 단기예보 조회: TMP(현재기온), SKY(하늘상태), PTY(강수형태)
 * @returns {{ temp: number|null, sky: number|null, pty: number }}
 */
async function fetchWeather() {
  const serviceKey = process.env.API_SERVICE_KEY
  const { date, time } = getVilageFcstBaseDateTime()
  const url =
    `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst` +
    `?serviceKey=${serviceKey}` +
    `&pageNo=1&numOfRows=300&dataType=JSON` +
    `&base_date=${date}&base_time=${time}` +
    `&nx=${WEATHER_NX}&ny=${WEATHER_NY}`

  const logUrl = url.replace(/serviceKey=[^&]+/, 'serviceKey=***')
  console.log(`[Weather] 요청: ${logUrl}`)

  const res = await fetch(url)
  console.log(`[Weather] HTTP 상태: ${res.status}`)

  const json = await res.json()
  const resultCode = json?.response?.header?.resultCode
  const resultMsg  = json?.response?.header?.resultMsg
  console.log(`[Weather] 응답 헤더: resultCode=${resultCode}, resultMsg=${resultMsg}`)

  const items = json?.response?.body?.items?.item ?? []
  console.log(`[Weather] 수신 아이템 수: ${items.length}`)

  const todayStr = formatDate(new Date())
  const nowHHMM  = formatHHMM(new Date().getHours())
  console.log(`[Weather] 기준 날짜: ${todayStr}, 현재 시각(HHMM): ${nowHHMM}`)

  let temp = null
  let sky  = null
  let pty  = null

  for (const item of items) {
    if (item.fcstDate !== todayStr) continue
    if (item.fcstTime < nowHHMM) continue
    if (item.category === 'TMP' && temp === null) {
      temp = parseFloat(item.fcstValue)
      console.log(`[Weather] TMP(현재기온): ${item.fcstValue} (fcstTime=${item.fcstTime})`)
    }
    if (item.category === 'SKY' && sky === null) {
      sky = parseInt(item.fcstValue)
      console.log(`[Weather] SKY(하늘상태): ${item.fcstValue} (fcstTime=${item.fcstTime})`)
    }
    if (item.category === 'PTY' && pty === null) {
      pty = parseInt(item.fcstValue)
      console.log(`[Weather] PTY(강수형태): ${item.fcstValue} (fcstTime=${item.fcstTime})`)
    }
    if (temp !== null && sky !== null && pty !== null) break
  }

  const result = { temp, sky, pty: pty ?? 0 }
  console.log(`[Weather] 최종 결과:`, JSON.stringify(result))
  return result
}

module.exports = { fetchWeather }
