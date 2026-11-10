import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { PALETTE } from "@/rendering/theme";
import { useLanguage } from "@/i18n/LanguageContext";
import type { FinishedClip } from "./victoryClip";

interface VictoryClipCardProps {
  clip: FinishedClip;
  bossName: string;
  wave: number;
  onClose: () => void;
}

/** The finished boss-kill clip: a looping preview plus Share (phones), Download and Copy caption. */
export function VictoryClipCard({ clip, bossName, wave, onClose }: VictoryClipCardProps) {
  const { t } = useLanguage();
  // Created and revoked inside one effect, so a remount (React StrictMode) never leaves a revoked URL behind.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const next = URL.createObjectURL(clip.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [clip.blob]);
  const [copied, setCopied] = useState(false);

  const gameUrl = typeof location !== "undefined" ? location.origin : "";
  const caption = t("clip.caption", { boss: bossName, wave, url: gameUrl });
  const fileName = `hordenova-${bossName.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-onda-${wave}.${clip.extension}`;
  const file = useMemo(() => new File([clip.blob], fileName, { type: clip.mimeType }), [clip.blob, clip.mimeType, fileName]);
  const canShareFile = typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const share = async () => {
    try {
      await navigator.share({ files: [file], text: caption });
    } catch {
      /* dismissed */
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div style={cardStyle} role="dialog" aria-label={t("clip.ready")} data-testid="victory-clip">
      <button onClick={onClose} style={closeStyle} aria-label={t("clip.close")}>
        ×
      </button>
      <div style={titleStyle}>{t("clip.ready")}</div>
      {url && <video src={url} autoPlay muted loop playsInline style={videoStyle} />}
      <div style={hintStyle}>{t("clip.hint")}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {canShareFile && (
          <button onClick={share} style={primaryStyle}>
            {t("clip.share")}
          </button>
        )}
        <a href={url ?? undefined} download={fileName} style={{ ...(canShareFile ? secondaryStyle : primaryStyle), textDecoration: "none" }} data-testid="victory-clip-download">
          {t("clip.download")}
        </a>
        <button onClick={copy} style={secondaryStyle}>
          {copied ? t("clip.copied") : t("clip.copy")}
        </button>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  position: "absolute",
  right: 16,
  bottom: 16,
  zIndex: 25,
  width: 300,
  maxWidth: "calc(100% - 32px)",
  display: "grid",
  gap: 8,
  padding: "12px 12px 12px",
  borderRadius: 12,
  border: `1px solid ${PALETTE.uiAccent}88`,
  background: "linear-gradient(160deg, rgba(54,36,22,0.97), rgba(30,20,12,0.98))",
  color: PALETTE.uiText,
  boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
};
const closeStyle: CSSProperties = { position: "absolute", top: 6, right: 9, background: "transparent", border: "none", color: PALETTE.uiTextDim, fontSize: 18, cursor: "pointer" };
const titleStyle: CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 15, fontWeight: 700, color: PALETTE.uiAccentBright };
const videoStyle: CSSProperties = { width: "100%", borderRadius: 8, background: "#000", display: "block", aspectRatio: "16 / 10", objectFit: "cover" };
const hintStyle: CSSProperties = { fontSize: 11, color: PALETTE.uiTextDim };
const primaryStyle: CSSProperties = {
  flex: "1 1 auto",
  padding: "7px 12px",
  borderRadius: 7,
  border: `1px solid ${PALETTE.uiAccent}`,
  background: "rgba(255,210,87,0.2)",
  color: PALETTE.uiAccentBright,
  fontWeight: 700,
  fontSize: 12,
  textAlign: "center",
  cursor: "pointer",
};
const secondaryStyle: CSSProperties = { ...primaryStyle, border: `1px solid ${PALETTE.uiPanelBorder}`, background: "rgba(0,0,0,0.25)", color: PALETTE.uiText };
