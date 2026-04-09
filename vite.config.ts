import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fetchDatasetPayload } from './src/server/datasetProxy.js'

// Mirrors the production `/api/dataset` endpoint during local development so the
// frontend can always call the same URL regardless of environment.
function datasetProxyPlugin() {
  return {
    name: 'dataset-proxy',
    configureServer(server: { middlewares: { use: (handler: (request: any, response: any, next: () => void) => void) => void } }) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/api/dataset')) {
          next()
          return
        }

        const url = new URL(request.url, 'http://localhost')
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
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), datasetProxyPlugin()],
})
