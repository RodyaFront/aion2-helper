<script setup lang="ts">
import { useRiftStore } from '../../stores/rift'

const rift = useRiftStore()

const timerLabel = computed(() =>
  rift.isPortalOpen ? 'До закрытия' : 'До открытия',
)

const timerValue = computed(() =>
  rift.isPortalOpen ? rift.portalCountdown : rift.nextCountdown,
)

const statusTone = computed(() => (rift.isPortalOpen ? 'open' : 'closed'))

const statusLabel = computed(() =>
  rift.isPortalOpen ? 'Открыт' : 'Закрыт',
)

const metaLine = computed(() =>
  rift.isPortalOpen ? 'Вход открыт' : `След. · ${rift.nextOpenLabel}`,
)
</script>

<template>
  <section
    class="rift-banner"
    :class="{ 'is-open': rift.isPortalOpen }"
    aria-label="Разлом пространства"
  >
    <div
      class="rift-banner-visual"
      aria-hidden="true"
    >
      <img
        class="rift-banner-art"
        src="/rift/portal.webp?v=7"
        alt=""
        width="128"
        height="128"
        decoding="async"
        draggable="false"
      >
    </div>

    <div class="rift-banner-body">
      <div class="rift-banner-head">
        <p class="rift-banner-title">
          Разлом
        </p>
        <p
          class="rift-banner-status"
          :class="`is-${statusTone}`"
          role="status"
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
      <p class="rift-banner-meta">
        {{ metaLine }}
      </p>
    </div>
  </section>
</template>
