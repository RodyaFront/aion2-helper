/**
 * Merge Verteron "On map" NPC rows from item HTML (hero/elite not in numeric layers).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dropsDir = path.join(root, 'shared', 'items', 'drops')
const catalogPath = path.join(root, 'public', 'data', 'items-catalog.json')

const SEED = [
  { id: 'raw_leather', itemId: 610530011, nameRuFallback: 'Необработанная кожа' },
  { id: 'fresh_raw_meat', itemId: 610531001, nameRuFallback: 'Свежее сырое мясо' },
  { id: 'refining_stone', itemId: 610530001, nameRuFallback: 'Плавильный камень' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function toTilePoint(x, y) {
  return { x, y, mapX: Math.round(x * 0.5), mapY: Math.round(y * 0.5) }
}

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'AionBossTracker-scrape/1.0' } })
  return { ok: r.ok, text: await r.text() }
}

async function fetchJson(url) {
  const r = await fetchText(url)
  if (!r.ok) return null
  try { return JSON.parse(r.text) }
  catch { return null }
}

function parseVerteronRows(html) {
  const sectionStart = html.search(/Drops from monsters/i)
  const sectionEnd = html.search(/Dungeon reward|Sold by|Contained in|Other acquisition|Used in crafting/i)
  const section = html.slice(sectionStart, sectionEnd > sectionStart ? sectionEnd : undefined)
  const chunks = section.split(/<a class="who"/i).slice(1)
  const out = []
  for (const chunk of chunks) {
    const head = chunk.slice(0, 1500)
    if (!/#verteron/i.test(head) && !/>Verteron</i.test(head)) continue
    const mobId = (`<a class="who"${chunk}`).match(/\/npcs\/(\d+)/)?.[1]
    if (!mobId) continue
    const name = head.match(/<span[^>]*>\s*([^<]+)/)?.[1]?.replace(/\s+/g, ' ').trim()
    const rate = Number(head.match(/class="odds"[^>]*>(\d+(?:\.\d+)?)%/)?.[1])
    const level = Number(head.match(/Lv\.\s*(\d+)/i)?.[1] || 0) || null
    if (!Number.isFinite(rate)) continue
    out.push({ mobId, nameEn: name || `NPC ${mobId}`, rate, level })
  }
  return out
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))

for (const seed of SEED) {
  const dropPath = path.join(dropsDir, `${seed.id}.json`)
  const drop = JSON.parse(fs.readFileSync(dropPath, 'utf8'))
  const have = new Set(drop.sources.map((s) => s.mobId))
  const page = await fetchText(`https://dbaion2.ru/en/items/${seed.itemId}/`)
  const rows = parseVerteronRows(page.text)
  let added = 0
  for (const row of rows) {
    if (have.has(row.mobId)) continue
    const npc = await fetchJson(`https://dbaion2.ru/data-en/npc/${row.mobId}.json`)
    await sleep(40)
    const pts = (npc?.spawns?.verteron?.points || []).map(([x, y]) => toTilePoint(x, y))
    if (!pts.length) continue
    const ru = await fetchText(`https://dbaion2.ru/npcs/${row.mobId}/`)
    const nameRu = ru.ok ? (ru.text.match(/<p class="h1"[^>]*>([^<]+)/)?.[1] || null) : null
    drop.sources.push({
      mobId: row.mobId,
      nameEn: row.nameEn,
      nameRu,
      level: row.level,
      region: 'Verteron',
      regionId: 'verteron',
      rate: row.rate,
      hasMap: true,
      onmapUrl: `https://dbaion2.ru/en/map/#verteron&npc=${row.mobId}`,
      spawns: pts,
    })
    have.add(row.mobId)
    added++
  }
  drop.sources.sort((a, b) => b.rate - a.rate || a.nameEn.localeCompare(b.nameEn))
  fs.writeFileSync(dropPath, JSON.stringify(drop, null, 2))

  const catItem = catalog.items.find((i) => i.id === seed.id)
  if (catItem) {
    catItem.dropSourceCount = drop.sources.length
    catItem.verteronSpawnCount = drop.sources.reduce((n, s) => n + s.spawns.length, 0)
    catItem.hasVerteronMap = catItem.verteronSpawnCount > 0
    if (!catItem.nameRu || catItem.nameRu === catItem.nameEn) {
      catItem.nameRu = seed.nameRuFallback
    }
  }
  console.log(seed.id, 'added', added, 'total sources', drop.sources.length)
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2))
console.log('catalog updated')
