import type { DatasetDefinition, DatasetMetadata } from '../types'

type CkanActionSuccess<T> = {
  success: true
  result: T
}

type CkanResource = {
  id: string
  package_id?: string
  format?: string
  url?: string
  name?: string
  description?: string
  last_modified?: string
  metadata_modified?: string
  mimetype?: string
}

type CkanOrganization = {
  title?: string
}

type CkanPackage = {
  id: string
  title?: string
  notes?: string
  url?: string
  metadata_modified?: string
  license_title?: string
  license_id?: string
  organization?: CkanOrganization
  resources?: CkanResource[]
}

type ResourceResolution = {
  url: string
  resource: CkanResource | null
  packageData: CkanPackage | null
  usedFallback: boolean
}

const CKAN_BASE_URL = 'https://datos.tenerife.es/ckan/api/3/action'
const REQUEST_TIMEOUT_MS = 8000

const resourceCache = new Map<string, CkanResource>()
const packageCache = new Map<string, CkanPackage>()
const urlResolutionCache = new Map<string, ResourceResolution>()
const metadataCache = new Map<string, DatasetMetadata>()

async function fetchCkanAction<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${CKAN_BASE_URL}/${path}`, {
      headers: {
        accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`CKAN request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as Partial<CkanActionSuccess<T>>

    if (payload.success !== true || !payload.result) {
      throw new Error('CKAN returned an unsuccessful response payload')
    }

    return payload.result
  } finally {
    clearTimeout(timeout)
  }
}

function looksLikeGeoJson(resource: CkanResource) {
  const format = resource.format?.toLowerCase() ?? ''
  const url = resource.url?.toLowerCase() ?? ''

  return format === 'geojson' || url.includes('.geojson')
}

function pickBestResource(resources: CkanResource[] = []) {
  return resources.find((resource) => resource.format?.toLowerCase() === 'geojson')
    ?? resources.find((resource) => resource.url?.toLowerCase().includes('.geojson'))
    ?? null
}

function buildDatasetPageUrl(packageId: string) {
  return `https://datos.tenerife.es/ckan/dataset/${packageId}`
}

function fallbackMetadata(dataset: DatasetDefinition): DatasetMetadata {
  return {
    title: dataset.title.es,
    description: dataset.description.es,
    source: 'datos.tenerife.es',
    sourceUrl: buildDatasetPageUrl(dataset.packageId ?? dataset.key),
    originalUrl: dataset.url,
    updatedAt: '',
    license: '',
    geometryType: 'Point',
    legendLabel: 'Each marker represents one matching location',
  }
}

function logFallback(message: string, details: string) {
  console.warn(`[ckan] ${message}: ${details}`)
}

export async function fetchCkanResource(resourceId: string) {
  const cached = resourceCache.get(resourceId)

  if (cached) {
    return cached
  }

  const resource = await fetchCkanAction<CkanResource>(`resource_show?id=${encodeURIComponent(resourceId)}`)
  resourceCache.set(resourceId, resource)
  return resource
}

export async function fetchCkanPackage(packageId: string) {
  const cached = packageCache.get(packageId)

  if (cached) {
    return cached
  }

  const packageData = await fetchCkanAction<CkanPackage>(`package_show?id=${encodeURIComponent(packageId)}`)
  packageCache.set(packageId, packageData)
  return packageData
}

async function resolveDatasetResource(dataset: DatasetDefinition, options: { forceFresh?: boolean } = {}): Promise<ResourceResolution> {
  if (!options.forceFresh) {
    const cached = urlResolutionCache.get(dataset.key)

    if (cached) {
      return cached
    }
  }

  let packageData: CkanPackage | null = null
  let resource: CkanResource | null = null

  try {
    if (dataset.resourceId) {
      resource = await fetchCkanResource(dataset.resourceId)
      const url = resource.url

      if (url && looksLikeGeoJson(resource)) {
        const resolution = { url, resource, packageData, usedFallback: false }
        urlResolutionCache.set(dataset.key, resolution)
        return resolution
      }
    }

    if (dataset.packageId) {
      packageData = await fetchCkanPackage(dataset.packageId)
      resource = pickBestResource(packageData.resources)

      if (resource?.url) {
        const resolution = { url: resource.url, resource, packageData, usedFallback: false }
        urlResolutionCache.set(dataset.key, resolution)
        return resolution
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown CKAN error'
    logFallback(`Falling back to static URL for ${dataset.key}`, message)
  }

  const resolution = {
    url: dataset.url,
    resource,
    packageData,
    usedFallback: true,
  }
  urlResolutionCache.set(dataset.key, resolution)
  return resolution
}

// CKAN provides a stable metadata API on top of raw download URLs. We prefer it
// for title, source, license and update timestamps, but always keep the static
// `url` fallback so dataset loading stays resilient if CKAN is unavailable.
export async function resolveDatasetUrl(dataset: DatasetDefinition, options: { forceFresh?: boolean } = {}) {
  const resolution = await resolveDatasetResource(dataset, options)
  return resolution.url
}

// CKAN action endpoints may return HTTP 200 with a failed logical response, so
// all calls validate `success === true` and `result` before trusting the payload.
export async function resolveDatasetMetadata(dataset: DatasetDefinition, locale: 'es' | 'en' = 'es', options: { forceFresh?: boolean } = {}) {
  if (!options.forceFresh) {
    const cached = metadataCache.get(`${dataset.key}:${locale}`)

    if (cached) {
      return cached
    }
  }

  const fallback = fallbackMetadata(dataset)

  try {
    const resolution = await resolveDatasetResource(dataset, options)
    const packageData = resolution.packageData ?? (dataset.packageId ? await fetchCkanPackage(dataset.packageId) : null)

    const metadata: DatasetMetadata = {
      title: packageData?.title || dataset.title[locale],
      description: packageData?.notes || dataset.description[locale],
      source: packageData?.organization?.title || 'datos.tenerife.es',
      sourceUrl: packageData?.id ? buildDatasetPageUrl(packageData.id) : fallback.sourceUrl,
      originalUrl: resolution.url || dataset.url,
      updatedAt: resolution.resource?.last_modified || resolution.resource?.metadata_modified || packageData?.metadata_modified || '',
      license: packageData?.license_title || packageData?.license_id || '',
      geometryType: 'Point',
      legendLabel: locale === 'en' ? 'Each marker represents one matching location' : 'Cada marcador representa una ubicacion coincidente',
    }

    metadataCache.set(`${dataset.key}:${locale}`, metadata)
    return metadata
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown CKAN error'
    logFallback(`Falling back to static metadata for ${dataset.key}`, message)
    metadataCache.set(`${dataset.key}:${locale}`, fallback)
    return fallback
  }
}
