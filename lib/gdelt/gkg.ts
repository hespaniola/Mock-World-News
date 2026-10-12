import type { Topic } from "@/lib/theme";
import { classifyThemes } from "./topics";
import { parseStamp } from "./files";

// GKG 2.1 is tab-separated, one article per line. Column indexes from the
// GDELT Global Knowledge Graph 2.1 codebook.
const COL = {
  date: 1,
  collection: 2,
  sourceName: 3,
  url: 4,
  themes: 7,
  locations: 10, // V2ENHANCEDLOCATIONS
  tone: 15,
  extras: 26,
} as const;

// V2ENHANCEDLOCATIONS entries: Type#FullName#CountryCode#ADM1#ADM2#Lat#Long#FeatureID#CharOffset
// Type: 1 country, 2 US state, 3 US city, 4 world city, 5 world state/ADM1.
const CITY_TYPES = new Set(["3", "4"]);
const REGION_TYPES = new Set(["2", "5"]);

export type GkgLocation = {
  type: number;
  name: string;
  countryCode: string;
  /** GDELT ADM1 code, e.g. "UP07"; matches Natural Earth `fips` outside the US. */
  adm1Code: string;
  lat: number;
  lng: number;
  featureId: string;
  offset: number;
};

export type GkgArticle = {
  url: string;
  source: string;
  title: string;
  seenAt: Date;
  tone: number;
  topic: Topic | null;
  /** The place the article is mainly about (first-mentioned city, else region). */
  primary: GkgLocation | null;
};

function parseLocations(field: string): GkgLocation[] {
  if (!field) return [];
  const out: GkgLocation[] = [];
  for (const entry of field.split(";")) {
    const p = entry.split("#");
    if (p.length < 9) continue;
    const lat = Number(p[5]);
    const lng = Number(p[6]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    out.push({
      type: Number(p[0]),
      name: p[1],
      countryCode: p[2],
      adm1Code: p[3],
      lat,
      lng,
      featureId: p[7],
      offset: Number(p[8]) || 0,
    });
  }
  return out;
}

function pickPrimary(locs: GkgLocation[]): GkgLocation | null {
  let best: GkgLocation | null = null;
  for (const want of [CITY_TYPES, REGION_TYPES]) {
    for (const l of locs) {
      if (want.has(String(l.type)) && (!best || l.offset < best.offset)) best = l;
    }
    if (best) return best;
  }
  return null;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function pageTitle(extras: string): string {
  const m = extras.match(/<PAGE_TITLE>([\s\S]*?)<\/PAGE_TITLE>/);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : "";
}

/** Parse one GKG file. Keeps only web articles that have a title and a place. */
export function parseGkg(text: string): GkgArticle[] {
  const out: GkgArticle[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const f = line.split("\t");
    if (f.length < 27 || f[COL.collection] !== "1") continue;
    const title = pageTitle(f[COL.extras]);
    const primary = pickPrimary(parseLocations(f[COL.locations]));
    if (!title || !primary) continue;
    const themes = f[COL.themes] ? f[COL.themes].split(";").filter(Boolean) : [];
    out.push({
      url: f[COL.url],
      source: f[COL.sourceName],
      title,
      seenAt: parseStamp(f[COL.date]),
      tone: Number(f[COL.tone].split(",")[0]) || 0,
      topic: classifyThemes(themes),
      primary,
    });
  }
  return out;
}
