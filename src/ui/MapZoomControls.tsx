import { useEffect, useState } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { getZoom, MAX_ZOOM, MIN_ZOOM, onViewChange, resetView, zoomAt } from "@/rendering/viewCamera";

/**
 * ZOOM — three small buttons in the map's corner (zoom in, zoom out, whole map)
 * plus the +, − and 0 keys. The mouse wheel and dragging the map do the same
 * (see CanvasRenderer). Zoom buttons zoom on the map's centre.
 */
export function MapZoomControls({ mapRef }: { mapRef: React.RefObject<HTMLElement> }) {
  const { t } = useLanguage();
  const [zoom, setZoom] = useState(getZoom());
  useEffect(() => onViewChange(() => setZoom(getZoom())), []);
  const step = (factor: number) => {
    const el = mapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, factor, r.width, r.height);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "+" || e.key === "=") step(1.25);
      else if (e.key === "-" || e.key === "_") step(1 / 1.25);
      else if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const btn: React.CSSProperties = {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    background: "rgba(28, 20, 14, 0.86)",
    border: "1px solid rgba(201, 160, 92, 0.55)",
    borderRadius: 7,
    color: "#f2dfb4",
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1,
    cursor: "pointer",
    padding: 0,
  };
  return (
    <div
      data-testid="map-zoom"
      style={{ position: "absolute", left: 14, bottom: 76, zIndex: 5, display: "flex", flexDirection: "column", gap: 6, pointerEvents: "auto" }}
    >
      <button type="button" style={{ ...btn, opacity: zoom >= MAX_ZOOM ? 0.45 : 1 }} aria-label={t("mapView.zoomIn")} title={`${t("mapView.zoomIn")} (+)`} onClick={() => step(1.25)}>
        +
      </button>
      <button type="button" style={{ ...btn, opacity: zoom <= MIN_ZOOM ? 0.45 : 1 }} aria-label={t("mapView.zoomOut")} title={`${t("mapView.zoomOut")} (−)`} onClick={() => step(1 / 1.25)}>
        −
      </button>
      <button type="button" style={{ ...btn, fontSize: 15, opacity: zoom <= MIN_ZOOM ? 0.45 : 1 }} aria-label={t("mapView.fit")} title={`${t("mapView.fit")} (0)`} onClick={() => resetView()}>
        ⤢
      </button>
    </div>
  );
}
