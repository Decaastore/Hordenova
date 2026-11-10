import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";

/**
 * Shared look for the site's content pages (Season, Ranking, Novidades):
 * the same tokens and type as the Home screen and the Wiki — warm night
 * background, Cormorant display headings, hairline rules instead of boxes.
 */
export const PAGE_CSS = `
.pg-root {
  --night: #110d09;
  --night-2: #18120c;
  --line: rgba(232, 176, 75, 0.16);
  --line-soft: rgba(239, 229, 210, 0.07);
  --gold: #e8b04b;
  --gold-hi: #f7dc9c;
  --bone: #efe5d2;
  --ash: #a8987f;
  --ash-2: #7f725f;
  --ok: #8ed39b;
  --danger: #e2685a;
  --display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  display: flex; flex-direction: column; width: 100%; height: 100%;
  background: var(--night); color: var(--bone); overflow: hidden;
  font-variant-numeric: lining-nums;
}
.pg-root button { font: inherit; color: inherit; }
.pg-root :focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 3px; }
.pg-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.pg-wrap { max-width: 1200px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 48px); }

.pg-hero { position: relative; border-bottom: 1px solid var(--line); }
.pg-hero-inner { position: relative; max-width: 1200px; margin: 0 auto; padding: clamp(28px, 6vh, 60px) clamp(20px, 4vw, 48px) clamp(24px, 4vh, 40px); display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 24px 48px; }
.pg-hero-art { position: absolute; inset: 0; background-size: cover; background-position: center 60%; opacity: 0.55; }
.pg-hero-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, rgba(17,13,9,0.96) 0%, rgba(17,13,9,0.78) 45%, rgba(17,13,9,0.55) 100%), linear-gradient(180deg, rgba(17,13,9,0.2) 0%, var(--night) 100%); }
.pg-kicker { margin: 0 0 6px; font-size: 14px; color: var(--gold); }
.pg-h1 { margin: 0; font-family: var(--display); font-weight: 700; font-size: clamp(44px, 6vw, 76px); line-height: 0.95; color: var(--gold-hi); }
.pg-lead { margin: 12px 0 0; font-size: 15px; line-height: 1.65; color: #d9cdb6; max-width: 58ch; }

.pg-score { text-align: right; }
.pg-score dt { font-size: 13px; color: var(--ash); }
.pg-score dd { margin: 4px 0 0; font-family: var(--display); font-weight: 700; font-size: clamp(34px, 4vw, 52px); line-height: 1; color: var(--bone); font-variant-numeric: lining-nums; }
.pg-score p { margin: 6px 0 0; font-size: 13px; color: var(--ash); max-width: 32ch; margin-left: auto; }

.pg-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
.pg-btn {
  padding: 14px 30px; border-radius: 10px; cursor: pointer; font-weight: 800; font-size: 15px;
  border: 1px solid #f2c873; color: #2b1906 !important;
  background: linear-gradient(180deg, #f6cf7a 0%, var(--gold) 55%, #c58a2c 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 8px 24px rgba(232,176,75,0.25), 0 2px 0 #7a4f14;
  transition: transform 140ms ease, filter 140ms ease;
}
.pg-btn:hover { transform: translateY(-1px); filter: brightness(1.06); }
.pg-btn-ghost { padding: 13px 22px; border-radius: 10px; cursor: pointer; font-size: 15px; font-weight: 600; background: rgba(24,18,12,0.6); border: 1px solid rgba(239,229,210,0.28); }
.pg-btn-ghost:hover { border-color: rgba(239,229,210,0.6); }
.pg-link { padding: 0; background: none; border: none; cursor: pointer; color: var(--gold) !important; font-weight: 700; font-size: 14px; text-decoration: underline; text-decoration-color: rgba(232,176,75,0.4); text-underline-offset: 4px; }
.pg-link:hover { color: var(--gold-hi) !important; }

.pg-progress { margin-top: 18px; max-width: 420px; }
.pg-progress-track { height: 4px; border-radius: 2px; background: rgba(239,229,210,0.12); overflow: hidden; }
.pg-progress-fill { height: 100%; background: linear-gradient(90deg, var(--gold), var(--gold-hi)); }
.pg-progress-label { display: flex; justify-content: space-between; margin-top: 8px; font-size: 13px; color: var(--ash); }
.pg-progress-label strong { color: var(--bone); font-weight: 600; }

.pg-figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin: 0; border-bottom: 1px solid var(--line); }
.pg-figures > div { padding: 22px 18px 22px 0; }
.pg-figures > div + div { padding-left: 18px; border-left: 1px solid var(--line-soft); }
.pg-figures dt { font-size: 12.5px; color: var(--ash); }
.pg-figures dd { margin: 6px 0 0; font-family: var(--display); font-weight: 700; font-size: 30px; line-height: 1.05; font-variant-numeric: lining-nums tabular-nums; }

.pg-cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 56px; padding: 44px 0 96px; align-items: start; }
.pg-section + .pg-section { margin-top: 44px; }
.pg-h2 { margin: 0; font-family: var(--display); font-weight: 700; font-size: clamp(26px, 2.6vw, 34px); line-height: 1.1; }
.pg-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 8px 16px; margin-bottom: 14px; }
.pg-sub { margin: 6px 0 14px; font-size: 14px; color: var(--ash); line-height: 1.6; max-width: 62ch; }
.pg-note { margin: 12px 0 0; font-size: 13px; color: var(--ash); line-height: 1.6; max-width: 64ch; }

.pg-table-wrap { overflow-x: auto; border-top: 1px solid var(--line); }
.pg-table { width: 100%; border-collapse: collapse; font-size: 14.5px; font-variant-numeric: tabular-nums; }
.pg-table th, .pg-table td { padding: 13px 14px 13px 0; text-align: left; border-bottom: 1px solid var(--line-soft); white-space: nowrap; }
.pg-table thead th { font-size: 12px; font-weight: 500; color: var(--ash); padding-top: 10px; padding-bottom: 10px; }
.pg-table .is-num { text-align: right; }
.pg-table tbody th { font-family: var(--display); font-weight: 700; font-size: 20px; color: var(--gold-hi); font-variant-numeric: lining-nums tabular-nums; }

.pg-aside { display: grid; gap: 0; }
.pg-block { padding: 22px 0; border-top: 1px solid var(--line); }
.pg-block:first-child { padding-top: 0; border-top: none; }
.pg-block h3 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 24px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pg-block p { margin: 8px 0 0; font-size: 14px; line-height: 1.6; color: var(--ash); }
.pg-block .pg-link { margin-top: 12px; display: inline-block; }
.pg-pill { font-family: system-ui, sans-serif; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--line); color: var(--ash); }
.pg-muted { color: var(--ash-2); font-style: italic; }

.pg-chips { display: flex; gap: 8px; overflow-x: auto; padding: 22px 0 6px; scrollbar-width: thin; }
.pg-chips button { flex-shrink: 0; padding: 7px 14px; border-radius: 999px; cursor: pointer; font-size: 13.5px; background: var(--night-2); border: 1px solid var(--line-soft); color: var(--ash); white-space: nowrap; }
.pg-chips button small { margin-left: 6px; color: var(--ash-2); font-variant-numeric: tabular-nums; }
.pg-chips button:hover { color: var(--bone); border-color: rgba(239,229,210,0.25); }
.pg-chips button.is-on { color: #2b1906; background: var(--gold); border-color: var(--gold); font-weight: 700; }
.pg-chips button.is-on small { color: #5a3a10; }

.pg-danger { margin-top: 8px; padding: 18px 0 0; border-top: 1px solid var(--line); }
.pg-danger summary { cursor: pointer; font-size: 13px; color: var(--ash); }
.pg-danger p { font-size: 13px; color: var(--ash); line-height: 1.6; max-width: 70ch; }
.pg-danger-btn { margin-top: 10px; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700; background: none; border: 1px solid var(--danger); color: var(--danger) !important; }
.pg-danger-btn.is-solid { background: var(--danger); color: #fff !important; }

@media (max-width: 900px) {
  .pg-cols { grid-template-columns: minmax(0, 1fr); gap: 44px; }
  .pg-score { text-align: left; }
  .pg-score p { margin-left: 0; }
}
@media (max-width: 560px) {
  .pg-figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pg-figures > div:nth-child(odd) { padding-left: 0; border-left: none; }
  .pg-figures > div { border-bottom: 1px solid var(--line-soft); }
  .pg-actions > button { flex: 1 1 auto; }
}
`;
