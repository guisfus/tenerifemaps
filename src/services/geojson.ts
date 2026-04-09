import type { DatasetDefinition, LocationRecord } from '../types'

type Feature = {
  properties?: Record<string, unknown>
  geometry?: {
    coordinates?: [number, number]
  }
}

type GeoJsonResponse = {
  features?: Feature[]
}

// Cache one normalized result per dataset key to avoid repeated network work
// when switching language, redrawing charts or refreshing the UI structure.
const cache = new Map<string, LocationRecord[]>()

/** Normalizes nullable and legacy placeholder values from the source GeoJSON. */
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

/** Ensures exported links are clickable even when the upstream dataset omits the protocol. */
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

/**
 * Downloads and normalizes one dataset into the internal `LocationRecord` shape.
 *
 * Returning typed records here keeps rendering components free from source-specific
 * field names and defensive parsing.
 */
export async function fetchDatasetLocations(dataset: DatasetDefinition) {
  if (cache.has(dataset.key)) {
    return cache.get(dataset.key) ?? []
  }

  const response = await fetch(dataset.url)

  if (!response.ok) {
    throw new Error(`Dataset request failed with status ${response.status}`)
  }

  const payload = (await response.json()) as GeoJsonResponse
  const locations = (payload.features ?? [])
    .map((feature, index) => createRecord(feature, index))
    .filter((item): item is LocationRecord => Boolean(item))

  cache.set(dataset.key, locations)
  return locations
}
