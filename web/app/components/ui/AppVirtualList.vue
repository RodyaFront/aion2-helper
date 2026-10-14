<script setup lang="ts">
const props = withDefaults(defineProps<{
  items: unknown[]
  itemHeight: number
  overscan?: number
  getKey?: (item: unknown, index: number) => string | number
}>(), {
  overscan: 10,
})

const rootRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportH = ref(480)

const totalHeight = computed(() => props.items.length * props.itemHeight)

const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan),
)

const visibleCount = computed(() =>
  Math.ceil(viewportH.value / props.itemHeight) + props.overscan * 2,
)

const endIndex = computed(() =>
  Math.min(props.items.length, startIndex.value + visibleCount.value),
)

const windowItems = computed(() => {
  const start = startIndex.value
  return props.items.slice(start, endIndex.value).map((item, i) => ({
    item,
    index: start + i,
  }))
})

const offsetY = computed(() => startIndex.value * props.itemHeight)

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop
}

function scrollToIndex(index: number, align: 'start' | 'center' = 'start') {
  const el = rootRef.value
  if (!el) return
  const clamped = Math.max(0, Math.min(props.items.length - 1, index))
  let top = clamped * props.itemHeight
  if (align === 'center') {
    top = Math.max(0, top - el.clientHeight / 2 + props.itemHeight / 2)
  }
  el.scrollTop = top
  scrollTop.value = top
}

let ro: ResizeObserver | null = null

onMounted(() => {
  const el = rootRef.value
  if (!el) return
  viewportH.value = el.clientHeight || 480
  ro = new ResizeObserver(() => {
    viewportH.value = el.clientHeight || 480
  })
  ro.observe(el)
})

onBeforeUnmount(() => {
  ro?.disconnect()
})

watch(
  () => props.items.length,
  () => {
    const el = rootRef.value
    if (!el) return
    const maxScroll = Math.max(0, props.items.length * props.itemHeight - el.clientHeight)
    if (el.scrollTop > maxScroll) {
      el.scrollTop = maxScroll
      scrollTop.value = maxScroll
    }
  },
)

defineExpose({ scrollToIndex, rootRef })
</script>

<template>
  <div
    ref="rootRef"
    class="app-virtual-list"
    @scroll.passive="onScroll"
  >
    <div
      class="app-virtual-list-spacer"
      :style="{ height: `${totalHeight}px` }"
    >
      <div
        class="app-virtual-list-window"
        :style="{ transform: `translate3d(0, ${offsetY}px, 0)` }"
      >
        <div
          v-for="row in windowItems"
          :key="getKey ? getKey(row.item, row.index) : row.index"
          class="app-virtual-list-row"
          :style="{ height: `${itemHeight}px` }"
        >
          <slot
            :item="row.item"
            :index="row.index"
          />
        </div>
      </div>
    </div>
  </div>
</template>
