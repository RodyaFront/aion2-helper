/**
 * Index region Resources layers → itemId → shared gather spawns.
 *
 * All grades listed on a layer share the same coordinates (common node truth).
 * Non-GATHERRESOURCE junk in layer.items (e.g. reward boxes) is skipped.
 *
 * Output:
 *   public/data/item-gather-index.json              (verteron, default)
 *   public/data/item-gather-index-altgard.json      (--region=altgard)
 * Also patches catalog flags for the target region.
 *
 * Usage:
 *   node scripts/build-item-gather-index.mjs
 *   node scripts/build-item-gather-index.mjs --region=altgard
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = path.join(root, 'public', 'data', 'items-catalog.json')

const regionArg = process.argv.find((a) => a.startsWith('--region='))
const region = (regionArg?.split('=')[1] || 'verteron').toLowerCase()
if (region !== 'verteron' && region !== 'altgard') {
  console.error('Unsupported region:', region)
  process.exit(1)
}

const outPath = region === 'altgard'
  ? path.join(root, 'public', 'data', 'item-gather-index-altgard.json')
  : path.join(root, 'public', 'data', 'item-gather-index.json')

const mapUrl = `https://dbaion2.ru/data-en/maps/${region}.json`
const mapRuUrl = `https://dbaion2.ru/data/maps/${region}.json`

const flagHas = region === 'altgard' ? 'hasAltgardGatherMap' : 'hasGatherMap'
const flagCount = region === 'altgard' ? 'altgardGatherSpawnCount' : 'gatherSpawnCount'

function toTilePoint(x, y) {
  return {
    x,
    y,
    mapX: Math.round(x * 0.5),
    mapY: Math.round(y * 0.5),
  }
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'AionBossTracker-gather-index/1.0', accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return r.json()
}

if (!fs.existsSync(catalogPath)) {
  console.error('catalog missing:', catalogPath)
  process.exit(1)
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
/** @type {Map<string, any>} */
const catalogById = new Map()
for (const item of catalog.items || []) {
  catalogById.set(String(item.itemId || item.id), item)
}

function isGatherResource(itemId) {
  const row = catalogById.get(String(itemId))
  return row?.category === 'GATHERRESOURCE'
}

console.log(`fetch ${region} map (EN)…`)
const mapEn = await fetchJson(mapUrl)
let mapRu = null
try {
  console.log(`fetch ${region} map (RU)…`)
  mapRu = await fetchJson(mapRuUrl)
}
catch (err) {
  console.warn('RU map skipped:', err instanceof Error ? err.message : err)
}

/** @type {Map<string, string>} */
const ruNameByLayerId = new Map()
if (mapRu?.layers) {
  for (const layer of mapRu.layers) {
    if (layer.group !== 'Resources' && layer.group !== 'Ресурсы') continue
    if (layer.id && layer.name) ruNameByLayerId.set(String(layer.id), String(layer.name))
  }
}

/** @type {Record<string, any>} */
const layers = {}
/** @type {Record<string, string>} */
const items = {}

for (const layer of mapEn.layers || []) {
  if (layer.group !== 'Resources') continue
  const layerId = String(layer.id || '')
  if (!layerId) continue

  const spawns = []
  for (const pt of layer.points || []) {
    const x = pt?.[0]
    const y = pt?.[1]
    if (typeof x !== 'number' || typeof y !== 'number') continue
    spawns.push(toTilePoint(x, y))
  }
  if (!spawns.length) continue

  const gatherItemIds = []
  for (const rawId of layer.items || []) {
    const itemId = String(rawId)
    if (!isGatherResource(itemId)) continue
    if (!gatherItemIds.includes(itemId)) gatherItemIds.push(itemId)
    items[itemId] = layerId
  }
  if (!gatherItemIds.length) {
    console.warn(`skip layer ${layerId}: no GATHERRESOURCE items`)
    continue
  }

  const iconKey = layer.icon ? String(layer.icon) : null
  layers[layerId] = {
    nameEn: String(layer.name || layerId),
    nameRu: ruNameByLayerId.get(layerId) || null,
    icon: iconKey,
    iconUrl: iconKey ? `https://dbaion2.ru/icons/${iconKey}.webp` : null,
    itemIds: gatherItemIds,
    spawns,
  }
}

const payload = {
  scrapedAt: new Date().toISOString(),
  regionId: region,
  source: `dbaion2.ru ${region} Resources layers`,
  attribution: 'Gather spawn data from dbaion2.ru (fan client dump). AION 2 © NCSOFT.',
  layerCount: Object.keys(layers).length,
  itemCount: Object.keys(items).length,
  spawnCount: Object.values(layers).reduce((sum, l) => sum + (l.spawns?.length || 0), 0),
  layers,
  items,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`)
const mb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2)
console.log(`wrote ${outPath} (${mb} MB)`)
console.log(`layers=${payload.layerCount} items=${payload.itemCount} spawns=${payload.spawnCount}`)

let patched = 0
for (const item of catalog.items || []) {
  const itemId = String(item.itemId || item.id)
  const layerId = items[itemId]
  const spawnCount = layerId ? (layers[layerId]?.spawns?.length || 0) : 0
  const nextHas = spawnCount > 0
  if (item[flagHas] !== nextHas || item[flagCount] !== spawnCount) {
    item[flagHas] = nextHas
    item[flagCount] = spawnCount
    patched++
  }
  else if (item[flagHas] == null || item[flagCount] == null) {
    item[flagHas] = nextHas
    item[flagCount] = spawnCount
    patched++
  }
}

for (const item of catalog.items || []) {
  if (item[flagHas] == null) item[flagHas] = false
  if (item[flagCount] == null) item[flagCount] = 0
}

fs.writeFileSync(catalogPath, `${JSON.stringify(catalog)}\n`)
console.log(
  `catalog patched rows: ${patched}, with ${region} gather map: ${(catalog.items || []).filter((i) => i[flagHas]).length}`,
)
