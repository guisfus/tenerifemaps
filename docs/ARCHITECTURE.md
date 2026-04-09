# Architecture

## Overview

Tenerife Maps is a mostly static application built with Vue 3 and TypeScript. The UI runs entirely in the browser, while a very small server-side proxy layer fetches remote GeoJSON datasets so the frontend can avoid browser CORS restrictions.

The project intentionally avoids backend coupling. Almost all business logic lives in the browser and is organized in a small number of files with clear responsibilities. The server-side part is limited to relaying approved dataset requests.

## Main Modules

### `src/App.vue`

Acts as the composition root for the application.

Responsibilities:

- hold UI state
- load the active dataset
- derive filtered and sorted results
- keep selection consistent between map and inventory
- prepare CSV export
- pass plain props down to visual components

### `src/components/LeafletMap.vue`

Thin integration layer around Leaflet and `leaflet.markercluster`.

Responsibilities:

- create the map instance
- render clustered markers
- reflect current selection visually
- emit selected record ids back to the parent
- invalidate map size when the layout changes

### `src/services/geojson.ts`

Data normalization layer.

Responsibilities:

- fetch remote GeoJSON
- call the local dataset proxy endpoint
- cache one normalized payload per dataset
- sanitize inconsistent source values
- map raw source properties into `LocationRecord`

### `src/server/datasetProxy.ts`

Shared proxy logic used by development and production.

Responsibilities:

- validate incoming dataset keys
- resolve the upstream dataset URL from the static catalog
- fetch GeoJSON on the server side
- return a small typed success or error result

### `api/dataset.ts`

Minimal Vercel function wrapper.

Responsibilities:

- read the `key` query parameter
- delegate fetch logic to `src/server/datasetProxy.ts`
- return JSON with cache headers in production

### `src/data/datasets.ts`

Static catalog of datasets exposed by the product.

Responsibilities:

- define available datasets
- provide bilingual titles and descriptions
- centralize source URLs

### `src/i18n.ts`

Central store for product copy in Spanish and English.

## Design Decisions

### Single normalization model

The app converts every GeoJSON feature into `LocationRecord`. This keeps rendering code independent from upstream property names and makes future dataset additions predictable.

### Client-side filtering and sorting

Once a dataset is fetched through the proxy, all interactions happen in memory. For the current dataset sizes this keeps the experience immediate and avoids repeated network requests.

### Shared selection model

Map, detail panel and inventory all depend on `selectedId`. This prevents each view from holding competing notions of what is selected.

### Separate map component

Leaflet is isolated from the main view logic so DOM-driven map behavior does not leak into the rest of the application.

### Thin server proxy

The proxy layer accepts only known dataset keys from `src/data/datasets.ts`. This keeps the deployment compatible with Vercel, avoids exposing arbitrary upstream fetching, and preserves a single source of truth for data sources.

## Extension Points

### Add new filters

Add state and conditions in `App.vue` inside `filteredLocations`.

### Add new source fields

Extend `LocationRecord` in `src/types.ts` and map the new fields in `src/services/geojson.ts`.

### Replace chart implementation

The current chart consumes a simple `{ key, label, value }` structure. A richer chart library can be introduced without touching dataset loading.
