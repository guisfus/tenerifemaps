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
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

let map: L.Map | null = null
let markerLayer: L.MarkerClusterGroup | null = null
const mapId = `map-${Math.random().toString(36).slice(2, 8)}`
let resizeObserver: ResizeObserver | null = null

function buildPopup(location: LocationRecord) {
  const lines = [`<strong>${location.name}</strong>`, location.municipality, location.address].filter(Boolean)
  return lines.join('<br />')
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
    map.setView([28.4636, -16.2518], 10)
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
    map.fitBounds(bounds, {
      padding: [36, 36],
      maxZoom: 14,
    })
  }
}

onMounted(() => {
  map = L.map(mapId, { zoomControl: false }).setView([28.4636, -16.2518], 10)
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
  () => renderMarkers(true),
  { deep: true },
)

watch(
  () => props.selectedId,
  () => renderMarkers(false),
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  map?.remove()
})
</script>

<template>
  <div :id="mapId" class="h-full min-h-[560px] w-full" />
</template>
