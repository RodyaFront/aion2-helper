<script setup lang="ts">
import { MapPin, RotateCcw } from '@lucide/vue'
import {
  ensureItemDropIndex,
  listVerteronMobs,
  normalizeSearch,
} from '../../../shared/items/catalog'
import { gradeClass, normalizeItemGrade } from '../../../shared/items/grade'
import type { VerteronMob } from '../../../shared/items/types'
import ItemIcon from '../../components/ItemIcon.vue'
import MonsterSpawnMapModal from '../../components/MonsterSpawnMapModal.vue'
import AppFilterSelect from '../../components/ui/AppFilterSelect.vue'
import AppSearchInput from '../../components/ui/AppSearchInput.vue'
import AppVirtualList from '../../components/ui/AppVirtualList.vue'

const route = useRoute()
const router = useRouter()

const query = ref('')
const race = ref('all')
const creature = ref('all')
const grade = ref('all')
const level = ref('all')
const onlyWithSpawns = ref(false)
const sort = ref('name')
const status = ref<'loading' | 'ready' | 'error'>('loading')
const mobs = shallowRef<VerteronMob[]>([])
const mapMob = ref<VerteronMob | null>(null)
const showMap = ref(false)
const searchRef = ref<{ focus: () => void } | null>(null)
const listRef = ref<{ scrollToIndex: (i: number) => void } | null>(null)
const activeIndex = ref(-1)
const syncingUrl = ref(false)

const ROW_HEIGHT = 52

const levelOptions = [
  { value: 'all', label: 'Любой уровень' },
  { value: '1-15', label: '1–15' },
  { value: '16-30', label: '16–30' },
  { value: '31-44', label: '31–44' },
  { value: '45+', label: '45+' },
]

const gradeOptions = [
  { value: 'all', label: 'Все редкости' },
  { value: 'common', label: 'Common', keywords: 'common серый', swatch: 'var(--grade-common)' },
  { value: 'rare', label: 'Rare', keywords: 'rare зелёный', swatch: 'var(--grade-rare)' },
  { value: 'special', label: 'Special', keywords: 'special', swatch: 'var(--grade-special)' },
  { value: 'epic', label: 'Epic / Legend', keywords: 'epic legend синий', swatch: 'var(--grade-epic)' },
  { value: 'unique', label: 'Unique', keywords: 'unique жёлтый', swatch: 'var(--grade-unique)' },
  { value: 'heroic', label: 'Heroic', keywords: 'heroic mythic оранжевый', swatch: 'var(--grade-heroic)' },
]

const sortOptions = [
  { value: 'name', label: 'Имя' },
  { value: 'level', label: 'Уровень' },
  { value: 'spawns', label: 'Сначала с координатами' },
]

function raceLabel(value: string | null | undefined): string {
  if (!value) return 'Без расы'
  if (value === 'light') return 'Элийцы'
  if (value === 'dark') return 'Асмодиане'
  return value
}

function levelBand(lvl: number | null): string {
  if (lvl == null || !Number.isFinite(lvl)) return 'unknown'
  if (lvl <= 15) return '1-15'
  if (lvl <= 30) return '16-30'
  if (lvl <= 44) return '31-44'
  return '45+'
}

function pointsLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'координата'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'координаты'
  return 'координат'
}

function readQuery() {
  const q = route.query
  syncingUrl.value = true
  query.value = typeof q.q === 'string' ? q.q : ''
  race.value = typeof q.race === 'string' ? q.race : 'all'
  creature.value = typeof q.creature === 'string' ? q.creature : 'all'
  grade.value = typeof q.grade === 'string' ? q.grade : 'all'
  level.value = levelOptions.some((o) => o.value === q.lvl) ? String(q.lvl) : 'all'
  onlyWithSpawns.value = q.points === '1'
  const rawSort = typeof q.sort === 'string' ? q.sort : 'name'
  sort.value = sortOptions.some((o) => o.value === rawSort) ? rawSort : 'name'
  nextTick(() => {
    syncingUrl.value = false
  })
}

function writeQuery() {
  if (syncingUrl.value) return
  const next: Record<string, string> = {}
  if (query.value.trim()) next.q = query.value.trim()
  if (race.value !== 'all') next.race = race.value
  if (creature.value !== 'all') next.creature = creature.value
  if (grade.value !== 'all') next.grade = grade.value
  if (level.value !== 'all') next.lvl = level.value
  if (onlyWithSpawns.value) next.points = '1'
  if (sort.value !== 'name') next.sort = sort.value
  const cur = route.query
  const same
    = String(cur.q || '') === String(next.q || '')
      && String(cur.race || '') === String(next.race || '')
      && String(cur.creature || '') === String(next.creature || '')
      && String(cur.grade || '') === String(next.grade || '')
      && String(cur.lvl || '') === String(next.lvl || '')
      && String(cur.points || '') === String(next.points || '')
      && String(cur.sort || '') === String(next.sort || '')
  if (same) return
  router.replace({ query: next })
}

const raceOptions = computed(() => {
  const values = new Set<string>()
  for (const mob of mobs.value) {
    if (mob.race) values.add(mob.race)
  }
  return [
    { value: 'all', label: 'Все расы' },
    ...[...values].sort().map((value) => ({ value, label: raceLabel(value) })),
  ]
})

const creatureOptions = computed(() => {
  const values = new Set<string>()
  for (const mob of mobs.value) {
    if (mob.creatureName) values.add(mob.creatureName)
  }
  return [
    { value: 'all', label: 'Все существа' },
    ...[...values].sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({
      value,
      label: value,
    })),
  ]
})

const filtered = computed(() => {
  const q = normalizeSearch(query.value.trim())
  let list = mobs.value
  if (q) {
    list = list.filter((mob) => {
      const hay = normalizeSearch(
        [mob.nameRu, mob.nameEn, mob.mobId, mob.title, mob.creatureName].filter(Boolean).join(' '),
      )
      return hay.includes(q)
    })
  }
  if (race.value !== 'all') list = list.filter((mob) => mob.race === race.value)
  if (creature.value !== 'all') list = list.filter((mob) => mob.creatureName === creature.value)
  if (grade.value !== 'all') {
    list = list.filter((mob) => normalizeItemGrade(mob.gradeName) === grade.value)
  }
  if (level.value !== 'all') list = list.filter((mob) => levelBand(mob.level) === level.value)
  if (onlyWithSpawns.value) list = list.filter((mob) => mob.spawnCount > 0)

  const sorted = [...list]
  sorted.sort((a, b) => {
    if (sort.value === 'level') {
      const la = a.level ?? -1
      const lb = b.level ?? -1
      if (la !== lb) return lb - la
    }
    else if (sort.value === 'spawns') {
      if (a.spawnCount !== b.spawnCount) return b.spawnCount - a.spawnCount
    }
    return (a.nameRu || a.nameEn).localeCompare(b.nameRu || b.nameEn, 'ru')
  })
  return sorted
})

const spawnCount = computed(() => mobs.value.filter((mob) => mob.spawnCount > 0).length)

const hasActiveFilters = computed(() =>
  Boolean(
    query.value.trim()
    || race.value !== 'all'
    || creature.value !== 'all'
    || grade.value !== 'all'
    || level.value !== 'all'
    || onlyWithSpawns.value
    || sort.value !== 'name',
  ),
)

function openMap(mob: VerteronMob) {
  if (mob.spawnCount <= 0) return
  mapMob.value = mob
  showMap.value = true
}

function resetFilters() {
  query.value = ''
  race.value = 'all'
  creature.value = 'all'
  grade.value = 'all'
  level.value = 'all'
  onlyWithSpawns.value = false
  sort.value = 'name'
  activeIndex.value = -1
  listRef.value?.scrollToIndex(0)
}

function onSlashFocus(e: KeyboardEvent) {
  if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    e.preventDefault()
    searchRef.value?.focus()
  }
}

function onListKeydown(e: KeyboardEvent) {
  if (!filtered.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = Math.min(filtered.value.length - 1, activeIndex.value + 1)
    listRef.value?.scrollToIndex(Math.max(0, activeIndex.value))
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = Math.max(0, activeIndex.value <= 0 ? 0 : activeIndex.value - 1)
    listRef.value?.scrollToIndex(activeIndex.value)
  }
  else if (e.key === 'Enter' && activeIndex.value >= 0) {
    e.preventDefault()
    const mob = filtered.value[activeIndex.value]
    if (mob) openMap(mob)
  }
  else if (e.key === 'm' || e.key === 'M') {
    const mob = activeIndex.value >= 0 ? filtered.value[activeIndex.value] : null
    if (mob && mob.spawnCount > 0) {
      e.preventDefault()
      openMap(mob)
    }
  }
}

function metaLine(mob: VerteronMob): string {
  return [mob.creatureName, raceLabel(mob.race)].filter((bit) => bit && bit !== 'Без расы').join(' · ') || '—'
}

watch(() => route.query, () => readQuery())

watch(
  [query, race, creature, grade, level, onlyWithSpawns, sort],
  () => {
    writeQuery()
    activeIndex.value = -1
  },
)

watch(filtered, () => {
  if (activeIndex.value >= filtered.value.length) activeIndex.value = filtered.value.length - 1
})

onMounted(async () => {
  readQuery()
  window.addEventListener('keydown', onSlashFocus)
  const index = await ensureItemDropIndex()
  if (!index) {
    status.value = 'error'
    return
  }
  mobs.value = listVerteronMobs()
  status.value = 'ready'
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onSlashFocus)
})
</script>

<template>
  <div class="page-items">
    <div class="app-body is-single">
      <div class="app-primary">
        <div class="tracker-bar items-tracker-bar">
          <div class="items-toolbar">
            <div class="items-search-row">
              <AppSearchInput
                ref="searchRef"
                v-model="query"
                class="items-search"
                name="monster-search"
                placeholder="Поиск по имени (EN/RU) или ID…"
                aria-label="Поиск монстров"
                :debounce-ms="120"
              />
              <label
                class="items-opt"
                :title="spawnCount
                  ? 'Монстры с координатами спауна на карте Verteron'
                  : 'Пока нет монстров с координатами на карте'"
              >
                <input
                  v-model="onlyWithSpawns"
                  type="checkbox"
                  :disabled="spawnCount === 0"
                >
                С координатами
                <span class="items-opt-count">{{ spawnCount }}</span>
              </label>
              <button
                v-if="hasActiveFilters"
                type="button"
                class="items-opt is-btn"
                title="Сбросить фильтры"
                @click="resetFilters"
              >
                <RotateCcw
                  class="ui-icon"
                  aria-hidden="true"
                />
                Сброс
              </button>
            </div>
            <div class="items-filters">
              <AppFilterSelect
                v-model="level"
                :options="levelOptions"
                label="Уровень"
                aria-label="Уровень"
              />
              <AppFilterSelect
                v-model="race"
                :options="raceOptions"
                label="Раса"
                aria-label="Раса"
              />
              <AppFilterSelect
                v-model="creature"
                :options="creatureOptions"
                label="Существо"
                aria-label="Существо"
                search-placeholder="Найти существо…"
              />
              <AppFilterSelect
                v-model="grade"
                :options="gradeOptions"
                label="Редкость"
                aria-label="Редкость"
              />
              <AppFilterSelect
                v-model="sort"
                :options="sortOptions"
                label="Сортировка"
                aria-label="Сортировка"
              />
            </div>
          </div>
        </div>

        <main class="main items-main">
          <div class="section-bar">
            <p class="section-label">
              <template v-if="status === 'loading'">
                Загрузка монстров…
              </template>
              <template v-else-if="status === 'error'">
                Не удалось загрузить монстров
              </template>
              <template v-else>
                {{ filtered.length.toLocaleString('ru-RU') }}
                из {{ mobs.length.toLocaleString('ru-RU') }}
              </template>
            </p>
            <p class="hint">
              <span class="kbd">/</span> поиск
              · <span class="kbd">↑</span><span class="kbd">↓</span> строки
              · <span class="kbd">Enter</span> карта
              · <span class="kbd">M</span> карта
            </p>
          </div>

          <div
            v-if="status === 'error'"
            class="empty-state"
          >
            Не удалось загрузить индекс дропа.
          </div>

          <div
            v-else-if="status === 'loading'"
            class="empty-state"
          >
            Подтягиваем монстров Verteron…
          </div>

          <div
            v-else-if="filtered.length"
            class="items-list-shell"
            tabindex="0"
            @keydown="onListKeydown"
          >
            <div
              class="items-list-head"
              aria-hidden="true"
            >
              <span class="items-col-icon" />
              <span class="items-col-name">Монстр</span>
              <span class="items-col-meta">Существо</span>
              <span class="items-col-lvl">Ур.</span>
              <span class="items-col-id">Координаты</span>
              <span class="items-col-actions" />
            </div>
            <AppVirtualList
              ref="listRef"
              class="items-virtual"
              :items="filtered"
              :item-height="ROW_HEIGHT"
              :get-key="(mob) => (mob as VerteronMob).mobId"
            >
              <template #default="{ item, index }">
                <article
                  class="item-row"
                  :class="{
                    'is-active': index === activeIndex,
                    'has-map': item.spawnCount > 0,
                  }"
                  @click="activeIndex = index"
                  @dblclick="openMap(item)"
                >
                  <div class="items-col-icon">
                    <ItemIcon
                      :src="item.iconUrl"
                      :alt="item.nameEn"
                      :size="2.25"
                    />
                  </div>
                  <div class="items-col-name">
                    <p
                      class="item-row-title"
                      :class="gradeClass(item.gradeName)"
                    >
                      {{ item.nameRu || item.nameEn }}
                    </p>
                    <p
                      v-if="item.nameRu && item.nameEn && item.nameRu !== item.nameEn"
                      class="item-row-sub"
                    >
                      {{ item.nameEn }}
                    </p>
                  </div>
                  <div class="items-col-meta">
                    <span>{{ metaLine(item) }}</span>
                  </div>
                  <div class="items-col-lvl">
                    {{ item.level ?? '—' }}
                  </div>
                  <div class="items-col-id">
                    {{ item.spawnCount }} {{ pointsLabel(item.spawnCount) }}
                  </div>
                  <div class="items-col-actions">
                    <button
                      type="button"
                      class="btn btn-sm"
                      :disabled="item.spawnCount <= 0"
                      title="Карта спауна"
                      @click.stop="openMap(item)"
                    >
                      <MapPin
                        class="ui-icon"
                        aria-hidden="true"
                      />
                      Карта
                    </button>
                  </div>
                </article>
              </template>
            </AppVirtualList>
          </div>

          <div
            v-else
            class="empty-state"
          >
            Ничего не найдено.
            <button
              v-if="hasActiveFilters"
              type="button"
              class="btn btn-sm"
              style="margin-left: 0.5rem"
              @click="resetFilters"
            >
              Сбросить фильтры
            </button>
          </div>
        </main>
      </div>
    </div>

    <MonsterSpawnMapModal
      v-if="mapMob"
      v-model:open="showMap"
      :mob="mapMob"
    />
  </div>
</template>
