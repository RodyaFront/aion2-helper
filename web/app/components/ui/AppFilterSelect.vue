<script setup lang="ts">
import { Check, ChevronsUpDown, Search } from '@lucide/vue'

export type FilterOption = {
  value: string
  label: string
  keywords?: string
  /** CSS color for a leading swatch dot (e.g. var(--grade-rare)). */
  swatch?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: FilterOption[]
  label?: string
  placeholder?: string
  searchPlaceholder?: string
  ariaLabel?: string
}>(), {
  label: '',
  placeholder: 'Все',
  searchPlaceholder: 'Фильтр...',
  ariaLabel: 'Фильтр',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const query = ref('')
const rootRef = ref<HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)
const activeIndex = ref(0)

const selectedOption = computed(() =>
  props.options.find((o) => o.value === props.modelValue) ?? null,
)

const selectedLabel = computed(() => selectedOption.value?.label || props.placeholder)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => {
    const hay = `${o.label} ${o.keywords || ''} ${o.value}`.toLowerCase()
    return hay.includes(q)
  })
})

watch(filtered, () => {
  activeIndex.value = 0
})

function select(value: string) {
  emit('update:modelValue', value)
  open.value = false
  query.value = ''
}

function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    nextTick(() => {
      const input = rootRef.value?.querySelector<HTMLInputElement>('input[type="search"]')
      input?.focus()
    })
  }
}

function onDocPointer(e: PointerEvent) {
  if (!open.value || !rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle()
    }
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(filtered.value.length - 1, activeIndex.value + 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(0, activeIndex.value - 1)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const opt = filtered.value[activeIndex.value]
    if (opt) select(opt.value)
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer)
})
</script>

<template>
  <div ref="rootRef" class="app-filter-select" :class="{ 'is-open': open }">
    <button
      type="button"
      class="control control--elev app-filter-trigger"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span class="app-filter-trigger-text">
        <span v-if="label" class="app-filter-label">{{ label }}</span>
        <span class="app-filter-value">
          <span
            v-if="selectedOption?.swatch"
            class="app-filter-swatch"
            :style="{ background: selectedOption.swatch }"
            aria-hidden="true"
          />
          {{ selectedLabel }}
        </span>
      </span>
      <ChevronsUpDown class="ui-icon" aria-hidden="true" />
    </button>

    <div v-if="open" class="app-filter-popover" role="presentation">
      <div class="app-filter-search">
        <Search class="ui-icon" aria-hidden="true" />
        <input
          v-model="query"
          type="search"
          class="app-filter-search-input"
          :placeholder="searchPlaceholder"
          autocomplete="off"
          @keydown="onKeydown"
        >
      </div>
      <ul ref="listRef" class="app-filter-list" role="listbox" :aria-label="ariaLabel">
        <li v-if="filtered.length === 0" class="app-filter-empty">
          Ничего не найдено
        </li>
        <li
          v-for="(opt, idx) in filtered"
          :key="opt.value"
          role="option"
          class="control control--ghost app-filter-option"
          :class="{
            'is-active': idx === activeIndex,
            'is-selected': opt.value === modelValue,
          }"
          :aria-selected="opt.value === modelValue"
          @mouseenter="activeIndex = idx"
          @click="select(opt.value)"
        >
          <span class="app-filter-option-main">
            <span
              v-if="opt.swatch"
              class="app-filter-swatch"
              :style="{ background: opt.swatch }"
              aria-hidden="true"
            />
            <span>{{ opt.label }}</span>
          </span>
          <Check v-if="opt.value === modelValue" class="ui-icon" aria-hidden="true" />
        </li>
      </ul>
    </div>
  </div>
</template>
