import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { getUiLanguage, setUiLanguage, subscribeUiLanguage } from "../i18n";
import { markWelcomeSeen } from "../utils/visitor";
import { paths } from "../routes/paths";

const FEATURES = [
  {
    titleKo: "운영시간·이동시간까지 계산한 일정",
    titleEn: "Itineraries built around hours & travel time",
    bodyKo: "예산과 이동 시간을 고려해 실제로 따라갈 수 있는 일정을 짜요.",
    bodyEn: "A realistic plan that accounts for hours, travel time, and budget.",
  },
  {
    titleKo: "현지인이 다시 가는 로컬 장소",
    titleEn: "Local spots Busan residents return to",
    bodyKo: "관광 코스와 로컬 코스 중 원하는 스타일을 선택하세요.",
    bodyEn: "Choose essential sights or hidden local favorites.",
  },
  {
    titleKo: "외국인 여행자를 위한 도구",
    titleEn: "Built-in tools for foreign travelers",
    bodyKo: "메뉴판 번역, 음성 통역, 사투리 학습을 지원해요.",
    bodyEn: "Menu translation, voice interpretation, and dialect help.",
  },
  {
    titleKo: "실시간 길찾기 내비게이션",
    titleEn: "Real-time turn-by-turn navigation",
    bodyKo: "실시간 GPS 안내와 택시 기사용 목적지 카드를 제공해요.",
    bodyEn: "Real-time GPS directions and a taxi destination card.",
  },
  {
    titleKo: "동행자와 함께 계획하고 기록",
    titleEn: "Plan and record memories together",
    bodyKo: "일정을 공유하고 함께 편집하며 기록을 남겨요.",
    bodyEn: "Share, co-edit, and record your trip together.",
  },
  {
    titleKo: "여행 준비까지 한 번에",
    titleEn: "Everything you need to prepare",
    bodyKo: "날씨, 경비, 필수 서비스 예약을 확인하세요.",
    bodyEn: "Check weather, costs, and essential bookings.",
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
        <span className="section-eyebrow">{isEn ? "Choose your language" : "언어를 선택하세요"}</span>
        <div className="onboarding-lang-options">
          <button
            type="button"
            className={`tag-chip onboarding-lang-chip ${lang === "KO" ? "selected" : ""}`}
            aria-pressed={lang === "KO"}
            onClick={() => chooseLanguage("KO")}
          >
            한국어
          </button>
          <button
            type="button"
            className={`tag-chip onboarding-lang-chip ${lang === "EN" ? "selected" : ""}`}
            aria-pressed={lang === "EN"}
            onClick={() => chooseLanguage("EN")}
          >
            English
          </button>
        </div>
      </section>

      <section className="landing-hero onboarding-hero">
        <span className="section-eyebrow">{isEn ? "LOCAL-RECOMMENDED TRAVEL" : "현지인 추천 기반 여행"}</span>
        <h1>{isEn ? "Enjoy Busan, recommended by locals" : "현지인이 추천해주는 부산을 즐기세요"}</h1>
        <p>{isEn
          ? "From planning to communicating on the ground — all in one place."
          : "일정 계산부터 현지 소통까지, 한 번에 도와드려요."}</p>
      </section>

      <section className="onboarding-features">
        {FEATURES.map((feature) => (
          <article key={feature.titleKo} className="onboarding-feature-card">
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
