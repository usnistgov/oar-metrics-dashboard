# Public Data Repository: Usage Metrics Dashboard

An Angular 20 dashboard that visualizes usage metrics for the NIST Public Data Repository (downloads,
users, most-accessed datasets, science domains, collections, and DataCite citation metrics). Data is
pulled live from the NIST RMM API.

- Built with **Angular 20** (standalone components, signals), **Angular Material** + **Tailwind CSS v4**,
  and **Chart.js**.
- Light/dark theme with a selectable accent color.
- All data is fetched through a single shared, cached service.

---

## Prerequisites

- **Node.js** and **npm** (Angular 20 needs Node `^20.19`, `^22.12`, or `24+`).
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

## Pages

The app has a handful of routes:

- `/` - the main dashboard (KPI strip + cards).
- `/collections` - the collections landing (every collection as a card).
- `/collections/:id` - one collection's metrics, scoped to its members.
- `/guide` - an in-app guide that explains, in plain language, what every card and figure means.

## Common commands

| Command | What it does |
|---|---|
| `npm start` | Run the dev server with the API proxy (live reload). |
| `npm run build` | Production build into `dist/`. |
| `npm run watch` | Development build that rebuilds on change. |
| `npm test` | Run the unit tests (Jest, jsdom). |

## Configuring the default layout

The dashboard is personalizable: users can reorder, hide, and pin cards, switch dark mode, and pick an
accent color. Their choices are saved in the browser (`localStorage`) and persist across visits, and can
be reset any time from **Settings > Default layout**.

You can set the layout a first-time visitor sees (before they customize anything). These defaults are
compiled into the build and only *seed* a user's saved state, so once someone customizes, their choice
always wins.

- **Card order** - the `widgets` array in `src/app/services/layout.service.ts`. Its order is the default
  card order (the KPI strip is always first and is not draggable). Reorder the entries to change it.
- **Cards hidden by default** - `DEFAULT_HIDDEN` in the same file (a list of widget ids).
- **Cards pinned by default** - `DEFAULT_PINNED` in the same file.
- **Theme and accent color** - `DEFAULT_MODE` (`'light'` or `'dark'`) and `DEFAULT_COLOR` (a hex such as
  `'#2563eb'`) in `src/app/services/theme.service.ts`.

Valid widget ids are the `id` values in the `widgets` array (for example `mostPopular`, `latestDownloads`,
`collections`, `collectionShare`, `untracked`, `repoHealth`, `datacite`).

The quickest way to capture a layout you like is to arrange it in the running app, then read the values
from the browser console and copy them into the defaults above:

```js
console.log(JSON.stringify({
  order:  JSON.parse(localStorage['dashboard.order.v1'] || 'null'),
  hidden: JSON.parse(localStorage['dashboard.hidden.v1'] || 'null'),
  pinned: JSON.parse(localStorage['dashboard.pins.v1'] || 'null'),
  mode:   localStorage['theme.mode']  || null,
  color:  localStorage['theme.color'] || null,
}, null, 2));
```

If you change the default card order after release and want existing users to adopt it, bump the version
suffix on `ORDER_KEY` in `layout.service.ts` (for example `dashboard.order.v1` to `v2`); this makes saved
orders reset to the new default. Adding or removing cards does not need a bump.

## Deploying in the OAR system

This app deploys into the OAR platform (oar-docker) as a standalone static app served at `/metrics/`.
It builds to static files and calls the RMM API at `/rmm` (same-origin behind the gateway, so no CORS
and no runtime config needed). `scripts/makedist.docker` is the build entry point used by oar-docker's
`localdeploy`. Runtime config resolves in order: built-in defaults, then `assets/config.json`, which the
container overwrites at startup from the config server when one is configured (see `config.service.ts`).
So per-deployment values (API URLs, version, auto-refresh interval) can change without a rebuild.

## Project layout

```
src/app/
  app.component.*            # shell: header, footer, loading screen, routed outlet
  app.routes.ts              # routes: dashboard, collections, collection detail, guide
  components/                # dashboard, cards, charts, dialogs, collections, guide
  services/
    metrics.service.ts       # single cached source of truth for all API data
    config.service.ts        # runtime config (assets/config.json / config server), loaded at startup
    theme.service.ts         # light/dark mode + accent color (+ their defaults)
    layout.service.ts        # card order, visibility, pins (+ their defaults)
  models/metrics.models.ts   # typed API payloads
public/
  fonts/                     # self-hosted Roboto + Material Icons (no Google Fonts CDN)
  vendor/                    # self-hosted DataCite badge + Vue (no unpkg CDN)
proxy.conf.json              # dev proxy for the NIST API (CORS workaround)
```

> The fonts and vendor scripts are self-hosted on purpose: the app pulls in no third-party CDNs, which
> is what lets the gateway serve it under a strict Content-Security-Policy. Keep it that way when adding
> assets (add them under `public/`, don't link a CDN).

> Note: the NIST API has a known server-side quirk where sort parameters are ignored, so the app
> fetches the full dataset list and sorts/ranks it on the client.
