const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic CORS; tighten origins via CORS_ORIGINS if needed
const allowedOriginsEnv = process.env.CORS_ORIGINS;
let corsOptions = {};
if (allowedOriginsEnv) {
  const origins = allowedOriginsEnv.split(',').map((s) => s.trim());
  corsOptions = {
    origin: function (origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  };
} else {
  corsOptions = { origin: '*'};
}

app.use(cors(corsOptions));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Utility to build Overpass QL query
function buildOverpassQuery(latitude, longitude, radiusMeters) {
  const r = Math.max(100, Math.min(Number(radiusMeters) || 2000, 50000));
  const lat = Number(latitude);
  const lon = Number(longitude);
  return `
    [out:json][timeout:25];
    (
      node["tourism"](around:${r},${lat},${lon});
      way["tourism"](around:${r},${lat},${lon});
      relation["tourism"](around:${r},${lat},${lon});
      node["historic"](around:${r},${lat},${lon});
      way["historic"](around:${r},${lat},${lon});
      relation["historic"](around:${r},${lat},${lon});
    );
    out center;
  `;
}

async function fetchFromOverpass(query) {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.openstreetmap.ru/api/interpreter',
  ];
  let lastError = null;
  for (const url of endpoints) {
    try {
      const response = await axios.post(url, query, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 25000,
      });
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('All Overpass endpoints failed');
}

function normalizeElement(element) {
  const tags = element.tags || {};
  const type = element.type; // node | way | relation
  const id = `${type}/${element.id}`;

  let latitude = element.lat;
  let longitude = element.lon;
  if ((type === 'way' || type === 'relation') && element.center) {
    latitude = element.center.lat;
    longitude = element.center.lon;
  }

  const name = tags.name || tags['name:en'] || null;
  const category = tags.tourism || tags.historic || 'attraction';

  return {
    id,
    name: name || category,
    category,
    latitude,
    longitude,
    tags: {
      tourism: tags.tourism,
      historic: tags.historic,
      attraction: tags.attraction,
      website: tags.website || tags.url,
      wikidata: tags.wikidata,
      wikipedia: tags.wikipedia,
      opening_hours: tags.opening_hours,
      addr_city: tags['addr:city'],
      addr_street: tags['addr:street'],
      addr_housenumber: tags['addr:housenumber'],
    },
  };
}

// --- Image enrichment helpers ---
const imageCache = new Map(); // key -> { url, ts }
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getCachedImage(key) {
  const entry = imageCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > ONE_DAY_MS) {
    imageCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCachedImage(key, url) {
  if (!url) return;
  imageCache.set(key, { url, ts: Date.now() });
}

function parseWikidataId(value) {
  if (!value) return null;
  const id = String(value).trim();
  if (/^Q\d+$/i.test(id)) return id.toUpperCase();
  return null;
}

function parseWikipediaTag(value) {
  if (!value) return null;
  const parts = String(value).split(':');
  if (parts.length < 2) return null;
  const lang = parts[0];
  const title = parts.slice(1).join(':');
  if (!lang || !title) return null;
  return { lang, title };
}

async function fetchWikidataImage(wikidataId) {
  try {
    const key = `wikidata:${wikidataId}`;
    const cached = getCachedImage(key);
    if (cached) return cached;
    const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(wikidataId)}.json`;
    const { data } = await axios.get(url, { timeout: 10000 });
    const entity = data?.entities?.[wikidataId];
    const claims = entity?.claims;
    const p18 = Array.isArray(claims?.P18) && claims.P18[0]?.mainsnak?.datavalue?.value;
    if (p18) {
      const fileName = p18; // e.g., "Some Image.jpg"
      const img = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=640`;
      setCachedImage(key, img);
      return img;
    }
    return null;
  } catch (_e) {
    return null;
  }
}

async function fetchWikipediaImage(tag) {
  try {
    const parsed = parseWikipediaTag(tag);
    if (!parsed) return null;
    const { lang, title } = parsed;
    const key = `wikipedia:${lang}:${title}`;
    const cached = getCachedImage(key);
    if (cached) return cached;
    const api = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=640&titles=${encodeURIComponent(title)}`;
    const { data } = await axios.get(api, { timeout: 10000, headers: { 'User-Agent': 'Attraviso/1.0' } });
    const pages = data?.query?.pages || {};
    const first = Object.values(pages)[0];
    const url = first?.thumbnail?.source || null;
    if (url) setCachedImage(key, url);
    return url || null;
  } catch (_e) {
    return null;
  }
}

function toAbsoluteUrl(base, src) {
  try { return new URL(src, base).toString(); } catch (_e) { return null; }
}

async function fetchWebsiteOgImage(websiteUrl) {
  try {
    if (!websiteUrl) return null;
    const key = `website:${websiteUrl}`;
    const cached = getCachedImage(key);
    if (cached) return cached;
    const { data: html } = await axios.get(websiteUrl, { timeout: 10000, headers: { 'User-Agent': 'AttravisoBot/1.0 (+https://example.com)' } });
    const $ = cheerio.load(html);
    const og = $('meta[property="og:image"]').attr('content')
      || $('meta[name="twitter:image"]').attr('content')
      || $('meta[name="og:image"]').attr('content');
    const abs = toAbsoluteUrl(websiteUrl, og);
    if (abs) setCachedImage(key, abs);
    return abs || null;
  } catch (_e) {
    return null;
  }
}

async function enrichItemWithImage(item) {
  if (item.imageUrl) return item;
  const wikidataId = parseWikidataId(item?.tags?.wikidata);
  if (wikidataId) {
    const url = await fetchWikidataImage(wikidataId);
    if (url) { item.imageUrl = url; return item; }
  }
  if (item?.tags?.wikipedia) {
    const url = await fetchWikipediaImage(item.tags.wikipedia);
    if (url) { item.imageUrl = url; return item; }
  }
  if (item?.tags?.website) {
    const url = await fetchWebsiteOgImage(item.tags.website);
    if (url) { item.imageUrl = url; return item; }
  }
  return item;
}

async function enrichImages(items, concurrency = 8, maxItems = 120) {
  const list = items.slice(0, maxItems);
  let i = 0;
  const workers = new Array(concurrency).fill(0).map(async () => {
    while (i < list.length) {
      const idx = i++;
      const it = list[idx];
      // eslint-disable-next-line no-await-in-loop
      await enrichItemWithImage(it);
    }
  });
  await Promise.all(workers);
  return items;
}

app.get('/api/attractions', async (req, res) => {
  const { lat, lon, radius } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Missing required query params: lat, lon' });
  }

  try {
    const query = buildOverpassQuery(lat, lon, radius);
    const data = await fetchFromOverpass(query);
    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const results = elements
      .filter((el) => {
        if (el.type === 'node') return el.lat && el.lon;
        return !!el.center;
      })
      .map(normalizeElement)
      .filter((e) => e.latitude && e.longitude)
      .slice(0, 300);

    const shouldEnrich = req.query.enrich !== '0';
    if (shouldEnrich) {
      await enrichImages(results);
    }

    res.json({ count: results.length, items: results });
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({ error: 'Failed to fetch attractions', details: error.message });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});


