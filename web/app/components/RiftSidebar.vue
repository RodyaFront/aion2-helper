<script setup lang="ts">
import { useRiftStore } from '../../stores/rift'

const rift = useRiftStore()

const timerLabel = computed(() =>
  rift.isPortalOpen ? 'До закрытия портала' : 'До открытия',
)

const timerValue = computed(() =>
  rift.isPortalOpen ? rift.portalCountdown : rift.nextCountdown,
)

/** open = urgency; closed = calm wait */
const statusTone = computed(() => (rift.isPortalOpen ? 'open' : 'closed'))

const statusLabel = computed(() =>
  rift.isPortalOpen ? 'Портал открыт' : 'Портал закрыт',
)
</script>

<template>
  <aside class="rift-sidebar" aria-label="Разлом пространства">
    <div class="rift-stack">
      <div
        class="rift-visual"
        :class="{ 'is-open': rift.isPortalOpen }"
        aria-hidden="true"
      >
        <img
          class="rift-art"
          src="/rift/portal.webp?v=7"
          alt=""
          width="512"
          height="512"
          draggable="false"
        >
      </div>

      <div class="rift-copy">
        <p class="rift-kicker">Spacetime Rift</p>
        <h2>Разлом пространства</h2>
        <p class="rift-timer-label">{{ timerLabel }}</p>
        <p class="rift-countdown">{{ timerValue }}</p>
        <p v-if="!rift.isPortalOpen" class="rift-meta">
          Следующий · {{ rift.nextOpenLabel }}
        </p>
        <p v-else class="rift-meta">
          Вход открыт · успей зайти
        </p>
      </div>

      <div
        class="rift-status"
        :class="`is-${statusTone}`"
        role="status"
      >
        <span class="rift-status-dot" aria-hidden="true" />
        <span class="rift-status-label">{{ statusLabel }}</span>
      </div>
    </div>
  </aside>
</template>
