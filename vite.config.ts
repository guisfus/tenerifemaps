import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fetchDatasetPayload } from './src/server/datasetProxy.js'
import { getCsvExportPayload, getDatasetSummariesPayload, getLocationsPayload, parseLocale, parseLocationsQuery } from './src/server/locations.js'

// Mirrors the production API endpoints during local development so the frontend
// can always call the same URLs regardless of environment.
function datasetProxyPlugin() {
  return {
    name: 'dataset-proxy',
    configureServer(server: { middlewares: { use: (handler: (request: any, response: any, next: () => void) => void) => void } }) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/')) {
          next()
          return
        }

        const url = new URL(request.url, 'http://localhost')

        if (url.pathname === '/api/dataset') {
          const key = url.searchParams.get('key') ?? ''
          const result = await fetchDatasetPayload(key)

          response.statusCode = result.status
          response.setHeader('Content-Type', 'application/json; charset=utf-8')

          if (result.status === 200) {
            response.setHeader('Cache-Control', result.cacheControl)
            response.end(JSON.stringify(result.payload))
            return
          }

          response.end(JSON.stringify({ error: result.error }))
          return
        }

        if (url.pathname === '/api/locations') {
          const result = await getLocationsPayload(parseLocationsQuery(url.searchParams))

          response.statusCode = result.status
          response.setHeader('Content-Type', 'application/json; charset=utf-8')

          if (result.status === 200) {
            response.setHeader('Cache-Control', result.cacheControl)
            response.end(JSON.stringify(result.payload))
            return
          }

          response.end(JSON.stringify({ error: result.error }))
          return
        }

        if (url.pathname === '/api/summary') {
          const result = await getDatasetSummariesPayload()

          response.statusCode = result.status
          response.setHeader('Content-Type', 'application/json; charset=utf-8')

          if (result.status === 200) {
            response.setHeader('Cache-Control', result.cacheControl)
            response.end(JSON.stringify(result.payload))
            return
          }

          response.end(JSON.stringify({ error: result.error }))
          return
        }

        if (url.pathname === '/api/export') {
          const result = await getCsvExportPayload(parseLocationsQuery(url.searchParams), parseLocale(url.searchParams))

          if (result.status !== 200) {
            response.statusCode = result.status
            response.setHeader('Content-Type', 'application/json; charset=utf-8')
            response.end(JSON.stringify({ error: result.error }))
            return
          }

          response.statusCode = 200
          response.setHeader('Content-Type', result.contentType)
          response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
          response.end(result.payload)
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), datasetProxyPlugin()],
})
