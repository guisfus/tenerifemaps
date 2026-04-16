import { getLocationsPayload, parseLocationsQuery } from '../src/server/locations.js'

export default async function handler(request: any, response: any) {
  const url = new URL(request.url ?? '/api/locations', 'http://localhost')
  const query = parseLocationsQuery(url.searchParams)
  const result = await getLocationsPayload(query)

  response.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (result.status !== 200) {
    if (result.status === 429) {
      response.setHeader('Retry-After', '60')
    }

    response.statusCode = result.status
    response.end(JSON.stringify({ error: result.error }))
    return
  }

  response.setHeader('Cache-Control', result.cacheControl)
  response.statusCode = 200
  response.end(JSON.stringify(result.payload))
}
