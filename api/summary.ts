import { getDatasetSummariesPayload } from '../src/server/locations.js'

export default async function handler(_request: any, response: any) {
  const result = await getDatasetSummariesPayload()

  response.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (result.status !== 200) {
    response.statusCode = result.status
    response.end(JSON.stringify({ error: result.error }))
    return
  }

  response.setHeader('Cache-Control', result.cacheControl)
  response.statusCode = 200
  response.end(JSON.stringify(result.payload))
}
