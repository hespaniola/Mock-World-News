import { test } from "node:test";
import assert from "node:assert/strict";
import { areaFromHotspots, describeArea, shortName, toneLabel } from "../lib/news/area";
import type { Hotspot } from "../lib/news/types";

const art = (url: string, seenAt: string) => ({ title: url, url, source: "s", seenAt, tone: 0 });
const h = (id: string, count: number, tone: number, topicCounts: Hotspot["topicCounts"], articles = [art(id, "2026-10-12T01:00:00Z")]): Hotspot => ({
  id, name: `${id}, Region, Country`, lat: 0, lng: 0, countryCode: "XX", adm1Code: "", countryId: "1", countryName: "X",
  count, topic: null, topicCounts, tone, articles,
});

test("area merges places: weighted tone, newest-first deduped articles", () => {
  const a = areaFromHotspots([
    h("Small", 1, 4, {}, [art("u1", "2026-10-12T01:00:00Z")]),
    h("Big", 3, -4, { conflict: 3 }, [art("u2", "2026-10-12T02:00:00Z"), art("u1", "2026-10-12T01:00:00Z")]),
  ]);
  assert.equal(a.places[0].id, "Big");
  assert.equal(a.count, 4);
  assert.equal(a.tone, -2);
  assert.equal(a.topic, "conflict");
  assert.deepEqual(a.articles.map((x) => x.url), ["u2", "u1"]);
  assert.equal(a.articles[0].place, "Big");
});

test("plain-language description uses only snapshot numbers", () => {
  const a = areaFromHotspots([h("Kyiv", 40, -4.2, { conflict: 30, politics: 4 })]);
  const lines = describeArea(a, { id: "804", name: "Ukraine", current: 10, expected: 4, ratio: 2.5, intensity: 0.6 });
  assert.deepEqual(lines, [
    "40 stories about this place in the last hour.",
    "Mostly conflict news (75% of stories).",
    "The overall tone of the coverage is negative.",
    "News about Ukraine is running 2.5× its usual level today.",
  ]);
  assert.equal(describeArea(areaFromHotspots([h("A", 1, 0, {})]), undefined)[1], "Mostly general news, outside the tracked topics.");
});

test("helpers", () => {
  assert.equal(shortName("Kharkiv, Kharkivs'ka Oblast', Ukraine"), "Kharkiv");
  assert.equal(toneLabel(-6), "very negative");
  assert.equal(toneLabel(0.2), "neutral");
  assert.equal(toneLabel(3), "positive");
});
