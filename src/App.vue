<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BarChart from './components/BarChart.vue'
import LeafletMap from './components/LeafletMap.vue'
import { DATASETS, getDatasetCategoryLabel, getDatasetPresentation } from './data/datasets'
import { sanitizeExternalUrl } from './shared/url'
import { buildDatasetExportUrl, fetchDatasetLocations, fetchDatasetSummaries } from './services/geojson'
import type { DatasetMetadata, DatasetSummary, LocationRecord, SortKey } from './types'

type ContactFilter = 'all' | 'withContact' | 'withoutContact'
type ThemeMode = 'dark' | 'light'
type MapViewport = { lat: number; lng: number; zoom: number }

const { t, locale } = useI18n()

// Main UI state: active dataset, selection, filters and loading flags.
const activeDatasetKey = ref(DATASETS[0].key)
const selectedId = ref<string | null>(null)
const search = ref('')
const selectedMunicipality = ref('all')
const selectedActivity = ref('all')
const contactFilter = ref<ContactFilter>('all')
const loading = ref(false)
const chartLoading = ref(false)
const errorMessage = ref('')
const lastUpdated = ref('')
const tableLocations = ref<LocationRecord[]>([])
const mapLocations = ref<LocationRecord[]>([])
const datasetSummaries = ref<DatasetSummary[]>([])
const municipalityOptions = ref<string[]>([])
const activityOptions = ref<string[]>([])
const sortKey = ref<SortKey>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')
const theme = ref<ThemeMode>('dark')
const headerControlsOpen = ref(true)
const page = ref(1)
const pageSize = ref(25)
const totalResults = ref(0)
const pageCount = ref(1)
const datasetMetadata = ref<DatasetMetadata | null>(null)
const mapViewport = ref<MapViewport | null>(null)
const mapResetVersion = ref(0)
let searchDebounce: number | null = null
let suppressQueryReload = false
let suppressUrlSync = false

// Dataset metadata is stored separately from loaded records so the same UI can
// switch sources without changing the rendering logic.
const currentDataset = computed(() => DATASETS.find((dataset) => dataset.key === activeDatasetKey.value) ?? DATASETS[0])
const datasetPresentation = computed(() => getDatasetPresentation(currentDataset.value, locale.value))
const pageSizeOptions = [25, 50, 100]
const filteredDatasetGroups = computed(() => {
  const grouped = new Map<string, typeof DATASETS>()

  for (const dataset of DATASETS) {
    const bucket = grouped.get(dataset.category) ?? []
    bucket.push(dataset)
    grouped.set(dataset.category, bucket)
  }

  return [...grouped.entries()].map(([category, datasets]) => ({
    category,
    label: getDatasetCategoryLabel(category, locale.value),
    datasets,
  }))
})

const hasActiveFilters = computed(() => search.value || selectedMunicipality.value !== 'all' || selectedActivity.value !== 'all' || contactFilter.value !== 'all')
const selectedLocation = computed(() => mapLocations.value.find((location) => location.id === selectedId.value) ?? tableLocations.value.find((location) => location.id === selectedId.value) ?? null)
const municipalitiesCount = computed(() => new Set(mapLocations.value.map((item) => item.municipality).filter(Boolean)).size)
const activityCount = computed(() => new Set(mapLocations.value.map((item) => item.activityType).filter(Boolean)).size)
const isLightTheme = computed(() => theme.value === 'light')
const currentRangeStart = computed(() => (totalResults.value ? (page.value - 1) * pageSize.value + 1 : 0))
const currentRangeEnd = computed(() => Math.min(page.value * pageSize.value, totalResults.value))
const mapLegend = computed(() => datasetMetadata.value ? {
  geometryType: datasetMetadata.value.geometryType,
  label: datasetMetadata.value.legendLabel,
} : null)
const chartItems = computed(() =>
  datasetSummaries.value.map((item) => ({
    key: item.key,
    label: getDatasetPresentation(item.dataset, locale.value).title,
    value: item.count,
  })),
)

const pageClass = computed(() =>
  isLightTheme.value
    ? 'min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_24%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_20%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_42%,#e5edf5_100%)] text-slate-900'
    : 'min-h-screen text-slate-100',
)
const headerClass = computed(() =>
  isLightTheme.value ? 'border-b border-slate-300/70 bg-white/75 backdrop-blur-xl' : 'border-b border-white/8 bg-slate-950/40 backdrop-blur-xl',
)
const headingClass = computed(() => (isLightTheme.value ? 'text-slate-950' : 'text-white'))
const mutedClass = computed(() => (isLightTheme.value ? 'text-slate-600' : 'text-slate-400'))
const subtleClass = computed(() => (isLightTheme.value ? 'text-slate-500' : 'text-slate-500'))
const controlClass = computed(() =>
  isLightTheme.value
    ? 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-sky-500/60'
    : 'w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2.5 text-[13px] text-white outline-none transition focus:border-sky-400/60',
)
const compactControlClass = computed(() =>
  isLightTheme.value
    ? 'min-w-[70px] appearance-none rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 pr-6 text-[11px] font-medium text-slate-900 outline-none transition focus:border-sky-500/60'
    : 'min-w-[70px] appearance-none rounded-lg border border-white/10 bg-slate-900/70 px-2.5 py-1.5 pr-6 text-[11px] font-medium text-white outline-none transition focus:border-sky-400/60',
)
const iconButtonClass = computed(() =>
  isLightTheme.value
    ? 'group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-sky-400/40 hover:text-sky-700'
    : 'group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/25 bg-linear-to-r from-sky-400/14 via-cyan-400/10 to-emerald-400/14 text-sky-100 transition hover:border-sky-300/40 hover:from-sky-400/22 hover:to-emerald-400/22',
)
const primaryButtonClass = computed(() =>
  isLightTheme.value
    ? 'rounded-lg border border-sky-300 bg-sky-50 px-3 py-2.5 text-[13px] font-medium text-sky-800 transition hover:bg-sky-100'
    : 'rounded-lg border border-sky-400/25 bg-sky-400/10 px-3 py-2.5 text-[13px] font-medium text-sky-100 transition hover:bg-sky-400/20',
)
const secondaryButtonClass = computed(() =>
  isLightTheme.value
    ? 'rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[13px] font-medium text-slate-800 transition hover:bg-slate-100'
    : 'rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-[13px] font-medium text-slate-100 transition hover:bg-white/10',
)
const successButtonClass = computed(() =>
  isLightTheme.value
    ? 'rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-[13px] font-medium text-emerald-800 transition hover:bg-emerald-100'
    : 'rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2.5 text-[13px] font-medium text-emerald-100 transition hover:bg-emerald-400/20',
)
const metricRowClass = computed(() =>
  isLightTheme.value ? 'flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-300 pt-2 text-[11px] text-slate-600' : 'flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/8 pt-2 text-[11px] text-slate-400',
)
const panelClass = computed(() => (isLightTheme.value ? 'border-y border-slate-300/80 bg-transparent' : 'border-y border-white/8 bg-transparent'))
const cardClass = computed(() =>
  isLightTheme.value ? 'border border-slate-300 bg-white/90 p-3' : 'border border-white/8 bg-slate-950/35 p-3',
)
const tableHeaderClass = computed(() =>
  isLightTheme.value ? 'bg-slate-100 text-xs uppercase tracking-[0.18em] text-slate-500' : 'bg-slate-950/35 text-xs uppercase tracking-[0.18em] text-slate-400',
)
const tableBodyClass = computed(() => (isLightTheme.value ? 'divide-y divide-slate-200 text-slate-800' : 'divide-y divide-white/5 text-slate-200'))

function applyTheme(nextTheme: ThemeMode) {
  document.documentElement.dataset.theme = nextTheme
  document.documentElement.style.colorScheme = nextTheme
}

function parseContactFilter(value: string | null): ContactFilter {
  return value === 'withContact' || value === 'withoutContact' ? value : 'all'
}

function parseViewport(searchParams: URLSearchParams) {
  const lat = Number.parseFloat(searchParams.get('lat') ?? '')
  const lng = Number.parseFloat(searchParams.get('lng') ?? '')
  const zoom = Number.parseInt(searchParams.get('zoom') ?? '', 10)

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(zoom)) {
    return null
  }

  return { lat, lng, zoom }
}

function restoreStateFromUrl() {
  const searchParams = new URLSearchParams(window.location.search)
  const datasetKey = searchParams.get('dataset')

  if (datasetKey && DATASETS.some((dataset) => dataset.key === datasetKey)) {
    activeDatasetKey.value = datasetKey
  }

  search.value = searchParams.get('search') ?? ''
  selectedMunicipality.value = searchParams.get('municipality') ?? 'all'
  selectedActivity.value = searchParams.get('activity') ?? 'all'
  contactFilter.value = parseContactFilter(searchParams.get('contact'))
  sortKey.value = (['name', 'municipality', 'address', 'reference', 'activityType'] as SortKey[]).includes((searchParams.get('sort') ?? 'name') as SortKey)
    ? (searchParams.get('sort') as SortKey)
    : 'name'
  sortDirection.value = searchParams.get('direction') === 'desc' ? 'desc' : 'asc'
  page.value = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1)
  pageSize.value = pageSizeOptions.includes(Number.parseInt(searchParams.get('pageSize') ?? `${pageSize.value}`, 10))
    ? Number.parseInt(searchParams.get('pageSize') ?? `${pageSize.value}`, 10)
    : pageSize.value
  mapViewport.value = parseViewport(searchParams)
}

function syncStateToUrl() {
  if (suppressUrlSync) {
    return
  }

  const searchParams = new URLSearchParams()
  searchParams.set('dataset', activeDatasetKey.value)

  if (search.value) searchParams.set('search', search.value)
  if (selectedMunicipality.value !== 'all') searchParams.set('municipality', selectedMunicipality.value)
  if (selectedActivity.value !== 'all') searchParams.set('activity', selectedActivity.value)
  if (contactFilter.value !== 'all') searchParams.set('contact', contactFilter.value)
  if (sortKey.value !== 'name') searchParams.set('sort', sortKey.value)
  if (sortDirection.value !== 'asc') searchParams.set('direction', sortDirection.value)
  if (page.value > 1) searchParams.set('page', String(page.value))
  if (pageSize.value !== 25) searchParams.set('pageSize', String(pageSize.value))

  if (mapViewport.value) {
    searchParams.set('lat', mapViewport.value.lat.toFixed(5))
    searchParams.set('lng', mapViewport.value.lng.toFixed(5))
    searchParams.set('zoom', String(mapViewport.value.zoom))
  }

  const nextUrl = `${window.location.pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  window.history.replaceState({}, '', nextUrl)
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function toggleMobileFilters() {
  headerControlsOpen.value = !headerControlsOpen.value
}

function formatDate(date: string) {
  if (!date) {
    return '--'
  }

  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

function formatText(value: string) {
  return value || '—'
}

function safeExternalLink(url: string) {
  return sanitizeExternalUrl(url)
}

// Clicking the same header toggles direction; clicking a different header
// switches the active sort key and resets to ascending order.
function toggleSort(nextKey: SortKey) {
  if (sortKey.value === nextKey) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }

  sortKey.value = nextKey
  sortDirection.value = 'asc'
}

function resetFilters() {
  suppressQueryReload = true
  search.value = ''
  selectedMunicipality.value = 'all'
  selectedActivity.value = 'all'
  contactFilter.value = 'all'
  sortKey.value = 'name'
  sortDirection.value = 'asc'
  page.value = 1
  suppressQueryReload = false
}

function exportCsv() {
  const url = buildDatasetExportUrl(currentDataset.value, {
    search: search.value,
    municipality: selectedMunicipality.value,
    activity: selectedActivity.value,
    contact: contactFilter.value,
    sort: sortKey.value,
    direction: sortDirection.value,
    page: 1,
    pageSize: pageSize.value,
    locale: locale.value,
    refresh: false,
  }, locale.value)
  const link = document.createElement('a')
  link.href = url
  link.click()
}

async function loadDataset(options: { forceRefresh?: boolean } = {}) {
  loading.value = true
  errorMessage.value = ''

  try {
    const payload = await fetchDatasetLocations(currentDataset.value, {
      search: search.value,
      municipality: selectedMunicipality.value,
      activity: selectedActivity.value,
      contact: contactFilter.value,
      sort: sortKey.value,
      direction: sortDirection.value,
      page: page.value,
      pageSize: pageSize.value,
      locale: locale.value,
      refresh: options.forceRefresh,
    })

    tableLocations.value = payload.items
    mapLocations.value = payload.mapItems
    datasetMetadata.value = payload.dataset
    municipalityOptions.value = payload.municipalities
    activityOptions.value = payload.activities
    lastUpdated.value = payload.fetchedAt
    totalResults.value = payload.pagination.total
    page.value = payload.pagination.page
    pageCount.value = payload.pagination.pageCount

    if (!selectedId.value) {
      selectedId.value = payload.mapItems[0]?.id ?? null
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    errorMessage.value = message
    tableLocations.value = []
    mapLocations.value = []
    datasetMetadata.value = null
    municipalityOptions.value = []
    activityOptions.value = []
    totalResults.value = 0
    pageCount.value = 1
    selectedId.value = null
  } finally {
    loading.value = false
  }
}

function refreshDataset() {
  selectedId.value = null
  void loadDataset({ forceRefresh: true })
}

async function loadChartSummaries() {
  if (chartLoading.value || datasetSummaries.value.length) {
    return
  }

  chartLoading.value = true

  try {
    const payload = await fetchDatasetSummaries()
    datasetSummaries.value = payload.items
  } finally {
    chartLoading.value = false
  }
}

function queueChartSummaries() {
  window.setTimeout(() => {
    void loadChartSummaries()
  }, 300)
}

function scheduleDatasetReload() {
  if (searchDebounce) {
    window.clearTimeout(searchDebounce)
  }

  searchDebounce = window.setTimeout(() => {
    void loadDataset()
  }, 180)
}

function goToPage(nextPage: number) {
  const safePage = Math.min(Math.max(1, nextPage), pageCount.value)

  if (safePage === page.value) {
    return
  }

  page.value = safePage
  void loadDataset()
}

function onPageSizeChange() {
  page.value = 1
  void loadDataset()
}

function handleMapViewportChange(nextViewport: MapViewport) {
  mapViewport.value = nextViewport
}

function resetMapViewport() {
  mapViewport.value = null
  mapResetVersion.value += 1
}

function syncHeaderControlsWithViewport() {
  headerControlsOpen.value = window.innerWidth >= 768
}

watch(activeDatasetKey, () => {
  resetFilters()
  selectedId.value = null
  void loadDataset()
})

// Keep the detail panel valid after filters change. If the selected record is
// no longer visible, automatically select the first remaining result.
watch(mapLocations, (nextLocations) => {
  if (!nextLocations.length) {
    selectedId.value = null
    return
  }

  const stillVisible = nextLocations.some((location) => location.id === selectedId.value)

  if (!stillVisible) {
    selectedId.value = nextLocations[0]?.id ?? null
  }
})

watch([selectedMunicipality, selectedActivity, contactFilter, sortKey, sortDirection], () => {
  if (suppressQueryReload) {
    return
  }

  page.value = 1
  void loadDataset()
})

watch(search, () => {
  if (suppressQueryReload) {
    return
  }

  page.value = 1
  scheduleDatasetReload()
})

watch(locale, (nextLocale) => {
  document.documentElement.lang = nextLocale
  void loadDataset()
})

watch(theme, (nextTheme) => {
  applyTheme(nextTheme)
  window.localStorage.setItem('tm-theme', nextTheme)
})

watch([activeDatasetKey, search, selectedMunicipality, selectedActivity, contactFilter, sortKey, sortDirection, page, pageSize], () => {
  syncStateToUrl()
})

watch(mapViewport, () => {
  syncStateToUrl()
}, { deep: true })

// Initial load fetches the active dataset and the cross-dataset summary chart.
onMounted(() => {
  suppressUrlSync = true
  restoreStateFromUrl()
  syncHeaderControlsWithViewport()
  const storedTheme = window.localStorage.getItem('tm-theme')
  const preferredTheme = storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'

  theme.value = preferredTheme
  applyTheme(preferredTheme)
  document.documentElement.lang = locale.value
  suppressUrlSync = false
  syncStateToUrl()
  void loadDataset().finally(() => {
    queueChartSummaries()
  })
})
</script>

<template>
  <div :class="pageClass">
    <header :class="headerClass">
      <div class="flex w-full flex-col gap-2 px-4 py-2.5 sm:px-6 xl:px-8 2xl:px-10">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-baseline gap-3">
            <h1 class="text-2xl font-semibold tracking-tight sm:text-3xl xl:text-4xl" :class="headingClass">Tenerife Maps</h1>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 self-baseline py-0.5 text-[11px] font-semibold uppercase tracking-[0.24em]"
              :class="subtleClass"
              @click="toggleMobileFilters"
            >
              <span>{{ t('controls.filtersTitle') }}</span>
              <span class="transition" :class="headerControlsOpen ? 'rotate-180' : ''">▾</span>
            </button>
          </div>

          <div class="flex shrink-0 items-center gap-2">
            <label class="relative">
              <span class="sr-only">{{ t('controls.language') }}</span>
              <select
                v-model="locale"
                :class="compactControlClass"
              >
                <option value="es">ES</option>
                <option value="en">EN</option>
              </select>
              <span class="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[10px]" :class="subtleClass">▾</span>
            </label>
            <button
              type="button"
              :aria-label="theme === 'dark' ? t('controls.lightMode') : t('controls.darkMode')"
              :title="theme === 'dark' ? t('controls.lightMode') : t('controls.darkMode')"
              :class="iconButtonClass"
              @click="toggleTheme"
            >
              <svg v-if="theme === 'dark'" viewBox="0 0 24 24" aria-hidden="true" class="h-4 w-4 fill-current">
                <path d="M6.995 12C6.995 9.243 9.243 7 12 7c2.757 0 5.005 2.243 5.005 5S14.757 17 12 17c-2.757 0-5.005-2.243-5.005-5Zm13.005.75h2v-1.5h-2v1.5ZM2 12.75h2v-1.5H2v1.5ZM11.25 2v2h1.5V2h-1.5Zm0 18v2h1.5v-2h-1.5ZM5.636 4.575l1.414 1.414 1.06-1.06-1.414-1.414-1.06 1.06Zm10.254 10.254 1.414 1.414 1.06-1.06-1.414-1.414-1.06 1.06ZM15.89 5.99l1.414-1.414 1.06 1.06-1.414 1.414-1.06-1.06ZM5.636 19.425l1.414-1.414 1.06 1.06-1.414 1.414-1.06-1.06Z" />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="h-4 w-4 fill-current">
                <path d="M20.742 13.045A8.25 8.25 0 0 1 10.955 3.258a.75.75 0 0 0-.945-.945A9.75 9.75 0 1 0 21.687 13.99a.75.75 0 0 0-.945-.945Z" />
              </svg>
            </button>
            <a
              href="https://github.com/guisfus/tenerifemaps"
              target="_blank"
              rel="noreferrer"
              aria-label="Ver en GitHub"
              :class="iconButtonClass"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" class="h-4 w-4 fill-current transition group-hover:text-white">
                <path
                  d="M12 2C6.477 2 2 6.589 2 12.248c0 4.526 2.865 8.365 6.839 9.72.5.096.682-.222.682-.493 0-.243-.009-.887-.014-1.741-2.782.619-3.369-1.37-3.369-1.37-.455-1.177-1.11-1.49-1.11-1.49-.908-.636.069-.623.069-.623 1.004.072 1.532 1.063 1.532 1.063.892 1.566 2.341 1.114 2.91.852.091-.664.349-1.114.635-1.37-2.221-.259-4.556-1.14-4.556-5.073 0-1.121.39-2.038 1.029-2.756-.103-.26-.446-1.304.098-2.719 0 0 .84-.277 2.75 1.053A9.303 9.303 0 0 1 12 6.836a9.27 9.27 0 0 1 2.504.347c1.909-1.33 2.748-1.053 2.748-1.053.546 1.415.203 2.459.1 2.719.64.718 1.028 1.635 1.028 2.756 0 3.943-2.338 4.811-4.566 5.065.359.319.678.948.678 1.911 0 1.38-.012 2.492-.012 2.83 0 .274.18.594.688.492C19.138 20.608 22 16.772 22 12.248 22 6.589 17.523 2 12 2Z"
                />
              </svg>
            </a>
          </div>
        </div>

        <div :class="[headerControlsOpen ? 'grid' : 'hidden', 'gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_minmax(260px,1.1fr)_minmax(200px,0.9fr)_minmax(200px,0.9fr)_minmax(200px,0.9fr)_auto]']">
          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em]" :class="subtleClass">{{ t('controls.dataset') }}</span>
            <select
              v-model="activeDatasetKey"
              :class="controlClass"
            >
              <optgroup v-for="group in filteredDatasetGroups" :key="group.category" :label="group.label">
                <option v-for="dataset in group.datasets" :key="dataset.key" :value="dataset.key">
                  {{ getDatasetPresentation(dataset, locale).title }}
                </option>
              </optgroup>
            </select>
          </label>

          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em]" :class="subtleClass">{{ t('controls.search') }}</span>
            <input
              v-model="search"
              :placeholder="t('controls.searchPlaceholder')"
              :class="controlClass"
            />
          </label>

          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em]" :class="subtleClass">{{ t('filters.municipality') }}</span>
            <select
              v-model="selectedMunicipality"
              :class="controlClass"
            >
              <option value="all">{{ t('filters.allMunicipalities') }}</option>
              <option v-for="item in municipalityOptions" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>

          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em]" :class="subtleClass">{{ t('filters.activity') }}</span>
            <select
              v-model="selectedActivity"
              :class="controlClass"
            >
              <option value="all">{{ t('filters.allActivities') }}</option>
              <option v-for="item in activityOptions" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>

          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em]" :class="subtleClass">{{ t('filters.contact') }}</span>
            <select
              v-model="contactFilter"
              :class="controlClass"
            >
              <option value="all">{{ t('filters.allRecords') }}</option>
              <option value="withContact">{{ t('filters.withContact') }}</option>
              <option value="withoutContact">{{ t('filters.withoutContact') }}</option>
            </select>
          </label>

          <div class="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-end xl:justify-end">
            <button
              type="button"
              :class="primaryButtonClass"
              @click="refreshDataset"
            >
              {{ t('controls.refresh') }}
            </button>
            <button
              type="button"
              :class="secondaryButtonClass"
              @click="resetFilters"
            >
              {{ t('filters.reset') }}
            </button>
            <button
              type="button"
              :class="successButtonClass"
              @click="exportCsv"
            >
              {{ t('table.exportCsv') }}
            </button>
          </div>
        </div>

        <div :class="metricRowClass">
          <span class="inline-flex items-center gap-2">
            <span :class="subtleClass">{{ t('metrics.activeCategory') }}</span>
            <span class="font-medium" :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ datasetPresentation.title }}</span>
          </span>
          <span class="inline-flex items-center gap-2">
            <span :class="subtleClass">{{ t('metrics.totalLocations') }}</span>
            <span class="font-medium" :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ totalResults }}</span>
          </span>
          <span class="inline-flex items-center gap-2">
            <span :class="subtleClass">{{ t('metrics.municipalities') }}</span>
            <span class="font-medium" :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ municipalitiesCount }}</span>
          </span>
          <span class="inline-flex items-center gap-2">
            <span :class="subtleClass">{{ t('metrics.activityTypes') }}</span>
            <span class="font-medium" :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ activityCount }}</span>
          </span>
        </div>
      </div>
    </header>

    <main class="flex w-full flex-col gap-6 px-4 pb-4 pt-0 sm:px-6 xl:px-8 2xl:px-10 lg:pb-5 lg:pt-0">
      <details class="group">
        <summary class="flex cursor-pointer list-none items-center justify-between gap-4 px-1 py-2">
          <div class="flex items-center gap-3">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em]" :class="subtleClass">{{ t('insights.title') }}</p>
            <span class="text-xs" :class="mutedClass">{{ t('insights.subtitle') }}</span>
          </div>
          <span class="text-[11px] uppercase tracking-[0.22em] transition group-open:rotate-180" :class="subtleClass">▾</span>
        </summary>

        <div class="pb-3 pt-2">
          <div v-if="chartLoading && !chartItems.length" class="rounded-2xl px-4 py-8 text-center text-sm" :class="isLightTheme ? 'border border-slate-300 bg-white text-slate-500' : 'border border-white/10 bg-slate-950/35 text-slate-400'">
            {{ t('states.loading') }}
          </div>
          <BarChart v-else :items="chartItems" :empty-label="t('states.noChartData')" />
        </div>
      </details>

      <section class="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.7fr)_420px]">
        <article class="flex min-h-[760px] flex-col" :class="panelClass">
          <div class="flex flex-col gap-4 border-b px-5 py-4 sm:flex-row sm:items-end sm:justify-between" :class="isLightTheme ? 'border-slate-300/80' : 'border-white/8'">
            <div>
              <p class="text-xs uppercase tracking-[0.22em]" :class="subtleClass">{{ t('map.sectionEyebrow') }}</p>
            </div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm" :class="mutedClass">
              <div>{{ t('map.lastSync') }}: <span :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ formatDate(lastUpdated) }}</span></div>
              <div>{{ t('map.filteredResults') }}: <span :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ totalResults }}</span></div>
              <button type="button" class="text-xs font-medium transition hover:underline" :class="isLightTheme ? 'text-sky-700' : 'text-sky-300'" @click="resetMapViewport">
                {{ t('map.resetView') }}
              </button>
            </div>
          </div>

          <div class="relative flex-1">
              <div v-if="loading" class="absolute inset-0 z-10 grid place-items-center bg-slate-950/70 backdrop-blur-sm">
              <div class="px-4 py-2 text-sm" :class="isLightTheme ? 'border border-slate-300 bg-white text-slate-800' : 'border border-white/10 bg-white/10 text-slate-100'">
                {{ t('states.loading') }}
              </div>
            </div>

            <LeafletMap :locations="mapLocations" :selected-id="selectedId" :viewport="mapViewport" :layout-version="headerControlsOpen ? 1 : 0" :reset-version="mapResetVersion" @select="selectedId = $event" @viewport-change="handleMapViewportChange" />
          </div>
        </article>

        <aside class="space-y-6">
          <article class="border-t p-5" :class="isLightTheme ? 'border-slate-300/80' : 'border-white/8'">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs uppercase tracking-[0.22em]" :class="subtleClass">{{ t('metadata.title') }}</p>
                <h2 class="mt-2 text-2xl font-semibold" :class="headingClass">{{ datasetMetadata?.title || datasetPresentation.title }}</h2>
              </div>
              <span class="text-xs uppercase tracking-[0.22em]" :class="subtleClass">{{ getDatasetCategoryLabel(currentDataset.category, locale) }}</span>
            </div>

            <p class="mt-4 text-sm leading-6" :class="mutedClass">{{ datasetMetadata?.description || datasetPresentation.description }}</p>

            <dl class="mt-4 grid gap-3 text-sm">
              <div :class="cardClass">
                <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('metadata.source') }}</dt>
                <dd class="mt-1" :class="headingClass">{{ datasetMetadata?.source || 'datos.tenerife.es' }}</dd>
              </div>
              <div :class="cardClass">
                <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('metadata.updatedAt') }}</dt>
                <dd class="mt-1" :class="headingClass">{{ formatDate(datasetMetadata?.updatedAt || lastUpdated) }}</dd>
              </div>
              <div :class="cardClass">
                <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('metadata.license') }}</dt>
                <dd class="mt-1" :class="headingClass">{{ formatText(datasetMetadata?.license || '') }}</dd>
              </div>
              <div :class="cardClass">
                <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('metadata.originalLink') }}</dt>
                <dd class="mt-1 break-all text-sm">
                  <a
                    v-if="safeExternalLink(datasetMetadata?.originalUrl || currentDataset.url)"
                    :href="safeExternalLink(datasetMetadata?.originalUrl || currentDataset.url)"
                    target="_blank"
                    rel="noreferrer"
                    class="transition hover:underline"
                    :class="isLightTheme ? 'text-sky-700' : 'text-sky-300'"
                  >
                    {{ safeExternalLink(datasetMetadata?.originalUrl || currentDataset.url) }}
                  </a>
                  <span v-else>{{ formatText('') }}</span>
                </dd>
              </div>
            </dl>

            <div v-if="mapLegend" class="mt-4 rounded-xl border px-4 py-3" :class="isLightTheme ? 'border-slate-300 bg-white/80' : 'border-white/10 bg-slate-950/30'">
              <p class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('metadata.legend') }}</p>
              <div class="mt-3 flex items-center gap-3 text-sm">
                <span class="tm-marker" />
                <div>
                  <div :class="headingClass">{{ mapLegend.geometryType }}</div>
                  <div :class="mutedClass">{{ mapLegend.label }}</div>
                </div>
              </div>
            </div>
          </article>

          <article class="overflow-hidden rounded-xl border p-5" :class="isLightTheme ? 'border-slate-300/80 bg-white/35' : 'border-white/8 bg-white/[0.02]'">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs uppercase tracking-[0.22em]" :class="subtleClass">{{ t('details.title') }}</p>
              <span v-if="hasActiveFilters" class="text-xs text-sky-300">{{ t('filters.active') }}</span>
            </div>

            <div v-if="selectedLocation" class="mt-4 space-y-4">
              <div>
                <h3 class="text-2xl font-semibold" :class="headingClass">{{ selectedLocation.name }}</h3>
                <p class="mt-1 text-sm" :class="mutedClass">{{ formatText(selectedLocation.activityType) }}</p>
              </div>

              <dl class="grid gap-3 text-sm text-slate-300">
                <div :class="cardClass">
                  <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('details.municipality') }}</dt>
                  <dd class="mt-1 text-base" :class="headingClass">{{ formatText(selectedLocation.municipality) }}</dd>
                </div>
                <div :class="cardClass">
                  <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('details.address') }}</dt>
                  <dd class="mt-1 text-base" :class="headingClass">{{ formatText(selectedLocation.address) }}</dd>
                </div>
                <div :class="cardClass">
                  <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('details.reference') }}</dt>
                  <dd class="mt-1 text-base" :class="headingClass">{{ formatText(selectedLocation.reference) }}</dd>
                </div>
                <div :class="cardClass">
                  <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('table.columns.contact') }}</dt>
                  <dd class="mt-1 text-base" :class="headingClass">{{ formatText(selectedLocation.phone) }}</dd>
                  <dd class="mt-1 text-sm" :class="mutedClass">
                    <a
                      v-if="selectedLocation.email"
                      :href="`mailto:${selectedLocation.email}`"
                      class="transition hover:underline"
                      :class="isLightTheme ? 'text-sky-700' : 'text-sky-300'"
                    >
                      {{ selectedLocation.email }}
                    </a>
                    <span v-else>{{ formatText(selectedLocation.email) }}</span>
                  </dd>
                </div>
                <div v-if="safeExternalLink(selectedLocation.website)" :class="cardClass">
                  <dt class="text-xs uppercase tracking-[0.18em]" :class="subtleClass">{{ t('details.website') }}</dt>
                  <dd class="mt-1 break-all text-sm">
                    <a
                      :href="safeExternalLink(selectedLocation.website)"
                      target="_blank"
                      rel="noreferrer"
                      class="transition hover:underline"
                      :class="isLightTheme ? 'text-sky-700' : 'text-sky-300'"
                    >
                      {{ safeExternalLink(selectedLocation.website) }}
                    </a>
                  </dd>
                </div>
              </dl>
            </div>

            <p v-else class="mt-4 text-sm" :class="mutedClass">{{ t('details.empty') }}</p>
          </article>
        </aside>
      </section>

      <section :class="panelClass">
        <div class="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end sm:justify-between" :class="isLightTheme ? 'border-b border-slate-300/80' : 'border-b border-white/8'">
          <div>
            <p class="text-xs uppercase tracking-[0.22em]" :class="subtleClass">{{ t('table.title') }}</p>
            <h2 class="mt-2 text-2xl font-semibold" :class="headingClass">{{ t('table.subtitle') }}</h2>
            <p class="mt-2 text-sm" :class="mutedClass">{{ t('table.description') }}</p>
          </div>

          <div class="text-sm" :class="mutedClass">
            <span v-if="errorMessage" class="text-rose-300">{{ errorMessage }}</span>
            <span v-else>{{ t('table.visibleResults', { count: totalResults, from: currentRangeStart, to: currentRangeEnd }) }}</span>
          </div>
        </div>

        <div class="divide-y divide-white/8 lg:hidden">
          <article
            v-for="location in tableLocations"
            :key="location.id"
            class="cursor-pointer space-y-4 border-l-4 px-5 py-5 transition"
            :class="location.id === selectedId ? 'border-l-sky-400 bg-sky-400/14' : 'border-l-transparent odd:bg-white/[0.06] even:bg-slate-950/34'"
            @click="selectedId = location.id"
          >
            <div class="space-y-1">
              <h3 class="text-base font-semibold text-white">{{ location.name }}</h3>
              <p class="text-sm text-slate-400">{{ formatText(location.activityType) }}</p>
            </div>

            <dl class="grid gap-3 text-sm text-slate-300">
              <div class="rounded-sm bg-black/10 px-3 py-2">
                <dt class="text-[11px] uppercase tracking-[0.18em] text-slate-500">{{ t('table.columns.municipality') }}</dt>
                <dd class="mt-1 text-white">{{ formatText(location.municipality) }}</dd>
              </div>
              <div class="rounded-sm bg-black/10 px-3 py-2">
                <dt class="text-[11px] uppercase tracking-[0.18em] text-slate-500">{{ t('filters.activity') }}</dt>
                <dd class="mt-1 text-white">{{ formatText(location.activityType) }}</dd>
              </div>
              <div class="rounded-sm bg-black/10 px-3 py-2">
                <dt class="text-[11px] uppercase tracking-[0.18em] text-slate-500">{{ t('table.columns.address') }}</dt>
                <dd class="mt-1 text-white">{{ formatText(location.address) }}</dd>
              </div>
              <div class="rounded-sm bg-black/10 px-3 py-2">
                <dt class="text-[11px] uppercase tracking-[0.18em] text-slate-500">{{ t('table.columns.reference') }}</dt>
                <dd class="mt-1 text-white">{{ formatText(location.reference) }}</dd>
              </div>
              <div class="rounded-sm bg-black/10 px-3 py-2">
                <dt class="text-[11px] uppercase tracking-[0.18em] text-slate-500">{{ t('table.columns.contact') }}</dt>
                <dd class="mt-1 text-white">{{ formatText(location.phone) }}</dd>
                <dd class="mt-1 text-slate-400">{{ formatText(location.email) }}</dd>
              </div>
              <div v-if="safeExternalLink(location.website)" class="rounded-sm bg-black/10 px-3 py-2">
                <dt class="text-[11px] uppercase tracking-[0.18em] text-slate-500">{{ t('details.website') }}</dt>
                <dd class="mt-1 break-all">
                  <a
                    :href="safeExternalLink(location.website)"
                    target="_blank"
                    rel="noreferrer"
                    class="transition hover:underline"
                    :class="isLightTheme ? 'text-sky-700' : 'text-sky-300'"
                  >
                    {{ safeExternalLink(location.website) }}
                  </a>
                </dd>
              </div>
            </dl>
          </article>

          <div v-if="!tableLocations.length" class="px-5 py-8 text-center" :class="mutedClass">
            {{ t('states.noResults') }}
          </div>
        </div>

        <div class="hidden lg:block">
          <table class="min-w-full divide-y divide-white/8 text-left text-sm">
            <thead :class="tableHeaderClass">
              <tr>
                <th class="px-5 py-4"><button type="button" class="cursor-pointer" @click="toggleSort('name')">{{ t('table.columns.name') }}</button></th>
                <th class="px-5 py-4"><button type="button" class="cursor-pointer" @click="toggleSort('municipality')">{{ t('table.columns.municipality') }}</button></th>
                <th class="px-5 py-4"><button type="button" class="cursor-pointer" @click="toggleSort('activityType')">{{ t('filters.activity') }}</button></th>
                <th class="px-5 py-4">{{ t('table.columns.address') }}</th>
                <th class="px-5 py-4">{{ t('table.columns.reference') }}</th>
                <th class="px-5 py-4">{{ t('table.columns.contact') }}</th>
                <th class="px-5 py-4">{{ t('details.website') }}</th>
              </tr>
            </thead>
            <tbody :class="tableBodyClass">
              <tr
                v-for="location in tableLocations"
                :key="location.id"
                class="cursor-pointer border-l-2 border-transparent transition hover:bg-white/5"
                :class="location.id === selectedId ? 'border-l-sky-400 bg-sky-400/10' : 'odd:bg-white/[0.02] even:bg-slate-950/18'"
                @click="selectedId = location.id"
              >
                <td class="px-5 py-4 align-top">
                  <div class="font-medium" :class="headingClass">{{ location.name }}</div>
                </td>
                <td class="px-5 py-4 align-top">{{ formatText(location.municipality) }}</td>
                <td class="px-5 py-4 align-top">{{ formatText(location.activityType) }}</td>
                <td class="px-5 py-4 align-top">{{ formatText(location.address) }}</td>
                <td class="px-5 py-4 align-top">{{ formatText(location.reference) }}</td>
                 <td class="px-5 py-4 align-top" :class="mutedClass">
                  <div>{{ formatText(location.phone) }}</div>
                  <div>{{ formatText(location.email) }}</div>
                </td>
                <td class="px-5 py-4 align-top">
                  <a
                    v-if="safeExternalLink(location.website)"
                    :href="safeExternalLink(location.website)"
                    target="_blank"
                    rel="noreferrer"
                    class="break-all transition hover:underline"
                    :class="isLightTheme ? 'text-sky-700' : 'text-sky-300'"
                  >
                    {{ safeExternalLink(location.website) }}
                  </a>
                  <span v-else :class="mutedClass">{{ formatText(location.website) }}</span>
                </td>
              </tr>
              <tr v-if="!tableLocations.length">
                <td colspan="7" class="px-5 py-8 text-center" :class="mutedClass">{{ t('states.noResults') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between" :class="isLightTheme ? 'border-slate-300/80' : 'border-white/8'">
          <div class="text-sm" :class="mutedClass">
            {{ t('table.pageStatus', { page, pageCount, total: totalResults }) }}
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label class="flex items-center gap-3 text-sm" :class="mutedClass">
              <span>{{ t('table.rowsPerPage') }}</span>
              <select v-model="pageSize" :class="compactControlClass" @change="onPageSizeChange">
                <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
              </select>
            </label>

            <div class="flex items-center gap-2">
              <button type="button" :class="secondaryButtonClass" :disabled="page <= 1" @click="goToPage(page - 1)">
                {{ t('table.previousPage') }}
              </button>
              <button type="button" :class="secondaryButtonClass" :disabled="page >= pageCount" @click="goToPage(page + 1)">
                {{ t('table.nextPage') }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
