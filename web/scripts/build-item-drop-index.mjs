/**
 * Join local mob loot tables with Verteron map spawn points → item→map index.
 *
 * Output:
 *   public/data/item-drop-index.json
 * Also patches hasVerteronMap / counts on public/data/items-catalog.json
 *
 * Usage: node scripts/build-item-drop-index.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mobsDir = path.join(root, 'shared', 'items', 'mobs')
const dropsDir = path.join(root, 'shared', 'items', 'drops')
const outPath = path.join(root, 'public', 'data', 'item-drop-index.json')
const catalogPath = path.join(root, 'public', 'data', 'items-catalog.json')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function toTilePoint(x, y) {
  return {
    x,
    y,
    mapX: Math.round(x * 0.5),
    mapY: Math.round(y * 0.5),
  }
}

function indexVerteronSpawns(mapJson) {
  const byMob = new Map()
  for (const layer of mapJson.layers || []) {
    if (layer.group !== 'Monsters') continue
    for (const pt of layer.points || []) {
      const [x, y, third] = pt
      if (typeof third !== 'number') continue
      const mobId = String(third)
      const list = byMob.get(mobId) || []
      list.push(toTilePoint(x, y))
      byMob.set(mobId, list)
    }
  }
  return byMob
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'AionBossTracker-drop-index/1.0', accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return r.json()
}

console.log('fetch Verteron map…')
const mapJson = await fetchJson('https://dbaion2.ru/data-en/maps/verteron.json')
const spawnIndex = indexVerteronSpawns(mapJson)
console.log(`spawn templates: ${spawnIndex.size}`)

/** @type {Record<string, any>} */
const mobs = {}
/** @type {Record<string, { mobId: string, rate: number }[]>} */
const items = {}

const mobFiles = fs.readdirSync(mobsDir).filter((f) => f.endsWith('.json'))
for (const file of mobFiles) {
  const mobId = file.replace(/\.json$/, '')
  const spawns = spawnIndex.get(mobId)
  if (!spawns?.length) continue

  const loot = JSON.parse(fs.readFileSync(path.join(mobsDir, file), 'utf8'))
  mobs[mobId] = {
    nameEn: null,
    nameRu: null,
    level: loot.baseLevel ?? null,
    icon: null,
    iconUrl: null,
    title: null,
    gradeName: null,
    creatureName: null,
    race: null,
    spawns,
  }

  for (const drop of loot.drops || []) {
    const itemId = String(drop.itemId)
    const rate = Number(drop.chance)
    if (!Number.isFinite(rate)) continue
    if (!items[itemId]) items[itemId] = []
    items[itemId].push({
      mobId,
      rate: Math.round(rate * 1000) / 1000,
    })
  }
}

// Richer NPC meta from hand-scraped seed drop files.
for (const file of fs.existsSync(dropsDir) ? fs.readdirSync(dropsDir) : []) {
  if (!file.endsWith('.json')) continue
  const drop = JSON.parse(fs.readFileSync(path.join(dropsDir, file), 'utf8'))
  for (const src of drop.sources || []) {
    const mob = mobs[src.mobId]
    if (!mob) continue
    mob.nameEn = src.nameEn || mob.nameEn
    mob.nameRu = src.nameRu ?? mob.nameRu
    mob.level = src.level ?? mob.level
    mob.icon = src.icon ?? mob.icon
    mob.iconUrl = src.iconUrl ?? mob.iconUrl
    mob.title = src.title ?? mob.title
    mob.gradeName = src.gradeName ?? mob.gradeName
    mob.creatureName = src.creatureName ?? mob.creatureName
    mob.race = src.race ?? mob.race
  }
}

const needMeta = Object.keys(mobs).filter((id) => !mobs[id].nameEn)
console.log(`fetch NPC meta for ${needMeta.length} mobs…`)
let done = 0
for (const mobId of needMeta) {
  done++
  if (done % 20 === 0 || done === needMeta.length) {
    process.stdout.write(`  npc ${done}/${needMeta.length}\r`)
  }
  try {
    const npc = await fetchJson(`https://dbaion2.ru/data-en/npc/${mobId}.json`)
    const mob = mobs[mobId]
    mob.nameEn = npc.name || `NPC ${mobId}`
    mob.level = npc.level ?? mob.level
    mob.icon = npc.icon || mob.icon
    mob.iconUrl = npc.icon
      ? `https://dbaion2.ru/icons/${npc.icon}.webp`
      : mob.iconUrl
    mob.title = npc.title || mob.title
    mob.gradeName = npc.gradeName || npc.grade || mob.gradeName
    mob.creatureName = npc.creatureName || npc.creature || mob.creatureName
    mob.race = npc.race || mob.race
  }
  catch {
    mobs[mobId].nameEn = `NPC ${mobId}`
  }
  await sleep(30)
}
console.log('')

// Deduplicate item→mob links (same mob can appear once).
for (const itemId of Object.keys(items)) {
  const byMob = new Map()
  for (const row of items[itemId]) {
    const prev = byMob.get(row.mobId)
    if (!prev || row.rate > prev.rate) byMob.set(row.mobId, row)
  }
  items[itemId] = [...byMob.values()].sort(
    (a, b) => b.rate - a.rate || a.mobId.localeCompare(b.mobId),
  )
}

const payload = {
  scrapedAt: new Date().toISOString(),
  source: 'dbaion2.ru + local mob loot',
  attribution: 'Drop/spawn data from dbaion2.ru (fan client dump). AION 2 © NCSOFT.',
  mobCount: Object.keys(mobs).length,
  itemCount: Object.keys(items).length,
  mobs,
  items,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`)
const mb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2)
console.log(`wrote ${outPath} (${mb} MB)`)
console.log(`mobs=${payload.mobCount} items-with-map=${payload.itemCount}`)

// Patch catalog flags so list UI shows «Карта» without a second pass.
if (fs.existsSync(catalogPath)) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  let patched = 0
  for (const item of catalog.items || []) {
    const links = items[String(item.itemId)] || []
    let spawnCount = 0
    for (const link of links) {
      spawnCount += mobs[link.mobId]?.spawns?.length || 0
    }
    const nextHas = spawnCount > 0
    const nextSources = links.length
    if (
      item.hasVerteronMap !== nextHas
      || item.verteronSpawnCount !== spawnCount
      || item.dropSourceCount !== nextSources
    ) {
      item.hasVerteronMap = nextHas
      item.verteronSpawnCount = spawnCount
      item.dropSourceCount = nextSources
      patched++
    }
  }
  fs.writeFileSync(catalogPath, `${JSON.stringify(catalog)}\n`)
  console.log(`catalog patched rows: ${patched}, with map: ${(catalog.items || []).filter((i) => i.hasVerteronMap).length}`)
}
else {
  console.warn('catalog missing — skip patch:', catalogPath)
}
