import type { PetSize } from "../types";
import { BrandLogo } from "./BrandLogo";

export type DashboardTab = "home" | "schedule" | "discover" | "together" | "prep";

const NAV_ITEMS: { id: DashboardTab; label: string; labelEn: string }[] = [
  { id: "home", label: "홈", labelEn: "Home" },
  { id: "schedule", label: "일정", labelEn: "Plan" },
  { id: "discover", label: "로컬", labelEn: "Local" },
  { id: "together", label: "함께", labelEn: "Together" },
  { id: "prep", label: "여행 준비", labelEn: "Prepare" },
];

const PET_SIZE_LABEL: Record<PetSize, string> = {
  SMALL: "소형견 (~7kg)",
  MEDIUM: "중형견 (7~15kg)",
  LARGE: "대형견 (15kg~)",
};

interface Props {
  placeCount: number | null;
  pet: { name: string | null; size: PetSize } | null;
  language?: "KO" | "EN";
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  showNavigation?: boolean;
}

export function Sidebar({ placeCount, pet, language = "KO", activeTab, onTabChange, showNavigation = true }: Props) {
  const en = language === "EN";
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <BrandLogo />
      </div>
      <p className="brand-tagline">
        {en ? "Places locals return to," : "현지인이 다시 가는 곳으로,"}
        <br />
        {en ? "welcoming pets and international visitors" : "반려동물과 외국인도 걱정 없이"}
      </p>

      {showNavigation && <nav className="sidebar-nav" aria-label={en ? "Main service navigation" : "주요 서비스"}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${activeTab === item.id ? "active" : ""}`}
            aria-current={activeTab === item.id ? "page" : undefined}
            onClick={() => onTabChange(item.id)}
          >
            <span>{en ? item.labelEn : item.label}</span>
          </button>
        ))}
      </nav>}

      {pet && (
        <div className="sidebar-card pet-card">
          <div className="pet-card-header">
            <span className="pet-name">{pet.name || (en ? "Pet" : "반려동물")}</span>
          </div>
          <span className="pet-size-badge">{en ? `${pet.size.toLowerCase()} dog` : PET_SIZE_LABEL[pet.size]}</span>
        </div>
      )}

      <div className="sidebar-card stat-card">
        <div className="stat-number">{placeCount ?? "-"}{en ? " places" : "개"}</div>
        <div className="stat-label">{en ? "Registered local places (Busan)" : "등록된 로컬 장소 (부산 기준)"}</div>
      </div>
    </aside>
  );
}
