<script setup lang="ts">
import { Swords } from '@lucide/vue'
import type { AutoKillStatusPayload } from '../../types/aion-tracker'
import { catalogStatus, ensureItemCatalog } from '../../../shared/items/catalog'
import { gradeClass } from '../../../shared/items/grade'
import {
  sessionAbyssIcon,
  sessionKinahIcon,
  sessionRowView,
} from '../../../shared/session/display'
import { formatDayLabel, localDayKey } from '../../../shared/session/rules'
import type { SessionDropRow } from '../../../shared/session/types'
import { useSessionStore } from '../../../stores/session'
import { useSettingsStore } from '../../../stores/settings'
import ItemIcon from '../../components/ItemIcon.vue'
import AppSearchInput from '../../components/ui/AppSearchInput.vue'
import UiAppModal from '../../components/ui/AppModal.vue'

const session = useSessionStore()
const settings = useSettingsStore()

const isDesktop = ref(false)
const liveStatus = ref<AutoKillStatusPayload | null>(null)
const toggling = ref(false)
const showClear = ref(false)
const resourceQuery = ref('')
const showAllResources = ref(false)
let offStatus: (() => void) | undefined
let clockTimer: ReturnType<typeof setInterval> | undefined
const nowMs = ref(Date.now())

const kinahIcon = computed(() => {
  void catalogStatus.value
  return sessionKinahIcon()
})
const abyssIcon = computed(() => {
  void catalogStatus.value
  return sessionAbyssIcon()
})

onMounted(() => {
  isDesktop.value = Boolean(window.aionTracker?.getAutoKillStatus)
  void ensureItemCatalog().then(() => {
    session.enrichFromCatalog()
  }).catch(() => {})
  void refreshStatus()
  offStatus = window.aionTracker?.onAutoKillStatus?.((payload) => {
    liveStatus.value = payload
  })
  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 15_000)
})

onBeforeUnmount(() => {
  offStatus?.()
  if (clockTimer) clearInterval(clockTimer)
})

async function refreshStatus() {
  if (!window.aionTracker?.getAutoKillStatus) return
  liveStatus.value = await window.aionTracker.getAutoKillStatus()
}

type CapturePhase = 'browser' | 'need_npcap' | 'off' | 'starting' | 'on' | 'error'

const capturePhase = computed<CapturePhase>(() => {
  if (!isDesktop.value) return 'browser'
  const st = liveStatus.value?.status
  if (st === 'listening') return 'on'
  if (st === 'starting') return 'starting'
  if (st === 'missing_npcap') return 'need_npcap'
  if (st === 'error') return 'error'
  if (!settings.autoKillTrackEnabled) return 'off'
  return 'starting'
})

const captureLabel = computed(() => {
  switch (capturePhase.value) {
    case 'browser':
      return 'Только в приложении'
    case 'need_npcap':
      return 'Нужен Npcap'
    case 'off':
      return 'Захват выключен'
    case 'starting':
      return 'Запуск…'
    case 'on':
      return 'Слушаем игру'
    case 'error':
      return 'Ошибка захвата'
    default:
      return '—'
  }
})

const captureTone = computed(() => {
  switch (capturePhase.value) {
    case 'on':
      return 'ok'
    case 'need_npcap':
    case 'error':
    case 'off':
      return 'bad'
    case 'starting':
      return 'warn'
    default:
      return 'muted'
  }
})

const captureHelp = computed(() => {
  switch (capturePhase.value) {
    case 'browser':
      return 'Метрики сессии пишутся только в десктоп-приложении с Npcap.'
    case 'need_npcap':
      return 'Установи Npcap (баннер на странице Боссы), затем включи автотаймер.'
    case 'off':
      return 'Сессия использует тот же перехват, что и автотаймер боссов. Включи его — метрики начнут копиться.'
    case 'starting':
      return 'Подключаем Npcap…'
    case 'on':
      return session.lastEventAt
        ? `Последнее событие: ${formatClock(session.lastEventAt)} · ${session.lastEventSummary}`
        : 'Автотаймер работает. Убей моба, подбери лут или собери ресурс.'
    case 'error':
      return 'Не удалось запустить захват. Проверь Npcap на странице Боссы.'
    default:
      return ''
  }
})

const day = computed(() => session.current)
const isToday = computed(() => session.selectedDayKey === localDayKey())
const hoursToReset = computed(() => {
  if (!isToday.value) return null
  const d = new Date(nowMs.value)
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  return Math.max(0, Math.ceil((next.getTime() - nowMs.value) / 3_600_000))
})

const filteredResources = computed(() => {
  const q = resourceQuery.value.trim().toLowerCase()
  let list = day.value.resources
  if (q) {
    list = list.filter((row) => sessionRowView(row).name.toLowerCase().includes(q))
  }
  if (!showAllResources.value && !q) {
    return list.slice(0, session.rules.resourcesTopN)
  }
  return list
})

const resourcesHidden = computed(() => {
  if (resourceQuery.value.trim() || showAllResources.value) return 0
  return Math.max(0, day.value.resources.length - session.rules.resourcesTopN)
})

function formatNet(n: number): string {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toLocaleString('ru-RU')}`
}

function formatClock(at: number): string {
  return new Date(at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDropRate(row: SessionDropRow): string {
  if (row.attempts < session.rules.dropRateMinKills) return 'мало данных'
  if (row.rate == null || !Number.isFinite(row.rate)) return '—'
  return `~${(row.rate * 100).toFixed(1)}%`
}

function dropSourceLabel(row: SessionDropRow): string {
  return row.npcName || (row.npcId != null ? `NPC ${row.npcId}` : 'моб')
}

function dropRowKey(row: SessionDropRow): string {
  return `m:${row.npcId}:${row.itemId}`
}

function selectDay(key: string) {
  session.selectDay(key)
  showAllResources.value = false
  resourceQuery.value = ''
}

async function enableCapture() {
  if (!window.aionTracker?.setAutoKillTrack && !window.aionTracker?.ensureAutoKillTrack) return
  toggling.value = true
  try {
    settings.setAutoKillTrackEnabled(true)
    if (window.aionTracker.ensureAutoKillTrack) {
      liveStatus.value = await window.aionTracker.ensureAutoKillTrack()
    }
    else if (window.aionTracker.setAutoKillTrack) {
      liveStatus.value = await window.aionTracker.setAutoKillTrack(true)
    }
  }
  finally {
    toggling.value = false
  }
}

function confirmClear() {
  session.clearDay(session.selectedDayKey)
  showClear.value = false
}
</script>

<template>
  <div class="page-session">
    <div class="app-body is-single">
      <div class="app-primary">
        <div class="tracker-bar session-bar">
          <div
            class="session-capture"
            :data-tone="captureTone"
            aria-live="polite"
          >
            <div class="session-capture-main">
              <span class="session-capture-dot" aria-hidden="true" />
              <span class="session-capture-label">{{ captureLabel }}</span>
              <p class="session-capture-help">
                {{ captureHelp }}
              </p>
            </div>
            <button
              v-if="capturePhase === 'off'"
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="toggling"
              @click="enableCapture"
            >
              Включить захват
            </button>
            <NuxtLink
              v-else-if="capturePhase === 'need_npcap' || capturePhase === 'error'"
              to="/"
              class="btn btn-sm btn-ghost"
            >
              К боссам / Npcap
            </NuxtLink>
          </div>

          <div class="boss-stats session-stats" aria-label="Сводка сессии">
            <div class="stat session-stat">
              <ItemIcon
                class="session-stat-icon"
                :src="kinahIcon"
                alt="Кины"
                :size="1.75"
              />
              <div class="session-stat-copy">
                <span class="stat-label">Кины (net)</span>
                <span class="stat-value" :class="{ 'is-ready': day.kinahNet > 0 }">{{ formatNet(day.kinahNet) }}</span>
                <span class="stat-sub">+{{ day.kinahGained.toLocaleString('ru-RU') }} / −{{ day.kinahSpent.toLocaleString('ru-RU') }}</span>
              </div>
            </div>
            <div class="stat session-stat">
              <ItemIcon
                class="session-stat-icon"
                :src="abyssIcon"
                alt="Очки бездны"
                :size="1.75"
              />
              <div class="session-stat-copy">
                <span class="stat-label">Очки бездны (net)</span>
                <span class="stat-value" :class="{ 'is-ready': day.abyssNet > 0 }">{{ formatNet(day.abyssNet) }}</span>
                <span class="stat-sub">+{{ day.abyssGained.toLocaleString('ru-RU') }} / −{{ day.abyssSpent.toLocaleString('ru-RU') }}</span>
              </div>
            </div>
            <div class="stat session-stat">
              <span class="session-stat-icon session-stat-icon--lucide" aria-hidden="true">
                <Swords class="ui-icon" />
              </span>
              <div class="session-stat-copy">
                <span class="stat-label">Убийства</span>
                <span class="stat-value">{{ day.monsterKills.toLocaleString('ru-RU') }}</span>
                <span class="stat-sub">свои (урон до смерти)</span>
              </div>
            </div>
          </div>

          <div class="session-toolbar">
            <div class="session-days" role="listbox" aria-label="День сессии">
              <button
                v-for="row in session.historyLabels"
                :key="row.key"
                type="button"
                role="option"
                class="session-day-chip"
                :class="{ 'is-active': row.key === session.selectedDayKey }"
                :aria-selected="row.key === session.selectedDayKey"
                @click="selectDay(row.key)"
              >
                <span>{{ row.label }}</span>
                <span v-if="row.key === localDayKey()" class="session-day-chip-tag">сегодня</span>
              </button>
            </div>
            <p class="session-day-hint">
              День = локальная полночь.
              <template v-if="isToday && hoursToReset != null">
                Новый день через ~{{ hoursToReset }} ч.
              </template>
            </p>
            <button
              type="button"
              class="control control--ghost session-clear-btn"
              :disabled="session.currentIsEmpty"
              @click="showClear = true"
            >
              Сбросить день
            </button>
          </div>
        </div>

        <div
          v-if="session.currentIsEmpty"
          class="session-onboard"
        >
          <h2 class="session-onboard-title">
            {{ isToday ? 'Сегодня пока пусто' : 'В этот день записей нет' }}
          </h2>
          <p class="session-onboard-body">
            При включённом захвате метрики появятся сами:
          </p>
          <ol class="session-onboard-steps">
            <li>Убей обычного моба (свой урон).</li>
            <li>Подбери лут с земли.</li>
          </ol>
          <p
            v-if="capturePhase === 'off' || capturePhase === 'need_npcap'"
            class="session-onboard-warn"
          >
            Сейчас захват не активен — сначала включи его выше или на странице Боссы.
          </p>
        </div>

        <div
          v-else
          class="session-grid"
        >
          <section class="session-panel" aria-labelledby="session-resources">
            <h2 id="session-resources" class="session-panel-title">
              Ресурсы / лут
            </h2>
            <p class="session-panel-sub">
              Подобранный лут за день
            </p>
            <AppSearchInput
              v-if="day.resources.length > 6"
              v-model="resourceQuery"
              class="session-resource-search"
              placeholder="Поиск предмета…"
            />
            <ul v-if="filteredResources.length" class="session-list">
              <li
                v-for="row in filteredResources"
                :key="row.itemId"
                class="session-list-row"
              >
                <ItemIcon
                  :src="sessionRowView(row).icon"
                  :alt="sessionRowView(row).name"
                  :size="1.75"
                />
                <span class="session-list-name">
                  <span
                    class="session-item-name"
                    :class="gradeClass(sessionRowView(row).grade)"
                  >
                    {{ sessionRowView(row).name }}
                  </span>
                </span>
                <span class="session-list-meta">{{ row.count.toLocaleString('ru-RU') }} · {{ row.picks }} подбор.</span>
              </li>
            </ul>
            <p v-else-if="resourceQuery.trim()" class="session-empty">
              Ничего не найдено по запросу.
            </p>
            <button
              v-if="resourcesHidden > 0"
              type="button"
              class="session-more-btn"
              @click="showAllResources = true"
            >
              Ещё {{ resourcesHidden }}…
            </button>
          </section>

          <section class="session-panel" aria-labelledby="session-kills">
            <h2 id="session-kills" class="session-panel-title">
              Монстры
            </h2>
            <p class="session-panel-sub">
              Свои убийства (урон перед смертью, не kill credit)
            </p>
            <ul v-if="day.kills.length" class="session-list">
              <li
                v-for="row in day.kills"
                :key="row.npcId"
                class="session-list-row"
              >
                <span class="session-stat-icon session-stat-icon--lucide session-list-ph" aria-hidden="true">
                  <Swords class="ui-icon" />
                </span>
                <span class="session-list-name">{{ row.name || `NPC ${row.npcId}` }}</span>
                <span class="session-list-meta">×{{ row.count }}</span>
              </li>
            </ul>
            <p v-else class="session-empty">
              Убийств пока нет.
            </p>
          </section>

          <section class="session-panel" aria-labelledby="session-drops">
            <h2 id="session-drops" class="session-panel-title">
              Оценка дропа
            </h2>
            <p class="session-panel-sub">
              Лут в окне после килла. Не вики-шанс.
            </p>
            <ul v-if="day.drops.length" class="session-list">
              <li
                v-for="row in day.drops"
                :key="dropRowKey(row)"
                class="session-list-row"
              >
                <ItemIcon
                  :src="sessionRowView(row).icon"
                  :alt="sessionRowView(row).name"
                  :size="1.75"
                />
                <span class="session-list-name">
                  <span
                    class="session-item-name"
                    :class="gradeClass(sessionRowView(row).grade)"
                  >
                    {{ sessionRowView(row).name }}
                  </span>
                  <span class="session-list-sub">{{ dropSourceLabel(row) }}</span>
                </span>
                <span class="session-list-meta">
                  {{ row.picks }}/{{ row.attempts }} · {{ formatDropRate(row) }}
                </span>
              </li>
            </ul>
            <p v-else class="session-empty">
              Нужны убийства с подобранным лутом.
            </p>
          </section>
        </div>
      </div>
    </div>

    <UiAppModal
      v-model:open="showClear"
      title="Сбросить день?"
      description="Метрики выбранного дня обнулятся. Отменить нельзя."
      size="sm"
    >
      <p class="session-clear-copy">
        {{ formatDayLabel(session.selectedDayKey) }}
        — кины, AP, лут и убийства будут удалены.
      </p>
      <template #footer>
        <button type="button" class="btn" @click="showClear = false">
          Отмена
        </button>
        <button type="button" class="btn btn-primary" @click="confirmClear">
          Сбросить
        </button>
      </template>
    </UiAppModal>
  </div>
</template>
