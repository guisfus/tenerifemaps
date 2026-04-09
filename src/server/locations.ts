import { DATASETS } from '../data/datasets.js'
import { fetchDatasetPayload } from './datasetProxy.js'
import type { DatasetDefinition, DatasetSummary, LocationRecord, SortKey } from '../types'

type Feature = {
  properties?: Record<string, unknown>
  geometry?: {
    coordinates?: [number, number]
  }
}

type GeoJsonResponse = {
  features?: Feature[]
}

type ContactFilter = 'all' | 'withContact' | 'withoutContact'
type SortDirection = 'asc' | 'desc'

type DatasetCacheEntry = {
  fetchedAt: string
  items: LocationRecord[]
}

type LocationsSuccess = {
  status: 200
  payload: {
    items: LocationRecord[]
    total: number
    municipalities: string[]
    activities: string[]
    fetchedAt: string
  }
  cacheControl: string
}

type SummarySuccess = {
  status: 200
  payload: {
    items: DatasetSummary[]
  }
  cacheControl: string
}

type Failure = {
  status: 400 | 404 | 502
  error: string
}

export type LocationsQuery = {
  dataset: string
  search: string
  municipality: string
  activity: string
  contact: ContactFilter
  sort: SortKey
  direction: SortDirection
}

export type LocationsResult = LocationsSuccess | Failure
export type DatasetSummariesResult = SummarySuccess | Failure

const datasetCache = new Map<string, DatasetCacheEntry>()
const collator = new Intl.Collator('es', { sensitivity: 'base' })

function cleanValue(value: unknown) {
  if (value === null || value === undefined || value === '' || value === 'null' || value === 0 || value === '0') {
    return ''
  }

  return String(value).trim()
}

function buildAddress(properties: Record<string, unknown>) {
  const street = cleanValue(properties.direccion_nombre_via)
  const number = cleanValue(properties.direccion_numero)
  return [street, number].filter(Boolean).join(', ')
}

function normalizeWebsite(rawWebsite: string) {
  if (!rawWebsite) {
    return ''
  }

  return /^https?:\/\//i.test(rawWebsite) ? rawWebsite : `https://${rawWebsite}`
}

function createRecord(feature: Feature, index: number): LocationRecord | null {
  const coordinates = feature.geometry?.coordinates

  if (!coordinates || coordinates.length < 2) {
    return null
  }

  const [lng, lat] = coordinates

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null
  }

  const properties = feature.properties ?? {}
  const name = cleanValue(properties.nombre) || `Location ${index + 1}`
  const municipality = cleanValue(properties.municipio_nombre)

  return {
    id: `${name}-${municipality}-${lat}-${lng}-${index}`,
    name,
    activityType: cleanValue(properties.actividad_tipo),
    municipality,
    address: buildAddress(properties),
    reference: cleanValue(properties.referencia),
    postalCode: cleanValue(properties.direccion_codigo_postal),
    phone: cleanValue(properties.telefono),
    email: cleanValue(properties.email),
    website: normalizeWebsite(cleanValue(properties.web)),
    lat,
    lng,
  }
}

function normalizeGeoJson(payload: unknown) {
  const geoJson = payload as GeoJsonResponse

  return (geoJson.features ?? [])
    .map((feature, index) => createRecord(feature, index))
    .filter((item): item is LocationRecord => Boolean(item))
}

function getOptions(items: LocationRecord[]) {
  return {
    municipalities: [...new Set(items.map((item) => item.municipality).filter(Boolean))].sort(collator.compare),
    activities: [...new Set(items.map((item) => item.activityType).filter(Boolean))].sort(collator.compare),
  }
}

function applyFilters(items: LocationRecord[], query: LocationsQuery) {
  const search = query.search.trim().toLowerCase()

  return items.filter((item) => {
    if (query.municipality !== 'all' && item.municipality !== query.municipality) {
      return false
    }

    if (query.activity !== 'all' && item.activityType !== query.activity) {
      return false
    }

    const hasContact = Boolean(item.phone || item.email || item.website)

    if (query.contact === 'withContact' && !hasContact) {
      return false
    }

    if (query.contact === 'withoutContact' && hasContact) {
      return false
    }

    if (!search) {
      return true
    }

    return [item.name, item.municipality, item.address, item.reference, item.activityType]
      .join(' ')
      .toLowerCase()
      .includes(search)
  })
}

function applySorting(items: LocationRecord[], query: LocationsQuery) {
  return [...items].sort((leftItem, rightItem) => {
    const left = (leftItem[query.sort] ?? '').toString().toLowerCase()
    const right = (rightItem[query.sort] ?? '').toString().toLowerCase()
    const order = collator.compare(left, right)

    return query.direction === 'asc' ? order : -order
  })
}

function parseSort(value: string | null): SortKey {
  return value === 'municipality' || value === 'address' || value === 'reference' || value === 'activityType' ? value : 'name'
}

function parseDirection(value: string | null): SortDirection {
  return value === 'desc' ? 'desc' : 'asc'
}

function parseContact(value: string | null): ContactFilter {
  return value === 'withContact' || value === 'withoutContact' ? value : 'all'
}

export function parseLocationsQuery(searchParams: URLSearchParams): LocationsQuery {
  return {
    dataset: searchParams.get('dataset') ?? '',
    search: searchParams.get('search') ?? '',
    municipality: searchParams.get('municipality') ?? 'all',
    activity: searchParams.get('activity') ?? 'all',
    contact: parseContact(searchParams.get('contact')),
    sort: parseSort(searchParams.get('sort')),
    direction: parseDirection(searchParams.get('direction')),
  }
}

async function getNormalizedDataset(dataset: DatasetDefinition): Promise<DatasetCacheEntry | Failure> {
  const cached = datasetCache.get(dataset.key)

  if (cached) {
    return cached
  }

  const result = await fetchDatasetPayload(dataset.key)

  if (result.status !== 200) {
    return result
  }

  const entry = {
    fetchedAt: new Date().toISOString(),
    items: normalizeGeoJson(result.payload),
  }

  datasetCache.set(dataset.key, entry)
  return entry
}

export async function getLocationsPayload(query: LocationsQuery): Promise<LocationsResult> {
  if (!query.dataset) {
    return {
      status: 400,
      error: 'Missing dataset key',
    }
  }

  const dataset = DATASETS.find((item) => item.key === query.dataset)

  if (!dataset) {
    return {
      status: 404,
      error: 'Dataset not found',
    }
  }

  const datasetResult = await getNormalizedDataset(dataset)

  if ('error' in datasetResult) {
    return datasetResult
  }

  const filteredItems = applySorting(applyFilters(datasetResult.items, query), query)
  const options = getOptions(datasetResult.items)

  return {
    status: 200,
    payload: {
      items: filteredItems,
      total: filteredItems.length,
      municipalities: options.municipalities,
      activities: options.activities,
      fetchedAt: datasetResult.fetchedAt,
    },
    cacheControl: 'public, s-maxage=86400, stale-while-revalidate=604800',
  }
}

export async function getDatasetSummariesPayload(): Promise<DatasetSummariesResult> {
  const items: DatasetSummary[] = []

  for (const dataset of DATASETS) {
    const datasetResult = await getNormalizedDataset(dataset)

    if ('error' in datasetResult) {
      return datasetResult
    }

    items.push({
      key: dataset.key,
      dataset,
      count: datasetResult.items.length,
    })
  }

  return {
    status: 200,
    payload: { items },
    cacheControl: 'public, s-maxage=86400, stale-while-revalidate=604800',
  }
}
