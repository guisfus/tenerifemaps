# Tenerife Maps

Tenerife Maps is a bilingual web application for exploring public GeoJSON datasets from Tenerife through a map-first interface.

It combines open geospatial data, server-side querying, synchronized map and table views, and CSV export into a single application built with Vue, Leaflet, and Vercel Functions.

## Highlights

- Interactive map with marker clustering
- Multiple Tenerife open-data datasets
- Server-side text, municipality, activity, and contact filters
- Synchronized selection between map, detail panel, and inventory
- Server-side CSV export for the current filtered result set
- Server-side pagination for the inventory table
- Spanish and English user interface

## Stack

- Vue 3
- TypeScript
- Vite
- Tailwind CSS v4
- Vue I18n
- Leaflet
- Leaflet MarkerCluster

## Getting Started

### Requirements

- Node.js 20+
- npm

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Vite will print the local development URL in the terminal.

### Create a production build

```bash
npm run build
```

The production output is written to `dist/`.

## How It Works

The application loads public Tenerife GeoJSON datasets, normalizes them into a shared internal record model, and renders them through a unified map and inventory interface.

The frontend delegates dataset processing to server-side endpoints. The server retrieves the source GeoJSON, normalizes it, applies filtering, sorting, pagination, and summary aggregation, and returns UI-ready payloads to the browser.

## Data Source

All datasets used by the application are published through `datos.tenerife.es`.

## Project Structure

```text
api/
  dataset.ts               # Raw dataset proxy endpoint
  export.ts                # CSV export endpoint
  locations.ts             # Paginated query endpoint
  summary.ts               # Dataset summary endpoint
src/
  App.vue                  # Main application state and layout
  components/
    BarChart.vue           # Dataset comparison chart
    LeafletMap.vue         # Leaflet integration and clustering
  data/
    datasets.ts            # Dataset catalog
  server/
    datasetProxy.ts        # Raw GeoJSON proxy logic
    locations.ts           # Server-side normalization and query layer
  services/
    geojson.ts             # Frontend API client
  i18n.ts                  # Bilingual UI copy
  types.ts                 # Shared types
```

## Technical Documentation

- `docs/ARCHITECTURE.md`
- `docs/DATA_FLOW.md`
