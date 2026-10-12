import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterHotspots, angularDistance } from "../lib/news/cluster";
import type { Hotspot } from "../lib/news/types";

const h = (id: string, lat: number, lng: number, count: number, topic: Hotspot["topic"] = null): Hotspot => ({
  id, name: id, lat, lng, countryCode: "XX", adm1Code: "", countryId: null, countryName: null, count, topic,
  topicCounts: topic ? { [topic]: count } : {}, tone: 0, articles: [],
});

test("nearby hotspots merge at far zoom and split when radius shrinks", () => {
  const spots = [h("paris", 48.86, 2.35, 10, "politics"), h("versailles", 48.8, 2.13, 2), h("tokyo", 35.68, 139.69, 5)];
  const far = clusterHotspots(spots, 5);
  assert.equal(far.length, 2);
  const paris = far.find((c) => c.members.length === 2)!;
  assert.equal(paris.count, 12);
  assert.equal(paris.topic, "politics");
  assert.ok(Math.abs(paris.lat - 48.85) < 0.1);
  assert.equal(clusterHotspots(spots, 0).length, 3);
});

test("clusters across the antimeridian get a sensible centroid", () => {
  const [c] = clusterHotspots([h("a", 0, 179.5, 1), h("b", 0, -179.5, 1)], 5);
  assert.equal(c.members.length, 2);
  assert.ok(Math.abs(Math.abs(c.lng) - 180) < 0.01);
  assert.ok(Math.abs(angularDistance(0, 179.5, 0, -179.5) - 1) < 1e-6);
});
