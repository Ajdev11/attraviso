# Attraviso

Discover nearby attractions and historic sites using OpenStreetMap data, with a fast React UI and an Express API.

## Quick start
```bash
npm install
npm start
```

- Frontend: http://localhost:3001
- Backend API: http://localhost:5000

Production build:
```bash
npm run build
```

## Scripts
- `npm start`: Runs Tailwind CLI watcher, backend (5000), and CRA dev server (3001)
- `npm run build`: Builds Tailwind CSS then creates a production build
- `npm run server`: Start backend only
- `npm run server:watch`: Backend with nodemon
- `npm run tw:build` / `npm run tw:watch`: Tailwind CSS compile/watch

## Project structure
```
attraviso/
  public/
    index.html         # SEO meta, canonical, OG/Twitter, JSON-LD
    robots.txt         # Includes: Sitemap: /sitemap.xml
    sitemap.xml        # Basic sitemap (homepage)
    site.webmanifest   # PWA manifest
    favicon.svg, logo192.png, logo512.png
  src/
    assets/
    components/
    styles/tailwind.css
    index.css
    index.js
    App.js
  server/
    index.js           # /api/health, /api/attractions, /api/image
  tailwind.config.cjs  # Tailwind v4 config (CLI)
  postcss.config.js    # CRA uses @tailwindcss/postcss
```

## Backend API
- `GET /api/health` → `{ ok: true }`
- `GET /api/attractions?lat=…&lon=…&radius=…&enrich=1`
  - Returns nearby OSM attractions (nodes/ways/relations)
  - `radius` meters (min 100, max 200000)
  - `enrich=1` attempts to attach an `imageUrl` (Wikidata/Wikipedia/website OG)
- `GET /api/image?url=…&w=…&q=…`
  - Secure image proxy with SSRF protections; optional resize to WebP
  - Env allowlist: `ALLOWED_IMAGE_HOSTS` (comma-separated or `*`)

## SEO & PWA
- `public/index.html` includes: title/description, canonical, Open Graph, Twitter, and JSON‑LD.
- `public/robots.txt` references `Sitemap: /sitemap.xml`.
- `public/site.webmanifest` is linked from `index.html`.
- To set your production domain:
  1) Add `"homepage": "https://your-domain"` to `package.json`
  2) Update `<loc>` in `public/sitemap.xml`

## Environment variables (backend)
- `PORT` (default 5000)
- `CORS_ORIGINS` (comma-separated) to restrict allowed origins
- `IMAGE_RATE_LIMIT` (default 120/min for `/api/image`)
- `ALLOWED_IMAGE_HOSTS` (comma-separated domain allowlist for `/api/image`)

## Tech stack
- React 19 (Create React App 5)
- Express 5
- Tailwind CSS 4 (CLI) + `@tailwindcss/postcss`
- Leaflet + React Leaflet

## Troubleshooting
- Port in use: CRA runs on 3001 (set via `cross-env PORT=3001`). Change in `package.json` if needed.
- Tailwind/PostCSS error: This project uses `postcss.config.js` with `@tailwindcss/postcss` and `tailwind.config.cjs`.
- Geolocation on mobile requires HTTPS (or `localhost`). For local phone testing, use HTTPS dev or deploy behind HTTPS.

## License
MIT
