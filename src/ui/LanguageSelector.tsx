import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { LANGUAGE_CODES, LANGUAGE_META, type LanguageCode } from "@/i18n";
import { useLanguage } from "@/i18n/LanguageContext";
import { PALETTE } from "@/rendering/theme";

interface LanguageSelectorProps {
  /** Renders in normal document flow (for embedding at the right of TopNav) instead of self-positioning absolutely in a screen's top-right corner. */
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
  const menuRef = useRef<HTMLUListElement>(null);
  // The menu is drawn in a portal on <body> with fixed positioning, anchored
  // under the trigger: inside the top bar it was clipped by the bar's
  // scrolling container and ended up invisible behind the Home scene, so
  // the button looked like it did nothing.
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
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

      {open && anchor && createPortal(
        <ul ref={menuRef} role="listbox" aria-label={t("language.selectorLabel")} style={{ ...menuStyle, top: anchor.top, right: anchor.right }}>
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
        </ul>,
        document.body,
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

/** Used inside TopNav — normal flow, no self-positioning. */
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
  margin: 0,
  padding: 4,
  position: "fixed",
  zIndex: 1000,
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
