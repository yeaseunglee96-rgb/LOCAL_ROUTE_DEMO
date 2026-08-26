import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../components/DashboardShell";
import type { CourseCategory, CreateTripRequest, DietType, Pace, PlaceRecord, RecommendationMode } from "../types";
import { getCourseCategories } from "../api/client";
import { setUiLanguage } from "../i18n";
import { OriginPicker } from "../components/OriginPicker";
import { DesiredPlacesPicker, type DesiredPlace } from "../components/DesiredPlacesPicker";
import type { LocationSearchResult } from "../types";

import { DesiredFoodPicker } from "../components/DesiredFoodPicker";
import { TravelMoodPicker, findMood, type TravelMood } from "../components/TravelMoodPicker";

const ORIGINS: LocationSearchResult[] = [
  { id: "preset-busan-station", name: "부산역", address: "부산 동구 중앙대로 206", lat: 35.1152, lng: 129.0403, category: "교통" },
  { id: "preset-haeundae", name: "해운대", address: "부산 해운대구 해운대해변로", lat: 35.1587, lng: 129.1604, category: "지역" },
];
const TAGS = [
  ["food", "맛집"], ["cafe", "카페"], ["nature", "자연"], ["photo", "사진"], ["history", "역사"],
  ["culture", "문화"], ["experience", "체험"], ["shopping", "쇼핑"], ["activity", "액티비티"],
  ["nightview", "야경"],
  ["hidden_local", "숨은 로컬 명소"], ["landmark", "대표 관광지"],
] as const;
const TAG_LABEL_EN: Record<string, string> = { food: "Food", cafe: "Cafe", nature: "Nature", photo: "Photo", history: "History", culture: "Culture", experience: "Activity", shopping: "Shopping", activity: "Action", nightview: "Nightview", hidden_local: "Hidden Local", landmark: "Landmark" };
const TAG_LABEL_KO: Record<string, string> = Object.fromEntries(TAGS.map(([slug, label]) => [slug, label]));
function tagLabel(slug: string, language: "KO" | "EN") { return language === "EN" ? TAG_LABEL_EN[slug] ?? slug : TAG_LABEL_KO[slug] ?? slug; }
const MODES: { value: RecommendationMode; title: string; description: string }[] = [
  { value: "ESSENTIAL", title: "관광 필수 코스", description: "대표 명소와 접근성을 우선해요." },
  { value: "LOCAL", title: "현지인 코스", description: "로컬 점수와 숨은 장소를 더 중요하게 봐요." },
];
const STEPS = ["기본 정보", "취향·모드", "최종 확인"];
const PACE_LABEL_KO: Record<Pace, string> = { RELAXED: "여유롭게", NORMAL: "균형 있게", PACKED: "알차게" };
const PACE_LABEL_EN: Record<Pace, string> = { RELAXED: "Relaxed", NORMAL: "Normal", PACKED: "Packed" };
function paceLabel(value: Pace, language: "KO" | "EN") { return language === "EN" ? PACE_LABEL_EN[value] : PACE_LABEL_KO[value]; }
function transportLabel(value: boolean, language: "KO" | "EN") {
  if (language === "EN") return value ? "By Car" : "Public Transit";
  return value ? "자차 이용" : "대중교통 이용";
}

/**
 * 코스 카테고리가 권장하는 이동 수단.
 * CAR_OR_WALK 처럼 어느 쪽이든 성립하는 코스는 null 을 돌려 사용자의 선택을 그대로 둔다.
 */
function courseSuggestedHasCar(transport: string | undefined): boolean | null {
  if (!transport) return null;
  if (transport.startsWith("WALK")) return false;
  if (transport === "CAR" || transport.startsWith("CAR_OR_TAXI")) return true;
  return null;
}

function todayPlus(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); }

interface Props {
  onSubmit: (payload: CreateTripRequest) => void;
  submitting: boolean;
  errorMessage: string | null;
  placeCount: number | null;
  initialValues?: Partial<CreateTripRequest>;
  lodgings: PlaceRecord[];
  /** 라우터가 단계를 URL(/plan/:step)로 제어할 때 사용. 없으면 컴포넌트 내부 상태로 동작한다. */
  step?: number;
  onStepChange?: (step: number) => void;
}

export function TripFormPage({ onSubmit, submitting, errorMessage, placeCount, initialValues, step: controlledStep, onStepChange }: Props) {
  const initialOrigin = ORIGINS.find((item) => item.name === initialValues?.origin) ?? (initialValues?.origin ? { id: "initial-origin", name: initialValues.origin, address: initialValues.origin, lat: initialValues.originLat ?? ORIGINS[0].lat, lng: initialValues.originLng ?? ORIGINS[0].lng, category: "선택한 출발지" } : ORIGINS[0]);
  const [uncontrolledStep, setUncontrolledStep] = useState(0);
  // 단계는 URL 이 진실이다. 라우터가 step 을 내려주면 그 값을 쓰고, 아니면 내부 상태로 폴백한다.
  const step = controlledStep ?? uncontrolledStep;
  const setStep = (next: number | ((previous: number) => number)) => {
    const value = typeof next === "function" ? (next as (previous: number) => number)(step) : next;
    if (onStepChange) onStepChange(value); else setUncontrolledStep(value);
  };
  const [origin, setOrigin] = useState<LocationSearchResult>(initialOrigin);
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? todayPlus(14));
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? todayPlus(16));
  const [partySize, setPartySize] = useState(initialValues?.partySize ?? 2);
  const [totalBudget, setTotalBudget] = useState(initialValues?.totalBudget ?? 300000);
  const [hasCar, setHasCar] = useState(initialValues?.hasCar ?? false);
  const [pace, setPace] = useState<Pace>(initialValues?.pace ?? "NORMAL");
  // STEP 1 에서 사용자가 직접 만진 값인지 기억한다. 코스 카테고리가 이 값을 말없이 덮어쓰면 안 된다.
  const [paceTouched, setPaceTouched] = useState(false);
  const [transportTouched, setTransportTouched] = useState(false);
  const [coursePresetNotice, setCoursePresetNotice] = useState<{ pace?: Pace; hasCar?: boolean } | null>(null);
  const [dayStart, setDayStart] = useState(initialValues?.dayStart ?? "09:30");
  const [dayEnd, setDayEnd] = useState(initialValues?.dayEnd ?? "20:00");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialValues?.tasteTags ?? ["food", "cafe", "hidden_local"]);
  const [mode, setMode] = useState<RecommendationMode>(initialValues?.recommendationMode === "ESSENTIAL" ? "ESSENTIAL" : "LOCAL");
  const [courseCategories, setCourseCategories] = useState<CourseCategory[]>([]);
  const [courseCategory, setCourseCategory] = useState(initialValues?.courseCategory ?? "");
  const [language, setLanguage] = useState<"KO" | "EN">(initialValues?.language ?? "KO");
  useEffect(() => setUiLanguage(language), [language]);
  useEffect(() => { getCourseCategories().then(setCourseCategories).catch(() => setCourseCategories([])); }, []);
  const [allergyText, setAllergyText] = useState((initialValues?.allergies ?? []).join(", "));
  const [dietType, setDietType] = useState<DietType>(initialValues?.dietType ?? "NONE");
  const [desiredFoods, setDesiredFoods] = useState<string[]>(initialValues?.desiredFoods ?? ["milmyeon", "dwaeji_gukbap"]);
  const [desiredPlaces, setDesiredPlaces] = useState<DesiredPlace[]>(
    (initialValues?.mustVisitAssignments ?? []).map((a) => ({ placeId: a.placeId, name: a.placeId, address: "", dayIndex: a.dayIndex }))
  );
  // 무드 카드로 고른 값인지, 사용자가 세부 설정을 직접 만진 값인지 구분한다.
  const [selectedMoodId, setSelectedMoodId] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const nights = Math.max(0, Math.round((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000));
  const numDays = nights + 1;
  const selectedMode = MODES.find((item) => item.value === mode)!;
  const recommendationRatios = mode === "ESSENTIAL"
    ? { landmarkRatio: 70, localRatio: 20, easyRatio: 10 }
    : { landmarkRatio: 10, localRatio: 80, easyRatio: 10 };
  const selectedCourse = courseCategories.find((category) => category.code === courseCategory) ?? null;
  const selectedMood = findMood(selectedMoodId);

  /**
   * 코스 카테고리 선택.
   * 코스마다 권장 페이스·이동수단이 있지만, STEP 1 에서 사용자가 직접 고른 값은 덮어쓰지 않는다.
   * 아직 손대지 않은 값에만 코스 권장값을 채우고, 직접 고른 값과 어긋나면 안내만 띄워 사용자가 정하게 한다.
   */
  const selectCourseCategory = (category: CourseCategory) => {
    setCourseCategory(category.code);
    const suggestedPace = category.scheduleParams?.pace ?? null;
    const suggestedHasCar = courseSuggestedHasCar(category.scheduleParams?.transport);
    const conflict: { pace?: Pace; hasCar?: boolean } = {};
    if (suggestedPace && suggestedPace !== pace) {
      if (paceTouched) conflict.pace = suggestedPace; else setPace(suggestedPace);
    }
    if (suggestedHasCar !== null && suggestedHasCar !== hasCar) {
      if (transportTouched) conflict.hasCar = suggestedHasCar; else setHasCar(suggestedHasCar);
    }
    setCoursePresetNotice(conflict.pace !== undefined || conflict.hasCar !== undefined ? conflict : null);
  };

  const applyCoursePreset = () => {
    if (!coursePresetNotice) return;
    if (coursePresetNotice.pace) setPace(coursePresetNotice.pace);
    if (coursePresetNotice.hasCar !== undefined) setHasCar(coursePresetNotice.hasCar);
    setCoursePresetNotice(null);
  };

  /**
   * 무드 카드 한 장으로 모드·코스 카테고리·취향 태그를 한 번에 정한다.
   * 코스 카테고리에 딸린 페이스·이동수단 권장값은 기존 규칙(직접 고른 값은 안 덮어씀)을 그대로 탄다.
   */
  const applyMood = (mood: TravelMood) => {
    setSelectedMoodId(mood.id);
    setMode(mood.mode);
    setSelectedTags(mood.tasteTags);
    const category = courseCategories.find((item) => item.code === mood.courseCategory);
    if (category) selectCourseCategory(category);
    else { setCourseCategory(""); setCoursePresetNotice(null); }
  };

  /** 세부 설정을 직접 만지면 더 이상 특정 무드와 같다고 말할 수 없다. */
  const detachMood = () => setSelectedMoodId(null);
  const canContinue = step !== 0 || (Boolean(origin.address && startDate && endDate) && endDate >= startDate && partySize > 0 && totalBudget >= 10000 && dayEnd > dayStart);

  const payload = useMemo<CreateTripRequest>(() => ({
    origin: origin.name, originLat: origin.lat, originLng: origin.lng, startDate, endDate, partySize, adultCount: partySize, childCount: 0, totalBudget,
    hasCar, pace,
    tasteTags: [...new Set([...selectedTags, ...(selectedCourse?.boostTasteTags ?? []), mode === "ESSENTIAL" ? "landmark" : "hidden_local"])], courseCategory: courseCategory || undefined,
    recommendationMode: mode, dayStart, dayEnd,
    maxWalkingKm: 100, language,
    allergies: allergyText.split(",").map((value) => value.trim()).filter(Boolean), dietType,
    desiredFoods,
    mustVisitPlaceIds: desiredPlaces.map((place) => place.placeId),
    mustVisitAssignments: desiredPlaces.map((place) => ({ placeId: place.placeId, dayIndex: Math.min(Math.max(place.dayIndex, 1), numDays) })),
    ...recommendationRatios,
  }), [origin, startDate, endDate, partySize, totalBudget, hasCar, pace, selectedTags, selectedCourse, courseCategory, mode, dayStart, dayEnd, language, allergyText, dietType, desiredFoods, desiredPlaces, numDays]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step < STEPS.length - 1) { if (canContinue) setStep((value) => value + 1); return; }
    onSubmit(payload);
  };

  return <DashboardShell placeCount={placeCount} language={language}>
    <div className="planner-page">
      <header className="planner-hero"><span className="eyebrow">현지인 추천 기반 여행</span><h1>부산을 마음껏 즐기세요</h1><p>장소를 나열하는 대신 운영시간, 이동시간, 예산과 동반 조건을 함께 계산합니다.</p></header>
      <ol className="stepper" aria-label="여행 계획 입력 단계">{STEPS.map((label, index) => <li key={label} className={index === step ? "active" : index < step ? "done" : ""}><button type="button" onClick={() => index <= step && setStep(index)} aria-current={index === step ? "step" : undefined}><span>{index + 1}</span><b>{label}</b><small>{index < step ? "완료" : index === step ? "작성 중" : "대기"}</small></button></li>)}</ol>
      <form className="planner-card" onSubmit={submit}>
        {step === 0 && <section aria-labelledby="basic-title">
          <div className="section-heading">
            <div><span>STEP 1</span><h2 id="basic-title">{language === "EN" ? "Tell us your dates and travel range" : "여행의 시간과 이동 범위를 알려주세요"}</h2></div>
            <p>{language === "EN" ? "You can change these options anytime later." : "나중에 언제든 다시 바꿀 수 있어요."}</p>
          </div>
          <OriginPicker value={origin} onChange={setOrigin} />
          <div className="form-grid two basic-details-grid">
            <label className="field party-field">
              <span>{language === "EN" ? "Travelers" : "인원"}</span>
              <div className="input-suffix">
                <input aria-label="여행 인원" type="number" min={1} max={20} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} />
                <b>{language === "EN" ? "person(s)" : "명"}</b>
              </div>
              <small>{language === "EN" ? "Enter the total number of travelers." : "함께 이동하는 전체 인원을 입력해주세요."}</small>
            </label>
            <fieldset className="field range-field trip-date-field">
              <legend>{language === "EN" ? "Trip Dates" : "여행 기간"}</legend>
              <div>
                <label><span>{language === "EN" ? "Start" : "가는 날"}</span><input aria-label="여행 시작일" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
                <i>–</i>
                <label><span>{language === "EN" ? "End" : "오는 날"}</span><input aria-label="여행 종료일" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label>
              </div>
              <small>{language === "EN" ? "Select trip start and end dates from the calendar." : "달력에서 여행의 시작일과 종료일을 선택해주세요."}</small>
            </fieldset>
            <fieldset className="field range-field trip-time-field">
              <legend>{language === "EN" ? "Daily Hours" : "여행 시간대"}</legend>
              <div>
                <label><span>{language === "EN" ? "Start" : "시작"}</span><input aria-label="여행 시간대 시작" type="time" value={dayStart} onChange={(event) => setDayStart(event.target.value)} /></label>
                <i>–</i>
                <label><span>{language === "EN" ? "End" : "종료"}</span><input aria-label="여행 시간대 종료" type="time" value={dayEnd} onChange={(event) => setDayEnd(event.target.value)} /></label>
              </div>
              <small>{language === "EN" ? "Daily operating hours for your itinerary." : "매일 일정을 진행할 시간 범위입니다."}</small>
            </fieldset>
            <label className="field budget-field">
              <span>{language === "EN" ? "Total Budget" : "총 예산"}</span>
              <div className="input-suffix">
                <input aria-label="여행 총 예산" type="number" min={10000} step={10000} value={totalBudget} onChange={(e) => setTotalBudget(Number(e.target.value))} />
                <b>{language === "EN" ? "KRW" : "원"}</b>
              </div>
              <small>{language === "EN" ? "Total budget excluding hotel lodging costs." : "숙박비를 제외한 전체 여행 예산입니다."}</small>
            </label>
          </div>
          <div className="transport-style-row">
            <div>
              <span>{language === "EN" ? "Primary Transport" : "주요 이동 수단"}</span>
              <div className="choice-row" role="group" aria-label="이동 수단">
                <button type="button" className={!hasCar ? "selected" : ""} onClick={() => { setHasCar(false); setTransportTouched(true); }}>{language === "EN" ? "Public Transit" : "대중교통 이용"}</button>
                <button type="button" className={hasCar ? "selected" : ""} onClick={() => { setHasCar(true); setTransportTouched(true); }}>{language === "EN" ? "By Car" : "자차 이용"}</button>
              </div>
            </div>
            <label className="field compact">
              <span>{language === "EN" ? "Travel Pace" : "여행 스타일"}</span>
              <select value={pace} onChange={(e) => { setPace(e.target.value as Pace); setPaceTouched(true); }}>
                <option value="RELAXED">{language === "EN" ? "Relaxed · Up to 3 stops" : "여유롭게 · 하루 최대 3곳"}</option>
                <option value="NORMAL">{language === "EN" ? "Normal · Up to 4 stops" : "균형 있게 · 하루 최대 4곳"}</option>
                <option value="PACKED">{language === "EN" ? "Packed · Up to 6 stops" : "알차게 · 하루 최대 6곳"}</option>
              </select>
            </label>
          </div>
          <div className="form-grid two diet-allergy-grid" style={{ marginTop: "20px" }}>
            <label className="field">
              <span>{language === "EN" ? "Dietary Option" : "식단"}</span>
              <select value={dietType} onChange={(e) => setDietType(e.target.value as DietType)}>
                <option value="NONE">{language === "EN" ? "No Restrictions" : "제한 없음"}</option>
                <option value="VEGETARIAN">{language === "EN" ? "Vegetarian" : "채식"}</option>
                <option value="VEGAN">{language === "EN" ? "Vegan" : "비건"}</option>
                <option value="HALAL">{language === "EN" ? "Halal" : "할랄"}</option>
                <option value="GLUTEN_FREE">{language === "EN" ? "Gluten-Free" : "글루텐 프리"}</option>
              </select>
            </label>
            <label className="field">
              <span>{language === "EN" ? "Allergens" : "알레르기 성분"}</span>
              <input value={allergyText} onChange={(e) => setAllergyText(e.target.value)} placeholder={language === "EN" ? "e.g., Peanut, Shellfish, Milk" : "예: 땅콩, 갑각류, 우유"} />
              <small>{language === "EN" ? "Separate with commas." : "쉼표로 구분해주세요. 정보가 없으면 확인 필요로 표시됩니다."}</small>
            </label>
          </div>
        </section>}

        {step === 1 && <section aria-labelledby="taste-title">
          <div className="section-heading">
            <div><span>STEP 2</span><h2 id="taste-title">{language === "EN" ? "What kind of Busan do you want?" : "어떤 부산을 만나고 싶나요?"}</h2></div>
            <p>{language === "EN" ? "Pick one — that's enough. Everything below is optional." : "하나만 고르면 충분해요. 아래는 모두 선택 사항입니다."}</p>
          </div>

          <TravelMoodPicker value={selectedMoodId} onSelect={applyMood} language={language} />

          <p className="mood-summary" role="status">
            {selectedMood
              ? (language === "EN"
                  ? `${selectedMood.titleEn} · ${selectedTags.map((slug) => tagLabel(slug, "EN")).join(", ")}`
                  : `${selectedMood.titleKo} · ${selectedTags.map((slug) => tagLabel(slug, "KO")).join(", ")}`)
              : (language === "EN"
                  ? `Custom setting · ${selectedTags.map((slug) => tagLabel(slug, "EN")).join(", ") || "no tags"}`
                  : `직접 설정 · ${selectedTags.map((slug) => tagLabel(slug, "KO")).join(", ") || "선택한 태그 없음"}`)}
          </p>

          {coursePresetNotice && <div className="course-preset-notice" role="status">
            <p>
              {language === "EN"
                ? `This course usually runs as ${[coursePresetNotice.pace && paceLabel(coursePresetNotice.pace, "EN"), coursePresetNotice.hasCar !== undefined && transportLabel(coursePresetNotice.hasCar, "EN")].filter(Boolean).join(" · ")}, but we kept what you picked in Step 1.`
                : `이 무드는 보통 ${[coursePresetNotice.pace && paceLabel(coursePresetNotice.pace, "KO"), coursePresetNotice.hasCar !== undefined && transportLabel(coursePresetNotice.hasCar, "KO")].filter(Boolean).join(" · ")}로 진행돼요. STEP 1에서 고르신 조건을 그대로 두었습니다.`}
            </p>
            <div className="course-preset-notice-actions">
              <button type="button" onClick={applyCoursePreset}>{language === "EN" ? "Use course setting" : "추천값으로 변경"}</button>
              <button type="button" className="ghost" onClick={() => setCoursePresetNotice(null)}>{language === "EN" ? "Keep mine" : "내 선택 유지"}</button>
            </div>
          </div>}

          {/* 세부 설정은 접어둔다. 고르고 싶은 사람은 열 수 있고, 고민되는 사람은 지나칠 수 있다. */}
          <details className="advanced-block" open={advancedOpen} onToggle={(event) => setAdvancedOpen((event.target as HTMLDetailsElement).open)}>
            <summary>
              <b>{language === "EN" ? "Fine-tune it myself" : "세부 취향 직접 고르기"}</b>
              <small>{language === "EN" ? "Mode, course theme and tags" : "추천 모드 · 코스 카테고리 · 취향 태그"}</small>
            </summary>

            <div className="advanced-body">
              <div className="mode-grid" role="radiogroup" aria-label={language === "EN" ? "Recommendation mode" : "추천 모드"}>
                {MODES.map((item, index) => (
                  <button type="button" role="radio" aria-checked={mode === item.value} key={item.value} className={mode === item.value ? "selected" : ""} onClick={() => { setMode(item.value); detachMood(); }}>
                    <span className="mode-number">0{index + 1}</span>
                    <strong>{language === "EN" ? (item.value === "ESSENTIAL" ? "Essential Tourist Sights" : "Local Hidden Gems") : item.title}</strong>
                    <small>{language === "EN" ? (item.value === "ESSENTIAL" ? "Prioritize famous landmarks and easy access." : "Focus on local scores and hidden spots.") : item.description}</small>
                  </button>
                ))}
              </div>

              <section className="course-category-section" aria-labelledby="course-category-title">
                <div className="course-category-heading">
                  <div><span>COURSE CATEGORY · 10</span><h3 id="course-category-title">{language === "EN" ? "Course theme" : "코스 카테고리"}</h3></div>
                  <p>{language === "EN" ? "Adjusts pace, budget weighting and place mix." : "페이스·예산 가중치·장소 구성을 함께 조정합니다."}</p>
                </div>
                <div className="course-category-grid" role="radiogroup" aria-label="코스 카테고리">
                  <button type="button" role="radio" aria-checked={!courseCategory} className={!courseCategory ? "selected" : ""} onClick={() => { setCourseCategory(""); setCoursePresetNotice(null); detachMood(); }}>
                    <span>GENERAL</span>
                    <strong>{language === "EN" ? "Standard Course" : "기본 코스"}</strong>
                    <small>{language === "EN" ? "General itinerary based on preferences" : "별도 카테고리 없이 취향을 중심으로 구성"}</small>
                  </button>
                  {courseCategories.map((category, index) => (
                    <button type="button" role="radio" aria-checked={courseCategory === category.code} className={courseCategory === category.code ? "selected" : ""} key={category.code} onClick={() => { selectCourseCategory(category); detachMood(); }}>
                      <span>{String(index + 1).padStart(2, "0")} · {category.axis}</span>
                      <strong>{language === "EN" ? category.nameEn : category.nameKo}</strong>
                      <small>{category.summaryKo}</small>
                    </button>
                  ))}
                </div>
              </section>

              <div className="field" style={{ marginTop: "24px" }}>
                <span>{language === "EN" ? `Trip Tags · ${selectedTags.length} selected` : `여행 취향 · ${selectedTags.length}개 선택`}</span>
                <div className="tag-grid">
                  {TAGS.map(([slug]) => {
                    const selected = selectedTags.includes(slug);
                    return <button type="button" aria-pressed={selected} key={slug} className={`tag-chip ${selected ? "selected" : ""}`} onClick={() => { setSelectedTags((prev) => selected ? prev.filter((tag) => tag !== slug) : [...prev, slug]); detachMood(); }}>{selected && <span aria-hidden="true">✓ </span>}{tagLabel(slug, language)}</button>;
                  })}
                </div>
              </div>
            </div>
          </details>

          <details className="advanced-block">
            <summary>
              <b>{language === "EN" ? "Dishes I want to try" : "꼭 먹고 싶은 음식"}</b>
              <small>{desiredFoods.length ? (language === "EN" ? `${desiredFoods.length} selected` : `${desiredFoods.length}개 선택됨`) : (language === "EN" ? "Optional" : "선택 사항")}</small>
            </summary>
            <div className="advanced-body">
              <DesiredFoodPicker selectedFoods={desiredFoods} onChange={setDesiredFoods} language={language} />
            </div>
          </details>

          <details className="advanced-block">
            <summary>
              <b>{language === "EN" ? "Places I must visit" : "꼭 가고 싶은 장소"}</b>
              <small>{desiredPlaces.length ? (language === "EN" ? `${desiredPlaces.length} added` : `${desiredPlaces.length}곳 추가됨`) : (language === "EN" ? "Optional" : "선택 사항")}</small>
            </summary>
            <div className="advanced-body">
              <DesiredPlacesPicker numDays={numDays} value={desiredPlaces} onChange={setDesiredPlaces} />
            </div>
          </details>
        </section>}

        {step === 2 && <section aria-labelledby="confirm-title">
          <div className="section-heading">
            <div><span>STEP 3</span><h2 id="confirm-title">{language === "EN" ? "Generate schedule with these options?" : "이 조건으로 일정을 계산할까요?"}</h2></div>
            <p>{language === "EN" ? "Our scheduler optimizes opening hours, travel time, and budget." : "최종 결정은 추천 점수와 제약조건 스케줄러가 수행합니다."}</p>
          </div>
          <div className="confirm-hero">
            <div>
              <div>
                <strong>{selectedMood
                  ? (language === "EN" ? selectedMood.titleEn : selectedMood.titleKo)
                  : `${language === "EN" ? (mode === "ESSENTIAL" ? "Essential Tourist Sights" : "Local Hidden Gems") : selectedMode.title}${selectedCourse ? ` × ${language === "EN" ? selectedCourse.nameEn : selectedCourse.nameKo}` : ""}`}</strong>
                <p>{origin.name} · {nights}N {nights + 1}D · {partySize} {language === "EN" ? "traveler(s)" : "인"} · {transportLabel(hasCar, language)}</p>
              </div>
            </div>
            <b>₩{totalBudget.toLocaleString()}</b>
          </div>
          <dl className="confirm-list">
            <div><dt>{language === "EN" ? "Daily Hours" : "여행 시간대"}</dt><dd>{dayStart}–{dayEnd}</dd></div>
            <div><dt>{language === "EN" ? "Travel Pace" : "여행 스타일"}</dt><dd>{paceLabel(pace, language)}</dd></div>
            <div><dt>{language === "EN" ? "Primary Transport" : "주요 이동 수단"}</dt><dd>{transportLabel(hasCar, language)}</dd></div>
            <div><dt>{language === "EN" ? "Selected Tags" : "선택 취향"}</dt><dd>{selectedTags.length ? selectedTags.map((slug) => tagLabel(slug, language)).join(", ") : (language === "EN" ? "Default" : "기본값")}</dd></div>
          </dl>
        </section>}

        {errorMessage && <div className="error-box" role="alert"><strong>{language === "EN" ? "Could not generate schedule." : "일정을 만들지 못했어요."}</strong><span>{errorMessage}</span></div>}
        <div className="form-actions">
          {step > 0 && <button type="button" className="secondary-btn" onClick={() => setStep((value) => value - 1)}>{language === "EN" ? "Back" : "이전"}</button>}
          <button type="submit" className="primary-btn" disabled={submitting || !canContinue}>
            {step === STEPS.length - 1 ? (submitting ? (language === "EN" ? "Calculating..." : "계산 중…") : (language === "EN" ? "Generate Itinerary" : "일정 생성")) : (language === "EN" ? "Next" : "다음")}
          </button>
        </div>
      </form>
    </div>
  </DashboardShell>;
}

