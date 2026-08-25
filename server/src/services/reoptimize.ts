import { prisma } from "../db.js";
import { scorePlaces } from "./recommend.js";
import { buildItinerary, formatMinToTime, parseTimeToMin } from "./schedule.js";
import { getTravelEstimate } from "./kakao.js";

type Action = "REMOVE" | "PIN" | "UNPIN" | "REPLACE";

function itemCreate(item: any, pinnedIds: string[]) {
  return {
    placeId: item.placeId, seqOrder: item.seqOrder, plannedArrival: item.plannedArrival,
    stayMinutes: item.stayMinutes, estCost: item.estCost, travelMinToNext: item.travelMinToNext,
    distanceToNextM: item.distanceToNextM, travelIsEstimate: item.travelIsEstimate,
    travelSource: item.travelSource, recommendReason: item.recommendReason,
    isPinned: pinnedIds.includes(item.placeId),
  };
}

function snapshot(day: any, preference: { excludedPlaceIds: string; mustVisitPlaceIds: string }) {
  return JSON.stringify({
    day: { startTravelMin: day.startTravelMin, startDistanceM: day.startDistanceM, startTravelIsEstimate: day.startTravelIsEstimate, returnTravelMin: day.returnTravelMin, returnDistanceM: day.returnDistanceM, returnTravelIsEstimate: day.returnTravelIsEstimate },
    items: day.items.map((item: any) => ({ placeId: item.placeId, seqOrder: item.seqOrder, plannedArrival: item.plannedArrival, stayMinutes: item.stayMinutes, estCost: item.estCost, travelMinToNext: item.travelMinToNext, distanceToNextM: item.distanceToNextM, travelIsEstimate: item.travelIsEstimate, travelSource: item.travelSource, recommendReason: item.recommendReason, isPinned: item.isPinned })),
    preference: { excludedPlaceIds: preference.excludedPlaceIds, mustVisitPlaceIds: preference.mustVisitPlaceIds },
  });
}

export async function reoptimizeItineraryDay(itineraryId: string, dayIndex: number, body: { action: Action; itemId?: string; replacementPlaceId?: string }) {
  const itinerary = await prisma.itinerary.findUnique({ where: { id: itineraryId }, include: { trip: { include: { preference: true, lodgingPlace: true } }, days: { include: { items: true } } } });
  if (!itinerary?.trip.preference) throw new Error("ITINERARY_NOT_FOUND");
  const target = itinerary.days.find((day) => day.dayIndex === dayIndex);
  if (!target) throw new Error("DAY_NOT_FOUND");
  const changed = body.itemId ? target.items.find((item) => item.id === body.itemId) : undefined;
  if (body.itemId && !changed) throw new Error("ITEM_NOT_FOUND");

  let pinned = target.items.filter((item) => item.isPinned).map((item) => item.placeId);
  const excluded = JSON.parse(itinerary.trip.preference.excludedPlaceIds) as string[];
  let mustVisit = JSON.parse(itinerary.trip.preference.mustVisitPlaceIds) as string[];
  if (body.action === "PIN" && changed) pinned = [...new Set([...pinned, changed.placeId])];
  if (body.action === "PIN" && changed) mustVisit = [...new Set([...mustVisit, changed.placeId])];
  if (body.action === "UNPIN" && changed) { pinned = pinned.filter((id) => id !== changed.placeId); mustVisit = mustVisit.filter((id) => id !== changed.placeId); }
  if ((body.action === "REMOVE" || body.action === "REPLACE") && changed) {
    pinned = pinned.filter((id) => id !== changed.placeId);
    mustVisit = mustVisit.filter((id) => id !== changed.placeId);
    excluded.push(changed.placeId);
  }
  if (body.action === "REPLACE") {
    if (!body.replacementPlaceId) throw new Error("REPLACEMENT_REQUIRED");
    pinned.push(body.replacementPlaceId);
    mustVisit = [...new Set([...mustVisit, body.replacementPlaceId])];
  }

  const usedOtherDays = itinerary.days.filter((day) => day.id !== target.id).flatMap((day) => day.items.map((item) => item.placeId));
  const places = (await prisma.place.findMany({ where: { category: { in: ["TOURIST", "RESTAURANT", "CAFE"] } } }));
  const pref = itinerary.trip.preference;
  const scored = scorePlaces(places, JSON.parse(pref.tasteTags), target.dayBudget, itinerary.trip.partySize, [...new Set([...excluded, ...usedOtherDays])], {
    mode: itinerary.mode as any,
    ratios: { landmark: pref.landmarkRatio, local: pref.localRatio, easy: pref.easyRatio },
    allergies: JSON.parse(pref.allergies), dietType: pref.dietType,
  });
  const base = itinerary.trip.lodgingPlace ?? { lat: itinerary.trip.originLat, lng: itinerary.trip.originLng };
  const result = await buildItinerary(scored, { startDate: target.visitDate, endDate: target.visitDate, originLat: base.lat, originLng: base.lng, totalBudget: target.dayBudget, partySize: itinerary.trip.partySize, hasCar: itinerary.trip.hasCar, pace: itinerary.trip.pace as any, dayStart: itinerary.trip.dayStart, dayEnd: itinerary.trip.dayEnd, maxWalkingKm: itinerary.trip.maxWalkingKm, mustVisitPlaceIds: pinned, recommendationMode: itinerary.mode });
  const next = result.days[0];
  const nextIds = new Set(next.items.map((item) => item.placeId));
  if (!next.items.length || pinned.some((id) => !nextIds.has(id))) throw new Error("NO_FEASIBLE_ALTERNATIVE");
  const beforeJson = snapshot(target, pref);
  const afterJson = JSON.stringify({ day: { startTravelMin: next.startTravelMin, startDistanceM: next.startDistanceM, startTravelIsEstimate: next.startTravelIsEstimate, returnTravelMin: next.returnTravelMin, returnDistanceM: next.returnDistanceM, returnTravelIsEstimate: next.returnTravelIsEstimate }, items: next.items.map((item) => itemCreate(item, pinned)) });
  await prisma.$transaction([
    prisma.itineraryRevision.create({ data: { itineraryId, dayIndex, action: body.action, beforeJson, afterJson } }),
    prisma.itineraryItem.deleteMany({ where: { dayId: target.id } }),
    prisma.itineraryDay.update({ where: { id: target.id }, data: { startTravelMin: next.startTravelMin, startDistanceM: next.startDistanceM, startTravelIsEstimate: next.startTravelIsEstimate, returnTravelMin: next.returnTravelMin, returnDistanceM: next.returnDistanceM, returnTravelIsEstimate: next.returnTravelIsEstimate, items: { create: next.items.map((item) => itemCreate(item, pinned)) } } }),
    prisma.tripPreference.update({ where: { id: pref.id }, data: { excludedPlaceIds: JSON.stringify([...new Set(excluded)]), mustVisitPlaceIds: JSON.stringify(mustVisit) } }),
  ]);
  return { changedDayIndex: dayIndex, preservedDayIndexes: itinerary.days.filter((day) => day.dayIndex !== dayIndex).map((day) => day.dayIndex), beforeCount: target.items.length, afterCount: next.items.length };
}

/**
 * 같은 날짜 안에서 방문 순서만 바꾼다(장소 선택은 그대로) - 드래그앤드롭 재정렬용.
 * 도착시각·구간 이동시간을 처음부터 다시 계산하지만, 운영시간·예산을 벗어나도 막지 않고
 * 경고만 반환한다(v2 §16.5 정직성 원칙: 사실을 보여주되 사용자의 조작을 임의로 거부하지 않음).
 */
export async function reorderItineraryDay(itineraryId: string, dayIndex: number, itemIds: string[]) {
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: itineraryId },
    include: { trip: { include: { lodgingPlace: true } }, days: { include: { items: { include: { place: true } } } } },
  });
  if (!itinerary) throw new Error("ITINERARY_NOT_FOUND");
  const target = itinerary.days.find((day) => day.dayIndex === dayIndex);
  if (!target) throw new Error("DAY_NOT_FOUND");

  const currentIds = new Set(target.items.map((item) => item.id));
  if (itemIds.length !== target.items.length || !itemIds.every((id) => currentIds.has(id)) || new Set(itemIds).size !== itemIds.length) {
    throw new Error("INVALID_ORDER");
  }

  const byId = new Map(target.items.map((item) => [item.id, item]));
  const ordered = itemIds.map((id) => byId.get(id)!);
  const base = itinerary.trip.lodgingPlace ?? { lat: itinerary.trip.originLat, lng: itinerary.trip.originLng };
  const hasCar = itinerary.trip.hasCar;

  const warnings: string[] = [];
  const nextItems: any[] = [];
  let cursorMin = parseTimeToMin(itinerary.trip.dayStart);
  let prevLat = base.lat;
  let prevLng = base.lng;

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    const est = await getTravelEstimate(prevLat, prevLng, item.place.lat, item.place.lng, hasCar);
    if (i === 0) {
      cursorMin += est.durationMin;
    } else {
      nextItems[i - 1].travelMinToNext = est.durationMin;
      nextItems[i - 1].distanceToNextM = est.distanceM;
      nextItems[i - 1].travelIsEstimate = est.isEstimate;
      nextItems[i - 1].travelSource = est.isEstimate ? "HAVERSINE" : "KAKAO_MOBILITY";
    }
    const arrivalMin = cursorMin;
    if (arrivalMin < parseTimeToMin(item.place.openTime) || arrivalMin > parseTimeToMin(item.place.closeTime)) {
      warnings.push(`${item.place.nameKo}의 새 도착 시각(${formatMinToTime(arrivalMin)})이 영업시간(${item.place.openTime}~${item.place.closeTime})을 벗어났습니다.`);
    }
    nextItems.push({
      placeId: item.placeId, seqOrder: i + 1, plannedArrival: formatMinToTime(arrivalMin),
      stayMinutes: item.stayMinutes, estCost: item.estCost,
      travelMinToNext: null, distanceToNextM: null, travelIsEstimate: true, travelSource: "HAVERSINE",
      recommendReason: item.recommendReason, isPinned: item.isPinned,
    });
    cursorMin = arrivalMin + item.stayMinutes;
    prevLat = item.place.lat;
    prevLng = item.place.lng;
  }
  const dayEndMin = parseTimeToMin(itinerary.trip.dayEnd);
  if (cursorMin > dayEndMin) {
    warnings.push(`새 순서대로면 하루 종료 시각(${itinerary.trip.dayEnd})을 넘겨 ${formatMinToTime(cursorMin)}에 마지막 장소가 끝납니다.`);
  }
  const returnEst = ordered.length ? await getTravelEstimate(prevLat, prevLng, base.lat, base.lng, hasCar) : null;

  // 순서변경은 TripPreference를 건드리지 않으므로 snapshot()과 달리 preference 키를 아예 넣지 않는다
  // - undoLatestRevision이 before.preference가 없으면 preference 복원을 건너뛰기 때문에, 여기서
  // 가짜 값을 넣으면 되돌리기 시 실제 필수/제외 장소 목록이 빈 배열로 잘못 초기화된다.
  const beforeJson = JSON.stringify({
    day: { startTravelMin: target.startTravelMin, startDistanceM: target.startDistanceM, startTravelIsEstimate: target.startTravelIsEstimate, returnTravelMin: target.returnTravelMin, returnDistanceM: target.returnDistanceM, returnTravelIsEstimate: target.returnTravelIsEstimate },
    items: target.items.map((item) => ({ placeId: item.placeId, seqOrder: item.seqOrder, plannedArrival: item.plannedArrival, stayMinutes: item.stayMinutes, estCost: item.estCost, travelMinToNext: item.travelMinToNext, distanceToNextM: item.distanceToNextM, travelIsEstimate: item.travelIsEstimate, travelSource: item.travelSource, recommendReason: item.recommendReason, isPinned: item.isPinned })),
  });
  const afterJson = JSON.stringify({
    day: {
      startTravelMin: target.startTravelMin, startDistanceM: target.startDistanceM, startTravelIsEstimate: target.startTravelIsEstimate,
      returnTravelMin: returnEst?.durationMin ?? null, returnDistanceM: returnEst?.distanceM ?? null, returnTravelIsEstimate: returnEst?.isEstimate ?? true,
    },
    items: nextItems,
  });

  await prisma.$transaction([
    prisma.itineraryRevision.create({ data: { itineraryId, dayIndex, action: "REORDER", beforeJson, afterJson } }),
    prisma.itineraryItem.deleteMany({ where: { dayId: target.id } }),
    prisma.itineraryDay.update({
      where: { id: target.id },
      data: {
        returnTravelMin: returnEst?.durationMin ?? null, returnDistanceM: returnEst?.distanceM ?? null, returnTravelIsEstimate: returnEst?.isEstimate ?? true,
        items: { create: nextItems },
      },
    }),
  ]);

  return { changedDayIndex: dayIndex, items: nextItems, warnings };
}

export async function undoLatestRevision(itineraryId: string) {
  const revision = await prisma.itineraryRevision.findFirst({ where: { itineraryId, undoneAt: null }, orderBy: { createdAt: "desc" } });
  if (!revision) throw new Error("NO_REVISION");
  const day = await prisma.itineraryDay.findFirstOrThrow({ where: { itineraryId, dayIndex: revision.dayIndex }, include: { itinerary: { include: { trip: { include: { preference: true } } } } } });
  const before = JSON.parse(revision.beforeJson);
  await prisma.$transaction([
    prisma.itineraryItem.deleteMany({ where: { dayId: day.id } }),
    prisma.itineraryDay.update({ where: { id: day.id }, data: { ...before.day, items: { create: before.items } } }),
    ...(before.preference && day.itinerary.trip.preference ? [prisma.tripPreference.update({ where: { id: day.itinerary.trip.preference.id }, data: before.preference })] : []),
    prisma.itineraryRevision.update({ where: { id: revision.id }, data: { undoneAt: new Date() } }),
  ]);
  return { restoredDayIndex: revision.dayIndex };
}
