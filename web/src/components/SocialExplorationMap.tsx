import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addStoryComment, createStory, getFogMap, getSocialMapPins, getStoryComments, verifyVisit } from "../api/client";
import type { FogMapState, ItineraryOutput, SocialMapPin, StoryComment } from "../types";
import { loadKakaoSdk } from "./KakaoMap";

const LAYER_LABELS = { me: "나", party: "동행", travelers: "여행자" } as const;
const LAYER_COLORS = { me: "#7868cf", party: "#ee8f62", travelers: "#4d9bc8" } as const;
const FOG_STORAGE = "local-route-visit-starts";

function visitStarts(): Record<string, string> { try { return JSON.parse(localStorage.getItem(FOG_STORAGE) ?? "{}"); } catch { return {}; } }

interface Props { tripId: string; itinerary: ItineraryOutput }

export function SocialExplorationMap({ tripId, itinerary }: Props) {
  const mapNode = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<Array<keyof typeof LAYER_LABELS>>(["me", "party", "travelers"]);
  const [scope, setScope] = useState<"me" | "party">("me");
  const [fog, setFog] = useState<FogMapState | null>(null);
  const [pins, setPins] = useState<SocialMapPin[]>([]);
  const [selected, setSelected] = useState<SocialMapPin | null>(null);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [checkingPlaceId, setCheckingPlaceId] = useState<string | null>(null);
  const [storyText, setStoryText] = useState("");
  const [storyPlaceId, setStoryPlaceId] = useState<string | null>(null);
  const defaultBounds = useMemo(() => ({ south: 34.98, west: 128.75, north: 35.40, east: 129.32 }), []);

  const reloadFog = useCallback(() => getFogMap(tripId, scope).then(setFog).catch(() => setFog(null)), [tripId, scope]);
  const reloadPins = useCallback((bounds = defaultBounds) => getSocialMapPins(tripId, bounds, layers).then((next) => setPins((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)).catch(() => setPins([])), [tripId, layers, defaultBounds]);
  useEffect(() => { void reloadFog(); }, [reloadFog]);
  useEffect(() => { void reloadPins(); }, [reloadPins]);
  useEffect(() => { if (selected) getStoryComments(selected.id).then(setComments).catch(() => setComments([])); }, [selected]);

  useEffect(() => {
    const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
    if (!key || !mapNode.current) return;
    let disposed = false;
    loadKakaoSdk(key).then(() => {
      if (disposed || !mapNode.current) return;
      const kakao = window.kakao;
      // 해무·핀 데이터가 순차 도착해 effect가 다시 실행될 때 카카오맵이 기존 DOM에
      // 컨트롤을 덧붙이지 않도록 이전 인스턴스의 노드를 먼저 비운다.
      mapNode.current.replaceChildren();
      const map = new kakao.maps.Map(mapNode.current, { center: new kakao.maps.LatLng(itinerary.trip.originLat, itinerary.trip.originLng), level: 8 });
      const bounds = new kakao.maps.LatLngBounds();
      itinerary.days.flatMap((day) => day.items).forEach((item) => bounds.extend(new kakao.maps.LatLng(item.lat, item.lng)));
      if (!bounds.isEmpty()) map.setBounds(bounds);

      fog?.cells.forEach((cell) => {
        new kakao.maps.Circle({ map, center: new kakao.maps.LatLng(cell.lat, cell.lng), radius: 340, strokeWeight: 1, strokeColor: "#b9e8f3", strokeOpacity: .7, fillColor: "#eafaff", fillOpacity: .3 });
      });
      itinerary.days.flatMap((day) => day.items.map((item) => ({ ...item, dayIndex: day.dayIndex }))).forEach((item) => {
        const content = document.createElement("button"); content.type = "button"; content.className = "social-map-plan-pin"; content.textContent = String(item.dayIndex); content.title = `${item.nameKo} 방문 인증`;
        content.onclick = () => setCheckingPlaceId(item.placeId);
        new kakao.maps.CustomOverlay({ map, position: new kakao.maps.LatLng(item.lat, item.lng), content, yAnchor: .5 });
      });
      pins.forEach((pin) => {
        const content = document.createElement("button"); content.type = "button"; content.className = "social-map-story-pin"; content.style.setProperty("--pin-color", LAYER_COLORS[pin.layer]); content.innerHTML = `<span>${pin.images.length ? "사진" : "메모"}</span>`; content.title = `${pin.authorLabel}의 ${pin.placeName} 기록`;
        content.onclick = () => setSelected(pin);
        new kakao.maps.CustomOverlay({ map, position: new kakao.maps.LatLng(pin.lat, pin.lng), content, yAnchor: 1.15 });
      });
      kakao.maps.event.addListener(map, "idle", () => {
        const value = map.getBounds(); void reloadPins({ south: value.getSouthWest().getLat(), west: value.getSouthWest().getLng(), north: value.getNorthEast().getLat(), east: value.getNorthEast().getLng() });
      });
    });
    return () => { disposed = true; };
  }, [itinerary, fog, pins, reloadPins]);

  const selectedItem = itinerary.days.flatMap((day) => day.items).find((item) => item.placeId === checkingPlaceId) ?? null;

  const handleVisit = async () => {
    if (!selectedItem) return;
    const starts = visitStarts(); const started = starts[selectedItem.placeId];
    if (!started) { starts[selectedItem.placeId] = new Date().toISOString(); localStorage.setItem(FOG_STORAGE, JSON.stringify(starts)); setNotice("방문을 시작했습니다. 장소에서 10분 이상 머문 뒤 인증해 주세요."); return; }
    if (!navigator.geolocation) { setNotice("이 기기에서는 위치 확인을 사용할 수 없습니다."); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const result = await verifyVisit(selectedItem.placeId, { latitude: position.coords.latitude, longitude: position.coords.longitude, arrivedAt: started, departedAt: new Date().toISOString() });
        delete starts[selectedItem.placeId]; localStorage.setItem(FOG_STORAGE, JSON.stringify(starts));
        setNotice(result.dexUnlocked ? `해무가 걷혔습니다. ${result.dexUnlocked.placeName} 도감을 발견했어요.` : "해무가 걷혔습니다. 이곳에 여행 메모를 남겨보세요.");
        setStoryPlaceId(selectedItem.placeId); setStoryText(`${selectedItem.nameKo}에서 직접 확인한 여행 메모`); setCheckingPlaceId(null); await reloadFog();
      } catch (error) { setNotice(error instanceof Error ? error.message : "방문을 인증하지 못했습니다."); }
    }, () => setNotice("위치 권한을 허용해야 방문을 인증할 수 있습니다."), { enableHighAccuracy: true, timeout: 10000 });
  };

  const publishPin = async () => {
    if (!storyPlaceId || !storyText.trim()) return;
    try { await createStory({ placeId: storyPlaceId, content: storyText.trim(), images: [], visibility: "PUBLIC", publishMode: "NOW", claimVisitVerified: true, language: "KO" }); setStoryPlaceId(null); setStoryText(""); setNotice("인증 핀을 남겼습니다. 다른 여행자가 지도에서 볼 수 있어요."); await reloadPins(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "핀을 남기지 못했습니다."); }
  };

  const submitComment = async () => {
    if (!selected || !comment.trim()) return;
    const created = await addStoryComment(selected.id, comment.trim()); setComments((items) => [...items, created]); setComment(""); setSelected({ ...selected, commentCount: selected.commentCount + 1 });
  };

  return <div className="social-map-shell">
    <section className="fog-progress" aria-label="부산 해무 탐험 진행률">
      <div><span>BUSAN SEA FOG</span><strong>부산 해무 지도</strong><p>직접 방문한 동네의 해무가 걷히고, 로컬 도감이 채워집니다.</p></div>
      <div className="fog-meter"><b>{fog?.progress.clearedCellCount ?? 0}칸</b><span>{fog?.progress.districtCount ?? 0}개 동네 · 도감 {fog?.dex.unlockedCount ?? 0}/{fog?.dex.totalCount ?? 12}</span><progress max={3000} value={fog?.progress.clearedCellCount ?? 0} /></div>
    </section>
    <div className="social-map-toolbar">
      <div role="group" aria-label="지도 핀 레이어">{(Object.keys(LAYER_LABELS) as Array<keyof typeof LAYER_LABELS>).map((layer) => <button type="button" key={layer} className={layers.includes(layer) ? "active" : ""} onClick={() => setLayers((values) => values.includes(layer) ? values.filter((value) => value !== layer) : [...values, layer])}><i style={{ background: LAYER_COLORS[layer] }} />{LAYER_LABELS[layer]}</button>)}</div>
      <button type="button" className={scope === "party" ? "active" : ""} onClick={() => setScope((value) => value === "me" ? "party" : "me")}>{scope === "me" ? "내 해무" : "동행 해무"}</button>
    </div>
    <div className="social-map-stage"><div ref={mapNode} className="social-map-canvas" />{!import.meta.env.VITE_KAKAO_JS_KEY && <div className="social-map-empty"><strong>지도를 불러오려면 카카오 JavaScript 키가 필요합니다.</strong><span>web/.env의 VITE_KAKAO_JS_KEY를 확인해 주세요.</span></div>}</div>
    <p className="social-map-help">보라색 숫자는 내 일정입니다. 장소에서 눌러 방문을 시작하고, 10분 뒤 인증하면 해무가 걷힙니다.</p>
    {notice && <div className="social-map-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")}>닫기</button></div>}
    {selectedItem && <div className="social-map-sheet"><button className="sheet-close" onClick={() => setCheckingPlaceId(null)}>닫기</button><span>방문 인증</span><h2>{selectedItem.nameKo}</h2><p>현재 위치는 약 500m 격자로만 남으며 실시간 위치는 공유하지 않습니다.</p><button className="primary-btn" type="button" onClick={() => void handleVisit()}>{visitStarts()[selectedItem.placeId] ? "10분 체류 후 방문 인증" : "이 장소에서 방문 시작"}</button></div>}
    {storyPlaceId && <div className="social-map-sheet"><button className="sheet-close" onClick={() => setStoryPlaceId(null)}>닫기</button><span>인증 핀 남기기</span><h2>다음 여행자에게 한마디</h2><textarea maxLength={500} value={storyText} onChange={(event) => setStoryText(event.target.value)} /><button className="primary-btn" onClick={() => void publishPin()}>지도에 핀 남기기</button></div>}
    {selected && <aside className="social-map-sheet pin-sheet"><button className="sheet-close" onClick={() => setSelected(null)}>닫기</button><span>{selected.authorLabel} · 방문 인증</span><h2>{selected.placeName}</h2>{(selected.images[0] || selected.imageUrl) && <img src={selected.images[0] || selected.imageUrl || ""} alt="" />}<p>{selected.content}</p><div className="pin-comments"><strong>댓글 {selected.commentCount}</strong>{comments.map((item) => <p key={item.id}><b>{item.authorLabel}</b> {item.body}</p>)}<div><input value={comment} maxLength={500} placeholder="여행 팁을 묻거나 답해보세요" onChange={(event) => setComment(event.target.value)} /><button type="button" onClick={() => void submitComment()}>등록</button></div></div></aside>}
  </div>;
}
