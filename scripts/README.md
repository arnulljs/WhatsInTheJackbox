# Scraper

`scrape-jackbox.js` — ponytail: one file, zero deps, native fetch.

```bash
npm run scrape
```

Scrapes `https://www.jackboxgames.com/games/packs/the-jackbox-party-pack*` for icons + trailers as you asked (your example: `/the-jackbox-party-pack-10` → Tee K.O.2, FixyText, Hypnotorious, Timejinx, Dodo Re Mi).

- In this build env it hits `Blocked site` (forward proxy) and exits gracefully, keeping `src/data/games.json` with dummyimage/search fallback.
- On your machine (no proxy) it will populate `youtubeId` + `iconUrl` with real `cms.jackboxgames.com` / `youtube.com/embed` URLs and thumbnails via `img.youtube.com`.

Edit `PACKS` array in the script to add packs/bundles.
