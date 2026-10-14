/**
 * Build Verteron shared drop table for effective level 45.
 * Takes non-own drops that appear on multiple normal Lv45 mobs (intersection),
 * falling back to union weighted by a canonical mob if intersection is thin.
 *
 * Usage: node scripts/build-shared-level-45.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outPath = path.join(root, 'shared', 'items', 'shared-levels', '45.json')

/** Seed Lv45 Verteron normals from our drop sources (not named bosses). */
const SEED_MOB_IDS = [
  '2100655', // Confused Ursus
  '2100178', // Bloodfang Pnyn
  '2100177', // Furious Saursus
  '2100141', // Blooming Korin
  '2100617', // Black Tentacle Lawa
  '2100665', // Torrent Spirit (canonical Natura)
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isOwnDrop(d) {
  const cat = String(d.category || '')
  const name = String(d.name || d.nameEn || '')
  if (/^pet$/i.test(cat) || /^soul\s*:/i.test(name)) return true
  if (/refining\s*stone/i.test(name)) return false
  // Gear / weapons live in shared packages.
  if (
    /Gloves|Shoes|Boots|Helm|Cloak|Pauldrons|Greaves|Breastplate|Top|Legs|Mantle|Greatsword|Longsword|Dagger|Bow|Spellbook|Orb|Mace|Staff|Guard|Knife|Sword|Shield/i.test(
      cat,
    )
  ) {
    return false
  }
  const chance = d.chance == null || d.chance === '' ? null : Number(d.chance)
  if (/crafting\s*material/i.test(cat) && chance != null && chance >= 1) return true
  return false
}

const dropIconsDir = path.join(root, 'public', 'drop-icons')

function iconUrlFor(iconKey) {
  if (!iconKey) return null
  const file = `${String(iconKey).replace(/[^\w.-]+/g, '_')}.webp`
  if (fs.existsSync(path.join(dropIconsDir, file))) return `/drop-icons/${file}`
  return `https://dbaion2.ru/icons/${iconKey}.webp`
}

function normalizeLine(d) {
  const chance = d.chance == null || d.chance === '' ? null : Number(d.chance)
  const icon = d.icon || null
  return {
    itemId: String(d.id ?? d.itemId),
    nameEn: d.name || d.nameEn || String(d.id ?? d.itemId),
    icon,
    iconUrl: iconUrlFor(icon),
    gradeName: d.gradeName || d.grade || null,
    category: d.category || null,
    chance: Number.isFinite(chance) ? Math.round(chance * 1000) / 1000 : null,
    min: d.min ?? null,
    max: d.max ?? null,
  }
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

async function fetchNpc(mobId) {
  const r = await fetch(`https://dbaion2.ru/data-en/npc/${mobId}.json`, {
    headers: { 'user-agent': 'AionBossTracker-shared45/1.0', accept: 'application/json' },
  })
  if (!r.ok) return null
  return r.json()
}

const perMobShared = []
for (const mobId of SEED_MOB_IDS) {
  const npc = await fetchNpc(mobId)
  await sleep(40)
  if (!npc || Number(npc.level) !== 45) {
    console.warn(`skip ${mobId}: level=${npc?.level ?? 'missing'}`)
    continue
  }
  const shared = (npc.drops || []).filter((d) => !isOwnDrop(d)).map(normalizeLine)
  perMobShared.push({
    mobId,
    name: npc.name,
    count: shared.length,
    byId: new Map(shared.map((d) => [d.itemId, d])),
  })
  console.log(`  ${mobId} ${npc.name}: shared ${shared.length} (total drops ${(npc.drops || []).length})`)
}

if (perMobShared.length < 2) {
  console.error('Need at least 2 Lv45 seed mobs')
  process.exit(1)
}

/** Item must appear on every seed mob (true shared table). */
const [first, ...rest] = perMobShared
const intersectionIds = [...first.byId.keys()].filter((id) =>
  rest.every((m) => m.byId.has(id)),
)

let drops = intersectionIds.map((id) => first.byId.get(id))

// Prefer chances from Torrent Spirit when present (cleaner decimals).
const torrent = perMobShared.find((m) => m.mobId === '2100665')
if (torrent) {
  drops = drops.map((d) => torrent.byId.get(d.itemId) || d)
}

drops = sortDrops(drops)

const payload = {
  level: 45,
  regionId: 'verteron',
  region: 'Verteron',
  scrapedAt: new Date().toISOString(),
  source: 'dbaion2.ru',
  method: 'intersection-of-non-own-drops-across-lv45-normals',
  seedMobIds: perMobShared.map((m) => m.mobId),
  note: 'Shared reward_basic band for effective monster level 45 in Verteron. Compose with mob-own drops (Soul / species mats) when baseLevel < 45.',
  drops,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`\nwrote ${outPath}`)
console.log(`shared lines: ${drops.length} (intersection of ${perMobShared.length} mobs)`)
const grades = {}
for (const d of drops) grades[d.gradeName || '?'] = (grades[d.gradeName || '?'] || 0) + 1
console.log('grades', grades)
