'use strict'

const fs = require('fs/promises')
const path = require('path')

// ─── File Paths ───────────────────────────────────────────────────────────────
// 개발(Electron dev / standalone node): 프로젝트 루트의 data/
// 프로덕션(패키징):  app.isPackaged === true → extraResources의 resources/data/

function getDataDir() {
  try {
    const { app } = require('electron')
    if (app && app.isPackaged) {
      return path.join(process.resourcesPath, 'data')
    }
  } catch {
    // standalone node process (e.g. node server/bridge.js)
  }
  return path.resolve(__dirname, '..', 'data')
}

const DATA_DIR = getDataDir()

const STATIONS_FILE = path.join(DATA_DIR, 'stations.json')
const FACILITIES_FILE = path.join(DATA_DIR, 'facilities.json')
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json')

// ─── Standard Response Wrapper ────────────────────────────────────────────────

function ok(data) {
  return { resultCd: '200', resultMsg: 'Success', resultDesc: 'OK', data }
}

function err(msg) {
  return { resultCd: '500', resultMsg: 'Error', resultDesc: msg, data: null }
}

// ─── Stations ─────────────────────────────────────────────────────────────────

/**
 * Read all stations from data/stations.json.
 * @returns {Promise<Array>}
 */
async function readStations() {
  const raw = await fs.readFile(STATIONS_FILE, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Write a new stations array to data/stations.json.
 * @param {Array} stations
 */
async function writeStations(stations) {
  await fs.writeFile(STATIONS_FILE, JSON.stringify(stations, null, 2), 'utf-8')
}

// ─── Facilities ───────────────────────────────────────────────────────────────

/**
 * Read all facilities from data/facilities.json.
 * @returns {Promise<Array>}
 */
async function readFacilities() {
  const raw = await fs.readFile(FACILITIES_FILE, 'utf-8')
  return JSON.parse(raw)
}

/**
 * Write a new facilities array to data/facilities.json.
 * @param {Array} facilities
 */
async function writeFacilities(facilities) {
  await fs.writeFile(FACILITIES_FILE, JSON.stringify(facilities, null, 2), 'utf-8')
}

// ─── Control Logic ────────────────────────────────────────────────────────────

// Recognized facilityOptCode values (all lowercase, as stored in JSON)
const KNOWN_OPT_CODES = new Set(['power', 'mode', 'wind', 'temp'])

/**
 * Apply a control command to a single facility and persist the result.
 *
 * The `facilityOpt` array may contain:
 *   { control: "power",     value: "true" | "false" }           — all facility types
 *   { control: "mode",      value: "cooler" | "heater" | ... }  — AC only
 *   { control: "wind_mode", value: "strong" | "medium" | ... }  — AC only
 *   { control: "set_temp",  value: "18"–"30"                 }  — AC only
 *
 * facilityStatus는 시설물의 사용 유무(use_yn)를 나타내며 전원 상태와 무관합니다.
 *
 * @param {string} stationId
 * @param {string} facilityId
 * @param {Array<{control: string, value: string}>} facilityOpt
 * @returns {Promise<object>} Standard response wrapper
 */
async function applyControl(stationId, facilityId, facilityOpt) {
  const facilities = await readFacilities()

  const idx = facilities.findIndex((f) => f.facilityId === facilityId)

  if (idx === -1) {
    return err(`Facility not found: facilityId=${facilityId}`)
  }

  // Deep-clone opt list so we can mutate safely
  const facility = {
    ...facilities[idx],
    facilityOptList: facilities[idx].facilityOptList.map((o) => ({ ...o })),
  }

  for (const { control, value } of facilityOpt) {
    const code = control.toLowerCase()

    if (!KNOWN_OPT_CODES.has(code)) {
      console.warn(`[DataStore] Unknown control code: ${control}`)
      continue
    }

    // Upsert the opt entry in facilityOptList
    const existing = facility.facilityOptList.findIndex((o) => o.facilityOptCode === code)
    if (existing !== -1) {
      facility.facilityOptList[existing].facilityOptValue = value
    } else {
      facility.facilityOptList.push({ facilityOptCode: code, facilityOptValue: value })
    }
  }

  facilities[idx] = facility
  await writeFacilities(facilities)

  return ok(null)
}

// ─── API Response Builders ────────────────────────────────────────────────────

/**
 * Build a GET /List response from the JSON file.
 * @returns {Promise<object>}
 */
async function getStationListResponse() {
  const data = await readStations()
  return ok(data)
}

/**
 * Build a GET /Status response.
 * stationId and ip are read from stations.json and attached to each facility.
 * Optional stationId filters to a matching station; returns [] if not found.
 * @param {string} [stationId]
 * @returns {Promise<object>}
 */
async function getFacilityStatusResponse(stationId) {
  const [facilities, stations] = await Promise.all([readFacilities(), readStations()])

  const station = stationId
    ? stations.find((s) => s.stationId === stationId)
    : stations[0]

  if (!station) return ok([])

  const data = facilities.map((f) => ({
    facilityId: f.facilityId,
    stationId: station.stationId,
    facilityNm: f.facilityNm,
    facilityType: f.facilityType,
    facilityStatus: f.facilityStatus,
    ip: station.ip,
    facilityOptList: f.facilityOptList,
  }))

  return ok(data)
}

// ─── Schedules ────────────────────────────────────────────────────────────────

/**
 * Read all schedules from data/schedules.json.
 * Returns [] gracefully if the file does not exist yet.
 * @returns {Promise<Array>}
 */
async function readSchedules() {
  try {
    const raw = await fs.readFile(SCHEDULES_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

/**
 * Write a new schedules array to data/schedules.json.
 * @param {Array} schedules
 */
async function writeSchedules(schedules) {
  await fs.writeFile(SCHEDULES_FILE, JSON.stringify(schedules, null, 2), 'utf-8')
}

/**
 * Build a GET /Schedule response.
 * Optional stationId filters to that station's schedules.
 * @param {string} [stationId]
 * @returns {Promise<object>}
 */
async function getSchedulesResponse(stationId) {
  const all = await readSchedules()
  const data = stationId ? all.filter((s) => s.stationId === stationId) : all
  return ok(data)
}

/**
 * Add a new schedule entry.
 * @param {object} schedule  – { facilityId, stationId, action, value, executeTime, isActive }
 * @returns {Promise<object>}
 */
async function addSchedule(schedule) {
  const schedules = await readSchedules()
  const newEntry = {
    scheduleId: `sch_${Date.now()}`,
    ...schedule,
    isActive: schedule.isActive ?? true,
  }
  schedules.push(newEntry)
  await writeSchedules(schedules)
  return ok(newEntry)
}

/**
 * Update fields on an existing schedule.
 * @param {string} scheduleId
 * @param {object} updates
 * @returns {Promise<object>}
 */
async function updateSchedule(scheduleId, updates) {
  const schedules = await readSchedules()
  const idx = schedules.findIndex((s) => s.scheduleId === scheduleId)
  if (idx === -1) return err(`Schedule not found: ${scheduleId}`)
  schedules[idx] = { ...schedules[idx], ...updates }
  await writeSchedules(schedules)
  return ok(schedules[idx])
}

/**
 * Delete a schedule by ID.
 * @param {string} scheduleId
 * @returns {Promise<object>}
 */
async function deleteSchedule(scheduleId) {
  const schedules = await readSchedules()
  const idx = schedules.findIndex((s) => s.scheduleId === scheduleId)
  if (idx === -1) return err(`Schedule not found: ${scheduleId}`)
  schedules.splice(idx, 1)
  await writeSchedules(schedules)
  return ok(null)
}

module.exports = {
  readStations,
  writeStations,
  readFacilities,
  writeFacilities,
  applyControl,
  getStationListResponse,
  getFacilityStatusResponse,
  readSchedules,
  writeSchedules,
  getSchedulesResponse,
  addSchedule,
  updateSchedule,
  deleteSchedule,
}
