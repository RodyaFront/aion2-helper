<script setup lang="ts">
import { SameMobPortraitCluster } from '../../shared/map/cluster'
import { createMonsterSpawnScene } from '../../shared/items/catalog'
import { gradeClass } from '../../shared/items/grade'
import type { VerteronMob } from '../../shared/items/types'
import type { IMapMarker } from '../../shared/map/types'
import GameMapModal from './GameMapModal.vue'
import ItemIcon from './ItemIcon.vue'
import MonsterLootModal from './MonsterLootModal.vue'

const props = defineProps<{
  mob: VerteronMob
}>()

const open = defineModel<boolean>('open', { required: true })

const cluster = new SameMobPortraitCluster(36)
const showLoot = ref(false)
const clusterCount = ref<number | null>(null)

const scene = computed(() => createMonsterSpawnScene(props.mob))

const totalMarkers = computed(() => props.mob.spawnCount || scene.value.markers.length)
const visibleCount = computed(() => scene.value.markers.length)

const namePrimary = computed(() => props.mob.nameRu || props.mob.nameEn)

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
    description="Verteron · точки спауна"
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
                {{ totalMarkers }} точек
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
            Пин — портрет моба. Клик открывает таблицу дропа.
            Близкие точки схлопываются в ×N.
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
