import type { ItineraryOutput } from "../types";

interface Props { itinerary: ItineraryOutput }

export function InfoCards({ itinerary }: Props) {
  const { trip, days } = itinerary;
  const en = trip.language === "EN";
  const allItems = days.flatMap((d) => d.items);

  const foodCost = allItems
    .filter((i) => i.category === "RESTAURANT" || i.category === "CAFE")
    .reduce((s, i) => s + i.estCost, 0);
  const ticketCost = allItems.filter((i) => i.category === "TOURIST").reduce((s, i) => s + i.estCost, 0);
  const totalDistanceKm = allItems.reduce((s, i) => s + (i.distanceToNextM ?? 0), 0) / 1000;
  const transportCost = trip.hasCar ? Math.round(totalDistanceKm * 150) : 0; // 11.1장 "주유비 환산" 원칙과 동일한 추정
  const estimatedTotal = foodCost + transportCost + ticketCost;

  return (
    <div className="info-cards">
      <details className="info-card prep-fold">
        <summary><div><strong>{en ? "Estimated cost" : "예상 경비"}</strong><span>{en ? "Food · transport · activities" : "식비 · 교통비 · 입장료"}</span></div><b>{en ? `₩${estimatedTotal.toLocaleString()}` : `${estimatedTotal.toLocaleString()}원`}</b></summary>
        <div className="prep-fold-content">
        <ul className="cost-list">
          <li>
            <span>{en ? "Food" : "식비"}</span>
            <span>{en ? `₩${foodCost.toLocaleString()}` : `${foodCost.toLocaleString()}원`}</span>
          </li>
          <li>
            <span>{en ? "Transport" : "교통비"}</span>
            <span>{en ? `₩${transportCost.toLocaleString()}` : `${transportCost.toLocaleString()}원`}</span>
          </li>
          <li>
            <span>{en ? "Admissions & activities" : "입장료·체험"}</span>
            <span>{en ? `₩${ticketCost.toLocaleString()}` : `${ticketCost.toLocaleString()}원`}</span>
          </li>
          <li>
            <span>{en ? "Lodging" : "숙박비"}</span>
            <span className="cost-muted">{en ? "₩0 · lodging excluded" : "0원 · 숙소 미포함"}</span>
          </li>
        </ul>
        <div className="budget-days">{days.map((day) => { const ratio = Math.min(100, Math.round((day.totalEstCost / Math.max(1, day.dayBudget)) * 100)); const over = day.totalEstCost > day.dayBudget; return <div key={day.dayIndex}><span>DAY {day.dayIndex}</span><div><i style={{ width: `${ratio}%` }} className={over ? "over" : ""} /></div><b>{en ? `₩${day.totalEstCost.toLocaleString()} / ₩${Math.round(day.dayBudget).toLocaleString()}` : `${day.totalEstCost.toLocaleString()} / ${Math.round(day.dayBudget).toLocaleString()}원`}</b></div>; })}</div>
        <div className="cost-total">
          {en ? `Total ₩${estimatedTotal.toLocaleString()}` : `총 ${estimatedTotal.toLocaleString()}원`}
          <span className="cost-total-sub"> {en ? `(${trip.partySize} traveler basis)` : `(${trip.partySize}인 기준)`}</span>
        </div>
        <p className="data-note">{en ? "Price-tier estimate; lodging, actual parking, and tolls are not included." : "가격대 기반 추정이며 숙박비와 실제 주차·통행료는 포함되지 않습니다."}</p>
        </div>
      </details>
    </div>
  );
}
