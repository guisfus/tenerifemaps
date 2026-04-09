# Data Flow

## Request Lifecycle

1. The user selects a dataset in the header.
2. `App.vue` resolves the active dataset definition from `src/data/datasets.ts`.
3. `fetchDatasetLocations()` requests the remote GeoJSON if it is not cached yet.
4. The service normalizes each feature into a `LocationRecord`.
5. The normalized array is stored in component state.
6. Derived computed values filter, sort and aggregate the records for every visual block.

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
