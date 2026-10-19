<script setup lang="ts">
import type { BossWarnTier } from '../../shared/bosses'
import {
  bossReadySpeech,
  bossWarnSpeech,
} from '../../shared/speakLines'
import { notifyNative } from '../../shared/notify'
import { useRiftStore } from '../../stores/rift'
import { useSettingsStore } from '../../stores/settings'
import { useAlertSound } from '../composables/useAlertSound'
import { useSpeechAlert } from '../composables/useSpeechAlert'
import SegmentedControl from './ui/SegmentedControl.vue'

const DEMO_BOSS = 'Bloodfang Pnyn'

const settings = useSettingsStore()
const rift = useRiftStore()
const { unlockAudio, playBossWarn, playAlarmBurst } = useAlertSound()
const { speakAlert, stopSpeech, ensureVoices } = useSpeechAlert()

type SettingsTab = 'params' | 'tests'

const tab = ref<SettingsTab>('params')
const tabOptions = [
  { id: 'params', label: 'Параметры' },
  { id: 'tests', label: 'Проверка' },
]

const volume = computed({
  get: () => settings.alertVolume,
  set: (value: number) => settings.setAlertVolume(value),
})

const bossSoundEnabled = computed({
  get: () => settings.bossSoundEnabled,
  set: (value: boolean) => settings.setBossSoundEnabled(value),
})

const riftSoundEnabled = computed({
  get: () => settings.riftSoundEnabled,
  set: (value: boolean) => settings.setRiftSoundEnabled(value),
})

const ttsEnabled = computed({
  get: () => settings.ttsEnabled,
  set: (value: boolean) => settings.setTtsEnabled(value),
})

const muteHint = computed(() => {
  if (volume.value === 0) return 'Громкость 0% — звук и голос выключены. Windows-toast всё ещё может появиться.'
  if (!ttsEnabled.value) return 'Голос выключен — тесты играют только звук и toast.'
  return null
})

onMounted(() => {
  ensureVoices()
})

onBeforeUnmount(() => {
  stopSpeech()
})

const BOSS_TIER_META: Record<BossWarnTier, { thresholdSec: number, title: string, body: string, label: string, hint: string }> = {
  ping: {
    thresholdSec: 900,
    title: 'Тест: ping (15 мин)',
    body: 'Предупреждение босса',
    label: '15 мин',
    hint: 'ping + голос',
  },
  warning: {
    thresholdSec: 600,
    title: 'Тест: warning (10 мин)',
    body: 'Предупреждение босса',
    label: '10 мин',
    hint: 'warning + голос',
  },
  alert: {
    thresholdSec: 10,
    title: 'Тест: ALERT (10 сек)',
    body: 'Срочное предупреждение босса',
    label: '10 сек',
    hint: 'ALERT + голос',
  },
}

function previewBossTier(tier: BossWarnTier) {
  unlockAudio()
  ensureVoices()
  const meta = BOSS_TIER_META[tier]
  notifyNative(meta.title, meta.body)
  if (settings.bossSoundEnabled) void playBossWarn(tier)
  speakAlert(bossWarnSpeech(DEMO_BOSS, meta.thresholdSec))
}

function previewBossReady() {
  unlockAudio()
  ensureVoices()
  notifyNative('Тест: будильник', 'Звук респауна босса')
  if (settings.bossSoundEnabled) playAlarmBurst()
  speakAlert(bossReadySpeech(DEMO_BOSS))
}

function previewRiftWarn(mins: 15 | 10) {
  unlockAudio()
  ensureVoices()
  rift.alertWarn(mins * 60 * 1000)
}

function previewRiftOpen() {
  unlockAudio()
  ensureVoices()
  rift.alertOpened()
}

function stopPreview() {
  stopSpeech()
}
</script>

<template>
  <div class="settings-panel">
    <SegmentedControl
      v-model="tab"
      class="settings-tabs"
      :options="tabOptions"
      aria-label="Разделы настроек"
    />

    <section v-if="tab === 'params'" class="settings-section" aria-labelledby="settings-sound-heading">
      <header class="settings-section-head">
        <h3 id="settings-sound-heading" class="settings-section-title">
          Звук и голос
        </h3>
        <p class="settings-section-desc">
          Общая громкость для SFX и TTS. Имя босса — EN (Piper), фраза — RU (Piper).
        </p>
      </header>

      <div class="settings-field">
        <label class="settings-field-label" for="alert-volume">
          <span>Громкость</span>
          <span class="settings-field-value">{{ volume }}%</span>
        </label>
        <input
          id="alert-volume"
          v-model.number="volume"
          class="volume-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="volume"
        >
      </div>

      <label class="control control--elev settings-switch" for="boss-sound-enabled">
        <span class="settings-switch-copy">
          <span class="settings-switch-title">Звуковые оповещения боссов</span>
          <span class="settings-switch-desc">Предупреждения и будильник респауна</span>
        </span>
        <input
          id="boss-sound-enabled"
          v-model="bossSoundEnabled"
          class="settings-switch-input"
          type="checkbox"
        >
      </label>

      <label class="control control--elev settings-switch" for="rift-sound-enabled">
        <span class="settings-switch-copy">
          <span class="settings-switch-title">Звуковые оповещения разлома</span>
          <span class="settings-switch-desc">Предупреждения и звук открытия портала</span>
        </span>
        <input
          id="rift-sound-enabled"
          v-model="riftSoundEnabled"
          class="settings-switch-input"
          type="checkbox"
        >
      </label>

      <label class="control control--elev settings-switch" for="tts-enabled">
        <span class="settings-switch-copy">
          <span class="settings-switch-title">Голосовые оповещения</span>
          <span class="settings-switch-desc">Произносит имя босса и фразу при каждом toast</span>
        </span>
        <input
          id="tts-enabled"
          v-model="ttsEnabled"
          class="settings-switch-input"
          type="checkbox"
        >
      </label>

      <p v-if="muteHint" class="settings-note">
        {{ muteHint }}
      </p>
    </section>

    <section v-else class="settings-section" aria-labelledby="settings-tests-heading">
      <header class="settings-section-head">
        <h3 id="settings-tests-heading" class="settings-section-title">
          Проверка оповещений
        </h3>
        <p class="settings-section-desc">
          Как в бою: Windows-toast + звук + Piper-озвучка (если голос включён).
        </p>
      </header>

      <div class="settings-test-group">
        <h4 class="settings-test-group-title">
          Боссы
        </h4>
        <div class="settings-test-grid">
          <button
            v-for="(meta, tier) in BOSS_TIER_META"
            :key="tier"
            type="button"
            class="btn settings-test-btn"
            @click="previewBossTier(tier)"
          >
            <span class="settings-test-btn-label">{{ meta.label }}</span>
            <span class="settings-test-btn-hint">{{ meta.hint }}</span>
          </button>
          <button
            type="button"
            class="btn settings-test-btn settings-test-btn-accent"
            @click="previewBossReady"
          >
            <span class="settings-test-btn-label">Респаун</span>
            <span class="settings-test-btn-hint">будильник + голос</span>
          </button>
        </div>
      </div>

      <div class="settings-test-group">
        <h4 class="settings-test-group-title">
          Разлом
        </h4>
        <div class="settings-test-grid">
          <button
            type="button"
            class="btn settings-test-btn"
            @click="previewRiftWarn(15)"
          >
            <span class="settings-test-btn-label">15 мин</span>
            <span class="settings-test-btn-hint">предупреждение</span>
          </button>
          <button
            type="button"
            class="btn settings-test-btn"
            @click="previewRiftWarn(10)"
          >
            <span class="settings-test-btn-label">10 мин</span>
            <span class="settings-test-btn-hint">предупреждение</span>
          </button>
          <button
            type="button"
            class="btn settings-test-btn settings-test-btn-accent"
            @click="previewRiftOpen"
          >
            <span class="settings-test-btn-label">Открыт</span>
            <span class="settings-test-btn-hint">портал + голос</span>
          </button>
        </div>
      </div>

      <div class="settings-test-footer">
        <button type="button" class="btn btn-sm btn-ghost" @click="stopPreview">
          Остановить голос
        </button>
        <p v-if="muteHint" class="settings-note settings-note-inline">
          {{ muteHint }}
        </p>
      </div>
    </section>
  </div>
</template>
