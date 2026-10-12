Boundary data, loaded lazily by the globe when it starts.

- `admin1.topo.json`: Natural Earth 1:10m admin-1 states/provinces (public
  domain), fields `name, admin, type_en, fips`, simplified to 3% with
  mapshaper 0.7.83 (`-simplify 3% keep-shapes`, quantization 1e5). `fips`
  matches GDELT's ADM1 codes for most countries (not the US).
- `countries-50m.topo.json`: Natural Earth 1:50m countries via `world-atlas@2`.
