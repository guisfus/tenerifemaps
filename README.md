# Tenerife Maps

Aplicacion web moderna para explorar datasets georreferenciados de Tenerife a partir de fuentes GeoJSON publicas. El proyecto reconstruye `tenerifemapsv2` con una base mas mantenible, bilingue y preparada para evolucionar.

## Objetivos

- Visualizar datasets abiertos en un mapa interactivo
- Filtrar y ordenar registros sin depender del DOM manual
- Ofrecer una experiencia bilingue en espanol e ingles
- Permitir exportacion CSV del subconjunto filtrado
- Mantener una arquitectura simple de frontend estatico

## Stack

- Vue 3 + TypeScript
- Vite
- Tailwind CSS v4
- Vue I18n
- Leaflet
- Leaflet MarkerCluster

## Capacidades

- Selector de dataset
- Filtros por texto, municipio, actividad y disponibilidad de contacto
- Tabla responsive con vista en tarjetas para movil
- Mapa con clustering y seleccion sincronizada con la tabla
- Resumen comparativo entre datasets
- Exportacion CSV del resultado visible

## Estructura

```text
src/
  App.vue                  # Orquestacion principal de estado y vistas
  components/
    BarChart.vue           # Grafica comparativa simple
    LeafletMap.vue         # Integracion del mapa y clustering
  data/
    datasets.ts            # Catalogo de datasets remotos
  services/
    geojson.ts             # Carga, cache y normalizacion de GeoJSON
  i18n.ts                  # Textos bilingues
  types.ts                 # Tipos compartidos
```

## Desarrollo

```bash
npm install
npm run dev
```

La aplicacion se sirve normalmente en `http://localhost:5173`.

## Produccion

```bash
npm run build
```

El build generado queda en `dist/`.

## Mantenimiento

### Anadir un nuevo dataset

1. Edita `src/data/datasets.ts`
2. Anade `key`, `title`, `description` y `url`
3. Verifica que el GeoJSON use coordenadas validas y propiedades similares a las ya soportadas

### Ajustar normalizacion de datos

1. Edita `src/services/geojson.ts`
2. Amplia `createRecord()` si el nuevo dataset usa nombres de campo diferentes

## Documentacion adicional

- `docs/ARCHITECTURE.md`
- `docs/DATA_FLOW.md`
