<script setup lang="ts">
import { MapPin, Package } from '@lucide/vue'
import {
  filterItems,
  ITEMS,
} from '../../../shared/items/catalog'
import type { ItemDef } from '../../../shared/items/types'
import AppFilterSelect from '../../components/ui/AppFilterSelect.vue'
import AppSearchInput from '../../components/ui/AppSearchInput.vue'
import ItemDropMapModal from '../../components/ItemDropMapModal.vue'

const query = ref('')
const category = ref('all')
const mapFilter = ref('all')
const mapItem = ref<ItemDef | null>(null)
const showMap = ref(false)
const searchRef = ref<{ focus: () => void } | null>(null)

const categoryOptions = computed(() => {
  const cats = new Set(ITEMS.map((i) => i.category))
  return [
    { value: 'all', label: 'Все категории' },
    ...[...cats].map((c) => ({
      value: c,
      label: c === 'crafting_material' ? 'Крафт-материалы' : c,
      keywords: c,
    })),
  ]
})

const mapOptions = [
  { value: 'all', label: 'Любая карта' },
  { value: 'verteron', label: 'Verteron', keywords: 'verteron бертрон map' },
  { value: 'has-map', label: 'Есть точки на карте', keywords: 'map points' },
]

const filtered = computed(() =>
  filterItems({
    query: query.value,
    category: category.value,
    mapFilter: mapFilter.value,
  }),
)

function openMap(item: ItemDef) {
  if (!item.hasVerteronMap) return
  mapItem.value = item
  showMap.value = true
}

function onSlashFocus(e: KeyboardEvent) {
  if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    e.preventDefault()
    searchRef.value?.focus()
  }
}

onMounted(() => window.addEventListener('keydown', onSlashFocus))
onBeforeUnmount(() => window.removeEventListener('keydown', onSlashFocus))
</script>

<template>
  <div class="app-shell">
    <header class="app-chrome">
      <div class="chrome-brand">
        <p class="brand-mark">AION 2 · Lamuatan</p>
        <h1 class="chrome-title">Предметы · дроп</h1>
      </div>
      <nav class="chrome-nav" aria-label="Разделы">
        <NuxtLink to="/" class="chrome-nav-link">
          Боссы
        </NuxtLink>
        <NuxtLink to="/items" class="chrome-nav-link is-active">
          Предметы
        </NuxtLink>
      </nav>
    </header>

    <div class="app-body">
      <div class="app-primary">
        <div class="tracker-bar">
          <div class="toolbar items-toolbar">
            <AppSearchInput
              ref="searchRef"
              v-model="query"
              name="item-search"
              placeholder="Поиск по имени (EN/RU) или ID…"
              aria-label="Поиск предметов"
            />
            <AppFilterSelect
              v-model="category"
              :options="categoryOptions"
              label="Категория"
              aria-label="Категория"
            />
            <AppFilterSelect
              v-model="mapFilter"
              :options="mapOptions"
              label="Карта"
              aria-label="Фильтр карты"
            />
          </div>
        </div>

        <main class="main">
          <div class="section-bar">
            <p class="section-label">
              Найдено: {{ filtered.length }} · всего {{ ITEMS.length }}
            </p>
            <p class="hint">
              <span class="kbd">/</span> поиск · данные dbaion2.ru
            </p>
          </div>

          <div v-if="filtered.length" class="item-grid">
            <article
              v-for="item in filtered"
              :key="item.id"
              class="item-card"
            >
              <div class="item-card-media">
                <img
                  v-if="item.icon"
                  :src="item.icon"
                  :alt="item.nameEn"
                  class="item-card-icon"
                  loading="lazy"
                >
                <Package v-else class="ui-icon item-card-icon-fallback" aria-hidden="true" />
              </div>
              <div class="item-card-body">
                <h2 class="item-card-title">{{ item.nameRu }}</h2>
                <p class="item-card-sub">{{ item.nameEn }} · #{{ item.itemId }}</p>
                <p class="item-card-meta">
                  Источников: {{ item.dropSourceCount }}
                  · точек Verteron: {{ item.verteronSpawnCount }}
                </p>
              </div>
              <div class="item-card-actions">
                <button
                  type="button"
                  class="btn btn-sm"
                  :disabled="!item.hasVerteronMap"
                  @click="openMap(item)"
                >
                  <MapPin class="ui-icon" aria-hidden="true" />
                  Показать на карте
                </button>
              </div>
            </article>
          </div>
          <div v-else class="empty-state">
            Ничего не найдено. Сбрось поиск или фильтры.
          </div>
        </main>
      </div>
    </div>

    <ItemDropMapModal
      v-if="mapItem"
      v-model:open="showMap"
      :item="mapItem"
    />
  </div>
</template>
