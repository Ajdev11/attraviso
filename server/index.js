const express = require('express');
const cors = require('cors');
const axios = require('axios');

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


