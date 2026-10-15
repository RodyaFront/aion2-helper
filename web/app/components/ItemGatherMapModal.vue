<script setup lang="ts">
import { SameGatherLayerCluster } from '../../shared/map/cluster'
import {
  createItemGatherMapScene,
  getGatherLayerForItem,
} from '../../shared/items/catalog'
import { gradeClass } from '../../shared/items/grade'
import type { ItemDef } from '../../shared/items/types'
import GameMapModal from './GameMapModal.vue'
import ItemIcon from './ItemIcon.vue'

const props = defineProps<{
  item: ItemDef
}>()

const open = defineModel<boolean>('open', { required: true })

const cluster = new SameGatherLayerCluster(36)

const layer = computed(() =>
  getGatherLayerForItem(props.item.itemId)
  || getGatherLayerForItem(props.item.id),
)

const scene = computed(() => createItemGatherMapScene(props.item))

const totalMarkers = computed(() =>
  layer.value?.spawns?.length
  || props.item.gatherSpawnCount
  || scene.value.markers.length,
)

const visibleCount = computed(() => scene.value.markers.length)

const layerTitle = computed(() =>
  layer.value?.nameRu
  || layer.value?.nameEn
  || props.item.nameRu
  || props.item.nameEn,
)
</script>

<template>
  <GameMapModal
    v-model:open="open"
    :title="item.nameRu || item.nameEn"
    :description="`Verteron · сбор ${layerTitle}`"
    :scene="scene"
    :cluster-strategy="cluster"
  >
    <template #sidebar>
      <div class="map-data-sidebar">
        <article class="map-research-card" aria-label="Исследуемый ресурс">
          <p class="map-research-eyebrow">
            Точки сбора
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
                · {{ totalMarkers }} точек
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
            <span>из {{ totalMarkers }} точек</span>
          </p>
          <p class="map-data-hint">
            Все грейды этого ресурса собираются с одних и тех же узлов.
            Маркеры — иконки ресурса без рамки (кластер ×N при зуме).
          </p>
        </section>
      </div>
    </template>
  </GameMapModal>
</template>
