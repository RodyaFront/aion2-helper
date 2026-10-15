<script setup lang="ts">
import { BellOff, Plus, X } from '@lucide/vue'
import { formatCountdown } from '../../shared/bosses'
import { useBossStore, type FilterMode } from '../../stores/bosses'
import { useRiftStore } from '../../stores/rift'
import AppSearchInput from '../components/ui/AppSearchInput.vue'
import SegmentedControl from '../components/ui/SegmentedControl.vue'

const store = useBossStore()
const rift = useRiftStore()
const searchRef = ref<{ focus: () => void } | null>(null)
const showAdd = ref(false)

const filters: Array<{ id: FilterMode, label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'favorite', label: 'Избранные' },
  { id: 'active', label: 'Перерождаются' },
  { id: 'ready', label: 'Готовы' },
  { id: 'idle', label: 'Без таймера' },
]

const filterLabel = computed(() => {
  return filters.find((f) => f.id === store.filter)?.label ?? 'Все'
})

const nextLabel = computed(() => {
  const next = store.nextBoss
  if (!next || next.respawnAt == null) return '—'
  const left = (next.respawnAt - store.now) / 1000
  return `${next.name} · ${formatCountdown(left)}`
})

const emptyCopy = computed(() => {
  if (store.query.trim()) return 'Ничего не найдено. Сбрось поиск или фильтр.'
  if (store.filter === 'favorite') return 'Нет избранных. Нажми закладку на карточке босса.'
  if (store.filter === 'ready') return 'Нет готовых боссов. Жди респаун или смени фильтр.'
  if (store.filter === 'active') return 'Нет перерождающихся боссов. Запусти убийством или «Своё время».'
  if (store.filter === 'idle') return 'Все боссы уже с таймером.'
  return 'Ничего не найдено. Сбрось фильтр или поиск.'
})

function onSlashFocus(e: KeyboardEvent) {
  if (showAdd.value) return
  if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    e.preventDefault()
    searchRef.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onSlashFocus)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onSlashFocus)
})
</script>

<template>
  <div class="page-bosses">
    <div class="app-body">
      <div class="app-primary">
        <div class="tracker-bar">
          <div class="boss-stats" aria-label="Сводка таймеров">
            <div class="stat">
              <span class="stat-label">Перерождаются</span>
              <span class="stat-value">{{ store.activeCount }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Готовы</span>
              <span class="stat-value is-ready">{{ store.readyCount }}</span>
            </div>
            <div class="stat boss-stat-next">
              <span class="stat-label">Ближайший</span>
              <span class="stat-value is-next">{{ nextLabel }}</span>
            </div>
          </div>

          <div class="toolbar">
            <AppSearchInput
              ref="searchRef"
              v-model="store.query"
              name="boss-search"
              placeholder="Поиск по имени или месту (EN/RU)…"
              aria-label="Поиск боссов"
            />
            <SegmentedControl
              v-model="store.filter"
              :options="filters"
              aria-label="Фильтр"
            />
            <button type="button" class="btn" @click="showAdd = true">
              <Plus class="ui-icon" aria-hidden="true" />
              Добавить босса
            </button>
          </div>
        </div>

        <main class="main">
          <div class="section-bar">
            <p class="section-label">
              В фильтре «{{ filterLabel }}»: {{ store.sortedBosses.length }} · всего {{ store.bosses.length }}
            </p>
            <p class="hint">
              <span class="kbd">/</span> поиск · «Своё время» — ч / мин / сек с карты
            </p>
          </div>

          <div v-if="store.sortedBosses.length" class="boss-grid">
            <BossCard
              v-for="boss in store.sortedBosses"
              :key="boss.id"
              :boss="boss"
              :now="store.now"
            />
          </div>
          <div v-else class="empty-state">
            {{ emptyCopy }}
          </div>
        </main>
      </div>

      <RiftSidebar />
    </div>

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

    <AddBossModal v-model:open="showAdd" />
  </div>
</template>
