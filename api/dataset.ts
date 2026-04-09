import { fetchDatasetPayload } from '../src/server/datasetProxy'

// Minimal serverless wrapper used by Vercel in production. The actual fetch and
// validation logic lives in `src/server/datasetProxy.ts` so development and
// production share the same behavior.
export default async function handler(request: any, response: any) {
  const key = typeof request.query?.key === 'string' ? request.query.key : ''
  const result = await fetchDatasetPayload(key)

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
