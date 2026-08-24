import { Router } from "express";
import { prisma } from "../db.js";
import { scorePlaces } from "../services/recommend.js";
import { buildItinerary } from "../services/schedule.js";
import { createJob, getJob, subscribeJob } from "../services/jobs.js";
import { reoptimizeItineraryDay, undoLatestRevision } from "../services/reoptimize.js";
import { getEmbeddedRoute, haversineDistanceM, searchKakaoLocations } from "../services/kakao.js";
import { searchPlaceImage } from "../services/placeImages.js";
import { applyCourseCategoryTasteTags, findCourseCategory, getCourseCategories } from "../services/courseCategories.js";
import type { CreateTripRequest, ItineraryOutput, TripMeta } from "../types.js";
import { recordEvent } from "../services/events.js";
import { optionalSession, requireItineraryEditor, requireTripEditor, requireTripViewer } from "../services/auth.js";

export const tripsRouter = Router();

tripsRouter.get("/locations/search", async (req, res, next) => {
  try {
    const query = typeof req.query.query === "string" ? req.query.query.trim().slice(0, 100) : "";
    if (query.length < 2) return res.status(400).json({ error_code: "QUERY_TOO_SHORT", message: "주소나 장소명을 2자 이상 입력해 주세요." });
    return res.json({ locations: await searchKakaoLocations(query) });
  } catch (error) { next(error); }
});

tripsRouter.get("/course-categories", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.json({ categories: getCourseCategories() });
});

tripsRouter.get("/places/:id/image", async (req, res, next) => {
  try {
    const place = await prisma.place.findUnique({ where: { id: req.params.id }, select: { id: true, nameKo: true, address: true, category: true, imageUrl: true } });
    if (!place) return res.status(404).json({ error_code: "PLACE_NOT_FOUND" });
    const match = await searchPlaceImage(place);
    return res.json(match ?? { imageUrl: null, sourceUrl: null, provider: null, title: null });
  } catch (error) { next(error); }
});

tripsRouter.get("/routes/directions", async (req, res, next) => {
  try {
    const startLat = Number(req.query.startLat); const startLng = Number(req.query.startLng);
    const endLat = Number(req.query.endLat); const endLng = Number(req.query.endLng);
    const mode = req.query.mode === "CAR" ? "CAR" : "TRANSIT";
    if (![startLat, startLng, endLat, endLng].every(Number.isFinite)) return res.status(400).json({ error_code: "INVALID_COORDINATES" });
    return res.json(await getEmbeddedRoute(startLat, startLng, endLat, endLng, mode));
  } catch (error) { next(error); }
});

function buildTripMeta(
  trip: {
    origin: string;
    originLat: number;
    originLng: number;
    startDate: string;
    endDate: string;
    partySize: number;
    adultCount: number;
    childCount: number;
    totalBudget: number;
    hasCar: boolean;
    pace: string;
    dayStart: string;
    dayEnd: string;
    maxWalkingKm: number;
    recommendationMode: string;
  },
  preference: {
    tasteTags: string;
    courseCategory: string | null;
    hasPet: boolean;
    petSize: string | null;
    petName: string | null;
    language: string;
    needsEnglishMenu: boolean;
    needsForeignCard: boolean;
    petIndoorRequired: boolean;
    usesPetCarrier: boolean;
    allergies: string;
    dietType: string;
    needsOnlineReservation: boolean;
    maxTransferCount: number;
    petWeightKg: number | null;
    petCount: number;
    usesPetStroller: boolean;
    petRestaurantRequired: boolean;
    petLodgingRequired: boolean;
    landmarkRatio: number;
    localRatio: number;
    petRatio: number;
  },
  lodgingPlace?: { id: string; nameKo: string; address: string } | null
): TripMeta {
  return {
    origin: trip.origin,
    courseCategory: preference.courseCategory,
    originLat: trip.originLat,
    originLng: trip.originLng,
    startDate: trip.startDate,
    endDate: trip.endDate,
    partySize: trip.partySize,
    adultCount: trip.adultCount,
    childCount: trip.childCount,
    totalBudget: trip.totalBudget,
    hasCar: trip.hasCar,
    pace: trip.pace as TripMeta["pace"],
    dayStart: trip.dayStart,
    dayEnd: trip.dayEnd,
    maxWalkingKm: trip.maxWalkingKm,
    recommendationMode: trip.recommendationMode as TripMeta["recommendationMode"],
    tasteTags: JSON.parse(preference.tasteTags),
    hasPet: preference.hasPet,
    petSize: preference.petSize as TripMeta["petSize"],
    petName: preference.petName,
    language: preference.language as TripMeta["language"],
    needsEnglishMenu: preference.needsEnglishMenu,
    needsForeignCard: preference.needsForeignCard,
    petIndoorRequired: preference.petIndoorRequired,
    usesPetCarrier: preference.usesPetCarrier,
    allergies: JSON.parse(preference.allergies),
    dietType: preference.dietType as TripMeta["dietType"],
    needsOnlineReservation: preference.needsOnlineReservation,
    maxTransferCount: preference.maxTransferCount,
    petWeightKg: preference.petWeightKg,
    petCount: preference.petCount,
    usesPetStroller: preference.usesPetStroller,
    petRestaurantRequired: preference.petRestaurantRequired,
    petLodgingRequired: preference.petLodgingRequired,
    lodgingPlaceId: lodgingPlace?.id ?? null,
    lodgingName: lodgingPlace?.nameKo ?? null,
    lodgingAddress: lodgingPlace?.address ?? null,
    landmarkRatio: preference.landmarkRatio,
    localRatio: preference.localRatio,
    petRatio: preference.petRatio,
  };
}

tripsRouter.get("/places", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const places = await prisma.place.findMany({
    where: category ? { category } : undefined,
    include: { petPolicy: true },
  });
  res.json(places);
});

tripsRouter.get("/places/:id", async (req, res) => {
  const lang = typeof req.query.lang === "string" ? req.query.lang.toUpperCase() : "KO";
  const place = await prisma.place.findUnique({ where: { id: req.params.id }, include: { petPolicy: true, translations: { where: { lang } } } });
  if (!place) return res.status(404).json({ error_code: "PLACE_NOT_FOUND" });
  const translation = place.translations[0] ?? null;
  return res.json({ ...place, displayName: translation?.name ?? place.nameKo, displayAddress: translation?.address ?? place.addressEn ?? place.address, allergens: JSON.parse(place.allergens), dietOptions: JSON.parse(place.dietOptions), translationSource: translation?.source ?? null });
});

tripsRouter.get("/pet-safety", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusM = Math.max(500, Number(req.query.radiusKm ?? 2) * 1000);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error_code: "INVALID_COORDINATES" });
  const places = await prisma.place.findMany({ where: { category: { in: ["VET", "PET_SUPPLY"] } } });
  return res.json(places.map((place) => ({ ...place, distanceM: Math.round(haversineDistanceM(lat, lng, place.lat, place.lng)) })).filter((place) => place.distanceM <= radiusM).sort((a, b) => a.distanceM - b.distanceM));
});

tripsRouter.get("/places/:id/pet-policy", async (req, res) => {
  const policy = await prisma.placePetPolicy.findUnique({ where: { placeId: req.params.id }, include: { reports: { orderBy: { createdAt: "desc" }, take: 5 } } });
  if (!policy) return res.status(404).json({ error_code: "PET_POLICY_NOT_FOUND" });
  return res.json(policy);
});

tripsRouter.post("/places/:id/pet-policy/reports", async (req, res) => {
  const policy = await prisma.placePetPolicy.findUnique({ where: { placeId: req.params.id } });
  if (!policy) return res.status(404).json({ error_code: "PET_POLICY_NOT_FOUND" });
  const reportType = String(req.body?.reportType ?? "");
  if (!["ENTRY_DENIED", "POLICY_CHANGED", "CONFIRMED", "OTHER"].includes(reportType)) return res.status(400).json({ error_code: "INVALID_REPORT_TYPE" });
  const report = await prisma.petPolicyReport.create({ data: { policyId: policy.id, reportType, note: typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null } });
  if (["ENTRY_DENIED", "POLICY_CHANGED"].includes(reportType)) await prisma.placePetPolicy.update({ where: { id: policy.id }, data: { freshnessGrade: "CONFLICTING" } });
  if (reportType === "CONFIRMED") await prisma.placePetPolicy.update({ where: { id: policy.id }, data: { verifiedCount: { increment: 1 }, lastVerifiedAt: new Date(), freshnessGrade: "VERIFIED" } });
  if (reportType === "ENTRY_DENIED" || reportType === "CONFIRMED") await recordEvent({ eventType: reportType === "ENTRY_DENIED" ? "pet_entry_denied" : "pet_policy_verified", entityType: "place", entityId: req.params.id, payload: { reportId: report.id } });
  return res.status(201).json({ reportId: report.id, status: report.status });
});

tripsRouter.post("/trips/:id/itineraries\\:generate", async (req, res) => {
  const trip = await prisma.trip.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!trip) return res.status(404).json({ error_code: "TRIP_NOT_FOUND", message: "여행 조건을 찾을 수 없습니다." });
  if (!await requireTripEditor(req, res, trip.id)) return;
  const idempotencyKey = typeof req.header("Idempotency-Key") === "string" ? req.header("Idempotency-Key")! : undefined;
  const { job } = await createJob(trip.id, idempotencyKey);
  return res.status(202).json({
    jobId: job.jobId,
    status: job.status,
    statusUrl: `/api/itinerary-jobs/${job.jobId}`,
    streamUrl: `/api/itinerary-jobs/${job.jobId}/events`,
  });
});

tripsRouter.get("/itinerary-jobs/:jobId", async (req, res) => {
  const job = await getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error_code: "JOB_NOT_FOUND", message: "생성 작업을 찾을 수 없습니다." });
  return res.json(job);
});

tripsRouter.get("/itinerary-jobs/:jobId/events", async (req, res) => {
  const initial = await getJob(req.params.jobId);
  if (!initial) return res.status(404).json({ error_code: "JOB_NOT_FOUND", message: "생성 작업을 찾을 수 없습니다." });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (job: typeof initial) => {
    res.write(`event: progress\ndata: ${JSON.stringify(job)}\n\n`);
    if (["DONE", "FAILED"].includes(job.status)) res.end();
  };
  send(initial);
  if (["DONE", "FAILED"].includes(initial.status)) return;
  const unsubscribe = subscribeJob(req.params.jobId, send);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

tripsRouter.post("/itineraries/:id/days/:dayIndex/reoptimize", async (req, res) => {
  try {
    if (!await requireItineraryEditor(req, res, req.params.id)) return;
    const result = await reoptimizeItineraryDay(req.params.id, Number(req.params.dayIndex), req.body);
    return res.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "REOPTIMIZE_FAILED";
    const status = code.includes("NOT_FOUND") ? 404 : code === "NO_FEASIBLE_ALTERNATIVE" ? 422 : 400;
    return res.status(status).json({ error_code: code, message: code === "NO_FEASIBLE_ALTERNATIVE" ? "고정 장소와 현재 조건을 유지할 수 있는 대안이 없습니다." : "일정 변경 요청을 처리하지 못했습니다." });
  }
});

tripsRouter.post("/itineraries/:id/undo", async (req, res) => {
  try { if (!await requireItineraryEditor(req, res, req.params.id)) return; return res.json(await undoLatestRevision(req.params.id)); }
  catch { return res.status(409).json({ error_code: "NO_REVISION", message: "실행 취소할 변경이 없습니다." }); }
});

tripsRouter.get("/itineraries/:id/items/:itemId/alternatives", async (req, res) => {
  const itinerary = await prisma.itinerary.findUnique({ where: { id: req.params.id }, include: { trip: { include: { preference: true } }, days: { include: { items: { include: { place: true } } } } } });
  if (!itinerary?.trip.preference) return res.status(404).json({ error_code: "NOT_FOUND" });
  const current = itinerary.days.flatMap((day) => day.items).find((item) => item.id === req.params.itemId);
  if (!current) return res.status(404).json({ error_code: "ITEM_NOT_FOUND" });
  const currentDay = itinerary.days.find((day) => day.items.some((item) => item.id === req.params.itemId))!;
  const used = itinerary.days.flatMap((day) => day.items.map((item) => item.placeId));
  const pref = itinerary.trip.preference;
  const places = await prisma.place.findMany({ where: { category: current.place.category }, include: { petPolicy: true } });
  const dayCode = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(`${currentDay.visitDate}T00:00:00`).getDay()];
  const available = places.filter((place) => !(JSON.parse(place.closedDays) as string[]).includes(dayCode));
  const reachable = itinerary.trip.hasCar ? available : available.filter((place) => haversineDistanceM(itinerary.trip.originLat, itinerary.trip.originLng, place.lat, place.lng) <= itinerary.trip.maxWalkingKm * 500);
  const scored = scorePlaces(reachable, JSON.parse(pref.tasteTags), pref.hasPet, (pref.petSize as any) ?? undefined, itinerary.trip.totalBudget / itinerary.days.length, itinerary.trip.partySize, used, { mode: itinerary.mode as any, needsEnglishMenu: pref.needsEnglishMenu, needsForeignCard: pref.needsForeignCard, petIndoorRequired: pref.petIndoorRequired, ratios: { landmark: pref.landmarkRatio, local: pref.localRatio, pet: pref.petRatio }, petProfile: { usesCarrier: pref.usesPetCarrier, usesStroller: pref.usesPetStroller, weightKg: pref.petWeightKg, count: pref.petCount }, allergies: JSON.parse(pref.allergies), dietType: pref.dietType, needsOnlineReservation: pref.needsOnlineReservation });
  return res.json(scored.slice(0, 5).map((place) => ({ placeId: place.id, nameKo: place.nameKo, nameEn: place.nameEn, category: place.category, address: place.address, score: place.score, localScore: place.localScore, estCost: place.priceTier === 1 ? 0 : place.priceTier === 2 ? 8000 : place.priceTier === 3 ? 20000 : 45000, petFriendly: !!place.petPolicy?.allowed, hasEnglishMenu: place.hasEnglishMenu, foreignCardPayment: place.foreignCardPayment })));
});

tripsRouter.post("/trips", async (req, res) => {
  const body = req.body as CreateTripRequest;
  const ownerSession = await optionalSession(req);

  const requiredFields: (keyof CreateTripRequest)[] = [
    "origin",
    "originLat",
    "originLng",
    "startDate",
    "endDate",
    "partySize",
    "totalBudget",
    "hasCar",
    "pace",
    "tasteTags",
  ];
  const missing = requiredFields.filter((f) => body[f] === undefined || body[f] === null);
  if (missing.length > 0) {
    return res.status(400).json({ error_code: "INVALID_REQUEST", message: `missing fields: ${missing.join(", ")}` });
  }
  if (new Date(body.endDate) < new Date(body.startDate)) {
    return res.status(400).json({ error_code: "INVALID_DATE_RANGE", message: "endDate must be >= startDate" });
  }
  const dayStart = body.dayStart ?? "09:30";
  const dayEnd = body.dayEnd ?? "20:00";
  if (!/^\d{2}:\d{2}$/.test(dayStart) || !/^\d{2}:\d{2}$/.test(dayEnd) || dayEnd <= dayStart) {
    return res.status(400).json({ error_code: "INVALID_DAY_TIME", message: "하루 종료 시간은 시작 시간보다 늦어야 합니다." });
  }
  if ((body.maxWalkingKm ?? 8) <= 0) {
    return res.status(400).json({ error_code: "INVALID_WALKING_LIMIT", message: "최대 도보 거리는 0보다 커야 합니다." });
  }
  const adultCount = body.adultCount ?? body.partySize;
  const childCount = body.childCount ?? 0;
  if (!Number.isInteger(adultCount) || adultCount < 1 || !Number.isInteger(childCount) || childCount < 0) {
    return res.status(400).json({ error_code: "INVALID_PARTY", message: "성인은 1명 이상, 아동은 0명 이상이어야 합니다." });
  }
  if ((body.petCount ?? 1) < 1 || (body.maxTransferCount ?? 2) < 0) {
    return res.status(400).json({ error_code: "INVALID_CONSTRAINT", message: "반려동물 마릿수와 환승 허용 횟수를 확인해주세요." });
  }
  const ratios = [body.landmarkRatio ?? 30, body.localRatio ?? 50, body.petRatio ?? 20];
  if (ratios.some((value) => !Number.isFinite(value) || value < 0) || ratios.reduce((sum, value) => sum + value, 0) <= 0) {
    return res.status(400).json({ error_code: "INVALID_RECOMMENDATION_RATIO", message: "추천 비율 합계는 0보다 커야 합니다." });
  }
  const courseCategory = findCourseCategory(body.courseCategory);
  if (body.courseCategory && !courseCategory) return res.status(400).json({ error_code: "INVALID_COURSE_CATEGORY", message: "지원하지 않는 코스 카테고리입니다." });
  if (courseCategory && !courseCategory.enabled) return res.status(422).json({ error_code: "CATEGORY_NOT_AVAILABLE", disabledReason: courseCategory.disabledReason, message: "아직 제공할 수 없는 코스 카테고리입니다." });
  if (body.lodgingPlaceId) {
    const lodging = await prisma.place.findUnique({ where: { id: body.lodgingPlaceId }, select: { category: true } });
    if (!lodging || lodging.category !== "LODGING") {
      return res.status(400).json({ error_code: "INVALID_LODGING", message: "숙소로 사용할 수 있는 장소가 아닙니다." });
    }
  }

  const trip = await prisma.trip.create({
    data: {
      origin: body.origin,
      originLat: body.originLat,
      originLng: body.originLng,
      startDate: body.startDate,
      endDate: body.endDate,
      partySize: body.partySize,
      adultCount,
      childCount,
      totalBudget: body.totalBudget,
      hasCar: body.hasCar,
      pace: body.pace,
      dayStart,
      dayEnd,
      maxWalkingKm: body.maxWalkingKm ?? 8,
      recommendationMode: body.recommendationMode ?? "LOCAL",
      lodgingPlaceId: body.lodgingPlaceId || null,
      status: "DRAFT",
      ownerSessionId: ownerSession?.id ?? null,
      preference: {
        create: {
          tasteTags: JSON.stringify(body.tasteTags ?? []),
          courseCategory: courseCategory?.code ?? null,
          mustVisitPlaceIds: JSON.stringify(body.mustVisitPlaceIds ?? []),
          excludedPlaceIds: JSON.stringify(body.excludedPlaceIds ?? []),
          hasPet: !!body.hasPet,
          petSize: body.petSize ?? null,
          petName: body.petName ?? null,
          language: body.language ?? "KO",
          needsEnglishMenu: !!body.needsEnglishMenu,
          needsForeignCard: !!body.needsForeignCard,
          petIndoorRequired: !!body.petIndoorRequired,
          usesPetCarrier: !!body.usesPetCarrier,
          allergies: JSON.stringify(body.allergies ?? []),
          dietType: body.dietType ?? "NONE",
          needsOnlineReservation: !!body.needsOnlineReservation,
          maxTransferCount: body.maxTransferCount ?? 2,
          petWeightKg: body.hasPet ? body.petWeightKg ?? null : null,
          petCount: body.hasPet ? body.petCount ?? 1 : 1,
          usesPetStroller: body.hasPet ? !!body.usesPetStroller : false,
          petRestaurantRequired: body.hasPet ? !!body.petRestaurantRequired : false,
          petLodgingRequired: body.hasPet ? !!body.petLodgingRequired : false,
          landmarkRatio: Math.round(ratios[0]),
          localRatio: Math.round(ratios[1]),
          petRatio: Math.round(ratios[2]),
        },
      },
    },
  });

  await recordEvent({ eventType: "trip_searched", entityType: "trip", entityId: trip.id, language: body.language ?? "KO", payload: { startDate: body.startDate, endDate: body.endDate, hasPet: !!body.hasPet, recommendationMode: body.recommendationMode ?? "LOCAL" } });

  res.status(201).json({ tripId: trip.id, status: trip.status, createdAt: trip.createdAt });
});

tripsRouter.post("/trips/:id/itinerary", async (req, res) => {
  if (!await requireTripEditor(req, res, req.params.id)) return;
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: { preference: true, lodgingPlace: true },
  });
  if (!trip || !trip.preference) {
    return res.status(404).json({ error_code: "TRIP_NOT_FOUND" });
  }

  // LODGING은 16.3장 10단계("매일 종료 노드로 고정")를 이번 MVP에서 구현하지 않으므로
  // 낮 시간 관광 후보군에서 제외한다(그렇지 않으면 숙소가 일반 방문지처럼 스케줄링됨).
  const places = (await prisma.place.findMany({ include: { petPolicy: true } })).filter(
    (p) => ["TOURIST", "RESTAURANT", "CAFE"].includes(p.category)
  );
  const pref = trip.preference;
  const selectedCourseCategory = findCourseCategory(pref.courseCategory);
  const tasteTags = applyCourseCategoryTasteTags(JSON.parse(pref.tasteTags), pref.courseCategory);
  const mustVisitPlaceIds: string[] = JSON.parse(pref.mustVisitPlaceIds);
  const excludedPlaceIds: string[] = JSON.parse(pref.excludedPlaceIds);

  const numDays =
    Math.round(
      (new Date(`${trip.endDate}T00:00:00`).getTime() - new Date(`${trip.startDate}T00:00:00`).getTime()) / 86400000
    ) + 1;
  const dayBudgetEstimate = trip.totalBudget / numDays;

  const scored = scorePlaces(
    places,
    tasteTags,
    pref.hasPet,
    (pref.petSize as any) ?? undefined,
    dayBudgetEstimate,
    trip.partySize,
    excludedPlaceIds,
    {
      mode: trip.recommendationMode as any,
      needsEnglishMenu: pref.needsEnglishMenu,
      needsForeignCard: pref.needsForeignCard,
      petIndoorRequired: pref.petIndoorRequired,
      petProfile: { usesCarrier: pref.usesPetCarrier, usesStroller: pref.usesPetStroller, weightKg: pref.petWeightKg, count: pref.petCount },
      allergies: JSON.parse(pref.allergies), dietType: pref.dietType, needsOnlineReservation: pref.needsOnlineReservation,
      ratios: { landmark: pref.landmarkRatio, local: pref.localRatio, pet: pref.petRatio },
      courseCategory: pref.courseCategory,
    }
  );

  if (scored.length === 0) {
    return res.status(422).json({
      error_code: "NO_FEASIBLE_SCHEDULE",
      message: "조건을 만족하는 장소 후보가 없습니다. 예산을 늘리거나 반려동물 조건을 완화해보세요.",
    });
  }

  const stayMinutesScale = selectedCourseCategory?.scheduleParams?.stayMinutesScale ?? 1;
  const categoryAdjusted = scored.map((place) => ({ ...place, recommendedStayMin: Math.max(20, Math.round(place.recommendedStayMin * stayMinutesScale)) }));
  const categoryDayEnd = selectedCourseCategory?.scheduleParams?.dayEndTimeCap ?? selectedCourseCategory?.scheduleParams?.forbidTimeRange?.after;
  const effectiveDayEnd = categoryDayEnd && categoryDayEnd < trip.dayEnd ? categoryDayEnd : trip.dayEnd;
  const { days, warnings, solverSource } = await buildItinerary(categoryAdjusted, {
    startDate: trip.startDate,
    endDate: trip.endDate,
    originLat: trip.lodgingPlace?.lat ?? trip.originLat,
    originLng: trip.lodgingPlace?.lng ?? trip.originLng,
    totalBudget: trip.totalBudget,
    partySize: trip.partySize,
    hasCar: trip.hasCar,
    pace: selectedCourseCategory?.scheduleParams?.pace ?? trip.pace as any,
    dayStart: trip.dayStart,
    dayEnd: effectiveDayEnd,
    maxWalkingKm: trip.maxWalkingKm * (selectedCourseCategory?.scheduleParams?.maxWalkDistanceScale ?? 1),
    mustVisitPlaceIds,
    hasPet: pref.hasPet,
    petSize: pref.petSize,
    recommendationMode: trip.recommendationMode,
  });
  if (days.every((day) => day.items.length === 0)) {
    return res.status(422).json({
      error_code: "NO_FEASIBLE_SCHEDULE",
      message: "설정한 활동시간과 도보 거리 안에서 방문 가능한 장소가 없습니다.",
      conflicts: ["DAY_TIME_WINDOW", "MAX_WALKING_DISTANCE"],
      suggestions: [
        { action: "EXPAND_WALKING_LIMIT", label: "최대 도보 거리 늘리기" },
        { action: "USE_CAR", label: "자차 이동으로 변경" },
        { action: "EXPAND_DAY_TIME", label: "하루 활동시간 늘리기" },
      ],
    });
  }

  const itinerary = await prisma.itinerary.create({
    data: {
      tripId: trip.id,
      status: "DONE",
      solverSource,
      mode: trip.recommendationMode,
      days: {
        create: days.map((d) => ({
          dayIndex: d.dayIndex,
          visitDate: d.visitDate,
          dayBudget: d.dayBudget,
          startTravelMin: d.startTravelMin,
          startDistanceM: d.startDistanceM,
          startTravelIsEstimate: d.startTravelIsEstimate,
          returnTravelMin: d.returnTravelMin,
          returnDistanceM: d.returnDistanceM,
          returnTravelIsEstimate: d.returnTravelIsEstimate,
          petBreaksJson: JSON.stringify(d.petBreaks),
          items: {
            create: d.items.map((it) => ({
              placeId: it.placeId,
              seqOrder: it.seqOrder,
              plannedArrival: it.plannedArrival,
              stayMinutes: it.stayMinutes,
              estCost: it.estCost,
              travelMinToNext: it.travelMinToNext,
              distanceToNextM: it.distanceToNextM,
              travelIsEstimate: it.travelIsEstimate,
              travelSource: it.travelSource,
              recommendReason: it.recommendReason,
            })),
          },
        })),
      },
    },
  });

  await prisma.trip.update({ where: { id: trip.id }, data: { status: "CONFIRMED" } });

  const output: ItineraryOutput = {
    itineraryId: itinerary.id,
    tripId: trip.id,
    trip: buildTripMeta(trip, pref, trip.lodgingPlace),
    days,
    warnings,
    solverSource,
    mode: trip.recommendationMode as ItineraryOutput["mode"],
  };
  res.status(201).json(output);
});

tripsRouter.patch("/trips/:id/preferences", async (req, res) => {
  if (!await requireTripEditor(req, res, req.params.id)) return;
  const { mustVisitPlaceIds = [], excludedPlaceIds = [] } = req.body as {
    mustVisitPlaceIds?: string[];
    excludedPlaceIds?: string[];
  };
  const preference = await prisma.tripPreference.findUnique({ where: { tripId: req.params.id } });
  if (!preference) return res.status(404).json({ error_code: "TRIP_NOT_FOUND" });
  const updated = await prisma.tripPreference.update({
    where: { tripId: req.params.id },
    data: {
      mustVisitPlaceIds: JSON.stringify([...new Set(mustVisitPlaceIds)]),
      excludedPlaceIds: JSON.stringify([...new Set(excludedPlaceIds)]),
    },
  });
  const previousPinned = new Set<string>(JSON.parse(preference.mustVisitPlaceIds));
  const previousExcluded = new Set<string>(JSON.parse(preference.excludedPlaceIds));
  for (const placeId of mustVisitPlaceIds.filter((id) => !previousPinned.has(id))) await recordEvent({ eventType: "place_pinned", entityType: "place", entityId: placeId, payload: { tripId: req.params.id } });
  for (const placeId of excludedPlaceIds.filter((id) => !previousExcluded.has(id))) await recordEvent({ eventType: "place_excluded", entityType: "place", entityId: placeId, payload: { tripId: req.params.id } });
  res.json({
    mustVisitPlaceIds: JSON.parse(updated.mustVisitPlaceIds),
    excludedPlaceIds: JSON.parse(updated.excludedPlaceIds),
  });
});

tripsRouter.get("/trips/:id/itinerary", async (req, res) => {
  if (!await requireTripViewer(req, res, req.params.id)) return;
  const requestedMode = typeof req.query.mode === "string" ? req.query.mode : undefined;
  const itinerary = await prisma.itinerary.findFirst({
    where: { tripId: req.params.id, ...(requestedMode ? { mode: requestedMode } : {}) },
    orderBy: { generatedAt: "desc" },
    include: {
      trip: { include: { preference: true, lodgingPlace: true } },
      days: { include: { items: { include: { place: { include: { petPolicy: true } } } } } },
    },
  });
  if (!itinerary || !itinerary.trip.preference) {
    return res.status(404).json({ error_code: "NOT_FOUND" });
  }

  const output: ItineraryOutput = {
    itineraryId: itinerary.id,
    tripId: itinerary.tripId,
    trip: buildTripMeta(itinerary.trip, itinerary.trip.preference, itinerary.trip.lodgingPlace),
    warnings: [],
    solverSource: itinerary.solverSource as "OR_TOOLS" | "HEURISTIC",
    mode: itinerary.mode as ItineraryOutput["mode"],
    days: itinerary.days
      .sort((a, b) => a.dayIndex - b.dayIndex)
      .map((d) => ({
        dayIndex: d.dayIndex,
        visitDate: d.visitDate,
        dayBudget: d.dayBudget,
        totalEstCost: d.items.reduce((s, it) => s + it.estCost, 0),
        startTravelMin: d.startTravelMin,
        startDistanceM: d.startDistanceM,
        startTravelIsEstimate: d.startTravelIsEstimate,
        returnTravelMin: d.returnTravelMin,
        returnDistanceM: d.returnDistanceM,
        returnTravelIsEstimate: d.returnTravelIsEstimate,
        petBreaks: JSON.parse(d.petBreaksJson),
        items: d.items
          .sort((a, b) => a.seqOrder - b.seqOrder)
          .map((it) => ({
            itemId: it.id,
            seqOrder: it.seqOrder,
            placeId: it.placeId,
            nameKo: it.place.nameKo,
            nameEn: it.place.nameEn,
            category: it.place.category,
            address: it.place.address,
            addressEn: it.place.addressEn,
            allergens: JSON.parse(it.place.allergens),
            dietOptions: JSON.parse(it.place.dietOptions),
            onlineReservation: it.place.onlineReservation,
            lat: it.place.lat,
            lng: it.place.lng,
            openTime: it.place.openTime,
            closeTime: it.place.closeTime,
            plannedArrival: it.plannedArrival,
            stayMinutes: it.stayMinutes,
            estCost: it.estCost,
            travelMinToNext: it.travelMinToNext,
            distanceToNextM: it.distanceToNextM,
            travelIsEstimate: it.travelIsEstimate,
            travelSource: it.travelSource as "KAKAO_MOBILITY" | "HAVERSINE",
            recommendReason: it.recommendReason,
            petFriendly: !!it.place.petPolicy?.allowed,
            hasEnglishMenu: it.place.hasEnglishMenu,
            foreignCardPayment: it.place.foreignCardPayment,
            localScore: it.place.localScore,
            dataSource: it.place.dataSource,
            imageUrl: it.place.imageUrl,
            kakaoPlaceId: it.place.kakaoPlaceId,
            kakaoPlaceUrl: it.place.kakaoPlaceUrl,
            kakaoRating: it.place.kakaoRating,
            kakaoReviewCount: it.place.kakaoReviewCount,
            kakaoPositiveReviewRate: it.place.kakaoPositiveReviewRate,
            kakaoReviewKeywords: JSON.parse(it.place.kakaoReviewKeywords),
            kakaoReviewSource: it.place.kakaoReviewSource,
            kakaoReviewCollectedAt: it.place.kakaoReviewCollectedAt,
            petPolicy: it.place.petPolicy
              ? {
                  allowed: it.place.petPolicy.allowed,
                  indoorAllowed: it.place.petPolicy.indoorAllowed,
                  outdoorAllowed: it.place.petPolicy.outdoorAllowed,
                  sizeLimit: it.place.petPolicy.sizeLimit as any,
                  extraFee: it.place.petPolicy.extraFee,
                  freshnessGrade: it.place.petPolicy.freshnessGrade,
                  carrierRequired: it.place.petPolicy.carrierRequired,
                  strollerAllowed: it.place.petPolicy.strollerAllowed,
                  maxPetCount: it.place.petPolicy.maxPetCount,
                  weightLimitKg: it.place.petPolicy.weightLimitKg,
                  leashRequired: it.place.petPolicy.leashRequired,
                  waterBowl: it.place.petPolicy.waterBowl,
                  wasteBags: it.place.petPolicy.wasteBags,
                  verifiedCount: it.place.petPolicy.verifiedCount,
                  lastVerifiedAt: it.place.petPolicy.lastVerifiedAt,
                  source: it.place.petPolicy.source,
                }
              : null,
          })),
      })),
  };
  res.json(output);
});
