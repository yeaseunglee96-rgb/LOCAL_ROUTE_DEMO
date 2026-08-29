import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFogMap } from "../../api/client";
import { SocialPanel } from "../../components/SocialPanel";
import { paths } from "../../routes/paths";
import type { FogMapState } from "../../types";
import { useTrip } from "./TripContext";

/** /trips/:tripId/together — 스토리 피드와 팔로우 */
export function TripTogetherPage() {
  const { itinerary, tripId } = useTrip();
  const [fog, setFog] = useState<FogMapState | null>(null);
  useEffect(() => { getFogMap(tripId).then(setFog).catch(() => setFog(null)); }, [tripId]);

  return (
    <div className="service-view">
      <header className="service-heading">
        <div>
          <span className="section-eyebrow">TRAVEL TOGETHER</span>
          <h1>함께 여행하고 기록해요</h1>
          <p>여행자들의 순간을 둘러보고, 내가 팔로우한 여행 기록에 집중해보세요.</p>
        </div>
      </header>
      <nav className="together-section-nav" aria-label="함께 탭 화면">
        <Link className="active" aria-current="page" to={paths.tripTogether(tripId)}>여행자 피드</Link>
        <Link to={paths.tripMap(tripId)}>발자국 지도</Link>
      </nav>
      <section className="footprint-entry-card" aria-labelledby="footprint-entry-title">
        <div className="footprint-entry-copy">
          <span>BUSAN SEA FOG</span>
          <h2 id="footprint-entry-title">부산 해무를 걷고 발자국을 남겨요</h2>
          <p>일정 장소에서 방문을 인증하면 해무가 걷힙니다. 동행과 다른 여행자가 남긴 인증 핀에서는 후기와 댓글도 확인할 수 있어요.</p>
          <ul><li>내 일정 핀을 눌러 방문 시작</li><li>10분 체류 후 GPS 방문 인증</li><li>해무 해제 · 음식 도감 · 여행 메모 핀</li></ul>
        </div>
        <div className="footprint-entry-progress">
          <span>내 탐험</span><strong>{fog?.progress.clearedCellCount ?? 0}칸</strong>
          <small>{fog?.progress.districtCount ?? 0}개 동네 · 음식 도감 {fog?.dex.unlockedCount ?? 0}/{fog?.dex.totalCount ?? 12}</small>
          <Link className="primary-btn" to={paths.tripMap(tripId)}>발자국 지도 열기</Link>
        </div>
      </section>
      <SocialPanel itinerary={itinerary} />
    </div>
  );
}
