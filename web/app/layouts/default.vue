<script setup lang="ts">
import { LayoutDashboard, Package, Settings, Swords, Timer } from '@lucide/vue'
import {
  applyRaceDocumentTheme,
  RACE_ICON,
  RACE_LABEL_RU,
  REGION_LABEL_RU,
  type PlayerRace,
} from '../../shared/race'
import { useSettingsStore } from '../../stores/settings'

const route = useRoute()
const showSettings = ref(false)
const settings = useSettingsStore()

const nav = [
  { to: '/', label: 'Боссы', hint: 'Таймеры полевых боссов', icon: Timer },
  { to: '/session', label: 'Сессия', hint: 'Кины, лут, киллы', icon: LayoutDashboard },
  { to: '/items', label: 'Предметы', hint: 'Дроп и карта', icon: Package },
  { to: '/monsters', label: 'Монстры', hint: 'Спаун и дроп', icon: Swords },
] as const

const raceOptions: Array<{ id: PlayerRace, label: string, icon: string }> = [
  { id: 'elyos', label: 'Элийцы', icon: RACE_ICON.elyos },
  { id: 'asmodian', label: 'Асмодиане', icon: RACE_ICON.asmodian },
]

const brandSub = computed(() => {
  const race = settings.race
  return `${RACE_LABEL_RU[race]} · ${REGION_LABEL_RU[settings.regionId]}`
})

function isNavActive(to: string) {
  const path = route.path || '/'
  if (to === '/') return path === '/'
  return path === to || path.startsWith(`${to}/`)
}

function setRace(race: PlayerRace) {
  settings.setRace(race)
}

watch(
  () => settings.race,
  (race) => applyRaceDocumentTheme(race),
  { immediate: true },
)
</script>

<template>
  <div class="app-shell" :data-race="settings.race">
    <aside class="app-sidebar" aria-label="Инструменты">
      <div class="sidebar-brand">
        <p class="sidebar-brand-mark">
          AION 2
        </p>
        <p class="sidebar-brand-sub">
          {{ brandSub }}
        </p>
        <div
          class="sidebar-race"
          role="group"
          aria-label="Раса"
        >
          <button
            v-for="opt in raceOptions"
            :key="opt.id"
            type="button"
            class="control control--ghost sidebar-race-btn"
            :class="{ 'is-active': settings.race === opt.id }"
            :aria-pressed="settings.race === opt.id"
            :aria-label="opt.label"
            :title="opt.label"
            @click="setRace(opt.id)"
          >
            <img
              class="sidebar-race-icon"
              :src="opt.icon"
              :alt="opt.label"
              width="128"
              height="128"
              decoding="async"
              draggable="false"
            >
            <span class="sidebar-race-label">{{ opt.label }}</span>
          </button>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="Разделы">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="control control--ghost sidebar-nav-link"
          :class="{ 'is-active': isNavActive(item.to) }"
        >
          <component :is="item.icon" class="ui-icon sidebar-nav-icon" aria-hidden="true" />
          <span class="sidebar-nav-copy">
            <span class="sidebar-nav-label">{{ item.label }}</span>
            <span class="sidebar-nav-hint">{{ item.hint }}</span>
          </span>
        </NuxtLink>
      </nav>

      <div class="sidebar-rift">
        <RiftSidebar />
      </div>

      <div class="sidebar-foot">
        <button
          type="button"
          class="control control--ghost sidebar-util-btn"
          aria-label="Настройки"
          @click="showSettings = true"
        >
          <Settings class="ui-icon" aria-hidden="true" />
          <span>Настройки</span>
        </button>
      </div>
    </aside>

    <div class="app-shell-main">
      <slot />
    </div>

    <UiAppModal
      v-model:open="showSettings"
      title="Настройки"
      description="Локально на этом ПК. Сохраняется автоматически."
      size="lg"
    >
      <SettingsPanel />
    </UiAppModal>

    <AlertOverlay />
  </div>
</template>
