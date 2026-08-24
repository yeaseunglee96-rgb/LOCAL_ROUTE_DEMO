import assert from "node:assert/strict";
import test from "node:test";
import { optimizeDayWithOrTools } from "../src/services/optimizer.js";
import { scored } from "./fixtures.js";

test("프로젝트 전용 OR-Tools 프로세스가 경로 해를 반환한다", async () => {
  const result = await optimizeDayWithOrTools([
    scored({ id: "near", lat: 35.116, lng: 129.04 }),
    scored({ id: "restaurant", category: "RESTAURANT", lat: 35.117, lng: 129.04 }),
  ], {
    startLat: 35.115,
    startLng: 129.04,
    dayStart: "09:00",
    dayEnd: "20:00",
    dayBudget: 100_000,
    partySize: 1,
    hasCar: false,
    maxWalkingKm: 8,
    maxItems: 4,
    mustVisitPlaceIds: [],
  });
  assert.ok(result, "OR-Tools 프로세스를 실행할 수 있어야 합니다.");
  assert.ok(["FEASIBLE", "OPTIMAL"].includes(result.status));
  assert.ok(result.orderedPlaceIds.length > 0);
});
