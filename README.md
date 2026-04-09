# Tenerife Maps

Visor web bilingue de datasets GeoJSON de Tenerife con mapa interactivo, filtros avanzados y exportacion CSV.

## Idea

Explorar datos abiertos georreferenciados de Tenerife en una interfaz rapida y visual para descubrir recursos, actividad economica y distribucion territorial en la isla.

## Caracteristicas

- Mapa interactivo con Leaflet y clustering de marcadores
- Filtros por texto, municipio, actividad y disponibilidad de contacto
- Tabla responsive sincronizada con el mapa
- Exportacion CSV del subconjunto visible
- Interfaz bilingue en espanol e ingles
- Arquitectura preparada para despliegue estatico en Vercel

## Stack

- Vue 3
- TypeScript
- Vite
- Tailwind CSS v4
- Vue I18n
- Leaflet
- Leaflet MarkerCluster
- Vercel Functions para proxy de datasets

## Como funciona

La aplicacion consume datasets GeoJSON publicos de Tenerife y los normaliza en un modelo interno comun para poder filtrarlos, compararlos y representarlos en un mapa.

En produccion y en desarrollo la carga de datos pasa por un endpoint interno `/api/dataset`. Esto evita bloqueos de CORS al consultar los GeoJSON remotos desde el navegador.

## Estructura

```text
api/
  dataset.ts               # Proxy serverless para datasets en Vercel
src/
  App.vue                  # Estado principal, filtros y vistas
  components/
    BarChart.vue           # Grafica comparativa simple
    LeafletMap.vue         # Integracion del mapa y clustering
  data/
    datasets.ts            # Catalogo de datasets remotos
  server/
    datasetProxy.ts        # Logica compartida del proxy para Vercel y Vite
  services/
    geojson.ts             # Carga, cache y normalizacion de GeoJSON
  i18n.ts                  # Textos bilingues
  types.ts                 # Tipos compartidos
```

## Desarrollo local

```bash
npm install
npm run dev
```

La aplicacion suele abrirse en `http://localhost:5173`.

## Build de produccion

```bash
npm run build
```

El resultado se genera en `dist/`.

## Despliegue en Vercel

1. Sube este repositorio a GitHub.
2. Importa el proyecto en Vercel.
3. Verifica que detecta Vite.
4. Usa `npm run build` como comando de build.
5. Usa `dist` como directorio de salida.
6. Despliega.

No hace falta `vercel.json` para la configuracion basica de esta aplicacion.

## Notas de arquitectura

- El frontend nunca consulta `datos.tenerife.es` directamente desde el navegador.
- La ruta `/api/dataset` valida la clave del dataset y descarga el GeoJSON desde servidor.
- En desarrollo, Vite expone esa misma ruta mediante un middleware local para mantener el mismo flujo que en produccion.
- La cache de registros normalizados sigue siendo del lado cliente, una vez recibida la respuesta del proxy.

## Fuente de datos

Los datasets proceden de `datos.tenerife.es` y se consumen como GeoJSON publico.

## Documentacion adicional

- `docs/ARCHITECTURE.md`
- `docs/DATA_FLOW.md`
