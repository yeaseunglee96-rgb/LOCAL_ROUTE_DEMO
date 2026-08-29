import { Link } from "react-router-dom";
import { paths } from "../routes/paths";

export function PrepSectionNav({ tripId, active }: { tripId: string; active: "prep" | "local" }) {
  return <nav className="prep-section-nav" aria-label="여행 준비 화면">
    <Link className={active === "prep" ? "active" : ""} aria-current={active === "prep" ? "page" : undefined} to={paths.tripPrep(tripId)}><strong>준비 정보</strong><span>동행 · 경비 · 사투리</span></Link>
    <Link className={active === "local" ? "active" : ""} aria-current={active === "local" ? "page" : undefined} to={paths.tripDiscover(tripId)}><strong>부산 로컬</strong><span>축제 · 시장 · 기념품</span></Link>
  </nav>;
}
