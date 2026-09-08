#!/usr/bin/env node
/**
 * BALANCEAMENTO DEFINITIVO spec section 10/11 — Novidades automation.
 *
 * Real automation investigated for this task and what it found:
 *   - This repo IS the whole app (game + site) — src/screens/NovidadesScreen.tsx
 *     reads directly from src/config/patchNotes.ts, no separate site repo.
 *   - No CI/CD pipeline exists in this repo (no .github/workflows, no other
 *     pipeline config) to hook a "commit -> auto-publish" step into. Building
 *     one from scratch was explicitly out of scope ("no unnecessary external
 *     infra", "no paid services without authorization").
 *   - Fully automatic publication (raw commit -> player-facing entry, no
 *     human/AI review in between) is NOT safe: config/patchNotes.ts's own
 *     header states the real contract ("não inventar histórico", never show
 *     raw technical commits to players) — turning a commit subject into safe,
 *     non-technical, accurate player-facing copy is a judgment call, not a
 *     mechanical transform. A bad auto-publish would violate that contract
 *     immediately (leaking internal file names, engine jargon, or worse,
 *     describing a change inaccurately).
 *
 * So this script is the documented INTERMEDIATE step instead: it lists every
 * commit since patchNotes.ts was last touched, as a plain review checklist —
 * nothing here writes to patchNotes.ts, nothing here is treated as player-
 * facing text. A human (or an AI session, as this one was) reads the list,
 * decides which commits are actually player-relevant (per the file's own
 * "publish vs. don't" rules), and adds ONE new PATCH_NOTES entry by hand,
 * exactly like every prior version in that file was added.
 *
 * Usage: npm run draft:novidades
 */
import { execSync } from "node:child_process";

const PATCH_NOTES_PATH = "src/config/patchNotes.ts";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function main() {
  let lastTouchedAt;
  try {
    lastTouchedAt = run(`git log -1 --format=%H -- ${PATCH_NOTES_PATH}`);
  } catch {
    lastTouchedAt = "";
  }

  if (!lastTouchedAt) {
    console.log(`Could not find a previous commit touching ${PATCH_NOTES_PATH} — showing the last 20 commits instead.\n`);
    console.log(run("git log -20 --format=%h %ad %s --date=short"));
    return;
  }

  const commits = run(`git log ${lastTouchedAt}..HEAD --format='%h|%ad|%s' --date=short`);
  const lines = commits ? commits.split("\n") : [];
  const candidates = lines.filter((line) => !line.split("|")[2].startsWith(`Update ${PATCH_NOTES_PATH}`));

  console.log("=".repeat(72));
  console.log("NOVIDADES DRAFT REVIEW — read this, do not auto-publish it");
  console.log("=".repeat(72));
  console.log(
    `\n${candidates.length} commit(s) since ${PATCH_NOTES_PATH} was last updated (${lastTouchedAt.slice(0, 7)}).\n`,
  );

  if (candidates.length === 0) {
    console.log("Nothing new — no draft entry needed.");
    return;
  }

  for (const line of candidates) {
    const [hash, date, ...subjectParts] = line.split("|");
    console.log(`  [ ] ${date}  ${hash}  ${subjectParts.join("|")}`);
  }

  console.log(
    "\nFor each commit above, decide: is this something a PLAYER would notice or care about\n" +
      "(new content, new system, balance change, economy change, a bug fix that affected\n" +
      `players, a relevant UI change, new Season)? If yes, add ONE entry to ${PATCH_NOTES_PATH}\n` +
      "(a new version block at the top, i18n text in en.ts + ptBR.ts) describing the REAL\n" +
      "change in plain, honest, non-technical language — never the raw commit message.\n" +
      "If nothing above is player-relevant, do not create an entry — see patchNotes.ts's\n" +
      'own header: "Não inventar novidades."',
  );
}

main();
