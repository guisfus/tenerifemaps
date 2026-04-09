<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BarChart from './components/BarChart.vue'
import LeafletMap from './components/LeafletMap.vue'
import { DATASETS, getDatasetPresentation } from './data/datasets'
import { fetchDatasetLocations } from './services/geojson'
import type { DatasetSummary, LocationRecord, SortKey } from './types'

type ContactFilter = 'all' | 'withContact' | 'withoutContact'
type ThemeMode = 'dark' | 'light'

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
const locations = ref<LocationRecord[]>([])
const datasetSummaries = ref<DatasetSummary[]>([])
const sortKey = ref<SortKey>('name')
const sortDirection = ref<'asc' | 'desc'>('asc')
const theme = ref<ThemeMode>('dark')

// Dataset metadata is stored separately from loaded records so the same UI can
// switch sources without changing the rendering logic.
const currentDataset = computed(() => DATASETS.find((dataset) => dataset.key === activeDatasetKey.value) ?? DATASETS[0])
const datasetPresentation = computed(() => getDatasetPresentation(currentDataset.value, locale.value))

const municipalityOptions = computed(() => [...new Set(locations.value.map((item) => item.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale.value)))
const activityOptions = computed(() => [...new Set(locations.value.map((item) => item.activityType).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale.value)))
const hasActiveFilters = computed(() => search.value || selectedMunicipality.value !== 'all' || selectedActivity.value !== 'all' || contactFilter.value !== 'all')

// Filtering and sorting live in a single computed value so every visual block
// reads the same consistent subset of locations.
const filteredLocations = computed(() => {
  const query = search.value.trim().toLowerCase()

  const result = locations.value.filter((location) => {
    if (selectedMunicipality.value !== 'all' && location.municipality !== selectedMunicipality.value) {
      return false
    }

    if (selectedActivity.value !== 'all' && location.activityType !== selectedActivity.value) {
      return false
    }

    const hasContact = Boolean(location.phone || location.email || location.website)

    if (contactFilter.value === 'withContact' && !hasContact) {
      return false
    }

    if (contactFilter.value === 'withoutContact' && hasContact) {
      return false
    }

    if (!query) {
      return true
    }

    return [location.name, location.municipality, location.address, location.reference, location.activityType]
      .join(' ')
      .toLowerCase()
      .includes(query)
  })

  return [...result].sort((a, b) => {
    const left = (a[sortKey.value] ?? '').toString().toLowerCase()
    const right = (b[sortKey.value] ?? '').toString().toLowerCase()
    const order = left.localeCompare(right, locale.value)

    return sortDirection.value === 'asc' ? order : -order
  })
})

const selectedLocation = computed(() => filteredLocations.value.find((location) => location.id === selectedId.value) ?? null)
const municipalitiesCount = computed(() => new Set(filteredLocations.value.map((item) => item.municipality).filter(Boolean)).size)
const activityCount = computed(() => new Set(filteredLocations.value.map((item) => item.activityType).filter(Boolean)).size)
const isLightTheme = computed(() => theme.value === 'light')
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
const accentLabelClass = computed(() => (isLightTheme.value ? 'text-emerald-700/90' : 'text-emerald-300/90'))
const controlClass = computed(() =>
  isLightTheme.value
    ? 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500/60'
    : 'w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60',
)
const compactControlClass = computed(() =>
  isLightTheme.value
    ? 'min-w-[78px] appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-7 text-xs font-medium text-slate-900 outline-none transition focus:border-sky-500/60'
    : 'min-w-[78px] appearance-none rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 pr-7 text-xs font-medium text-white outline-none transition focus:border-sky-400/60',
)
const iconButtonClass = computed(() =>
  isLightTheme.value
    ? 'group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-sky-400/40 hover:text-sky-700'
    : 'group inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-400/25 bg-linear-to-r from-sky-400/14 via-cyan-400/10 to-emerald-400/14 text-sky-100 transition hover:border-sky-300/40 hover:from-sky-400/22 hover:to-emerald-400/22',
)
const primaryButtonClass = computed(() =>
  isLightTheme.value
    ? 'rounded-xl border border-sky-300 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800 transition hover:bg-sky-100'
    : 'rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-sm font-medium text-sky-100 transition hover:bg-sky-400/20',
)
const secondaryButtonClass = computed(() =>
  isLightTheme.value
    ? 'rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition hover:bg-slate-100'
    : 'rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10',
)
const successButtonClass = computed(() =>
  isLightTheme.value
    ? 'rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100'
    : 'rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20',
)
const metricRowClass = computed(() =>
  isLightTheme.value ? 'flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-300 pt-2 text-[11px] text-slate-600' : 'flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/8 pt-2 text-[11px] text-slate-400',
)
const panelClass = computed(() => (isLightTheme.value ? 'border-y border-slate-300/80 bg-transparent' : 'border-y border-white/8 bg-transparent'))
const panelHeaderClass = computed(() => (isLightTheme.value ? 'border-b border-slate-300/80 px-5 py-4' : 'border-b border-white/8 px-5 py-4'))
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

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
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
  search.value = ''
  selectedMunicipality.value = 'all'
  selectedActivity.value = 'all'
  contactFilter.value = 'all'
}

// CSV export reuses the current filtered subset so the downloaded file always
// matches what the user is looking at on screen.
function escapeCsv(value: string) {
  const normalized = String(value ?? '')
  return `"${normalized.replaceAll('"', '""')}"`
}

function exportCsv() {
  const headers = [
    t('table.columns.name'),
    t('table.columns.municipality'),
    t('table.columns.address'),
    t('table.columns.reference'),
    t('table.columns.contact'),
    t('details.website'),
  ]

  const lines = filteredLocations.value.map((item) => [
    item.name,
    item.municipality,
    item.address,
    item.reference,
    [item.phone, item.email].filter(Boolean).join(' / '),
    item.website,
  ])

  const csv = [headers, ...lines].map((row) => row.map(escapeCsv).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${activeDatasetKey.value}-${locale.value}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function loadDataset() {
  loading.value = true
  errorMessage.value = ''

  try {
    // Records are normalized inside the service layer, so the component only
    // consumes a clean typed structure.
    const records = await fetchDatasetLocations(currentDataset.value)
    locations.value = records
    resetFilters()
    selectedId.value = records[0]?.id ?? null
    lastUpdated.value = new Date().toISOString()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    errorMessage.value = message
    locations.value = []
    selectedId.value = null
  } finally {
    loading.value = false
  }
}

// The side chart compares the full volume of every configured dataset. This is
// loaded once on startup and then served from the service cache.
async function loadChartSummaries() {
  if (chartLoading.value || datasetSummaries.value.length) {
    return
  }

  chartLoading.value = true

  try {
    datasetSummaries.value = await Promise.all(
      DATASETS.map(async (dataset) => {
        const records = await fetchDatasetLocations(dataset)

        return {
          key: dataset.key,
          dataset,
          count: records.length,
        } satisfies DatasetSummary
      }),
    )
  } finally {
    chartLoading.value = false
  }
}

function queueChartSummaries() {
  window.setTimeout(() => {
    void loadChartSummaries()
  }, 300)
}

watch(activeDatasetKey, () => {
  void loadDataset()
})

// Keep the detail panel valid after filters change. If the selected record is
// no longer visible, automatically select the first remaining result.
watch(filteredLocations, (nextLocations) => {
  if (!nextLocations.length) {
    selectedId.value = null
    return
  }

  const stillVisible = nextLocations.some((location) => location.id === selectedId.value)

  if (!stillVisible) {
    selectedId.value = nextLocations[0]?.id ?? null
  }
})

watch(locale, (nextLocale) => {
  document.documentElement.lang = nextLocale
})

watch(theme, (nextTheme) => {
  applyTheme(nextTheme)
  window.localStorage.setItem('tm-theme', nextTheme)
})

// Initial load fetches the active dataset and the cross-dataset summary chart.
onMounted(() => {
  const storedTheme = window.localStorage.getItem('tm-theme')
  const preferredTheme = storedTheme === 'light' || storedTheme === 'dark'
    ? storedTheme
    : window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'

  theme.value = preferredTheme
  applyTheme(preferredTheme)
  document.documentElement.lang = locale.value
  void loadDataset().finally(() => {
    queueChartSummaries()
  })
})
</script>

<template>
  <div :class="pageClass">
    <header :class="headerClass">
      <div class="flex w-full flex-col gap-4 px-4 py-5 sm:px-6 xl:px-8 2xl:px-10">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-3">
            <div class="flex items-center gap-3">
              <div class="h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.75)]" />
              <p class="text-xs font-semibold uppercase tracking-[0.32em]" :class="accentLabelClass">Open data explorer</p>
            </div>
            <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl xl:text-5xl" :class="headingClass">Tenerife Maps</h1>
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

        <p class="max-w-2xl text-sm leading-6 sm:text-base" :class="mutedClass">
          Visualiza datasets georreferenciados de Tenerife con un mapa interactivo, filtros potentes y una experiencia bilingue.
        </p>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_minmax(260px,1.1fr)_minmax(200px,0.9fr)_minmax(200px,0.9fr)_minmax(200px,0.9fr)_auto]">
          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em]" :class="subtleClass">{{ t('controls.dataset') }}</span>
            <select
              v-model="activeDatasetKey"
              :class="controlClass"
            >
              <option v-for="dataset in DATASETS" :key="dataset.key" :value="dataset.key">
                {{ getDatasetPresentation(dataset, locale).title }}
              </option>
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

          <div class="min-w-0 flex flex-col gap-3 sm:flex-row sm:items-end xl:justify-end">
            <button
              type="button"
              :class="primaryButtonClass"
              @click="loadDataset"
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
            <span class="font-medium" :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ filteredLocations.length }}</span>
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

    <main class="flex w-full flex-col gap-6 px-4 py-4 sm:px-6 xl:px-8 2xl:px-10 lg:py-5">
      <section class="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.7fr)_420px]">
        <article class="flex min-h-[760px] flex-col" :class="panelClass">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" :class="panelHeaderClass">
            <div>
              <p class="text-xs uppercase tracking-[0.22em]" :class="subtleClass">{{ t('map.sectionEyebrow') }}</p>
              <h2 class="mt-2 text-2xl font-semibold" :class="headingClass">{{ datasetPresentation.title }}</h2>
              <p class="mt-2 max-w-3xl text-sm leading-6" :class="mutedClass">{{ datasetPresentation.description }}</p>
            </div>
            <div class="text-sm" :class="mutedClass">
              <div>{{ t('map.lastSync') }}: <span :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ formatDate(lastUpdated) }}</span></div>
              <div>{{ t('map.filteredResults') }}: <span :class="isLightTheme ? 'text-slate-800' : 'text-slate-200'">{{ filteredLocations.length }}</span></div>
            </div>
          </div>

          <div class="relative flex-1">
              <div v-if="loading" class="absolute inset-0 z-10 grid place-items-center bg-slate-950/70 backdrop-blur-sm">
              <div class="px-4 py-2 text-sm" :class="isLightTheme ? 'border border-slate-300 bg-white text-slate-800' : 'border border-white/10 bg-white/10 text-slate-100'">
                {{ t('states.loading') }}
              </div>
            </div>

            <LeafletMap :locations="filteredLocations" :selected-id="selectedId" @select="selectedId = $event" />
          </div>
        </article>

        <aside class="space-y-6">
          <article class="p-5" :class="panelClass">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs uppercase tracking-[0.22em]" :class="subtleClass">{{ t('insights.title') }}</p>
                <h2 class="mt-2 text-2xl font-semibold" :class="headingClass">{{ t('insights.subtitle') }}</h2>
              </div>
              <span class="text-xs uppercase tracking-[0.22em]" :class="subtleClass">
                {{ chartLoading ? t('states.loading') : t('insights.ready') }}
              </span>
            </div>
            <div v-if="chartLoading && !chartItems.length" class="mt-5 rounded-2xl px-4 py-8 text-center text-sm" :class="isLightTheme ? 'border border-slate-300 bg-white text-slate-500' : 'border border-white/10 bg-slate-950/35 text-slate-400'">
              {{ t('states.loading') }}
            </div>
            <BarChart v-else :items="chartItems" :empty-label="t('states.noChartData')" />
          </article>

          <article class="p-5" :class="panelClass">
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
                  <dd class="mt-1 text-sm" :class="mutedClass">{{ formatText(selectedLocation.email) }}</dd>
                </div>
              </dl>

              <div class="grid gap-3 sm:grid-cols-2">
                <a
                  v-if="selectedLocation.website"
                  :href="selectedLocation.website"
                  target="_blank"
                  rel="noreferrer"
                 :class="primaryButtonClass"
                >
                  {{ t('details.openWebsite') }}
                </a>
                <a
                  v-if="selectedLocation.email"
                  :href="`mailto:${selectedLocation.email}`"
                  :class="secondaryButtonClass"
                >
                  {{ t('details.sendEmail') }}
                </a>
              </div>
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
            <span v-else>{{ t('table.visibleResults', { count: filteredLocations.length }) }}</span>
          </div>
        </div>

        <div class="divide-y divide-white/8 lg:hidden">
          <article
            v-for="location in filteredLocations"
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
            </dl>
          </article>

          <div v-if="!filteredLocations.length" class="px-5 py-8 text-center" :class="mutedClass">
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
              </tr>
            </thead>
            <tbody :class="tableBodyClass">
              <tr
                v-for="location in filteredLocations"
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
              </tr>
              <tr v-if="!filteredLocations.length">
                <td colspan="6" class="px-5 py-8 text-center" :class="mutedClass">{{ t('states.noResults') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>
