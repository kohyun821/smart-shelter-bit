// lib/api/bus.ts

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

/**
 * 1-1. 경유 정류소 목록 조회
 * 특정 노선이 경유하는 정류소의 ID, 순번, 명칭, 좌표 등을 조회한다.
 */
export async function getBusRouteSectionList(routeId: string, pageNo = 1, numOfRows = 100): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ROUTE_URL}/getBusRouteSectionList?serviceKey=${serviceKey}&routeId=${routeId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  return await response.text();
}

/**
 * 1-2. 노선정보항목 조회
 * 노선 ID로 첫차/막차 시각, 배차간격, 기점/종점 정보를 조회한다.
 */
export async function getBusRouteId(routeId: string, pageNo = 1, numOfRows = 10): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ROUTE_URL}/getBusRouteId?serviceKey=${serviceKey}&routeId=${routeId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  return await response.text();
}

/**
 * 1-3. 노선번호목록 조회
 * 노선 번호(문자열)로 해당 노선의 메타 정보를 조회한다.
 */
export async function getBusRouteNo(routeNo: string, pageNo = 1, numOfRows = 10): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ROUTE_URL}/getBusRouteNo?serviceKey=${serviceKey}&routeNo=${routeNo}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  return await response.text();
}

/**
 * 2-1. 버스도착정보 목록 조회
 * 특정 정류소를 경유하는 모든 노선의 도착 예정 버스 정보를 한 번에 조회한다.
 */
export async function getAllRouteBusArrivalList(bstopId: string, pageNo = 1, numOfRows = 100): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ARRIVAL_URL}/getAllRouteBusArrivalList?serviceKey=${serviceKey}&bstopId=${bstopId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  return await response.text();
}

/**
 * 2-2. 버스도착정보 항목 조회
 * 특정 정류소 + 특정 노선 조합으로 도착 예정 버스 정보를 조회한다.
 */
export async function getBusArrivalList(bstopId: string, routeId: string, pageNo = 1, numOfRows = 10): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_ARRIVAL_URL}/getBusArrivalList?serviceKey=${serviceKey}&bstopId=${bstopId}&routeId=${routeId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  return await response.text();
}

/**
 * 3-1. 버스위치정보 목록 조회
 * 특정 노선에서 현재 운행 중인 차량들의 위치 정보를 조회한다.
 */
export async function getBusRouteLocation(routeId: string, pageNo = 1, numOfRows = 100): Promise<string> {
  const serviceKey = getServiceKey();
  const url = `${BASE_LOCATION_URL}/getBusRouteLocation?serviceKey=${serviceKey}&routeId=${routeId}&pageNo=${pageNo}&numOfRows=${numOfRows}`;
  
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  
  return await response.text();
}
