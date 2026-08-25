import { useEffect, useMemo, useState } from "react";
import { DashboardShell } from "../components/DashboardShell";
import type { CourseCategory, CreateTripRequest, DietType, Pace, PlaceRecord, RecommendationMode } from "../types";
import { getCourseCategories } from "../api/client";
import { setUiLanguage } from "../i18n";
import { OriginPicker } from "../components/OriginPicker";
import { DesiredPlacesPicker, type DesiredPlace } from "../components/DesiredPlacesPicker";
import type { LocationSearchResult } from "../types";

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
const MODES: { value: RecommendationMode; title: string; description: string }[] = [
  { value: "ESSENTIAL", title: "관광 필수 코스", description: "대표 명소와 접근성을 우선해요." },
  { value: "LOCAL", title: "현지인 코스", description: "로컬 점수와 숨은 장소를 더 중요하게 봐요." },
];
const STEPS = ["기본 정보", "취향·모드", "최종 확인"];

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
  const [desiredPlaces, setDesiredPlaces] = useState<DesiredPlace[]>(
    (initialValues?.mustVisitAssignments ?? []).map((a) => ({ placeId: a.placeId, name: a.placeId, address: "", dayIndex: a.dayIndex }))
  );
  const nights = Math.max(0, Math.round((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000));
  const numDays = nights + 1;
  const selectedMode = MODES.find((item) => item.value === mode)!;
  const recommendationRatios = mode === "ESSENTIAL"
    ? { landmarkRatio: 70, localRatio: 20, easyRatio: 10 }
    : { landmarkRatio: 10, localRatio: 80, easyRatio: 10 };
  const selectedCourse = courseCategories.find((category) => category.code === courseCategory) ?? null;
  const canContinue = step !== 0 || (Boolean(origin.address && startDate && endDate) && endDate >= startDate && partySize > 0 && totalBudget >= 10000 && dayEnd > dayStart);

  const payload = useMemo<CreateTripRequest>(() => ({
    origin: origin.name, originLat: origin.lat, originLng: origin.lng, startDate, endDate, partySize, adultCount: partySize, childCount: 0, totalBudget,
    hasCar, pace,
    tasteTags: [...new Set([...selectedTags, ...(selectedCourse?.boostTasteTags ?? []), mode === "ESSENTIAL" ? "landmark" : "hidden_local"])], courseCategory: courseCategory || undefined,
    recommendationMode: mode, dayStart, dayEnd,
    maxWalkingKm: 100, language,
    allergies: allergyText.split(",").map((value) => value.trim()).filter(Boolean), dietType,
    mustVisitPlaceIds: desiredPlaces.map((place) => place.placeId),
    mustVisitAssignments: desiredPlaces.map((place) => ({ placeId: place.placeId, dayIndex: Math.min(Math.max(place.dayIndex, 1), numDays) })),
    ...recommendationRatios,
  }), [origin, startDate, endDate, partySize, totalBudget, hasCar, pace, selectedTags, selectedCourse, courseCategory, mode, dayStart, dayEnd, language, allergyText, dietType, desiredPlaces, numDays]);

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
          <div className="section-heading"><div><span>STEP 1</span><h2 id="basic-title">여행의 시간과 이동 범위를 알려주세요</h2></div><p>나중에 언제든 다시 바꿀 수 있어요.</p></div>
          <OriginPicker value={origin} onChange={setOrigin} />
          <div className="form-grid two basic-details-grid">
            <label className="field party-field"><span>인원</span><div className="input-suffix"><input aria-label="여행 인원" type="number" min={1} max={20} value={partySize} onChange={(event) => setPartySize(Number(event.target.value))} /><b>명</b></div><small>함께 이동하는 전체 인원을 입력해주세요.</small></label>
            <fieldset className="field range-field trip-date-field"><legend>여행 기간</legend><div><label><span>가는 날</span><input aria-label="여행 시작일" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label><i>–</i><label><span>오는 날</span><input aria-label="여행 종료일" type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required /></label></div><small>달력에서 여행의 시작일과 종료일을 선택해주세요.</small></fieldset>
            <fieldset className="field range-field trip-time-field"><legend>여행 시간대</legend><div><label><span>시작</span><input aria-label="여행 시간대 시작" type="time" value={dayStart} onChange={(event) => setDayStart(event.target.value)} /></label><i>–</i><label><span>종료</span><input aria-label="여행 시간대 종료" type="time" value={dayEnd} onChange={(event) => setDayEnd(event.target.value)} /></label></div><small>매일 일정을 진행할 시간 범위입니다.</small></fieldset>
            <label className="field budget-field"><span>총 예산</span><div className="input-suffix"><input aria-label="여행 총 예산" type="number" min={10000} step={10000} value={totalBudget} onChange={(e) => setTotalBudget(Number(e.target.value))} /><b>원</b></div><small>숙박비를 제외한 전체 여행 예산입니다.</small></label>
          </div>
          <div className="transport-style-row"><div><span>주요 이동 수단</span><div className="choice-row" role="group" aria-label="이동 수단"><button type="button" className={!hasCar ? "selected" : ""} onClick={() => setHasCar(false)}>대중교통 이용</button><button type="button" className={hasCar ? "selected" : ""} onClick={() => setHasCar(true)}>자차 이용</button></div></div><label className="field compact"><span>여행 스타일</span><select value={pace} onChange={(e) => setPace(e.target.value as Pace)}><option value="RELAXED">여유롭게 · 하루 최대 3곳</option><option value="NORMAL">균형 있게 · 하루 최대 4곳</option><option value="PACKED">알차게 · 하루 최대 6곳</option></select></label></div>
          <div className="form-grid two diet-allergy-grid" style={{ marginTop: "20px" }}>
            <label className="field"><span>식단</span><select value={dietType} onChange={(e) => setDietType(e.target.value as DietType)}><option value="NONE">제한 없음</option><option value="VEGETARIAN">채식</option><option value="VEGAN">비건</option><option value="HALAL">할랄</option><option value="GLUTEN_FREE">글루텐 프리</option></select></label>
            <label className="field"><span>알레르기 성분</span><input value={allergyText} onChange={(e) => setAllergyText(e.target.value)} placeholder="예: 땅콩, 갑각류, 우유" /><small>쉼표로 구분해주세요. 정보가 없으면 확인 필요로 표시됩니다.</small></label>
          </div>
        </section>}

        {step === 1 && <section aria-labelledby="taste-title">
          <div className="section-heading"><div><span>STEP 2</span><h2 id="taste-title">어떤 부산을 만나고 싶나요?</h2></div><p>선택한 취향은 추천 점수의 근거로 표시됩니다.</p></div>
          <div className="mode-grid" role="radiogroup" aria-label="추천 모드">{MODES.map((item, index) => <button type="button" role="radio" aria-checked={mode === item.value} key={item.value} className={mode === item.value ? "selected" : ""} onClick={() => setMode(item.value)}><span className="mode-number">0{index + 1}</span><strong>{item.title}</strong><small>{item.description}</small></button>)}</div>
          <section className="course-category-section" aria-labelledby="course-category-title"><div className="course-category-heading"><div><span>COURSE CATEGORY · 10</span><h3 id="course-category-title">어떤 성격의 여행을 원하나요?</h3></div><p>추천 모드와 코스 카테고리를 함께 적용합니다.</p></div><div className="course-category-grid" role="radiogroup" aria-label="코스 카테고리"><button type="button" role="radio" aria-checked={!courseCategory} className={!courseCategory ? "selected" : ""} onClick={() => setCourseCategory("")}><span>GENERAL</span><strong>기본 코스</strong><small>별도 카테고리 없이 취향을 중심으로 구성</small></button>{courseCategories.map((category, index) => <button type="button" role="radio" aria-checked={courseCategory === category.code} className={courseCategory === category.code ? "selected" : ""} key={category.code} onClick={() => { setCourseCategory(category.code); if (category.scheduleParams?.pace) setPace(category.scheduleParams.pace); const transport = category.scheduleParams?.transport ?? ""; if (transport.startsWith("WALK")) setHasCar(false); else if (transport === "CAR" || transport.startsWith("CAR_OR_TAXI")) setHasCar(true); }}><span>{String(index + 1).padStart(2, "0")} · {{ BUDGET: "예산", MOOD: "분위기", THEME: "테마", MOBILITY: "이동", COMPANION: "동행", SITUATION: "상황" }[category.axis]}</span><strong>{language === "EN" ? category.nameEn : category.nameKo}</strong><small>{category.summaryKo}</small></button>)}</div></section>
          <div className="field"><span>여행 취향 · {selectedTags.length}개 선택</span><div className="tag-grid">{TAGS.map(([slug, label]) => { const selected = selectedTags.includes(slug); return <button type="button" aria-pressed={selected} key={slug} className={`tag-chip ${selected ? "selected" : ""}`} onClick={() => setSelectedTags((prev) => selected ? prev.filter((tag) => tag !== slug) : [...prev, slug])}>{selected && <span aria-hidden="true">✓ </span>}{label}</button>; })}</div><small>선택하지 않으면 거리와 로컬 점수를 중심으로 계산합니다.</small></div>
          <DesiredPlacesPicker numDays={numDays} value={desiredPlaces} onChange={setDesiredPlaces} />
        </section>}

        {step === 2 && <section aria-labelledby="confirm-title">
          <div className="section-heading"><div><span>STEP 3</span><h2 id="confirm-title">이 조건으로 일정을 계산할까요?</h2></div><p>최종 결정은 추천 점수와 제약조건 스케줄러가 수행합니다.</p></div>
          <div className="confirm-hero"><div><div><strong>{selectedMode.title}{selectedCourse ? ` × ${selectedCourse.nameKo}` : ""}</strong><p>{origin.name} 출발 · {nights}박 {nights + 1}일 · {partySize}인 · {hasCar ? "자차 이용" : "대중교통 이용"}</p></div></div><b>{totalBudget.toLocaleString()}원</b></div>
          <dl className="confirm-list"><div><dt>여행 시간대</dt><dd>{dayStart}–{dayEnd}</dd></div><div><dt>여행 스타일</dt><dd>{{ RELAXED: "여유롭게", NORMAL: "균형 있게", PACKED: "알차게" }[pace]}</dd></div><div><dt>선택 취향</dt><dd>{selectedTags.length ? TAGS.filter(([slug]) => selectedTags.includes(slug)).map(([, label]) => label).join(", ") : "거리·로컬 점수 중심"}</dd></div><div><dt>식단 / 알레르기</dt><dd>{[dietType !== "NONE" && dietType, allergyText].filter(Boolean).join(" / ") || "제한 없음"}</dd></div>{desiredPlaces.length > 0 && <div><dt>직접 추가한 장소</dt><dd>{desiredPlaces.map((place) => `${place.name}(${Math.min(Math.max(place.dayIndex, 1), numDays)}일차)`).join(", ")}</dd></div>}</dl>
          <div className="truth-callout"><strong>계산 조건 확인</strong><p>운영시간, 이동시간, 예산과 동반 조건을 함께 검증합니다. 알레르기·식단 정보가 없는 장소는 안전하다고 추정하지 않습니다.</p></div>
        </section>}

        {errorMessage && <div className="error-box" role="alert"><strong>일정을 만들지 못했어요.</strong><span>{errorMessage}</span><small>예산을 늘리거나 조건을 완화한 뒤 다시 시도해보세요.</small></div>}
        <div className="form-actions">{step > 0 && <button type="button" className="secondary-btn" onClick={() => setStep((value) => value - 1)}>이전</button>}<button type="submit" className="primary-btn" disabled={submitting || !canContinue}>{step === STEPS.length - 1 ? (submitting ? "계산 중…" : "조건 기반 일정 계산") : "다음"}</button></div>
      </form>
    </div>
  </DashboardShell>;
}

