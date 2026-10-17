<script setup lang="ts">
import { SameMobPortraitCluster } from '../../shared/map/cluster'
import { createMonsterSpawnScene } from '../../shared/items/catalog'
import { gradeClass } from '../../shared/items/grade'
import type { RegionMob } from '../../shared/items/types'
import type { IMapMarker } from '../../shared/map/types'
import { regionLabelEn } from '../../shared/map/regions'
import { useSettingsStore } from '../../stores/settings'
import GameMapModal from './GameMapModal.vue'
import ItemIcon from './ItemIcon.vue'
import MonsterLootModal from './MonsterLootModal.vue'

const props = defineProps<{
  mob: RegionMob
}>()

const open = defineModel<boolean>('open', { required: true })
const settings = useSettingsStore()
const regionId = computed(() => settings.regionId)

const cluster = new SameMobPortraitCluster(36)
const showLoot = ref(false)
const clusterCount = ref<number | null>(null)

const scene = computed(() => createMonsterSpawnScene(props.mob, regionId.value))

const totalMarkers = computed(() => props.mob.spawnCount || scene.value.markers.length)
const visibleCount = computed(() => scene.value.markers.length)

const namePrimary = computed(() => props.mob.nameRu || props.mob.nameEn)
const mapDescription = computed(() => `${regionLabelEn(regionId.value)} · координаты спауна`)

watch(open, (isOpen) => {
  if (!isOpen) {
    showLoot.value = false
    clusterCount.value = null
  }
})

function onSelectMarker(marker: IMapMarker) {
  const count = marker.renderModel().count ?? 1
  clusterCount.value = count >= 2 ? count : null
  showLoot.value = true
}
</script>

<template>
  <GameMapModal
    v-model:open="open"
    :title="namePrimary"
    :description="mapDescription"
    :scene="scene"
    :cluster-strategy="cluster"
    @select-marker="onSelectMarker"
  >
    <template #sidebar>
      <div class="map-data-sidebar">
        <article class="map-research-card" aria-label="Монстр">
          <p class="map-research-eyebrow">
            Спаун
          </p>
          <div class="map-research-body">
            <div class="map-research-media">
              <ItemIcon
                :src="mob.iconUrl"
                :alt="namePrimary"
                :size="2.5"
                class="map-research-icon"
              />
            </div>
            <div class="map-research-text">
              <h3 class="map-research-title" :class="gradeClass(mob.gradeName)">
                {{ namePrimary }}
              </h3>
              <p
                v-if="mob.nameRu && mob.nameEn && mob.nameRu !== mob.nameEn"
                class="map-research-sub"
              >
                {{ mob.nameEn }} · #{{ mob.mobId }}
              </p>
              <p
                v-else
                class="map-research-sub"
              >
                #{{ mob.mobId }}
              </p>
              <p class="map-research-meta">
                <template v-if="mob.level != null">
                  Ур. {{ mob.level }} ·
                </template>
                {{ totalMarkers }} координат
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
            Пин — портрет моба. Клик открывает таблицу дропа.
            Близкие координаты схлопываются в ×N.
          </p>
        </section>
      </div>
    </template>
  </GameMapModal>

  <MonsterLootModal
    v-if="showLoot"
    v-model:open="showLoot"
    :mob="mob"
    :cluster-count="clusterCount"
  />
</template>
