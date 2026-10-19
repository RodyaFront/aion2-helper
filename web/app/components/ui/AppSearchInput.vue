<script setup lang="ts">
import { Search, X } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  ariaLabel?: string
  name?: string
  debounceMs?: number
  autofocus?: boolean
}>(), {
  placeholder: 'Поиск…',
  ariaLabel: 'Поиск',
  name: 'search',
  debounceMs: 160,
  autofocus: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)
const local = ref(props.modelValue)
let timer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.modelValue,
  (v) => {
    if (v !== local.value) local.value = v
  },
)

function flush(next: string) {
  emit('update:modelValue', next)
}

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  local.value = value
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => flush(value), props.debounceMs)
}

function clear() {
  local.value = ''
  flush('')
  nextTick(() => inputRef.value?.focus())
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && local.value) {
    e.preventDefault()
    clear()
  }
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus, inputRef })

onMounted(() => {
  if (props.autofocus) inputRef.value?.focus()
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="search-wrap app-search" role="search">
    <Search class="ui-icon" aria-hidden="true" />
    <input
      ref="inputRef"
      class="search-input"
      type="search"
      :name="name"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      :value="local"
      @input="onInput"
      @keydown="onKeydown"
    >
    <button
      v-if="local"
      type="button"
      class="btn btn-icon btn-sm btn-ghost app-search-clear"
      aria-label="Очистить поиск"
      @click="clear"
    >
      <X class="ui-icon" aria-hidden="true" />
    </button>
  </div>
</template>
