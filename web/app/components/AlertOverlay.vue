<script setup lang="ts">
import { BellOff, X } from '@lucide/vue'
import { useBossStore } from '../../stores/bosses'
import { useRiftStore } from '../../stores/rift'

const store = useBossStore()
const rift = useRiftStore()
</script>

<template>
  <div class="alert-overlay">
    <div class="toast-stack" aria-live="assertive">
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
            v-if="toast.kind === 'ready'"
            type="button"
            class="btn btn-sm btn-primary"
            @click="store.silenceAlarm(toast.bossId)"
          >
            <BellOff class="ui-icon" aria-hidden="true" />
            Заглушить
          </button>
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

    <div v-if="store.isAlarming" class="alarm-banner">
      <span>Будильник: босс готов</span>
      <button type="button" class="btn btn-sm btn-primary" @click="store.silenceAlarm()">
        <BellOff class="ui-icon" aria-hidden="true" />
        Заглушить все
      </button>
    </div>
  </div>
</template>
