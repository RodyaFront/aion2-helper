<script setup lang="ts">
import { Bookmark, ExternalLink, MapPin, RotateCcw } from '@lucide/vue'
import {
  buildCategoryOptions,
  catalogError,
  catalogItems,
  catalogMeta,
  catalogStatus,
  ensureItemCatalog,
  ensureItemDropIndex,
  ensureItemGatherIndex,
  filterItems,
  itemHasMap,
  type ItemFilterInput,
  type ItemSortKey,
} from '../../../shared/items/catalog'
import { gradeClass } from '../../../shared/items/grade'
import { itemLocalizedName, itemSecondaryName } from '../../../shared/items/i18n'
import type { ItemDef } from '../../../shared/items/types'
import ItemDropMapModal from '../../components/ItemDropMapModal.vue'
import ItemGatherMapModal from '../../components/ItemGatherMapModal.vue'
import ItemIcon from '../../components/ItemIcon.vue'
import AppFilterSelect from '../../components/ui/AppFilterSelect.vue'
import AppSearchInput from '../../components/ui/AppSearchInput.vue'
import AppVirtualList from '../../components/ui/AppVirtualList.vue'
import { useFavoritesStore } from '../../../stores/favorites'
import { useSettingsStore } from '../../../stores/settings'

const route = useRoute()
const router = useRouter()
const favorites = useFavoritesStore()
const settings = useSettingsStore()
const regionId = computed(() => settings.regionId)

const query = ref('')
const category = ref('all')
const itemType = ref('all')
const grade = ref('all')
const onlyWithDropPoints = ref(false)
const onlyFavorites = ref(false)
const hideCosmetics = ref(true)
const sort = ref('name')
const mapItem = ref<ItemDef | null>(null)
const showMap = ref(false)
const mapMode = ref<'drop' | 'gather'>('drop')
const searchRef = ref<{ focus: () => void } | null>(null)
const listRef = ref<{ scrollToIndex: (i: number) => void } | null>(null)
const activeIndex = ref(-1)
const syncingUrl = ref(false)

const ROW_HEIGHT = 52

const typeOptions = [
  { value: 'all', label: 'Все типы' },
  { value: 'EQUIP', label: 'Экипировка', keywords: 'equip gear weapon armor' },
  { value: 'USABLE', label: 'Расходники', keywords: 'usable consumable' },
  { value: 'MISC', label: 'Прочее', keywords: 'misc material' },
  { value: 'CURRENCY', label: 'Валюта', keywords: 'currency cash' },
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
  { value: 'grade', label: 'Редкость' },
  { value: 'level', label: 'Уровень' },
  { value: 'map', label: 'Сначала с координатами' },
  { value: 'id', label: 'ID' },
]

function readDropPointsQuery(q: typeof route.query): boolean {
  if (q.points === '1') return true
  // Legacy map dropdown URLs
  if (q.map === 'has-map' || q.map === 'verteron') return true
  return false
}

function readQuery() {
  const q = route.query
  syncingUrl.value = true
  query.value = typeof q.q === 'string' ? q.q : ''
  category.value = typeof q.cat === 'string' ? q.cat : 'all'
  itemType.value = typeof q.type === 'string' ? q.type : 'all'
  grade.value = typeof q.grade === 'string' ? q.grade : 'all'
  onlyWithDropPoints.value = readDropPointsQuery(q)
  onlyFavorites.value = q.fav === '1'
  hideCosmetics.value = q.cos !== '0'
  // Legacy URL: sort=name-ru → single locale-aware "name"
  const rawSort = typeof q.sort === 'string' ? q.sort : 'name'
  const s = rawSort === 'name-ru' ? 'name' : rawSort
  sort.value = sortOptions.some((o) => o.value === s) ? s : 'name'
  nextTick(() => {
    syncingUrl.value = false
  })
}

function writeQuery() {
  if (syncingUrl.value) return
  const next: Record<string, string> = {}
  if (query.value.trim()) next.q = query.value.trim()
  if (category.value !== 'all') next.cat = category.value
  if (itemType.value !== 'all') next.type = itemType.value
  if (grade.value !== 'all') next.grade = grade.value
  if (onlyWithDropPoints.value) next.points = '1'
  if (onlyFavorites.value) next.fav = '1'
  if (!hideCosmetics.value) next.cos = '0'
  if (sort.value !== 'name') next.sort = sort.value
  const cur = route.query
  const same
    = String(cur.q || '') === String(next.q || '')
      && String(cur.cat || '') === String(next.cat || '')
      && String(cur.type || '') === String(next.type || '')
      && String(cur.grade || '') === String(next.grade || '')
      && String(cur.points || '') === String(next.points || '')
      && String(cur.fav || '') === String(next.fav || '')
      && String(cur.cos || '') === String(next.cos || '')
      && String(cur.sort || '') === String(next.sort || '')
      // Ignore legacy map= while rewriting to points=
      && !cur.map
  if (same) return
  router.replace({ query: next })
}

const filterInput = computed<ItemFilterInput>(() => ({
  query: query.value,
  category: category.value,
  itemType: itemType.value,
  grade: grade.value,
  onlyWithDropPoints: onlyWithDropPoints.value,
  hideCosmetics: hideCosmetics.value,
  sort: sort.value as ItemSortKey,
  regionId: regionId.value,
}))

const filtered = computed(() => {
  const list = filterItems(filterInput.value, catalogItems.value)
  if (!onlyFavorites.value) return list
  const ids = favorites.itemIdSet
  return list.filter((item) => ids.has(item.itemId))
})

const categoryOptions = computed(() => [
  { value: 'all', label: 'Все категории' },
  ...buildCategoryOptions(catalogItems.value),
])

const totalCount = computed(() => catalogMeta.value?.count ?? catalogItems.value.length)

const dropPointsCount = computed(
  () => catalogItems.value.filter((item) => itemHasMap(item, regionId.value)).length,
)

function itemHasRegionMap(item: ItemDef) {
  return itemHasMap(item, regionId.value)
}

function itemPrefersDropMap(item: ItemDef) {
  if (regionId.value === 'altgard') return Boolean(item.hasAltgardMap)
  return Boolean(item.hasVerteronMap)
}

const favoriteCount = computed(
  () => catalogItems.value.filter((item) => favorites.itemIdSet.has(item.itemId)).length,
)

const hasActiveFilters = computed(() =>
  Boolean(
    query.value.trim()
    || category.value !== 'all'
    || itemType.value !== 'all'
    || grade.value !== 'all'
    || onlyWithDropPoints.value
    || onlyFavorites.value
    || !hideCosmetics.value
    || sort.value !== 'name',
  ),
)

const scrapedLabel = computed(() => {
  const at = catalogMeta.value?.scrapedAt
  if (!at) return ''
  try {
    return new Date(at).toLocaleDateString('ru-RU')
  }
  catch {
    return ''
  }
})

async function openMap(item: ItemDef) {
  if (!itemHasRegionMap(item)) return
  // Prefer drop map when both flags set (rare); gather otherwise.
  if (itemPrefersDropMap(item)) {
    await ensureItemDropIndex(regionId.value)
    mapMode.value = 'drop'
  }
  else {
    await ensureItemGatherIndex(regionId.value)
    mapMode.value = 'gather'
  }
  mapItem.value = item
  showMap.value = true
}

function onRowActivate(item: ItemDef) {
  if (itemHasRegionMap(item)) openMap(item)
  else if (item.sourceUrl) window.open(item.sourceUrl, '_blank', 'noopener,noreferrer')
}

function resetFilters() {
  query.value = ''
  category.value = 'all'
  itemType.value = 'all'
  grade.value = 'all'
  onlyWithDropPoints.value = false
  onlyFavorites.value = false
  hideCosmetics.value = true
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
    const item = filtered.value[activeIndex.value]
    if (item) onRowActivate(item)
  }
  else if (e.key === 'm' || e.key === 'M') {
    const item = activeIndex.value >= 0
      ? filtered.value[activeIndex.value]
      : null
    if (item && itemHasRegionMap(item)) {
      e.preventDefault()
      openMap(item)
    }
  }
}

watch(
  () => route.query,
  () => readQuery(),
)

watch(
  [query, category, itemType, grade, onlyWithDropPoints, onlyFavorites, hideCosmetics, sort],
  () => {
    writeQuery()
    activeIndex.value = -1
  },
)

watch(filtered, () => {
  if (activeIndex.value >= filtered.value.length) activeIndex.value = filtered.value.length - 1
})

async function loadRegionIndexes() {
  await Promise.all([
    ensureItemDropIndex(regionId.value),
    ensureItemGatherIndex(regionId.value),
  ])
}

watch(regionId, () => {
  void loadRegionIndexes()
  showMap.value = false
  mapItem.value = null
})

onMounted(async () => {
  readQuery()
  window.addEventListener('keydown', onSlashFocus)
  try {
    await ensureItemCatalog(regionId.value)
  }
  catch {
    /* catalogError set in module */
  }
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
                name="item-search"
                placeholder="Поиск по имени (EN/RU), ID, категории…"
                aria-label="Поиск предметов"
                :debounce-ms="120"
              />
              <label class="items-opt">
                <input
                  v-model="hideCosmetics"
                  type="checkbox"
                >
                Без косметики
              </label>
              <label
                class="items-opt"
                :title="dropPointsCount
                  ? 'Предметы с координатами дропа или сбора на карте Verteron'
                  : 'Пока нет предметов с координатами на карте'"
              >
                <input
                  v-model="onlyWithDropPoints"
                  type="checkbox"
                  :disabled="dropPointsCount === 0"
                >
                С координатами
                <span class="items-opt-count">{{ dropPointsCount }}</span>
              </label>
              <label
                class="items-opt"
                title="Показать только избранные"
              >
                <input
                  v-model="onlyFavorites"
                  type="checkbox"
                >
                Избранные
                <span class="items-opt-count">{{ favoriteCount }}</span>
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
                v-model="itemType"
                :options="typeOptions"
                label="Тип"
                aria-label="Тип предмета"
              />
              <AppFilterSelect
                v-model="grade"
                :options="gradeOptions"
                label="Редкость"
                aria-label="Редкость"
              />
              <AppFilterSelect
                v-model="category"
                :options="categoryOptions"
                label="Категория"
                aria-label="Категория"
                search-placeholder="Найти категорию…"
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
              <template v-if="catalogStatus === 'loading'">
                Загрузка каталога…
              </template>
              <template v-else-if="catalogStatus === 'error'">
                Не удалось загрузить каталог
              </template>
              <template v-else>
                {{ filtered.length.toLocaleString('ru-RU') }}
                из {{ totalCount.toLocaleString('ru-RU') }}
              </template>
            </p>
            <p class="hint">
              <span class="kbd">/</span> поиск
              · <span class="kbd">↑</span><span class="kbd">↓</span> строки
              · <span class="kbd">Enter</span> открыть
              · <span class="kbd">M</span> карта
              <template v-if="scrapedLabel">
                · dbaion2 · {{ scrapedLabel }}
              </template>
            </p>
          </div>

          <div
            v-if="catalogStatus === 'error'"
            class="empty-state"
          >
            {{ catalogError || 'Ошибка загрузки' }}. Проверь файл
            <code>public/data/items-catalog.json</code>
            или запусти <code>npm run items:catalog</code>.
          </div>

          <div
            v-else-if="catalogStatus === 'loading'"
            class="empty-state"
          >
            Подтягиваем ~9k предметов…
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
              <span class="items-col-name">Предмет</span>
              <span class="items-col-meta">Тип / кат.</span>
              <span class="items-col-lvl">Lvl</span>
              <span class="items-col-id">ID</span>
              <span class="items-col-actions" />
            </div>
            <AppVirtualList
              ref="listRef"
              class="items-virtual"
              :items="filtered"
              :item-height="ROW_HEIGHT"
              :get-key="(item) => (item as ItemDef).id"
            >
              <template #default="{ item, index }">
                <article
                  class="item-row"
                  :class="{
                    'is-active': index === activeIndex,
                    'has-map': itemHasRegionMap(item),
                  }"
                  @click="activeIndex = index"
                  @dblclick="onRowActivate(item)"
                >
                  <div class="items-col-icon">
                    <ItemIcon
                      :src="item.icon"
                      :alt="item.nameEn"
                      :size="2.25"
                    />
                  </div>
                  <div class="items-col-name">
                    <p
                      class="item-row-title"
                      :class="gradeClass(item.grade)"
                    >
                      {{ itemLocalizedName(item) }}
                    </p>
                    <p
                      v-if="itemSecondaryName(item)"
                      class="item-row-sub"
                    >
                      {{ itemSecondaryName(item) }}
                    </p>
                  </div>
                  <div class="items-col-meta">
                    <span>{{ item.itemType || '—' }}</span>
                    <span>{{ item.categoryName || item.category }}</span>
                  </div>
                  <div class="items-col-lvl">
                    {{ item.itemLevel || item.levelReq || '—' }}
                  </div>
                  <div class="items-col-id">
                    #{{ item.itemId }}
                  </div>
                  <div class="items-col-actions">
                    <button
                      type="button"
                      class="fav-btn"
                      :class="{ 'is-on': favorites.itemIdSet.has(item.itemId) }"
                      :aria-pressed="favorites.itemIdSet.has(item.itemId)"
                      :aria-label="favorites.itemIdSet.has(item.itemId) ? 'Убрать из избранного' : 'В избранное'"
                      :title="favorites.itemIdSet.has(item.itemId) ? 'Убрать из избранного' : 'В избранное'"
                      @click.stop="favorites.toggleItem(item.itemId)"
                    >
                      <Bookmark
                        class="ui-icon"
                        aria-hidden="true"
                        :fill="favorites.itemIdSet.has(item.itemId) ? 'currentColor' : 'none'"
                      />
                    </button>
                    <button
                      v-if="itemHasRegionMap(item)"
                      type="button"
                      class="btn btn-sm"
                      :title="itemPrefersDropMap(item) ? 'Карта дропа' : 'Карта сбора'"
                      @click.stop="openMap(item)"
                    >
                      <MapPin
                        class="ui-icon"
                        aria-hidden="true"
                      />
                      Карта
                    </button>
                    <a
                      v-else
                      class="btn btn-sm btn-ghost"
                      :href="item.sourceUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Открыть на dbaion2"
                      @click.stop
                    >
                      <ExternalLink
                        class="ui-icon"
                        aria-hidden="true"
                      />
                    </a>
                  </div>
                </article>
              </template>
            </AppVirtualList>
          </div>

          <div
            v-else
            class="empty-state"
          >
            <template v-if="onlyFavorites && favoriteCount === 0">
              Нет избранных. Нажми закладку в строке.
            </template>
            <template v-else>
              Ничего не найдено.
            </template>
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

    <ItemDropMapModal
      v-if="mapItem && mapMode === 'drop'"
      v-model:open="showMap"
      :item="mapItem"
    />
    <ItemGatherMapModal
      v-if="mapItem && mapMode === 'gather'"
      v-model:open="showMap"
      :item="mapItem"
    />
  </div>
</template>
