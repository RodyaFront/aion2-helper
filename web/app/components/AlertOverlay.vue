<script setup lang="ts">
import { X } from '@lucide/vue'
import { useBossStore } from '../../stores/bosses'
import { useRiftStore } from '../../stores/rift'

const store = useBossStore()
const rift = useRiftStore()

const fieldSyncCount = computed(() => store.pendingFieldSync?.length ?? 0)

const hasToasts = computed(() =>
  fieldSyncCount.value > 0 || Boolean(rift.toast) || store.toasts.length > 0,
)
</script>

<template>
  <div class="alert-overlay">
    <div
      v-if="hasToasts"
      class="toast-scrim"
      aria-hidden="true"
    />
    <div class="toast-stack" aria-live="assertive">
      <div
        v-if="fieldSyncCount"
        class="toast is-field-sync"
        role="status"
      >
        <strong>Таймеры с карты</strong>
        <span>Можно обновить как в игре ({{ fieldSyncCount }} боссов)</span>
        <div class="toast-actions">
          <button
            type="button"
            class="btn btn-sm btn-primary"
            @click="store.applyPendingFieldSync()"
          >
            Обновить
          </button>
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-icon"
            aria-label="Закрыть"
            @click="store.dismissFieldSync()"
          >
            <X class="ui-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        v-if="rift.toast"
        class="toast is-rift"
        :class="{ 'is-rift-warn': rift.toast.kind === 'warn' }"
        role="status"
      >
        <strong>{{ rift.toast.title }}</strong>
        <span v-if="rift.toast.body">{{ rift.toast.body }}</span>
        <div class="toast-actions">
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-icon"
            aria-label="Закрыть"
            @click="rift.dismissToast()"
          >
            <X class="ui-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        v-for="toast in store.toasts"
        :key="toast.id"
        class="toast"
        :class="{ 'is-ready': toast.kind === 'ready' }"
        role="status"
      >
        <strong>{{ toast.title }}</strong>
        <span>{{ toast.body }}</span>
        <div class="toast-actions">
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-icon"
            aria-label="Закрыть"
            @click="store.dismissToast(toast.id)"
          >
            <X class="ui-icon" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
