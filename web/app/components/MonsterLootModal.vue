<script setup lang="ts">
import { ExternalLink, MapPin, Package } from '@lucide/vue'
import { ASSUMED_PLAYER_LEVEL, getMobLootForPlayer } from '../../shared/items/catalog'
import type { VerteronMob } from '../../shared/items/types'
import LootTable from './LootTable.vue'

const props = withDefaults(defineProps<{
  mob: VerteronMob
  /** When opened from a zoom-cluster chip. */
  clusterCount?: number | null
  useSharedScaling?: boolean
}>(), {
  clusterCount: null,
  useSharedScaling: true,
})

const open = defineModel<boolean>('open', { required: true })

const portraitBroken = ref(false)
watch(
  () => props.mob.iconUrl,
  () => {
    portraitBroken.value = false
  },
)

const namePrimary = computed(() => props.mob.nameRu || props.mob.nameEn)
const nameSecondary = computed(() => {
  if (props.mob.nameRu && props.mob.nameEn && props.mob.nameRu !== props.mob.nameEn) {
    return props.mob.nameEn
  }
  return null
})

const lootView = computed(() =>
  getMobLootForPlayer(props.mob.mobId, {
    baseLevel: props.mob.level,
    useSharedScaling: props.useSharedScaling,
  }),
)

const metaBits = computed(() => {
  const bits: string[] = []
  if (props.mob.level != null) {
    if (lootView.value?.composed) {
      bits.push(`Ур. ${props.mob.level}→${lootView.value.effectiveLevel}`)
    }
    else {
      bits.push(`Ур. ${props.mob.level}`)
    }
  }
  if (props.mob.gradeName) bits.push(props.mob.gradeName)
  if (props.mob.title) bits.push(props.mob.title)
  if (props.mob.creatureName) bits.push(props.mob.creatureName)
  const race = raceLabel(props.mob.race)
  if (race) bits.push(race)
  return bits
})

const spawnCount = computed(() => props.mob.spawnCount)
const spawnLabel = computed(() => pointsLabel(spawnCount.value))

const dbaionUrl = computed(() => `https://dbaion2.ru/en/map/#verteron&npc=${props.mob.mobId}`)
const npcPageUrl = computed(() => `https://dbaion2.ru/npcs/${props.mob.mobId}/`)

const lootEmptyMessage = computed(() => {
  if (!lootView.value) return 'Таблица дропа для этого моба ещё не загружена.'
  return 'В таблице дропа нет предметов.'
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
  if (mod10 === 1 && mod100 !== 11) return 'координата'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'координаты'
  return 'координат'
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
            v-if="mob.iconUrl && !portraitBroken"
            :src="mob.iconUrl"
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
              Verteron
              · {{ spawnCount }} {{ spawnLabel }}
              <template v-if="clusterCount && clusterCount > 1">
                · в группе ×{{ clusterCount }}
              </template>
            </span>
          </p>
          <p class="mob-drop-id">
            NPC #{{ mob.mobId }}
          </p>
        </div>
      </div>

      <LootTable
        :drops="lootView?.drops ?? []"
        density="normal"
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
