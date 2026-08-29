import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addStoryComment, createStory, getFogMap, getSocialMapPins, getStoryComments, verifyVisit } from "../api/client";
import type { FogMapState, ItineraryOutput, SocialMapPin, StoryComment } from "../types";
import { loadKakaoSdk } from "./KakaoMap";

const LAYER_LABELS = { me: "내 기록", party: "동행", travelers: "여행자" } as const;
const LAYER_COLORS = { me: "#7868cf", party: "#e88458", travelers: "#338ebc" } as const;
const FOG_STORAGE = "local-route-visit-starts";
const ACTIVITY_STORAGE = "local-route-fog-activity";
const LEVELS = [
  { min: 0, next: 1, name: "여행 준비생", description: "첫 장소에서 해무를 걷어보세요." },
  { min: 1, next: 3, name: "첫 발자국", description: "부산에 나만의 첫 흔적을 남겼어요." },
  { min: 3, next: 7, name: "골목 탐험가", description: "익숙한 길 밖의 부산을 발견하고 있어요." },
  { min: 7, next: 15, name: "동네 수집가", description: "서로 다른 부산의 표정을 모으고 있어요." },
  { min: 15, next: 30, name: "부산 길잡이", description: "내 발자국이 다른 여행자의 길이 됩니다." },
  { min: 30, next: 30, name: "해무를 걷는 사람", description: "부산의 길을 누구보다 깊게 기록했어요." },
] as const;
const DEX_CATALOG = ["돼지국밥", "밀면", "씨앗호떡", "어묵", "낙곱새", "회", "동래파전", "복국", "곰장어", "완당", "재첩국", "붕장어"];

function visitStarts(): Record<string, string> { try { return JSON.parse(localStorage.getItem(FOG_STORAGE) ?? "{}"); } catch { return {}; } }
function activityState(): { read: number; commented: number } { try { return { read: 0, commented: 0, ...JSON.parse(localStorage.getItem(ACTIVITY_STORAGE) ?? "{}") }; } catch { return { read: 0, commented: 0 }; } }

interface Props { tripId: string; itinerary: ItineraryOutput }

export function SocialExplorationMap({ tripId, itinerary }: Props) {
  const mapNode = useRef<HTMLDivElement>(null);
  const fogLayer = useRef<SVGSVGElement>(null);
  const stageNode = useRef<HTMLDivElement>(null);
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
  const [activity, setActivity] = useState(activityState);
  const [showDex, setShowDex] = useState(false);
  const defaultBounds = useMemo(() => ({ south: 34.98, west: 128.75, north: 35.40, east: 129.32 }), []);
  const allItems = useMemo(() => itinerary.days.flatMap((day) => day.items.map((item) => ({ ...item, dayIndex: day.dayIndex }))), [itinerary.days]);
  const cleared = fog?.progress.clearedCellCount ?? 0;
  const currentLevel = [...LEVELS].reverse().find((level) => cleared >= level.min) ?? LEVELS[0];
  const levelProgress = currentLevel.next === currentLevel.min ? 100 : Math.round(((cleared - currentLevel.min) / (currentLevel.next - currentLevel.min)) * 100);
  const remaining = Math.max(0, currentLevel.next - cleared);

  const reloadFog = useCallback(() => getFogMap(tripId, scope).then(setFog).catch(() => setFog(null)), [tripId, scope]);
  const reloadPins = useCallback((bounds = defaultBounds) => getSocialMapPins(tripId, bounds, layers).then((next) => setPins((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)).catch(() => setPins([])), [tripId, layers, defaultBounds]);
  useEffect(() => { void reloadFog(); }, [reloadFog]);
  useEffect(() => { void reloadPins(); }, [reloadPins]);
  useEffect(() => { if (selected) getStoryComments(selected.id).then(setComments).catch(() => setComments([])); }, [selected]);

  const recordActivity = (key: "read" | "commented") => {
    setActivity((current) => {
      const next = { ...current, [key]: current[key] + 1 };
      localStorage.setItem(ACTIVITY_STORAGE, JSON.stringify(next));
      return next;
    });
  };
  const openPin = (pin: SocialMapPin) => { setSelected(pin); if (activity.read === 0) recordActivity("read"); };

  useEffect(() => {
    const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
    if (!key || !mapNode.current) return;
    let disposed = false;
    loadKakaoSdk(key).then(() => {
      if (disposed || !mapNode.current) return;
      const kakao = window.kakao;
      mapNode.current.replaceChildren();
      const map = new kakao.maps.Map(mapNode.current, { center: new kakao.maps.LatLng(itinerary.trip.originLat, itinerary.trip.originLng), level: 8 });
      const bounds = new kakao.maps.LatLngBounds();
      allItems.forEach((item) => bounds.extend(new kakao.maps.LatLng(item.lat, item.lng)));
      if (!bounds.isEmpty()) map.setBounds(bounds);

      const paintFog = () => {
        if (!fogLayer.current || !stageNode.current) return;
        const svg = fogLayer.current;
        const width = stageNode.current.clientWidth;
        const height = stageNode.current.clientHeight;
        const projection = map.getProjection();
        svg.replaceChildren(); svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
        const ns = "http://www.w3.org/2000/svg";
        const defs = document.createElementNS(ns, "defs");
        const filter = document.createElementNS(ns, "filter"); filter.id = "sea-fog-soften";
        const blur = document.createElementNS(ns, "feGaussianBlur"); blur.setAttribute("stdDeviation", "20"); filter.appendChild(blur); defs.appendChild(filter);
        const mask = document.createElementNS(ns, "mask"); mask.id = "sea-fog-mask";
        const base = document.createElementNS(ns, "rect"); base.setAttribute("width", "100%"); base.setAttribute("height", "100%"); base.setAttribute("fill", "white"); mask.appendChild(base);
        (fog?.cells ?? []).forEach((cell) => {
          const point = projection.containerPointFromCoords(new kakao.maps.LatLng(cell.lat, cell.lng));
          const opening = document.createElementNS(ns, "circle");
          opening.setAttribute("cx", String(point.x)); opening.setAttribute("cy", String(point.y)); opening.setAttribute("r", "78"); opening.setAttribute("fill", "black"); opening.setAttribute("filter", "url(#sea-fog-soften)"); mask.appendChild(opening);
        });
        defs.appendChild(mask); svg.appendChild(defs);
        const veil = document.createElementNS(ns, "rect"); veil.setAttribute("width", "100%"); veil.setAttribute("height", "100%"); veil.setAttribute("fill", "#dce9ee"); veil.setAttribute("fill-opacity", cleared ? ".64" : ".76"); veil.setAttribute("mask", "url(#sea-fog-mask)"); svg.appendChild(veil);
      };

      allItems.forEach((item) => {
        const content = document.createElement("button"); content.type = "button"; content.className = "social-map-plan-pin"; content.textContent = String(item.dayIndex); content.title = `${item.nameKo} 방문 인증`;
        content.onclick = () => setCheckingPlaceId(item.placeId);
        new kakao.maps.CustomOverlay({ map, position: new kakao.maps.LatLng(item.lat, item.lng), content, yAnchor: .5 });
      });
      pins.forEach((pin) => {
        const content = document.createElement("button"); content.type = "button"; content.className = "social-map-story-pin"; content.style.setProperty("--pin-color", LAYER_COLORS[pin.layer]); content.textContent = pin.images.length ? "사진" : "메모"; content.title = `${pin.authorLabel}의 ${pin.placeName} 기록`;
        content.onclick = () => openPin(pin);
        new kakao.maps.CustomOverlay({ map, position: new kakao.maps.LatLng(pin.lat, pin.lng), content, yAnchor: 1.15 });
      });
      const refresh = () => { paintFog(); const value = map.getBounds(); void reloadPins({ south: value.getSouthWest().getLat(), west: value.getSouthWest().getLng(), north: value.getNorthEast().getLat(), east: value.getNorthEast().getLng() }); };
      kakao.maps.event.addListener(map, "idle", refresh); kakao.maps.event.addListener(map, "zoom_changed", paintFog); requestAnimationFrame(paintFog);
    });
    return () => { disposed = true; if (fogLayer.current) fogLayer.current.replaceChildren(); };
  }, [itinerary, allItems, fog, pins, reloadPins, cleared]);

  const selectedItem = allItems.find((item) => item.placeId === checkingPlaceId) ?? null;
  const firstItem = allItems[0] ?? null;
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
    try { const created = await addStoryComment(selected.id, comment.trim()); setComments((items) => [...items, created]); setComment(""); setSelected({ ...selected, commentCount: selected.commentCount + 1 }); recordActivity("commented"); }
    catch (error) { setNotice(error instanceof Error ? error.message : "댓글을 등록하지 못했습니다."); }
  };

  const missions = [
    { title: "첫 해무 걷기", detail: "일정 장소에서 방문을 인증해요", done: cleared >= 1, progress: `${Math.min(cleared, 1)}/1` },
    { title: "로컬 도감 열기", detail: "부산의 맛과 장소를 직접 발견해요", done: (fog?.dex.unlockedCount ?? 0) >= 1, progress: `${Math.min(fog?.dex.unlockedCount ?? 0, 1)}/1` },
    { title: "발자국 이어 읽기", detail: "다른 여행자의 실제 메모를 확인해요", done: activity.read >= 1, progress: `${Math.min(activity.read, 1)}/1` },
  ];

  return <div className="social-map-shell">
    <section className="fog-progress" aria-label="부산 해무 탐험 진행률">
      <div className="fog-progress-copy"><span>BUSAN SEA FOG</span><strong>{currentLevel.name}</strong><p>{currentLevel.description}</p><div className="fog-stats"><b>{cleared}칸 해제</b><b>{fog?.progress.districtCount ?? 0}개 동네</b><button type="button" onClick={() => setShowDex(true)}>도감 {fog?.dex.unlockedCount ?? 0}/{fog?.dex.totalCount ?? 12}</button></div></div>
      <div className="fog-meter"><span>{remaining ? `다음 배지까지 ${remaining}칸` : "최고 등급 달성"}</span><progress max={100} value={levelProgress} /><small>{levelProgress}%</small></div>
    </section>
    {cleared === 0 && firstItem && <section className="fog-onboarding"><div><span>처음 오셨나요?</span><strong>일정 속 장소에서 첫 해무를 걷어보세요</strong><p>실시간 위치는 공유하지 않고, 인증 뒤 약 500m 격자만 발자국으로 남습니다.</p></div><button type="button" className="primary-btn" onClick={() => setCheckingPlaceId(firstItem.placeId)}>첫 장소에서 시작</button></section>}
    <section className="fog-missions" aria-label="오늘의 탐험 미션"><header><div><span>TODAY'S TRAIL</span><strong>오늘의 탐험</strong></div><small>{missions.filter((mission) => mission.done).length}/{missions.length} 완료</small></header><div>{missions.map((mission) => <article key={mission.title} className={mission.done ? "done" : ""}><i>{mission.done ? "✓" : ""}</i><div><strong>{mission.title}</strong><span>{mission.detail}</span></div><b>{mission.done ? "완료" : mission.progress}</b></article>)}</div></section>
    <div className="social-map-toolbar"><div role="group" aria-label="지도 핀 레이어">{(Object.keys(LAYER_LABELS) as Array<keyof typeof LAYER_LABELS>).map((layer) => <button type="button" key={layer} className={layers.includes(layer) ? "active" : ""} aria-pressed={layers.includes(layer)} onClick={() => setLayers((values) => values.includes(layer) ? values.filter((value) => value !== layer) : [...values, layer])}><i style={{ background: LAYER_COLORS[layer] }} />{LAYER_LABELS[layer]}</button>)}</div><button type="button" className={scope === "party" ? "active" : ""} onClick={() => setScope((value) => value === "me" ? "party" : "me")}>{scope === "me" ? "내 해무 보기" : "동행 해무 보기"}</button></div>
    <div className="social-map-stage" ref={stageNode}><div ref={mapNode} className="social-map-canvas" /><svg ref={fogLayer} className="social-fog-overlay" aria-hidden="true" />{cleared === 0 && <div className="fog-map-label"><span>아직 해무 속이에요</span><b>검은 일정 핀을 눌러 탐험을 시작하세요</b></div>}{!import.meta.env.VITE_KAKAO_JS_KEY && <div className="social-map-empty"><strong>지도를 불러오려면 카카오 JavaScript 키가 필요합니다.</strong><span>web/.env의 VITE_KAKAO_JS_KEY를 확인해 주세요.</span></div>}</div>
    <p className="social-map-help">숫자 핀은 내 일정입니다. 장소에서 방문을 시작하고 10분 뒤 인증하면 그 주변의 해무가 걷힙니다.</p>
    {showDex && <aside className="social-map-sheet dex-sheet"><button className="sheet-close" onClick={() => setShowDex(false)}>닫기</button><span>BUSAN COLLECTION</span><h2>나의 부산 도감</h2><p>직접 방문해서 발견한 부산의 맛과 장소예요. 빈칸은 다음 여행의 작은 목적지가 됩니다.</p><div className="dex-grid">{DEX_CATALOG.map((name, index) => { const entry = fog?.dex.entries.find((item) => item.tag === name || item.placeName.includes(name)); const unlocked = Boolean(entry) || index < (fog?.dex.unlockedCount ?? 0); return <article key={name} className={unlocked ? "unlocked" : "locked"}><i>{unlocked ? "✓" : "?"}</i><strong>{unlocked ? entry?.placeName ?? name : "아직 해무 속"}</strong><span>{unlocked ? name : `${index + 1}번째 발견`}</span></article>; })}</div></aside>}
    {notice && <div className="social-map-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice("")}>닫기</button></div>}
    {selectedItem && <div className="social-map-sheet"><button className="sheet-close" onClick={() => setCheckingPlaceId(null)}>닫기</button><span>방문 인증 · DAY {selectedItem.dayIndex}</span><h2>{selectedItem.nameKo}</h2><p>이 장소에 도착해 방문을 시작하세요. 현재 위치는 인증에만 사용하고 약 500m 격자로만 남깁니다.</p><button className="primary-btn" type="button" onClick={() => void handleVisit()}>{visitStarts()[selectedItem.placeId] ? "10분 체류 후 방문 인증" : "이 장소에서 방문 시작"}</button></div>}
    {storyPlaceId && <div className="social-map-sheet"><button className="sheet-close" onClick={() => setStoryPlaceId(null)}>닫기</button><span>인증 핀 남기기</span><h2>다음 여행자에게 한마디</h2><p>직접 겪어서 알게 된 작은 팁일수록 다른 여행자에게 큰 도움이 됩니다.</p><textarea maxLength={500} value={storyText} onChange={(event) => setStoryText(event.target.value)} /><button className="primary-btn" onClick={() => void publishPin()}>지도에 핀 남기기</button></div>}
    {selected && <aside className="social-map-sheet pin-sheet"><button className="sheet-close" onClick={() => setSelected(null)}>닫기</button><span>{selected.authorLabel} · 방문 인증</span><h2>{selected.placeName}</h2>{(selected.images[0] || selected.imageUrl) && <img src={selected.images[0] || selected.imageUrl || ""} alt="" />}<p>{selected.content}</p><div className="pin-comments"><strong>이어진 대화 {selected.commentCount}</strong>{comments.map((item) => <p key={item.id}><b>{item.authorLabel}</b> {item.body}</p>)}<div><input value={comment} maxLength={500} placeholder="현지 팁을 묻거나 보태주세요" onChange={(event) => setComment(event.target.value)} /><button type="button" onClick={() => void submitComment()}>등록</button></div></div></aside>}
  </div>;
}
