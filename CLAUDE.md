# HORDENOVA

A browser tower-defense game (Vite + React + TypeScript). This repo is the
whole product — game engine, rendering, UI, and the game's own website
(Home/Season/Ranking/Wiki/Novidades screens) all live here; there is no
separate site repo and no CI/CD pipeline.

Validate before calling any change done: `npx tsc --noEmit`, `npx vitest run`,
`npm run build`. For a UI/gameplay change, also verify it live (dev server +
browser) rather than relying on type-checks and tests alone.

## Novidades / Changelog — mandatory step, every session

`src/config/patchNotes.ts` is the single source of truth for the game's
changelog — read its own file header first, it has the full data-shape and
authoring contract. It feeds both the Novidades screen
(`src/screens/NovidadesScreen.tsx`) and the Home teaser card
(`src/screens/MainMenu.tsx`) directly; nothing else needs to change for a new
entry to show up in both places, in both languages.

**The rule:** whenever a change you just shipped in this repo is something a
player would notice or care about — and it has been implemented, its tests
pass, and you've validated it actually works — add ONE new `PatchNoteEntry`
to the top of `PATCH_NOTES` in `src/config/patchNotes.ts` as part of that
same piece of work, before considering the task finished. Do this without
being asked or reminded; it's a standing part of finishing the work, the same
way running the test suite is.

**What counts as player-facing** (add an entry): a new feature/system, a new
enemy/Elite/Mini-Boss/Boss, a meaningful visual change, a new or changed
tower, an ability/damage/HP/speed/spawn/wave change, an economy or reward
change, balance (buffs/nerfs), a fix a player would have actually noticed, a
performance improvement a player would feel, a meaningful UI/UX change, a new
map/biome/skin, a castle change, a progression change — anything that
noticeably changes what it's like to play.

**What does NOT count** (never add an entry for these alone): a refactor, a
file move/rename, an internal-only cleanup, a variable rename, a
test-only change, or anything with no perceptible effect on the game. When in
doubt, ask: "would a player notice this?" — if no, skip it.

**Never publish broken or half-finished work.** If tests fail or the change
isn't complete, fix it first — an entry is only ever added for something that
is actually working, exactly like every existing entry in that file.

**Group related changes into ONE entry.** If a single piece of work touches
several related things (e.g. one balance pass across 3 towers, or one new
system with a UI + a fix bundled in), that's ONE entry with a short title, a
plain-language description, and a bullet per specific fact — never one entry
per file touched or per sub-change.

**How to write an entry** — see `src/config/patchNotes.ts`'s own header and
existing entries for the exact shape (`id`, `dateIso`, `category`,
`title.{en,ptBR}`, `description.{en,ptBR}`, `highlights[].{en,ptBR}`). Write
honest, plain-language copy for the player — never raw commit messages,
internal file names, or engine jargon. Provide both languages; don't leave
one blank.

**Safety net:** `npm run draft:novidades` lists every commit since
`patchNotes.ts` was last touched, as a review checklist — useful to catch
anything you forgot before ending a session. It never writes to the file and
never auto-publishes; deciding what's real, player-relevant news and writing
honest copy for it is a judgment call every time, not a mechanical transform.

Never invent history. Every entry must correspond to a real, shipped,
validated change — the same standard `patchNotes.ts`'s own header states
("Não inventar histórico").
