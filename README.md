# Public Data Repository: Usage Metrics Dashboard

An Angular 20 dashboard that visualizes usage metrics for the NIST Public Data Repository (downloads,
users, popular datasets, science domains, and DataCite citation metrics). Data is pulled live from the
NIST RMM API.

- Built with **Angular 20** (standalone components, signals), **Angular Material** + **Tailwind CSS v4**,
  and **Chart.js**.
- Light/dark theme with a selectable accent color.
- All data is fetched through a single shared, cached service.

---

## Prerequisites

- **Node.js 20+** and **npm** (Angular 20 needs Node `^20.11`, `^22`, or newer).
- **Network access to `data.nist.gov`** - the dashboard reads live data; there is no bundled dataset.

## Quick start

From the repo root:

```bash
npm install      # install dependencies
npm start        # start the dev server
```

Then open **http://localhost:4200/**.

> **Why it works locally (CORS):** the NIST API doesn't send CORS headers, so the browser would block
> direct calls. The dev server is configured (`proxy.conf.json`, wired into `angular.json`) to proxy
> `/rmm/*` to `https://data.nist.gov`, so `npm start` "just works", no extra flags.

To run on a different port:

```bash
npm start -- --port 4222
```

## Common commands

| Command | What it does |
|---|---|
| `npm start` | Run the dev server with the API proxy (live reload). |
| `npm run build` | Production build into `dist/`. |
| `npm run watch` | Development build that rebuilds on change. |
| `npm test` | Run the unit tests (Jest, jsdom). |

## Deploying in the OAR system

This app deploys into the OAR platform (oar-docker) as a standalone static app served at `/metrics/`.
It builds to static files and calls the RMM API at `/rmm` (same-origin behind the gateway, so no CORS
and no runtime config needed). `scripts/makedist.docker` is the build entry point used by oar-docker's
`localdeploy`; per-deployment overrides (API URLs, version) are read from `assets/config.json`.

## Project layout

```
src/app/
  app.component.*            # shell: loading screen + theme controls (light/dark + accent)
  components/                # dashboard, cards, charts, dialogs
  services/
    metrics.service.ts       # single cached source of truth for all API data
    theme.service.ts         # light/dark mode + accent color
  models/metrics.models.ts   # typed API payloads
proxy.conf.json              # dev proxy for the NIST API (CORS workaround)
```

> Note: the NIST API has a known server-side quirk where sort parameters are ignored, so the app
> fetches the full dataset list and sorts/ranks it on the client.
