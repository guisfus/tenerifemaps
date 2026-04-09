# Data Flow

## Request Lifecycle

1. The user selects a dataset or changes a filter in the header.
2. `App.vue` builds the current query state.
3. The frontend calls `/api/locations` with dataset, filters, sorting, and pagination parameters.
4. The server resolves the dataset source, fetches raw GeoJSON if needed, and normalizes it into `LocationRecord` objects.
5. The server applies filters, sorting, and pagination.
6. The server returns:
   - paginated table items
   - map items
   - filter options
   - pagination metadata
   - last fetch timestamp
7. The frontend renders map, detail panel, metrics, and inventory from that payload.

## Endpoints

### `/api/locations`

Returns the main query result.

Payload includes:

- `items`: paginated rows for the inventory table
- `mapItems`: filtered records for the map
- `municipalities`: available municipality options
- `activities`: available activity options
- `fetchedAt`: dataset fetch timestamp
- `pagination`: total count, page, page size, and next/previous flags

### `/api/summary`

Returns record counts for every configured dataset.

Used by the summary chart in the sidebar.

### `/api/export`

Returns the full filtered result set as CSV.

The export endpoint reuses the same server-side filtering and sorting logic as `/api/locations`.

## Rendering Flow

### Inventory Table

- receives paginated `items`
- renders only the current page
- updates `selectedId` when a row is clicked

### Map

- receives `mapItems` and `selectedId`
- renders clustered markers for the current filtered result set
- emits selected ids back to the parent

### Detail Panel

- computes `selectedLocation` from map items and current page items
- stays in sync with either map clicks or table row selection

## Caching Strategy

### Server side

- raw datasets are fetched through the proxy layer
- normalized datasets are cached in memory when the runtime stays warm
- API responses include cache headers for CDN reuse

### Client side

- the frontend does not cache datasets independently anymore
- each UI refresh goes through the backend query layer

## Localization Flow

1. `vue-i18n` exposes `t()` and `locale`.
2. UI labels come from `src/i18n.ts`.
3. Dataset titles and descriptions come from `src/data/datasets.ts`.
4. CSV export headers are localized server-side based on the requested locale.
