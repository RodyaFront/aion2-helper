<script setup lang="ts">
import { createBossMapScene } from '../../shared/map/scene'
import {
  bossCoordToPoint,
  getBossCoord,
  mapDefinitionForRegion,
  regionLabelEn,
} from '../../shared/map/regions'
import { useSettingsStore } from '../../stores/settings'
import GameMapModal from './GameMapModal.vue'

const props = defineProps<{
  bossId: string
  bossName: string
}>()

const open = defineModel<boolean>('open', { required: true })
const settings = useSettingsStore()

const scene = computed(() => {
  const regionId = settings.regionId
  const coord = getBossCoord(regionId, props.bossId)
  return createBossMapScene({
    map: mapDefinitionForRegion(regionId),
    bossId: props.bossId,
    bossName: props.bossName || coord?.name || props.bossId,
    point: bossCoordToPoint(coord),
  })
})

const description = computed(() => `${regionLabelEn(settings.regionId)} · место на карте`)
</script>

<template>
  <GameMapModal
    v-model:open="open"
    :title="bossName"
    :description="description"
    :scene="scene"
  />
</template>
