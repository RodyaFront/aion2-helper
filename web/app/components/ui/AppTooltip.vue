<script setup lang="ts">
export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'
export type TooltipTrigger = 'hover' | 'click'

const props = withDefaults(defineProps<{
  /** Plain text content. Prefer this for short labels; use #content for rich markup. */
  content?: string
  placement?: TooltipPlacement
  /** hover = delay show/hide; click = toggle, closes on outside / Escape. */
  trigger?: TooltipTrigger
  /** Allow pointer events on the panel (links, buttons). Implied for click. */
  interactive?: boolean
  /** Delay before show (ms). Slightly long to avoid flicker on pass-through. */
  delayShow?: number
  delayHide?: number
  disabled?: boolean
  maxWidth?: string
}>(), {
  content: '',
  placement: 'top',
  trigger: 'hover',
  interactive: false,
  delayShow: 350,
  delayHide: 80,
  disabled: false,
  maxWidth: '16rem',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const slots = useSlots()
const triggerRef = ref<HTMLElement | null>(null)
const tipRef = ref<HTMLElement | null>(null)
const open = ref(false)
const coords = ref({ top: 0, left: 0, placement: 'top' as TooltipPlacement })
const tipId = useId()

const isClick = computed(() => props.trigger === 'click')
const isInteractive = computed(() => props.interactive || isClick.value)

const hasContent = computed(() => {
  if (props.disabled) return false
  if (slots.content) return true
  return Boolean(props.content?.trim())
})

let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let describedBound: HTMLElement | null = null

function resolveDescribedEl() {
  const root = triggerRef.value
  if (!root) return null
  return root.querySelector<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) || root
}

function syncDescribedBy(active: boolean) {
  const el = resolveDescribedEl()
  if (describedBound && describedBound !== el) {
    describedBound.removeAttribute('aria-describedby')
    describedBound = null
  }
  if (!el) return
  if (active && hasContent.value) {
    el.setAttribute('aria-describedby', tipId)
    describedBound = el
  }
  else {
    el.removeAttribute('aria-describedby')
    describedBound = null
  }
}

function clearTimers() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

async function showNow() {
  if (!hasContent.value || !import.meta.client) return
  clearTimers()
  open.value = true
  emit('update:open', true)
  await nextTick()
  updatePosition()
  requestAnimationFrame(() => updatePosition())
}

function hideNow() {
  clearTimers()
  open.value = false
  emit('update:open', false)
}

function scheduleShow() {
  if (isClick.value || !hasContent.value || !import.meta.client) return
  clearTimers()
  showTimer = setTimeout(() => {
    void showNow()
  }, props.delayShow)
}

function scheduleHide() {
  if (isClick.value) return
  clearTimers()
  hideTimer = setTimeout(() => {
    hideNow()
  }, props.delayHide)
}

function onTriggerClick(e: MouseEvent) {
  if (!isClick.value || !hasContent.value) return
  e.preventDefault()
  e.stopPropagation()
  if (open.value) hideNow()
  else void showNow()
}

function onDocPointerDown(e: PointerEvent) {
  if (!open.value || !isClick.value) return
  const t = e.target as Node | null
  if (triggerRef.value?.contains(t) || tipRef.value?.contains(t)) return
  hideNow()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.stopPropagation()
    hideNow()
  }
}

function updatePosition() {
  const trigger = triggerRef.value
  const tip = tipRef.value
  if (!trigger || !tip) return

  const gap = 8
  const pad = 8
  const tr = trigger.getBoundingClientRect()
  const tipRect = tip.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let placement = props.placement
  const space = {
    top: tr.top - pad,
    bottom: vh - tr.bottom - pad,
    left: tr.left - pad,
    right: vw - tr.right - pad,
  }
  const needH = tipRect.height + gap
  const needW = tipRect.width + gap

  if (placement === 'top' && space.top < needH && space.bottom >= needH) placement = 'bottom'
  else if (placement === 'bottom' && space.bottom < needH && space.top >= needH) placement = 'top'
  else if (placement === 'left' && space.left < needW && space.right >= needW) placement = 'right'
  else if (placement === 'right' && space.right < needW && space.left >= needW) placement = 'left'

  let top = 0
  let left = 0
  if (placement === 'top') {
    top = tr.top - tipRect.height - gap
    left = tr.left + tr.width / 2 - tipRect.width / 2
  }
  else if (placement === 'bottom') {
    top = tr.bottom + gap
    left = tr.left + tr.width / 2 - tipRect.width / 2
  }
  else if (placement === 'left') {
    top = tr.top + tr.height / 2 - tipRect.height / 2
    left = tr.left - tipRect.width - gap
  }
  else {
    top = tr.top + tr.height / 2 - tipRect.height / 2
    left = tr.right + gap
  }

  left = Math.min(Math.max(pad, left), Math.max(pad, vw - tipRect.width - pad))
  top = Math.min(Math.max(pad, top), Math.max(pad, vh - tipRect.height - pad))

  coords.value = { top, left, placement }
}

watch(open, (isOpen) => {
  if (!import.meta.client) return
  syncDescribedBy(isOpen)
  if (isOpen) {
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('keydown', onKeydown, true)
    if (isClick.value) {
      window.addEventListener('pointerdown', onDocPointerDown, true)
    }
  }
  else {
    window.removeEventListener('scroll', updatePosition, true)
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('keydown', onKeydown, true)
    window.removeEventListener('pointerdown', onDocPointerDown, true)
  }
})

onBeforeUnmount(() => {
  clearTimers()
  syncDescribedBy(false)
  if (!import.meta.client) return
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('pointerdown', onDocPointerDown, true)
})

defineExpose({ hide: hideNow, show: showNow })
</script>

<template>
  <span
    ref="triggerRef"
    class="app-tooltip"
    :class="{ 'is-click': isClick }"
    @pointerenter="scheduleShow"
    @pointerleave="scheduleHide"
    @focusin="scheduleShow"
    @focusout="scheduleHide"
    @click="onTriggerClick"
  >
    <slot />
  </span>

  <Teleport to="body">
    <Transition name="app-tooltip">
      <div
        v-if="open && hasContent"
        :id="tipId"
        ref="tipRef"
        class="app-tooltip-panel"
        :class="[
          `is-${coords.placement}`,
          { 'is-interactive': isInteractive },
        ]"
        :role="isClick ? 'dialog' : 'tooltip'"
        :style="{
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          maxWidth: maxWidth,
        }"
        @pointerenter="isInteractive && !isClick ? clearTimers() : undefined"
        @pointerleave="isInteractive && !isClick ? scheduleHide() : undefined"
      >
        <slot name="content">
          {{ content }}
        </slot>
      </div>
    </Transition>
  </Teleport>
</template>
