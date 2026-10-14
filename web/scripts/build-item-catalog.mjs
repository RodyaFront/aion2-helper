/**
 * Hydrate shared/items/catalog.json from dbaion2 bulk dumps (EN + RU).
 * Keeps drop/map stats for items already enriched (seed drops).
 *
 * Usage: node scripts/build-item-catalog.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'public', 'data', 'items-catalog.json')
const stubPath = path.join(root, 'shared', 'items', 'catalog.json')
const prevPath = fs.existsSync(outPath) ? outPath : stubPath

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'AionBossTracker-catalog/1.0', accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

console.log('fetch EN + RU items…')
const [enList, ruList] = await Promise.all([
  fetchJson('https://dbaion2.ru/data-en/items.json'),
  fetchJson('https://dbaion2.ru/data/items.json'),
])

const ruById = new Map(ruList.map((i) => [i.id, i]))

let prev = { items: [] }
if (fs.existsSync(prevPath)) {
  try {
    prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'))
  }
  catch {
    prev = { items: [] }
  }
}
const prevByItemId = new Map(
  (prev.items || []).map((i) => [String(i.itemId), i]),
)

const items = []
for (const en of enList) {
  const id = String(en.id)
  const ru = ruById.get(en.id)
  const old = prevByItemId.get(id)
  const iconKey = en.icon || null
  items.push({
    id: old?.id && !/^\d+$/.test(old.id) ? old.id : id,
    itemId: id,
    nameEn: en.name || id,
    nameRu: ru?.name || en.name || id,
    category: en.category || 'MISC',
    categoryName: en.categoryName || en.category || 'Other',
    itemType: en.itemType || 'MISC',
    grade: en.grade || en.gradeName || 'Common',
    itemLevel: en.itemLevel ?? null,
    levelReq: en.levelReq ?? null,
    icon: iconKey ? `https://dbaion2.ru/icons/${iconKey}.webp` : (old?.icon ?? null),
    iconKey,
    sourceUrl: `https://dbaion2.ru/en/items/${id}/`,
    dropSourceCount: old?.dropSourceCount ?? 0,
    verteronSpawnCount: old?.verteronSpawnCount ?? 0,
    hasVerteronMap: Boolean(old?.hasVerteronMap),
  })
}

items.sort((a, b) => {
  const an = a.nameEn.localeCompare(b.nameEn, 'en')
  if (an) return an
  return a.itemId.localeCompare(b.itemId, 'en', { numeric: true })
})

const payload = {
  scrapedAt: new Date().toISOString(),
  source: 'dbaion2.ru',
  attribution: 'Item data from dbaion2.ru (fan client dump). AION 2 © NCSOFT.',
  count: items.length,
  items,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`)
// Tiny stub so shared/ never holds the 9k dump (keeps Vite bundles lean).
fs.writeFileSync(
  stubPath,
  `${JSON.stringify({
    scrapedAt: payload.scrapedAt,
    source: payload.source,
    attribution: payload.attribution,
    count: items.length,
    items: [],
    runtimePath: '/data/items-catalog.json',
  })}\n`,
)
const mb = (fs.statSync(outPath).size / (1024 * 1024)).toFixed(2)
console.log(`wrote ${outPath}`)
console.log(`items: ${items.length}, size: ${mb} MB, with map: ${items.filter((i) => i.hasVerteronMap).length}`)
