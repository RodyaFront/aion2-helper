<script setup lang="ts">
import { RIFT_UTC_HOURS } from '../../shared/rift'
import { useRiftStore } from '../../stores/rift'
import { useSettingsStore } from '../../stores/settings'

const rift = useRiftStore()
const settings = useSettingsStore()

const mode = computed(() => rift.bannerMode)

const statusTone = computed(() => mode.value)

const statusLabel = computed(() => {
  if (mode.value === 'portal') return 'Открыт'
  if (mode.value === 'in-event') return 'В ивенте'
  return 'Закрыт'
})

const timerLabel = computed(() => {
  if (mode.value === 'portal') return 'До закрытия входа'
  if (mode.value === 'in-event') return 'Внутри'
  return 'До открытия'
})

const timerValue = computed(() => {
  if (mode.value === 'portal') return rift.portalCountdown
  if (mode.value === 'in-event') return rift.eventCountdown ?? '-'
  return rift.nextCountdown
})

const metaLine = computed(() => {
  if (mode.value === 'portal') return null
  return `След. · ${rift.nextOpenLabelLocal}`
})

const scheduleHours = RIFT_UTC_HOURS.map((h) => `${String(h).padStart(2, '0')}:00 UTC`)

const soundOn = computed(() => settings.riftSoundEnabled)

const muteLabel = computed(() =>
  soundOn.value ? 'Выключить оповещения разлома' : 'Включить оповещения разлома',
)

function toggleRiftSound() {
  settings.setRiftSoundEnabled(!settings.riftSoundEnabled)
}
</script>

<template>
  <section
    class="rift-banner"
    :class="{
      'is-portal': mode === 'portal',
      'is-in-event': mode === 'in-event',
      'is-idle': mode === 'idle',
      'is-muted': !soundOn,
    }"
    aria-label="Разлом пространства"
  >
    <div
      class="rift-banner-visual"
      aria-hidden="true"
    >
      <div class="rift-orb">
        <svg
          class="rift-orb-filters"
          width="0"
          height="0"
          aria-hidden="true"
          focusable="false"
        >
          <filter
            id="rift-corona-noise"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="1.1"
              numOctaves="4"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="12"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </svg>
        <span class="rift-orb-corona" />
        <span class="rift-orb-wisp rift-orb-wisp-a" />
        <span class="rift-orb-wisp rift-orb-wisp-b" />
        <span class="rift-orb-wisp rift-orb-wisp-c" />
        <span class="rift-orb-wisp rift-orb-wisp-d" />
        <span class="rift-orb-echo" />
        <span class="rift-orb-rim" />
        <span class="rift-orb-disk" />
        <span class="rift-orb-hotspot" />
      </div>
    </div>

    <button
      type="button"
      class="btn btn-icon btn-sm btn-ghost rift-banner-mute"
      :class="{ 'is-muted': !soundOn }"
      :aria-pressed="!soundOn"
      :aria-label="muteLabel"
      :title="muteLabel"
      @click="toggleRiftSound"
    >
      <svg
        class="rift-banner-mute-icon"
        viewBox="0 0 16 16"
        width="18"
        height="18"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M2 6.25v3.5c0 .414.336.75.75.75H4.8L8 13.25V2.75L4.8 5.5H2.75A.75.75 0 0 0 2 6.25Z"
        />
        <path
          v-if="soundOn"
          fill="none"
          stroke="currentColor"
          stroke-width="1.25"
          stroke-linecap="round"
          d="M10 6.2a2.2 2.2 0 0 1 0 3.6M11.7 4.6a4.4 4.4 0 0 1 0 6.8"
        />
        <path
          v-else
          fill="none"
          stroke="currentColor"
          stroke-width="1.35"
          stroke-linecap="round"
          d="M10.2 5.2 14 12.2"
        />
      </svg>
    </button>

    <div class="rift-banner-body">
      <div class="rift-banner-head">
        <p class="rift-banner-title">
          Разлом
        </p>
        <p
          class="rift-banner-status"
          :class="`is-${statusTone}`"
          role="status"
          aria-live="polite"
        >
          <span class="rift-banner-status-dot" aria-hidden="true" />
          {{ statusLabel }}
        </p>
      </div>

      <p class="rift-banner-timer-label">
        {{ timerLabel }}
      </p>
      <p class="rift-banner-countdown">
        {{ timerValue }}
      </p>
      <p
        v-if="metaLine"
        class="rift-banner-meta"
      >
        {{ metaLine }}
      </p>

      <details class="rift-banner-schedule">
        <summary class="btn btn-sm btn-ghost rift-banner-schedule-summary">
          <span>Расписание</span>
          <svg
            class="rift-banner-schedule-chevron"
            viewBox="0 0 12 12"
            width="12"
            height="12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 4.5 6 7.5 9 4.5"
            />
          </svg>
        </summary>
        <ul class="rift-banner-schedule-list">
          <li
            v-for="slot in scheduleHours"
            :key="slot"
          >
            {{ slot }}
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>
