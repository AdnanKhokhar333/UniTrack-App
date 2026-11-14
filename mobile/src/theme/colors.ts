/**
 * UniTrack Premium Ops palette (shared with admin-web CSS tokens).
 * Edit tokens here — screens import from `../theme` / `../../theme`.
 * Web counterpart: admin-web/src/styles.css `:root`
 */
export const colors = {
  bg: "#0B0E14",
  bgElev: "#121620",
  surface: "#161B26",
  surface2: "#1C2333",
  surfaceGlass: "rgba(22, 27, 38, 0.85)",
  border: "rgba(148, 163, 184, 0.16)",
  text: "#F8FAFC",
  muted: "#94A3B8",

  accentBlue: "#3B82F6",
  accentGreen: "#22C55E",
  accentViolet: "#8B5CF6",
  accentAmber: "#F59E0B",
  accentRed: "#EF4444",

  /** Midnight Indigo CTAs (login / primary filled actions; JS-only, no native gradient) */
  ctaIndigo: "#4F46E5",
  /** Mid indigo used for borders / layered wash overlays */
  ctaIndigoMid: "#6366F1",
  /** Kept for compatibility with violet accent language */
  ctaViolet: "#7C3AED",
  /** Solid card / input surface used on login (resists Android autofill tint) */
  cardSurface: "#131826",
  /** Wordmark mid-tone between indigo & violet */
  brandWordmark: "#A5B4FC",

  /** Primary CTA — amber (ops / attention) */
  accent: "#F59E0B",
  accentSoft: "rgba(245, 158, 11, 0.14)",

  info: "#3B82F6",
  success: "#22C55E",
  danger: "#EF4444",
  warning: "#F59E0B",

  successSoft: "rgba(34, 197, 94, 0.14)",
  dangerSoft: "rgba(239, 68, 68, 0.14)",
  warningSoft: "rgba(245, 158, 11, 0.14)",
  infoSoft: "rgba(59, 130, 246, 0.14)",
  violetSoft: "rgba(139, 92, 246, 0.14)",
  /** Soft indigo wash for selected controls (matches ctaIndigoMid) */
  indigoSoft: "rgba(99, 102, 241, 0.14)",

  onAccent: "#0B0E14",
  onFilled: "#F8FAFC",

  /**
   * Backward-compatible aliases used across screens.
   * Prefer accentBlue / accentAmber / success / danger in new code.
   */
  primary: "#F59E0B",
  primarySoft: "rgba(245, 158, 11, 0.14)",
  onPrimary: "#0B0E14",

  overlay: "rgba(11, 14, 20, 0.55)",
  modalScrim: "rgba(11, 14, 20, 0.72)",

  /** QR modules — high-contrast light tile for reliable scanning */
  qrBg: "#FFFFFF",
  qrFg: "#0B0E14",
} as const;

export type ColorName = keyof typeof colors;
