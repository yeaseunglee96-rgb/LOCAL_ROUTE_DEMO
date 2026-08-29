import { useEffect, useState } from "react";
import { createShare, getCollaboration, inviteCompanion } from "../api/client";

export function ShareBar({ itineraryId, tripId, language = "KO" }: { itineraryId: string; tripId: string; language?: "KO" | "EN" }) {
  const en = language === "EN";
  const [notice, setNotice] = useState<string | null>(null);
  const [members, setMembers] = useState(1);
  const [role, setRole] = useState("VIEWER");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const poll = () => getCollaboration(itineraryId).then((data) => { setMembers(data.members.length); setRole(data.myRole); }).catch(() => undefined);
    void poll(); const timer = window.setInterval(poll, 5000); return () => window.clearInterval(timer);
  }, [itineraryId]);
  const share = async () => {
    setBusy(true);
    try { const result = await createShare(itineraryId); const url = new URL(result.url); url.port = window.location.port; url.protocol = window.location.protocol; url.hostname = window.location.hostname; await navigator.clipboard.writeText(url.toString()); setNotice(en ? "Private details removed. Read-only link copied." : "출발지 등 개인정보를 뺀 읽기 전용 링크를 복사했습니다."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "공유 링크를 만들지 못했습니다."); }
    finally { setBusy(false); }
  };
  const invite = async (role: "EDITOR" | "VIEWER") => {
    setBusy(true);
    try { const result = await inviteCompanion(tripId, role); const url = new URL(result.inviteUrl); url.port = window.location.port; url.protocol = window.location.protocol; url.hostname = window.location.hostname; await navigator.clipboard.writeText(url.toString()); setNotice(`${role === "EDITOR" ? "편집자" : "열람자"} 초대 링크를 복사했습니다. 7일 뒤 만료됩니다.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : "초대 링크를 만들지 못했습니다."); }
    finally { setBusy(false); }
  };
  return <details className="share-bar prep-fold">
    <summary><div><strong>{en ? "Plan together" : "동행자와 함께 계획하기"}</strong><span>{en ? `${members} participant(s)` : `${members}명 참여 중`}</span></div><b>{en ? "Share & invite" : "공유·초대"}</b></summary>
    <div className="prep-fold-content share-fold-content"><p>{en ? "Choose whether companions can edit the itinerary or only view it." : "동행자가 일정을 함께 수정할지, 보기만 할지 선택해 초대하세요."}</p><div className="share-buttons">
      {role === "OWNER" && <button type="button" className="share-btn" disabled={busy} onClick={share}>{en ? "Read-only link" : "읽기 전용 공유"}</button>}
      {role === "OWNER" && <button type="button" className="share-btn" disabled={busy} onClick={() => invite("EDITOR")}>{en ? "Invite editor" : "편집자 초대"}</button>}
      {role === "OWNER" && <button type="button" className="share-btn" disabled={busy} onClick={() => invite("VIEWER")}>{en ? "Invite viewer" : "열람자 초대"}</button>}
      {role !== "OWNER" && <span className="viewer-badge">{role === "EDITOR" ? (en ? "Editor" : "편집자") : (en ? "View only" : "열람 전용")}</span>}
    </div>
    {notice && <div className="share-notice" role="status">{notice}</div>}
    </div>
  </details>;
}
