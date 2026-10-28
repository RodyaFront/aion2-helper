<script setup lang="ts">
import type { AutoKillStatusPayload, NpcapDetectResult } from '../types/aion-tracker'
import { useSettingsStore } from '../../stores/settings'

const settings = useSettingsStore()

const isDesktop = ref(false)
const detecting = ref(false)
const toggling = ref(false)
const detectResult = ref<NpcapDetectResult | null>(null)
const liveStatus = ref<AutoKillStatusPayload | null>(null)

let offStatus: (() => void) | undefined

const npcapOk = computed(() => {
  if (detectResult.value) return detectResult.value.ok === true
  return liveStatus.value?.status === 'listening'
})

type UiPhase = 'browser' | 'need_npcap' | 'ready_off' | 'starting' | 'on' | 'error'

const phase = computed<UiPhase>(() => {
  if (!isDesktop.value) return 'browser'
  const st = liveStatus.value?.status
  if (st === 'listening') return 'on'
  if (st === 'starting') return 'starting'
  if (st === 'missing_npcap') return 'need_npcap'
  if (st === 'error') return 'error'
  if (detectResult.value && !detectResult.value.ok) {
    return detectResult.value.status === 'error' ? 'error' : 'need_npcap'
  }
  if (settings.autoKillTrackEnabled) return 'starting'
  return 'ready_off'
})

const statusLabel = computed(() => {
  switch (phase.value) {
    case 'browser':
      return 'Только в приложении'
    case 'need_npcap':
      return 'Нужен Npcap'
    case 'starting':
      return 'Запуск...'
    case 'on':
      return 'Работает'
    case 'error':
      return 'Не удалось запустить'
    case 'ready_off':
    default:
      return 'Выключено'
  }
})

const statusTone = computed(() => {
  switch (phase.value) {
    case 'on':
      return 'ok'
    case 'need_npcap':
    case 'error':
      return 'bad'
    case 'starting':
      return 'warn'
    default:
      return 'muted'
  }
})

const helpText = computed(() => {
  switch (phase.value) {
    case 'browser':
      return 'Открой приложение Aion Boss Tracker.'
    case 'need_npcap':
      return 'Сначала установи бесплатную программу Npcap (один раз), затем нажми "Проверить снова".'
    case 'error':
      return 'Попробуй ещё раз. Если снова не выйдет, переустанови приложение.'
    case 'on':
      return 'Таймер боссов и метрики сессии (кины, лут, киллы) пишутся из одного захвата.'
    case 'starting':
      return 'Подключаемся...'
    case 'ready_off':
    default:
      return 'Включи переключатель — автотаймер и учёт сессии стартуют вместе.'
  }
})

async function refreshStatus() {
  if (!window.aionTracker?.getAutoKillStatus) return
  liveStatus.value = await window.aionTracker.getAutoKillStatus()
}

async function onCheckAgain() {
  if (!window.aionTracker?.ensureAutoKillTrack && !window.aionTracker?.detectNpcap) return
  detecting.value = true
  try {
    if (window.aionTracker.ensureAutoKillTrack && settings.autoKillTrackEnabled) {
      const next = await window.aionTracker.ensureAutoKillTrack()
      liveStatus.value = next
      if (next.detect) detectResult.value = next.detect
      else if (next.status === 'listening' || next.status === 'starting') {
        detectResult.value = { ok: true, status: 'ok' }
      }
      else if (next.status === 'missing_npcap') {
        detectResult.value = { ok: false, status: 'missing', downloadUrl: 'https://npcap.com/#download' }
      }
      if (next.enabled) settings.setAutoKillTrackEnabled(true)
    }
    else {
      detectResult.value = await window.aionTracker.detectNpcap!()
      await refreshStatus()
    }
  }
  finally {
    detecting.value = false
  }
}

async function onToggle(enabled: boolean) {
  if (!window.aionTracker?.setAutoKillTrack) return
  toggling.value = true
  try {
    settings.setAutoKillTrackEnabled(enabled)
    const next = enabled && window.aionTracker.ensureAutoKillTrack
      ? await window.aionTracker.ensureAutoKillTrack()
      : await window.aionTracker.setAutoKillTrack(enabled)
    liveStatus.value = next
    if (enabled && next.enabled) {
      detectResult.value = { ok: true, status: 'ok' }
    }
    if (next.status === 'missing_npcap') {
      detectResult.value = {
        ok: false,
        status: 'missing',
        downloadUrl: 'https://npcap.com/#download',
      }
    }
  }
  finally {
    toggling.value = false
  }
}

async function onRetry() {
  settings.setAutoKillTrackEnabled(true)
  await onCheckAgain()
}

function openNpcapDownload() {
  const url = detectResult.value?.downloadUrl || 'https://npcap.com/#download'
  if (window.aionTracker?.openExternal) {
    void window.aionTracker.openExternal(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  isDesktop.value = Boolean(window.aionTracker?.detectNpcap)
  if (!isDesktop.value) return
  offStatus = window.aionTracker?.onAutoKillStatus?.((payload) => {
    liveStatus.value = payload
  })
  void refreshStatus()
})

onBeforeUnmount(() => {
  offStatus?.()
})
</script>

<template>
  <section class="auto-kill-banner" aria-label="Автотаймер после убийства">
    <div class="auto-kill-banner-head">
      <h2 class="auto-kill-banner-title">Автотаймер после убийства</h2>
      <span class="auto-kill-banner-badge" :data-tone="statusTone">{{ statusLabel }}</span>
    </div>

    <p class="auto-kill-banner-copy">
      Убил полевого босса в Вертероне или Альтгарде - таймер стартует сам.
      Нужна бесплатная программа Npcap (один раз).
    </p>

    <p class="auto-kill-banner-help hint">{{ helpText }}</p>

    <div v-if="phase === 'browser'" class="auto-kill-banner-actions">
      <p class="hint">Эта функция есть только в приложении Aion Boss Tracker.</p>
    </div>

    <div v-else-if="phase === 'need_npcap'" class="auto-kill-banner-actions">
      <button type="button" class="btn btn-sm btn-primary" @click="openNpcapDownload">
        Установить Npcap
      </button>
      <button
        type="button"
        class="btn btn-sm"
        :disabled="detecting"
        @click="onCheckAgain"
      >
        {{ detecting ? 'Проверка...' : 'Проверить снова' }}
      </button>
    </div>

    <div v-else-if="phase === 'error'" class="auto-kill-banner-actions">
      <button
        type="button"
        class="btn btn-sm btn-primary"
        :disabled="detecting || toggling"
        @click="onRetry"
      >
        {{ detecting || toggling ? 'Пробуем...' : 'Попробовать снова' }}
      </button>
      <button type="button" class="btn btn-sm btn-ghost" @click="openNpcapDownload">
        Установить Npcap
      </button>
    </div>

    <div v-else class="auto-kill-banner-actions">
      <label
        class="auto-kill-toggle control control--elev"
        :aria-disabled="toggling ? 'true' : undefined"
      >
        <input
          type="checkbox"
          :checked="settings.autoKillTrackEnabled || phase === 'on' || phase === 'starting'"
          :disabled="toggling"
          @change="onToggle(($event.target as HTMLInputElement).checked)"
        >
        <span>Включить автотаймер</span>
      </label>
    </div>

    <p class="auto-kill-banner-disclaimer hint">
      Не меняет клиент игры. На свой риск.
    </p>
  </section>
</template>
