<script setup lang="ts">
import { ExternalLink, MapPin, Package, Pin } from '@lucide/vue'
import { ASSUMED_PLAYER_LEVEL, getMobLootForPlayer } from '../../shared/items/catalog'
import type { DropSource, ItemDef, MobDropLine } from '../../shared/items/types'
import { gradeClass } from '../../shared/items/grade'
import { formatRate, rateTooltip } from '../../shared/map/markers'
import ItemIcon from './ItemIcon.vue'
import LootTable from './LootTable.vue'

const props = withDefaults(defineProps<{
  item: ItemDef
  source: DropSource
  /** When opened from a zoom-cluster chip. */
  clusterCount?: number | null
  /** Attach shared Lv45 band for baseLevel &lt; 45 (map sidebar toggle). */
  useSharedScaling?: boolean
}>(), {
  clusterCount: null,
  useSharedScaling: true,
})

const open = defineModel<boolean>('open', { required: true })

const portraitBroken = ref(false)
watch(
  () => props.source.iconUrl,
  () => {
    portraitBroken.value = false
  },
)

const namePrimary = computed(() => props.source.nameRu || props.source.nameEn)
const nameSecondary = computed(() => {
  if (props.source.nameRu && props.source.nameEn && props.source.nameRu !== props.source.nameEn) {
    return props.source.nameEn
  }
  return null
})

const lootView = computed(() =>
  getMobLootForPlayer(props.source.mobId, {
    baseLevel: props.source.level,
    useSharedScaling: props.useSharedScaling,
  }),
)

const metaBits = computed(() => {
  const bits: string[] = []
  if (props.source.level != null) {
    if (lootView.value?.composed) {
      bits.push(`Ур. ${props.source.level}→${lootView.value.effectiveLevel}`)
    }
    else {
      bits.push(`Ур. ${props.source.level}`)
    }
  }
  if (props.source.gradeName) bits.push(props.source.gradeName)
  if (props.source.title) bits.push(props.source.title)
  if (props.source.creatureName) bits.push(props.source.creatureName)
  const race = raceLabel(props.source.race)
  if (race) bits.push(race)
  return bits
})

const spawnCount = computed(() => props.source.spawns?.length ?? 0)
const spawnLabel = computed(() => pointsLabel(spawnCount.value))

const dbaionUrl = computed(() =>
  props.source.onmapUrl
  || `https://dbaion2.ru/npcs/${props.source.mobId}/`,
)

const npcPageUrl = computed(() => `https://dbaion2.ru/npcs/${props.source.mobId}/`)

const pinnedRateText = computed(() => formatRate(props.source.rate))
const pinnedRateTip = computed(() => rateTooltip(props.source.rate) || '')

/** Other drops excluding the map item (shown once in pinned). */
const otherDrops = computed((): MobDropLine[] => {
  const pinnedId = String(props.item.itemId)
  const drops = lootView.value?.drops ?? []
  return drops.filter((d) => String(d.itemId) !== pinnedId)
})

const lootEmptyMessage = computed(() => {
  if (!lootView.value) return 'Таблица дропа для этого моба ещё не загружена.'
  return 'Других предметов в таблице нет.'
})

const lootLevelHint = computed(() => {
  const view = lootView.value
  if (!view?.composed) return null
  const base = view.baseLevel
  if (base != null) {
    return `Дроп при персонаже ${ASSUMED_PLAYER_LEVEL} (база моба ${base} → эфф. ${view.effectiveLevel})`
  }
  return `Дроп при персонаже ${ASSUMED_PLAYER_LEVEL}`
})

function raceLabel(race: string | null | undefined): string | null {
  if (!race) return null
  if (race === 'light') return 'Элийцы'
  if (race === 'dark') return 'Асмодиане'
  return race
}

function pointsLabel(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'точка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'точки'
  return 'точек'
}
</script>

<template>
  <UiAppModal
    v-model:open="open"
    :title="namePrimary"
    size="md"
    panel-class="mob-drop-modal-panel"
  >
    <div class="mob-drop-detail">
      <div class="mob-drop-hero">
        <div class="mob-drop-portrait">
          <img
            v-if="source.iconUrl && !portraitBroken"
            :src="source.iconUrl"
            :alt="namePrimary"
            class="mob-drop-portrait-img"
            loading="lazy"
            decoding="async"
            @error="portraitBroken = true"
          >
          <Package
            v-else
            class="ui-icon mob-drop-portrait-fallback"
            aria-hidden="true"
          />
        </div>
        <div class="mob-drop-identity">
          <p v-if="nameSecondary" class="mob-drop-name-en">
            {{ nameSecondary }}
          </p>
          <p v-if="metaBits.length" class="mob-drop-meta">
            {{ metaBits.join(' · ') }}
          </p>
          <p class="mob-drop-region">
            <MapPin class="ui-icon" aria-hidden="true" />
            <span>
              {{ source.region || 'Verteron' }}
              · {{ spawnCount }} {{ spawnLabel }}
              <template v-if="clusterCount && clusterCount > 1">
                · в группе ×{{ clusterCount }}
              </template>
            </span>
          </p>
          <p class="mob-drop-id">
            NPC #{{ source.mobId }}
          </p>
        </div>
      </div>

      <section class="mob-drop-pinned" aria-label="Предмет на карте">
        <div class="mob-drop-pinned-head">
          <Pin class="ui-icon" aria-hidden="true" />
          <span>На карте</span>
        </div>
        <div class="mob-drop-loot-row is-pinned">
          <ItemIcon
            :src="item.icon"
            :alt="item.nameEn"
            :size="1.75"
            class="mob-drop-loot-icon"
          />
          <div class="mob-drop-loot-text">
            <p class="mob-drop-loot-name" :class="gradeClass(item.grade)">
              {{ item.nameRu || item.nameEn }}
            </p>
            <p class="mob-drop-loot-sub">
              {{ item.nameEn }}
            </p>
          </div>
          <UiAppTooltip
            :content="pinnedRateTip"
            :disabled="!pinnedRateTip"
          >
            <span class="mob-drop-loot-rate">
              {{ pinnedRateText }}
            </span>
          </UiAppTooltip>
        </div>
      </section>

      <LootTable
        :drops="otherDrops"
        density="normal"
        :total-count="lootView?.drops.length ?? null"
        :empty-message="lootEmptyMessage"
        :hint="lootLevelHint"
      />
    </div>

    <template #footer>
      <a
        class="btn btn-sm btn-ghost"
        :href="npcPageUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink class="ui-icon" aria-hidden="true" />
        Карточка NPC
      </a>
      <a
        class="btn btn-sm"
        :href="dbaionUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <MapPin class="ui-icon" aria-hidden="true" />
        На карте dbaion2
      </a>
    </template>
  </UiAppModal>
</template>
