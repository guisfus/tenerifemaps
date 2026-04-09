/** Supported UI locales. */
export type LocaleCode = 'es' | 'en'

/** Static metadata needed to render and fetch a dataset. */
export type DatasetDefinition = {
  key: string
  title: Record<LocaleCode, string>
  description: Record<LocaleCode, string>
  url: string
}

/** Normalized shape consumed by the app after parsing raw GeoJSON features. */
export type LocationRecord = {
  id: string
  name: string
  activityType: string
  municipality: string
  address: string
  reference: string
  postalCode: string
  phone: string
  email: string
  website: string
  lat: number
  lng: number
}

/** Lightweight aggregate used by the comparison chart. */
export type DatasetSummary = {
  key: string
  dataset: DatasetDefinition
  count: number
}

/** Columns that support client-side sorting in the inventory view. */
export type SortKey = 'name' | 'municipality' | 'address' | 'reference' | 'activityType'
