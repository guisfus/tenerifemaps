<script setup lang="ts">
const props = defineProps<{
  items: Array<{ key: string; label: string; value: number }>
  emptyLabel: string
}>()

function width(value: number) {
  const max = Math.max(...props.items.map((item) => item.value), 0)

  if (!max) {
    return '0%'
  }

  return `${Math.max((value / max) * 100, 8)}%`
}
</script>

<template>
  <div class="tm-bar-chart mt-5 space-y-3">
    <div v-if="!items.length" class="tm-bar-chart__empty rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-8 text-center text-sm text-slate-400">
      {{ emptyLabel }}
    </div>

    <div v-for="item in items" :key="item.key" class="space-y-2">
      <div class="flex items-center justify-between gap-4 text-sm">
        <span class="tm-bar-chart__label text-slate-200">{{ item.label }}</span>
        <span class="tm-bar-chart__value text-slate-400">{{ item.value }}</span>
      </div>
      <div class="tm-bar-chart__track h-3 rounded-full bg-white/6">
        <div class="h-3 rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-cyan-300 transition-all duration-500" :style="{ width: width(item.value) }" />
      </div>
    </div>
  </div>
</template>
