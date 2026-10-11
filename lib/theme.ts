// Single source of truth for the palette. Cyan is the base; topics get at
// most four accents so the globe stays readable.
export const CYAN = "#5ce1ff";
export const CYAN_DIM = "rgba(92, 225, 255, 0.35)";

export type Topic = "conflict" | "economy" | "politics" | "disaster";

export const TOPIC_COLORS: Record<Topic, string> = {
  conflict: "#ffb020",
  economy: "#4dff9a",
  politics: "#b48cff",
  disaster: "#ff5a7a",
};

export const TOPIC_LABELS: Record<Topic, string> = {
  conflict: "Conflict",
  economy: "Economy",
  politics: "Politics",
  disaster: "Disaster",
};

/** `rgba()` from a hex color, for layer accessors that need alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
