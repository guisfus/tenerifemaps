# Tenerife Maps

Tenerife Maps is a bilingual web application for exploring public GeoJSON datasets from Tenerife through a map-first interface.

It combines open geospatial data, client-side filtering, synchronized map and table views, and CSV export into a single lightweight frontend built with Vue and Leaflet.

## Highlights

- Interactive map with marker clustering
- Multiple Tenerife open-data datasets
- Text, municipality, activity, and contact filters
- Synchronized selection between map, detail panel, and inventory
- CSV export for the currently visible results
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

To keep the frontend compatible with external open-data sources, dataset requests are routed through a small server-side proxy endpoint before being processed in the browser.

## Data Source

All datasets used by the application are published through `datos.tenerife.es`.

## Project Structure

```text
api/
  dataset.ts               # Serverless dataset endpoint
src/
  App.vue                  # Main application state and layout
  components/
    BarChart.vue           # Dataset comparison chart
    LeafletMap.vue         # Leaflet integration and clustering
  data/
    datasets.ts            # Dataset catalog
  server/
    datasetProxy.ts        # Shared proxy logic for development and production
  services/
    geojson.ts             # GeoJSON loading, caching, and normalization
  i18n.ts                  # Bilingual UI copy
  types.ts                 # Shared types
```

## Technical Documentation

- `docs/ARCHITECTURE.md`
- `docs/DATA_FLOW.md`
