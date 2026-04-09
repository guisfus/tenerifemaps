import { DATASETS } from '../data/datasets.js'
import { fetchDatasetPayload } from './datasetProxy.js'
import type { DatasetDefinition, DatasetSummary, LocationRecord, PaginationMeta, SortKey } from '../types'

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
type LocaleCode = 'es' | 'en'

type DatasetCacheEntry = {
  fetchedAt: string
  items: LocationRecord[]
}

type Failure = {
  status: 400 | 404 | 502
  error: string
}

type LocationsSuccess = {
  status: 200
  payload: {
    items: LocationRecord[]
    mapItems: LocationRecord[]
    municipalities: string[]
    activities: string[]
    fetchedAt: string
    pagination: PaginationMeta
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

type ExportSuccess = {
  status: 200
  payload: string
  filename: string
  contentType: string
}

export type LocationsQuery = {
  dataset: string
  search: string
  municipality: string
  activity: string
  contact: ContactFilter
  sort: SortKey
  direction: SortDirection
  page: number
  pageSize: number
  refresh: boolean
}

export type LocationsResult = LocationsSuccess | Failure
export type DatasetSummariesResult = SummarySuccess | Failure
export type CsvExportResult = ExportSuccess | Failure

const datasetCache = new Map<string, DatasetCacheEntry>()
const collator = new Intl.Collator('es', { sensitivity: 'base' })
const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800'
const MAX_PAGE_SIZE = 100
const DEFAULT_PAGE_SIZE = 25
const MAX_MAP_ITEMS = 2000

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

function buildPagination(total: number, page: number, pageSize: number): PaginationMeta {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)

  return {
    total,
    page: safePage,
    pageSize,
    pageCount,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < pageCount,
  }
}

function paginateItems(items: LocationRecord[], pagination: PaginationMeta) {
  const offset = (pagination.page - 1) * pagination.pageSize
  return items.slice(offset, offset + pagination.pageSize)
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

function parsePositiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function escapeCsv(value: string) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function getCsvHeaders(locale: LocaleCode) {
  if (locale === 'es') {
    return ['Nombre', 'Municipio', 'Direccion', 'Referencia', 'Contacto', 'Sitio web']
  }

  return ['Name', 'Municipality', 'Address', 'Reference', 'Contact', 'Website']
}

function buildCsv(items: LocationRecord[], locale: LocaleCode) {
  const headers = getCsvHeaders(locale)
  const rows = items.map((item) => [
    item.name,
    item.municipality,
    item.address,
    item.reference,
    [item.phone, item.email].filter(Boolean).join(' / '),
    item.website,
  ])

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
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
    page: parsePositiveInteger(searchParams.get('page'), 1),
    pageSize: Math.min(parsePositiveInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
    refresh: searchParams.get('refresh') === '1',
  }
}

function parseLocale(searchParams: URLSearchParams): LocaleCode {
  return searchParams.get('locale') === 'en' ? 'en' : 'es'
}

async function getNormalizedDataset(dataset: DatasetDefinition, options: { forceFresh?: boolean } = {}): Promise<DatasetCacheEntry | Failure> {
  const cached = datasetCache.get(dataset.key)

  if (cached && !options.forceFresh) {
    return cached
  }

  if (options.forceFresh) {
    datasetCache.delete(dataset.key)
  }

  const result = await fetchDatasetPayload(dataset.key, { forceFresh: options.forceFresh })

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

async function resolveDataset(query: LocationsQuery): Promise<{ dataset: DatasetDefinition; entry: DatasetCacheEntry } | Failure> {
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

  const entry = await getNormalizedDataset(dataset, { forceFresh: query.refresh })

  if ('error' in entry) {
    return entry
  }

  return { dataset, entry }
}

function queryDatasetItems(entry: DatasetCacheEntry, query: LocationsQuery) {
  const filteredItems = applySorting(applyFilters(entry.items, query), query)
  const pagination = buildPagination(filteredItems.length, query.page, query.pageSize)

  return {
    filteredItems,
    tableItems: paginateItems(filteredItems, pagination),
    mapItems: filteredItems.slice(0, MAX_MAP_ITEMS),
    pagination,
    options: getOptions(entry.items),
  }
}

export async function getLocationsPayload(query: LocationsQuery): Promise<LocationsResult> {
  const resolved = await resolveDataset(query)

  if ('error' in resolved) {
    return resolved
  }

  const result = queryDatasetItems(resolved.entry, query)

  return {
    status: 200,
    payload: {
      items: result.tableItems,
      mapItems: result.mapItems,
      municipalities: result.options.municipalities,
      activities: result.options.activities,
      fetchedAt: resolved.entry.fetchedAt,
      pagination: result.pagination,
    },
    cacheControl: CACHE_CONTROL,
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
    cacheControl: CACHE_CONTROL,
  }
}

export async function getCsvExportPayload(query: LocationsQuery, locale: LocaleCode): Promise<CsvExportResult> {
  const resolved = await resolveDataset(query)

  if ('error' in resolved) {
    return resolved
  }

  const filteredItems = queryDatasetItems(resolved.entry, { ...query, page: 1, pageSize: MAX_PAGE_SIZE }).filteredItems

  return {
    status: 200,
    payload: buildCsv(filteredItems, locale),
    filename: `${resolved.dataset.key}-${locale}.csv`,
    contentType: 'text/csv; charset=utf-8',
  }
}

export { parseLocale }
