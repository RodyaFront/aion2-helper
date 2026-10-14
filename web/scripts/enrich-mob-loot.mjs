/**
 * Fetch full NPC drop tables for all mobs in item drop JSON files.
 * Writes shared/items/mobs/{mobId}.json and optional public/drop-icons/*.webp
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dropsDir = path.join(root, 'shared', 'items', 'drops')
const mobLootDir = path.join(root, 'shared', 'items', 'mobs')
const dropIconsDir = path.join(root, 'public', 'drop-icons')
const DOWNLOAD_ICONS = process.argv.includes('--download-icons')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'AionBossTracker-enrich-loot/1.0', accept: 'application/json' },
  })
  if (!r.ok) return null
  try {
    return await r.json()
  }
  catch {
    return null
  }
}

function safeIconFile(iconKey) {
  return `${String(iconKey).replace(/[^\w.-]+/g, '_')}.webp`
}

async function downloadDropIcon(iconKey) {
  if (!iconKey) return null
  const file = safeIconFile(iconKey)
  const dest = path.join(dropIconsDir, file)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return `/drop-icons/${file}`
  try {
    const r = await fetch(`https://dbaion2.ru/icons/${iconKey}.webp`)
    if (!r.ok) return null
    fs.mkdirSync(dropIconsDir, { recursive: true })
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
    return `/drop-icons/${file}`
  }
  catch {
    return null
  }
}

function collectMobIds() {
  const ids = new Set()
  for (const file of fs.readdirSync(dropsDir).filter((f) => f.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(dropsDir, file), 'utf8'))
    for (const src of data.sources || []) {
      if (src.mobId) ids.add(String(src.mobId))
    }
  }
  return [...ids].sort()
}

function sortDrops(drops) {
  return [...drops].sort((a, b) => {
    const ca = a.chance
    const cb = b.chance
    if (ca == null && cb == null) return a.nameEn.localeCompare(b.nameEn)
    if (ca == null) return 1
    if (cb == null) return -1
    if (cb !== ca) return cb - ca
    return a.nameEn.localeCompare(b.nameEn)
  })
}

fs.mkdirSync(mobLootDir, { recursive: true })
const mobIds = collectMobIds()
console.log(`mobs to enrich: ${mobIds.length}, downloadIcons=${DOWNLOAD_ICONS}`)

const iconCache = new Map()
let done = 0
for (const mobId of mobIds) {
  done += 1
  const npc = await fetchJson(`https://dbaion2.ru/data-en/npc/${mobId}.json`)
  await sleep(35)
  const lines = []
  for (const d of npc?.drops || []) {
    const iconKey = d.icon || null
    let iconUrl = null
    if (iconKey) {
      if (DOWNLOAD_ICONS) {
        if (!iconCache.has(iconKey)) {
          iconCache.set(iconKey, await downloadDropIcon(iconKey))
          await sleep(20)
        }
        iconUrl = iconCache.get(iconKey)
      }
      if (!iconUrl) {
        iconUrl = `https://dbaion2.ru/icons/${iconKey}.webp`
      }
    }
    const chance = d.chance == null || d.chance === '' ? null : Number(d.chance)
    lines.push({
      itemId: String(d.id),
      nameEn: d.name || String(d.id),
      icon: iconKey,
      iconUrl,
      gradeName: d.gradeName || d.grade || null,
      category: d.category || null,
      chance: Number.isFinite(chance) ? Math.round(chance * 1000) / 1000 : null,
      min: d.min ?? null,
      max: d.max ?? null,
    })
  }
  const payload = {
    mobId,
    baseLevel: npc?.level == null ? null : Number(npc.level),
    scrapedAt: new Date().toISOString(),
    source: 'dbaion2.ru',
    drops: sortDrops(lines),
  }
  fs.writeFileSync(path.join(mobLootDir, `${mobId}.json`), `${JSON.stringify(payload, null, 2)}\n`)
  if (done % 10 === 0 || done === mobIds.length) {
    process.stdout.write(`  loot ${done}/${mobIds.length}\r`)
  }
}
console.log(`\ndone: ${mobIds.length} mob loot files, unique drop icons cached=${iconCache.size}`)
