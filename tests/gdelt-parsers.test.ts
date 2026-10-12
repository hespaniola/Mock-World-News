import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGkg, decodeEntities } from "../lib/gdelt/gkg";
import { parseEvents } from "../lib/gdelt/events";
import { classifyThemes } from "../lib/gdelt/topics";
import { formatStamp, parseStamp } from "../lib/gdelt/files";

// Rows are laid out per the GKG 2.1 and Events 2.0 codebooks.
function gkgRow(o: { collection?: string; themes?: string; locations?: string; tone?: string; extras?: string }) {
  const f = new Array(27).fill("");
  f[0] = "20261011220000-1";
  f[1] = "20261011220000";
  f[2] = o.collection ?? "1";
  f[3] = "example.com";
  f[4] = "https://example.com/story";
  f[7] = o.themes ?? "";
  f[10] = o.locations ?? "";
  f[15] = o.tone ?? "-3.5,1,4.5,5.5,20,0,300";
  f[26] = o.extras ?? "<PAGE_TITLE>A &amp; B&#39;s headline</PAGE_TITLE>";
  return f.join("\t");
}

test("GKG: picks first-mentioned city, decodes title, reads tone and topic", () => {
  const locs = [
    "1#Ukraine#UP#UP##49#32#UP#10",
    "4#Kharkiv, Kharkivs'ka Oblast', Ukraine#UP#UP07##49.9808#36.2527#-1036148#80",
    "4#Kyiv, Kyyiv, Misto, Ukraine#UP#UP12##50.4333#30.5167#-1044367#40",
  ].join(";");
  const [a] = parseGkg(gkgRow({ locations: locs, themes: "ARMEDCONFLICT;KILL;TAX_FNCACT_SOLDIERS;" }));
  assert.equal(a.title, "A & B's headline");
  assert.equal(a.primary?.name, "Kyiv, Kyyiv, Misto, Ukraine");
  assert.equal(a.primary?.lat, 50.4333);
  assert.equal(a.primary?.adm1Code, "UP12");
  assert.equal(a.tone, -3.5);
  assert.equal(a.topic, "conflict");
  assert.equal(a.seenAt.toISOString(), "2026-10-11T22:00:00.000Z");
});

test("GKG: falls back to a region when no city is mentioned", () => {
  const [a] = parseGkg(gkgRow({ locations: "1#France#FR#FR##46#2#FR#5;5#Bretagne, France#FR#FR2##48#-3#FR2#30" }));
  assert.equal(a.primary?.name, "Bretagne, France");
});

test("GKG: drops country-only, untitled, and non-web rows", () => {
  assert.equal(parseGkg(gkgRow({ locations: "1#France#FR#FR##46#2#FR#5" })).length, 0);
  assert.equal(parseGkg(gkgRow({ locations: "4#Paris, France#FR#FR00##48.86#2.35#-1456928#5", extras: "" })).length, 0);
  assert.equal(
    parseGkg(gkgRow({ collection: "2", locations: "4#Paris, France#FR#FR00##48.86#2.35#-1456928#5" })).length,
    0,
  );
});

test("Events: counts by ActionGeo country and prefers country centroid", () => {
  const row = (cc: string, type: string, lat: string, lng: string) => {
    const f = new Array(61).fill("");
    f[51] = type;
    f[53] = cc;
    f[56] = lat;
    f[57] = lng;
    return f.join("\t");
  };
  const r = parseEvents([row("UP", "4", "50.4", "30.5"), row("UP", "1", "49", "32"), row("FR", "4", "48.8", "2.3"), row("UP", "4", "49.9", "36.2")].join("\n"));
  assert.equal(r.total, 4);
  assert.deepEqual(r.counts, { UP: 3, FR: 1 });
  assert.deepEqual(r.points.UP, [49, 32]);
});

test("topics: majority theme wins, unmatched is null", () => {
  assert.equal(classifyThemes(["ECON_STOCKMARKET", "ECON_INFLATION", "ELECTION"]), "economy");
  assert.equal(classifyThemes(["NATURAL_DISASTER_FLOODS"]), "disaster");
  assert.equal(classifyThemes(["SPORTS", "MEDIA_MSM"]), null);
});

test("stamps round-trip and entities decode", () => {
  assert.equal(formatStamp(parseStamp("20261011221500")), "20261011221500");
  assert.equal(decodeEntities("&quot;x&quot; &#x2014; &lt;y&gt;"), '"x" — <y>');
});

test("country lookup: GDELT centroids land in the right world-atlas polygon", async () => {
  const { geoContains } = await import("d3-geo");
  const { getCountries } = await import("../lib/countries");
  const find = (lat: number, lng: number) => getCountries().find((f) => geoContains(f, [lng, lat]))?.properties.name;
  assert.equal(find(49, 32), "Ukraine");
  assert.equal(find(39.828175, -98.5795), "United States of America");
  assert.equal(find(35, 105), "China");
  assert.equal(find(-10, -55), "Brazil");
  assert.equal(find(30, 0), "Algeria");
  assert.equal(find(0, -30), undefined); // open ocean
});
