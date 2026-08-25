import type { RecommendationMode, ScoredPlace } from "../types.js";
import { findCourseCategory } from "./courseCategories.js";

export interface PlaceWithPolicy {
  id: string;
  nameKo: string;
  nameEn: string | null;
  category: string;
  address: string;
  addressEn: string | null;
  allergens: string;
  dietOptions: string;
  onlineReservation: boolean;
  reservationRequired: boolean;
  isOutdoor: boolean;
  lat: number;
  lng: number;
  openTime: string;
  closeTime: string;
  closedDays: string; // JSON string
  recommendedStayMin: number;
  priceTier: number;
  localScore: number;
  tasteTags: string; // JSON string
  hasEnglishMenu: boolean;
  foreignCardPayment: boolean;
  dataSource: string;
  imageUrl: string | null;
  kakaoPlaceId: string | null;
  kakaoPlaceUrl: string | null;
  kakaoRating: number | null;
  kakaoReviewCount: number | null;
  kakaoPositiveReviewRate: number | null;
  kakaoReviewKeywords: string;
  kakaoReviewSource: string | null;
  kakaoReviewCollectedAt: Date | null;
}

// priceTier(1~4) 및 카테고리별 1인/1소요 예상 지출액(원)을 현실적으로 정밀 산출
export function estimatePlaceCost(place: { category?: string; priceTier: number } | number, partySize: number): number {
  const party = Math.max(1, partySize);
  const tier = typeof place === "number" ? place : place.priceTier;
  const category = typeof place === "number" ? "GENERAL" : (place.category ?? "GENERAL");
  switch (category) {
    case "TOURIST":
      // 무료 관광지 0원, 유료 입장료/체험 5,000 ~ 25,000원
      return (tier === 1 ? 0 : tier === 2 ? 5000 : tier === 3 ? 15000 : 25000) * party;
    case "RESTAURANT":
      // 식당 1인당: Tier 1(8,000원), Tier 2(14,000원 - 돼지국밥/밀면 등), Tier 3(25,000원 - 해산물/BBQ), Tier 4(45,000원)
      return (tier === 1 ? 8000 : tier === 2 ? 14000 : tier === 3 ? 25000 : 45000) * party;
    case "CAFE":
      // 카페 1인당 음료+디저트: Tier 1(5,000원), Tier 2(7,000원), Tier 3(10,000원), Tier 4(15,000원)
      return (tier === 1 ? 5000 : tier === 2 ? 7000 : tier === 3 ? 10000 : 15000) * party;
    case "LODGING":
      // 숙소: 1박 기준
      return tier === 1 ? 40000 : tier === 2 ? 80000 : tier === 3 ? 150000 : 250000;
    default:
      return (tier === 1 ? 0 : tier === 2 ? 8000 : tier === 3 ? 20000 : 45000) * party;
  }
}

function preferenceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  // 사용자가 여러 취향을 고를수록 일치 점수가 과도하게 낮아지는 Jaccard 대신
  // 코사인 유사도를 사용한다. 하나 이상의 핵심 취향이 맞는 장소를 일정 후보에 남긴다.
  return intersection / Math.sqrt(setA.size * setB.size);
}

export interface ScoreOptions {
  mode: RecommendationMode;
  needsEnglishMenu?: boolean;
  needsForeignCard?: boolean;
  ratios?: { landmark: number; local: number; easy: number };
  allergies?: string[];
  dietType?: string;
  needsOnlineReservation?: boolean;
  courseCategory?: string | null;
}

function passesCourseCategoryProxy(place: PlaceWithPolicy, courseCategory: string | null | undefined): boolean {
  if (!courseCategory) return true;
  const tags = JSON.parse(place.tasteTags) as string[];
  switch (courseCategory) {
    case "ZERO_WON": return place.priceTier === 1;
    case "BEST_BANG": return place.priceTier <= 2;
    case "SPLURGE": return place.priceTier >= 2;
    case "OLD_TOWN": return place.localScore >= 0.65 || tags.some((tag) => ["history", "hidden_local"].includes(tag));
    case "NATURE_FIX": return tags.includes("nature");
    case "PICTURE_PERFECT": return tags.some((tag) => ["photo", "nightview"].includes(tag)) && Boolean(place.imageUrl);
    case "EASY_PACE": return tags.some((tag) => ["relax", "indoor", "culture"].includes(tag)) && place.recommendedStayMin <= 120;
    case "SOLO_FRIENDLY": return !place.reservationRequired && tags.some((tag) => ["cafe", "culture", "hidden_local", "relax"].includes(tag));
    case "RAINY_DAY": return !place.isOutdoor && tags.some((tag) => ["indoor", "culture", "cafe"].includes(tag));
    default: return true;
  }
}

/**
 * 15.1장 규칙기반 추천 점수(단순화 버전).
 * travelEfficiency는 군집화 이전 단계라 상수 placeholder를 사용하고,
 * 실제 동선 순서는 schedule.ts의 최근접 이웃 로직이 별도로 담당한다.
 */
export function scorePlaces(
  places: PlaceWithPolicy[],
  tasteTags: string[],
  dayBudgetEstimate: number,
  partySize: number,
  excludedPlaceIds: string[],
  options: ScoreOptions
): ScoredPlace[] {
  const TRAVEL_EFFICIENCY_PLACEHOLDER = 0.5;
  // v2 13/15장: 이동 편의성 및 외국인 편의 비중 반영
  const weights = {
    ESSENTIAL: { taste: 0.2, local: 0.15, travel: 0.25, budget: 0.15, mode: 0.15, foreign: 0.1 },
    LOCAL: { taste: 0.25, local: 0.35, travel: 0.15, budget: 0.1, mode: 0.1, foreign: 0.05 },
    EASY: { taste: 0.15, local: 0.15, travel: 0.3, budget: 0.05, mode: 0.1, foreign: 0.25 },
  }[options.mode];
  const category = findCourseCategory(options.courseCategory);
  const multipliers = category?.weightMultipliers ?? {};
  const weighted = {
    taste: weights.taste * (multipliers.tasteMatch ?? 1), local: weights.local * (multipliers.localScore ?? 1),
    travel: weights.travel * (multipliers.travelEfficiency ?? 1),
    budget: weights.budget * (multipliers.budgetFit ?? 1), mode: weights.mode,
    foreign: weights.foreign * (multipliers.foreignerEase ?? 1),
  };
  const weightTotal = Object.values(weighted).reduce((sum, value) => sum + value, 0) || 1;
  const normalizedWeights = Object.fromEntries(Object.entries(weighted).map(([key, value]) => [key, value / weightTotal])) as typeof weighted;

  return places
    .filter((p) => !excludedPlaceIds.includes(p.id))
    .filter((p) => passesCourseCategoryProxy(p, options.courseCategory))
    .filter((p) => {
      const known = JSON.parse(p.allergens) as string[];
      return !(options.allergies ?? []).some((allergy) => known.map((value) => value.toLowerCase()).includes(allergy.toLowerCase()));
    })
    .filter((p) => {
      if (!options.dietType || options.dietType === "NONE" || !["RESTAURANT", "CAFE"].includes(p.category)) return true;
      const known = JSON.parse(p.dietOptions) as string[];
      return known.length === 0 || known.includes(options.dietType);
    })
    .map((p) => {
      const placeTasteTags: string[] = JSON.parse(p.tasteTags);
      const tasteMatch = preferenceSimilarity(tasteTags, placeTasteTags);
      const estCost = estimatePlaceCost(p, partySize);
      const normalBudgetFit = dayBudgetEstimate > 0 ? Math.max(0, 1 - estCost / dayBudgetEstimate) : 0.5;
      const budgetFit = category?.budgetFitMode === "INVERSE" ? 1 - normalBudgetFit : normalBudgetFit;
      const foreignFit = ((p.hasEnglishMenu ? 1 : 0) + (p.foreignCardPayment ? 1 : 0)) / 2;

      // 카카오 평점 (1~5점) 및 후기 수를 반영한 과학적 로컬 점수 도출
      const kakaoRatingScore = p.kakaoRating ? (p.kakaoRating / 5.0) : 0.75;
      const reviewCountConfidence = p.kakaoReviewCount ? Math.min(1.0, Math.log10(p.kakaoReviewCount + 1) / 3.5) : 0.4;
      const kakaoCombined = kakaoRatingScore * 0.7 + reviewCountConfidence * 0.3;
      const effectiveLocalScore = Math.min(1.0, p.localScore * 0.5 + kakaoCombined * 0.5);

      const presetModeFit = options.mode === "ESSENTIAL"
        ? (placeTasteTags.includes("landmark") ? 1 : 0)
        : options.mode === "LOCAL"
          ? Math.min(1, effectiveLocalScore * 0.7 + (placeTasteTags.includes("hidden_local") ? 0.3 : 0))
          : foreignFit;
      const ratioTotal = options.ratios ? Math.max(1, options.ratios.landmark + options.ratios.local + options.ratios.easy) : 0;
      const modeFit = options.ratios
        ? (options.ratios.landmark / ratioTotal) * (placeTasteTags.includes("landmark") ? 1 : 0)
          + (options.ratios.local / ratioTotal) * Math.min(1, effectiveLocalScore * 0.7 + (placeTasteTags.includes("hidden_local") ? 0.3 : 0))
          + (options.ratios.easy / ratioTotal) * foreignFit
        : presetModeFit;
      const courseFit = options.courseCategory === "ZERO_WON" ? (p.priceTier === 1 ? 1 : 0)
        : options.courseCategory === "BEST_BANG" ? Math.min(1, effectiveLocalScore * 0.7 + normalBudgetFit * 0.3)
        : options.courseCategory === "SPLURGE" ? Math.min(1, (1 - normalBudgetFit) * 0.6 + (p.priceTier >= 3 ? 0.4 : 0))
        : options.courseCategory === "RAINY_DAY" ? (!p.isOutdoor ? 1 : 0)
        : 1;

      const baseScore = (
        normalizedWeights.taste * tasteMatch +
        normalizedWeights.local * effectiveLocalScore +
        normalizedWeights.travel * TRAVEL_EFFICIENCY_PLACEHOLDER +
        normalizedWeights.budget * budgetFit +
        normalizedWeights.mode * modeFit +
        normalizedWeights.foreign * foreignFit
      );
      let personalizedScore = options.courseCategory ? baseScore * 0.88 + courseFit * 0.12 : baseScore;
      if (category?.landmarkPenalty && placeTasteTags.includes("landmark")) personalizedScore *= category.landmarkPenalty;
      const kakaoSignal = p.kakaoRating ? (p.kakaoRating / 5.0) : null;
      const score = kakaoSignal === null ? personalizedScore : personalizedScore * 0.85 + kakaoSignal * 0.15;

      const scored: ScoredPlace = {
        id: p.id,
        nameKo: p.nameKo,
        nameEn: p.nameEn,
        category: p.category,
        address: p.address,
        addressEn: p.addressEn,
        allergens: JSON.parse(p.allergens),
        dietOptions: JSON.parse(p.dietOptions),
        onlineReservation: p.onlineReservation,
        lat: p.lat,
        lng: p.lng,
        openTime: p.openTime,
        closeTime: p.closeTime,
        closedDays: JSON.parse(p.closedDays),
        recommendedStayMin: p.recommendedStayMin,
        priceTier: p.priceTier,
        localScore: p.localScore,
        tasteTags: placeTasteTags,
        hasEnglishMenu: p.hasEnglishMenu,
        foreignCardPayment: p.foreignCardPayment,
        dataSource: p.dataSource,
        imageUrl: p.imageUrl,
        kakaoPlaceId: p.kakaoPlaceId,
        kakaoPlaceUrl: p.kakaoPlaceUrl,
        kakaoRating: p.kakaoRating,
        kakaoReviewCount: p.kakaoReviewCount,
        kakaoPositiveReviewRate: p.kakaoPositiveReviewRate,
        kakaoReviewKeywords: JSON.parse(p.kakaoReviewKeywords),
        kakaoReviewSource: p.kakaoReviewSource,
        kakaoReviewCollectedAt: p.kakaoReviewCollectedAt,
        score,
      };
      return scored;
    })
    .sort((a, b) => b.score - a.score);
}

export function buildRecommendReason(place: ScoredPlace, travelMinToNext: number | null): string {
  const parts: string[] = [];
  if (place.category === "RESTAURANT" && place.kakaoRating !== null && place.kakaoReviewCount !== null && place.kakaoReviewSource) {
    parts.push(`카카오 평점 ${place.kakaoRating.toFixed(1)} · 후기 ${place.kakaoReviewCount.toLocaleString("ko-KR")}개`);
    if (place.kakaoReviewKeywords.length > 0) parts.push(`후기 키워드: ${place.kakaoReviewKeywords.slice(0, 2).join(", ")}`);
  }
  parts.push(place.localScore >= 0.75 ? `현지인 추천 점수 ${place.localScore.toFixed(2)}` : `로컬점수 ${place.localScore.toFixed(2)}`);
  if (place.tasteTags.length > 0) parts.push(`취향 태그: ${place.tasteTags.slice(0, 2).join(", ")}`);
  if (travelMinToNext !== null) parts.push(`다음 장소까지 약 ${travelMinToNext}분`);
  return parts.join(" · ");
}

function seededUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

/**
 * 취향 적합 점수는 보존하면서 최근 일정에서 반복 노출된 장소에는 cooldown을 준다.
 * 무작위 셔플이 아니라 상위 품질 후보 안에서만 seed 기반 변주를 주므로 재현 가능하며,
 * 사용자가 고정한 장소는 항상 원래 순위를 유지한다.
 */
export function diversifyScoredPlaces(
  places: ScoredPlace[],
  recentUsage: Map<string, number>,
  seed: string,
  protectedPlaceIds: string[] = [],
): ScoredPlace[] {
  if (places.length < 2) return [...places];
  const bestScore = places[0].score;
  const protectedIds = new Set(protectedPlaceIds);
  return places
    .map((place, originalIndex) => {
      const protectedPlace = protectedIds.has(place.id);
      const usagePenalty = protectedPlace ? 0 : Math.min(0.24, (recentUsage.get(place.id) ?? 0) * 0.04);
      const variation = protectedPlace ? 0 : (seededUnit(`${seed}:${place.id}`) - 0.5) * 0.05;
      // 최고점과 차이가 큰 후보가 단지 새롭다는 이유만으로 상위권을 차지하지 못하게 한다.
      const qualityGuard = place.score < bestScore - 0.28 ? 0.5 : 0;
      return { place, originalIndex, rankScore: place.score - usagePenalty + variation - qualityGuard };
    })
    .sort((a, b) => b.rankScore - a.rankScore || a.originalIndex - b.originalIndex)
    .map(({ place }) => place);
}
