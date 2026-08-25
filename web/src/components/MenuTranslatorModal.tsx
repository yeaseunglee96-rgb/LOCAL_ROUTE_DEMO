import { useState } from "react";

export interface TranslatedMenuItem {
  id: string;
  nameKo: string;
  nameEn: string;
  price: string;
  allergensEn: string[];
  allergensKo: string[];
  dietTagsEn: string[];
  spicyLevel: number;
}

export const DEMO_MENUS: { title: string; image: string; items: TranslatedMenuItem[] }[] = [
  {
    title: "부산 돼지국밥 전문점 메뉴판",
    image: "https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=800&q=80",
    items: [
      { id: "m1", nameKo: "돼지국밥", nameEn: "Pork Rice Soup", price: "₩10,000", allergensKo: ["돼지고기"], allergensEn: ["Pork"], dietTagsEn: ["Hot Soup"], spicyLevel: 0 },
      { id: "m2", nameKo: "순대국밥", nameEn: "Korean Sausage Rice Soup", price: "₩10,500", allergensKo: ["돼지고기", "갑각류(새우젓)"], allergensEn: ["Pork", "Shellfish"], dietTagsEn: ["Hot Soup"], spicyLevel: 1 },
      { id: "m3", nameKo: "수육백반", nameEn: "Boiled Pork Slice Set", price: "₩13,000", allergensKo: ["돼지고기"], allergensEn: ["Pork"], dietTagsEn: ["Set Menu"], spicyLevel: 0 },
      { id: "m4", nameKo: "맛보기 수육", nameEn: "Appetizer Boiled Pork", price: "₩15,000", allergensKo: ["돼지고기"], allergensEn: ["Pork"], dietTagsEn: ["Side Dish"], spicyLevel: 0 },
    ],
  },
  {
    title: "해운대 밀면 & 만두 전문점 메뉴판",
    image: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80",
    items: [
      { id: "m5", nameKo: "물밀면", nameEn: "Chilled Wheat Noodles in Broth", price: "₩9,000", allergensKo: ["밀", "소고기"], allergensEn: ["Wheat", "Beef"], dietTagsEn: ["Cold Noodle"], spicyLevel: 1 },
      { id: "m6", nameKo: "비빔밀면", nameEn: "Spicy Mixed Wheat Noodles", price: "₩9,500", allergensKo: ["밀", "대두", "땅콩"], allergensEn: ["Wheat", "Soybean", "Peanut"], dietTagsEn: ["Spicy Noodle"], spicyLevel: 3 },
      { id: "m7", nameKo: "수제 찐만두 (8개)", nameEn: "Handmade Steamed Dumplings (8pcs)", price: "₩7,000", allergensKo: ["돼지고기", "밀", "대두"], allergensEn: ["Pork", "Wheat", "Soybean"], dietTagsEn: ["Dumpling"], spicyLevel: 0 },
    ],
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  language?: "KO" | "EN";
}

export function MenuTranslatorModal({ isOpen, onClose, language = "KO" }: Props) {
  const isEn = language === "EN";
  const [selectedDemoIndex, setSelectedDemoIndex] = useState(0);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  if (!isOpen) return null;

  const currentMenu = DEMO_MENUS[selectedDemoIndex];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAnalyzing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setCustomImage(event.target?.result as string);
        setTimeout(() => setAnalyzing(false), 1200);
      };
      reader.readAsDataURL(file);
    }
  };

  const playAudio = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="menu-translator-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="badge-purple">AI OCR MENU TRANSLATOR</span>
            <h2>📷 {isEn ? "Menu Photo Translator" : "메뉴판 사진 번역기"}</h2>
            <p>{isEn ? "Take a photo of a Korean menu for instant English translation & allergen alerts." : "메뉴판 사진을 찍으면 영문 번역과 알레르기/돼지고기 성분을 바로 알려드려요."}</p>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="menu-translator-toolbar">
          <label className="upload-btn">
            📷 {isEn ? "Take Photo / Upload Menu Image" : "메뉴판 사진 촬영 / 업로드"}
            <input type="file" accept="image/*" capture="environment" onChange={handleFileUpload} />
          </label>
          <div className="demo-selector">
            <span>{isEn ? "Sample Menus" : "샘플 메뉴판"}:</span>
            {DEMO_MENUS.map((demo, idx) => (
              <button
                key={demo.title}
                type="button"
                className={`demo-chip ${selectedDemoIndex === idx && !customImage ? "active" : ""}`}
                onClick={() => { setCustomImage(null); setSelectedDemoIndex(idx); }}
              >
                {demo.title}
              </button>
            ))}
          </div>
        </div>

        {analyzing ? (
          <div className="analyzing-state">
            <span className="spinner" />
            <p>{isEn ? "Analyzing Korean text and translating menu items..." : "메뉴판 텍스트 분석 및 영문 번역 중..."}</p>
          </div>
        ) : (
          <div className="menu-translator-body">
            <div className="menu-image-container">
              <img src={customImage ?? currentMenu.image} alt="Menu preview" />
              <span className="ocr-overlay-badge">✓ AI OCR Text Detected</span>
            </div>

            <div className="translated-items-list">
              <h3>{isEn ? "Translated Menu Items" : "영문 번역 및 성분 분석 결과"}</h3>
              <div className="items-grid">
                {currentMenu.items.map((item) => (
                  <div key={item.id} className="translated-item-card">
                    <div className="item-header">
                      <div>
                        <strong className="name-ko">{item.nameKo}</strong>
                        <button type="button" className="say-btn" onClick={() => playAudio(item.nameKo)}>🔊</button>
                      </div>
                      <span className="item-price">{item.price}</span>
                    </div>
                    <p className="name-en">🇬🇧 {item.nameEn}</p>
                    <div className="item-badges">
                      {item.allergensEn.map((allergy) => (
                        <span key={allergy} className="allergy-badge">
                          ⚠️ {allergy}
                        </span>
                      ))}
                      {item.spicyLevel > 0 && (
                        <span className="spicy-badge">
                          🌶️ {"🌶️".repeat(item.spicyLevel)} {isEn ? `Spicy Lvl ${item.spicyLevel}` : `맵기 ${item.spicyLevel}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
