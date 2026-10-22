<script setup lang="ts">
import { X } from '@lucide/vue'
import { formatCountdown } from '../../shared/bosses'
import { useBossStore, type FieldSyncOfferEntry } from '../../stores/bosses'
import { useRiftStore } from '../../stores/rift'

const store = useBossStore()
const rift = useRiftStore()

const fieldSyncEntries = computed(() => store.pendingFieldSync?.entries ?? [])
const fieldSyncCount = computed(() => fieldSyncEntries.value.length)

const hasToasts = computed(() =>
  fieldSyncCount.value > 0 || Boolean(rift.toast) || store.toasts.length > 0,
)

function fieldSyncStatus(entry: FieldSyncOfferEntry): string {
  const now = store.now
  if (entry.alive || entry.respawnAt == null || entry.respawnAt <= now) {
    return 'Жив'
  }
  return formatCountdown((entry.respawnAt - now) / 1000)
}
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
        class="toast is-field-sync field-sync-card"
        role="dialog"
        aria-labelledby="field-sync-title"
        aria-describedby="field-sync-desc"
      >
        <header class="field-sync-header">
          <div class="field-sync-heading">
            <h2 id="field-sync-title" class="field-sync-title">
              Актуальные таймеры с карты
            </h2>
            <p id="field-sync-desc" class="field-sync-desc">
              Ты открыл карту полевых боссов в игре - оттуда пришли свежие данные о таймерах.
              Обновить их в приложении?
            </p>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-ghost btn-icon field-sync-close"
            aria-label="Закрыть"
            @click="store.dismissFieldSync()"
          >
            <X class="ui-icon" aria-hidden="true" />
          </button>
        </header>
        <div class="field-sync-body">
          <ul class="field-sync-list" aria-label="Боссы с карты">
            <li
              v-for="entry in fieldSyncEntries"
              :key="entry.npcId"
              class="field-sync-row"
            >
              <span class="field-sync-name">{{ entry.name }}</span>
              <span
                class="field-sync-status"
                :class="{ 'is-ready': fieldSyncStatus(entry) === 'Жив' }"
              >
                {{ fieldSyncStatus(entry) }}
              </span>
            </li>
          </ul>
        </div>
        <footer class="field-sync-footer">
          <button
            type="button"
            class="btn btn-sm btn-ghost"
            @click="store.dismissFieldSync()"
          >
            Не сейчас
          </button>
          <button
            type="button"
            class="btn btn-sm btn-primary"
            @click="store.applyPendingFieldSync()"
          >
            Обновить
          </button>
        </footer>
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
