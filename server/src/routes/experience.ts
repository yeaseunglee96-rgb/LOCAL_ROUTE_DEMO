import { Router } from "express";
import { prisma } from "../db.js";
import { haversineDistanceM } from "../services/kakao.js";
import { recordEvent } from "../services/events.js";
import { requireItineraryEditor } from "../services/auth.js";

export const experienceRouter = Router();

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

experienceRouter.get("/events", async (req, res, next) => {
  try {
    const from = req.query.from; const to = req.query.to;
    if (!validDate(from) || !validDate(to) || from > to) return res.status(400).json({ error_code: "INVALID_DATE_RANGE", message: "여행 기간을 YYYY-MM-DD 형식으로 확인해 주세요." });
    const [festivals, nightMarkets, traditionalMarkets] = await Promise.all([
      prisma.place.findMany({ where: { category: "FESTIVAL", eventStartDate: { lte: to }, eventEndDate: { gte: from } }, orderBy: [{ eventStartDate: "asc" }, { localScore: "desc" }] }),
      // Visit Busan에서 상설 야시장 운영 정보를 확인할 수 있는 장소만 노출한다.
      prisma.place.findMany({ where: { nameKo: { in: ["부평깡통시장", "부평깡통야시장"] } }, orderBy: { localScore: "desc" } }),
      prisma.place.findMany({ where: { nameKo: { in: ["자갈치시장", "국제시장", "부전시장", "동래시장", "초량전통시장", "해운대전통시장", "수영팔도시장", "구포시장"] } }, orderBy: { localScore: "desc" } }),
    ]);
    const festivalEvents = festivals.map((place) => ({ placeId: place.id, eventType: "FESTIVAL", title: place.nameKo, titleEn: place.nameEn, address: place.address, lat: place.lat, lng: place.lng, startDate: place.eventStartDate, endDate: place.eventEndDate, playTime: place.playTime, imageUrl: place.imageUrl, localScore: place.localScore }));
    const nightMarketEvents = nightMarkets.map((place) => ({ placeId: place.id, eventType: "NIGHT_MARKET", title: "부평깡통야시장", titleEn: "Bupyeong Kkangtong Night Market", address: place.address, lat: place.lat, lng: place.lng, startDate: from, endDate: to, playTime: "매일 19:30–24:00 · 방문 전 운영 확인", imageUrl: place.imageUrl, localScore: place.localScore, officialUrl: "https://www.visitbusan.net/kr/index.do?lang_cd=ko&menuCd=DOM_000000202003001000&uc_seq=1861" }));
    const traditionalMarketEvents = traditionalMarkets.map((place) => ({ placeId: place.id, eventType: "TRADITIONAL_MARKET", title: place.nameKo, titleEn: place.nameEn, address: place.address, lat: place.lat, lng: place.lng, startDate: from, endDate: to, playTime: `운영 ${place.openTime}–${place.closeTime} · 점포별 휴무 확인`, imageUrl: place.imageUrl, localScore: place.localScore }));
    return res.json({ events: [...festivalEvents, ...nightMarketEvents, ...traditionalMarketEvents] });
  } catch (error) { next(error); }
});

experienceRouter.get("/festivals", async (req, res, next) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    if (!validDate(from) || !validDate(to) || from > to) return res.status(400).json({ error_code: "INVALID_DATE_RANGE", message: "여행 기간을 YYYY-MM-DD 형식으로 확인해 주세요." });
    const festivals = await prisma.place.findMany({
      where: { category: "FESTIVAL", eventStartDate: { lte: to }, eventEndDate: { gte: from } },
      orderBy: [{ eventStartDate: "asc" }, { localScore: "desc" }],
    });
    await recordEvent({ eventType: "festival_impression", entityType: "trip_period", entityId: `${from}:${to}`, payload: { count: festivals.length } });
    return res.json({ festivals: festivals.map((place) => ({ placeId: place.id, title: place.nameKo, titleEn: place.nameEn, address: place.address, lat: place.lat, lng: place.lng, startDate: place.eventStartDate, endDate: place.eventEndDate, playTime: place.playTime, imageUrl: place.imageUrl, localScore: place.localScore })) });
  } catch (error) { next(error); }
});

experienceRouter.post("/itineraries/:id/festivals/:placeId", async (req, res, next) => {
  try {
    if (!await requireItineraryEditor(req, res, req.params.id)) return;
    const itinerary = await prisma.itinerary.findUnique({ where: { id: req.params.id }, include: { trip: true, days: { include: { items: true }, orderBy: { dayIndex: "asc" } } } });
    const festival = await prisma.place.findFirst({ where: { id: req.params.placeId, category: "FESTIVAL" } });
    if (!itinerary || !festival) return res.status(404).json({ error_code: "FESTIVAL_NOT_FOUND" });
    if (!festival.eventStartDate || !festival.eventEndDate || festival.eventEndDate < itinerary.trip.startDate || festival.eventStartDate > itinerary.trip.endDate) return res.status(409).json({ error_code: "FESTIVAL_OUTSIDE_TRIP", message: "여행 기간에 열리지 않는 축제입니다." });
    if (itinerary.days.some((day) => day.items.some((item) => item.placeId === festival.id))) return res.json({ added: false, reason: "ALREADY_ADDED" });
    const day = itinerary.days.find((candidate) => candidate.visitDate >= festival.eventStartDate! && candidate.visitDate <= festival.eventEndDate!);
    if (!day) return res.status(409).json({ error_code: "NO_MATCHING_DAY" });
    const seqOrder = day.items.length;
    const item = await prisma.itineraryItem.create({ data: { dayId: day.id, placeId: festival.id, seqOrder, plannedArrival: festival.playTime?.match(/\d{2}:\d{2}/)?.[0] ?? "18:00", stayMinutes: festival.recommendedStayMin, estCost: festival.priceTier <= 1 ? 0 : 15000, recommendReason: "여행 기간에만 열리는 지역축제 — 사용자가 직접 추가", travelSource: "HAVERSINE", travelIsEstimate: true } });
    await prisma.itinerary.update({ where: { id: itinerary.id }, data: { version: { increment: 1 } } });
    await recordEvent({ eventType: "festival_added", entityType: "itinerary", entityId: itinerary.id, payload: { placeId: festival.id, dayIndex: day.dayIndex } });
    return res.status(201).json({ added: true, itemId: item.id, dayIndex: day.dayIndex });
  } catch (error) { next(error); }
});

experienceRouter.get("/shops/souvenir", async (req, res, next) => {
  try {
    const lat = Number(req.query.lat); const lng = Number(req.query.lng); const radius = Math.min(20_000, Math.max(100, Number(req.query.radius ?? 5000)));
    if (![lat, lng, radius].every(Number.isFinite)) return res.status(400).json({ error_code: "INVALID_LOCATION" });
    const shops = (await prisma.place.findMany({ where: { category: "SOUVENIR" } }))
      .map((place) => ({ ...place, distanceM: haversineDistanceM(lat, lng, place.lat, place.lng) }))
      .filter((place) => place.distanceM <= radius)
      .sort((a, b) => (b.localScore - a.localScore) || (a.distanceM - b.distanceM));
    await recordEvent({ eventType: "souvenir_layer_viewed", entityType: "map_area", entityId: `${lat.toFixed(2)}:${lng.toFixed(2)}`, payload: { count: shops.length, radius } });
    res.json(shops.map((place) => ({ id: place.id, nameKo: place.nameKo, nameEn: place.nameEn, address: place.address, lat: place.lat, lng: place.lng, distanceM: Math.round(place.distanceM), items: JSON.parse(place.souvenirItems), openTime: place.openTime, closeTime: place.closeTime, cardPayment: place.foreignCardPayment, foreignAssistance: place.foreignAssistance, localScore: place.localScore, imageUrl: place.imageUrl, rankingBasis: "LOCAL_SCORE_AND_DISTANCE", sponsored: false })));
  } catch (error) { next(error); }
});

const weatherCache = new Map<string, { expiresAt: number; value: object }>();
experienceRouter.get("/weather", async (req, res) => {
  const date = req.query.date;
  if (!validDate(date)) return res.status(400).json({ error_code: "INVALID_DATE" });
  const region = typeof req.query.region === "string" ? req.query.region.slice(0, 30) : "BUSAN";
  const key = `${region}:${date}`;
  const cached = weatherCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return res.json(cached.value);
  const seed = [...date].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const rainProbability = [10, 20, 30, 60, 70][seed % 5];
  const value = { date, region, tempMin: 18 + (seed % 4), tempMax: 25 + (seed % 5), rainProbability, sky: rainProbability >= 60 ? "RAIN" : rainProbability >= 30 ? "CLOUDY" : "CLEAR", isEstimate: true, source: "CACHED_DEMO_FORECAST", outdoorWarning: rainProbability >= 60, cachedForSeconds: 3600 };
  weatherCache.set(key, { expiresAt: Date.now() + 60 * 60_000, value });
  return res.json(value);
});
