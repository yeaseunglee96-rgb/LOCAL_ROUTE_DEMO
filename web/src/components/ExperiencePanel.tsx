import { useEffect, useState } from "react";
import { addFestival, getEvents, getSouvenirShops } from "../api/client";
import type { Festival, ItineraryOutput, SouvenirShop } from "../types";

type DiscoveryTab = "FESTIVAL" | "NIGHT_MARKET" | "TRADITIONAL_MARKET" | "SOUVENIR";
const labels: Record<DiscoveryTab, { title: string; description: string; index: string }> = {
  FESTIVAL: { title: "축제", description: "여행 기간에 열리는 지역 축제", index: "01" },
  NIGHT_MARKET: { title: "야시장", description: "부산의 밤과 로컬 먹거리를 만나는 시장", index: "02" },
  TRADITIONAL_MARKET: { title: "전통시장", description: "부산의 생활과 오래된 먹거리를 만나는 시장", index: "03" },
  SOUVENIR: { title: "기념품샵", description: "지역의 기억을 담아갈 가까운 상점", index: "04" },
};

export function ExperiencePanel({ itinerary, canEdit = true }: { itinerary: ItineraryOutput; canEdit?: boolean }) {
  const [events, setEvents] = useState<Festival[]>([]); const [shops, setShops] = useState<SouvenirShop[]>([]);
  const [active, setActive] = useState<DiscoveryTab>("FESTIVAL"); const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => { getEvents(itinerary.trip.startDate, itinerary.trip.endDate).then(setEvents).catch(() => setEvents([])); getSouvenirShops(itinerary.trip.originLat, itinerary.trip.originLng).then(setShops).catch(() => setShops([])); }, [itinerary.trip.startDate, itinerary.trip.endDate, itinerary.trip.originLat, itinerary.trip.originLng]);
  const counts = { FESTIVAL: events.filter((event) => (event.eventType ?? "FESTIVAL") === "FESTIVAL").length, NIGHT_MARKET: events.filter((event) => event.eventType === "NIGHT_MARKET").length, TRADITIONAL_MARKET: events.filter((event) => event.eventType === "TRADITIONAL_MARKET").length, SOUVENIR: shops.length };

  const renderEvents = (type: Exclude<DiscoveryTab, "SOUVENIR">) => {
    const visible = events.filter((event) => (event.eventType ?? "FESTIVAL") === type);
    return <div className="discovery-content" role="region" aria-label={`${labels[type].title} 목록`}>
      {visible.length === 0 && <p className="discovery-empty">{type === "FESTIVAL" ? "여행 기간에 확인된 축제가" : type === "NIGHT_MARKET" ? "확인된 야시장이" : "확인된 전통시장이"} 없습니다.</p>}
      {visible.map((event) => <article className="discovery-card" key={event.placeId}>
        {event.imageUrl ? <img src={event.imageUrl} alt={`${event.title} 이미지`} /> : <div className="discovery-art" aria-hidden="true"><span>{type === "NIGHT_MARKET" ? "NIGHT" : type === "TRADITIONAL_MARKET" ? "MARKET" : "LOCAL"}</span></div>}
        <div className="discovery-card-copy"><span className="discovery-type">{type === "NIGHT_MARKET" ? "LOCAL NIGHT MARKET" : type === "TRADITIONAL_MARKET" ? "LOCAL TRADITIONAL MARKET" : "LOCAL FESTIVAL"}</span><h3>{event.title}</h3><p>{type === "FESTIVAL" ? `${event.startDate} – ${event.endDate}${event.playTime ? ` · ${event.playTime}` : ""}` : event.playTime}</p><small>{event.address}</small>{type === "NIGHT_MARKET" && event.officialUrl && <a className="discovery-source-link" href={event.officialUrl} target="_blank" rel="noreferrer">공식 운영정보 확인</a>}{type === "FESTIVAL" && canEdit && <button type="button" onClick={async () => { try { await addFestival(itinerary.itineraryId, event.placeId); setNotice(`${event.title}을 일정에 추가했습니다.`); } catch (error) { setNotice(error instanceof Error ? error.message : "일정에 추가하지 못했습니다."); } }}>일정에 추가</button>}</div>
      </article>)}
    </div>;
  };

  const renderShops = () => <div className="discovery-content" role="region" aria-label="기념품샵 목록">
    {shops.length === 0 && <p className="discovery-empty">출발지 주변에서 확인된 기념품샵이 없습니다.</p>}
    {shops.map((shop) => <article className="discovery-card souvenir-card" key={shop.id}>{shop.imageUrl ? <img src={shop.imageUrl} alt={`${shop.nameKo} 이미지`} /> : <div className="discovery-art" aria-hidden="true"><span>SOUVENIR</span></div>}<div className="discovery-card-copy"><span className="discovery-type">LOCAL SOUVENIR</span><h3>{shop.nameKo}</h3><p>{shop.items.join(" · ")}</p><small>{shop.address}<br />운영 {shop.openTime}–{shop.closeTime}</small></div></article>)}
  </div>;

  return <section className="experience-panel discovery-panel" aria-label="축제 야시장 전통시장 기념품샵">
    {(Object.keys(labels) as DiscoveryTab[]).map((type) => <section className={`discovery-bar-section ${active === type ? "open" : ""}`} key={type}>
      <button type="button" className="discovery-bar" aria-expanded={active === type} aria-controls={`discovery-${type}`} onClick={() => setActive(type)}><span className="discovery-index">{labels[type].index}</span><span className="discovery-bar-copy"><strong>{labels[type].title}</strong><small>{labels[type].description}</small></span><span className="discovery-count">{counts[type]}곳</span><span className="discovery-arrow" aria-hidden="true">{active === type ? "접기" : "보기"}</span></button>
      {active === type && <div id={`discovery-${type}`}>{type === "SOUVENIR" ? renderShops() : renderEvents(type)}</div>}
    </section>)}
    {notice && <p className="feature-notice" role="status">{notice}</p>}
  </section>;
}
