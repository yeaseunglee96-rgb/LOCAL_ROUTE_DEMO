import type { ItineraryDayOutput } from "../types";
import type { ItineraryItemOutput } from "../types";
import { ItemCard, TravelSegment } from "./ItemCard";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const DAY_LABELS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateLabel(dateStr: string, language: "KO" | "EN"): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const md = dateStr.slice(5).replace("-", ".");
  return `${md} (${(language === "EN" ? DAY_LABELS_EN : DAY_LABELS)[d.getDay()]})`;
}

interface Props {
  days: ItineraryDayOutput[];
  hasCar: boolean;
  pinnedPlaceIds: string[];
  busy: boolean;
  language: "KO" | "EN";
  onTogglePin: (item: ItineraryItemOutput) => void;
  onExclude: (item: ItineraryItemOutput) => void;
  onReplace: (item: ItineraryItemOutput) => void;
  onSelect: (item: ItineraryItemOutput) => void;
}

export function ScheduleSummaryList({ days, hasCar, pinnedPlaceIds, busy, language, onTogglePin, onExclude, onReplace, onSelect }: Props) {
  const en = language === "EN";
  return (
    <div className="schedule-summary">
      {days.map((day) => (
        <div key={day.dayIndex} className="summary-day-block">
          <div className="summary-day-header">
            <span className="summary-day-badge">DAY {day.dayIndex}</span>
            <span className="summary-day-date">{formatDateLabel(day.visitDate, language)}</span>
          </div>
          <div className="summary-item-list">
            {day.startTravelMin !== null && <div className="base-travel-note">{en ? `From base · ${day.startTravelMin} min to first stop${day.startTravelIsEstimate ? " (estimated)" : ""}` : `기준점 출발 · 첫 장소까지 ${day.startTravelMin}분${day.startTravelIsEstimate ? " (추정)" : ""}`}</div>}
            {day.items.map((item) => <div key={item.placeId + item.seqOrder}><ItemCard item={item} language={language} pinned={pinnedPlaceIds.includes(item.placeId)} busy={busy} onTogglePin={onTogglePin} onExclude={onExclude} onReplace={onReplace} onSelect={onSelect} />{day.petBreaks.filter((rest) => rest.afterPlaceId === item.placeId).map((rest) => <div className="pet-break-card" key={rest.afterPlaceId}>🐾 {rest.startTime} · {en ? `Large-dog walk & water break ${rest.durationMin} min` : `${rest.label} ${rest.durationMin}분`}</div>)}<TravelSegment item={item} hasCar={hasCar} language={language} /></div>)}
            {day.returnTravelMin !== null && <div className="base-travel-note">{en ? `Return to base · ${day.returnTravelMin} min${day.returnTravelIsEstimate ? " (estimated)" : ""}` : `기준점 복귀 · ${day.returnTravelMin}분${day.returnTravelIsEstimate ? " (추정)" : ""}`}</div>}
            {day.items.length === 0 && <p className="item-empty">{en ? "No stops assigned to this date." : "이 날짜에 배정된 일정이 없습니다."}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
