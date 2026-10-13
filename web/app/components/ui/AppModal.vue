<script setup lang="ts">
import { X } from '@lucide/vue'

export type AppModalSize = 'sm' | 'md' | 'lg' | 'xl'

/** Shared across stacked modals so body unlocks only when the last one closes. */
let bodyScrollLocks = 0
/** Topmost open modal wins Escape / higher z-index. */
const modalStack: symbol[] = []

const props = withDefaults(defineProps<{
  /** Accessible title (also used as default heading unless #title is provided). */
  title: string
  description?: string
  size?: AppModalSize
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  /** Show the top-right close control. */
  showClose?: boolean
  /** Extra class on the dialog panel. */
  panelClass?: string
}>(), {
  size: 'md',
  closeOnBackdrop: true,
  closeOnEscape: true,
  showClose: true,
  panelClass: '',
})

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  close: []
}>()

const titleId = useId()
const descId = useId()
const panelRef = ref<HTMLElement | null>(null)
const closeBtnRef = ref<HTMLButtonElement | null>(null)
const stackId = Symbol('app-modal')
const stackDepth = ref(0)
let previousFocus: HTMLElement | null = null

function isTopModal() {
  return modalStack[modalStack.length - 1] === stackId
}

function pushStack() {
  const idx = modalStack.indexOf(stackId)
  if (idx >= 0) modalStack.splice(idx, 1)
  modalStack.push(stackId)
  stackDepth.value = modalStack.length
}

function popStack() {
  const idx = modalStack.indexOf(stackId)
  if (idx >= 0) modalStack.splice(idx, 1)
  stackDepth.value = 0
}

function getFocusable(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  return [...nodes].filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1 && el.offsetParent != null)
}

function lockScroll() {
  if (!import.meta.client) return
  bodyScrollLocks += 1
  if (bodyScrollLocks === 1) {
    const sb = window.innerWidth - document.documentElement.clientWidth
    document.documentElement.style.overflow = 'hidden'
    if (sb > 0) document.documentElement.style.paddingRight = `${sb}px`
  }
}

function unlockScroll() {
  if (!import.meta.client) return
  bodyScrollLocks = Math.max(0, bodyScrollLocks - 1)
  if (bodyScrollLocks === 0) {
    document.documentElement.style.overflow = ''
    document.documentElement.style.paddingRight = ''
  }
}

function close() {
  if (!open.value) return
  open.value = false
  emit('close')
}

function onBackdropClick() {
  if (props.closeOnBackdrop && isTopModal()) close()
}

function onKeydown(e: KeyboardEvent) {
  if (!open.value || !isTopModal()) return
  if (e.key === 'Escape' && props.closeOnEscape) {
    e.preventDefault()
    e.stopPropagation()
    close()
    return
  }
  if (e.key !== 'Tab' || !panelRef.value) return
  const focusable = getFocusable(panelRef.value)
  if (!focusable.length) {
    e.preventDefault()
    panelRef.value.focus()
    return
  }
  const first = focusable[0]!
  const last = focusable[focusable.length - 1]!
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey) {
    if (active === first || !panelRef.value.contains(active)) {
      e.preventDefault()
      last.focus()
    }
  }
  else if (active === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    pushStack()
    lockScroll()
    await nextTick()
    const body = panelRef.value?.querySelector<HTMLElement>('.app-modal-body') ?? null
    const bodyFocusable = body ? getFocusable(body) : []
    const panelFocusable = panelRef.value ? getFocusable(panelRef.value) : []
    const target = bodyFocusable[0] ?? panelFocusable[0] ?? closeBtnRef.value ?? panelRef.value
    target?.focus()
  }
  else {
    popStack()
    unlockScroll()
    previousFocus?.focus?.()
    previousFocus = null
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  if (open.value) {
    pushStack()
    lockScroll()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  if (open.value) {
    popStack()
    unlockScroll()
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="app-modal">
      <div
        v-if="open"
        class="app-modal-root"
        :style="{ zIndex: 50 + stackDepth }"
        role="presentation"
      >
        <div
          class="app-modal-backdrop"
          aria-hidden="true"
          @click="onBackdropClick"
        />
        <div
          ref="panelRef"
          class="app-modal-panel"
          :class="[`is-${size}`, panelClass]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="description ? descId : undefined"
          tabindex="-1"
        >
          <header class="app-modal-header">
            <div class="app-modal-heading">
              <slot name="title">
                <h2 :id="titleId" class="app-modal-title">
                  {{ title }}
                </h2>
              </slot>
              <p v-if="description" :id="descId" class="app-modal-desc">
                {{ description }}
              </p>
              <slot name="description" />
            </div>
            <button
              v-if="showClose"
              ref="closeBtnRef"
              type="button"
              class="btn btn-sm btn-ghost btn-icon app-modal-close"
              aria-label="Закрыть"
              @click="close"
            >
              <X class="ui-icon" aria-hidden="true" />
            </button>
          </header>

          <div class="app-modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="app-modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
