/**
 * The site's typefaces (everything outside gameplay): Grenze Gotisch — a
 * modern blackletter with the look of a war banner — for names and
 * headings, Figtree for reading text. Cormorant stays loaded because the
 * in-game overlays (deploy, tutorial) still use it.
 */
import "@fontsource/grenze-gotisch/500.css";
import "@fontsource/grenze-gotisch/700.css";
import "@fontsource/grenze-gotisch/800.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/500.css";
import "@fontsource/figtree/600.css";
import "@fontsource/figtree/700.css";
import "@fontsource/figtree/800.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";

export const SITE_DISPLAY_FONT = '"Grenze Gotisch", Georgia, "Times New Roman", serif';
export const SITE_TEXT_FONT = '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif';

/** The site palette as plain values, for the few places styled in JS rather than CSS variables. */
export const SITE = {
  pine: "#0b1b19",
  pine2: "#102a26",
  pine3: "#1a4039",
  bone: "#f2ecdc",
  sage: "#9db4a6",
  ember: "#ff5a36",
  emberHi: "#ff9166",
  emberInk: "#1a0a05",
  sun: "#f2c14e",
} as const;
