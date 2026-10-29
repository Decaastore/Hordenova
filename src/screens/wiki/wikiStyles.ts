/** Wiki page styles — same tokens and type as the Home screen (MainMenu.tsx). */
export const WIKI_CSS = `
.wk-root {
  --night: #110d09;
  --night-2: #18120c;
  --panel: #1c150e;
  --line: rgba(232, 176, 75, 0.16);
  --line-soft: rgba(239, 229, 210, 0.07);
  --gold: #e8b04b;
  --gold-hi: #f7dc9c;
  --bone: #efe5d2;
  --ash: #a8987f;
  --display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  display: flex; flex-direction: column; width: 100%; height: 100%;
  background: var(--night); color: var(--bone); overflow: hidden;
}
.wk-root button { font: inherit; color: inherit; }
.wk-root :focus-visible { outline: 2px solid var(--gold-hi); outline-offset: 3px; }
.wk-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }

.wk-hero {
  max-width: 1240px; margin: 0 auto; padding: clamp(20px, 4vh, 36px) clamp(20px, 4vw, 48px) 22px;
  display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 20px 40px;
  border-bottom: 1px solid var(--line);
}
.wk-hero h1 { margin: 0; font-family: var(--display); font-weight: 700; font-size: clamp(40px, 5vw, 60px); line-height: 0.95; color: var(--gold-hi); }
.wk-hero p { margin: 10px 0 0; color: var(--ash); font-size: 15px; max-width: 56ch; line-height: 1.6; }
.wk-search {
  display: flex; align-items: center; gap: 10px; width: min(420px, 100%);
  padding: 0 14px; height: 46px; border-radius: 10px;
  background: var(--night-2); border: 1px solid rgba(239,229,210,0.18); color: var(--ash);
}
.wk-search:focus-within { border-color: var(--gold); color: var(--gold-hi); }
.wk-search input:focus-visible { outline: none; }
.wk-search input { flex: 1; min-width: 0; height: 100%; background: none; border: none; outline: none; color: var(--bone); font: inherit; font-size: 15px; }
.wk-search input::placeholder { color: #7f725f; }

.wk-layout { max-width: 1240px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 48px) 96px; display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 48px; }
.wk-rail { position: sticky; top: 0; align-self: start; padding-top: 28px; display: flex; flex-direction: column; }
.wk-rail-item {
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px;
  padding: 10px 12px; margin-left: -12px; border: none; background: none; cursor: pointer; text-align: left;
  border-radius: 8px; font-size: 15px; color: var(--ash);
}
.wk-rail-item small { font-size: 12px; color: #7f725f; font-variant-numeric: tabular-nums; }
.wk-rail-item:hover { color: var(--bone); background: rgba(239,229,210,0.04); }
.wk-rail-item.is-active { color: var(--gold-hi); background: rgba(232,176,75,0.1); }
.wk-rail-item.is-active small { color: var(--gold); }

.wk-main { padding-top: 28px; min-width: 0; }
.wk-page-head { margin-bottom: 28px; }
.wk-page-head h2 { margin: 0; font-family: var(--display); font-weight: 700; font-size: clamp(32px, 3.4vw, 44px); line-height: 1.05; }
.wk-page-head p { margin: 10px 0 0; color: var(--ash); font-size: 15px; line-height: 1.65; max-width: 64ch; }
.wk-h3 { margin: 0 0 12px; font-family: var(--display); font-weight: 700; font-size: 24px; color: var(--bone); }
.wk-block { margin-top: 44px; }
.wk-note { margin: 0 0 16px; font-size: 13px; color: var(--ash); line-height: 1.6; max-width: 70ch; }
.wk-prose { margin: 0 0 18px; font-size: 15px; color: #d9cdb6; line-height: 1.7; max-width: 68ch; }
.wk-two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 44px; }
.wk-two .wk-block:first-child, .wk-two .wk-block:nth-child(2) { margin-top: 0; }

/* towers */
.wk-tower-tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 28px; }
.wk-tower-tab {
  display: flex; align-items: center; gap: 10px; padding: 6px 14px 6px 6px; cursor: pointer; text-align: left;
  border-radius: 10px; border: 1px solid var(--line-soft); background: var(--night-2);
  font-family: var(--display); font-weight: 700; font-size: 19px; color: var(--ash);
}
.wk-tower-tab:hover { border-color: rgba(239,229,210,0.25); color: var(--bone); }
.wk-tower-tab.is-active { border-color: rgba(232,176,75,0.6); color: var(--gold-hi); background: linear-gradient(160deg, rgba(232,176,75,0.12), rgba(232,176,75,0.02)), var(--night-2); }
.wk-tower { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 40px; align-items: start; }
.wk-tower-stage { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 10px 10px 16px; border-radius: 12px; background: radial-gradient(ellipse 70% 45% at 50% 58%, rgba(232,176,75,0.14), rgba(232,176,75,0) 70%), var(--night-2); border: 1px solid var(--line-soft); }
.wk-slider { width: 100%; display: grid; gap: 6px; padding: 0 8px; }
.wk-slider-head { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: var(--ash); }
.wk-slider-head strong { font-family: var(--display); font-size: 28px; color: var(--gold-hi); line-height: 1; }
.wk-slider input { width: 100%; accent-color: var(--gold); }
.wk-slider-marks { display: flex; justify-content: space-between; }
.wk-slider-marks button { padding: 0; border: none; background: none; cursor: pointer; font-size: 11px; color: #7f725f; font-variant-numeric: tabular-nums; }
.wk-slider-marks button.is-on { color: var(--gold-hi); }
.wk-slider-note { font-size: 12px; color: var(--ash); text-align: center; }
.wk-tower-info h2 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 44px; line-height: 1; }
.wk-role { margin: 6px 0 0; color: var(--gold); font-size: 14px; }
.wk-lead { margin: 14px 0 0; font-size: 15px; line-height: 1.7; color: #d9cdb6; max-width: 60ch; }
.wk-tower-info .wk-h3 { margin-top: 28px; }
.wk-figures { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 0; margin: 0; border-top: 1px solid var(--line); }
.wk-figures > div { padding: 12px 14px 12px 0; border-bottom: 1px solid var(--line-soft); }
.wk-figures dt { font-size: 12px; color: var(--ash); }
.wk-figures dd { margin: 4px 0 0; font-family: var(--display); font-weight: 700; font-size: 26px; line-height: 1; font-variant-numeric: lining-nums tabular-nums; }
.wk-figures.is-wide { max-width: 320px; margin-bottom: 18px; }
.wk-meta { margin: 16px 0 0; font-size: 14px; color: var(--ash); display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; }
.wk-sep { width: 1px; height: 14px; background: var(--line); }

.wk-timeline { list-style: none; margin: 0; padding: 0; border-left: 1px solid var(--line); }
.wk-timeline li { position: relative; padding: 0 0 18px 22px; display: grid; grid-template-columns: 72px minmax(0, 1fr); column-gap: 14px; }
.wk-timeline li::before { content: ""; position: absolute; left: -5px; top: 5px; width: 9px; height: 9px; border-radius: 50%; background: var(--night); border: 1px solid var(--ash); }
.wk-timeline li.is-reached::before { background: var(--gold); border-color: var(--gold); }
.wk-timeline-level { font-size: 13px; color: var(--ash); font-variant-numeric: tabular-nums; padding-top: 2px; }
.wk-timeline-name { font-family: var(--display); font-weight: 700; font-size: 19px; text-transform: lowercase; }
.wk-timeline-name::first-letter { text-transform: uppercase; }
.wk-timeline-name { display: inline-block; }
.wk-timeline-desc { grid-column: 2; font-size: 14px; color: var(--ash); line-height: 1.55; margin-top: 2px; }

.wk-specs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 28px; border-top: 1px solid var(--line); }
.wk-spec { padding: 16px 0; }
.wk-spec h4 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 21px; }
.wk-spec p { margin: 6px 0 0; font-size: 14px; line-height: 1.6; color: var(--ash); }

.wk-skins { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px; }
.wk-skin { padding: 0 0 14px; border-radius: 12px; background: var(--night-2); border: 1px solid var(--line-soft); overflow: hidden; }
.wk-skin-art { display: flex; justify-content: center; background: radial-gradient(ellipse 60% 45% at 50% 62%, rgba(232,176,75,0.12), transparent 70%); }
.wk-skin h4, .wk-skin p, .wk-skin .wk-tier { margin-left: 14px; margin-right: 14px; }
.wk-skin h4 { margin-top: 6px; margin-bottom: 0; font-family: var(--display); font-weight: 700; font-size: 19px; line-height: 1.15; }
.wk-skin-price { margin-top: 4px; margin-bottom: 0; font-size: 12.5px; color: var(--gold); }
.wk-skin-desc { margin-top: 8px; margin-bottom: 0; font-size: 13px; line-height: 1.55; color: var(--ash); }
.wk-tier { display: inline-block; font-size: 11.5px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--ash); }
.wk-tier.is-intermediate { color: #8fc6ff; border-color: rgba(143,198,255,0.35); }
.wk-tier.is-premium { color: #d6a5ff; border-color: rgba(214,165,255,0.4); }
.wk-tier.is-prestige { color: var(--gold-hi); border-color: rgba(247,220,156,0.5); }

/* bestiary / rows */
.wk-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 8px; scrollbar-width: thin; }
.wk-chips button { flex-shrink: 0; padding: 7px 14px; border-radius: 999px; cursor: pointer; font-size: 13.5px; background: var(--night-2); border: 1px solid var(--line-soft); color: var(--ash); white-space: nowrap; }
.wk-chips button:hover { color: var(--bone); border-color: rgba(239,229,210,0.25); }
.wk-chips button.is-on { color: #2b1906; background: var(--gold); border-color: var(--gold); font-weight: 700; }
.wk-group { margin-top: 40px; scroll-margin-top: 20px; }
.wk-group-head { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
.wk-group-head h3 { margin: 0; display: flex; align-items: center; gap: 10px; font-family: var(--display); font-weight: 700; font-size: 26px; }
.wk-group-head p { margin: 6px 0 0; font-size: 14px; color: var(--ash); line-height: 1.6; max-width: 72ch; }
.wk-rows { display: grid; }
.wk-row {
  display: grid; grid-template-columns: 92px minmax(0, 1fr) auto; gap: 18px; align-items: center;
  padding: 14px 10px; margin: 0 -10px; border-radius: 10px; border-bottom: 1px solid var(--line-soft); outline: none;
  scroll-margin-top: 80px;
}
.wk-row:hover, .wk-row:focus-visible { background: rgba(239,229,210,0.03); }
.wk-row.is-boss { grid-template-columns: minmax(0, 1fr) auto; }
.wk-row-art { width: 92px; height: 92px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: radial-gradient(circle at 50% 66%, rgba(232,176,75,0.12), transparent 65%); }
.wk-row-art.is-item { background: none; }
.wk-row-main h4 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 22px; line-height: 1.1; }
.wk-row-main p { margin: 4px 0 0; font-size: 14px; line-height: 1.55; color: var(--ash); }
.wk-row-main p strong { color: var(--bone); font-weight: 600; }
.wk-weak span { color: #8ed39b; }
.wk-where { font-size: 12.5px !important; color: var(--gold) !important; margin: 0 0 2px !important; }
.wk-variants { display: flex; gap: 2px; margin-top: 8px; }
.wk-row-stats { display: grid; grid-template-columns: repeat(5, 64px); gap: 0 10px; margin: 0; text-align: right; }
.wk-row-stats.is-narrow { grid-template-columns: 96px; }
.wk-rows.is-top { border-top: 1px solid var(--line); }
.wk-row-main .wk-note { margin: 6px 0 0; }
.wk-row-stats dt { font-size: 11.5px; color: #8d806b; }
.wk-row-stats dd { margin: 2px 0 0; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--bone); }
.wk-drops { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.wk-drop { display: inline-flex; align-items: center; gap: 8px; padding: 3px 10px 3px 3px; border-radius: 8px; background: var(--night-2); border: 1px solid var(--line-soft); font-size: 13px; }
.wk-drop small { color: var(--ash); font-variant-numeric: tabular-nums; }
.wk-effects { display: flex; flex-wrap: wrap; gap: 6px 14px; color: #8ed39b !important; }
.wk-rarity { margin: 0 0 2px !important; font-size: 12.5px !important; }

/* castle / lists */
.wk-castle-tiers { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
.wk-castle-tiers li { text-align: center; }
.wk-castle-art { aspect-ratio: 1; border-radius: 12px; background: var(--night-2); border: 1px solid var(--line-soft); display: flex; align-items: center; justify-content: center; overflow: hidden; }
.wk-castle-art img { width: 112%; height: 112%; object-fit: contain; }
.wk-castle-ruin { width: 60%; height: 30%; border-radius: 50%; background: radial-gradient(ellipse at 50% 50%, rgba(80,64,48,0.9), rgba(40,30,20,0) 70%); }
.wk-castle-tiers h4 { margin: 10px 0 0; font-family: var(--display); font-weight: 700; font-size: 19px; }
.wk-castle-tiers p { margin: 2px 0 0; font-size: 13px; color: var(--ash); }
.wk-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.wk-list li { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--line-soft); }
.wk-list h4 { margin: 0; font-family: var(--display); font-weight: 700; font-size: 20px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.wk-list p { margin: 4px 0 0; font-size: 14px; line-height: 1.6; color: var(--ash); }
.wk-swatch { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; border: 1px solid var(--line); }
.wk-pill { font-family: system-ui, sans-serif; font-weight: 600; font-size: 11.5px; padding: 2px 8px; border-radius: 999px; color: var(--gold); border: 1px solid rgba(232,176,75,0.35); }
.wk-pill.is-dim { color: var(--ash); border-color: var(--line-soft); }

/* tables */
.wk-table-wrap { overflow-x: auto; border-top: 1px solid var(--line); }
.wk-table { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
.wk-table th, .wk-table td { padding: 10px 14px 10px 0; text-align: right; border-bottom: 1px solid var(--line-soft); white-space: nowrap; }
.wk-table thead th { font-size: 12px; font-weight: 500; color: var(--ash); }
.wk-table th:first-child, .wk-table td:first-child { text-align: left; }
.wk-table tbody th { font-weight: 500; color: var(--ash); }
.wk-table tr.is-strong td, .wk-table tr.is-strong th { color: var(--gold-hi); }

/* search */
.wk-results { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
.wk-results button { width: 100%; display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 14px 4px; background: none; border: none; border-bottom: 1px solid var(--line-soft); cursor: pointer; text-align: left; }
.wk-results button:hover { background: rgba(239,229,210,0.03); }
.wk-result-name { font-family: var(--display); font-weight: 700; font-size: 21px; }
.wk-results button:hover .wk-result-name { color: var(--gold-hi); }
.wk-result-kind { font-size: 13px; color: var(--ash); }

@keyframes wk-flash { 0% { box-shadow: 0 0 0 2px rgba(247,220,156,0.9); background: rgba(232,176,75,0.12); } 100% { box-shadow: 0 0 0 2px rgba(247,220,156,0); } }
.is-flash { animation: wk-flash 1.6s ease-out; border-radius: 10px; }

@media (max-width: 1060px) {
  .wk-tower { grid-template-columns: 1fr; }
  .wk-tower-stage { max-width: 360px; }
  .wk-specs { grid-template-columns: 1fr; }
  .wk-row-stats { grid-template-columns: repeat(5, 56px); }
}
@media (max-width: 820px) {
  .wk-layout { grid-template-columns: 1fr; gap: 0; }
  .wk-rail { position: sticky; top: 0; z-index: 3; flex-direction: row; overflow-x: auto; gap: 4px; padding: 10px 0; margin: 0 calc(-1 * clamp(20px, 4vw, 48px)); padding-left: clamp(20px, 4vw, 48px); background: var(--night); border-bottom: 1px solid var(--line); scrollbar-width: none; }
  .wk-rail-item { margin-left: 0; flex-shrink: 0; white-space: nowrap; }
  .wk-tower-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wk-row { grid-template-columns: 72px minmax(0, 1fr); }
  .wk-row-art { width: 72px; height: 72px; }
  .wk-row-stats, .wk-row-stats.is-narrow { grid-column: 1 / -1; grid-template-columns: repeat(5, minmax(0, 1fr)); text-align: left; }
  .wk-row.is-boss .wk-row-stats { grid-column: 1; }
  .wk-row.is-boss { grid-template-columns: 1fr; }
  .wk-two { grid-template-columns: 1fr; }
  .wk-two .wk-block:nth-child(2) { margin-top: 44px; }
  .wk-castle-tiers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 480px) {
  .wk-tower-tab { font-size: 16px; padding-right: 8px; }
  .wk-castle-tiers { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (prefers-reduced-motion: reduce) { .is-flash { animation: none; } }
`;
