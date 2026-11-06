import { useLanguage } from "@/i18n/LanguageContext";
import { TopNav, type NavView } from "@/ui/TopNav";
import { PAGE_CSS } from "@/ui/pageChrome";
import { SeasonPassSection } from "@/ui/SeasonPassSection";
import { seasonClock } from "@/engine/SeasonClock";
import { formatDurationShort } from "@/utils/formatDuration";

interface PassScreenProps {
  onNavigate: (view: NavView) => void;
  onPlay: () => void;
}

const assetBase = (import.meta.env?.BASE_URL ?? "/").replace(/\/?$/, "/");

/**
 * PASSE — the Season Pass on its own page, reachable straight from the top
 * navigation (it also stays on the Season page). Same track, same claim
 * buttons: this page only gives it a door of its own.
 */
export function PassScreen({ onNavigate, onPlay }: PassScreenProps) {
  const { t } = useLanguage();
  const season = seasonClock.getCurrentSeasonWindow();
  const remaining = Math.max(0, season.endAtMs - seasonClock.now());
  return (
    <div className="pg-root">
      <style>{PAGE_CSS}</style>
      <TopNav active="PASS" onNavigate={onNavigate} onPlay={onPlay} />
      <div className="pg-scroll">
        <header className="pg-hero">
          <div className="pg-hero-art" style={{ backgroundImage: `url(${assetBase}sprites/ground/ancient_forest.webp)` }} aria-hidden="true" />
          <div className="pg-hero-inner">
            <div>
              <p className="pg-kicker">{t("season.kicker", { number: season.seasonNumber })}</p>
              <h1 className="pg-h1">{t("pass.title")}</h1>
              <p className="pg-sub">{t("pass.pageLead", { time: formatDurationShort(remaining) })}</p>
            </div>
          </div>
        </header>
        <div className="pg-wrap">
          <SeasonPassSection showTitle={false} />
        </div>
      </div>
    </div>
  );
}
