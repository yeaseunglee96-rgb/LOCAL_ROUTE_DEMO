import { prisma } from "../db.js";
import { scorePlaces } from "./recommend.js";
import { buildItinerary } from "./schedule.js";

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
    day: { startTravelMin: day.startTravelMin, startDistanceM: day.startDistanceM, startTravelIsEstimate: day.startTravelIsEstimate, returnTravelMin: day.returnTravelMin, returnDistanceM: day.returnDistanceM, returnTravelIsEstimate: day.returnTravelIsEstimate, petBreaksJson: day.petBreaksJson },
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
  const places = (await prisma.place.findMany({ where: { category: { in: ["TOURIST", "RESTAURANT", "CAFE"] } }, include: { petPolicy: true } }));
  const pref = itinerary.trip.preference;
  const scored = scorePlaces(places, JSON.parse(pref.tasteTags), pref.hasPet, (pref.petSize as any) ?? undefined, target.dayBudget, itinerary.trip.partySize, [...new Set([...excluded, ...usedOtherDays])], {
    mode: itinerary.mode as any, needsEnglishMenu: pref.needsEnglishMenu, needsForeignCard: pref.needsForeignCard, petIndoorRequired: pref.petIndoorRequired,
    ratios: { landmark: pref.landmarkRatio, local: pref.localRatio, pet: pref.petRatio },
    petProfile: { usesCarrier: pref.usesPetCarrier, usesStroller: pref.usesPetStroller, weightKg: pref.petWeightKg, count: pref.petCount },
    allergies: JSON.parse(pref.allergies), dietType: pref.dietType, needsOnlineReservation: pref.needsOnlineReservation,
  });
  const base = itinerary.trip.lodgingPlace ?? { lat: itinerary.trip.originLat, lng: itinerary.trip.originLng };
  const result = await buildItinerary(scored, { startDate: target.visitDate, endDate: target.visitDate, originLat: base.lat, originLng: base.lng, totalBudget: target.dayBudget, partySize: itinerary.trip.partySize, hasCar: itinerary.trip.hasCar, pace: itinerary.trip.pace as any, dayStart: itinerary.trip.dayStart, dayEnd: itinerary.trip.dayEnd, maxWalkingKm: itinerary.trip.maxWalkingKm, mustVisitPlaceIds: pinned, hasPet: pref.hasPet, petSize: pref.petSize, recommendationMode: itinerary.mode });
  const next = result.days[0];
  const nextIds = new Set(next.items.map((item) => item.placeId));
  if (!next.items.length || pinned.some((id) => !nextIds.has(id))) throw new Error("NO_FEASIBLE_ALTERNATIVE");
  const beforeJson = snapshot(target, pref);
  const afterJson = JSON.stringify({ day: { startTravelMin: next.startTravelMin, startDistanceM: next.startDistanceM, startTravelIsEstimate: next.startTravelIsEstimate, returnTravelMin: next.returnTravelMin, returnDistanceM: next.returnDistanceM, returnTravelIsEstimate: next.returnTravelIsEstimate, petBreaksJson: JSON.stringify(next.petBreaks) }, items: next.items.map((item) => itemCreate(item, pinned)) });
  await prisma.$transaction([
    prisma.itineraryRevision.create({ data: { itineraryId, dayIndex, action: body.action, beforeJson, afterJson } }),
    prisma.itineraryItem.deleteMany({ where: { dayId: target.id } }),
    prisma.itineraryDay.update({ where: { id: target.id }, data: { startTravelMin: next.startTravelMin, startDistanceM: next.startDistanceM, startTravelIsEstimate: next.startTravelIsEstimate, returnTravelMin: next.returnTravelMin, returnDistanceM: next.returnDistanceM, returnTravelIsEstimate: next.returnTravelIsEstimate, petBreaksJson: JSON.stringify(next.petBreaks), items: { create: next.items.map((item) => itemCreate(item, pinned)) } } }),
    prisma.tripPreference.update({ where: { id: pref.id }, data: { excludedPlaceIds: JSON.stringify([...new Set(excluded)]), mustVisitPlaceIds: JSON.stringify(mustVisit) } }),
  ]);
  return { changedDayIndex: dayIndex, preservedDayIndexes: itinerary.days.filter((day) => day.dayIndex !== dayIndex).map((day) => day.dayIndex), beforeCount: target.items.length, afterCount: next.items.length };
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
