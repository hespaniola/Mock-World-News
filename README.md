# Mock World News

A holographic news globe showing where news is happening around the world right
now. Built with Next.js, react-globe.gl (three.js), Framer Motion and Tailwind.

## Run

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # GDELT parser + clustering tests
npm run build   # production build (Vercel-ready)
```

## Data

All data comes from [GDELT 2.0](https://www.gdeltproject.org/) raw files, which
GDELT publishes every 15 minutes at `http://data.gdeltproject.org/gdeltv2/`.
They need no API key and have no rate limit. Only the server reads them
(`app/api/news/route.ts`); the browser only ever calls `/api/news`.

- **Dots (city/region):** the last hour of GKG files (4 × 15 min). Each article
  is placed at the first city it mentions (or region if no city), and coloured
  by its GKG themes (conflict / economy / politics / disaster, else cyan).
- **Country glow:** how far a country's share of GDELT events in the last 24h
  sits above its own share over the previous week. Sampled hourly (24 files)
  vs. every 6h (28 files); only the share ratio matters, so a busy news day
  doesn't light up everything.
- **Caching:** the snapshot is rebuilt at most every 15 minutes. Event-file
  summaries are cached forever, since GDELT never changes a published file.

## Interaction

Click a dot (or cluster) to fly to it and open the story panel: a plain-
language summary built from the numbers, topic mix, a tone meter (GDELT
tone), nearby places, and the latest headlines with links out. The selected
place's state/province is outlined. Close (or Esc) flies back out and resumes
rotation.

Borders: 1:50m country borders, plus state/province borders (Natural Earth
admin-1, see `public/geo/README.md`) that fade in as you zoom.

`GDELT_BASE_URL` can point the server at a local mirror for offline testing.

## Build progress

1. [x] Styled globe and overall look
2. [x] Country glow + city/region dots, on live GDELT data
3. [x] Click interaction and story panel (+ state/province borders)
4. [ ] Globe details (terminator, pings, arcs, reticle, ISS)
5. [ ] HUD
6. [ ] Polish (boot sequence, search, sounds, reduced motion, mobile)
7. [x] Live GDELT data (pulled forward with step 2)
