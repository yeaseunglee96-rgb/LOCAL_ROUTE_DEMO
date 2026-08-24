import assert from "node:assert/strict";
import test from "node:test";
import { buildItinerary } from "../src/services/schedule.js";
import { haversineDistanceM } from "../src/services/kakao.js";
import { scored } from "./fixtures.js";

const origin = { lat: 35.115, lng: 129.04 };

function input(overrides: Partial<Parameters<typeof buildItinerary>[1]> = {}): Parameters<typeof buildItinerary>[1] {
  return {
    startDate: "2026-08-24",
    endDate: "2026-08-24",
    originLat: origin.lat,
    originLng: origin.lng,
    totalBudget: 100_000,
    partySize: 1,
    hasCar: false,
    pace: "NORMAL",
    dayStart: "09:00",
    dayEnd: "20:00",
    maxWalkingKm: 8,
    mustVisitPlaceIds: [],
    ...overrides,
  };
}

test("날짜별 예산과 영업시간을 넘지 않는다", async () => {
  const candidates = [
    scored({ id: "open", priceTier: 3, openTime: "09:00", closeTime: "18:00" }),
    scored({ id: "expensive", priceTier: 4, lat: 35.116 }),
    scored({ id: "closed-time", openTime: "21:00", closeTime: "23:00", lat: 35.117 }),
  ];
  const result = await buildItinerary(candidates, input({ totalBudget: 25_000 }));
  assert.ok(result.days[0].totalEstCost <= 25_000);
  assert.deepEqual(result.days[0].items.map((item) => item.placeId), ["open"]);
  assert.ok(result.days[0].items.every((item) => item.plannedArrival >= item.openTime));
});

test("휴무일인 장소를 일정에서 제외한다", async () => {
  const result = await buildItinerary([scored({ id: "monday-closed", closedDays: ["MON"] })], input());
  assert.equal(result.days[0].items.length, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("휴무일")));
});

test("하루 최대 도보거리와 동일 장소 중복 방지를 지킨다", async () => {
  const candidates = [
    scored({ id: "near", lat: 35.116, lng: 129.04 }),
    scored({ id: "far", lat: 35.14, lng: 129.04 }),
    scored({ id: "near-2", lat: 35.1165, lng: 129.04 }),
  ];
  const maxWalkingKm = 1;
  const result = await buildItinerary(candidates, input({ maxWalkingKm }));
  const ids = result.days.flatMap((day) => day.items.map((item) => item.placeId));
  assert.equal(new Set(ids).size, ids.length);
  let walked = 0;
  let previous = origin;
  for (const item of result.days[0].items) {
    walked += haversineDistanceM(previous.lat, previous.lng, item.lat, item.lng);
    previous = item;
  }
  assert.ok(walked <= maxWalkingKm * 1000 + 1);
  assert.ok(!ids.includes("far"));
});

test("여러 날짜의 일별 예산 합계가 전체 예산을 넘지 않는다", async () => {
  const candidates = Array.from({ length: 8 }, (_, index) => scored({
    id: `place-${index}`,
    lat: origin.lat + index * 0.0002,
    priceTier: 2,
  }));
  const result = await buildItinerary(candidates, input({ endDate: "2026-08-25", totalBudget: 32_000 }));
  const total = result.days.reduce((sum, day) => sum + day.totalEstCost, 0);
  assert.ok(result.days.every((day) => day.totalEstCost <= day.dayBudget + 1));
  assert.ok(total <= 32_000 + 1);
});

test("대형견 휴식과 숙소 복귀를 포함해 하루 종료 시각을 넘지 않는다", async () => {
  const candidates = Array.from({ length: 6 }, (_, index) => scored({ id: `pet-${index}`, lat: origin.lat + index * 0.0001, recommendedStayMin: 90 }));
  const result = await buildItinerary(candidates, input({ hasPet: true, petSize: "LARGE", recommendationMode: "PET_SAFE", hasCar: true }));
  const day = result.days[0];
  assert.ok(day.petBreaks.length > 0);
  const last = day.items.at(-1)!;
  const [hour, minute] = last.plannedArrival.split(":").map(Number);
  const finish = hour * 60 + minute + last.stayMinutes + (day.returnTravelMin ?? 0);
  assert.ok(finish <= 20 * 60, `휴식 포함 복귀 시각이 ${finish}분으로 종료 시각을 넘었습니다.`);
});

test("일정의 절반 이상을 관광·체험으로 구성하고 식당 편중을 막는다", async () => {
  const candidates = [
    ...Array.from({ length: 4 }, (_, index) => scored({ id: `restaurant-${index}`, category: "RESTAURANT", score: 0.99 - index * 0.01, lat: origin.lat + index * 0.0001 })),
    ...Array.from({ length: 2 }, (_, index) => scored({ id: `cafe-${index}`, category: "CAFE", score: 0.95 - index * 0.01, lat: origin.lat + (index + 4) * 0.0001 })),
    ...Array.from({ length: 4 }, (_, index) => scored({ id: `tourist-${index}`, category: "TOURIST", score: 0.82 - index * 0.01, lat: origin.lat + (index + 6) * 0.0001 })),
  ];
  const result = await buildItinerary(candidates, input({ hasCar: true }));
  const items = result.days[0].items;
  const foodStops = items.filter((item) => ["RESTAURANT", "CAFE"].includes(item.category));
  assert.ok(items.filter((item) => item.category === "TOURIST").length >= 2);
  assert.ok(foodStops.length <= 2);
  assert.ok(items.filter((item) => item.category === "RESTAURANT").length <= 1);
});
