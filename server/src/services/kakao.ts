const KAKAO_MOBILITY_URL = "https://apis-navi.kakaomobility.com/v1/directions";
const TRANSIT_SPEED_KMH = 20;
const CAR_SPEED_KMH = 30; // 시내 평균 추정 속도(하버사인 폴백용)

export interface TravelEstimate {
  distanceM: number;
  durationMin: number;
  isEstimate: boolean; // true면 하버사인 추정치(16.5장 "추정값 표시" 원칙)
}

export interface EmbeddedRoute {
  mode: "TRANSIT" | "CAR";
  distanceM: number;
  durationMin: number;
  fare: number | null;
  transfers: number | null;
  steps: { guidance: string; durationMin: number; distanceM: number; vehicle: string | null }[];
  path: [number, number][];
  isEstimate: boolean;
  source: "KAKAO_MAP" | "KAKAO_MOBILITY" | "ESTIMATE";
  alternatives?: TransitAlternative[];
}

export interface TransitAlternative {
  id: string;
  label: string;
  distanceM: number;
  durationMin: number;
  fare: number | null;
  transfers: number | null;
  steps: { guidance: string; durationMin: number; distanceM: number; vehicle: string | null }[];
  path: [number, number][];
  isEstimate: boolean;
}

interface CacheEntry { value: TravelEstimate; expiresAt: number }
const travelCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5_000;

function cacheKey(lat1: number, lng1: number, lat2: number, lng2: number, hasCar: boolean) {
  return [hasCar ? "CAR" : "TRANSIT", lat1.toFixed(5), lng1.toFixed(5), lat2.toFixed(5), lng2.toFixed(5)].join(":");
}

function remember(key: string, value: TravelEstimate) {
  if (travelCache.size >= CACHE_MAX_ENTRIES) travelCache.delete(travelCache.keys().next().value as string);
  travelCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function haversineDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function fallbackEstimate(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  hasCar: boolean
): TravelEstimate {
  const distanceM = haversineDistanceM(lat1, lng1, lat2, lng2);
  const speedKmh = hasCar ? CAR_SPEED_KMH : TRANSIT_SPEED_KMH;
  const durationMin = Math.max(1, Math.round((distanceM / 1000 / speedKmh) * 60));
  return { distanceM: Math.round(distanceM), durationMin, isEstimate: true };
}

/**
 * 카카오모빌리티 자동차 길찾기 API 호출. 키가 없거나 호출 실패 시
 * 하버사인 거리 기반 추정치로 폴백한다(기획서 16.5장 원칙).
 */
export async function getTravelEstimate(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  hasCar: boolean
): Promise<TravelEstimate> {
  const key = cacheKey(lat1, lng1, lat2, lng2, hasCar);
  const cached = travelCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) travelCache.delete(key);
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey || !hasCar) {
    return remember(key, fallbackEstimate(lat1, lng1, lat2, lng2, hasCar));
  }

  try {
    const url = `${KAKAO_MOBILITY_URL}?origin=${lng1},${lat1}&destination=${lng2},${lat2}`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`kakao mobility http ${res.status}`);
    const data = (await res.json()) as any;
    const route = data?.routes?.[0];
    if (!route || route.result_code !== 0) throw new Error("no route");
    const summary = route.summary;
    return remember(key, {
      distanceM: summary.distance,
      durationMin: Math.max(1, Math.round(summary.duration / 60)),
      isEstimate: false,
    });
  } catch {
    return remember(key, fallbackEstimate(lat1, lng1, lat2, lng2, hasCar));
  }
}

export async function getEmbeddedRoute(lat1: number, lng1: number, lat2: number, lng2: number, mode: "TRANSIT" | "CAR"): Promise<EmbeddedRoute> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  const fallback = fallbackEstimate(lat1, lng1, lat2, lng2, mode === "CAR");
  const busMinutes = Math.max(12, Math.round(fallback.distanceM / 1000 / 18 * 60) + 8);
  const subwayMinutes = Math.max(15, Math.round(fallback.distanceM / 1000 / 32 * 60) + 12);
  const fallbackAlternatives: TransitAlternative[] = mode === "TRANSIT" ? [
    { id: "estimated-bus", label: "버스 중심 예상", distanceM: fallback.distanceM, durationMin: busMinutes, fare: 1550, transfers: 0, path: [[lng1, lat1], [lng2, lat2]], isEstimate: true, steps: [
      { guidance: "출발지에서 가까운 버스 정류장까지 도보 이동", durationMin: 5, distanceM: 350, vehicle: "도보" },
      { guidance: "목적지 방향 버스 탑승 구간", durationMin: Math.max(4, busMinutes - 9), distanceM: Math.max(0, fallback.distanceM - 650), vehicle: "버스 · 실제 노선은 데이터 연동 시 표시" },
      { guidance: "하차 후 목적지까지 도보 이동", durationMin: 4, distanceM: 300, vehicle: "도보" },
    ] },
    { id: "estimated-subway", label: "지하철 중심 예상", distanceM: fallback.distanceM, durationMin: subwayMinutes, fare: 1650, transfers: fallback.distanceM > 9000 ? 1 : 0, path: [[lng1, lat1], [lng2, lat2]], isEstimate: true, steps: [
      { guidance: "출발지에서 가까운 도시철도역까지 이동", durationMin: 7, distanceM: 500, vehicle: "도보 또는 버스" },
      { guidance: "목적지 인근 역 방향 지하철 탑승 구간", durationMin: Math.max(4, subwayMinutes - 12), distanceM: Math.max(0, fallback.distanceM - 900), vehicle: "지하철 · 실제 호선은 데이터 연동 시 표시" },
      { guidance: "역에서 목적지까지 도보 이동", durationMin: 5, distanceM: 400, vehicle: "도보" },
    ] },
  ] : [];
  const fallbackResult: EmbeddedRoute = {
    mode, distanceM: fallback.distanceM, durationMin: mode === "TRANSIT" ? Math.max(8, Math.round(fallback.durationMin * .55)) : fallback.durationMin,
    fare: null, transfers: null, steps: [{ guidance: mode === "TRANSIT" ? "대중교통 경로 데이터를 확인할 수 없어 예상 시간으로 표시합니다." : "자동차 경로 데이터를 확인할 수 없어 예상 시간으로 표시합니다.", durationMin: fallback.durationMin, distanceM: fallback.distanceM, vehicle: null }],
    path: [[lng1, lat1], [lng2, lat2]], isEstimate: true, source: "ESTIMATE", alternatives: fallbackAlternatives,
  };
  if (!apiKey) return fallbackResult;

  try {
    if (mode === "TRANSIT") {
      const query = new URLSearchParams({ start_x: String(lng1), start_y: String(lat1), end_x: String(lng2), end_y: String(lat2), input_coord: "WGS84", output_coord: "WGS84" });
      const response = await fetch(`https://dapi.kakao.com/v2/routing/publictraffic?${query}`, { headers: { Authorization: `KakaoAK ${apiKey}` }, signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error(`public traffic http ${response.status}`);
      const data = await response.json() as any;
      const route = data?.routes?.[0];
      if (data?.status !== "OK" || !route) throw new Error("no public route");
      const alternatives: TransitAlternative[] = (data.routes ?? []).slice(0, 5).map((candidate: any, index: number) => {
        const steps = (candidate.steps ?? []).map((step: any) => ({ guidance: step.properties?.guidance ?? "이동", durationMin: Math.max(1, Math.round((step.properties?.time ?? 0) / 60)), distanceM: step.properties?.distance ?? 0, vehicle: step.properties?.vehicles?.map((vehicle: any) => vehicle.name).filter(Boolean).join(", ") || null }));
        const path = (candidate.steps ?? []).flatMap((step: any) => step.path?.points ?? []) as [number, number][];
        const vehicles = steps.map((step: any) => step.vehicle ?? "").join(" ");
        const label = /지하철|도시철도|subway/i.test(vehicles) ? "지하철 경로" : /버스|bus/i.test(vehicles) ? "버스 경로" : `대중교통 경로 ${index + 1}`;
        return { id: `transit-${index + 1}`, label, distanceM: candidate.properties.totalDistance, durationMin: Math.max(1, Math.round(candidate.properties.totalTime / 60)), fare: candidate.properties.fare?.value ?? candidate.properties.fare?.min ?? null, transfers: candidate.properties.transfers ?? 0, steps, path: path.length ? path : fallbackResult.path, isEstimate: false };
      });
      const preferred = alternatives[0];
      return { mode, distanceM: preferred.distanceM, durationMin: preferred.durationMin, fare: preferred.fare, transfers: preferred.transfers, steps: preferred.steps, path: preferred.path, isEstimate: false, source: "KAKAO_MAP", alternatives };
    }

    const response = await fetch(`${KAKAO_MOBILITY_URL}?origin=${lng1},${lat1}&destination=${lng2},${lat2}`, { headers: { Authorization: `KakaoAK ${apiKey}` }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`directions http ${response.status}`);
    const data = await response.json() as any;
    const route = data?.routes?.[0];
    if (!route || route.result_code !== 0) throw new Error("no car route");
    const summary = route.summary;
    const path: [number, number][] = (route.sections ?? []).flatMap((section: any) => (section.roads ?? []).flatMap((road: any) => {
      const vertices = road.vertexes ?? []; const points: [number, number][] = [];
      for (let index = 0; index < vertices.length; index += 2) points.push([vertices[index], vertices[index + 1]]);
      return points;
    }));
    const steps = (route.sections ?? []).flatMap((section: any) => (section.guides ?? []).map((guide: any) => ({ guidance: guide.guidance ?? guide.name ?? "경로를 따라 이동", durationMin: 0, distanceM: guide.distance ?? 0, vehicle: null })));
    return { mode, distanceM: summary.distance, durationMin: Math.max(1, Math.round(summary.duration / 60)), fare: summary.fare?.taxi ?? null, transfers: null, steps: steps.slice(0, 8), path: path.length ? path : fallbackResult.path, isEstimate: false, source: "KAKAO_MOBILITY" };
  } catch {
    return fallbackResult;
  }
}

export async function searchKakaoLocations(query: string) {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({ query, size: "8" });
  const response = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${params}`, { headers: { Authorization: `KakaoAK ${apiKey}` }, signal: AbortSignal.timeout(4000) });
  if (!response.ok) throw new Error(`location search http ${response.status}`);
  const data = await response.json() as any;
  return (data.documents ?? []).map((place: any) => ({ id: place.id, name: place.place_name, address: place.road_address_name || place.address_name, lat: Number(place.y), lng: Number(place.x), category: place.category_name }));
}

export async function getTravelMatrix(points: { lat: number; lng: number }[], hasCar: boolean) {
  const travelMinutes = Array.from({ length: points.length }, () => Array(points.length).fill(0));
  const distanceMeters = Array.from({ length: points.length }, () => Array(points.length).fill(0));
  const tasks: Array<[number, number]> = [];
  for (let from = 0; from < points.length; from++) {
    for (let to = 0; to < points.length; to++) if (from !== to) tasks.push([from, to]);
  }
  let cursor = 0;
  let estimatedPairs = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const [from, to] = tasks[cursor++];
      const estimate = await getTravelEstimate(points[from].lat, points[from].lng, points[to].lat, points[to].lng, hasCar);
      travelMinutes[from][to] = estimate.durationMin;
      distanceMeters[from][to] = estimate.distanceM;
      if (estimate.isEstimate) estimatedPairs++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, tasks.length) }, () => worker()));
  return { travelMinutes, distanceMeters, estimatedPairs, totalPairs: tasks.length };
}

export function getTravelCacheStats() {
  return { entries: travelCache.size, maxEntries: CACHE_MAX_ENTRIES, ttlHours: CACHE_TTL_MS / 3_600_000 };
}

/** 동기 버전(내부 스케줄링 의사결정용, 실제 API 호출 없이 상수 속도로 추정) */
export function estimateTravelSync(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  hasCar: boolean
): TravelEstimate {
  return fallbackEstimate(lat1, lng1, lat2, lng2, hasCar);
}

export { haversineDistanceM };
