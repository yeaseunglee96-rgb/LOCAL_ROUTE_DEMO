import type { Pace, TripMeta } from "../types";

const PACE_LABEL: Record<Pace, string> = {
  RELAXED: "여유로운 힐링",
  NORMAL: "균형 있게",
  PACKED: "알차게",
};

const PET_SIZE_LABEL: Record<string, string> = {
  SMALL: "소형견 (~7kg)",
  MEDIUM: "중형견 (7~15kg)",
  LARGE: "대형견 (15kg~)",
};

interface Props {
  trip: TripMeta;
}

export function FilterRow({ trip }: Props) {
  const en = trip.language === "EN";
  const nights = Math.max(
    0,
    Math.round(
      (new Date(`${trip.endDate}T00:00:00`).getTime() - new Date(`${trip.startDate}T00:00:00`).getTime()) / 86400000
    )
  );

  return (
    <div className="filter-row">
      <div className="filter-pill">
        <div>
          <div className="filter-label">{en ? "Trip dates" : "여행 기간"}</div>
          <div className="filter-value">
            {trip.startDate} ~ {trip.endDate} {en ? `(${nights} nights, ${nights + 1} days)` : `(${nights}박${nights + 1}일)`}
          </div>
        </div>
      </div>
      <div className="filter-pill">
        <div>
          <div className="filter-label">{en ? "Daily hours" : "하루 활동"}</div>
          <div className="filter-value">{trip.dayStart}–{trip.dayEnd}</div>
        </div>
      </div>
      <div className="filter-pill">
        <div>
          <div className="filter-label">{en ? "Budget per traveler" : "1인 예산"}</div>
          <div className="filter-value">
            {en ? `about ₩${Math.round(trip.totalBudget / Math.max(1, trip.partySize)).toLocaleString()}` : `약 ${Math.round(trip.totalBudget / Math.max(1, trip.partySize)).toLocaleString()}원`}
          </div>
        </div>
      </div>
      <div className="filter-pill">
        <div>
          <div className="filter-label">{en ? "Transport" : "이동 수단"}</div>
          <div className="filter-value">{en ? (trip.hasCar ? "Car" : "Public transit") : (trip.hasCar ? "자차 이용" : "대중교통 이용")}</div>
        </div>
      </div>
      <div className="filter-pill">
        <div>
          <div className="filter-label">{en ? "Travel style" : "여행 스타일"}</div>
          <div className="filter-value">{en ? ({ RELAXED: "Relaxed", NORMAL: "Normal", PACKED: "Packed" }[trip.pace]) : PACE_LABEL[trip.pace]}</div>
        </div>
      </div>
      <div className="filter-pill">
        <div>
          <div className="filter-label">{en ? "Traveling with a dog" : "반려견 동반"}</div>
          <div className="filter-value">
            {en ? (trip.hasPet && trip.petSize ? `${trip.petSize.toLowerCase()} dog` : "None") : (trip.hasPet && trip.petSize ? PET_SIZE_LABEL[trip.petSize] : "없음")}
          </div>
        </div>
      </div>
    </div>
  );
}
