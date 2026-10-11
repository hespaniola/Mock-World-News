import { unstable_cache } from "next/cache";
import { geoContains } from "d3-geo";
import { getCountries } from "@/lib/countries";
import type { Topic } from "@/lib/theme";
import { fetchSlotText, formatStamp, latestSlot, mapLimit, parseStamp, SLOT_MS } from "@/lib/gdelt/files";
import { parseGkg, type GkgArticle } from "@/lib/gdelt/gkg";
import { parseEvents, type CountryCounts } from "@/lib/gdelt/events";
import type { CountrySpike, Hotspot, NewsSnapshot } from "./types";

const HOUR = 60 * 60 * 1000;

/** GKG files (15 min each) feeding the dots: the last hour. */
const GKG_FILES = 4;
/** Current window for the country glow: one Events file per hour, last 24h. */
const CURRENT_SAMPLES = 24;
/** Baseline: one Events file every 6h across the 7 days before that. */
const BASELINE_SAMPLES = 28;
const BASELINE_STEP = 6 * HOUR;

const MAX_HOTSPOTS = 500;
const ARTICLES_PER_HOTSPOT = 6;
/** Pseudo-count that keeps small countries from flaring on a handful of events. */
const SPIKE_SMOOTHING = 20;
/** Ratio (current/expected) at which a country's glow reaches full intensity. */
const FULL_GLOW_RATIO = 4;

const EMPTY_COUNTS: CountryCounts = { counts: {}, points: {}, total: 0 };

// Events files never change after publication, so their per-country summary
// is cached indefinitely, keyed by slot. Each refresh then only downloads the
// one or two samples that are new.
const eventSummary = (stamp: string) =>
  unstable_cache(
    async (): Promise<CountryCounts & { missing: boolean }> => {
      const text = await fetchSlotText(parseStamp(stamp), "export.CSV");
      return text ? { ...parseEvents(text), missing: false } : { ...EMPTY_COUNTS, missing: true };
    },
    ["gdelt-events-summary", stamp],
    { revalidate: false },
  )();

function floorTo(d: Date, step: number): Date {
  return new Date(Math.floor(d.getTime() / step) * step);
}

function sum(into: Record<string, number>, from: Record<string, number>) {
  for (const k in from) into[k] = (into[k] ?? 0) + from[k];
}

// FIPS code -> world-atlas feature id, resolved by point-in-polygon on
// GDELT's own country centroid. Avoids a hand-maintained FIPS/ISO table.
const fipsToCountry = new Map<string, string | null>();

function resolveCountry(fips: string, point: [number, number] | undefined): string | null {
  if (fipsToCountry.has(fips)) return fipsToCountry.get(fips)!;
  if (!point) return null;
  const [lat, lng] = point;
  const hit = getCountries().find((f) => geoContains(f, [lng, lat]));
  const id = hit ? String(hit.id) : null;
  fipsToCountry.set(fips, id);
  return id;
}

function buildSpikes(current: CountryCounts[], baseline: CountryCounts[]): CountrySpike[] {
  const cur: Record<string, number> = {};
  const base: Record<string, number> = {};
  const points: Record<string, [number, number]> = {};
  let curTotal = 0;
  let baseTotal = 0;
  for (const s of current) {
    sum(cur, s.counts);
    Object.assign(points, s.points);
    curTotal += s.total;
  }
  for (const s of baseline) {
    sum(base, s.counts);
    for (const k in s.points) points[k] ??= s.points[k];
    baseTotal += s.total;
  }
  if (curTotal === 0 || baseTotal === 0) return [];

  // Roll FIPS codes up to polygons.
  const byId = new Map<string, { current: number; baseline: number }>();
  for (const fips of new Set([...Object.keys(cur), ...Object.keys(base)])) {
    const id = resolveCountry(fips, points[fips]);
    if (!id) continue;
    const e = byId.get(id) ?? { current: 0, baseline: 0 };
    e.current += cur[fips] ?? 0;
    e.baseline += base[fips] ?? 0;
    byId.set(id, e);
  }

  // Compare shares, not raw counts, so a globally busy news day doesn't
  // light up every country at once.
  const scale = curTotal / baseTotal;
  const names = new Map(getCountries().map((f) => [String(f.id), f.properties.name]));
  const out: CountrySpike[] = [];
  for (const [id, { current, baseline }] of byId) {
    const expected = baseline * scale;
    const ratio = (current + SPIKE_SMOOTHING) / (expected + SPIKE_SMOOTHING);
    const intensity = Math.max(0, Math.min(1, Math.log2(ratio) / Math.log2(FULL_GLOW_RATIO)));
    out.push({
      id,
      name: names.get(id) ?? id,
      current,
      expected: Math.round(expected),
      ratio: Math.round(ratio * 100) / 100,
      intensity: Math.round(intensity * 1000) / 1000,
    });
  }
  return out.sort((a, b) => b.ratio - a.ratio);
}

function buildHotspots(articles: GkgArticle[]): { hotspots: Hotspot[]; total: number } {
  const seen = new Set<string>();
  const groups = new Map<string, GkgArticle[]>();
  for (const a of articles) {
    if (seen.has(a.url) || !a.primary) continue;
    seen.add(a.url);
    const p = a.primary;
    const key = p.featureId || `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;
    const list = groups.get(key);
    if (list) list.push(a);
    else groups.set(key, [a]);
  }

  const hotspots: Hotspot[] = [];
  for (const [key, list] of groups) {
    const p = list[0].primary!;
    const topicCounts: Partial<Record<Topic, number>> = {};
    let toneSum = 0;
    for (const a of list) {
      if (a.topic) topicCounts[a.topic] = (topicCounts[a.topic] ?? 0) + 1;
      toneSum += a.tone;
    }
    // A topic colors the dot only if it covers at least a quarter of the stories.
    let topic: Topic | null = null;
    let topicMax = 0;
    for (const [t, n] of Object.entries(topicCounts) as [Topic, number][]) {
      if (n > topicMax) {
        topic = t;
        topicMax = n;
      }
    }
    if (topicMax < list.length * 0.25) topic = null;

    hotspots.push({
      id: key,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      countryCode: p.countryCode,
      count: list.length,
      topic,
      topicCounts,
      tone: Math.round((toneSum / list.length) * 100) / 100,
      articles: list
        .sort((a, b) => b.seenAt.getTime() - a.seenAt.getTime())
        .slice(0, ARTICLES_PER_HOTSPOT)
        .map((a) => ({
          title: a.title,
          url: a.url,
          source: a.source,
          seenAt: a.seenAt.toISOString(),
          tone: Math.round(a.tone * 100) / 100,
        })),
    });
  }
  hotspots.sort((a, b) => b.count - a.count);
  return { hotspots: hotspots.slice(0, MAX_HOTSPOTS), total: seen.size };
}

export async function buildSnapshot(): Promise<NewsSnapshot> {
  const latest = await latestSlot();

  const gkgSlots = Array.from({ length: GKG_FILES }, (_, i) => new Date(latest.getTime() - i * SLOT_MS));
  const hour0 = floorTo(latest, HOUR);
  const currentSlots = Array.from({ length: CURRENT_SAMPLES }, (_, i) => new Date(hour0.getTime() - i * HOUR));
  const base0 = new Date(floorTo(latest, BASELINE_STEP).getTime() - 24 * HOUR);
  const baselineSlots = Array.from(
    { length: BASELINE_SAMPLES },
    (_, i) => new Date(base0.getTime() - i * BASELINE_STEP),
  );

  const [gkgTexts, current, baseline] = await Promise.all([
    mapLimit(gkgSlots, 2, (s) => fetchSlotText(s, "gkg.csv")),
    mapLimit(currentSlots, 6, (s) => eventSummary(formatStamp(s))),
    mapLimit(baselineSlots, 6, (s) => eventSummary(formatStamp(s))),
  ]);

  const articles = gkgTexts.flatMap((t) => (t ? parseGkg(t) : []));
  const { hotspots, total } = buildHotspots(articles);
  const countries = buildSpikes(current, baseline);

  const missing =
    gkgTexts.filter((t) => t === null).length + [...current, ...baseline].filter((s) => s.missing).length;

  return {
    generatedAt: new Date().toISOString(),
    dataAsOf: latest.toISOString(),
    // GDELT posts each slot a minute or so after it closes.
    nextRefreshAt: new Date(latest.getTime() + SLOT_MS + 90_000).toISOString(),
    totalArticles: total,
    hotspots,
    countries,
    sources: {
      gkgFiles: gkgTexts.filter(Boolean).length,
      eventFiles: [...current, ...baseline].filter((s) => !s.missing).length,
      missingFiles: missing,
    },
  };
}
