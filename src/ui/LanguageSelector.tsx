import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LANGUAGE_CODES, LANGUAGE_META, type LanguageCode } from "@/i18n";
import { useLanguage } from "@/i18n/LanguageContext";
import { PALETTE } from "@/rendering/theme";

interface LanguageSelectorProps {
  /** Renders in normal document flow (for embedding in TopNav's rightSlot) instead of self-positioning absolutely in a screen's top-right corner. */
  inline?: boolean;
}

/**
 * Small config-tool style language switch — deliberately not a big button,
 * per spec ("não transformar o seletor em um botão grande"). Sits in a
 * corner of the main menu so it never competes with the PLAY button.
 */
export function LanguageSelector({ inline = false }: LanguageSelectorProps = {}) {
  const { language, setLanguage, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const current = LANGUAGE_META[language];

  return (
    <div ref={rootRef} style={inline ? inlineRootStyle : rootStyle}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language.selectorLabel")}
        style={triggerStyle}
      >
        <span aria-hidden="true">🌐</span>
        <span>{current.shortLabel}</span>
        <span style={{ ...caretStyle, transform: open ? "rotate(180deg)" : "none" }} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <ul role="listbox" style={menuStyle}>
          {LANGUAGE_CODES.map((code) => (
            <LanguageOption
              key={code}
              code={code}
              active={code === language}
              onSelect={() => {
                setLanguage(code);
                setOpen(false);
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function LanguageOption({
  code,
  active,
  onSelect,
}: {
  code: LanguageCode;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useLanguage();
  const meta = LANGUAGE_META[code];
  return (
    <li role="option" aria-selected={active}>
      <button
        onClick={onSelect}
        style={{
          ...optionStyle,
          background: active ? "rgba(255,210,87,0.16)" : "transparent",
          color: active ? PALETTE.uiAccentBright : PALETTE.uiText,
        }}
      >
        <span aria-hidden="true">{meta.flag}</span>
        <span>{t(`language.${code}` as const)}</span>
      </button>
    </li>
  );
}

const rootStyle: CSSProperties = {
  position: "absolute",
  top: "clamp(12px, 2.4vh, 20px)",
  right: "clamp(12px, 2.4vw, 22px)",
  zIndex: 2,
};

/** Used inside TopNav's rightSlot — normal flow, no self-positioning. */
const inlineRootStyle: CSSProperties = {
  position: "relative",
};

const triggerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: PALETTE.uiPanelBg,
  color: PALETTE.uiTextDim,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.5,
  cursor: "pointer",
  backdropFilter: "blur(2px)",
};

const caretStyle: CSSProperties = {
  fontSize: 9,
  transition: "transform 120ms ease",
};

const menuStyle: CSSProperties = {
  listStyle: "none",
  margin: "6px 0 0",
  padding: 4,
  position: "absolute",
  right: 0,
  minWidth: 168,
  borderRadius: 8,
  border: `1px solid ${PALETTE.uiPanelBorder}`,
  background: PALETTE.uiPanelBg,
  boxShadow: "0 10px 24px rgba(0,0,0,0.5)",
};

const optionStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 9px",
  borderRadius: 6,
  border: "none",
  fontSize: 12,
  fontWeight: 600,
  textAlign: "left",
  cursor: "pointer",
};
