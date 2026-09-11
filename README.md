# What's In The Jackbox? — Picker

Jackbox.tv-inspired picker: filter by **player count, packs owned, game type, family-friendly, audience, duration, mature** → **slot-machine random** → grid browse → modal with **icon + trailer**.

66 games (Packs 1–11 + Naughty + Standalone). `localStorage` for owned packs, filters, and history. No accounts, no backend.

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # → dist/
```

## Scrape real art / trailers

Games without a YouTube trailer fallback to `dummyimage.com` placeholders and YouTube search embeds. To populate real icons and trailers from jackboxgames.com:

```bash
npm run scrape   # native fetch, zero deps, regex-based — no cheerio
```

Scrapes each pack page and per-game page for `youtubeId` + `iconUrl`, merges into `src/data/games.json`. Won't overwrite existing entries. Works on any machine with unblocked access to jackboxgames.com.

## Stack

Vite + React. No router, no Tailwind, no state library — just `useState` + `localStorage`.
