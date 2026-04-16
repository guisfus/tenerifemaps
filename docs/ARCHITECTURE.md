# Architecture

## Overview

Tenerife Maps is a backend-driven geospatial web application built with Vue 3 and TypeScript on the frontend and Vercel Functions on the server side.

The browser is responsible for presentation and interaction. The server is responsible for CKAN resolution, dataset retrieval, normalization, filtering, sorting, pagination, summary generation, and CSV export.

## Main Modules

### `src/App.vue`

Acts as the UI composition root.

Responsibilities:

- hold visible UI state
- build query parameters from the current controls
- request paginated results from the backend
- request dataset summary data
- restore and persist shareable state through the URL
- keep selection consistent between map, detail panel, and inventory
- pass plain props down to visual components

### `src/components/LeafletMap.vue`

Thin integration layer around Leaflet and `leaflet.markercluster`.

Responsibilities:

- create the map instance
- render clustered markers
- keep the view constrained to the Canary Islands area
- restore and emit viewport state
- reflect current selection visually
- emit selected record ids back to the parent

### `src/services/geojson.ts`

Frontend API client.

Responsibilities:

- call `/api/locations`
- call `/api/summary`
- build the export URL for `/api/export`
- normalize HTTP errors for the UI layer

### `src/server/ckan.ts`

CKAN integration layer.

Responsibilities:

- resolve a dataset download URL from CKAN resource or package metadata
- resolve dataset metadata such as title, description, source, license, and update date
- validate CKAN logical success responses even when HTTP status is 200
- preserve `dataset.url` as a mandatory fallback path

### `src/server/datasetProxy.ts`

Server-side upstream fetch layer.

Responsibilities:

- validate dataset keys
- resolve remote source URLs through CKAN with fallback to the static catalog
- fetch raw GeoJSON from `datos.tenerife.es`
- return a typed success or failure result

### `src/server/locations.ts`

Server-side query layer.

Responsibilities:

- normalize GeoJSON into `LocationRecord`
- cache normalized datasets in memory when possible
- enrich responses with dataset metadata
- apply text and categorical filters
- apply sorting and pagination
- prepare map items independently from paginated table items
- generate dataset summary payloads
- generate CSV exports

### `api/locations.ts`

Primary list endpoint.

Responsibilities:

- parse query parameters
- call the server-side query layer
- return paginated items, map items, filter options, and pagination metadata

### `api/summary.ts`

Dataset summary endpoint.

Responsibilities:

- aggregate record counts for every configured dataset
- return chart-ready summary data to the frontend

### `api/export.ts`

CSV export endpoint.

Responsibilities:

- reuse the same server-side query rules as the list endpoint
- return the filtered result set as a downloadable CSV file

### `src/data/datasets.ts`

Static dataset catalog.

Responsibilities:

- define available datasets
- provide bilingual labels and descriptions
- group datasets by category
- centralize remote source URLs

## Design Decisions

### Single normalization model

All raw GeoJSON features are converted into `LocationRecord`. This isolates the UI from upstream field names and keeps the rest of the application stable even if new datasets are added.

### Backend-driven querying

Filtering, sorting, pagination, summary generation, and export all happen server-side. This keeps the frontend light and makes the application easier to scale as datasets grow.

### CKAN as metadata layer with hard fallback

CKAN is used to resolve richer metadata and, when possible, the preferred GeoJSON resource URL. Static download URLs remain in the dataset catalog so the application continues to work if CKAN metadata calls fail.

### Separate map and table payloads

The list endpoint returns paginated table items and a separate marker list for the map. This keeps the inventory scalable without forcing the map to render only one page of data.

### Thin frontend client

The browser is treated as a rendering layer. It owns interaction state, but not core data processing.

## Extension Points

### Add new filters

Extend `LocationsQuery` and the filtering logic in `src/server/locations.ts`, then wire the new controls in `App.vue`.

### Add new source fields

Extend `LocationRecord` in `src/types.ts` and map the new fields in `src/server/locations.ts`.

### Add alternate outputs

New endpoints can reuse the same query and normalization layer to expose JSON, CSV, or future reporting views without duplicating dataset logic.
