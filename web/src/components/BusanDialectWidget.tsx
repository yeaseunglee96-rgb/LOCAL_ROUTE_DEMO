import { useState } from "react";

export interface DialectItem {
  id: string;
  dialect: string;
  standard: string;
  english: string;
  meaningEn: string;
  contextKo: string;
  audioText: string;
}

export const BUSAN_DIALECTS: DialectItem[] = [
  {
    id: "d1",
    dialect: "가가 가가?",
    standard: "그 사람이 가씨 성을 가진 그 사람이냐?",
    english: "Is that person the one named Ga?",
    meaningEn: "Used when asking if a specific person has the surname 'Ga'.",
    contextKo: "친구와 누군가에 대해 이야기할 때 신기해하며 물어볼 때 쓰는 표현입니다.",
    audioText: "가가 가가?",
  },
  {
    id: "d2",
    dialect: "맞나?",
    standard: "정말이야? / 그래?",
    english: "Is that so? / Really?",
    meaningEn: "Extremely common Busan reaction meaning 'Is that true?' or 'Oh really?'",
    contextKo: "부산 사람이 대화할 때 가장 많이 쓰는 맞장구 추임새입니다.",
    audioText: "맞나?",
  },
  {
    id: "d3",
    dialect: "단디해라",
    standard: "야무지게 잘 해라 / 확실히 해라",
    english: "Do it properly and carefully!",
    meaningEn: "An encouraging instruction to handle something thoroughly.",
    contextKo: "여행 준비나 일을 시작할 때 '꼼꼼히 챙겨라'라는 유용한 표현입니다.",
    audioText: "단디해라",
  },
  {
    id: "d4",
    dialect: "억수로 좋네!",
    standard: "엄청나게 좋네요!",
    english: "It's extremely good / awesome!",
    meaningEn: "'Eok-su-ro' means 'extremely' or 'very much'.",
    contextKo: "해운대 바다나 맛집에 감탄할 때 쓰기 좋은 표현입니다.",
    audioText: "억수로 좋네!",
  },
  {
    id: "d5",
    dialect: "살아있네!",
    standard: "멋지다 / 아주 훌륭하다",
    english: "Awesome! / Feeling great!",
    meaningEn: "Expression for praising something impressive or top-notch.",
    contextKo: "부산 음식이나 멋진 경치를 보고 신이 났을 때 감탄하는 문장입니다.",
    audioText: "살아있네!",
  },
  {
    id: "d6",
    dialect: "밥 먹었나?",
    standard: "식사는 하셨나요? / 안녕?",
    english: "Have you eaten? / How are you?",
    meaningEn: "Friendly local greeting expressing care and concern.",
    contextKo: "부산 정서를 담은 따뜻한 안부 인사입니다.",
    audioText: "밥 먹었나?",
  },
  {
    id: "d7",
    dialect: "맹키로",
    standard: "~처럼 / ~ 같이",
    english: "Like / Same as",
    meaningEn: "Used when comparing something to another (e.g. '현지인 맹키로' = 'like a local').",
    contextKo: "'부산 현지인 맹키로 여행한다'처럼 사용하는 정겨운 표현입니다.",
    audioText: "맹키로",
  },
  {
    id: "d8",
    dialect: "치워라 마!",
    standard: "됐어, 그만해!",
    english: "Forget it! / Never mind!",
    meaningEn: "Playful refusal or telling someone to stop teasing.",
    contextKo: "친근한 사이에 웃으며 손사래 칠 때 사용하는 표현입니다.",
    audioText: "치워라 마!",
  },
];

export function BusanDialectWidget({ language = "KO" }: { language?: "KO" | "EN" }) {
  const isEn = language === "EN";
  const [expanded, setExpanded] = useState(false);
  const [activeItem, setActiveItem] = useState<DialectItem | null>(null);

  const playAudio = (text: string) => {
    if (!("speechSynthesis" in window)) {
      alert("TTS audio is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section className={`busan-dialect-widget dialect-compact ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="dialect-toggle"
        aria-expanded={expanded}
        aria-controls="busan-dialect-list"
        onClick={() => setExpanded((value) => !value)}
      >
        <div>
          <span>{isEn ? "LOCAL EXPRESSIONS" : "여행 중 한마디"}</span>
          <strong>{isEn ? "Learn Busan dialect" : "부산 사투리 배우기"}</strong>
          <small>{isEn ? "8 useful phrases for your trip" : "여행에서 쓰기 좋은 표현 8개"}</small>
        </div>
        <span className="dialect-toggle-mark" aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && <div className="dialect-browser" id="busan-dialect-list">
        <div className="dialect-list" role="list" aria-label={isEn ? "Busan dialect phrases" : "부산 사투리 목록"}>
          {BUSAN_DIALECTS.map((item) => <button key={item.id} type="button" role="listitem" className={activeItem?.id === item.id ? "active" : ""} onClick={() => setActiveItem(item)}><strong>{item.dialect}</strong><span>{isEn ? item.english : item.standard}</span></button>)}
        </div>

        <div className={`dialect-study ${activeItem ? "selected" : "empty"}`} aria-live="polite">
          {!activeItem ? <><span>{isEn ? "CHOOSE A PHRASE" : "표현 선택"}</span><strong>{isEn ? "Select a phrase to study" : "궁금한 사투리를 눌러보세요"}</strong><p>{isEn ? "Its meaning, context, and pronunciation will appear here." : "뜻과 사용 상황, 부산식 발음을 간단히 확인할 수 있어요."}</p></> : <>
            <span>BUSAN DIALECT</span>
            <h3>{activeItem.dialect}</h3>
            <button
              type="button"
              className="dialect-listen-btn"
              onClick={() => playAudio(activeItem.audioText)}
            >
              {isEn ? "Listen to pronunciation" : "발음 들어보기"}
            </button>
            <dl><div><dt>{isEn ? "Meaning" : "뜻"}</dt><dd>{isEn ? activeItem.english : activeItem.standard}</dd></div><div><dt>{isEn ? "When to use" : "언제 쓰나요"}</dt><dd>{isEn ? activeItem.meaningEn : activeItem.contextKo}</dd></div></dl>
          </>}
        </div>
      </div>}
    </section>
  );
}
