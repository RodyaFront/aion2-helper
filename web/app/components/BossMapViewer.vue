<script setup lang="ts">
import { createBossMapScene } from '../../shared/map/scene'
import { getVerteronBossCoord, VERTERON_MAP_DEFINITION } from '../../shared/map/verteron'
import GameMapViewer from './GameMapViewer.vue'

const props = defineProps<{
  bossId: string
  bossName?: string
}>()

const scene = computed(() => {
  const coord = getVerteronBossCoord(props.bossId)
  return createBossMapScene({
    map: VERTERON_MAP_DEFINITION,
    bossId: props.bossId,
    bossName: props.bossName || coord?.name || props.bossId,
    point: coord
      ? { mapX: coord.mapX, mapY: coord.mapY, x: coord.x, y: coord.y }
      : null,
  })
})
</script>

<template>
  <GameMapViewer :scene="scene" />
</template>
