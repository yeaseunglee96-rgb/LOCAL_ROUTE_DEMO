import { SocialExplorationMap } from "../../components/SocialExplorationMap";
import { useTrip } from "./TripContext";

/**
 * /trips/:tripId/map — 지도 전체보기
 * 목록 없이 지도만 확대해 전체 동선과 기념품샵 레이어를 함께 본다.
 */
export function TripMapPage() {
  const { itinerary, tripId } = useTrip();

  return (
    <div className="service-view map-view">
      <header className="service-heading">
        <div>
          <span className="section-eyebrow">LOCAL FOOTPRINTS</span>
          <h1>부산의 발자국을 만나요</h1>
          <p>내가 걸은 곳의 해무를 걷고, 동행과 여행자들이 남긴 검증된 팁을 발견하세요.</p>
        </div>
      </header>
      <SocialExplorationMap tripId={tripId} itinerary={itinerary} />
    </div>
  );
}
