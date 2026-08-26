import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { getUiLanguage, setUiLanguage, subscribeUiLanguage } from "../i18n";
import { markWelcomeSeen } from "../utils/visitor";
import { paths } from "../routes/paths";

const FEATURES = [
  {
    icon: "🗺️",
    titleKo: "운영시간·이동시간까지 계산한 일정",
    titleEn: "Itineraries that account for hours & travel time",
    bodyKo: "장소만 나열하지 않고 영업시간, 이동 거리, 예산과 동반 조건을 함께 계산해 실제로 따라갈 수 있는 일정을 만들어요.",
    bodyEn: "We don't just list places — opening hours, travel time, budget, and accessibility are calculated together into a plan you can actually follow.",
  },
  {
    icon: "📍",
    titleKo: "현지인이 다시 가는 로컬 장소",
    titleEn: "Local spots Busan residents return to",
    bodyKo: "관광 필수 코스와 숨은 로컬 명소 중 원하는 스타일을 골라 나만의 부산을 만나보세요.",
    bodyEn: "Choose between essential tourist sights and hidden local favorites to explore Busan your way.",
  },
  {
    icon: "🌐",
    titleKo: "외국인 여행자를 위한 도구",
    titleEn: "Built-in tools for foreign travelers",
    bodyKo: "📷 메뉴판 사진 번역, 🎙️ 양방향 음성 통역, 🗣️ 부산 사투리 학습까지 여행 중 바로 사용할 수 있어요.",
    bodyEn: "Translate menu photos, get bi-directional voice interpretation, and even learn local Busan dialect — all built in.",
  },
  {
    icon: "🤝",
    titleKo: "동행자와 함께 계획하고 기록",
    titleEn: "Plan and record memories together",
    bodyKo: "일정을 링크로 공유하고 동행자를 초대해 함께 편집하며, 방문 후 기록도 남길 수 있어요.",
    bodyEn: "Share your itinerary by link, invite companions to co-edit, and record memories after your visit.",
  },
];

/**
 * /welcome — 웹 첫 방문 화면
 * 서비스 목적·핵심 기능을 소개하고, 다른 무엇보다 먼저 화면 언어를 고르게 한다.
 * 재방문 사용자(진행 중인 일정이 있음)는 AppRouter 의 진입 분기에서 이 화면을 건너뛰고
 * 자신의 일정으로 바로 들어간다. 앱(Expo)의 위치·알림 권한 요청 화면(/onboarding)과는 별개다.
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const [lang, setLang] = useState<"KO" | "EN">(getUiLanguage());
  const isEn = lang === "EN";

  useEffect(() => subscribeUiLanguage(setLang), []);

  const chooseLanguage = (next: "KO" | "EN") => setUiLanguage(next);

  const start = () => {
    markWelcomeSeen();
    navigate(paths.home(), { replace: true });
  };

  return (
    <div className="landing onboarding-view">
      <header className="landing-header">
        <BrandLogo />
      </header>

      <section className="onboarding-lang-picker" aria-label={isEn ? "Choose your language" : "언어를 선택하세요"}>
        <span className="onboarding-lang-label">{isEn ? "Choose your language" : "언어를 선택하세요"}</span>
        <div className="onboarding-lang-options">
          <button
            type="button"
            className={`onboarding-lang-btn ${lang === "KO" ? "active" : ""}`}
            aria-pressed={lang === "KO"}
            onClick={() => chooseLanguage("KO")}
          >
            🇰🇷 한국어
          </button>
          <button
            type="button"
            className={`onboarding-lang-btn ${lang === "EN" ? "active" : ""}`}
            aria-pressed={lang === "EN"}
            onClick={() => chooseLanguage("EN")}
          >
            🇺🇸 English
          </button>
        </div>
      </section>

      <section className="landing-hero onboarding-hero">
        <span className="section-eyebrow">{isEn ? "LOCAL-RECOMMENDED TRAVEL" : "현지인 추천 기반 여행"}</span>
        <h1>{isEn ? "Explore Busan like a local, without the guesswork" : "가이드북 없이도, 현지인처럼 부산을 즐기세요"}</h1>
        <p>{isEn
          ? "LOCAL ROUTE builds a Busan itinerary around your schedule, budget, and needs — then helps you communicate once you're there."
          : "로컬 루트는 여행 일정과 예산, 이용 조건에 맞춰 부산 일정을 짜드리고, 현지에서 소통까지 도와드려요."}</p>
      </section>

      <section className="onboarding-features">
        {FEATURES.map((feature) => (
          <article key={feature.titleKo} className="onboarding-feature-card">
            <span className="onboarding-feature-icon" aria-hidden="true">{feature.icon}</span>
            <strong>{isEn ? feature.titleEn : feature.titleKo}</strong>
            <p>{isEn ? feature.bodyEn : feature.bodyKo}</p>
          </article>
        ))}
      </section>

      <div className="onboarding-cta">
        <button type="button" className="primary-btn" onClick={start}>
          {isEn ? "Get Started" : "시작하기"}
        </button>
      </div>
    </div>
  );
}
