import type { DatasetDefinition, DatasetSummary, LocationRecord, PaginationMeta, SortKey } from '../types'

type ContactFilter = 'all' | 'withContact' | 'withoutContact'
type SortDirection = 'asc' | 'desc'

type LocationsResponse = {
  items: LocationRecord[]
  mapItems: LocationRecord[]
  municipalities: string[]
  activities: string[]
  fetchedAt: string
  pagination: PaginationMeta
}

type SummaryResponse = {
  items: DatasetSummary[]
}

type DatasetRequestOptions = {
  search: string
  municipality: string
  activity: string
  contact: ContactFilter
  sort: SortKey
  direction: SortDirection
  page: number
  pageSize: number
}

async function readResponse<T>(response: Response) {
  if (!response.ok) {
    let message = `Dataset request failed with status ${response.status}`

    try {
      const payload = (await response.json()) as { error?: string }

      if (payload.error) {
        message = payload.error
      }
    } catch {
      // Ignore malformed error payloads and keep the fallback message.
    }

    throw new Error(message)
  }

  return (await response.json()) as T
}

export async function fetchDatasetLocations(dataset: DatasetDefinition, options: DatasetRequestOptions) {
  const searchParams = new URLSearchParams({
    dataset: dataset.key,
    search: options.search,
    municipality: options.municipality,
    activity: options.activity,
    contact: options.contact,
    sort: options.sort,
    direction: options.direction,
    page: String(options.page),
    pageSize: String(options.pageSize),
  })

  const response = await fetch(`/api/locations?${searchParams.toString()}`)
  return readResponse<LocationsResponse>(response)
}

export async function fetchDatasetSummaries() {
  const response = await fetch('/api/summary')
  return readResponse<SummaryResponse>(response)
}

export function buildDatasetExportUrl(dataset: DatasetDefinition, options: DatasetRequestOptions, locale: string) {
  const searchParams = new URLSearchParams({
    dataset: dataset.key,
    search: options.search,
    municipality: options.municipality,
    activity: options.activity,
    contact: options.contact,
    sort: options.sort,
    direction: options.direction,
    page: '1',
    pageSize: String(options.pageSize),
    locale,
  })

  return `/api/export?${searchParams.toString()}`
}
