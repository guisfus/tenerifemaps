import { getCsvExportPayload, parseLocale, parseLocationsQuery } from '../src/server/locations.js'

export default async function handler(request: any, response: any) {
  const url = new URL(request.url ?? '/api/export', 'http://localhost')
  const query = parseLocationsQuery(url.searchParams)
  const locale = parseLocale(url.searchParams)
  const result = await getCsvExportPayload(query, locale)

  if (result.status !== 200) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.statusCode = result.status
    response.end(JSON.stringify({ error: result.error }))
    return
  }

  response.setHeader('Content-Type', result.contentType)
  response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
  response.statusCode = 200
  response.end(result.payload)
}
