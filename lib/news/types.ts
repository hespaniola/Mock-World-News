import type { Topic } from "@/lib/theme";

export type Article = {
  title: string;
  url: string;
  source: string;
  /** ISO timestamp the article was seen by GDELT. */
  seenAt: string;
  /** GDELT V1.5 tone: roughly -10 (very negative) .. +10 (very positive). */
  tone: number;
};

/** A city or region that news is being written about right now. */
export type Hotspot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** FIPS 10-4 country code as used by GDELT. */
  countryCode: string;
  /** Number of distinct articles in the window that are primarily about this place. */
  count: number;
  /** Dominant topic, or null when no topic stands out. */
  topic: Topic | null;
  topicCounts: Partial<Record<Topic, number>>;
  /** Mean tone across the place's articles. */
  tone: number;
  articles: Article[];
};

/** How far a country's current coverage sits above its own baseline. */
export type CountrySpike = {
  /** ISO 3166-1 numeric id, matching the world-atlas polygons. */
  id: string;
  name: string;
  /** Event rows in the current 24h sample. */
  current: number;
  /** Expected rows for the same sample size, from the prior-week baseline. */
  expected: number;
  /** Smoothed ratio current/expected; 1 = normal. */
  ratio: number;
  /** 0..1 glow intensity derived from the ratio. */
  intensity: number;
};

export type NewsSnapshot = {
  generatedAt: string;
  /** Timestamp of the newest GDELT file included. */
  dataAsOf: string;
  nextRefreshAt: string;
  totalArticles: number;
  hotspots: Hotspot[];
  countries: CountrySpike[];
  /** Diagnostics: which source files were read and which were missing. */
  sources: { gkgFiles: number; eventFiles: number; missingFiles: number };
};
