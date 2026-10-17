<script setup lang="ts">
import {
  createItemGatherMapScene,
  getGatherLayerForItem,
} from '../../shared/items/catalog'
import { gradeClass } from '../../shared/items/grade'
import type { ItemDef } from '../../shared/items/types'
import { regionLabelEn } from '../../shared/map/regions'
import { useSettingsStore } from '../../stores/settings'
import GameMapModal from './GameMapModal.vue'
import ItemIcon from './ItemIcon.vue'

const props = defineProps<{
  item: ItemDef
}>()

const open = defineModel<boolean>('open', { required: true })
const settings = useSettingsStore()
const regionId = computed(() => settings.regionId)

const layer = computed(() =>
  getGatherLayerForItem(props.item.itemId, regionId.value)
  || getGatherLayerForItem(props.item.id, regionId.value),
)

const scene = computed(() => createItemGatherMapScene(props.item, regionId.value))

const totalMarkers = computed(() => {
  const fromLayer = layer.value?.spawns?.length || 0
  if (fromLayer) return fromLayer
  if (regionId.value === 'altgard') {
    return props.item.altgardGatherSpawnCount || scene.value.markers.length
  }
  return props.item.gatherSpawnCount || scene.value.markers.length
})

const visibleCount = computed(() => scene.value.markers.length)

const layerTitle = computed(() =>
  layer.value?.nameRu
  || layer.value?.nameEn
  || props.item.nameRu
  || props.item.nameEn,
)

const mapDescription = computed(() => `${regionLabelEn(regionId.value)} · сбор ${layerTitle.value}`)
</script>

<template>
  <GameMapModal
    v-model:open="open"
    :title="item.nameRu || item.nameEn"
    :description="mapDescription"
    :scene="scene"
    :cap-dom-markers="false"
  >
    <template #sidebar>
      <div class="map-data-sidebar">
        <article class="map-research-card" aria-label="Исследуемый ресурс">
          <p class="map-research-eyebrow">
            Координаты сбора
          </p>
          <div class="map-research-body">
            <div class="map-research-media">
              <ItemIcon
                :src="item.icon || layer?.iconUrl || null"
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
                Слой {{ layerTitle }}
                · {{ totalMarkers }} координат
              </p>
            </div>
          </div>
        </article>

        <section class="map-data-block">
          <h3 class="map-data-heading">
            На карте
          </h3>
          <p class="map-data-stat">
            <strong>{{ visibleCount }}</strong>
            <span>из {{ totalMarkers }} координат</span>
          </p>
          <p class="map-data-hint">
            Все грейды этого ресурса собираются с одних и тех же узлов.
            Каждая координата — отдельная иконка, без группировки.
          </p>
        </section>
      </div>
    </template>
  </GameMapModal>
</template>
