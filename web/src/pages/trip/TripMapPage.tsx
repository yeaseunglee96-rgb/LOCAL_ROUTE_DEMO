import { Link } from "react-router-dom";
import { SocialExplorationMap } from "../../components/SocialExplorationMap";
import { paths } from "../../routes/paths";
import { useTrip } from "./TripContext";

/**
 * /trips/:tripId/map — 지도 전체보기
 * 목록 없이 지도만 확대해 전체 동선과 기념품샵 레이어를 함께 본다.
 */
export function TripMapPage() {
  const { itinerary, tripId } = useTrip();

  return (
    <div className="service-view map-view">
      <nav className="together-section-nav" aria-label="함께 탭 화면">
        <Link to={paths.tripTogether(tripId)}>여행자 피드</Link>
        <Link className="active" aria-current="page" to={paths.tripMap(tripId)}>발자국 지도</Link>
      </nav>
      <header className="service-heading">
        <div>
          <span className="section-eyebrow">LOCAL FOOTPRINTS</span>
          <h1>발자국 지도</h1>
          <p>내가 걸은 곳의 해무를 걷고, 동행과 여행자들이 남긴 검증된 팁을 발견하세요.</p>
        </div>
      </header>
      <SocialExplorationMap tripId={tripId} itinerary={itinerary} />
    </div>
  );
}
