/**
 * Join mob loot with region map spawn points → item→map index.
 *
 * Output:
 *   public/data/item-drop-index.json           (verteron, default)
 *   public/data/item-drop-index-altgard.json   (--region=altgard)
 * Also patches catalog map flags for the target region.
 *
 * Usage:
 *   node scripts/build-item-drop-index.mjs
 *   node scripts/build-item-drop-index.mjs --region=altgard
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mobsDir = path.join(root, 'shared', 'items', 'mobs')
const dropsDir = path.join(root, 'shared', 'items', 'drops')
const catalogPath = path.join(root, 'public', 'data', 'items-catalog.json')

const regionArg = process.argv.find((a) => a.startsWith('--region='))
const region = (regionArg?.split('=')[1] || 'verteron').toLowerCase()
if (region !== 'verteron' && region !== 'altgard') {
  console.error('Unsupported region:', region)
  process.exit(1)
}

const outPath = region === 'altgard'
  ? path.join(root, 'public', 'data', 'item-drop-index-altgard.json')
  : path.join(root, 'public', 'data', 'item-drop-index.json')

const flagHas = region === 'altgard' ? 'hasAltgardMap' : 'hasVerteronMap'
const flagCount = region === 'altgard' ? 'altgardSpawnCount' : 'verteronSpawnCount'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function toTilePoint(x, y) {
  return {
    x,
    y,
    mapX: Math.round(x * 0.5),
    mapY: Math.round(y * 0.5),
  }
}

function indexRegionSpawns(mapJson) {
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

console.log(`fetch ${region} map…`)
const mapJson = await fetchJson(`https://dbaion2.ru/data-en/maps/${region}.json`)
const spawnIndex = indexRegionSpawns(mapJson)
console.log(`spawn templates: ${spawnIndex.size}`)

/** @type {Record<string, any>} */
const mobs = {}
/** @type {Record<string, { mobId: string, rate: number }[]>} */
const items = {}

function ensureMob(mobId, spawns) {
  if (!mobs[mobId]) {
    mobs[mobId] = {
      nameEn: null,
      nameRu: null,
      level: null,
      icon: null,
      iconUrl: null,
      title: null,
      gradeName: null,
      creatureName: null,
      race: null,
      spawns,
      drops: null,
    }
  }
  return mobs[mobId]
}

function addDropLink(itemId, mobId, rate) {
  if (!Number.isFinite(rate)) return
  if (!items[itemId]) items[itemId] = []
  items[itemId].push({
    mobId,
    rate: Math.round(rate * 1000) / 1000,
  })
}

// Prefer local loot tables when present (Verteron pipeline).
const mobFiles = fs.existsSync(mobsDir)
  ? fs.readdirSync(mobsDir).filter((f) => f.endsWith('.json'))
  : []
let localHits = 0
for (const file of mobFiles) {
  const mobId = file.replace(/\.json$/, '')
  const spawns = spawnIndex.get(mobId)
  if (!spawns?.length) continue
  localHits++
  const loot = JSON.parse(fs.readFileSync(path.join(mobsDir, file), 'utf8'))
  const mob = ensureMob(mobId, spawns)
  mob.level = loot.baseLevel ?? mob.level

  for (const drop of loot.drops || []) {
    addDropLink(String(drop.itemId), mobId, Number(drop.chance))
  }
}
console.log(`local loot hits on ${region}: ${localHits}`)

// Ensure every mapped spawn mob exists even without local loot (Altgard).
for (const [mobId, spawns] of spawnIndex.entries()) {
  ensureMob(mobId, spawns)
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
const needDrops = Object.keys(mobs).filter((id) => {
  // Fetch drops when this region has no local loot contribution for the mob.
  return !mobFiles.some((f) => f === `${id}.json`)
})
console.log(`fetch NPC meta for ${needMeta.length} mobs, drops for ${needDrops.length}…`)
const needFetch = new Set([...needMeta, ...needDrops])
let done = 0
for (const mobId of needFetch) {
  done++
  if (done % 20 === 0 || done === needFetch.size) {
    process.stdout.write(`  npc ${done}/${needFetch.size}\r`)
  }
  try {
    const npc = await fetchJson(`https://dbaion2.ru/data-en/npc/${mobId}.json`)
    const mob = mobs[mobId]
    if (!mob.nameEn) mob.nameEn = npc.name || `NPC ${mobId}`
    mob.level = npc.level ?? mob.level
    mob.icon = npc.icon || mob.icon
    mob.iconUrl = npc.icon
      ? `https://dbaion2.ru/icons/${npc.icon}.webp`
      : mob.iconUrl
    mob.title = npc.title || mob.title
    mob.gradeName = npc.gradeName || npc.grade || mob.gradeName
    mob.creatureName = npc.creatureName || npc.creature || mob.creatureName
    mob.race = npc.race || mob.race

    if (needDrops.includes(mobId)) {
      const dropLines = []
      for (const drop of npc.drops || []) {
        const itemId = String(drop.id ?? drop.itemId ?? '')
        if (!itemId) continue
        const rate = drop.chance == null || drop.chance === '' ? NaN : Number(drop.chance)
        addDropLink(itemId, mobId, rate)
        dropLines.push({
          itemId,
          nameEn: drop.name || drop.nameEn || itemId,
          icon: drop.icon || null,
          iconUrl: drop.icon ? `https://dbaion2.ru/icons/${drop.icon}.webp` : null,
          gradeName: drop.gradeName || drop.grade || null,
          category: drop.category || null,
          chance: Number.isFinite(rate) ? Math.round(rate * 1000) / 1000 : null,
          min: drop.min ?? null,
          max: drop.max ?? null,
        })
      }
      mob.drops = dropLines
    }
  }
  catch {
    if (!mobs[mobId].nameEn) mobs[mobId].nameEn = `NPC ${mobId}`
  }
  await sleep(25)
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
  regionId: region,
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
    if (region === 'verteron') {
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
    else if (item[flagHas] !== nextHas || item[flagCount] !== spawnCount) {
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
    `catalog patched rows: ${patched}, with ${region} map: ${(catalog.items || []).filter((i) => i[flagHas]).length}`,
  )
}
else {
  console.warn('catalog missing — skip patch:', catalogPath)
}
