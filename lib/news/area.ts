import { TOPIC_LABELS, type Topic } from "@/lib/theme";
import { dominantTopic } from "./cluster";
import type { Article, CountrySpike, Hotspot } from "./types";

/** What the story panel shows: one place, or a cluster of nearby places. */
export type Area = {
  id: string;
  /** Biggest place first. */
  places: Hotspot[];
  lat: number;
  lng: number;
  count: number;
  topic: Topic | null;
  topicCounts: Partial<Record<Topic, number>>;
  /** Story-weighted mean tone. */
  tone: number;
  /** Newest first, each tagged with the place it came from. */
  articles: (Article & { place: string })[];
};

/** "Kharkiv, Kharkivs'ka Oblast', Ukraine" -> "Kharkiv". */
export function shortName(fullName: string): string {
  return fullName.split(",")[0].trim();
}

export function areaFromHotspots(members: Hotspot[], lat?: number, lng?: number): Area {
  const places = [...members].sort((a, b) => b.count - a.count);
  const lead = places[0];
  const topicCounts: Partial<Record<Topic, number>> = {};
  let count = 0;
  let toneSum = 0;
  for (const h of places) {
    count += h.count;
    toneSum += h.tone * h.count;
    for (const [t, n] of Object.entries(h.topicCounts) as [Topic, number][]) topicCounts[t] = (topicCounts[t] ?? 0) + n;
  }
  const seen = new Set<string>();
  const articles = places
    .flatMap((h) => h.articles.map((a) => ({ ...a, place: shortName(h.name) })))
    .filter((a) => (seen.has(a.url) ? false : (seen.add(a.url), true)))
    .sort((a, b) => b.seenAt.localeCompare(a.seenAt));
  return {
    id: places.length === 1 ? lead.id : `area:${places.map((p) => p.id).join("+")}`,
    places,
    lat: lat ?? lead.lat,
    lng: lng ?? lead.lng,
    count,
    topic: dominantTopic(places),
    topicCounts,
    tone: count ? toneSum / count : 0,
    articles,
  };
}

/** Plain-language band for GDELT's tone score (roughly -10..+10, most news -6..+3). */
export function toneLabel(tone: number): string {
  if (tone <= -5) return "very negative";
  if (tone <= -2) return "negative";
  if (tone < -0.5) return "slightly negative";
  if (tone <= 0.5) return "neutral";
  if (tone < 2) return "slightly positive";
  if (tone < 5) return "positive";
  return "very positive";
}

/**
 * A few short sentences describing the area, built only from the numbers in
 * the snapshot (no generated text).
 */
export function describeArea(area: Area, country: CountrySpike | undefined, windowLabel = "the last hour"): string[] {
  const lines: string[] = [];
  const n = area.count;
  lines.push(`${n.toLocaleString("en-US")} ${n === 1 ? "story" : "stories"} about this ${area.places.length > 1 ? "area" : "place"} in ${windowLabel}.`);

  const topicTotal = Object.values(area.topicCounts).reduce((s, v) => s + (v ?? 0), 0);
  if (area.topic) {
    const share = Math.round(((area.topicCounts[area.topic] ?? 0) / n) * 100);
    lines.push(`Mostly ${TOPIC_LABELS[area.topic].toLowerCase()} news (${share}% of stories).`);
  } else if (topicTotal > 0) {
    lines.push("Coverage is spread across several topics.");
  } else {
    lines.push("Mostly general news, outside the tracked topics.");
  }

  lines.push(`The overall tone of the coverage is ${toneLabel(area.tone)}.`);

  if (country && country.ratio >= 1.3) {
    lines.push(`News about ${country.name} is running ${country.ratio.toFixed(1)}× its usual level today.`);
  } else if (country) {
    lines.push(`News about ${country.name} is at about its usual level today.`);
  }
  return lines;
}
