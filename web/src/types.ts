export type Pace = "RELAXED" | "NORMAL" | "PACKED";
export type RecommendationMode = "ESSENTIAL" | "LOCAL" | "EASY";
export type DietType = "NONE" | "VEGETARIAN" | "VEGAN" | "HALAL" | "GLUTEN_FREE";

export interface CreateTripRequest {
  origin: string;
  originLat: number;
  originLng: number;
  startDate: string;
  endDate: string;
  partySize: number;
  adultCount?: number;
  childCount?: number;
  totalBudget: number;
  hasCar: boolean;
  pace: Pace;
  tasteTags: string[];
  courseCategory?: string;
  mustVisitPlaceIds?: string[];
  mustVisitAssignments?: { placeId: string; dayIndex: number }[];
  recommendationMode?: RecommendationMode;
  dayStart?: string;
  dayEnd?: string;
  maxWalkingKm?: number;
  language?: "KO" | "EN";
  allergies?: string[];
  dietType?: DietType;
  lodgingPlaceId?: string;
  landmarkRatio?: number;
  localRatio?: number;
  easyRatio?: number;
}

export interface TripMeta {
  origin: string;
  courseCategory: string | null;
  originLat: number;
  originLng: number;
  startDate: string;
  endDate: string;
  partySize: number;
  adultCount: number;
  childCount: number;
  totalBudget: number;
  hasCar: boolean;
  pace: Pace;
  dayStart: string;
  dayEnd: string;
  maxWalkingKm: number;
  recommendationMode: RecommendationMode;
  tasteTags: string[];
  language: "KO" | "EN";
  allergies: string[];
  dietType: DietType;
  lodgingPlaceId: string | null;
  lodgingName: string | null;
  lodgingAddress: string | null;
  landmarkRatio: number;
  localRatio: number;
  easyRatio: number;
}

export interface ItineraryItemOutput {
  itemId?: string;
  seqOrder: number;
  placeId: string;
  nameKo: string;
  nameEn: string | null;
  category: string;
  address: string;
  addressEn: string | null;
  allergens: string[];
  dietOptions: string[];
  onlineReservation: boolean;
  lat: number;
  lng: number;
  openTime: string;
  closeTime: string;
  plannedArrival: string;
  stayMinutes: number;
  estCost: number;
  travelMinToNext: number | null;
  distanceToNextM: number | null;
  travelIsEstimate: boolean;
  travelSource: "KAKAO_MOBILITY" | "HAVERSINE";
  recommendReason: string;
  hasEnglishMenu: boolean;
  foreignCardPayment: boolean;
  localScore: number;
  dataSource: string;
  imageUrl: string | null;
  kakaoPlaceId: string | null;
  kakaoPlaceUrl: string | null;
  kakaoRating: number | null;
  kakaoReviewCount: number | null;
  kakaoPositiveReviewRate: number | null;
  kakaoReviewKeywords: string[];
  kakaoReviewSource: string | null;
  kakaoReviewCollectedAt: string | null;
}

export interface ItineraryDayOutput {
  dayIndex: number;
  visitDate: string;
  dayBudget: number;
  totalEstCost: number;
  startTravelMin: number | null;
  startDistanceM: number | null;
  startTravelIsEstimate: boolean;
  returnTravelMin: number | null;
  returnDistanceM: number | null;
  returnTravelIsEstimate: boolean;
  items: ItineraryItemOutput[];
}

export interface ItineraryOutput {
  itineraryId: string;
  tripId: string;
  trip: TripMeta;
  days: ItineraryDayOutput[];
  warnings: string[];
  solverSource: "OR_TOOLS" | "HEURISTIC";
  mode: RecommendationMode;
}

export interface PlaceRecord {
  id: string;
  nameKo?: string;
  category: string;
  address?: string;
}

export interface ItineraryJob {
  jobId: string;
  tripId: string;
  status: "QUEUED" | "RUNNING" | "DONE" | "FAILED";
  stage: "QUEUED" | "COLLECTING" | "SCORING" | "OPTIMIZING" | "VALIDATING" | "DONE" | "FAILED";
  progress: number;
  resultItineraryId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface PlaceAlternative {
  placeId: string;
  nameKo: string;
  nameEn: string | null;
  category: string;
  address: string;
  score: number;
  localScore: number;
  estCost: number;
  hasEnglishMenu: boolean;
  foreignCardPayment: boolean;
}

export interface SponsoredPlacement {
  campaignId: string;
  placeId: string;
  nameKo: string;
  nameEn: string | null;
  category: string;
  imageUrl: string | null;
  label: string;
  disclosure: string;
}

export interface BookingOption { id: string; provider: string; }

export interface Festival { placeId: string; eventType?: "FESTIVAL" | "NIGHT_MARKET" | "TRADITIONAL_MARKET"; title: string; titleEn: string | null; address: string; lat: number; lng: number; startDate: string; endDate: string; playTime: string | null; imageUrl: string | null; localScore: number; officialUrl?: string }
export interface SouvenirShop { id: string; nameKo: string; nameEn: string | null; address: string; lat: number; lng: number; distanceM: number; items: string[]; openTime: string; closeTime: string; cardPayment: boolean; foreignAssistance: boolean; localScore: number; imageUrl: string | null; sponsored: false }
export interface WeatherForecast { date: string; tempMin: number; tempMax: number; rainProbability: number; sky: "CLEAR" | "CLOUDY" | "RAIN"; isEstimate: boolean; source: string; outdoorWarning: boolean }
export interface LocationSearchResult { id: string; name: string; address: string; lat: number; lng: number; category: string }
export interface CourseCategory { code: string; nameKo: string; nameEn: string; axis: "BUDGET" | "MOOD" | "THEME" | "MOBILITY" | "COMPANION" | "SITUATION"; summaryKo: string; enabled: boolean; disabledReason?: string; boostTasteTags?: string[]; scheduleParams?: { pace?: Pace; transport?: string; stayMinutesScale?: number; maxWalkDistanceScale?: number; dayEndTimeCap?: string; forbidTimeRange?: { after?: string } } }
export interface PlaceImageMatch { imageUrl: string | null; sourceUrl: string | null; provider: "DATABASE" | "NAVER" | "GOOGLE" | null; title: string | null }
export interface RouteStep { guidance: string; durationMin: number; distanceM: number; vehicle: string | null; destinationStop?: string | null; path: [number, number][] }
export interface TransitAlternative { id: string; label: string; distanceM: number; durationMin: number; fare: number | null; transfers: number | null; steps: RouteStep[]; path: [number, number][]; isEstimate: boolean }
export interface EmbeddedRoute { mode: "TRANSIT" | "CAR"; distanceM: number; durationMin: number; fare: number | null; transfers: number | null; transferDifficulty: "EASY" | "MODERATE" | "HARD" | null; steps: RouteStep[]; path: [number, number][]; isEstimate: boolean; source: "KAKAO_MAP" | "KAKAO_MOBILITY" | "ESTIMATE"; alternatives?: TransitAlternative[] }
export interface TaxiCard { placeId: string; nameKo: string; nameEn: string | null; addressKo: string; phraseKo: string }
export interface StoryRecord { id: string; authorId: string; authorLabel: string; placeId: string; placeName: string; content: string; images: string[]; visibility: string; visitVerified: boolean; areaLabel: string; publishAt: string; moderationStatus: string; createdAt: string; isFollowing: boolean; mine: boolean }
export interface SharedItinerary { shareSlug: string; authorId: string; expiresAt: string; viewCount: number; cloneCount: number; trip: { startDate: string; endDate: string; partySize: number; pace: string; language: "KO" | "EN" }; itinerary: { id: string; mode: string; days: { dayIndex: number; visitDate: string; items: { itemId: string; seqOrder: number; plannedArrival: string; stayMinutes: number; nameKo: string; nameEn: string | null; category: string; address: string; lat: number; lng: number }[] }[] } }
