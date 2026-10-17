/**
 * Build shared/map/altgard.json from dbaion2 Altgard Heroic Monsters layer.
 * Coordinates: source x,y from dbaion2; mapX/mapY = half (same as gather/drop indexes).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outJson = path.join(root, 'shared', 'map', 'altgard.json')
const publicDir = path.join(root, 'public', 'maps', 'altgard')

/** EN label from dbaion2 → our BossDef.id */
const EN_TO_ID = {
  'Melted Danar': 'altgard_melted_danar',
  'Black Warrior Aed': 'altgard_black_warrior_aed',
  'Faithful Rajit': 'altgard_faithful_rajit',
  'Berserker Vargor': 'altgard_berserker_vargor',
  'Blood Warrior Lannar': 'altgard_blood_warrior_lannar',
  'Predator Garsan': 'altgard_predator_garsan',
  'Deceiver Trid': 'altgard_deceiver_trid',
  'Blue Wave Kelpina': 'altgard_blue_wave_kelpina',
  'High Overseer Nutah': 'altgard_high_overseer_nutah',
  'Advisor Resana': 'altgard_advisor_resana',
  'Special Operations Leader Linx': 'altgard_ops_leader_linx',
  'Addicted Hardirun': 'altgard_addicted_hardirun',
  'Veteran Shujakan': 'altgard_veteran_shujakan',
  'Desecrator Newbold': 'altgard_desecrator_newbold',
  'Specter Archon Axios': 'altgard_specter_axios',
  'Executioner Barthien': 'altgard_executioner_barthien',
  'Visionary Karuka': 'altgard_visionary_karuka',
  'Drakan Battalion Weapon Guruta': 'altgard_weapon_guruta',
  'Dark Shadow Vishwada': 'altgard_dark_shadow_vishwada',
  'Sharp Shylak': 'altgard_sharp_shylak',
  'Silent Dartan': 'altgard_silent_dartan',
  'Soul Ruler Kashapa': 'altgard_soul_kashapa',
  'High Commander Lagta': 'altgard_high_commander_lagta',
  'Immortal Gartua': 'altgard_immortal_gartua',
}

function stripLevel(label) {
  return String(label || '').replace(/,\s*(?:Lv\.|ур\.)\s*\d+\s*$/i, '').trim()
}

function listTiles(tileRoot) {
  const tiles = []
  if (!fs.existsSync(tileRoot)) return tiles
  for (const zEnt of fs.readdirSync(tileRoot, { withFileTypes: true })) {
    if (!zEnt.isDirectory()) continue
    const z = Number(zEnt.name)
    if (!Number.isFinite(z)) continue
    const zDir = path.join(tileRoot, zEnt.name)
    for (const xEnt of fs.readdirSync(zDir, { withFileTypes: true })) {
      if (!xEnt.isDirectory()) continue
      const x = Number(xEnt.name)
      const xDir = path.join(zDir, xEnt.name)
      for (const yEnt of fs.readdirSync(xDir, { withFileTypes: true })) {
        if (!yEnt.isFile() || !yEnt.name.endsWith('.webp')) continue
        const y = Number(yEnt.name.replace(/\.webp$/, ''))
        const rel = `tiles/${z}/${x}/${y}.webp`
        const bytes = fs.statSync(path.join(xDir, yEnt.name)).size
        tiles.push({ z, x, y, path: rel, bytes })
      }
    }
  }
  return tiles.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y)
}

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'AionBossTracker-altgard-coords/1.0', accept: 'application/json' },
  })
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`)
  return r.json()
}

const mapEn = await fetchJson('https://dbaion2.ru/data-en/maps/altgard.json')
const mapRu = await fetchJson('https://dbaion2.ru/data/maps/altgard.json')
const heroEn = (mapEn.layers || []).find((l) => l.id === 'mob-hero')
const heroRu = (mapRu.layers || []).find((l) => l.id === 'mob-hero')
if (!heroEn?.points?.length) throw new Error('Altgard mob-hero layer missing')

const bosses = []
const unmatched = []
for (let i = 0; i < heroEn.points.length; i++) {
  const [sx, sy, enLabel] = heroEn.points[i]
  const ruLabel = heroRu?.points?.[i]?.[2]
  const nameEn = stripLevel(enLabel)
  const nameRu = stripLevel(ruLabel) || nameEn
  const id = EN_TO_ID[nameEn]
  if (!id) {
    unmatched.push({ nameEn, x: sx, y: sy })
    continue
  }
  bosses.push({
    id,
    name: nameEn,
    nameSource: nameRu,
    x: sx,
    y: sy,
    mapX: Math.round(sx * 0.5),
    mapY: Math.round(sy * 0.5),
    description: '',
    markerId: `dbaion2-hero-${i}`,
    source: 'dbaion2-altgard-mob-hero',
    sourceUrl: 'https://dbaion2.ru/data-en/maps/altgard.json',
    coordSystem: 'sourceXY=dbaion2-world; mapXY=tile-pixel-8192 (x*0.5)',
  })
}

const expected = new Set(Object.values(EN_TO_ID))
const found = new Set(bosses.map((b) => b.id))
const missing = [...expected].filter((id) => !found.has(id))

const tileList = listTiles(path.join(publicDir, 'tiles'))
const payload = {
  region: 'altgard',
  faction: 'asmodian',
  scrapedAt: new Date().toISOString(),
  sources: [
    {
      id: 'dbaion2-altgard',
      url: 'https://dbaion2.ru/data-en/maps/altgard.json',
      note: 'Heroic Monsters layer = 24 field bosses',
    },
    {
      id: 'aion2kina-tiles',
      url: 'https://www.aion2kina.com/en/tools/map/altgard/',
      note: 'WebP tiles from map-runtime releases',
    },
  ],
  map: {
    width: 8192,
    height: 8192,
    tileUrlTemplate: '/maps/altgard/tiles/{z}/{x}/{y}.webp',
    overview: '/maps/altgard/overview.webp',
    minZoom: 0,
    maxZoom: 4,
    tileSize: 512,
    attribution: 'Map data from dbaion2.ru; tiles from aion2kina.com (fan resources). AION 2 © NCSOFT.',
    tiles: tileList,
  },
  bosses: bosses.sort((a, b) => a.id.localeCompare(b.id)),
  missing,
  unmatched,
}

fs.mkdirSync(path.dirname(outJson), { recursive: true })
fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`)
fs.mkdirSync(publicDir, { recursive: true })
fs.writeFileSync(
  path.join(publicDir, 'altgard-bosses.json'),
  `${JSON.stringify({ bosses: payload.bosses, missing, unmatched }, null, 2)}\n`,
)
fs.writeFileSync(
  path.join(publicDir, 'README.md'),
  `# Altgard map scrape

- Bosses with coords: **${bosses.length}/24**
- Missing: ${missing.length ? missing.join(', ') : '—'}
- Unmatched: ${unmatched.length}
- Tiles: **${tileList.length}** WebP (\`tiles/{z}/{x}/{y}.webp\`, z0–z3)
- Overview: \`overview.webp\`

\`\`\`bash
npm run map:scrape:altgard
\`\`\`
`,
)

console.log(`bosses ${bosses.length}/24 missing ${missing.length} unmatched ${unmatched.length} tiles ${tileList.length}`)
console.log('wrote', outJson)
if (missing.length || unmatched.length) process.exitCode = 1
