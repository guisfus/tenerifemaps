# Tenerife Maps

Interactive bilingual map viewer for public GeoJSON datasets from Tenerife.

Tenerife Maps turns open geospatial datasets into a searchable, filterable, map-first interface designed to make local resources, businesses, services, and infrastructure easier to explore.

## Features

- Interactive Leaflet map with marker clustering
- Dataset switcher with multiple Tenerife open-data sources
- Text, municipality, activity, and contact filters
- Synchronized map, detail panel, and inventory table
- CSV export for the currently visible result set
- Spanish and English interface

## Tech Stack

- Vue 3
- TypeScript
- Vite
- Tailwind CSS v4
- Vue I18n
- Leaflet
- Leaflet MarkerCluster

## How It Works

Each dataset is fetched as GeoJSON, normalized into a shared internal record shape, and then rendered through a unified UI.

The application uses a small server-side proxy endpoint for dataset requests so the frontend can work with external open-data sources without running into browser CORS restrictions.

## Data Sources

The data comes from public GeoJSON datasets published through `datos.tenerife.es`.

## Local Development

```bash
npm install
npm run dev
```

The development server usually runs on `http://localhost:5173`.

## Production Build

```bash
npm run build
```

The production output is generated in `dist/`.

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

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/DATA_FLOW.md`
