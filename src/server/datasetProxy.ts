import { DATASETS } from '../data/datasets.js'

type DatasetProxySuccess = {
  status: 200
  payload: unknown
  cacheControl: string
}

type DatasetProxyFailure = {
  status: 400 | 404 | 502
  error: string
}

export type DatasetProxyResult = DatasetProxySuccess | DatasetProxyFailure

const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800'

/**
 * Resolves one known dataset key, fetches the upstream GeoJSON and returns a
 * small typed result consumed by both the Vercel function and the local Vite middleware.
 */
export async function fetchDatasetPayload(key: string): Promise<DatasetProxyResult> {
  if (!key) {
    return {
      status: 400,
      error: 'Missing dataset key',
    }
  }

  const dataset = DATASETS.find((item) => item.key === key)

  if (!dataset) {
    return {
      status: 404,
      error: 'Dataset not found',
    }
  }

  try {
    const response = await fetch(dataset.url, {
      headers: {
        accept: 'application/geo+json, application/json',
      },
    })

    if (!response.ok) {
      return {
        status: 502,
        error: `Dataset request failed with status ${response.status}`,
      }
    }

    return {
      status: 200,
      payload: await response.json(),
      cacheControl: CACHE_CONTROL,
    }
  } catch {
    return {
      status: 502,
      error: 'Unable to fetch dataset right now',
    }
  }
}
