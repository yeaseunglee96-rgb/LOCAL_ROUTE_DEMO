import { useEffect, useState } from "react";
import { acceptInvite, ApiUnavailableError, createTrip, generateItinerary, getItinerary, getLodgings, getPlaceCount, reoptimizeDay, undoItineraryChange } from "./api/client";
import { ResultDashboard } from "./pages/ResultDashboard";
import { TripFormPage } from "./pages/TripFormPage";
import { GenerationProgress } from "./components/GenerationProgress";
import type { CreateTripRequest, ItineraryItemOutput, ItineraryJob, ItineraryOutput, PlaceRecord } from "./types";
import { SharedItineraryPage } from "./pages/SharedItineraryPage";

type ViewState =
  | { kind: "form"; initialValues?: Partial<CreateTripRequest> }
  | { kind: "loading"; job?: ItineraryJob }
  | { kind: "result"; tripId: string; itinerary: ItineraryOutput }
  | { kind: "error"; message: string };

function tripMetaToFormValues(itinerary: ItineraryOutput): Partial<CreateTripRequest> {
  const { trip } = itinerary;
  return {
    origin: trip.origin,
    originLat: trip.originLat,
    originLng: trip.originLng,
    startDate: trip.startDate,
    endDate: trip.endDate,
    partySize: trip.partySize,
    adultCount: trip.adultCount,
    childCount: trip.childCount,
    totalBudget: trip.totalBudget,
    hasCar: trip.hasCar,
    pace: trip.pace,
    dayStart: trip.dayStart,
    dayEnd: trip.dayEnd,
    maxWalkingKm: trip.maxWalkingKm,
    recommendationMode: trip.recommendationMode,
    tasteTags: trip.tasteTags,
    courseCategory: trip.courseCategory ?? undefined,
    hasPet: trip.hasPet,
    petSize: trip.petSize ?? undefined,
    petName: trip.petName ?? undefined,
    language: trip.language,
    needsEnglishMenu: trip.needsEnglishMenu,
    needsForeignCard: trip.needsForeignCard,
    petIndoorRequired: trip.petIndoorRequired,
    usesPetCarrier: trip.usesPetCarrier,
    allergies: trip.allergies,
    dietType: trip.dietType,
    needsOnlineReservation: trip.needsOnlineReservation,
    maxTransferCount: trip.maxTransferCount,
    petWeightKg: trip.petWeightKg ?? undefined,
    petCount: trip.petCount,
    usesPetStroller: trip.usesPetStroller,
    petRestaurantRequired: trip.petRestaurantRequired,
    petLodgingRequired: trip.petLodgingRequired,
    lodgingPlaceId: trip.lodgingPlaceId ?? undefined,
    landmarkRatio: trip.landmarkRatio,
    localRatio: trip.localRatio,
    petRatio: trip.petRatio,
  };
}

export default function App() {
  const shareSlug = new URLSearchParams(window.location.search).get("share");
  const [view, setView] = useState<ViewState>({ kind: "form" });
  const [placeCount, setPlaceCount] = useState<number | null>(null);
  const [lodgings, setLodgings] = useState<PlaceRecord[]>([]);
  const [apiOffline, setApiOffline] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [pinnedPlaceIds, setPinnedPlaceIds] = useState<string[]>([]);
  const [excludedPlaceIds, setExcludedPlaceIds] = useState<string[]>([]);

  useEffect(() => {
    getPlaceCount()
      .then((count) => { setPlaceCount(count); setApiOffline(false); })
      .catch((error) => { setPlaceCount(null); setApiOffline(error instanceof ApiUnavailableError); });
    getLodgings().then(setLodgings).catch(() => setLodgings([]));

    if (shareSlug) return;
    const inviteToken = new URLSearchParams(window.location.search).get("invite");
    if (inviteToken) {
      setView({ kind: "loading" });
      acceptInvite(inviteToken).then(({ tripId }) => getItinerary(tripId).then((itinerary) => { window.history.replaceState(null, "", `?trip=${tripId}&mode=${itinerary.mode}`); setView({ kind: "result", tripId, itinerary }); })).catch((error) => setView({ kind: "error", message: error instanceof Error ? error.message : "초대를 수락하지 못했습니다." }));
      return;
    }
    const tripId = new URLSearchParams(window.location.search).get("trip");
    const mode = new URLSearchParams(window.location.search).get("mode") ?? undefined;
    if (tripId) {
      setView({ kind: "loading" });
      getItinerary(tripId, mode)
        .then((itinerary) => setView({ kind: "result", tripId, itinerary }))
        .catch(() => {
          window.history.replaceState(null, "", window.location.pathname);
          setView({ kind: "form" });
        });
    }
  }, [shareSlug]);

  const handleSubmit = async (payload: CreateTripRequest) => {
    setView({ kind: "loading" });
    try {
      const { tripId } = await createTrip(payload);
      const itinerary = await generateItinerary(tripId, (job) => setView({ kind: "loading", job }), payload.recommendationMode);
      window.history.replaceState(null, "", `?trip=${tripId}&mode=${itinerary.mode}`);
      setView({ kind: "result", tripId, itinerary });
    } catch (err: any) {
      setView({ kind: "error", message: err.message ?? "알 수 없는 오류가 발생했습니다." });
    }
  };

  const handleRegenerate = async () => {
    if (view.kind !== "result") return;
    setRegenerating(true);
    try {
      const itinerary = await generateItinerary(view.tripId, undefined, view.itinerary.mode);
      setView({ kind: "result", tripId: view.tripId, itinerary });
    } catch {
      // 재생성 실패는 조용히 무시하고 기존 일정을 유지한다(사용자가 버튼을 다시 누를 수 있음)
    } finally {
      setRegenerating(false);
    }
  };

  const handlePartialReoptimize = async (item: ItineraryItemOutput, dayIndex: number, action: "REMOVE" | "PIN" | "UNPIN" | "REPLACE", replacementPlaceId?: string) => {
    if (view.kind !== "result") return;
    setRegenerating(true);
    try {
      await reoptimizeDay(view.itinerary.itineraryId, dayIndex, { action, itemId: item.itemId, replacementPlaceId });
      const itinerary = await getItinerary(view.tripId);
      if (action === "PIN") setPinnedPlaceIds((ids) => [...new Set([...ids, item.placeId])]);
      if (action === "UNPIN") setPinnedPlaceIds((ids) => ids.filter((id) => id !== item.placeId));
      if (action === "REMOVE") setExcludedPlaceIds((ids) => [...new Set([...ids, item.placeId])]);
      setView({ kind: "result", tripId: view.tripId, itinerary });
    } finally {
      setRegenerating(false);
    }
  };

  const handleUndo = async () => {
    if (view.kind !== "result") return;
    setRegenerating(true);
    try { await undoItineraryChange(view.itinerary.itineraryId); setView({ kind: "result", tripId: view.tripId, itinerary: await getItinerary(view.tripId) }); }
    finally { setRegenerating(false); }
  };

  const handleEdit = () => {
    if (view.kind !== "result") return;
    const initialValues = tripMetaToFormValues(view.itinerary);
    window.history.replaceState(null, "", window.location.pathname);
    setView({ kind: "form", initialValues });
  };

  const renderView = () => {
    if (shareSlug) return <SharedItineraryPage slug={shareSlug} />;

    if (view.kind === "result") {
      return (
        <ResultDashboard
          itinerary={view.itinerary}
          placeCount={placeCount}
          regenerating={regenerating}
          onRegenerate={handleRegenerate}
          onEdit={handleEdit}
          pinnedPlaceIds={pinnedPlaceIds}
          excludedPlaceIds={excludedPlaceIds}
          onPartialReoptimize={handlePartialReoptimize}
          onUndo={handleUndo}
        />
      );
    }

    if (view.kind === "loading") {
      return <GenerationProgress job={view.job} />;
    }

    return (
      <TripFormPage
        onSubmit={handleSubmit}
        submitting={false}
        errorMessage={view.kind === "error" ? view.message : null}
        placeCount={placeCount}
        initialValues={view.kind === "form" ? view.initialValues : undefined}
        lodgings={lodgings}
      />
    );
  };

  return (
    <>
      {apiOffline && (
        <div className="api-offline-banner" role="alert">
          <strong>백엔드 서버에 연결할 수 없습니다</strong>
          <span>
            화면은 표시되지만 장소 조회·일정 생성 등 모든 기능이 동작하지 않습니다.
            프로젝트 루트에서 <code>npm run dev</code> 를 실행하면 서버(:4000)와 웹(:5173)이 함께 실행됩니다.
          </span>
        </div>
      )}
      {renderView()}
    </>
  );
}
