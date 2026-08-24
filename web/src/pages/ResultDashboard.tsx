import { useEffect, useState } from "react";
import { DashboardShell } from "../components/DashboardShell";
import { DayTimeline } from "../components/DayTimeline";
import { FilterRow } from "../components/FilterRow";
import { InfoCards } from "../components/InfoCards";
import { MapPanel } from "../components/MapPanel";
import { ScheduleSummaryList } from "../components/ScheduleSummaryList";
import { ShareBar } from "../components/ShareBar";
import { TopSummaryBar } from "../components/TopSummaryBar";
import { ExperiencePanel } from "../components/ExperiencePanel";
import { SocialPanel } from "../components/SocialPanel";
import { OverviewHub } from "../components/OverviewHub";
import type { DashboardTab } from "../components/Sidebar";
import { getAlternatives, getBookingOptions, getCollaboration, getSponsoredPlacements, startBooking, trackAd } from "../api/client";
import type { BookingOption, ItineraryItemOutput, ItineraryOutput, PlaceAlternative, SponsoredPlacement } from "../types";
import { setUiLanguage } from "../i18n";

type Tab = "summary" | "detail";
interface Props {
  itinerary: ItineraryOutput;
  placeCount: number | null;
  regenerating: boolean;
  onRegenerate: () => void;
  onEdit: () => void;
  pinnedPlaceIds: string[];
  excludedPlaceIds: string[];
  onPartialReoptimize: (item: ItineraryItemOutput, dayIndex: number, action: "REMOVE" | "PIN" | "UNPIN" | "REPLACE", replacementPlaceId?: string) => Promise<void>;
  onUndo: () => Promise<void>;
}

export function ResultDashboard({ itinerary, placeCount, regenerating, onRegenerate, onEdit, pinnedPlaceIds, onPartialReoptimize, onUndo }: Props) {
  const { originLat, originLng } = itinerary.trip;
  useEffect(() => { setUiLanguage(itinerary.trip.language); document.documentElement.dataset.allergies = JSON.stringify(itinerary.trip.allergies); document.documentElement.dataset.diet = itinerary.trip.dietType; }, [itinerary.trip.language, itinerary.trip.allergies, itinerary.trip.dietType]);
  const [tab, setTab] = useState<Tab>("summary");
  const [serviceTab, setServiceTab] = useState<DashboardTab>(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    return (["home", "schedule", "discover", "together", "prep"] as DashboardTab[]).includes(requested as DashboardTab) ? requested as DashboardTab : "home";
  });
  const [activeDayIndex, setActiveDayIndex] = useState(itinerary.days[0]?.dayIndex ?? 1);
  const [mapDayIndex, setMapDayIndex] = useState<number | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [pendingExclude, setPendingExclude] = useState<ItineraryItemOutput | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingReplace, setPendingReplace] = useState<ItineraryItemOutput | null>(null);
  const [alternatives, setAlternatives] = useState<PlaceAlternative[]>([]);
  const [sponsored, setSponsored] = useState<SponsoredPlacement[]>([]);
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([]);
  const [myRole, setMyRole] = useState<string>("VIEWER");
  useEffect(() => { getCollaboration(itinerary.itineraryId).then((state) => setMyRole(state.myRole)).catch(() => setMyRole("VIEWER")); }, [itinerary.itineraryId]);
  const canEdit = myRole === "OWNER" || myRole === "EDITOR";
  const changeServiceTab = (next: DashboardTab) => {
    setServiceTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  useEffect(() => {
    if (serviceTab !== "prep") return;
    getSponsoredPlacements({ mode: itinerary.mode, hasPet: itinerary.trip.hasPet, language: itinerary.trip.language }).then((placements) => {
      setSponsored(placements);
      placements.forEach((placement) => void trackAd(placement.campaignId, "impressions"));
    }).catch(() => setSponsored([]));
  }, [serviceTab, itinerary.mode, itinerary.trip.hasPet, itinerary.trip.language]);
  useEffect(() => {
    if (serviceTab !== "prep") return;
    if (!itinerary.trip.lodgingPlaceId) { setBookingOptions([]); return; }
    getBookingOptions(itinerary.trip.lodgingPlaceId).then(setBookingOptions).catch(() => setBookingOptions([]));
  }, [serviceTab, itinerary.trip.lodgingPlaceId]);
  const dayOf = (item: ItineraryItemOutput) => itinerary.days.find((day) => day.items.some((candidate) => candidate.placeId === item.placeId))?.dayIndex ?? 1;

  const togglePin = async (item: ItineraryItemOutput) => {
    const action = pinnedPlaceIds.includes(item.placeId) ? "UNPIN" : "PIN";
    await onPartialReoptimize(item, dayOf(item), action);
    setNotice(action === "PIN" ? `${item.nameKo}을(를) 고정하고 해당 날짜만 다시 계산했습니다.` : `${item.nameKo} 고정을 해제했습니다.`);
  };
  const confirmExclude = async () => {
    if (!pendingExclude) return;
    await onPartialReoptimize(pendingExclude, dayOf(pendingExclude), "REMOVE");
    setNotice(`${pendingExclude.nameKo}을(를) 제외하고 해당 날짜만 다시 계산했습니다.`);
    setPendingExclude(null);
  };
  const openAlternatives = async (item: ItineraryItemOutput) => {
    if (!item.itemId) return;
    setPendingReplace(item);
    setAlternatives(await getAlternatives(itinerary.itineraryId, item.itemId));
  };
  const replaceWith = async (alternative: PlaceAlternative) => {
    if (!pendingReplace) return;
    await onPartialReoptimize(pendingReplace, dayOf(pendingReplace), "REPLACE", alternative.placeId);
    setNotice(`${pendingReplace.nameKo}을(를) ${alternative.nameKo}(으)로 교체하고 해당 날짜만 다시 계산했습니다.`);
    setPendingReplace(null);
    setAlternatives([]);
  };

  const itemProps = {
    hasCar: itinerary.trip.hasCar, pinnedPlaceIds, busy: regenerating || !canEdit, language: itinerary.trip.language, onTogglePin: togglePin,
    onExclude: setPendingExclude, onReplace: openAlternatives, onSelect: (item: ItineraryItemOutput) => setSelectedPlaceId(item.placeId),
  };

  return <DashboardShell placeCount={placeCount} pet={itinerary.trip.hasPet ? { name: itinerary.trip.petName, size: itinerary.trip.petSize! } : null} language={itinerary.trip.language} activeTab={serviceTab} onTabChange={changeServiceTab}>
    {notice && <div className="action-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="알림 닫기">×</button></div>}
    {serviceTab === "home" && <div className="service-view home-view"><TopSummaryBar itinerary={itinerary} onEdit={onEdit} onRegenerate={onRegenerate} regenerating={regenerating} canEdit={canEdit} /><OverviewHub itinerary={itinerary} onNavigate={changeServiceTab} /><FilterRow trip={itinerary.trip} /></div>}

    {serviceTab === "schedule" && <div className="service-view"><header className="service-heading"><div><span className="section-eyebrow">ROUTE PLANNER</span><h1>동선 보며 일정 짜기</h1><p>날짜별 경로를 보고 장소를 고정하거나 교체할 수 있어요.</p></div><div className="service-heading-actions">{canEdit && <button type="button" className="secondary-btn" onClick={onEdit}>여행 조건 수정</button>}<button type="button" className="primary-btn" onClick={onRegenerate} disabled={regenerating || !canEdit}>{regenerating ? "계산 중…" : "일정 다시 계산"}</button></div></header>
      {itinerary.warnings.length > 0 && <details className="warnings"><summary>일정 검증 참고사항 {itinerary.warnings.length}건</summary><ul>{itinerary.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
      {canEdit && <div className="undo-row"><button type="button" className="secondary-btn" disabled={regenerating} onClick={onUndo}>최근 변경 취소</button></div>}
      <div className="dashboard-columns schedule-workspace"><section className={`dashboard-left schedule-list-canvas ${tab === "summary" ? "all-days" : "single-day"}`} aria-label="여행 일정"><div className="schedule-toolbar"><div className="tab-switch" role="tablist"><button type="button" role="tab" aria-selected={tab === "summary"} className={`tab-btn ${tab === "summary" ? "active" : ""}`} onClick={() => setTab("summary")}>전체 일정</button><button type="button" role="tab" aria-selected={tab === "detail"} className={`tab-btn ${tab === "detail" ? "active" : ""}`} onClick={() => setTab("detail")}>날짜별 보기</button></div><span>{pinnedPlaceIds.length ? `고정 장소 ${pinnedPlaceIds.length}곳` : "장소를 고정하거나 제외해 다시 계산할 수 있어요"}</span></div>{tab === "summary" ? <ScheduleSummaryList days={itinerary.days} {...itemProps} /> : <DayTimeline days={itinerary.days} activeDayIndex={activeDayIndex} onSelectDay={setActiveDayIndex} {...itemProps} />}</section><aside className="dashboard-right"><MapPanel days={itinerary.days} originLat={originLat} originLng={originLng} activeDayIndex={mapDayIndex} onActiveDayChange={setMapDayIndex} selectedPlaceId={selectedPlaceId} showPetSafety={itinerary.trip.hasPet} showSouvenirControl={false} /></aside></div>
    </div>}

    {serviceTab === "discover" && <div className="service-view"><header className="service-heading"><div><span className="section-eyebrow">LOCAL BUSAN</span><h1>부산의 로컬을 만나요</h1><p>여행 기간에 열리는 축제와 야시장, 가까운 기념품샵을 확인하세요.</p></div></header><ExperiencePanel itinerary={itinerary} canEdit={canEdit} /></div>}

    {serviceTab === "together" && <div className="service-view"><header className="service-heading"><div><span className="section-eyebrow">TRAVEL TOGETHER</span><h1>함께 여행하고 기록해요</h1><p>여행자들의 순간을 둘러보고, 내가 팔로우한 여행 기록에 집중해보세요.</p></div></header><SocialPanel itinerary={itinerary} /></div>}

    {serviceTab === "prep" && <div className="service-view prep-view"><header className="service-heading"><div><span className="section-eyebrow">READY TO GO</span><h1>여행 준비를 한곳에서</h1><p>예산과 지역 여행 팁을 확인하고, 동행자와 같은 일정을 준비하세요.</p></div></header>{sponsored.length > 0 && <section className="sponsored-strip" aria-label="광고"><div><strong>여행 조건에 맞는 필수 서비스</strong><span>자연 추천 일정과 분리된 유료 노출입니다.</span></div>{sponsored.map((placement) => <article key={placement.campaignId}><span className="sponsored-label">{placement.label}</span><b>{itinerary.trip.language === "EN" ? placement.nameEn ?? placement.nameKo : placement.nameKo}</b><small>{placement.disclosure}</small><button type="button" onClick={() => void trackAd(placement.campaignId, "clicks")}>서비스 확인</button></article>)}</section>}{bookingOptions.length > 0 && <section className="booking-strip" aria-label="숙소 예약 제휴"><div><strong>선택한 숙소 예약 확인</strong><span>외부 제휴사에서 가격과 반려동물 객실을 최종 확인하세요.</span></div>{bookingOptions.map((option) => <button type="button" key={option.id} onClick={async () => { const booking = await startBooking(option.id, itinerary.tripId); window.open(booking.bookingUrl, "_blank", "noopener,noreferrer"); }}>{option.provider}에서 예약 확인 <small>제휴 링크</small></button>)}</section>}<InfoCards itinerary={itinerary} collaboration={<ShareBar itineraryId={itinerary.itineraryId} tripId={itinerary.tripId} language={itinerary.trip.language} />} /><div className="data-honesty-bar"><strong>데이터 안내</strong><span>식당은 승인된 카카오 평점·후기 집계가 있을 때만 추천 점수에 반영합니다.</span><span>비용과 실시간 교통 미연동 구간은 추정값으로 구분합니다.</span></div></div>}

    {pendingExclude && <div className="modal-backdrop" role="presentation" onMouseDown={() => !regenerating && setPendingExclude(null)}><div className="decision-modal" role="dialog" aria-modal="true" aria-labelledby="exclude-title" onKeyDown={(event) => { if (event.key === "Escape" && !regenerating) setPendingExclude(null); }} onMouseDown={(event) => event.stopPropagation()}><span className="modal-icon">↻</span><h2 id="exclude-title">{pendingExclude.nameKo}을(를) 제외할까요?</h2><p>이 장소를 제외 목록에 저장하고, 고정 장소와 다른 날짜는 유지한 채 <strong>해당 날짜만 다시 계산</strong>합니다.</p><div className="impact-preview"><span>유지</span><b>고정 장소·다른 날짜</b><span>변경 가능</span><b>현재 날짜의 방문지·시간·이동거리</b></div><div className="form-actions"><button autoFocus type="button" className="secondary-btn" disabled={regenerating} onClick={() => setPendingExclude(null)}>취소</button><button type="button" className="primary-btn" disabled={regenerating} onClick={confirmExclude}>{regenerating ? "다시 계산 중…" : "제외하고 다시 계산"}</button></div></div></div>}
    {pendingReplace && <div className="modal-backdrop" role="presentation"><div className="decision-modal alternative-modal" role="dialog" aria-modal="true" aria-labelledby="replace-title" onKeyDown={(event) => { if (event.key === "Escape") { setPendingReplace(null); setAlternatives([]); } }}><h2 id="replace-title">{pendingReplace.nameKo} 대체 장소</h2><p>같은 카테고리에서 현재 조건을 통과한 후보입니다. 교체하면 해당 날짜만 다시 계산됩니다.</p><div className="alternative-list">{alternatives.map((alternative, index) => <button autoFocus={index === 0} type="button" key={alternative.placeId} disabled={regenerating} onClick={() => replaceWith(alternative)}><strong>{alternative.nameKo}</strong><span>로컬 {(alternative.localScore * 5).toFixed(1)}/5 · 예상 {alternative.estCost.toLocaleString()}원</span><small>{[alternative.petFriendly && "반려동물", alternative.hasEnglishMenu && "영어 메뉴", alternative.foreignCardPayment && "해외카드"].filter(Boolean).join(" · ") || "추가 편의정보 없음"}</small></button>)}</div><button type="button" className="secondary-btn" onClick={() => { setPendingReplace(null); setAlternatives([]); }}>취소</button></div></div>}
  </DashboardShell>;
}
