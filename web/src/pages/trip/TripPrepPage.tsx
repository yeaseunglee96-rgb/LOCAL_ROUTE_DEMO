import { useEffect, useState } from "react";
import { InfoCards } from "../../components/InfoCards";
import { ShareBar } from "../../components/ShareBar";
import { BusanDialectWidget } from "../../components/BusanDialectWidget";
import { PrepSectionNav } from "../../components/PrepSectionNav";
import { getBookingOptions, startBooking } from "../../api/client";
import type { BookingOption } from "../../types";
import { useTrip } from "./TripContext";

/** /trips/:tripId/prep — 필요한 항목만 펼쳐 보는 여행 전 체크리스트 */
export function TripPrepPage() {
  const { itinerary, itemProps, tripId } = useTrip();
  const [bookingOptions, setBookingOptions] = useState<BookingOption[]>([]);
  const lang = itemProps.language;

  useEffect(() => {
    if (!itinerary.trip.lodgingPlaceId) { setBookingOptions([]); return; }
    getBookingOptions(itinerary.trip.lodgingPlaceId).then(setBookingOptions).catch(() => setBookingOptions([]));
  }, [itinerary.trip.lodgingPlaceId]);

  return (
    <div className="service-view prep-view">
      <PrepSectionNav tripId={tripId} active="prep" />
      <header className="service-heading">
        <div>
          <span className="section-eyebrow">BEFORE YOU GO</span>
          <h1>{lang === "EN" ? "Ready for your trip" : "여행 전 필요한 것만 확인하세요"}</h1>
          <p>{lang === "EN" ? "Open only the information you need." : "동행, 경비, 예약 정보를 필요한 순간에 펼쳐볼 수 있어요."}</p>
        </div>
      </header>

      <section className="prep-primary-grid" aria-label="핵심 여행 준비">
        <ShareBar itineraryId={itinerary.itineraryId} tripId={itinerary.tripId} language={itinerary.trip.language} />
        <InfoCards itinerary={itinerary} />
      </section>

      {bookingOptions.length > 0 && (
        <section className="booking-strip prep-booking-strip" aria-label="숙소 예약 제휴">
          <div><strong>숙소 예약 확인</strong><span>가격과 객실 조건을 제휴사에서 최종 확인하세요.</span></div>
          <div className="booking-fold-content">{bookingOptions.map((option) => (
            <button type="button" key={option.id} onClick={async () => {
              const booking = await startBooking(option.id, itinerary.tripId);
              window.open(booking.bookingUrl, "_blank", "noopener,noreferrer");
            }}>{option.provider}에서 예약 확인 <small>제휴 링크</small></button>
          ))}</div>
        </section>
      )}

      <BusanDialectWidget language={lang} />

      <details className="prep-data-note"><summary>추천·비용 데이터 안내</summary><p>식당은 승인된 카카오 평점·후기 집계가 있을 때만 추천 점수에 반영하며, 비용과 실시간 교통 미연동 구간은 추정값으로 구분합니다.</p></details>
    </div>
  );
}
