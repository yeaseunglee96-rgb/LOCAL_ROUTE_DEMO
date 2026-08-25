import { useEffect, useState } from "react";
import { getUiLanguage, setUiLanguage, subscribeUiLanguage } from "../i18n";

export function LanguageSwitcher() {
  const [lang, setLang] = useState<"KO" | "EN">(getUiLanguage());

  useEffect(() => {
    return subscribeUiLanguage((newLang) => setLang(newLang));
  }, []);

  const toggleLanguage = (targetLang: "KO" | "EN") => {
    setUiLanguage(targetLang);
  };

  return (
    <div className="top-right-lang-switcher" aria-label="Language selection">
      <button
        type="button"
        className={`lang-btn ${lang === "KO" ? "active" : ""}`}
        onClick={() => toggleLanguage("KO")}
      >
        한국어
      </button>
      <span className="lang-divider">|</span>
      <button
        type="button"
        className={`lang-btn ${lang === "EN" ? "active" : ""}`}
        onClick={() => toggleLanguage("EN")}
      >
        English
      </button>
    </div>
  );
}
