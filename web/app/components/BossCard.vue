<script setup lang="ts">
import { Bookmark, MapPinned, RotateCcw, Trash2 } from '@lucide/vue'
import { formatCountdown, formatInterval, parseHms, splitMinutes } from '../../shared/bosses'
import { getBossCoord } from '../../shared/map/regions'
import { useBossStore, type BossState } from '../../stores/bosses'
import { useSettingsStore } from '../../stores/settings'
import BossMapModal from './BossMapModal.vue'

const props = defineProps<{
  boss: BossState
  now: number
}>()

const store = useBossStore()
const settings = useSettingsStore()

const panel = ref<'none' | 'custom' | 'interval'>('none')
const customH = ref('')
const customM = ref('')
const customS = ref('')
const intervalH = ref('')
const intervalM = ref('')
const intervalS = ref('')
const imgBroken = ref(false)
const showMap = ref(false)
const imageSrc = computed(() => props.boss.image || '')
const hasMapCoord = computed(() => getBossCoord(settings.regionId, props.boss.id) != null)

function fillIntervalFromBoss() {
  const parts = splitMinutes(props.boss.respawnMinutes)
  intervalH.value = parts.h ? String(parts.h) : ''
  intervalM.value = parts.m ? String(parts.m) : ''
  intervalS.value = parts.s ? String(parts.s) : ''
}

watch(
  () => props.boss.respawnMinutes,
  () => {
    if (panel.value === 'interval') fillIntervalFromBoss()
  },
)

const remainingSec = computed(() => {
  if (props.boss.respawnAt == null) return null
  return (props.boss.respawnAt - props.now) / 1000
})

const status = computed(() => {
  const rem = remainingSec.value
  if (rem == null) return 'idle'
  if (rem <= 0) return 'ready'
  if (rem <= 15 * 60) return 'urgent'
  return 'active'
})

const statusLabel = computed(() => {
  switch (status.value) {
    case 'ready': return 'Готов'
    case 'urgent': return 'Скоро'
    case 'active': return 'Перерождается'
    default: return 'Нет таймера'
  }
})

const cardClass = computed(() => ({
  'is-idle': status.value === 'idle',
  'is-active': status.value === 'active',
  'is-urgent': status.value === 'urgent',
  'is-ready': status.value === 'ready',
}))

const countdownClass = computed(() => ({
  'is-idle': status.value === 'idle',
  'is-active': status.value === 'active',
  'is-ready': status.value === 'ready',
  'is-urgent': status.value === 'urgent',
}))

/** Ready + map pin: go there first. Idle: start timer. Ready without coords: kill. */
const showPrimaryMap = computed(() => status.value === 'ready' && hasMapCoord.value)
const showPrimaryKill = computed(() =>
  status.value === 'idle' || (status.value === 'ready' && !hasMapCoord.value),
)
const showSecondaryKill = computed(() =>
  status.value === 'ready' && hasMapCoord.value
    ? true
    : status.value === 'active' || status.value === 'urgent',
)

const killLabel = computed(() => {
  if (status.value === 'ready') return 'Убит снова'
  if (status.value === 'idle') return 'Убит'
  return 'Отметить убийство'
})

const countdownText = computed(() => {
  if (remainingSec.value == null) return '-'
  if (status.value === 'ready') return 'Готов'
  return formatCountdown(remainingSec.value)
})

const caption = computed(() => {
  if (status.value === 'idle') {
    return 'Появится после убийства или синка с карты в игре'
  }
  if (status.value === 'ready') {
    return hasMapCoord.value ? 'Открой карту и беги' : 'Можно фармить'
  }
  if (status.value === 'urgent') return 'Скоро респаун'
  return `До респауна · цикл ${formatInterval(props.boss.respawnMinutes)}`
})

function onKilled() {
  store.markKilled(props.boss.id)
  panel.value = 'none'
}

function applyCustom() {
  const minutes = parseHms(customH.value, customM.value, customS.value)
  if (!Number.isFinite(minutes) || minutes <= 0) return
  store.setCustomRemaining(props.boss.id, minutes)
  panel.value = 'none'
  customH.value = ''
  customM.value = ''
  customS.value = ''
}

function applyInterval() {
  const minutes = parseHms(intervalH.value, intervalM.value, intervalS.value)
  if (!Number.isFinite(minutes) || minutes < 1) return
  store.setIntervalMinutes(props.boss.id, minutes)
  panel.value = 'none'
}

function toggle(kind: 'custom' | 'interval') {
  if (panel.value === kind) {
    panel.value = 'none'
    return
  }
  panel.value = kind
  if (kind === 'interval') fillIntervalFromBoss()
}
</script>

<template>
  <article class="boss-card surface-interactive" :class="cardClass">
    <div class="boss-card-top">
      <div class="boss-art-wrap">
        <img
          v-if="imageSrc && !imgBroken"
          class="boss-art"
          :src="imageSrc"
          :alt="boss.name"
          width="120"
          height="120"
          loading="lazy"
          @error="imgBroken = true"
        >
        <div v-else class="boss-art-fallback" aria-hidden="true">
          {{ boss.name.slice(0, 1) }}
        </div>
      </div>

      <div class="boss-meta">
        <div class="boss-meta-head">
          <div class="boss-title-block">
            <h2>{{ boss.name }}</h2>
            <p v-if="boss.nameRu" class="name-ru">
              {{ boss.nameRu }}
            </p>
          </div>
          <UiAppTooltip :content="boss.favorite ? 'Убрать из избранного' : 'В избранное'">
            <button
              type="button"
              class="btn btn-icon btn-sm btn-ghost fav-btn"
              :class="{ 'is-on': boss.favorite }"
              :aria-pressed="boss.favorite"
              :aria-label="boss.favorite ? 'Убрать из избранного' : 'В избранное'"
              @click="store.toggleFavorite(boss.id)"
            >
              <Bookmark class="ui-icon" aria-hidden="true" :fill="boss.favorite ? 'currentColor' : 'none'" />
            </button>
          </UiAppTooltip>
        </div>
        <span class="status-chip" :class="`is-${status}`">{{ statusLabel }}</span>
        <p class="loc">
          {{ boss.location || 'Место не указано' }}
          <template v-if="boss.custom"> · свой</template>
        </p>
        <p class="interval">цикл {{ formatInterval(boss.respawnMinutes) }}</p>

        <div class="countdown-block">
          <div class="countdown" :class="countdownClass">
            {{ countdownText }}
          </div>
          <p class="countdown-caption">
            {{ caption }}
          </p>
        </div>
      </div>
    </div>

    <div class="boss-actions">
      <button
        v-if="showPrimaryMap"
        type="button"
        class="btn btn-ready"
        @click="showMap = true"
      >
        <MapPinned class="ui-icon" aria-hidden="true" />
        На карте
      </button>
      <button
        v-else-if="showPrimaryKill"
        type="button"
        class="btn btn-primary"
        @click="onKilled"
      >
        {{ killLabel }}
      </button>
      <div class="boss-actions-secondary">
        <button
          v-if="showSecondaryKill"
          type="button"
          class="btn btn-sm btn-ghost"
          @click="onKilled"
        >
          {{ killLabel }}
        </button>
        <button
          v-if="hasMapCoord && !showPrimaryMap"
          type="button"
          class="btn btn-sm btn-ghost"
          @click="showMap = true"
        >
          <MapPinned class="ui-icon" aria-hidden="true" />
          На карте
        </button>
        <button type="button" class="btn btn-sm btn-ghost" :aria-expanded="panel === 'custom'" @click="toggle('custom')">
          Своё время
        </button>
        <button
          v-if="boss.respawnAt != null"
          type="button"
          class="btn btn-sm btn-ghost"
          @click="store.clearTimer(boss.id)"
        >
          <RotateCcw class="ui-icon" aria-hidden="true" />
          Сбросить
        </button>
        <button type="button" class="btn btn-sm btn-ghost" :aria-expanded="panel === 'interval'" @click="toggle('interval')">
          Интервал
        </button>
        <button
          v-if="boss.custom"
          type="button"
          class="btn btn-sm btn-danger"
          @click="store.removeBoss(boss.id)"
        >
          <Trash2 class="ui-icon" aria-hidden="true" />
          Удалить
        </button>
      </div>
    </div>

    <div v-if="panel === 'custom'" class="inline-panel">
      <p class="countdown-caption">Сколько осталось (пустое поле = 0). Для всех сразу - список полевых боссов на карте в игре.</p>
      <div class="duration-fields">
        <label class="duration-field">
          <span>ч</span>
          <input
            v-model="customH"
            class="field-input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            @keydown.enter="applyCustom"
          >
        </label>
        <label class="duration-field">
          <span>мин</span>
          <input
            v-model="customM"
            class="field-input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            @keydown.enter="applyCustom"
          >
        </label>
        <label class="duration-field">
          <span>сек</span>
          <input
            v-model="customS"
            class="field-input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            @keydown.enter="applyCustom"
          >
        </label>
        <button type="button" class="btn btn-primary" @click="applyCustom">
          Запустить
        </button>
      </div>
    </div>

    <div v-else-if="panel === 'interval'" class="inline-panel">
      <p class="countdown-caption">Длина цикла респауна (пустое поле = 0)</p>
      <div class="duration-fields">
        <label class="duration-field">
          <span>ч</span>
          <input
            v-model="intervalH"
            class="field-input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            @keydown.enter="applyInterval"
          >
        </label>
        <label class="duration-field">
          <span>мин</span>
          <input
            v-model="intervalM"
            class="field-input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            @keydown.enter="applyInterval"
          >
        </label>
        <label class="duration-field">
          <span>сек</span>
          <input
            v-model="intervalS"
            class="field-input"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            @keydown.enter="applyInterval"
          >
        </label>
        <button type="button" class="btn btn-primary" @click="applyInterval">
          Сохранить
        </button>
      </div>
    </div>

    <BossMapModal
      v-model:open="showMap"
      :boss-id="boss.id"
      :boss-name="boss.name"
    />
  </article>
</template>
