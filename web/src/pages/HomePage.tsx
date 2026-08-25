import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { getCourseCategories } from "../api/client";
import type { CourseCategory } from "../types";
import { useAppShell } from "../routes/AppShell";
import { paths } from "../routes/paths";

/**
 * / — 시작 화면
 * 서비스가 무엇을 해주는지 한 화면에 보여주고 여행 계획 입력으로 연결한다.
 */
export function HomePage() {
  const { placeCount } = useAppShell();
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getCourseCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <div className="landing">
      <header className="landing-header">
        <BrandLogo />
        <nav className="landing-nav">
          <Link to={paths.stories()}>여행 기록</Link>
          <Link to={paths.myTrips()}>내 여행</Link>
        </nav>
      </header>

      <section className="landing-hero">
        <span className="section-eyebrow">현지인 추천 기반 여행</span>
        <h1>부산을 마음껏 즐기세요</h1>
        <p>장소를 나열하는 대신 운영시간, 이동시간, 예산과 동반 조건을 함께 계산합니다.</p>
        <button type="button" className="primary-btn" onClick={() => navigate(paths.plan())}>여행 일정 만들기</button>
        {typeof placeCount === "number" && <small>등록된 로컬 장소 {placeCount.toLocaleString()}곳 (부산 기준)</small>}
      </section>

      {categories.length > 0 && (
        <section className="landing-courses">
          <h2>어떤 부산을 원하시나요?</h2>
          <ul>
            {categories.filter((category) => category.enabled).slice(0, 10).map((category) => (
              <li key={category.code}>
                <strong>{category.nameKo}</strong>
                <span>{category.summaryKo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="landing-footer">
        <Link to={paths.terms()}>이용약관</Link>
        <Link to={paths.privacy()}>개인정보 처리방침</Link>
        <Link to={paths.openSource()}>오픈소스 고지</Link>
      </footer>
    </div>
  );
}
