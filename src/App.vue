<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BarChart from './components/BarChart.vue'
import LeafletMap from './components/LeafletMap.vue'
import { DATASETS, getDatasetPresentation } from './data/datasets'
import { fetchDatasetLocations } from './services/geojson'
import type { DatasetSummary, LocationRecord, SortKey } from './types'

type ContactFilter = 'all' | 'withContact' | 'withoutContact'

const { t, locale } = useI18n()

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

const currentDataset = computed(() => DATASETS.find((dataset) => dataset.key === activeDatasetKey.value) ?? DATASETS[0])
const datasetPresentation = computed(() => getDatasetPresentation(currentDataset.value, locale.value))

const municipalityOptions = computed(() => [...new Set(locations.value.map((item) => item.municipality).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale.value)))
const activityOptions = computed(() => [...new Set(locations.value.map((item) => item.activityType).filter(Boolean))].sort((a, b) => a.localeCompare(b, locale.value)))
const hasActiveFilters = computed(() => search.value || selectedMunicipality.value !== 'all' || selectedActivity.value !== 'all' || contactFilter.value !== 'all')

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
const chartItems = computed(() =>
  datasetSummaries.value.map((item) => ({
    key: item.key,
    label: getDatasetPresentation(item.dataset, locale.value).title,
    value: item.count,
  })),
)

function formatDate(date: string) {
  if (!date) {
    return '--'
  }

  return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
}

function formatText(value: string) {
  return value || '—'
}

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

async function loadChartSummaries() {
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

watch(activeDatasetKey, () => {
  void loadDataset()
})

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

onMounted(() => {
  document.documentElement.lang = locale.value
  void loadDataset()
  void loadChartSummaries()
})
</script>

<template>
  <div class="min-h-screen text-slate-100">
    <header class="border-b border-white/8 bg-slate-950/40 backdrop-blur-xl">
      <div class="flex w-full flex-col gap-8 px-4 py-5 sm:px-6 xl:px-8 2xl:px-10">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <div class="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.75)]" />
            <p class="text-sm font-semibold uppercase tracking-[0.28em] text-slate-100">Tenerife Maps</p>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label class="min-w-[150px]">
              <span class="sr-only">{{ t('controls.language') }}</span>
              <select
                v-model="locale"
                class="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
            </label>
            <button
              type="button"
              class="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
              @click="loadDataset"
            >
              {{ t('controls.refresh') }}
            </button>
          </div>
        </div>

        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_minmax(260px,1.1fr)_minmax(200px,0.9fr)_minmax(200px,0.9fr)_minmax(200px,0.9fr)_auto]">
          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{{ t('controls.dataset') }}</span>
            <select
              v-model="activeDatasetKey"
              class="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60"
            >
              <option v-for="dataset in DATASETS" :key="dataset.key" :value="dataset.key">
                {{ getDatasetPresentation(dataset, locale).title }}
              </option>
            </select>
          </label>

          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{{ t('controls.search') }}</span>
            <input
              v-model="search"
              :placeholder="t('controls.searchPlaceholder')"
              class="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-sky-400/60"
            />
          </label>

          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{{ t('filters.municipality') }}</span>
            <select
              v-model="selectedMunicipality"
              class="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60"
            >
              <option value="all">{{ t('filters.allMunicipalities') }}</option>
              <option v-for="item in municipalityOptions" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>

          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{{ t('filters.activity') }}</span>
            <select
              v-model="selectedActivity"
              class="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60"
            >
              <option value="all">{{ t('filters.allActivities') }}</option>
              <option v-for="item in activityOptions" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>

          <label class="min-w-0 space-y-2">
            <span class="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">{{ t('filters.contact') }}</span>
            <select
              v-model="contactFilter"
              class="w-full rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/60"
            >
              <option value="all">{{ t('filters.allRecords') }}</option>
              <option value="withContact">{{ t('filters.withContact') }}</option>
              <option value="withoutContact">{{ t('filters.withoutContact') }}</option>
            </select>
          </label>

          <div class="min-w-0 flex flex-col gap-3 sm:flex-row sm:items-end xl:justify-end">
            <button
              type="button"
              class="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:bg-white/10"
              @click="resetFilters"
            >
              {{ t('filters.reset') }}
            </button>
            <button
              type="button"
              class="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/20"
              @click="exportCsv"
            >
              {{ t('table.exportCsv') }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="flex w-full flex-col gap-8 px-4 py-6 sm:px-6 xl:px-8 2xl:px-10 lg:py-8">
      <section class="grid gap-px overflow-hidden border-y border-white/8 bg-white/8 md:grid-cols-2 xl:grid-cols-4">
        <article class="bg-transparent px-5 py-5 backdrop-blur-sm">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-500">{{ t('metrics.activeCategory') }}</p>
          <p class="mt-3 text-2xl font-semibold text-white">{{ datasetPresentation.title }}</p>
        </article>
        <article class="bg-transparent px-5 py-5 backdrop-blur-sm">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-500">{{ t('metrics.totalLocations') }}</p>
          <p class="mt-3 text-4xl font-semibold text-white">{{ filteredLocations.length }}</p>
        </article>
        <article class="bg-transparent px-5 py-5 backdrop-blur-sm">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-500">{{ t('metrics.municipalities') }}</p>
          <p class="mt-3 text-4xl font-semibold text-white">{{ municipalitiesCount }}</p>
        </article>
        <article class="bg-transparent px-5 py-5 backdrop-blur-sm">
          <p class="text-xs uppercase tracking-[0.22em] text-slate-500">{{ t('metrics.activityTypes') }}</p>
          <p class="mt-3 text-4xl font-semibold text-white">{{ activityCount }}</p>
        </article>
      </section>

      <section class="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.7fr)_420px]">
        <article class="flex min-h-[760px] flex-col border-y border-white/8 bg-transparent">
          <div class="flex flex-col gap-4 border-b border-white/8 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.22em] text-slate-500">{{ t('map.sectionEyebrow') }}</p>
              <h2 class="mt-2 text-2xl font-semibold text-white">{{ datasetPresentation.title }}</h2>
              <p class="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{{ datasetPresentation.description }}</p>
            </div>
            <div class="text-sm text-slate-400">
              <div>{{ t('map.lastSync') }}: <span class="text-slate-200">{{ formatDate(lastUpdated) }}</span></div>
              <div>{{ t('map.filteredResults') }}: <span class="text-slate-200">{{ filteredLocations.length }}</span></div>
            </div>
          </div>

          <div class="relative flex-1">
            <div v-if="loading" class="absolute inset-0 z-10 grid place-items-center bg-slate-950/70 backdrop-blur-sm">
              <div class="border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100">
                {{ t('states.loading') }}
              </div>
            </div>

            <LeafletMap :locations="filteredLocations" :selected-id="selectedId" @select="selectedId = $event" />
          </div>
        </article>

        <aside class="space-y-6">
          <article class="border-y border-white/8 bg-transparent p-5">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs uppercase tracking-[0.22em] text-slate-500">{{ t('insights.title') }}</p>
                <h2 class="mt-2 text-2xl font-semibold text-white">{{ t('insights.subtitle') }}</h2>
              </div>
              <span class="text-xs uppercase tracking-[0.22em] text-slate-500">
                {{ chartLoading ? t('states.loading') : t('insights.ready') }}
              </span>
            </div>
            <BarChart :items="chartItems" :empty-label="t('states.noChartData')" />
          </article>

          <article class="border-y border-white/8 bg-transparent p-5">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs uppercase tracking-[0.22em] text-slate-500">{{ t('details.title') }}</p>
              <span v-if="hasActiveFilters" class="text-xs text-sky-300">{{ t('filters.active') }}</span>
            </div>

            <div v-if="selectedLocation" class="mt-4 space-y-4">
              <div>
                <h3 class="text-2xl font-semibold text-white">{{ selectedLocation.name }}</h3>
                <p class="mt-1 text-sm text-slate-400">{{ formatText(selectedLocation.activityType) }}</p>
              </div>

              <dl class="grid gap-3 text-sm text-slate-300">
                <div class="border border-white/8 bg-slate-950/35 p-3">
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ t('details.municipality') }}</dt>
                  <dd class="mt-1 text-base text-white">{{ formatText(selectedLocation.municipality) }}</dd>
                </div>
                <div class="border border-white/8 bg-slate-950/35 p-3">
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ t('details.address') }}</dt>
                  <dd class="mt-1 text-base text-white">{{ formatText(selectedLocation.address) }}</dd>
                </div>
                <div class="border border-white/8 bg-slate-950/35 p-3">
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ t('details.reference') }}</dt>
                  <dd class="mt-1 text-base text-white">{{ formatText(selectedLocation.reference) }}</dd>
                </div>
                <div class="border border-white/8 bg-slate-950/35 p-3">
                  <dt class="text-xs uppercase tracking-[0.18em] text-slate-500">{{ t('table.columns.contact') }}</dt>
                  <dd class="mt-1 text-base text-white">{{ formatText(selectedLocation.phone) }}</dd>
                  <dd class="mt-1 text-sm text-slate-400">{{ formatText(selectedLocation.email) }}</dd>
                </div>
              </dl>

              <div class="grid gap-3 sm:grid-cols-2">
                <a
                  v-if="selectedLocation.website"
                  :href="selectedLocation.website"
                  target="_blank"
                  rel="noreferrer"
                  class="border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-center text-sm font-medium text-sky-100 transition hover:bg-sky-400/20"
                >
                  {{ t('details.openWebsite') }}
                </a>
                <a
                  v-if="selectedLocation.email"
                  :href="`mailto:${selectedLocation.email}`"
                  class="border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
                >
                  {{ t('details.sendEmail') }}
                </a>
              </div>
            </div>

            <p v-else class="mt-4 text-sm text-slate-400">{{ t('details.empty') }}</p>
          </article>
        </aside>
      </section>

      <section class="border-y border-white/8 bg-transparent">
        <div class="flex flex-col gap-3 border-b border-white/8 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-xs uppercase tracking-[0.22em] text-slate-500">{{ t('table.title') }}</p>
            <h2 class="mt-2 text-2xl font-semibold text-white">{{ t('table.subtitle') }}</h2>
            <p class="mt-2 text-sm text-slate-400">{{ t('table.description') }}</p>
          </div>

          <div class="text-sm text-slate-400">
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

          <div v-if="!filteredLocations.length" class="px-5 py-8 text-center text-slate-400">
            {{ t('states.noResults') }}
          </div>
        </div>

        <div class="hidden lg:block">
          <table class="min-w-full divide-y divide-white/8 text-left text-sm">
            <thead class="bg-slate-950/35 text-xs uppercase tracking-[0.18em] text-slate-400">
              <tr>
                <th class="px-5 py-4"><button type="button" class="cursor-pointer" @click="toggleSort('name')">{{ t('table.columns.name') }}</button></th>
                <th class="px-5 py-4"><button type="button" class="cursor-pointer" @click="toggleSort('municipality')">{{ t('table.columns.municipality') }}</button></th>
                <th class="px-5 py-4"><button type="button" class="cursor-pointer" @click="toggleSort('activityType')">{{ t('filters.activity') }}</button></th>
                <th class="px-5 py-4">{{ t('table.columns.address') }}</th>
                <th class="px-5 py-4">{{ t('table.columns.reference') }}</th>
                <th class="px-5 py-4">{{ t('table.columns.contact') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5 text-slate-200">
              <tr
                v-for="location in filteredLocations"
                :key="location.id"
                class="cursor-pointer border-l-2 border-transparent transition hover:bg-white/5"
                :class="location.id === selectedId ? 'border-l-sky-400 bg-sky-400/10' : 'odd:bg-white/[0.02] even:bg-slate-950/18'"
                @click="selectedId = location.id"
              >
                <td class="px-5 py-4 align-top">
                  <div class="font-medium text-white">{{ location.name }}</div>
                </td>
                <td class="px-5 py-4 align-top">{{ formatText(location.municipality) }}</td>
                <td class="px-5 py-4 align-top">{{ formatText(location.activityType) }}</td>
                <td class="px-5 py-4 align-top">{{ formatText(location.address) }}</td>
                <td class="px-5 py-4 align-top">{{ formatText(location.reference) }}</td>
                <td class="px-5 py-4 align-top text-slate-400">
                  <div>{{ formatText(location.phone) }}</div>
                  <div>{{ formatText(location.email) }}</div>
                </td>
              </tr>
              <tr v-if="!filteredLocations.length">
                <td colspan="6" class="px-5 py-8 text-center text-slate-400">{{ t('states.noResults') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>
</template>
