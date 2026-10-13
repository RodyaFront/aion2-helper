<script setup lang="ts">
import { SameMobTypeZoomCluster } from '../../shared/map/cluster'
import { createItemDropMapScene, getItemDropMarkers, getItemDropSource } from '../../shared/items/catalog'
import type { DropSource, ItemDef } from '../../shared/items/types'
import type { IMapMarker } from '../../shared/map/types'
import GameMapModal from './GameMapModal.vue'
import MobDropDetailModal from './MobDropDetailModal.vue'

const DEFAULT_RATE_MIN = 2
const DEFAULT_RATE_MAX = 45
const DEFAULT_COUNT_MIN = 1
const DEFAULT_COUNT_MAX = 9999

const props = defineProps<{
  item: ItemDef
}>()

const open = defineModel<boolean>('open', { required: true })

const cluster = new SameMobTypeZoomCluster(36)

const rateMin = ref(DEFAULT_RATE_MIN)
const rateMax = ref(DEFAULT_RATE_MAX)
const countMin = ref(DEFAULT_COUNT_MIN)
const countMax = ref(DEFAULT_COUNT_MAX)

const totalMarkers = computed(() => getItemDropMarkers(props.item.id, 'verteron').length)

const filterBounds = computed(() => {
  let lo = Number(rateMin.value)
  let hi = Number(rateMax.value)
  if (!Number.isFinite(lo)) lo = DEFAULT_RATE_MIN
  if (!Number.isFinite(hi)) hi = DEFAULT_RATE_MAX
  lo = Math.max(0, Math.min(100, lo))
  hi = Math.max(0, Math.min(100, hi))
  if (lo > hi) [lo, hi] = [hi, lo]
  return { minRate: lo, maxRate: hi }
})

const countBounds = computed(() => {
  let lo = Number(countMin.value)
  let hi = Number(countMax.value)
  if (!Number.isFinite(lo)) lo = DEFAULT_COUNT_MIN
  if (!Number.isFinite(hi)) hi = DEFAULT_COUNT_MAX
  lo = Math.max(1, Math.min(9999, Math.floor(lo)))
  hi = Math.max(1, Math.min(9999, Math.floor(hi)))
  if (lo > hi) [lo, hi] = [hi, lo]
  return { minMobCount: lo, maxMobCount: hi }
})

const scene = computed(() =>
  createItemDropMapScene(props.item, filterBounds.value),
)

const visibleCount = computed(() => scene.value.markers.length)

const showMob = ref(false)
const selectedSource = ref<DropSource | null>(null)
const selectedClusterCount = ref<number | null>(null)

function onSelectMarker(marker: IMapMarker) {
  if (!marker.mobId) return
  const source = getItemDropSource(props.item.id, marker.mobId)
  if (!source) return
  selectedSource.value = source
  selectedClusterCount.value = marker.kind === 'cluster'
    ? (marker.renderModel().count ?? null)
    : null
  showMob.value = true
}

function resetRateRange() {
  rateMin.value = DEFAULT_RATE_MIN
  rateMax.value = DEFAULT_RATE_MAX
}

function resetCountRange() {
  countMin.value = DEFAULT_COUNT_MIN
  countMax.value = DEFAULT_COUNT_MAX
}

function resetAllFilters() {
  resetRateRange()
  resetCountRange()
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetAllFilters()
  }
  else {
    showMob.value = false
    selectedSource.value = null
    selectedClusterCount.value = null
  }
})
</script>

<template>
  <GameMapModal
    v-model:open="open"
    :title="item.nameRu || item.nameEn"
    :description="`Verteron · дроп ${item.nameEn}`"
    :scene="scene"
    :cluster-strategy="cluster"
    :min-mob-count="countBounds.minMobCount"
    :max-mob-count="countBounds.maxMobCount"
    @select-marker="onSelectMarker"
  >
    <template #sidebar>
      <div class="map-data-sidebar">
        <section class="map-data-block">
          <h3 class="map-data-heading">
            Шанс дропа
          </h3>
          <p class="map-data-hint">
            Показать точки в диапазоне
          </p>
          <div class="map-rate-range">
            <label class="map-rate-field">
              <span class="map-rate-label">От</span>
              <input
                v-model.number="rateMin"
                class="field-input map-rate-input"
                type="number"
                min="0"
                max="100"
                step="0.1"
                inputmode="decimal"
                aria-label="Минимальный шанс дропа"
              >
              <span class="map-rate-suffix">%</span>
            </label>
            <span class="map-rate-sep" aria-hidden="true">—</span>
            <label class="map-rate-field">
              <span class="map-rate-label">До</span>
              <input
                v-model.number="rateMax"
                class="field-input map-rate-input"
                type="number"
                min="0"
                max="100"
                step="0.1"
                inputmode="decimal"
                aria-label="Максимальный шанс дропа"
              >
              <span class="map-rate-suffix">%</span>
            </label>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-ghost map-rate-reset"
            @click="resetRateRange"
          >
            Сбросить 2–45%
          </button>
        </section>

        <section class="map-data-block">
          <h3 class="map-data-heading">
            Кол-во в группе
          </h3>
          <p class="map-data-hint">
            Фильтр по ×N на бейдже
          </p>
          <div class="map-rate-range">
            <label class="map-rate-field">
              <span class="map-rate-label">От</span>
              <input
                v-model.number="countMin"
                class="field-input map-rate-input"
                type="number"
                min="1"
                max="9999"
                step="1"
                inputmode="numeric"
                aria-label="Минимальное число мобов в группе"
              >
              <span class="map-rate-suffix">×</span>
            </label>
            <span class="map-rate-sep" aria-hidden="true">—</span>
            <label class="map-rate-field">
              <span class="map-rate-label">До</span>
              <input
                v-model.number="countMax"
                class="field-input map-rate-input"
                type="number"
                min="1"
                max="9999"
                step="1"
                inputmode="numeric"
                aria-label="Максимальное число мобов в группе"
              >
              <span class="map-rate-suffix">×</span>
            </label>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-ghost map-rate-reset"
            @click="resetCountRange"
          >
            Сбросить от 1
          </button>
        </section>

        <section class="map-data-block">
          <h3 class="map-data-heading">
            На карте
          </h3>
          <p class="map-data-stat">
            <strong>{{ visibleCount }}</strong>
            <span>из {{ totalMarkers }} точек</span>
          </p>
          <p class="map-data-hint">
            %: {{ filterBounds.minRate }}–{{ filterBounds.maxRate }}
            · ×N: {{ countBounds.minMobCount }}–{{ countBounds.maxMobCount }}
          </p>
        </section>
      </div>
    </template>
  </GameMapModal>
  <MobDropDetailModal
    v-if="selectedSource"
    v-model:open="showMob"
    :item="item"
    :source="selectedSource"
    :cluster-count="selectedClusterCount"
  />
</template>
