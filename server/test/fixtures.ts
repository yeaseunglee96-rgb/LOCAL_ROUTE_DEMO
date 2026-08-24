import type { ScoredPlace } from "../src/types.js";
import type { PlaceWithPolicy } from "../src/services/recommend.js";

export function place(overrides: Partial<PlaceWithPolicy> = {}): PlaceWithPolicy {
  return {
    id: "place-default",
    nameKo: "테스트 장소",
    nameEn: "Test Place",
    category: "CAFE",
    address: "부산광역시 테스트로 1",
    addressEn: "1 Test-ro, Busan",
    allergens: "[]",
    dietOptions: "[]",
    onlineReservation: true,
    reservationRequired: false,
    isOutdoor: false,
    lat: 35.115,
    lng: 129.04,
    openTime: "09:00",
    closeTime: "22:00",
    closedDays: "[]",
    recommendedStayMin: 60,
    priceTier: 2,
    localScore: 0.8,
    tasteTags: JSON.stringify(["cafe", "hidden_local"]),
    hasEnglishMenu: true,
    foreignCardPayment: true,
    dataSource: "MANUAL",
    imageUrl: null,
    kakaoPlaceId: null,
    kakaoPlaceUrl: null,
    kakaoRating: null,
    kakaoReviewCount: null,
    kakaoPositiveReviewRate: null,
    kakaoReviewKeywords: "[]",
    kakaoReviewSource: null,
    kakaoReviewCollectedAt: null,
    petPolicy: {
      allowed: true,
      indoorAllowed: true,
      outdoorAllowed: true,
      sizeLimit: "LARGE",
      extraFee: 0,
      freshnessGrade: "VERIFIED",
      carrierRequired: false,
      strollerAllowed: true,
      maxPetCount: null,
      weightLimitKg: null,
      leashRequired: true,
      waterBowl: true,
      wasteBags: false,
      verifiedCount: 2,
      lastVerifiedAt: new Date("2026-08-01"),
      source: "TEST",
    },
    ...overrides,
  };
}

export function scored(overrides: Partial<ScoredPlace> = {}): ScoredPlace {
  const base = place();
  return {
    ...base,
    closedDays: JSON.parse(base.closedDays),
    tasteTags: JSON.parse(base.tasteTags),
    petPolicy: base.petPolicy
      ? { ...base.petPolicy, sizeLimit: base.petPolicy.sizeLimit as "SMALL" | "MEDIUM" | "LARGE" | "NONE" }
      : null,
    score: 0.8,
    ...overrides,
  };
}
