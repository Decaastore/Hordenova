import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKey } from "@/i18n/translate";

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

/** Real screenshots of the game (public/gallery/*.webp, taken from the live build), in the order a new player meets them. */
export const GALLERY_SHOTS = ["map", "forge", "city", "garrison", "expeditions", "bestiary", "colossus"] as const;
type Shot = (typeof GALLERY_SHOTS)[number];

/**
 * POR DENTRO DO JOGO — a gallery of real screenshots with a line on what
 * each screen does; opening one shows it large, with ‹ › to walk through
 * them (keyboard arrows and Esc too).
 */
export function GalleryPage() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(null);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + GALLERY_SHOTS.length) % GALLERY_SHOTS.length)), []);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);
  const src = (s: Shot) => `${assetBase}gallery/${s}.webp`;
  const shot = open === null ? null : GALLERY_SHOTS[open]!;

  return (
    <div className="gl-root" data-testid="wiki-gallery">
      <style>{GALLERY_CSS}</style>
      <div className="gl-grid">
        {GALLERY_SHOTS.map((s, i) => (
          <figure key={s} className="gl-item">
            <button onClick={() => setOpen(i)} aria-label={t("wiki.gallery.open", { name: t(`wiki.gallery.shots.${s}.title` as TranslationKey) })}>
              <img src={src(s)} alt={t(`wiki.gallery.shots.${s}.title` as TranslationKey)} loading="lazy" width={1280} height={720} />
            </button>
            <figcaption>
              <strong>{t(`wiki.gallery.shots.${s}.title` as TranslationKey)}</strong>
              <span>{t(`wiki.gallery.shots.${s}.text` as TranslationKey)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {shot && (
        <div className="gl-view" role="dialog" aria-modal="true" aria-label={t(`wiki.gallery.shots.${shot}.title` as TranslationKey)} onClick={() => setOpen(null)}>
          <div className="gl-view-inner" onClick={(e) => e.stopPropagation()}>
            <img src={src(shot)} alt={t(`wiki.gallery.shots.${shot}.title` as TranslationKey)} />
            <div className="gl-view-bar">
              <button onClick={() => step(-1)} aria-label={t("wiki.gallery.prev")}>
                ‹
              </button>
              <p>
                <strong>{t(`wiki.gallery.shots.${shot}.title` as TranslationKey)}</strong> {t(`wiki.gallery.shots.${shot}.text` as TranslationKey)}
              </p>
              <span className="gl-count">
                {open! + 1}/{GALLERY_SHOTS.length}
              </span>
              <button onClick={() => step(1)} aria-label={t("wiki.gallery.next")}>
                ›
              </button>
              <button className="gl-close" onClick={() => setOpen(null)} aria-label={t("wiki.gallery.close")}>
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const GALLERY_CSS = `
.gl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
.gl-item { margin: 0; }
.gl-item button { display: block; width: 100%; padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #000; cursor: zoom-in; }
.gl-item img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; object-fit: cover; transition: transform 260ms var(--hn-ease-out, ease); }
.gl-item button:hover img { transform: scale(1.03); }
.gl-item figcaption { display: grid; gap: 2px; margin-top: 8px; }
.gl-item strong { font-family: var(--display); font-size: 19px; color: var(--bone); }
.gl-item span { font-size: 13.5px; line-height: 1.5; color: var(--ash); }
.gl-view { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 20px; background: rgba(5,3,2,0.88); animation: hn-fade 200ms ease-out; }
.gl-view-inner { width: min(1280px, 100%); }
.gl-view img { display: block; width: 100%; height: auto; max-height: calc(100vh - 140px); object-fit: contain; border-radius: 10px; border: 1px solid var(--line); background: #000; }
.gl-view-bar { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.gl-view-bar p { flex: 1; margin: 0; font-size: 14px; line-height: 1.5; color: #d9cdb6; }
.gl-view-bar strong { font-family: var(--display); font-size: 18px; color: var(--gold-hi); margin-right: 6px; }
.gl-view-bar button { flex: none; min-width: 40px; height: 40px; border-radius: 10px; border: 1px solid var(--line); background: rgba(24,18,12,0.8); color: var(--bone); font-size: 22px; cursor: pointer; }
.gl-view-bar button:hover { border-color: var(--gold); color: var(--gold-hi); }
.gl-count { font-size: 13px; color: var(--ash); font-variant-numeric: tabular-nums; }
@media (max-width: 560px) {
  .gl-grid { grid-template-columns: 1fr; }
  .gl-view-bar { flex-wrap: wrap; }
  .gl-view-bar p { order: 3; flex-basis: 100%; }
}
`;
