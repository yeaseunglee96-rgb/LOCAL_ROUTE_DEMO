export type PlaceImageProvider = "DATABASE" | "NAVER" | "GOOGLE";

export interface PlaceImageMatch {
  imageUrl: string;
  sourceUrl: string;
  provider: PlaceImageProvider;
  title: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { value: PlaceImageMatch | null; expiresAt: number }>();

function cleanText(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").trim();
}

function safeHttpUrl(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

async function searchNaver(query: string): Promise<PlaceImageMatch | null> {
  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const params = new URLSearchParams({ query, display: "5", sort: "sim", filter: "large" });
  const response = await fetch(`https://openapi.naver.com/v1/search/image?${params}`, { headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret }, signal: AbortSignal.timeout(4000) });
  if (!response.ok) return null;
  const data = await response.json() as any;
  for (const item of data.items ?? []) {
    const imageUrl = safeHttpUrl(item.thumbnail || item.link);
    const sourceUrl = safeHttpUrl(item.link);
    if (imageUrl && sourceUrl) return { imageUrl, sourceUrl, provider: "NAVER", title: cleanText(item.title) || query };
  }
  return null;
}

async function searchGoogle(query: string): Promise<PlaceImageMatch | null> {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_CX;
  if (!key || !cx) return null;
  const params = new URLSearchParams({ key, cx, q: query, searchType: "image", num: "5", safe: "active", imgSize: "large", rights: "cc_publicdomain|cc_attribute|cc_sharealike" });
  const response = await fetch(`https://customsearch.googleapis.com/customsearch/v1?${params}`, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) return null;
  const data = await response.json() as any;
  for (const item of data.items ?? []) {
    const imageUrl = safeHttpUrl(item.image?.thumbnailLink || item.link);
    const sourceUrl = safeHttpUrl(item.image?.contextLink || item.link);
    if (imageUrl && sourceUrl) return { imageUrl, sourceUrl, provider: "GOOGLE", title: cleanText(item.title) || query };
  }
  return null;
}

export async function searchPlaceImage(place: { id: string; nameKo: string; address: string; category: string; imageUrl: string | null }): Promise<PlaceImageMatch | null> {
  if (place.imageUrl) return { imageUrl: place.imageUrl, sourceUrl: place.imageUrl, provider: "DATABASE", title: place.nameKo };
  if (!["TOURIST", "RESTAURANT"].includes(place.category)) return null;
  const cached = cache.get(place.id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const area = place.address.split(" ").slice(0, 2).join(" ");
  const suffix = place.category === "RESTAURANT" ? "식당 음식점 외관" : "관광지 여행 사진";
  const query = `${area} ${place.nameKo} ${suffix}`.trim();
  let result: PlaceImageMatch | null = null;
  try { result = await searchNaver(query); } catch { result = null; }
  if (!result) { try { result = await searchGoogle(query); } catch { result = null; } }
  cache.set(place.id, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
