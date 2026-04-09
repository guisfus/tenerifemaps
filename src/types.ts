export type LocaleCode = 'es' | 'en'

export type DatasetDefinition = {
  key: string
  title: Record<LocaleCode, string>
  description: Record<LocaleCode, string>
  url: string
}

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

export type DatasetSummary = {
  key: string
  dataset: DatasetDefinition
  count: number
}

export type SortKey = 'name' | 'municipality' | 'address' | 'reference' | 'activityType'
