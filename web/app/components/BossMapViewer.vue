<script setup lang="ts">
import { createBossMapScene } from '../../shared/map/scene'
import {
  bossCoordToPoint,
  getBossCoord,
  mapDefinitionForRegion,
} from '../../shared/map/regions'
import { useSettingsStore } from '../../stores/settings'
import GameMapViewer from './GameMapViewer.vue'

const props = defineProps<{
  bossId: string
  bossName: string
}>()

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
</script>

<template>
  <GameMapViewer :scene="scene" />
</template>
