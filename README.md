# Attraviso

Attraviso is a [brief one‑liner about your product], built for [primary audience] to [key outcome].

## Vision
Describe the problem you’re solving and why it matters in 2–3 sentences. Example: “Attraviso helps [audience] [do X] by [how it works]. Our goal is to make [benefit] simple and fast.”

## Core features (MVP)
- Nearby attractions by your location (OpenStreetMap Overpass API)
- Adjustable search radius (1–20 km) and manual refresh
- Clean Tailwind UI; responsive grid list

## Tech stack
- React 19 (Create React App 5)
- Express backend proxy for Overpass API
- Tailwind CSS 4 (CLI in watch mode)
- ESLint via `react-app` config

## Getting started
```bash
npm install
npm start
```

Build for production:
```bash
npm run build
```

## Project structure
```
attraviso/
  public/
    index.html        # Title set to "Attraviso"
    favicon.svg       # 'A' monogram favicon
  src/
    assets/           # Images, icons, fonts
    components/       # Reusable UI components
    App.js            # Root app component
    index.js          # Entry point
  server/
    index.js          # Express API: /api/health, /api/attractions
```

## Branding
- Title: "Attraviso" (set in `public/index.html`).
- Favicon: `public/favicon.svg` (simple 'A' mark). Replace with your brand mark if needed.

## Roadmap
- v0.1: [Define MVP scope]
- v0.2: [Next features or integrations]

## Contributing / Workflow
- Create feature branches off `main`.
- Keep components small, reusable, and colocate styles/assets in `src/components` and `src/assets`.

## Development

### Prerequisites
- Node 18+

### Run
```
npm install
npm start
```
This launches:
- Tailwind CLI in watch mode
- Express backend on http://localhost:5000
- React dev server on http://localhost:3000 (proxied to backend via `proxy`)

### Environment
- Optional: set `CORS_ORIGINS` env var (comma-separated) to restrict origins for the backend.

### Build
```
npm run build
```



