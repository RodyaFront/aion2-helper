<script setup lang="ts">
import { Crosshair, GitBranch, Minus, Plus, X } from '@lucide/vue'
import { countAccent, fitCountColorScale, fitRateColorScale } from '../../shared/map/rateColor'
import type { IClusterStrategy, IMapMarker, MapPoint, MapScene, MarkerRenderModel } from '../../shared/map/types'

const props = withDefaults(defineProps<{
  scene: MapScene
  clusterStrategy?: IClusterStrategy | null
  /** Highest tile zoom shipped for this map. */
  maxTileZ?: number
  /** Keep chips whose ×N (mob group size) is in [min, max]. */
  minMobCount?: number
  maxMobCount?: number
  /** When false, every marker in the viewport is drawn (no 200-chip cap). */
  capDomMarkers?: boolean
}>(), {
  clusterStrategy: null,
  maxTileZ: 3,
  minMobCount: 1,
  maxMobCount: Number.POSITIVE_INFINITY,
  capDomMarkers: true,
})

const emit = defineEmits<{
  /** Drop / cluster chip activated (click). */
  'select-marker': [marker: IMapMarker]
}>()

const MIN_SCALE = 0.06
const MAX_SCALE = 1.25
/** Screen-px radius: markers closer than this count as one stack. */
const STACK_SCREEN_PX = 40
/** Vertical peek for the layer under the top chip (screen px only). */
const STACK_FAN_SCREEN_PX = 4
/** Spiderfy ring radius in screen px. */
const SPIDER_SCREEN_PX = 42
/** Max DOM chips rendered in the viewport. */
const MAX_DOM_MARKERS = 200
/** Stack fan/deck only when at most this many chips are on screen. */
const STACK_LAYOUT_MAX = 80

type StackLayout = {
  size: number
  /** 0 = highest rate (on top). */
  rank: number
  /** Screen-px translateY after inverse scale; 0 for top. */
  fanDy: number
  /** Shared map anchor so the deck has no horizontal drift. */
  anchorX: number
  anchorY: number
  isTop: boolean
  isBottom: boolean
  /** Group key for popover reuse. */
  groupId: string
}

const WORLD = computed(() => props.scene.map.width || 8192)
const TILE_SIZE = computed(() => props.scene.map.tileSize || 512)

const viewportRef = ref<HTMLElement | null>(null)

/** Immediate camera (smooth pan/zoom). */
const scale = ref(0.2)
const panX = ref(0)
const panY = ref(0)

/** RAF-synced view used for heavy marker pipeline. */
const viewScale = ref(0.2)
const viewPanX = ref(0)
const viewPanY = ref(0)
const gesturing = ref(false)

const dragging = ref(false)
const hoveredMarkerId = ref<string | null>(null)
const focusMarkerId = ref<string | null>(null)
/** World-space offsets while a stack is spiderfied. */
const spiderOffsets = ref<Map<string, { dx: number, dy: number }>>(new Map())
const stackPopover = ref<{
  anchorId: string
  members: IMapMarker[]
  left: number
  top: number
} | null>(null)

let dragLastX = 0
let dragLastY = 0
let pointerId: number | null = null
let leaveTimer: ReturnType<typeof setTimeout> | null = null
let viewRaf: number | null = null
let gestureEndTimer: ReturnType<typeof setTimeout> | null = null

const strategy = computed(() => props.clusterStrategy)

function flushViewSync() {
  viewScale.value = scale.value
  viewPanX.value = panX.value
  viewPanY.value = panY.value
}

function scheduleViewSync() {
  gesturing.value = true
  if (viewRaf != null) return
  viewRaf = requestAnimationFrame(() => {
    viewRaf = null
    flushViewSync()
  })
  if (gestureEndTimer) clearTimeout(gestureEndTimer)
  gestureEndTimer = setTimeout(() => {
    gesturing.value = false
    flushViewSync()
    gestureEndTimer = null
  }, 120)
}

function endGesture() {
  if (viewRaf != null) {
    cancelAnimationFrame(viewRaf)
    viewRaf = null
  }
  if (gestureEndTimer) {
    clearTimeout(gestureEndTimer)
    gestureEndTimer = null
  }
  gesturing.value = false
  flushViewSync()
}

const rateScale = computed(() =>
  fitRateColorScale(
    props.scene.markers
      .map((m) => m.rate)
      .filter((r): r is number => r != null),
  ),
)

const tileZoom = computed(() => {
  const ideal = Math.log2((WORLD.value * scale.value) / TILE_SIZE.value)
  return Math.max(0, Math.min(props.maxTileZ, Math.round(ideal)))
})

const tileCount = computed(() => 2 ** tileZoom.value)
const tileCover = computed(() => WORLD.value / tileCount.value)

const tiles = computed(() => {
  const z = tileZoom.value
  const n = tileCount.value
  const template = props.scene.map.tileUrlTemplate
  const list: Array<{ key: string, src: string, left: number, top: number, size: number }> = []
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      list.push({
        key: `${z}-${x}-${y}`,
        src: template
          .replace('{z}', String(z))
          .replace('{x}', String(x))
          .replace('{y}', String(y)),
        left: x * tileCover.value,
        top: y * tileCover.value,
        size: tileCover.value,
      })
    }
  }
  return list
})

const clusteredMarkers = computed((): IMapMarker[] => {
  const raw = props.scene.markers
  const strat = strategy.value
  if (!strat) return raw
  return strat.cluster(raw, viewScale.value, {
    width: viewportRef.value?.clientWidth ?? 800,
    height: viewportRef.value?.clientHeight ?? 600,
  })
})

/** Mob/gather count for ×N (cluster size); singles count as 1. */
function markerMobCount(marker: IMapMarker): number {
  if (marker.kind === 'cluster' || marker.kind === 'gather' || marker.kind === 'portrait') {
    return marker.renderModel(rateScale.value).count ?? 1
  }
  return 1
}

/** Higher % first; if equal — higher ×N first (more visible on top). */
function compareMarkersTopFirst(a: IMapMarker, b: IMapMarker): number {
  const rateDiff = (b.rate ?? 0) - (a.rate ?? 0)
  if (rateDiff !== 0) return rateDiff
  const countDiff = markerMobCount(b) - markerMobCount(a)
  if (countDiff !== 0) return countDiff
  return a.id.localeCompare(b.id)
}

/** Cluster result filtered by ×N range from the sidebar. */
const countFilteredMarkers = computed((): IMapMarker[] => {
  const minC = Number.isFinite(props.minMobCount) ? Math.max(1, props.minMobCount!) : 1
  const maxC = Number.isFinite(props.maxMobCount) ? Math.max(minC, props.maxMobCount!) : Number.POSITIVE_INFINITY
  return clusteredMarkers.value.filter((m) => {
    const c = markerMobCount(m)
    return c >= minC && c <= maxC
  })
})

function displayPoint(marker: IMapMarker): MapPoint {
  const o = spiderOffsets.value.get(marker.id)
  if (!o) return marker.point
  return {
    ...marker.point,
    mapX: marker.point.mapX + o.dx,
    mapY: marker.point.mapY + o.dy,
  }
}

/** Always cull to padded viewport (uses view* camera). */
const culledMarkers = computed((): IMapMarker[] => {
  const vp = viewportRef.value
  const list = countFilteredMarkers.value
  if (!vp) return list
  const pad = 80
  const s = Math.max(viewScale.value, 0.0001)
  const left = (-viewPanX.value - pad) / s
  const top = (-viewPanY.value - pad) / s
  const right = (-viewPanX.value + vp.clientWidth + pad) / s
  const bottom = (-viewPanY.value + vp.clientHeight + pad) / s
  return list.filter((m) => {
    const p = displayPoint(m)
    return p.mapX >= left && p.mapX <= right && p.mapY >= top && p.mapY <= bottom
  })
})

const culledCount = computed(() => culledMarkers.value.length)

/** Cap DOM chips; keep highest-rate markers. */
const visibleMarkers = computed((): IMapMarker[] => {
  const list = culledMarkers.value
  if (!props.capDomMarkers || list.length <= MAX_DOM_MARKERS) return list
  return [...list].sort(compareMarkersTopFirst).slice(0, MAX_DOM_MARKERS)
})

const domCapped = computed(() => props.capDomMarkers && culledCount.value > MAX_DOM_MARKERS)

const stageStyle = computed(() => ({
  width: `${WORLD.value}px`,
  height: `${WORLD.value}px`,
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${scale.value})`,
}))

const stackMemberIds = computed(() => {
  const set = new Set<string>()
  for (const m of stackPopover.value?.members ?? []) set.add(m.id)
  return set
})

/**
 * Stack layout + group membership for popover reuse.
 * Skipped when too many chips are on screen (z-index only).
 */
const stackState = computed(() => {
  const layouts = new Map<string, StackLayout>()
  const groups = new Map<string, IMapMarker[]>()
  if (spiderOffsets.value.size > 0) return { layouts, groups }

  const pool = visibleMarkers.value
  if (pool.length === 0 || pool.length > STACK_LAYOUT_MAX) {
    return { layouts, groups }
  }

  const s = Math.max(viewScale.value, 0.0001)
  const radius = STACK_SCREEN_PX / s
  const assigned = new Set<string>()
  let groupSeq = 0

  for (const seed of pool) {
    if (assigned.has(seed.id) || seed.kind === 'gather') continue
    const members = [seed]
    const used = new Set([seed.id])
    let changed = true
    while (changed) {
      changed = false
      for (const candidate of pool) {
        if (used.has(candidate.id) || candidate.kind === 'gather') continue
        const cp = candidate.point
        if (members.some((m) => {
          const mp = m.point
          return Math.hypot(mp.mapX - cp.mapX, mp.mapY - cp.mapY) <= radius
        })) {
          members.push(candidate)
          used.add(candidate.id)
          changed = true
        }
      }
    }
    members.sort(compareMarkersTopFirst)
    const size = members.length
    const top = members[0]!
    const groupId = `g${groupSeq++}`
    groups.set(groupId, members)
    const anchorX = top.point.mapX
    const anchorY = top.point.mapY
    members.forEach((m, rank) => {
      assigned.add(m.id)
      layouts.set(m.id, {
        size,
        rank,
        fanDy: size > 1 && rank > 0 ? STACK_FAN_SCREEN_PX : 0,
        anchorX,
        anchorY,
        isTop: size > 1 && rank === 0,
        isBottom: size > 1 && rank === size - 1,
        groupId,
      })
    })
  }
  return { layouts, groups }
})

const stackLayoutById = computed(() => stackState.value.layouts)

/** Paint weaker first so stronger (% then ×N) wins when layers overlap. */
const markersForRender = computed(() => {
  return [...visibleMarkers.value].sort((a, b) => -compareMarkersTopFirst(a, b))
})

/** Cached render models for markers currently in the DOM. */
const markerModelsById = computed(() => {
  const map = new Map<string, MarkerRenderModel>()
  const scaleFit = rateScale.value
  for (const m of markersForRender.value) {
    map.set(m.id, m.renderModel(scaleFit))
  }
  // Also cache popover members (may include capped-out siblings when using findStack fallback).
  for (const m of stackPopover.value?.members ?? []) {
    if (!map.has(m.id)) map.set(m.id, m.renderModel(scaleFit))
  }
  return map
})

/** ×N color scale from cluster sizes + stack deck sizes currently on screen. */
const countScale = computed(() => {
  const counts: number[] = []
  for (const m of visibleMarkers.value) {
    if (m.kind !== 'cluster' && m.kind !== 'gather' && m.kind !== 'portrait') continue
    const c = markerModelsById.value.get(m.id)?.count
    if (c != null && c >= 2) counts.push(c)
  }
  for (const layout of stackLayoutById.value.values()) {
    if (layout.size >= 2) counts.push(layout.size)
  }
  return fitCountColorScale(counts)
})

function markerModel(marker: IMapMarker): MarkerRenderModel {
  return markerModelsById.value.get(marker.id) ?? marker.renderModel(rateScale.value)
}

/** Reuse stack groups when available; otherwise cheap proximity on visible pool. */
function findStack(seed: IMapMarker): IMapMarker[] {
  const layout = stackLayoutById.value.get(seed.id)
  if (layout) {
    const group = stackState.value.groups.get(layout.groupId)
    if (group?.length) return group
  }

  const pool = visibleMarkers.value
  const s = Math.max(viewScale.value, 0.0001)
  const radius = STACK_SCREEN_PX / s
  const members = [seed]
  const used = new Set([seed.id])
  for (const candidate of pool) {
    if (used.has(candidate.id)) continue
    const cp = displayPoint(candidate)
    const sp = displayPoint(seed)
    if (Math.hypot(sp.mapX - cp.mapX, sp.mapY - cp.mapY) <= radius) {
      members.push(candidate)
      used.add(candidate.id)
    }
  }
  return members.sort(compareMarkersTopFirst)
}

function worldToViewport(mapX: number, mapY: number) {
  return {
    x: panX.value + mapX * scale.value,
    y: panY.value + mapY * scale.value,
  }
}

function openStackPopover(marker: IMapMarker) {
  const members = findStack(marker)
  if (members.length < 2) {
    stackPopover.value = null
    return
  }
  const p = displayPoint(marker)
  const screen = worldToViewport(p.mapX, p.mapY)
  const vp = viewportRef.value
  const left = Math.min(Math.max(8, screen.x + 14), (vp?.clientWidth ?? 400) - 220)
  const top = Math.min(Math.max(8, screen.y + 14), (vp?.clientHeight ?? 400) - 160)
  stackPopover.value = {
    anchorId: marker.id,
    members,
    left,
    top,
  }
}

function clearLeaveTimer() {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
}

function onMarkerEnter(marker: IMapMarker) {
  if (dragging.value) return
  clearLeaveTimer()
  hoveredMarkerId.value = marker.id
  focusMarkerId.value = marker.id
  if (spiderOffsets.value.size > 0) return
  // Gather and portrait chips stay on their own point; no mob stack popover.
  if (marker.kind === 'gather' || marker.kind === 'portrait') return
  openStackPopover(marker)
}

function onMarkerLeave() {
  clearLeaveTimer()
  leaveTimer = setTimeout(() => {
    hoveredMarkerId.value = null
    if (!stackPopover.value) focusMarkerId.value = null
  }, 120)
}

function onPopoverEnter() {
  clearLeaveTimer()
}

function onPopoverLeave() {
  clearLeaveTimer()
  leaveTimer = setTimeout(() => {
    hoveredMarkerId.value = null
    focusMarkerId.value = null
    if (spiderOffsets.value.size === 0) stackPopover.value = null
  }, 160)
}

function selectStackMember(marker: IMapMarker) {
  focusMarkerId.value = marker.id
  hoveredMarkerId.value = marker.id
}

function openMarkerDetail(marker: IMapMarker) {
  if (marker.kind === 'pin' || marker.kind === 'gather' || !marker.mobId) return
  focusMarkerId.value = marker.id
  hoveredMarkerId.value = marker.id
  emit('select-marker', marker)
}

function onStackItemActivate(marker: IMapMarker) {
  selectStackMember(marker)
  openMarkerDetail(marker)
}

function spiderfyCurrentStack() {
  const members = stackPopover.value?.members
  if (!members || members.length < 2) return
  const s = Math.max(scale.value, 0.0001)
  const radius = SPIDER_SCREEN_PX / s
  const cx = members.reduce((sum, m) => sum + m.point.mapX, 0) / members.length
  const cy = members.reduce((sum, m) => sum + m.point.mapY, 0) / members.length
  const next = new Map<string, { dx: number, dy: number }>()
  members.forEach((m, i) => {
    const angle = (Math.PI * 2 * i) / members.length - Math.PI / 2
    next.set(m.id, {
      dx: cx + Math.cos(angle) * radius - m.point.mapX,
      dy: cy + Math.sin(angle) * radius - m.point.mapY,
    })
  })
  spiderOffsets.value = next
  const screen = worldToViewport(cx, cy)
  const vp = viewportRef.value
  stackPopover.value = {
    anchorId: members[0]!.id,
    members,
    left: Math.min(Math.max(8, screen.x + 18), (vp?.clientWidth ?? 400) - 220),
    top: Math.min(Math.max(8, screen.y + 18), (vp?.clientHeight ?? 400) - 160),
  }
  endGesture()
}

function collapseSpiderfy() {
  spiderOffsets.value = new Map()
  stackPopover.value = null
  focusMarkerId.value = null
  hoveredMarkerId.value = null
}

function markerStyle(marker: IMapMarker) {
  const inv = 1 / Math.max(scale.value, 0.0001)
  const anchor = marker.kind === 'pin' ? '-50%, -100%' : '-50%, -50%'
  const model = markerModel(marker)
  const layout = stackLayoutById.value.get(marker.id)
  const spiderfied = spiderOffsets.value.size > 0
  const p = displayPoint(marker)
  const useDeck = Boolean(layout && layout.size > 1 && !spiderfied)
  const mapX = useDeck ? layout!.anchorX : p.mapX
  const mapY = useDeck ? layout!.anchorY : p.mapY
  const inStack = stackMemberIds.value.has(marker.id)
  const dimmed = Boolean(
    (hoveredMarkerId.value || focusMarkerId.value)
    && hoveredMarkerId.value !== marker.id
    && focusMarkerId.value !== marker.id
    && !inStack,
  )
  const highlight = focusMarkerId.value === marker.id || hoveredMarkerId.value === marker.id
  const fanDy = useDeck ? layout!.fanDy : 0
  const transform = fanDy
    ? `translate(${anchor}) scale(${inv}) translateY(${fanDy}px)`
    : `translate(${anchor}) scale(${inv})`
  const mobCount = markerMobCount(marker)
  let z = model.bossExclusive ? 4 : 2
  if (useDeck) {
    z = 100 + Math.round((marker.rate ?? 0) * 1000) + mobCount - layout!.rank
  }
  else {
    z = 2 + Math.round((marker.rate ?? 0) * 1000) + mobCount
  }
  if (inStack) z += 500
  if (highlight) z += 1000

  let countAccentValue: number | null = null
  // Gather ×N uses its own shadow text; rate chips keep count accent.
  if (marker.kind === 'cluster' && model.count != null && model.count >= 2) {
    countAccentValue = model.count
  }
  else if (marker.kind !== 'gather' && marker.kind !== 'portrait' && layout?.isTop && layout.size >= 2) {
    countAccentValue = layout.size
  }

  return {
    left: `${mapX}px`,
    top: `${mapY}px`,
    transform,
    opacity: dimmed ? 0.3 : 1,
    zIndex: z,
    '--marker-accent': model.accent || '',
    '--marker-ink': model.accentInk || '',
    '--marker-count-accent': countAccentValue != null
      ? countAccent(countAccentValue, countScale.value)
      : '',
  }
}

function clampScale(next: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next))
}

function centerOnPoint(mapX: number, mapY: number, nextScale = scale.value) {
  const vp = viewportRef.value
  if (!vp) return
  const s = clampScale(nextScale)
  scale.value = s
  panX.value = vp.clientWidth / 2 - mapX * s
  panY.value = vp.clientHeight / 2 - mapY * s
  endGesture()
}

function centerOnFocus(nextScale = scale.value) {
  const focus = props.scene.focusPoint
  if (!focus) return
  centerOnPoint(focus.mapX, focus.mapY, nextScale)
}

function fitWorld() {
  const vp = viewportRef.value
  if (!vp) return
  const pad = 0.92
  const s = clampScale(Math.min(vp.clientWidth / WORLD.value, vp.clientHeight / WORLD.value) * pad)
  scale.value = s
  panX.value = (vp.clientWidth - WORLD.value * s) / 2
  panY.value = (vp.clientHeight - WORLD.value * s) / 2
  endGesture()
}

function fitMarkers() {
  const vp = viewportRef.value
  const markers = props.scene.markers
  if (!vp) return
  if (markers.length === 0) {
    fitWorld()
    return
  }

  const xs = markers.map((m) => m.point.mapX)
  const ys = markers.map((m) => m.point.mapY)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const minSpan = WORLD.value * 0.08
  const spanX = Math.max(minSpan, maxX - minX)
  const spanY = Math.max(minSpan, maxY - minY)
  const pad = 1.2
  const s = clampScale(
    Math.min(vp.clientWidth / (spanX * pad), vp.clientHeight / (spanY * pad)),
  )
  centerOnPoint((minX + maxX) / 2, (minY + maxY) / 2, s)
}

function goToFocusControl() {
  if (props.scene.focusPoint) centerOnFocus(Math.max(scale.value, 0.28))
  else fitMarkers()
}

function zoomBy(factor: number, originX?: number, originY?: number) {
  const vp = viewportRef.value
  if (!vp) return
  const prev = scale.value
  const next = clampScale(prev * factor)
  if (next === prev) return

  const ox = originX ?? vp.clientWidth / 2
  const oy = originY ?? vp.clientHeight / 2
  const worldX = (ox - panX.value) / prev
  const worldY = (oy - panY.value) / prev
  scale.value = next
  panX.value = ox - worldX * next
  panY.value = oy - worldY * next
  if (spiderOffsets.value.size) collapseSpiderfy()
  else stackPopover.value = null
  scheduleViewSync()
}

function onWheel(e: WheelEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('.boss-map-stack-popover')) return
  const vp = viewportRef.value
  if (!vp) return
  const rect = vp.getBoundingClientRect()
  const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
  zoomBy(factor, e.clientX - rect.left, e.clientY - rect.top)
}

function onPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement
  if (target.closest('.boss-map-stack-popover') || target.closest('.boss-map-marker')) return
  dragging.value = true
  gesturing.value = true
  hoveredMarkerId.value = null
  if (spiderOffsets.value.size === 0) {
    stackPopover.value = null
    focusMarkerId.value = null
  }
  pointerId = e.pointerId
  dragLastX = e.clientX
  dragLastY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || pointerId !== e.pointerId) return
  panX.value += e.clientX - dragLastX
  panY.value += e.clientY - dragLastY
  dragLastX = e.clientX
  dragLastY = e.clientY
  scheduleViewSync()
}

function onPointerUp(e: PointerEvent) {
  if (pointerId !== e.pointerId) return
  dragging.value = false
  pointerId = null
  endGesture()
  try {
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }
  catch {
    // ignore
  }
}

function resetView() {
  collapseSpiderfy()
  nextTick(() => {
    if (props.scene.focusPoint) centerOnFocus(0.28)
    else if (props.scene.markers.length > 0) fitMarkers()
    else fitWorld()
  })
}

onMounted(resetView)

onBeforeUnmount(() => {
  clearLeaveTimer()
  if (viewRaf != null) cancelAnimationFrame(viewRaf)
  if (gestureEndTimer) clearTimeout(gestureEndTimer)
})

watch(
  () => [props.scene.focusPoint?.mapX, props.scene.focusPoint?.mapY, props.scene.markers.length] as const,
  () => resetView(),
)
</script>

<template>
  <div class="boss-map-viewer" :class="{ 'is-gesturing': gesturing }">
    <div
      ref="viewportRef"
      class="boss-map-viewport"
      :class="{ 'is-dragging': dragging }"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="boss-map-stage" :style="stageStyle">
        <img
          v-for="tile in tiles"
          :key="tile.key"
          class="boss-map-tile"
          :src="tile.src"
          alt=""
          draggable="false"
          :style="{
            left: `${tile.left}px`,
            top: `${tile.top}px`,
            width: `${tile.size}px`,
            height: `${tile.size}px`,
          }"
        >
        <div
          v-for="marker in markersForRender"
          :key="marker.id"
          class="boss-map-marker"
          :class="[
            `boss-map-marker--${marker.kind}`,
            {
              'is-stack-fan': (stackLayoutById.get(marker.id)?.size || 0) > 1,
              'is-stack-bottom': !!stackLayoutById.get(marker.id)?.isBottom,
            },
          ]"
          :style="markerStyle(marker)"
          :title="markerModel(marker).title || markerModel(marker).label"
          @pointerenter="onMarkerEnter(marker)"
          @pointerleave="onMarkerLeave"
          @click.stop="openMarkerDetail(marker)"
        >
          <template v-if="marker.kind === 'pin'">
            <span class="boss-map-marker-pin" aria-hidden="true" />
            <span class="boss-map-marker-label">{{ markerModel(marker).label }}</span>
          </template>
          <template v-else-if="marker.kind === 'gather' || marker.kind === 'portrait'">
            <span class="boss-map-marker-gather">
              <img
                v-if="markerModel(marker).iconUrl"
                class="boss-map-marker-gather-icon"
                :src="markerModel(marker).iconUrl!"
                alt=""
                draggable="false"
              >
              <span
                v-else
                class="boss-map-marker-gather-fallback"
              >{{ markerModel(marker).label.slice(0, 1) }}</span>
              <span
                v-if="markerModel(marker).count && markerModel(marker).count! >= 2"
                class="boss-map-marker-gather-mult"
              >×{{ markerModel(marker).count }}</span>
            </span>
          </template>
          <template v-else>
            <span class="boss-map-marker-badge">
              <span class="boss-map-marker-chip">
                {{ markerModel(marker).rateText || markerModel(marker).label }}
              </span>
              <span
                v-if="marker.kind === 'cluster' && markerModel(marker).count"
                class="boss-map-marker-mult"
              >×{{ markerModel(marker).count }}</span>
              <span
                v-else-if="(stackLayoutById.get(marker.id)?.size || 0) > 1
                  && stackLayoutById.get(marker.id)?.rank === 0"
                class="boss-map-marker-mult"
              >×{{ stackLayoutById.get(marker.id)?.size }}</span>
            </span>
          </template>
        </div>
      </div>

      <div
        v-if="stackPopover"
        class="boss-map-stack-popover"
        :style="{ left: `${stackPopover.left}px`, top: `${stackPopover.top}px` }"
        @pointerenter="onPopoverEnter"
        @pointerleave="onPopoverLeave"
        @pointerdown.stop
        @wheel.stop
      >
        <div class="boss-map-stack-head">
          <p class="boss-map-stack-title">
            В координате · {{ stackPopover.members.length }}
          </p>
          <button
            v-if="spiderOffsets.size === 0"
            type="button"
            class="btn btn-sm btn-ghost"
            @click="spiderfyCurrentStack"
          >
            <GitBranch class="ui-icon" aria-hidden="true" />
            Развести
          </button>
          <button
            v-else
            type="button"
            class="btn btn-sm btn-ghost"
            @click="collapseSpiderfy"
          >
            <X class="ui-icon" aria-hidden="true" />
            Собрать
          </button>
        </div>
        <ul class="boss-map-stack-list">
          <li
            v-for="m in stackPopover.members"
            :key="m.id"
            class="boss-map-stack-item"
            :class="{ 'is-active': focusMarkerId === m.id }"
            :title="markerModel(m).title || ''"
            @pointerenter="selectStackMember(m)"
            @click="onStackItemActivate(m)"
          >
            <span
              class="boss-map-stack-swatch"
              :style="{ background: markerModel(m).accent || 'var(--color-ready)' }"
            />
            <span class="boss-map-stack-rate">{{ markerModel(m).rateText || markerModel(m).label }}</span>
            <span class="boss-map-stack-name">{{ markerModel(m).title?.split(' · ')[0] || m.mobId || m.id }}</span>
          </li>
        </ul>
      </div>

      <p v-if="scene.markers.length === 0" class="boss-map-empty">
        {{ scene.emptyMessage || 'Нет координат на карте.' }}
      </p>
    </div>

    <div class="boss-map-toolbar">
      <div class="boss-map-tools">
        <button type="button" class="btn btn-sm btn-ghost btn-icon" aria-label="Приблизить" @click="zoomBy(1.2); endGesture()">
          <Plus class="ui-icon" aria-hidden="true" />
        </button>
        <button type="button" class="btn btn-sm btn-ghost btn-icon" aria-label="Отдалить" @click="zoomBy(1 / 1.2); endGesture()">
          <Minus class="ui-icon" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn btn-sm btn-ghost"
          :disabled="!scene.focusPoint && scene.markers.length === 0"
          @click="goToFocusControl"
        >
          <Crosshair class="ui-icon" aria-hidden="true" />
          {{ scene.focusLabel || (scene.focusPoint ? 'К меткам' : 'Все координаты') }}
        </button>
      </div>
      <p class="boss-map-hint">
        Колёсико — зум, перетаскивание — сдвиг
        <template v-if="domCapped">
          · на экране {{ MAX_DOM_MARKERS }} из {{ culledCount }}
        </template>
        <template v-else-if="scene.hintExtra"> · {{ scene.hintExtra }}</template>
      </p>
    </div>
  </div>
</template>
