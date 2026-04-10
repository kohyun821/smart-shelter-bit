// lib/api/bus.ts

const BASE_STATION_URL = 'http://apis.data.go.kr/6280000/busStationService';
const BASE_ROUTE_URL = 'http://apis.data.go.kr/6280000/busRouteService';
const BASE_ARRIVAL_URL = 'http://apis.data.go.kr/6280000/busArrivalService';
const BASE_LOCATION_URL = 'http://apis.data.go.kr/6280000/busLocationService';

/**
 * .env에 설정된 공공데이터포털 API 서비스 키를 반환합니다.
 * Next.js 환경에서 NEXT_PUBLIC_ 이 붙지 않은 환경변수는 서버사이드에서만 접근 가능합니다.
 * 따라서 이 함수를 포함하는 API 호출은 API Route Handler, Server Components, 혹은 Server Actions에서 실행되어야 합니다.
 */
function getServiceKey(): string {
  const key = process.env.API_SERVICE_KEY;
  if (!key) {
    throw new Error('API_SERVICE_KEY가 .env 파일에 설정되지 않았습니다.');
  }
  return key;
}

// ==========================================
// 1. 정류소 조회 - BusStationService (Step 1)
// ==========================================

/**
 * 1-1. 정류소경유노선 목록 조회
 * 해당 정류소를 경유하는 모든 노선의 ID, 노선명, 정류소 순번, 방향, 종점 정보를 조회한다.
 */
export async function getBusStationViaRouteList(bstopId: string, pageNo = 1, numOfRows = 100): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_STATION_URL}/getBusStationViaRouteList?serviceKey=${serviceKey}&bstopId=${bstopId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

/**
 * 1-2. 정류소명목록 조회
 * 정류소 명칭으로 BSTOPID를 역조회할 때 사용한다.
 */
export async function getBusStationNmList(bstopNm: string, pageNo = 1, numOfRows = 10): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_STATION_URL}/getBusStationNmList?serviceKey=${serviceKey}&bstopNm=${bstopNm}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

/**
 * 1-3. 정류소번호목록 조회
 * 정류소 ID로 해당 정류소의 상세 정보를 조회한다.
 */
export async function getBusStationIdList(bstopId: string, pageNo = 1, numOfRows = 1): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_STATION_URL}/getBusStationIdList?serviceKey=${serviceKey}&bstopId=${bstopId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

/**
 * 1-4. 주변정류소 목록 조회
 * 위도/경도 좌표 기준 반경 500m 이내의 정류소 목록을 조회한다.
 */
export async function getBusStationAroundList(LAT: string | number, LNG: string | number, pageNo = 1, numOfRows = 10): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_STATION_URL}/getBusStationAroundList?serviceKey=${serviceKey}&LAT=${LAT}&LNG=${LNG}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

// ==========================================
// 2. 버스노선 조회 - BusRouteService (Step 2)
// ==========================================

/**
 * 2-1. 경유 정류소 목록 조회
 * 특정 노선의 전체 정류소 목록과 순번을 조회한다.
 */
export async function getBusRouteSectionList(routeId: string, pageNo = 1, numOfRows = 100): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ROUTE_URL}/getBusRouteSectionList?serviceKey=${serviceKey}&routeId=${routeId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

/**
 * 2-2. 노선정보항목 조회
 * 노선의 첫차/막차 시각, 배차간격, 기점/종점 정보를 조회한다.
 */
export async function getBusRouteId(routeId: string, pageNo = 1, numOfRows = 10): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ROUTE_URL}/getBusRouteId?serviceKey=${serviceKey}&routeId=${routeId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

/**
 * 2-3. 노선번호목록 조회
 * 노선 번호 문자열로 ROUTEID를 역조회할 때 사용한다.
 */
export async function getBusRouteNo(routeNo: string, pageNo = 1, numOfRows = 10): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ROUTE_URL}/getBusRouteNo?serviceKey=${serviceKey}&routeNo=${routeNo}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

// ==========================================
// 3. 도착정보 조회 - BusArrivalService (Step 3)
// ==========================================

/**
 * 3-1. 버스도착정보 목록 조회
 * 정류소를 경유하는 모든 노선의 실시간 도착 정보를 한 번에 조회한다.
 */
export async function getAllRouteBusArrivalList(bstopId: string, pageNo = 1, numOfRows = 100): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ARRIVAL_URL}/getAllRouteBusArrivalList?serviceKey=${serviceKey}&bstopId=${bstopId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

/**
 * 3-2. 버스도착정보 항목 조회
 * 특정 정류소 + 특정 노선 조합의 도착 정보를 조회한다.
 */
export async function getBusArrivalList(bstopId: string, routeId: string, pageNo = 1, numOfRows = 10): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ARRIVAL_URL}/getBusArrivalList?serviceKey=${serviceKey}&bstopId=${bstopId}&routeId=${routeId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}

// ==========================================
// 4. 버스위치정보 조회 - BusLocationService (Step 3)
// ==========================================

/**
 * 4-1. 버스위치정보 목록 조회
 * 특정 노선의 운행 중인 차량 위치 정보를 조회한다.
 */
export async function getBusRouteLocation(routeId: string, pageNo = 1, numOfRows = 100): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_LOCATION_URL}/getBusRouteLocation?serviceKey=${serviceKey}&routeId=${routeId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

  return await response.text();
}
