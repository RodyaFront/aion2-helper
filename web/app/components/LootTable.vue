<script setup lang="ts">
import { ArrowDownWideNarrow, Folders, Search, X } from '@lucide/vue'
import ItemIcon from './ItemIcon.vue'
import type { MobDropLine } from '../../shared/items/types'
import { gradeClass } from '../../shared/items/grade'
import { formatRate, rateTooltip } from '../../shared/map/markers'
import { normalizeSearch } from '../../shared/items/catalog'

export type LootTableDensity = 'dense' | 'normal' | 'large'
export type LootSortKey = 'chance' | 'name'

const props = withDefaults(defineProps<{
  drops: MobDropLine[]
  density?: LootTableDensity
  /** Shown in the header badge (e.g. full table size before exclude). */
  totalCount?: number | null
  emptyMessage?: string
  searchPlaceholder?: string
  /** Optional note under the title (e.g. shared Lv45 composition). */
  hint?: string | null
}>(), {
  density: 'dense',
  totalCount: null,
  emptyMessage: 'Нет предметов.',
  searchPlaceholder: 'Поиск…',
  hint: null,
})

const query = ref('')
const sortKey = ref<LootSortKey>('chance')
const groupByCategory = ref(false)

const badgeCount = computed(() => props.totalCount ?? props.drops.length)

const filteredSorted = computed((): MobDropLine[] => {
  const q = normalizeSearch(query.value.trim())
  let list = props.drops
  if (q) {
    list = list.filter((d) => {
      const hay = normalizeSearch(
        `${d.nameEn} ${d.category || ''} ${d.gradeName || ''} ${d.itemId}`,
      )
      return hay.includes(q)
    })
  }
  return [...list].sort((a, b) => {
    if (sortKey.value === 'name') {
      return a.nameEn.localeCompare(b.nameEn, 'en') || String(a.itemId).localeCompare(String(b.itemId))
    }
    const ca = a.chance
    const cb = b.chance
    if (ca == null && cb == null) return a.nameEn.localeCompare(b.nameEn, 'en')
    if (ca == null) return 1
    if (cb == null) return -1
    if (cb !== ca) return cb - ca
    return a.nameEn.localeCompare(b.nameEn, 'en')
  })
})

type LootGroup = { key: string, label: string, items: MobDropLine[] }

const groups = computed((): LootGroup[] => {
  if (!groupByCategory.value) {
    return [{ key: '_all', label: '', items: filteredSorted.value }]
  }
  const map = new Map<string, MobDropLine[]>()
  for (const d of filteredSorted.value) {
    const key = (d.category || '').trim() || '_other'
    const list = map.get(key) ?? []
    list.push(d)
    map.set(key, list)
  }
  const keys = [...map.keys()].sort((a, b) => {
    if (a === '_other') return 1
    if (b === '_other') return -1
    return a.localeCompare(b, 'en')
  })
  return keys.map((key) => ({
    key,
    label: key === '_other' ? 'Прочее' : key,
    items: map.get(key)!,
  }))
})

function chanceText(chance: number | null | undefined): string {
  if (chance == null || !Number.isFinite(chance)) return '?'
  return formatRate(chance)
}

function chanceTip(chance: number | null | undefined): string {
  if (chance == null || !Number.isFinite(chance)) return ''
  return rateTooltip(chance) || ''
}

function clearQuery() {
  query.value = ''
}

function cycleSort() {
  sortKey.value = sortKey.value === 'chance' ? 'name' : 'chance'
}

const sortLabel = computed(() => (sortKey.value === 'chance' ? '%' : 'А–Я'))
</script>

<template>
  <section
    class="loot-table"
    :class="`loot-table--${density}`"
    aria-label="Таблица дропа"
  >
    <header class="loot-table-head">
      <div class="loot-table-heading">
        <p class="loot-table-title">
          Дроп
          <span class="loot-table-count">{{ badgeCount }}</span>
        </p>
        <p v-if="hint" class="loot-table-hint">
          {{ hint }}
        </p>
      </div>
      <div class="loot-table-tools">
        <label class="loot-table-search">
          <Search class="ui-icon" aria-hidden="true" />
          <input
            v-model="query"
            class="loot-table-search-input"
            type="search"
            autocomplete="off"
            spellcheck="false"
            :placeholder="searchPlaceholder"
            aria-label="Поиск по дропу"
          >
          <button
            v-if="query"
            type="button"
            class="loot-table-search-clear"
            aria-label="Очистить поиск"
            @click="clearQuery"
          >
            <X class="ui-icon" aria-hidden="true" />
          </button>
        </label>
        <UiAppTooltip
          :content="sortKey === 'chance' ? 'Сортировка: процент (клик — по имени)' : 'Сортировка: имя (клик — по %)'"
        >
          <button
            type="button"
            class="loot-table-tool-btn"
            :aria-label="sortKey === 'chance' ? 'Сортировка по проценту' : 'Сортировка по имени'"
            @click="cycleSort"
          >
            <ArrowDownWideNarrow class="ui-icon" aria-hidden="true" />
            <span>{{ sortLabel }}</span>
          </button>
        </UiAppTooltip>
        <UiAppTooltip content="Группировка по категории">
          <button
            type="button"
            class="loot-table-tool-btn"
            :class="{ 'is-active': groupByCategory }"
            aria-label="Группировка по категории"
            :aria-pressed="groupByCategory"
            @click="groupByCategory = !groupByCategory"
          >
            <Folders class="ui-icon" aria-hidden="true" />
          </button>
        </UiAppTooltip>
      </div>
    </header>

    <div v-if="filteredSorted.length" class="loot-table-body">
      <template v-for="group in groups" :key="group.key">
        <p v-if="group.label" class="loot-table-group">
          {{ group.label }}
          <span class="loot-table-group-count">{{ group.items.length }}</span>
        </p>
        <ul class="loot-table-list">
          <li
            v-for="d in group.items"
            :key="d.itemId"
            class="loot-table-row"
          >
            <ItemIcon
              :src="d.iconUrl"
              :alt="d.nameEn"
              :size="1.75"
              class="loot-table-icon"
            />
            <div class="loot-table-text">
              <p class="loot-table-name" :class="gradeClass(d.gradeName)">
                {{ d.nameEn }}
              </p>
              <p class="loot-table-sub">
                <template v-if="d.gradeName">{{ d.gradeName }}</template>
                <template v-if="d.gradeName && d.category && !groupByCategory"> · </template>
                <template v-if="d.category && !groupByCategory">{{ d.category }}</template>
                <template v-if="!d.gradeName && (!d.category || groupByCategory)">#{{ d.itemId }}</template>
              </p>
            </div>
            <UiAppTooltip
              :content="chanceTip(d.chance)"
              :disabled="!chanceTip(d.chance)"
            >
              <span class="loot-table-rate">
                {{ chanceText(d.chance) }}
              </span>
            </UiAppTooltip>
          </li>
        </ul>
      </template>
    </div>
    <p v-else class="loot-table-empty">
      {{ query.trim() ? 'Ничего не найдено.' : emptyMessage }}
    </p>
  </section>
</template>
