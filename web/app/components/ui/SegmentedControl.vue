<script setup lang="ts">
export interface SegmentedOption {
  id: string
  label: string
}

const props = defineProps<{
  options: SegmentedOption[]
  ariaLabel: string
}>()

const model = defineModel<string>({ required: true })

const rootRef = ref<HTMLElement | null>(null)

function select(id: string) {
  if (model.value === id) return
  model.value = id
}

function focusOption(id: string) {
  const root = rootRef.value
  if (!root) return
  const el = root.querySelector<HTMLElement>(`[data-segment-id="${CSS.escape(id)}"]`)
  el?.focus()
}

function move(delta: number) {
  const list = props.options
  if (list.length === 0) return
  const idx = list.findIndex((o) => o.id === model.value)
  const from = idx >= 0 ? idx : 0
  const next = list[(from + delta + list.length) % list.length]!
  select(next.id)
  focusOption(next.id)
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault()
      move(-1)
      break
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault()
      move(1)
      break
    case 'Home':
      e.preventDefault()
      if (props.options[0]) {
        select(props.options[0].id)
        focusOption(props.options[0].id)
      }
      break
    case 'End':
      e.preventDefault()
      {
        const last = props.options[props.options.length - 1]
        if (last) {
          select(last.id)
          focusOption(last.id)
        }
      }
      break
  }
}
</script>

<template>
  <div
    ref="rootRef"
    class="segmented"
    role="radiogroup"
    :aria-label="ariaLabel"
    @keydown="onKeydown"
  >
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="control control--ghost segmented-item"
      :class="{ 'is-active': model === opt.id }"
      role="radio"
      :aria-checked="model === opt.id"
      :tabindex="model === opt.id ? 0 : -1"
      :data-segment-id="opt.id"
      @click="select(opt.id)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
