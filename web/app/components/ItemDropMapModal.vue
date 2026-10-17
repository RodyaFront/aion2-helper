<script setup lang="ts">
import { Info } from '@lucide/vue'
import { SameMobTypeZoomCluster } from '../../shared/map/cluster'
import {
  ASSUMED_PLAYER_LEVEL,
  createItemDropMapScene,
  getItemDropMarkers,
  getItemDropSource,
  getSharedLevelLoot,
} from '../../shared/items/catalog'
import { gradeClass } from '../../shared/items/grade'
import type { DropSource, ItemDef } from '../../shared/items/types'
import type { IMapMarker } from '../../shared/map/types'
import GameMapModal from './GameMapModal.vue'
import ItemIcon from './ItemIcon.vue'
import LootTable from './LootTable.vue'
import MobDropDetailModal from './MobDropDetailModal.vue'

const DEFAULT_RATE_MIN = 0
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
/** When on, low-level mobs use shared Verteron Lv45 loot in the detail modal. */
const after45Level = ref(true)
const infoTipOpen = ref(false)
const showSharedLoot = ref(false)
const infoTipRef = ref<{ hide: () => void } | null>(null)

const sharedLootFile = computed(() => getSharedLevelLoot(ASSUMED_PLAYER_LEVEL, 'verteron'))
const sharedLootDrops = computed(() => sharedLootFile.value?.drops ?? [])

function openSharedLootModal() {
  infoTipRef.value?.hide()
  infoTipOpen.value = false
  showSharedLoot.value = true
}

const totalMarkers = computed(() => {
  const byItemId = getItemDropMarkers(props.item.itemId, 'verteron').length
  if (byItemId) return byItemId
  return getItemDropMarkers(props.item.id, 'verteron').length
})

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
  const source = getItemDropSource(props.item.itemId, marker.mobId)
    || getItemDropSource(props.item.id, marker.mobId)
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
    showSharedLoot.value = false
    infoTipRef.value?.hide()
    infoTipOpen.value = false
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
        <article class="map-research-card" aria-label="Исследуемый ресурс">
          <p class="map-research-eyebrow">
            Исследуем на карте
          </p>
          <div class="map-research-body">
            <div class="map-research-media">
              <ItemIcon
                :src="item.icon"
                :alt="item.nameEn"
                :size="2.5"
                class="map-research-icon"
              />
            </div>
            <div class="map-research-text">
              <h3 class="map-research-title" :class="gradeClass(item.grade)">
                {{ item.nameRu || item.nameEn }}
              </h3>
              <p class="map-research-sub">
                {{ item.nameEn }} · #{{ item.itemId }}
              </p>
              <p class="map-research-meta">
                {{ item.dropSourceCount }} источников
                · {{ item.verteronSpawnCount }} координат
              </p>
            </div>
          </div>
        </article>

        <div class="map-level-toggle">
          <div class="map-level-toggle-label">
            <label class="map-level-toggle-title" for="map-after-45">after 45lvl</label>
            <UiAppTooltip
              ref="infoTipRef"
              trigger="click"
              placement="bottom"
              max-width="18.5rem"
              @update:open="infoTipOpen = $event"
            >
              <button
                type="button"
                class="map-level-toggle-info"
                aria-label="Что значит after 45lvl"
                :aria-expanded="infoTipOpen"
              >
                <Info class="ui-icon" aria-hidden="true" />
              </button>
              <template #content>
                <p class="app-tooltip-rich">
                  После достижения персонажем 45 уровня все мобы ниже 45 становятся минимум 45 уровня
                  и получают
                  <button
                    type="button"
                    class="app-tooltip-link"
                    @click="openSharedLootModal"
                  >shared лут</button>.
                </p>
              </template>
            </UiAppTooltip>
          </div>
          <input
            id="map-after-45"
            v-model="after45Level"
            class="map-level-toggle-input"
            type="checkbox"
            aria-label="after 45lvl"
          >
        </div>

        <section class="map-data-block">
          <h3 class="map-data-heading">
            Шанс дропа
          </h3>
          <p class="map-data-hint">
            Показать координаты в диапазоне
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
            <span>из {{ totalMarkers }} координат</span>
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
    :use-shared-scaling="after45Level"
  />

  <UiAppModal
    v-model:open="showSharedLoot"
    title="Shared лут · Verteron Lv45"
    description="Общая таблица дропа для эффективного уровня 45. Накладывается на собственный лут моба (Soul, материалы вида)."
    size="md"
    panel-class="shared-loot-modal-panel"
  >
    <LootTable
      :drops="sharedLootDrops"
      density="normal"
      :total-count="sharedLootDrops.length"
      empty-message="Shared-таблица ещё не загружена."
    />
  </UiAppModal>
</template>
