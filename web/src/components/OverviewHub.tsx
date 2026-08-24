import { useEffect, useState } from "react";
import { getWeather } from "../api/client";
import type { ItineraryOutput, WeatherForecast } from "../types";
import type { DashboardTab } from "./Sidebar";

const TAB_CARDS: { id: Exclude<DashboardTab, "home">; number: string; title: string; description: string }[] = [
  { id: "schedule", number: "01", title: "일정과 동선", description: "지도와 날짜별 일정을 함께 확인하고 장소를 교체합니다." },
  { id: "discover", number: "02", title: "부산 로컬", description: "축제, 야시장, 전통시장과 기념품샵을 여행 기간에 맞춰 확인합니다." },
  { id: "together", number: "03", title: "동행과 기록", description: "일정을 공유하고 여행 중 발견한 장면을 기록합니다." },
  { id: "prep", number: "04", title: "여행 준비", description: "예산, 편의정보와 꼭 필요한 예약 서비스를 확인합니다." },
];

export function OverviewHub({ itinerary, onNavigate }: { itinerary: ItineraryOutput; onNavigate: (tab: DashboardTab) => void }) {
  const [weather, setWeather] = useState<Record<string, WeatherForecast>>({});
  useEffect(() => { Promise.all(itinerary.days.map((day) => getWeather(day.visitDate))).then((forecasts) => setWeather(Object.fromEntries(forecasts.map((forecast) => [forecast.date, forecast])))).catch(() => setWeather({})); }, [itinerary.days]);
  const firstDay = itinerary.days[0];
  const nextStop = firstDay?.items[0];
  const nights = Math.max(0, itinerary.days.length - 1);
  return <div className="overview-hub">
    <section className="home-welcome-card">
      <div className="home-welcome-copy"><span className="section-eyebrow">MY LOCAL ROUTE</span><h2>여행 준비는 가볍게,<br />부산은 더 깊게.</h2><p>{itinerary.trip.startDate}부터 {nights}박 {itinerary.days.length}일 동안 현지의 결을 따라가요.</p><button type="button" onClick={() => onNavigate("schedule")}>내 일정 열기 <span>→</span></button></div>
      <div className="next-stop-card">
        <span>여행의 첫 장면</span>
        {nextStop?.imageUrl ? <img src={nextStop.imageUrl} alt={`${nextStop.nameKo} 전경`} /> : <div className="next-stop-art" aria-hidden="true" />}
        <div><small>DAY {firstDay?.dayIndex ?? 1} · {nextStop?.plannedArrival ?? "09:30"}</small><strong>{nextStop?.nameKo ?? "첫 장소를 준비 중이에요"}</strong><p>{nextStop?.address ?? "일정을 열어 여행 동선을 확인하세요."}</p></div>
      </div>
    </section>

    <section className="home-section" aria-labelledby="home-days-title"><div className="home-section-heading"><div><span className="section-eyebrow">YOUR JOURNEY</span><h2 id="home-days-title">한눈에 보는 여행</h2></div><button type="button" onClick={() => onNavigate("schedule")}>전체 일정 보기</button></div>
      <div className="home-day-strip">{itinerary.days.map((day) => { const forecast = weather[day.visitDate]; return <button type="button" key={day.dayIndex} onClick={() => onNavigate("schedule")}><span>DAY {day.dayIndex}</span><b>{new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", weekday: "short" }).format(new Date(`${day.visitDate}T00:00:00`))}</b>{forecast && <span className="day-weather"><i>{forecast.sky === "RAIN" ? "비" : forecast.sky === "CLOUDY" ? "흐림" : "맑음"}</i>{forecast.tempMin}~{forecast.tempMax}℃ · 강수 {forecast.rainProbability}%</span>}<div>{day.items.slice(0, 3).map((item) => <small key={item.placeId}>{item.plannedArrival} · {item.nameKo}</small>)}</div><em>{day.items.length}곳 · {day.totalEstCost.toLocaleString()}원</em></button>; })}</div>
    </section>

    <section className="home-section" aria-labelledby="home-services-title"><div className="home-section-heading"><div><span className="section-eyebrow">TRAVEL, SIMPLIFIED</span><h2 id="home-services-title">무엇을 할까요?</h2></div></div>
      <div className="home-action-grid">{TAB_CARDS.map((card) => <button type="button" key={card.id} onClick={() => onNavigate(card.id)}><span className="home-action-number">{card.number}</span><strong>{card.title}</strong><small>{card.description}</small><em>열기</em></button>)}</div>
    </section>
  </div>;
}
