import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildBoundaries, findProvince } from "../lib/geo/boundaries";

const load = (f: string) => JSON.parse(readFileSync(new URL(`../public/geo/${f}`, import.meta.url), "utf8"));
const b = buildBoundaries(load("countries-50m.topo.json"), load("admin1.topo.json"));

test("province lookup: GDELT ADM1 code first, point-in-polygon otherwise", () => {
  assert.equal(findProvince(b, "UP07", 49.98, 36.25)?.properties.name, "Kharkiv");
  // GDELT's US codes (USTX) don't match Natural Earth's (US48): falls back to the point.
  assert.equal(findProvince(b, "USTX", 30.27, -97.74)?.properties.name, "Texas");
  assert.equal(findProvince(b, "", 15.5, 32.56)?.properties.admin, "Sudan");
  assert.equal(findProvince(b, "", 0, -30), null);
});

test("border meshes are non-empty", () => {
  assert.ok(b.countryLines.coordinates.length > 300);
  assert.ok(b.provinceLines.coordinates.length > 1000);
});
