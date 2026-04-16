<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet.markercluster'
import type { LocationRecord } from '../types'

// The map stays intentionally dumb: it only knows how to render locations and
// report selection back to the parent component.
const props = defineProps<{
  locations: LocationRecord[]
  selectedId: string | null
  viewport: { lat: number; lng: number; zoom: number } | null
}>()

const emit = defineEmits<{
  select: [id: string]
  viewportChange: [viewport: { lat: number; lng: number; zoom: number }]
}>()

let map: L.Map | null = null
let markerLayer: L.MarkerClusterGroup | null = null
const mapId = `map-${Math.random().toString(36).slice(2, 8)}`
let resizeObserver: ResizeObserver | null = null
const canaryBounds = L.latLngBounds([
  [27.4, -18.6],
  [29.9, -12.4],
])

function buildPopup(location: LocationRecord) {
  const lines = [`<strong>${location.name}</strong>`, location.municipality, location.address].filter(Boolean)
  return lines.join('<br />')
}

function emitViewport() {
  if (!map) {
    return
  }

  const center = map.getCenter()
  emit('viewportChange', {
    lat: center.lat,
    lng: center.lng,
    zoom: map.getZoom(),
  })
}

function applyViewport(viewport: { lat: number; lng: number; zoom: number } | null) {
  if (!map || !viewport) {
    return false
  }

  const center = map.getCenter()
  const sameView = Math.abs(center.lat - viewport.lat) < 0.0001
    && Math.abs(center.lng - viewport.lng) < 0.0001
    && map.getZoom() === viewport.zoom

  if (sameView) {
    return true
  }

  map.setView([viewport.lat, viewport.lng], viewport.zoom)
  return true
}

function createMarkerIcon(isSelected: boolean) {
  return L.divIcon({
    className: '',
    html: `<span class="tm-marker${isSelected ? ' tm-marker--selected' : ''}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

// Rebuild cluster markers whenever the incoming dataset changes. Re-fitting the
// bounds is only needed when the set of locations changes, not when selection changes.
function renderMarkers(shouldFitBounds = true) {
  if (!map || !markerLayer) {
    return
  }

  markerLayer.clearLayers()

  if (!props.locations.length) {
    if (!applyViewport(props.viewport)) {
      map.setView([28.4636, -16.2518], 9)
    }
    return
  }

  const bounds = L.latLngBounds([])

  for (const location of props.locations) {
    const marker = L.marker([location.lat, location.lng], {
      icon: createMarkerIcon(location.id === props.selectedId),
      title: location.name,
    })

    marker.bindPopup(buildPopup(location))
    marker.on('click', () => emit('select', location.id))
    markerLayer.addLayer(marker)
    bounds.extend([location.lat, location.lng])
  }

  if (shouldFitBounds) {
    map.fitBounds(bounds.pad(0.12), {
      padding: [36, 36],
      maxZoom: 14,
    })
    emitViewport()
  }
}

onMounted(() => {
  map = L.map(mapId, {
    zoomControl: false,
    maxBounds: canaryBounds,
    maxBoundsViscosity: 1,
    minZoom: 8,
  }).setView([28.4636, -16.2518], 9)

  applyViewport(props.viewport)
  L.control.zoom({ position: 'topright' }).addTo(map)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  markerLayer = L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    // Clustering is intentionally relaxed so clusters break apart earlier when zooming.
    disableClusteringAtZoom: 14,
    maxClusterRadius: 40,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount()

      return L.divIcon({
        html: `<span class="tm-cluster">${count}</span>`,
        className: '',
        iconSize: [46, 46],
      })
    },
  })

  map.addLayer(markerLayer)
  map.on('moveend zoomend', emitViewport)
  renderMarkers()

  const element = document.getElementById(mapId)

  if (element) {
    // Leaflet does not automatically react when the parent container grows after
    // mount, so we invalidate the internal size on real DOM resize.
    resizeObserver = new ResizeObserver(() => {
      map?.invalidateSize(false)
    })

    resizeObserver.observe(element)
  }
})

watch(
  () => props.locations,
  () => renderMarkers(!props.viewport),
  { deep: true },
)

watch(
  () => props.selectedId,
  () => renderMarkers(false),
)

watch(
  () => props.viewport,
  (nextViewport) => {
    applyViewport(nextViewport)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.off('moveend zoomend', emitViewport)
  map?.remove()
})
</script>

<template>
  <div :id="mapId" class="h-full min-h-[560px] w-full" />
</template>
