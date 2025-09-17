const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dns = require('dns').promises;
const net = require('net');

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
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Rate limit the image proxy to mitigate abuse
const imageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.IMAGE_RATE_LIMIT || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/image', imageLimiter);

// --- Utilities ---
function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // m
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Utility to build Overpass QL query
function buildOverpassQuery(latitude, longitude, radiusMeters) {
  const requested = Number(radiusMeters) || 2000;
  const r = Math.max(100, Math.min(requested, 200000));
  const lat = Number(latitude);
  const lon = Number(longitude);

  // Scale Overpass timeout based on radius
  let timeoutSec = 25;
  if (r > 35000) timeoutSec = 60;
  if (r > 70000) timeoutSec = 120;
  if (r > 150000) timeoutSec = 180;

  // Limit number of returned elements to keep responses manageable
  const limit = r > 70000 ? 1000 : 2000;

  // Narrow tourism features to attraction-like values to avoid hotels, campsites, etc.
  const tourismValues = '^(attraction|museum|gallery|artwork|theme_park|zoo|viewpoint|aquarium)$';

  return `
    [out:json][timeout:${timeoutSec}];
    (
      node["tourism"~"${tourismValues}"](around:${r},${lat},${lon});
      way["tourism"~"${tourismValues}"](around:${r},${lat},${lon});
      relation["tourism"~"${tourismValues}"](around:${r},${lat},${lon});
      node["historic"](around:${r},${lat},${lon});
      way["historic"](around:${r},${lat},${lon});
      relation["historic"](around:${r},${lat},${lon});
    );
    out center ${limit};
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
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'Attraviso/1.0 (+https://attraviso.app)'
        },
        timeout: parseInt(process.env.OVERPASS_HTTP_TIMEOUT_MS || '180000', 10),
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
    const candidates = [
      $('meta[property="og:image:secure_url"]').attr('content'),
      $('meta[property="og:image:url"]').attr('content'),
      $('meta[property="og:image"]').attr('content'),
      $('meta[name="og:image"]').attr('content'),
      $('meta[name="twitter:image"]').attr('content'),
      $('meta[name="twitter:image:src"]').attr('content'),
      $('link[rel="image_src"]').attr('href'),
    ].filter(Boolean);
    let abs = null;
    for (const c of candidates) {
      if (!c || typeof c !== 'string') continue;
      if (c.toLowerCase().includes('undefined')) continue;
      const u = toAbsoluteUrl(websiteUrl, c);
      if (u) { abs = u; break; }
    }
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
    // fallback: try common hero paths
    const guesses = ['/og-image.jpg', '/og-image.png', '/images/og.jpg', '/images/og.png', '/assets/og.jpg', '/assets/og.png'];
    for (const g of guesses) {
      const u = toAbsoluteUrl(item.tags.website, g);
      try {
        // eslint-disable-next-line no-await-in-loop
        const head = await axios.head(u, { timeout: 5000 });
        const ctype = head.headers['content-type'] || '';
        if (head.status < 400 && ctype.startsWith('image/')) { item.imageUrl = u; return item; }
      } catch (_e) {}
    }
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

// Image proxy to avoid hotlink restrictions and mixed header issues
// --- Image proxy with SSRF protections ---
function getAllowedImageHosts() {
  const env = (process.env.ALLOWED_IMAGE_HOSTS || '').trim();
  if (!env) return null; // no allowlist by default
  if (env === '*') return '*';
  return env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map((s) => parseInt(s, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this network"
  if (a === 169 && b === 254) return true; // link-local
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast/reserved/broadcast
  return false;
}

function isPrivateIpv6(ip) {
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
}

async function resolvesToPublicIp(hostname) {
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    for (const a of addrs) {
      if (a.family === 4 && isPrivateIpv4(a.address)) return false;
      if (a.family === 6 && isPrivateIpv6(a.address)) return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
}

function isHostAllowedByEnv(hostname) {
  const allowlist = getAllowedImageHosts();
  if (!allowlist) return true; // not enforced
  if (allowlist === '*') return true;
  const host = String(hostname || '').toLowerCase();
  return allowlist.includes(host);
}

async function fetchImageFollowingRedirects(startUrl, headers, maxRedirects = 2) {
  let current = new URL(startUrl);
  for (let i = 0; i <= maxRedirects; i += 1) {
    // Validate host on each hop
    if (!['http:', 'https:'].includes(current.protocol)) throw new Error('Invalid protocol');
    if (!isHostAllowedByEnv(current.hostname)) throw new Error('Blocked host');
    if (!(await resolvesToPublicIp(current.hostname))) throw new Error('Blocked IP');

    const resp = await axios.get(current.toString(), {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxRedirects: 0,
      headers,
      validateStatus: (s) => (s >= 200 && s < 400),
      maxContentLength: 8 * 1024 * 1024,
      maxBodyLength: 8 * 1024 * 1024,
    });

    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.location;
      if (!location) throw new Error('Redirect without location');
      current = new URL(location, current);
      continue;
    }
    return resp;
  }
  throw new Error('Too many redirects');
}

app.get('/api/image', async (req, res) => {
  const { url, w, q } = req.query;
  try {
    if (!url) return res.status(400).send('Missing url');
    const initial = new URL(url);
    if (!['http:', 'https:'].includes(initial.protocol)) return res.status(400).send('Invalid protocol');
    if (!isHostAllowedByEnv(initial.hostname)) return res.status(403).send('Host not allowed');
    if (!(await resolvesToPublicIp(initial.hostname))) return res.status(403).send('Blocked IP');

    const headers = {
      'User-Agent': 'AttravisoImageProxy/1.0',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      Referer: initial.origin,
    };

    const response = await fetchImageFollowingRedirects(initial.toString(), headers);
    const contentType = response.headers['content-type'] || '';
    if (!contentType.startsWith('image/')) return res.status(415).send('Unsupported content-type');

    const input = Buffer.from(response.data);
    const width = Math.max(1, Math.min(parseInt(w || '0', 10) || 0, 2000)) || null;
    const quality = Math.max(1, Math.min(parseInt(q || '75', 10), 100));

    res.set('Cache-Control', 'public, max-age=86400');
    if (width) {
      const webp = await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
      res.set('Content-Type', 'image/webp');
      return res.send(webp);
    }
    res.set('Content-Type', contentType);
    return res.send(input);
  } catch (_e) {
    return res.status(502).send('Failed to fetch image');
  }
});

// --- Jobs API ---
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=10&addressdetails=1`;
    const { data } = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Attraviso/1.0 (+reverse-geocode)' } });
    const a = data?.address || {};
    const city = a.city || a.town || a.village || a.county || null;
    const state = a.state || a.region || null;
    const country = a.country || null;
    const parts = [city, state, country].filter(Boolean);
    return parts.join(', ');
  } catch (_e) {
    return null;
  }
}

async function fetchJobsFromAdzuna(lat, lon, distanceKm, query) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return null;
  const country = (process.env.ADZUNA_COUNTRY || 'gb').toLowerCase();
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1`;
  const params = {
    app_id: appId,
    app_key: appKey,
    results_per_page: 50,
    where: `${lat},${lon}`,
    distance: clamp(Math.round(distanceKm), 1, 200),
    sort_by: 'distance',
    content_type: 'application/json',
    what: query || undefined,
    latlong: 1,
  };
  try {
    const { data } = await axios.get(url, { params, timeout: 15000, headers: { 'User-Agent': 'Attraviso/1.0 (+jobs-adzuna)' } });
    const list = Array.isArray(data?.results) ? data.results : [];
    return list.map((j) => {
      const latitude = toNumber(j.latitude, null);
      const longitude = toNumber(j.longitude, null);
      const item = {
        id: `adzuna/${j.id}`,
        title: j.title || 'Job',
        company: j.company?.display_name || null,
        location: j.location?.display_name || null,
        url: j.redirect_url || j.adref || null,
        latitude,
        longitude,
        description: j.description || null,
        salaryMin: toNumber(j.salary_min, null),
        salaryMax: toNumber(j.salary_max, null),
        created: j.created || null,
        source: 'Adzuna',
      };
      if (latitude && longitude) {
        item.distanceMeters = Math.round(haversineDistanceMeters(lat, lon, latitude, longitude));
      }
      return item;
    });
  } catch (_e) {
    return null;
  }
}

async function fetchJobsFromMuse(lat, lon, query) {
  // Reverse geocode to a human location string
  const location = await reverseGeocode(lat, lon);
  const url = 'https://www.themuse.com/api/public/jobs';
  const params = { page: 1, location: location || undefined, category: undefined }; // category optional
  try {
    const { data } = await axios.get(url, { params, timeout: 15000, headers: { 'User-Agent': 'Attraviso/1.0 (+jobs-muse)' } });
    const list = Array.isArray(data?.results) ? data.results : [];
    return list.map((j) => ({
      id: `muse/${j.id}`,
      title: j.name || 'Job',
      company: j.company?.name || null,
      location: (j.locations && j.locations[0]?.name) || location || null,
      url: j.refs?.landing_page || null,
      latitude: null,
      longitude: null,
      description: null,
      salaryMin: null,
      salaryMax: null,
      created: j.publication_date || null,
      source: 'The Muse',
    }));
  } catch (_e) {
    return [];
  }
}

app.get('/api/jobs', async (req, res) => {
  const lat = toNumber(req.query.lat);
  const lon = toNumber(req.query.lon);
  const radiusMeters = toNumber(req.query.radius, 5000);
  const q = (req.query.q || '').toString().trim() || undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Missing required query params: lat, lon' });
  }
  const distanceKm = clamp(Math.round((radiusMeters || 1000) / 1000), 1, 200);
  try {
    let items = await fetchJobsFromAdzuna(lat, lon, distanceKm, q);
    if (!items || items.length === 0) {
      const fallback = await fetchJobsFromMuse(lat, lon, q);
      items = fallback;
    }
    // Sort by distance when present, otherwise by recency
    items.sort((a, b) => {
      const da = a.distanceMeters ?? Infinity;
      const db = b.distanceMeters ?? Infinity;
      if (da !== db) return da - db;
      const ta = a.created ? Date.parse(a.created) || 0 : 0;
      const tb = b.created ? Date.parse(b.created) || 0 : 0;
      return tb - ta;
    });
    res.json({ count: items.length, items });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch jobs', details: e.message });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});


