'use strict'

const path = require('path')

function getResourcesPath() {
  try {
    const { app } = require('electron')
    if (app && app.isPackaged) return process.resourcesPath
  } catch {}
  return path.join(__dirname, '..')
}

require('dotenv').config({ path: path.join(getResourcesPath(), '.env') })

// ─── 기상청 격자 좌표 (강화군 강화읍) ──────────────────────────────────────────
const WEATHER_NX = 55
const WEATHER_NY = 124

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
 * 초단기실황 base_time: 매시 정각 자료, 40분에 제공
 * → 현재 분 < 40 이면 전 시간 정각 사용
 */
function getUltraNcstBaseDateTime() {
  const now = new Date()
  const min = now.getMinutes()
  let d = new Date(now)
  let h = now.getHours()
  if (min < 40) {
    h -= 1
    if (h < 0) {
      h = 23
      d = new Date(now.getTime() - 86400000)
    }
  }
  return { date: formatDate(d), time: formatHHMM(h) }
}

/**
 * 단기예보 base_time: 02, 05, 08, 11, 14, 17, 20, 23시 발표 (정시 10분 후 제공)
 * → 현재 시각보다 이전인 가장 최근 발표 시각 사용
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
 * 초단기실황: T1H(현재 기온), PTY(강수형태)
 * PTY: 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기
 */
async function fetchCurrentWeather() {
  const serviceKey = process.env.API_SERVICE_KEY
  const { date, time } = getUltraNcstBaseDateTime()
  const url =
    `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst` +
    `?serviceKey=${serviceKey}` +
    `&pageNo=1&numOfRows=10&dataType=JSON` +
    `&base_date=${date}&base_time=${time}` +
    `&nx=${WEATHER_NX}&ny=${WEATHER_NY}`

  const res = await fetch(url)
  const json = await res.json()
  const items = json?.response?.body?.items?.item ?? []

  const obs = {}
  for (const item of items) obs[item.category] = item.obsrValue

  return {
    temp: obs.T1H !== undefined ? parseFloat(obs.T1H) : null,
    pty: obs.PTY !== undefined ? parseInt(obs.PTY) : 0,
  }
}

/**
 * 단기예보: TMN(최저기온), TMX(최고기온), SKY(하늘상태)
 * SKY: 1=맑음, 3=구름많음, 4=흐림
 */
async function fetchDailyForecast() {
  const serviceKey = process.env.API_SERVICE_KEY
  const { date, time } = getVilageFcstBaseDateTime()
  const url =
    `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst` +
    `?serviceKey=${serviceKey}` +
    `&pageNo=1&numOfRows=300&dataType=JSON` +
    `&base_date=${date}&base_time=${time}` +
    `&nx=${WEATHER_NX}&ny=${WEATHER_NY}`

  const res = await fetch(url)
  const json = await res.json()
  const items = json?.response?.body?.items?.item ?? []

  const todayStr = formatDate(new Date())
  const nowHour = new Date().getHours()

  let minTemp = null
  let maxTemp = null
  let sky = null

  for (const item of items) {
    if (item.fcstDate !== todayStr) continue
    if (item.category === 'TMN') minTemp = parseFloat(item.fcstValue)
    if (item.category === 'TMX') maxTemp = parseFloat(item.fcstValue)
    // 현재 시각 이후 첫 번째 SKY 예보
    if (item.category === 'SKY' && sky === null) {
      const fcstHour = parseInt(item.fcstTime.slice(0, 2))
      if (fcstHour >= nowHour) sky = parseInt(item.fcstValue)
    }
  }

  return { minTemp, maxTemp, sky }
}

/**
 * 날씨 전체 조회
 * @returns {{ temp: number|null, minTemp: number|null, maxTemp: number|null, sky: number|null, pty: number }}
 */
async function fetchWeather() {
  const [current, forecast] = await Promise.all([
    fetchCurrentWeather(),
    fetchDailyForecast(),
  ])
  return {
    temp: current.temp,
    minTemp: forecast.minTemp,
    maxTemp: forecast.maxTemp,
    sky: forecast.sky,   // 1=맑음, 3=구름많음, 4=흐림
    pty: current.pty,    // 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기
  }
}

module.exports = { fetchWeather }
