<script setup lang="ts">
import type { IClusterStrategy, IMapMarker, MapScene } from '../../shared/map/types'
import GameMapViewer from './GameMapViewer.vue'

withDefaults(defineProps<{
  title: string
  description?: string
  scene: MapScene
  clusterStrategy?: IClusterStrategy | null
  minMobCount?: number
  maxMobCount?: number
  /** When false, every marker in the viewport is drawn (no 200-chip cap). */
  capDomMarkers?: boolean
}>(), {
  minMobCount: 1,
  maxMobCount: Number.POSITIVE_INFINITY,
  capDomMarkers: true,
})

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  'select-marker': [marker: IMapMarker]
}>()

const slots = useSlots()
const hasSidebar = computed(() => Boolean(slots.sidebar))
</script>

<template>
  <UiAppModal
    v-model:open="open"
    :title="title"
    :description="description"
    size="xl"
    :panel-class="[
      'boss-map-modal-panel',
      hasSidebar ? 'boss-map-modal-panel--sidebar' : '',
    ].filter(Boolean).join(' ')"
  >
    <div
      class="boss-map-modal-layout"
      :class="{ 'has-sidebar': hasSidebar }"
    >
      <aside
        v-if="hasSidebar"
        class="boss-map-modal-sidebar"
      >
        <slot name="sidebar" />
      </aside>
      <div class="boss-map-modal-map">
        <GameMapViewer
          v-if="open"
          :scene="scene"
          :cluster-strategy="clusterStrategy"
          :min-mob-count="minMobCount"
          :max-mob-count="maxMobCount"
          :cap-dom-markers="capDomMarkers"
          @select-marker="emit('select-marker', $event)"
        />
      </div>
    </div>
  </UiAppModal>
</template>
