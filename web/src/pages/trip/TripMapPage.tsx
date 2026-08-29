import { SocialExplorationMap } from "../../components/SocialExplorationMap";
import { useTrip } from "./TripContext";

/** /trips/:tripId/map — 독립 발자국 탭: 해무 탐험·도감·방문 기록 */
export function TripMapPage() {
  const { itinerary, tripId } = useTrip();

  return (
    <div className="service-view map-view">
      <header className="service-heading footprint-page-heading">
        <div>
          <span className="section-eyebrow">EXPLORE BUSAN · LEAVE A TRACE</span>
          <h1>부산을 걸을수록 나만의 지도가 열려요</h1>
          <p>직접 방문해 해무를 걷고, 부산 도감을 채우고, 다음 여행자를 위한 발자국을 남겨보세요.</p>
        </div>
        <ol className="footprint-steps" aria-label="발자국 지도 이용 방법"><li><b>01</b><span>일정 장소 방문</span></li><li><b>02</b><span>해무 해제</span></li><li><b>03</b><span>도감·메모 수집</span></li></ol>
      </header>
      <SocialExplorationMap tripId={tripId} itinerary={itinerary} />
    </div>
  );
}
