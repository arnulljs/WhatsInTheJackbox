#!/usr/bin/env node
/**
 * Scrape Jackbox Party Pack pages for real icons + trailers
 * Ponytail: single file, no deps, uses native fetch — run locally where jackboxgames.com is NOT blocked.
 * The build env (forward.http.proxy) blocks jackboxgames.com / cms.jackboxgames.com / steam, so this
 * script will show "Blocked site" there. Run it on your own machine / GitHub Action to populate real art.
 *
 * Usage:
 *   node scripts/scrape-jackbox.js
 *   # writes src/data/games.json with scraped youtubeId + iconUrl where found, keeps existing fallback otherwise
 *
 * Pack URLs scraped (as you suggested):
 *   https://www.jackboxgames.com/games/packs/the-jackbox-party-pack
 *   https://www.jackboxgames.com/games/packs/the-jackbox-party-pack-2 … -11
 *   https://www.jackboxgames.com/games/packs/the-jackbox-naughty-pack
 *   https://www.jackboxgames.com/games/packs/the-jackbox-party-starter  (optional)
 *
 * What it extracts per pack page:
 *   - game titles + slugs (links to /games/<slug> or /games/packs/.../<slug>)
 *   - icon / hero image src (img[src*="jackbox"] or cms url)
 *   - trailer YouTube ID via youtube.com/embed/ID, youtu.be/ID, watch?v=ID
 * For detail, it also fetches each game's own page (e.g. /games/drawful-animate) for better trailer/icon.
 */

import fs from 'fs';
import path from 'path';

const PACKS = [
  { pack: 'Party Pack 1', slug: 'the-jackbox-party-pack', packId: 'pp1', year: 2014 },
  { pack: 'Party Pack 2', slug: 'the-jackbox-party-pack-2', packId: 'pp2', year: 2015 },
  { pack: 'Party Pack 3', slug: 'the-jackbox-party-pack-3', packId: 'pp3', year: 2016 },
  { pack: 'Party Pack 4', slug: 'the-jackbox-party-pack-4', packId: 'pp4', year: 2017 },
  { pack: 'Party Pack 5', slug: 'the-jackbox-party-pack-5', packId: 'pp5', year: 2018 },
  { pack: 'Party Pack 6', slug: 'the-jackbox-party-pack-6', packId: 'pp6', year: 2019 },
  { pack: 'Party Pack 7', slug: 'the-jackbox-party-pack-7', packId: 'pp7', year: 2020 },
  { pack: 'Party Pack 8', slug: 'the-jackbox-party-pack-8', packId: 'pp8', year: 2021 },
  { pack: 'Party Pack 9', slug: 'the-jackbox-party-pack-9', packId: 'pp9', year: 2022 },
  { pack: 'Party Pack 10', slug: 'the-jackbox-party-pack-10', packId: 'pp10', year: 2023 },
  { pack: 'Party Pack 11', slug: 'the-jackbox-party-pack-11', packId: 'pp11', year: 2024 },
  { pack: 'Naughty Pack', slug: 'the-jackbox-naughty-pack', packId: 'naughty', year: 2024 },
];

const BASE = 'https://www.jackboxgames.com';
const GAMES_JSON = path.resolve('src/data/games.json');
const LINKS_TXT = path.resolve('scripts/links.txt');

function ytIdFromUrl(url) {
  if (!url) return '';
  // youtube.com/embed/ID, youtube.com/watch?v=ID, youtu.be/ID, youtube-nocookie
  const m = url.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([A-Za-z0-9_-]{6,15})/);
  return m ? m[1] : '';
}

function extractYouTubeIds(html) {
  const ids = new Set();
  // find all youtube urls
  const re = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{6,15})[^"'\s]*/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  // also embedded json like "youtubeId":"xxxx"
  const re2 = /youtubeId["']?\s*[:=]\s*["']([A-Za-z0-9_-]{6,15})["']/g;
  while ((m = re2.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

function extractImages(html) {
  // prefer cms/jackbox image urls that look like game art, not icons
  const imgs = [];
  const re = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let src = m[1];
    if (src.startsWith('/')) src = BASE + src;
    // filter to likely game/pack art (contains jackbox, cms, or pack/game slug)
    if (/jackbox|strapi|cms|cloudfront|amazonaws|\.jpg|\.png|\.webp/i.test(src)) imgs.push(src);
  }
  return [...new Set(imgs)];
}

function extractGameLinks(html, packSlug) {
  // links to /games/<slug> that are not pack list itself
  const links = [];
  const re = /href=["'](\/games\/(?:packs\/)?[^"']+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href = m[1];
    // normalize
    if (href.startsWith('/games/packs/')) continue; // pack page itself, not game
    if (href === `/games/packs/${packSlug}`) continue;
    if (!href.startsWith('/games/')) continue;
    // filter out non-game sections like /games, /games/packs
    if (href === '/games' || href === '/games/packs') continue;
    if (href.includes('/games/bundles/')) continue;
    links.push(href);
  }
  return [...new Set(links)];
}

function extractTitle(html) {
  // try og:title, <title>, h1
  let m = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (m) return m[1].trim();
  m = html.match(/<title>([^<]+)<\/title>/i);
  if (m) return m[1].replace(/\|.*$/, '').trim();
  m = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (m) return m[1].trim();
  return '';
}

async function fetchHtml(url) {
  console.log(`  GET ${url}`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JackboxPicker/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  const text = await res.text();
  if (text.includes('Blocked site') || text.includes('Access denied')) {
    throw new Error(`Blocked by proxy (forward.http.proxy) — run this script outside the blocked network. HTML snippet: ${text.slice(0,200)}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return text;
}

async function scrapePack(pack) {
  const url = `${BASE}/games/packs/${pack.slug}`;
  console.log(`\n[${pack.pack}] ${url}`);
  const html = await fetchHtml(url);

  const ytIds = extractYouTubeIds(html);
  const imgs = extractImages(html);
  const links = extractGameLinks(html, pack.slug);

  console.log(`  found ${ytIds.length} youtube ids, ${imgs.length} imgs, ${links.length} game links`);
  if (ytIds.length) console.log(`  yt: ${ytIds.slice(0,3).join(', ')}`);
  if (imgs.length) console.log(`  img sample: ${imgs[0].slice(0,80)}...`);

  const games = [];

  // pack trailer is often the first youtube id on pack page; keep as fallback for each game in pack
  const packTrailer = ytIds[0] || '';

  for (const link of links.slice(0, 8)) { // cap 8 per pack, but packs have 5
    const gameUrl = BASE + link;
    try {
      const gHtml = await fetchHtml(gameUrl);
      const title = extractTitle(gHtml) || link.split('/').pop().replace(/-/g, ' ');
      const gYts = extractYouTubeIds(gHtml);
      const gImgs = extractImages(gHtml);
      // pick best: first youtube on game page is likely official trailer
      const trailer = gYts[0] || packTrailer || '';
      // pick first large image that isn't favicon
      const icon = gImgs.find(u => !u.includes('favicon') && !u.includes('apple-touch')) || imgs[0] || '';
      console.log(`    - ${title} -> yt:${trailer || '(none)'} icon:${icon ? icon.slice(0,60)+'...' : '(none)'}`);

      games.push({
        slug: link.split('/').pop(),
        title,
        pack: pack.pack,
        packId: pack.packId,
        year: pack.year,
        youtubeId: trailer,
        iconUrl: icon,
        url: gameUrl,
      });
      // be nice
      await new Promise(r => setTimeout(r, 300));
    } catch (e) {
      console.warn(`    ! failed ${link}: ${e.message}`);
    }
  }

  return games;
}

function readLinksFile() {
  try {
    const raw = fs.readFileSync(LINKS_TXT, 'utf8');
    const urls = raw.split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#') && s.startsWith('http'));
    if (urls.length) console.log(`Found ${urls.length} URLs in ${LINKS_TXT}`);
    return urls;
  } catch { return []; }
}

function packFromUrl(url) {
  // try to infer pack from url slug, fallback to generic
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').pop();
    const hit = PACKS.find(p => p.slug === slug);
    if (hit) return hit;
    // handle /the-jackbox-party-pack-1 -> treat as pack 1
    if (slug === 'the-jackbox-party-pack-1') return PACKS[0];
    // guess pack from slug
    return { pack: slug.replace(/-/g,' '), slug, packId: 'unknown', year: 2024 };
  } catch { return null; }
}

async function scrapeUrl(url) {
  // single url: if pack page -> use scrapePack flow, else single game
  if (url.includes('/games/packs/')) {
    const pack = packFromUrl(url) || { pack: 'Pack', slug: url.split('/').pop(), packId: 'unknown', year: 2024 };
    // try direct fetch first (handles both /the-jackbox-party-pack and /the-jackbox-party-pack-1)
    try {
      return await scrapePack(pack);
    } catch (e) {
      // fallback for pack1 mis-slug
      if (pack.slug === 'the-jackbox-party-pack-1') {
        console.log('  retry as the-jackbox-party-pack');
        return await scrapePack({ ...pack, slug: 'the-jackbox-party-pack' });
      }
      throw e;
    }
  } else if (url.includes('/games/')) {
    // single game page
    console.log(`\n[Game] ${url}`);
    const html = await fetchHtml(url);
    const title = extractTitle(html) || url.split('/').pop().replace(/-/g,' ');
    const yts = extractYouTubeIds(html);
    const imgs = extractImages(html);
    const trailer = yts[0] || '';
    const icon = imgs.find(u => !u.includes('favicon')) || '';
    console.log(`  -> ${title} yt:${trailer||'(none)'} icon:${icon?icon.slice(0,60)+'...':'(none)'}`);
    const slug = url.split('/').pop().split('?')[0];
    return [{ slug, title, pack: 'Standalone', packId: 'standalone', year: 2024, youtubeId: trailer, iconUrl: icon, url }];
  } else {
    console.warn(`  skip unknown url pattern: ${url}`);
    return [];
  }
}

async function main() {
  console.log('Jackbox scraper — will update src/data/games.json with real icons/trailers');
  console.log('If you see "Blocked site", run this outside the corporate proxy (your laptop, GH Actions).');

  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(GAMES_JSON, 'utf8')); } catch {}
  const existingMap = new Map(existing.map(g => [g.id || g.title.toLowerCase().replace(/\s+/g,'-'), g]));

  const links = readLinksFile();
  const useLinks = links.length > 0;
  if (useLinks) console.log(`Using links from ${LINKS_TXT} (${links.length}), following game links as you chose.`);

  const allScraped = [];
  if (useLinks) {
    for (const url of links) {
      try {
        const gs = await scrapeUrl(url);
        allScraped.push(...gs);
      } catch (e) {
        console.error(`!! ${url} failed: ${e.message}`);
      }
    }
  } else {
    for (const pack of PACKS) {
      try {
        const gs = await scrapePack(pack);
        allScraped.push(...gs);
      } catch (e) {
        console.error(`!! ${pack.pack} failed: ${e.message}`);
        // fallback: keep existing pack games as-is
      }
    }
  }

  console.log(`\nScraped ${allScraped.length} game entries from site.`);

  // Merge into existing games.json: update youtubeId + iconUrl where we found real data
  let updated = 0;
  for (const s of allScraped) {
    // try to match existing by title (case-insensitive) or slug
    const key = s.title.toLowerCase().trim();
    let match = existing.find(g => g.title.toLowerCase().trim() === key);
    if (!match) {
      // try slug match via id
      const slugId = s.slug.replace(/-/g, '');
      match = existing.find(g => g.id.replace(/[-_]/g,'') === slugId);
    }
    if (!match) {
      // try contains
      match = existing.find(g => key.includes(g.title.toLowerCase()) || g.title.toLowerCase().includes(key));
    }
    if (match) {
      if (s.youtubeId) { match.youtubeId = s.youtubeId; updated++; }
      if (s.iconUrl) { match.iconUrl = s.iconUrl; updated++; }
      // also ensure pack/year correct if missing
      if (!match.iconUrl && s.iconUrl) match.iconUrl = s.iconUrl;
    } else {
      console.log(`  new game not in existing json (skipped, add manually): ${s.title} @ ${s.url}`);
    }
  }

  // also ensure any game still without youtubeId gets a search fallback note (keep as "" — app will use search embed)
  // keep dummyimage as fallback for icon if still empty (should not happen after scrape, but ensure)
  for (const g of existing) {
    if (!g.iconUrl) g.iconUrl = `https://dummyimage.com/600x400/ffe600/000.png&text=${encodeURIComponent(g.title).replace(/%20/g,'+')}`;
    if (g.youtubeId === undefined) g.youtubeId = '';
  }

  fs.writeFileSync(GAMES_JSON, JSON.stringify(existing, null, 2));
  console.log(`\nUpdated ${updated} fields in ${GAMES_JSON} (youtubeId/iconUrl where found).`);
  console.log(`Total games in file: ${existing.length}`);
  console.log(`Next: npm run build && npm run dev to see real previews.`);
  // quick sanity: verify Hypnotorious etc no longer has bad id
  const bad = ['2Vv-BfVoq4g','dQw4w9WgXcQ','kJQP7kiw5Fk','9bZkp7q19f0'];
  const stillBad = existing.filter(g => bad.includes(g.youtubeId));
  if (stillBad.length) console.warn(`WARN still has bad ids: ${stillBad.map(g=>g.title+':'+g.youtubeId).join(', ')}`);
  else console.log('No known bad YouTube IDs remain.');
}

main().catch(e => { console.error(e); process.exit(1); });
