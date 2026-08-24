import type { ItineraryDayOutput } from "../types";
import type { ItineraryItemOutput } from "../types";
import { ItemCard, TravelSegment } from "./ItemCard";

interface Props {
  days: ItineraryDayOutput[];
  activeDayIndex: number;
  onSelectDay: (dayIndex: number) => void;
  hasCar: boolean;
  pinnedPlaceIds: string[];
  busy: boolean;
  language: "KO" | "EN";
  onTogglePin: (item: ItineraryItemOutput) => void;
  onExclude: (item: ItineraryItemOutput) => void;
  onReplace: (item: ItineraryItemOutput) => void;
  onSelect: (item: ItineraryItemOutput) => void;
}

export function DayTimeline({ days, activeDayIndex, onSelectDay, hasCar, pinnedPlaceIds, busy, language, onTogglePin, onExclude, onReplace, onSelect }: Props) {
  const day = days.find((d) => d.dayIndex === activeDayIndex) ?? days[0];
  const en = language === "EN";

  return (
    <div className="timeline">
      <div className="day-tabs">
        {days.map((d) => (
          <button
            key={d.dayIndex}
            type="button"
            className={`day-tab ${d.dayIndex === day.dayIndex ? "active" : ""}`}
            onClick={() => onSelectDay(d.dayIndex)}
          >
            {en ? `DAY ${d.dayIndex}` : `${d.dayIndex}일차`}
          </button>
        ))}
      </div>

      <div className="day-budget-bar">
        {en ? `Estimated ₩${day.totalEstCost.toLocaleString()} / daily budget ₩${Math.round(day.dayBudget).toLocaleString()}` : `예상 지출 ${day.totalEstCost.toLocaleString()}원 / 일 예산 ${Math.round(day.dayBudget).toLocaleString()}원`}
      </div>

      <div className="summary-item-list">
        {day.startTravelMin !== null && <div className="base-travel-note">{en ? `Base to first stop ${day.startTravelMin} min · ${(day.startDistanceM! / 1000).toFixed(1)}km${day.startTravelIsEstimate ? " (estimated)" : ""}` : `출발 기준점에서 첫 장소까지 ${day.startTravelMin}분 · ${(day.startDistanceM! / 1000).toFixed(1)}km${day.startTravelIsEstimate ? " (추정)" : ""}`}</div>}
        {day.items.map((item) => <div key={item.placeId + item.seqOrder}><ItemCard item={item} language={language} pinned={pinnedPlaceIds.includes(item.placeId)} busy={busy} onTogglePin={onTogglePin} onExclude={onExclude} onReplace={onReplace} onSelect={onSelect} />{day.petBreaks.filter((rest) => rest.afterPlaceId === item.placeId).map((rest) => <div className="pet-break-card" key={rest.afterPlaceId}>🐾 {rest.startTime} · {en ? `Large-dog walk & water break ${rest.durationMin} min` : `${rest.label} ${rest.durationMin}분`}</div>)}<TravelSegment item={item} hasCar={hasCar} language={language} /></div>)}
        {day.returnTravelMin !== null && <div className="base-travel-note">{en ? `Last stop to base ${day.returnTravelMin} min · ${(day.returnDistanceM! / 1000).toFixed(1)}km${day.returnTravelIsEstimate ? " (estimated)" : ""}` : `마지막 장소에서 기준점 복귀 ${day.returnTravelMin}분 · ${(day.returnDistanceM! / 1000).toFixed(1)}km${day.returnTravelIsEstimate ? " (추정)" : ""}`}</div>}
        {day.items.length === 0 && <p className="item-empty">{en ? "No stops assigned to this date." : "이 날짜에 배정된 일정이 없습니다."}</p>}
      </div>
    </div>
  );
}
