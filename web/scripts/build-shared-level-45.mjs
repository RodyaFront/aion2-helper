/**
 * Build shared drop table for effective level 45 in a field region.
 *
 * Usage:
 *   node scripts/build-shared-level-45.mjs
 *   node scripts/build-shared-level-45.mjs --region=altgard
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const regionArg = process.argv.find((a) => a.startsWith('--region='))
const region = (regionArg?.split('=')[1] || 'verteron').toLowerCase()

const SEEDS = {
  verteron: {
    outFile: '45.json',
    regionLabel: 'Verteron',
    acceptLevels: [45],
    seedMobIds: [
      '2100655',
      '2100178',
      '2100177',
      '2100141',
      '2100617',
      '2100665',
    ],
    preferMobId: '2100665',
  },
  altgard: {
    outFile: '45-altgard.json',
    regionLabel: 'Altgard',
    // Altgard field normals peak at 44/46 rather than exact 45.
    acceptLevels: [44, 45, 46],
    seedMobIds: [
      '2400701',
      '2400706',
      '2400705',
      '2400653',
      '2400703',
      '2400735',
    ],
    preferMobId: '2400701',
  },
}

const cfg = SEEDS[region]
if (!cfg) {
  console.error('Unsupported region:', region)
  process.exit(1)
}

const outPath = path.join(root, 'shared', 'items', 'shared-levels', cfg.outFile)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function isOwnDrop(d) {
  const cat = String(d.category || '')
  const name = String(d.name || d.nameEn || '')
  if (/^pet$/i.test(cat) || /^soul\s*:/i.test(name)) return true
  if (/refining\s*stone/i.test(name)) return false
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
for (const mobId of cfg.seedMobIds) {
  const npc = await fetchNpc(mobId)
  await sleep(40)
  const level = Number(npc?.level)
  if (!npc || !cfg.acceptLevels.includes(level)) {
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
  console.error('Need at least 2 seed mobs')
  process.exit(1)
}

const [first, ...rest] = perMobShared
const intersectionIds = [...first.byId.keys()].filter((id) =>
  rest.every((m) => m.byId.has(id)),
)

let drops = intersectionIds.map((id) => first.byId.get(id))

const prefer = perMobShared.find((m) => m.mobId === cfg.preferMobId)
if (prefer) {
  drops = drops.map((d) => prefer.byId.get(d.itemId) || d)
}

drops = sortDrops(drops)

const payload = {
  level: 45,
  regionId: region,
  region: cfg.regionLabel,
  scrapedAt: new Date().toISOString(),
  source: 'dbaion2.ru',
  method: 'intersection-of-non-own-drops-across-near-45-normals',
  seedMobIds: perMobShared.map((m) => m.mobId),
  note: `Shared reward_basic band for effective monster level 45 in ${cfg.regionLabel}. Compose with mob-own drops when baseLevel < 45.`,
  drops,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
console.log(`\nwrote ${outPath}`)
console.log(`shared lines: ${drops.length} (intersection of ${perMobShared.length} mobs)`)
const grades = {}
for (const d of drops) grades[d.gradeName || '?'] = (grades[d.gradeName || '?'] || 0) + 1
console.log('grades', grades)
