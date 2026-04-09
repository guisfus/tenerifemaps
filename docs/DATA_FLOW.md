# Data Flow

## Request Lifecycle

1. The user selects a dataset in the header.
2. `App.vue` resolves the active dataset definition from `src/data/datasets.ts`.
3. `fetchDatasetLocations()` requests `/api/dataset?key=...` if the dataset is not cached yet.
4. The proxy validates the key and fetches the remote GeoJSON server-side.
5. The service normalizes each feature into a `LocationRecord`.
6. The normalized array is stored in component state.
7. Derived computed values filter, sort and aggregate the records for every visual block.

## Proxy Flow

### Development

- Vite exposes `/api/dataset` through a local middleware
- the middleware reuses `src/server/datasetProxy.ts`
- the browser and the frontend code use the same route as production

### Production

- Vercel serves `/api/dataset` from `api/dataset.ts`
- the function reuses `src/server/datasetProxy.ts`
- successful responses include cache headers for CDN reuse

## Rendering Flow

### Inventory

- receives `filteredLocations`
- renders cards on smaller screens
- renders a table on larger screens
- writes back `selectedId` when a row is clicked

### Map

- receives `filteredLocations` and `selectedId`
- rebuilds marker clusters when locations change
- updates marker styling when selection changes
- emits a selected id when a marker is clicked

### Detail Panel

- computes `selectedLocation` from `filteredLocations` and `selectedId`
- automatically falls back to the first visible record when the current one disappears after filtering

## Caching Strategy

The GeoJSON service caches one normalized result per dataset key. This cache is process-local to the browser session.

Benefits:

- avoids repeated fetches when switching views
- keeps chart summary requests cheap after the first load
- reduces latency during dataset switching

Tradeoff:

- data stays cached until the page is reloaded

## Localization Flow

1. `vue-i18n` exposes `t()` and `locale`.
2. UI labels come from `src/i18n.ts`.
3. Dataset titles and descriptions come from `src/data/datasets.ts`.
4. When locale changes, the root component also updates `document.documentElement.lang`.
