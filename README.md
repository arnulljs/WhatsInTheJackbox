# What's In The Jackbox? — Picker

Jackbox.tv-inspired picker: filter by **player count, packs owned, game type, family-friendly, audience, duration, mature** → **slot-machine random** → grid browse → modal with **icon + trailer**.

`66` games (Packs 1–11 + Naughty + Standalone), `localStorage` for owned packs/filters/history, on-brand neon + chunky.

## Run

```bash
npm install
npm run dev    # http://localhost:5173
npm run build  # → dist/
```

## Real art / trailers — scraping

The build env here is behind `forward.http.proxy:3128` which blocks `jackboxgames.com`, `cms.jackboxgames.com`, `store.steampowered.com` (all return `Blocked site`). So the repo ships with `dummyimage.com` placeholders + YouTube search embeds.

**To get real icons + trailers from the official site** (your example `https://www.jackboxgames.com/games/packs/the-jackbox-party-pack-10`):

```bash
# run locally where jackboxgames.com is NOT blocked (your laptop, not this proxy)
npm run scrape
# scrapes each pack page + each game page for:
#  - title, icon src, youtubeId (youtube.com/embed/ID, youtu.be/ID, watch?v=ID)
# merges into src/data/games.json (keeps dummyimage/search fallback where not found)
npm run build
```

Scraper: `scripts/scrape-jackbox.js` — single file, no deps, native `fetch`, regex-based (no cheerio). It fetches:

- `https://www.jackboxgames.com/games/packs/the-jackbox-party-pack` (1), `-2`…`-11`, `the-jackbox-naughty-pack`
- then each `/games/<slug>` for per-game trailer/icon
- pack trailer as fallback for each game in pack

If it sees `Blocked site` it warns and keeps existing `games.json` (so `npm run dev` still works behind the proxy). Pack 10's 5 games are already populated with real YouTube IDs + `img.youtube.com` thumbs as a demo (`6OCQneA9sx4` etc via `websearch`).

Icons use `https://img.youtube.com/vi/{youtubeId}/hqdefault.jpg` when trailer exists (allowed, `200`), else `dummyimage.com` pack-colored tile. Trailers use `https://www.youtube.com/embed/{id}`; missing ones use `https://www.youtube.com/embed?listType=search&list=jackbox+{title}+trailer` so Hypnotorious no longer shows Ed Sheeran (`2Vv-BfVoq4g` cleared).

## Stack

Vite + React (as requested). No router, no Tailwind, no backend — `useState` + `localStorage`. See `src/App.jsx:17`, `src/data/games.json:1`.

`ponytail: dummyimage/search embed are placeholders; replace via `npm run scrape` locally for real CDN art.`
