<script setup lang="ts">
import { Package } from '@lucide/vue'

const props = withDefaults(defineProps<{
  src?: string | null
  alt?: string
  /** Outer box size in rem (default 2.25 → 36px). */
  size?: number
}>(), {
  src: null,
  alt: '',
  size: 2.25,
})

const broken = ref(false)

watch(
  () => props.src,
  () => {
    broken.value = false
  },
)

const showImg = computed(() => Boolean(props.src) && !broken.value)

const boxStyle = computed(() => ({
  width: `${props.size}rem`,
  height: `${props.size}rem`,
}))
</script>

<template>
  <span
    class="item-icon"
    :class="{ 'is-ph': !showImg }"
    :style="boxStyle"
    role="img"
    :aria-label="alt || undefined"
    :aria-hidden="alt ? undefined : true"
  >
    <img
      v-if="showImg"
      :src="src!"
      :alt="alt"
      class="item-icon-img"
      loading="lazy"
      decoding="async"
      draggable="false"
      @error="broken = true"
    >
    <Package
      v-else
      class="item-icon-ph"
      aria-hidden="true"
    />
  </span>
</template>
