/**
 * ONE POP-UP PER VISIT — the Home/Season pop-ups (daily reward, Global Boss
 * alert) shouldn't stack on the player one after another. Whichever opens
 * first takes this visit; the others wait for the next visit, unless they're
 * urgent (the Serpent's last 24 hours).
 */
let shown = false;

export function popupShownThisVisit(): boolean {
  return shown;
}

export function notePopupShown(): void {
  shown = true;
}

/** Tests only. */
export function resetPopupGate(): void {
  shown = false;
}
