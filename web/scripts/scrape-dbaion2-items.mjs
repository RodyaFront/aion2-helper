/**
 * Seed items: Raw Leather, Fresh Raw Meat, Refining Stone.
 * Names/icons from item HTML; Verteron drop markers via map monster layers + NPC JSON.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'shared', 'items')
const dropsDir = path.join(outDir, 'drops')
const iconsDir = path.join(root, 'public', 'items')
const mobsDir = path.join(root, 'public', 'mobs')

const SEED = [
  { id: 'raw_leather', itemId: 610530011 },
  { id: 'fresh_raw_meat', itemId: 610531001 },
  { id: 'refining_stone', itemId: 610530001 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'AionBossTracker-scrape/1.0 (+local offline catalog)',
      accept: 'text/html,application/json',
    },
  })
  return { ok: r.ok, status: r.status, text: await r.text(), url: r.url }
}

async function fetchJson(url) {
  const r = await fetchText(url)
  if (!r.ok) return null
  try {
    return JSON.parse(r.text)
  }
  catch {
    return null
  }
}

function toTilePoint(x, y) {
  return {
    x,
    y,
    mapX: Math.round(x * 0.5),
    mapY: Math.round(y * 0.5),
  }
}

async function downloadIcon(iconPath, itemKey) {
  if (!iconPath) return null
  const url = iconPath.startsWith('http') ? iconPath : `https://dbaion2.ru${iconPath}`
  const ext = path.extname(new URL(url).pathname) || '.webp'
  const file = `${itemKey}${ext}`
  const dest = path.join(iconsDir, file)
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    fs.mkdirSync(iconsDir, { recursive: true })
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
    return `/items/${file}`
  }
  catch {
    return null
  }
}

async function downloadMobIcon(iconKey, mobId) {
  if (!iconKey) return null
  const dest = path.join(mobsDir, `${mobId}.webp`)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return `/mobs/${mobId}.webp`
  try {
    const r = await fetch(`https://dbaion2.ru/icons/${iconKey}.webp`)
    if (!r.ok) return null
    fs.mkdirSync(mobsDir, { recursive: true })
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
    return `/mobs/${mobId}.webp`
  }
  catch {
    return null
  }
}

function parseItemMeta(html, itemId) {
  const nameEn = html.match(/data-name="([^"]+)"/)?.[1]
    || html.match(/<p class="h1"[^>]*>([^<]+)/)?.[1]
  const icon = html.match(/src="(\/icons\/[^"]+)"/)?.[1]
  return {
    itemId: String(itemId),
    nameEn: nameEn || String(itemId),
    iconPath: icon || null,
    category: 'crafting_material',
    grade: html.match(/\b(Common|Rare|Epic|Unique)\b/)?.[1] || 'Common',
  }
}

/** Collect Verteron spawn points keyed by mobId from dbaion2 map layers. */
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

async function fetchRuItemName(itemId) {
  const r = await fetchText(`https://dbaion2.ru/items/${itemId}/`)
  if (!r.ok) return null
  return r.text.match(/data-name="([^"]+)"/)?.[1]
    || r.text.match(/<p class="h1"[^>]*>([^<]+)/)?.[1]
    || null
}

async function fetchRuNpcName(mobId) {
  const r = await fetchText(`https://dbaion2.ru/npcs/${mobId}/`)
  if (!r.ok) return null
  return r.text.match(/<p class="h1"[^>]*>([^<]+)/)?.[1] || null
}

async function main() {
  console.log('Loading Verteron map…')
  const mapJson = await fetchJson('https://dbaion2.ru/data-en/maps/verteron.json')
  if (!mapJson) throw new Error('Failed to load verteron map json')
  const spawnIndex = indexVerteronSpawns(mapJson)
  const mobIds = [...spawnIndex.keys()]
  console.log(`Verteron mob templates with coords: ${mobIds.length}`)

  /** itemId -> DropSource[] */
  const dropsByItem = new Map(SEED.map((s) => [String(s.itemId), []]))

  let done = 0
  for (const mobId of mobIds) {
    done++
    if (done % 25 === 0 || done === mobIds.length) {
      process.stdout.write(`  npc ${done}/${mobIds.length}\r`)
    }
    const npc = await fetchJson(`https://dbaion2.ru/data-en/npc/${mobId}.json`)
    await sleep(35)
    if (!npc?.drops?.length) continue

    for (const seed of SEED) {
      const hit = npc.drops.find((d) => Number(d.id) === seed.itemId)
      if (!hit) continue
      const rate = Number(hit.chance)
      if (!Number.isFinite(rate)) continue
      const spawns = spawnIndex.get(mobId) || []
      // Prefer map-layer points; fall back to npc.spawns.verteron
      const pts = spawns.length
        ? spawns
        : (npc.spawns?.verteron?.points || []).map(([x, y]) => toTilePoint(x, y))
      if (!pts.length) continue

      const nameRu = await fetchRuNpcName(mobId)
      await sleep(20)
      const iconKey = npc.icon || null
      const iconUrl = await downloadMobIcon(iconKey, String(mobId))
      await sleep(15)
      dropsByItem.get(String(seed.itemId)).push({
        mobId: String(mobId),
        nameEn: npc.name || `NPC ${mobId}`,
        nameRu,
        level: npc.level ?? null,
        region: 'Verteron',
        regionId: 'verteron',
        rate: Math.round(rate * 1000) / 1000,
        hasMap: true,
        onmapUrl: `https://dbaion2.ru/en/map/#verteron&npc=${mobId}`,
        icon: iconKey,
        iconUrl: iconUrl || (iconKey ? `https://dbaion2.ru/icons/${iconKey}.webp` : null),
        title: npc.title || null,
        gradeName: npc.gradeName || npc.grade || null,
        creatureName: npc.creatureName || npc.creature || null,
        race: npc.race || null,
        spawns: pts,
      })
    }
  }
  console.log('')

  const catalog = {
    scrapedAt: new Date().toISOString(),
    source: 'dbaion2.ru',
    attribution: 'Item/drop/spawn data from dbaion2.ru (fan client dump). AION 2 © NCSOFT.',
    items: [],
  }

  fs.mkdirSync(dropsDir, { recursive: true })
  fs.mkdirSync(iconsDir, { recursive: true })

  for (const seed of SEED) {
    const page = await fetchText(`https://dbaion2.ru/en/items/${seed.itemId}/`)
    if (!page.ok) throw new Error(`Item ${seed.itemId} HTTP ${page.status}`)
    const meta = parseItemMeta(page.text, seed.itemId)
    const nameRu = await fetchRuItemName(seed.itemId)
    const icon = await downloadIcon(meta.iconPath, seed.id)
    const sources = (dropsByItem.get(String(seed.itemId)) || [])
      .sort((a, b) => b.rate - a.rate || a.nameEn.localeCompare(b.nameEn))

    const dropPayload = {
      itemId: String(seed.itemId),
      scrapedAt: new Date().toISOString(),
      source: 'dbaion2.ru',
      sourceUrl: `https://dbaion2.ru/en/items/${seed.itemId}/`,
      sources,
    }
    fs.writeFileSync(path.join(dropsDir, `${seed.id}.json`), JSON.stringify(dropPayload, null, 2))

    const verteronSpawnCount = sources.reduce((n, s) => n + s.spawns.length, 0)
    catalog.items.push({
      id: seed.id,
      itemId: String(seed.itemId),
      nameEn: meta.nameEn,
      nameRu: nameRu || meta.nameEn,
      category: meta.category,
      grade: meta.grade,
      icon,
      sourceUrl: `https://dbaion2.ru/en/items/${seed.itemId}/`,
      dropSourceCount: sources.length,
      verteronSpawnCount,
      hasVerteronMap: verteronSpawnCount > 0,
    })
    console.log(`${seed.id}: sources=${sources.length} spawns=${verteronSpawnCount}`)
  }

  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2))
  console.log('Wrote catalog', catalog.items.length)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
