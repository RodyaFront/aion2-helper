<script setup lang="ts">
import { Package, Settings, Timer } from '@lucide/vue'

const route = useRoute()
const showSettings = ref(false)

const nav = [
  { to: '/', label: 'Боссы', hint: 'Таймеры полевых боссов', icon: Timer },
  { to: '/items', label: 'Предметы', hint: 'Дроп и карта', icon: Package },
] as const

function isNavActive(to: string) {
  const path = route.path || '/'
  if (to === '/') return path === '/'
  return path === to || path.startsWith(`${to}/`)
}
</script>

<template>
  <div class="app-shell">
    <aside class="app-sidebar" aria-label="Инструменты">
      <div class="sidebar-brand">
        <p class="sidebar-brand-mark">
          AION 2
        </p>
        <p class="sidebar-brand-sub">
          Lamuatan · Verteron
        </p>
      </div>

      <nav class="sidebar-nav" aria-label="Разделы">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="sidebar-nav-link"
          :class="{ 'is-active': isNavActive(item.to) }"
        >
          <component :is="item.icon" class="ui-icon sidebar-nav-icon" aria-hidden="true" />
          <span class="sidebar-nav-copy">
            <span class="sidebar-nav-label">{{ item.label }}</span>
            <span class="sidebar-nav-hint">{{ item.hint }}</span>
          </span>
        </NuxtLink>
      </nav>

      <div class="sidebar-foot">
        <button
          type="button"
          class="sidebar-util-btn"
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
  </div>
</template>
