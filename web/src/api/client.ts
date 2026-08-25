import type { BookingOption, CourseCategory, CreateTripRequest, EmbeddedRoute, Festival, ItineraryJob, ItineraryOutput, LocationSearchResult, PetSafetyPlace, PlaceAlternative, PlaceImageMatch, PlaceRecord, SharedItinerary, SouvenirShop, SponsoredPlacement, StoryRecord, WeatherForecast } from "../types";

/**
 * 백엔드가 떠 있지 않으면 fetch 는 TypeError("Failed to fetch") 로 실패한다.
 * 그대로 두면 화면은 정상인데 기능만 조용히 죽어 원인을 찾기 어렵다.
 * 이 모듈 안의 모든 fetch 호출을 감싸 원인을 명확한 에러로 바꾼다.
 */
export class ApiUnavailableError extends Error {
  constructor() {
    super("백엔드 서버(http://localhost:4000)에 연결할 수 없습니다. 프로젝트 루트에서 npm run dev 로 서버와 웹을 함께 실행해 주세요.");
    this.name = "ApiUnavailableError";
  }
}

const rawFetch = globalThis.fetch.bind(globalThis);
// 아래 fetch 는 이 모듈 스코프에서 전역 fetch 를 가린다(호출부 수정 불필요).
async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await rawFetch(input, init);
  } catch {
    throw new ApiUnavailableError();
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `요청 실패 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function createTrip(payload: CreateTripRequest): Promise<{ tripId: string }> {
  const auth = await authHeaders(payload.language ?? "KO");
  const res = await fetch("/api/trips", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function generateItinerary(tripId: string, onProgress?: (job: ItineraryJob) => void, mode?: string): Promise<ItineraryOutput> {
  const res = await fetch(`/api/trips/${tripId}/itineraries:generate`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID(), ...(await authHeaders()) },
  });
  const created = await handle<{ jobId: string; streamUrl: string; statusUrl: string }>(res);
  await waitForJob(created, onProgress);
  return getItinerary(tripId, mode);
}

function waitForJob(created: { jobId: string; streamUrl: string; statusUrl: string }, onProgress?: (job: ItineraryJob) => void) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let polling = false;
    const finish = (job: ItineraryJob) => {
      onProgress?.(job);
      if (job.status === "DONE") { settled = true; resolve(); return true; }
      if (job.status === "FAILED") { settled = true; reject(new Error(job.errorMessage ?? "일정 생성에 실패했습니다.")); return true; }
      return false;
    };
    const source = new EventSource(created.streamUrl);
    source.addEventListener("progress", (event) => {
      const job = JSON.parse((event as MessageEvent).data) as ItineraryJob;
      if (finish(job)) source.close();
    });
    source.onerror = () => {
      source.close();
      if (settled || polling) return;
      polling = true;
      const poll = async () => {
        try {
          const job = await handle<ItineraryJob>(await fetch(created.statusUrl));
          if (!finish(job)) window.setTimeout(poll, 2_000);
        } catch (error) { reject(error); }
      };
      void poll();
    };
  });
}

export async function getItinerary(tripId: string, mode?: string): Promise<ItineraryOutput> {
  const res = await fetch(`/api/trips/${tripId}/itinerary${mode ? `?mode=${encodeURIComponent(mode)}` : ""}`, { headers: await authHeaders() });
  return handle(res);
}

export async function updateTripPreferences(
  tripId: string,
  payload: { mustVisitPlaceIds: string[]; excludedPlaceIds: string[] }
): Promise<void> {
  const res = await fetch(`/api/trips/${tripId}/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  await handle(res);
}

export async function getPlaceCount(): Promise<number> {
  const res = await fetch("/api/places");
  const places = await handle<PlaceRecord[]>(res);
  // 서버가 배열이 아닌 형태(에러 객체, 페이지네이션 래퍼 등)를 돌려줘도
  // 화면이 깨지지 않도록 숫자를 보장한다.
  return Array.isArray(places) ? places.length : 0;
}

export async function getCourseCategories(): Promise<CourseCategory[]> {
  return (await handle<{ categories: CourseCategory[] }>(await fetch("/api/course-categories?catalog=full-v2"))).categories;
}

export async function getLodgings(): Promise<PlaceRecord[]> {
  const res = await fetch("/api/places?category=LODGING");
  return handle<PlaceRecord[]>(res);
}

export async function reoptimizeDay(itineraryId: string, dayIndex: number, payload: { action: "REMOVE" | "PIN" | "UNPIN" | "REPLACE"; itemId?: string; replacementPlaceId?: string }) {
  return handle(await fetch(`/api/itineraries/${itineraryId}/days/${dayIndex}/reoptimize`, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(payload) }));
}

export async function undoItineraryChange(itineraryId: string) {
  return handle(await fetch(`/api/itineraries/${itineraryId}/undo`, { method: "POST", headers: await authHeaders() }));
}

export async function getAlternatives(itineraryId: string, itemId: string): Promise<PlaceAlternative[]> {
  return handle(await fetch(`/api/itineraries/${itineraryId}/items/${itemId}/alternatives`));
}

export async function getPetSafetyPlaces(lat: number, lng: number): Promise<PetSafetyPlace[]> {
  return handle(await fetch(`/api/pet-safety?lat=${lat}&lng=${lng}&radiusKm=2`));
}

export async function searchLocations(query: string): Promise<LocationSearchResult[]> {
  return (await handle<{ locations: LocationSearchResult[] }>(await fetch(`/api/locations/search?query=${encodeURIComponent(query)}`))).locations;
}

export async function getPlaceImage(placeId: string): Promise<PlaceImageMatch> {
  return handle(await fetch(`/api/places/${encodeURIComponent(placeId)}/image`));
}

export async function getEmbeddedRoute(params: { startLat: number; startLng: number; endLat: number; endLng: number; mode: "TRANSIT" | "CAR" }): Promise<EmbeddedRoute> {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])));
  return handle(await fetch(`/api/routes/directions?${query}`));
}

export async function reportPetPolicy(placeId: string, reportType: "ENTRY_DENIED" | "POLICY_CHANGED" | "CONFIRMED") {
  return handle(await fetch(`/api/places/${placeId}/pet-policy/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportType }) }));
}

function clientSessionId() {
  const key = "local-route-client-session";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(key, created);
  return created;
}

const tokenKey = "local-route-auth-token";
const userKey = "local-route-auth-user";
export async function authHeaders(locale: "KO" | "EN" = "KO"): Promise<Record<string, string>> {
  let token = localStorage.getItem(tokenKey);
  if (!token) {
    const created = await handle<{ token: string; id: string }>(await fetch("/api/auth/anonymous", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) }));
    token = created.token; localStorage.setItem(tokenKey, token); localStorage.setItem(userKey, created.id);
  }
  return { Authorization: `Bearer ${token}` };
}
export function currentUserId() { return localStorage.getItem(userKey); }

export async function getFestivals(from: string, to: string): Promise<Festival[]> { return (await handle<{ festivals: Festival[] }>(await fetch(`/api/festivals?from=${from}&to=${to}&region=BUSAN`))).festivals; }
export async function getEvents(from: string, to: string): Promise<Festival[]> { return (await handle<{ events: Festival[] }>(await fetch(`/api/events?from=${from}&to=${to}&region=BUSAN`))).events; }
export async function addFestival(itineraryId: string, placeId: string) { return handle(await fetch(`/api/itineraries/${itineraryId}/festivals/${placeId}`, { method: "POST", headers: await authHeaders() })); }
export async function getSouvenirShops(lat: number, lng: number): Promise<SouvenirShop[]> { return handle(await fetch(`/api/shops/souvenir?lat=${lat}&lng=${lng}&radius=12000`)); }
export async function getWeather(date: string): Promise<WeatherForecast> { return handle(await fetch(`/api/weather?region=BUSAN&date=${date}`)); }
export async function createShare(itineraryId: string) { return handle<{ shareSlug: string; url: string; expiresAt: string }>(await fetch(`/api/itineraries/${itineraryId}/share`, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ visibility: "LINK", expiresInDays: 30 }) })); }
export async function getSharedItinerary(slug: string): Promise<SharedItinerary> { return handle(await fetch(`/api/s/${slug}`)); }
export async function inviteCompanion(tripId: string, role: "EDITOR" | "VIEWER") { return handle<{ inviteUrl: string; expiresAt: string }>(await fetch(`/api/trips/${tripId}/members/invite`, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ role, expiresInDays: 7 }) })); }
export async function acceptInvite(inviteToken: string) { return handle<{ tripId: string; role: string }>(await fetch(`/api/collaboration/invites/${inviteToken}/accept`, { method: "POST", headers: await authHeaders() })); }
export async function getCollaboration(itineraryId: string) { return handle<{ version: number; myRole: string; members: unknown[] }>(await fetch(`/api/itineraries/${itineraryId}/collaboration`, { headers: await authHeaders() })); }
export async function createStory(payload: { placeId: string; itineraryItemId?: string; content: string; images: string[]; visibility: string; publishMode: "NOW" | "AFTER_TRIP"; petTagged: boolean }) { return handle<{ storyId: string; delayed: boolean; exifRemoved: boolean }>(await fetch("/api/stories", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(payload) })); }
export async function getStories(options: boolean | { mine?: boolean; following?: boolean } = false): Promise<StoryRecord[]> { const params = new URLSearchParams(); if (typeof options === "boolean" ? options : options.mine) params.set("mine", "true"); if (typeof options !== "boolean" && options.following) params.set("following", "true"); return handle(await fetch(`/api/stories${params.size ? `?${params}` : ""}`, { headers: await authHeaders() })); }
export async function reportStory(id: string, reason = "PRIVACY") { return handle(await fetch(`/api/stories/${id}/report`, { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ reason }) })); }
export async function followUser(id: string, following: boolean) { return handle(await fetch(`/api/users/${id}/follow`, { method: following ? "DELETE" : "POST", headers: await authHeaders() })); }

export async function getSponsoredPlacements(context: { mode: string; hasPet: boolean; language: string }): Promise<SponsoredPlacement[]> {
  const query = new URLSearchParams({ mode: context.mode, hasPet: String(context.hasPet), language: context.language });
  return handle(await fetch(`/api/ads?${query}`));
}

export async function trackAd(campaignId: string, eventType: "impressions" | "clicks") {
  return handle(await fetch(`/api/ads/${campaignId}/${eventType}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: crypto.randomUUID(), clientSessionId: clientSessionId() }) }));
}

export async function getBookingOptions(placeId: string): Promise<BookingOption[]> {
  return handle(await fetch(`/api/places/${placeId}/booking-options`));
}

export async function startBooking(partnerId: string, tripId: string) {
  return handle<{ bookingId: string; bookingUrl: string; disclosure: string }>(await fetch("/api/bookings/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partnerId, tripId, eventId: crypto.randomUUID(), clientSessionId: clientSessionId() }) }));
}
