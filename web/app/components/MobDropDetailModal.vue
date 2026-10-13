<script setup lang="ts">
import { ExternalLink, MapPin, Package } from '@lucide/vue'
import type { DropSource, ItemDef } from '../../shared/items/types'
import { formatRate } from '../../shared/map/markers'

const props = defineProps<{
  item: ItemDef
  source: DropSource
  /** When opened from a zoom-cluster chip. */
  clusterCount?: number | null
}>()

const open = defineModel<boolean>('open', { required: true })

const namePrimary = computed(() => props.source.nameRu || props.source.nameEn)
const nameSecondary = computed(() => {
  if (props.source.nameRu && props.source.nameEn && props.source.nameRu !== props.source.nameEn) {
    return props.source.nameEn
  }
  return null
})

const metaBits = computed(() => {
  const bits: string[] = []
  if (props.source.level != null) bits.push(`Ур. ${props.source.level}`)
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
    size="sm"
    panel-class="mob-drop-modal-panel"
  >
    <div class="mob-drop-detail">
      <div class="mob-drop-hero">
        <div class="mob-drop-portrait">
          <img
            v-if="source.iconUrl"
            :src="source.iconUrl"
            :alt="namePrimary"
            class="mob-drop-portrait-img"
            loading="lazy"
            decoding="async"
          >
          <Package v-else class="ui-icon mob-drop-portrait-fallback" aria-hidden="true" />
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

      <section class="mob-drop-loot" aria-label="Дроп предмета">
        <p class="mob-drop-loot-label">
          Дроп на карте
        </p>
        <div class="mob-drop-loot-row">
          <img
            v-if="item.icon"
            :src="item.icon"
            :alt="item.nameEn"
            class="mob-drop-loot-icon"
            loading="lazy"
          >
          <Package v-else class="ui-icon" aria-hidden="true" />
          <div class="mob-drop-loot-text">
            <p class="mob-drop-loot-name">
              {{ item.nameRu || item.nameEn }}
            </p>
            <p class="mob-drop-loot-sub">
              {{ item.nameEn }}
            </p>
          </div>
          <span class="mob-drop-loot-rate">
            {{ formatRate(source.rate) }}
          </span>
        </div>
      </section>
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
