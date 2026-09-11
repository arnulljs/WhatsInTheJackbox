<p align="center"><img src="public/whatsinthejackboxlogo.png" alt="What's In The Jackbox?" width="200"></p>

# What's In The Jackbox? — Picker

Jackbox.tv-inspired picker: filter by **player count, packs owned, game type, family-friendly, audience, duration, mature** → **slot-machine random** → grid browse → modal with **icon + trailer**.

**Live:** [whatsinthejackbox.vercel.app](https://whatsinthejackbox.vercel.app)

66 games (Packs 1–11 + Naughty + Standalone). `localStorage` for owned packs, filters, and history. No accounts, no backend.

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # → dist/
```

## Scrape real art / trailers

Games without a YouTube trailer fall back to `dummyimage.com` placeholders. To populate real icons and trailers from jackboxgames.com:

```bash
npm run scrape   # native fetch, zero deps, regex-based — no cheerio
```

Scrapes each pack page and per-game page for `youtubeId` + `iconUrl`, merges into `src/data/games.json`. Won't overwrite existing entries. Works on any machine with unblocked access to jackboxgames.com.

## Stack

Vite + React. No router, no Tailwind, no state library — just `useState` + `localStorage`.
