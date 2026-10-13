import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'maps', 'verteron')
const dataDir = path.join(root, 'shared', 'map')
const mapDataPath = path.join(root, 'tmp-scrape', 'aion2-map-data.json')

/** Exact Chinese marker names from aion2-map-data.json → our BossDef.id */
const CN_NAME_TO_ID = {
  // KINA CN labels "West Neikel" for Kernon of the West (matched by coords/role).
  '西侧涅凯尔': 'kernon_west',
  '东侧涅凯尔': 'neikel_east',
  '腐朽的库塔尔': 'rotten_kutar',
  '盛开的柯林': 'blooming_korin',
  '护卫兵提甘特': 'bodyguard_teegant',
  '狂斗士库森': 'kusan_mad',
  '祭司长加尔新': 'ritualist_garshim',
  '学者拉兀拉': 'scholar_aulla',
  '追击者塔兀罗': 'chaser_taulo',
  '血獠牙普宁': 'bloodfang_pnyn',
  '愤怒的萨吕': 'furious_saursus',
  '叛教者雷拉': 'heretic_layla',
  '收获管理者莫夏夫': 'harvest_moshav',
  '黑色触手拉瓦': 'black_tentacle_lawa',
  '森林战士乌刺姆': 'forest_aullamu',
  '百夫长戴米罗斯': 'centurion_demiros',
  '监视兵器克纳许': 'sentinel_knash',
  '神圣的安萨斯': 'divine_ansas',
  '幻梦卡西亚': 'phantasm_kasia',
  '灵魂支配者卡沙帕': 'soul_kashapa',
  '研究官塞特兰': 'researcher_setram',
  '沉默塔尔坦': 'silent_dartan',
  '军团长拉格塔': 'high_commander_lagta',
  '永恒卡尔吐亚': 'eternal_gartua',
}

/** Fallback: match by English page Quellkoordinaten if CN names differ */
const EN_NAME_BY_ID = {
  kernon_west: 'Kernon of the West',
  neikel_east: 'Neikel of the East',
  rotten_kutar: 'Rotten Kutar',
  blooming_korin: 'Blooming Korin',
  bodyguard_teegant: 'Bodyguard Teegant',
  kusan_mad: 'Kusan the Mad Gladiator',
  ritualist_garshim: 'Ritualist Garshim',
  scholar_aulla: 'Scholar Aulla',
  chaser_taulo: 'Chaser Taulo',
  bloodfang_pnyn: 'Bloodfang Pnyn',
  furious_saursus: 'Furious Saursus',
  heretic_layla: 'Heretic Layla',
  harvest_moshav: 'Harvest Manager Moshav',
  black_tentacle_lawa: 'Black Tentacle Lawa',
  forest_aullamu: 'Forest Warrior Aullamu',
  centurion_demiros: 'Centurion Demiros',
  sentinel_knash: "Sentinel K'nash",
  divine_ansas: 'Divine Ansas',
  phantasm_kasia: 'Phantasm Kasia',
  soul_kashapa: 'Soul Ruler Kashapa',
  researcher_setram: 'Researcher Setram',
  silent_dartan: 'Silent Dartan',
  high_commander_lagta: 'High Commander Lagta',
  eternal_gartua: 'Eternal Gartua',
}

function listTiles(tileRoot) {
  const tiles = []
  if (!fs.existsSync(tileRoot)) return tiles
  for (const zName of fs.readdirSync(tileRoot)) {
    const zDir = path.join(tileRoot, zName)
    if (!fs.statSync(zDir).isDirectory()) continue
    const z = Number(zName)
    for (const xName of fs.readdirSync(zDir)) {
      const xDir = path.join(zDir, xName)
      if (!fs.statSync(xDir).isDirectory()) continue
      const x = Number(xName)
      for (const file of fs.readdirSync(xDir)) {
        if (!file.endsWith('.webp')) continue
        const y = Number(file.replace('.webp', ''))
        tiles.push({
          z,
          x,
          y,
          path: `tiles/${z}/${x}/${y}.webp`,
          bytes: fs.statSync(path.join(xDir, file)).size,
        })
      }
    }
  }
  return tiles.sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y)
}

function fuzzyCnToId(name) {
  if (CN_NAME_TO_ID[name]) return CN_NAME_TO_ID[name]
  // loose contains match
  for (const [cn, id] of Object.entries(CN_NAME_TO_ID)) {
    if (name.includes(cn) || cn.includes(name)) return id
  }
  return null
}

if (!fs.existsSync(mapDataPath)) {
  console.error('Missing', mapDataPath, '- download https://www.aion2kina.com/data/aion2-map-data.json first')
  process.exit(1)
}

const mapData = JSON.parse(fs.readFileSync(mapDataPath, 'utf8'))
const verteron = mapData.maps.find((m) => m.slug === 'verteron')
const markers = mapData.markersByMap.World_L_A.filter((m) => m.subtype === 'boss')
console.log(`Found ${markers.length} collection/boss markers on Verteron`)

const bosses = []
const unmatched = []
for (const m of markers) {
  const id = fuzzyCnToId(m.name || '')
  if (!id) {
    unmatched.push({ name: m.name, x: m.x, y: m.y, sourceX: m.sourceX, sourceY: m.sourceY, id: m.id })
    continue
  }
  bosses.push({
    id,
    name: EN_NAME_BY_ID[id],
    nameSource: m.name,
    // Quellkoordinaten / in-game-ish source space (matches KINA world-boss page)
    x: m.sourceX,
    y: m.sourceY,
    // Pixel position on 8192 map image (Y already flipped for display)
    mapX: m.x,
    mapY: m.y,
    description: m.description || '',
    markerId: m.id,
    source: 'aion2kina-map-data',
    sourceUrl: 'https://www.aion2kina.com/data/aion2-map-data.json',
    coordSystem: 'sourceXY=quellkoordinaten; mapXY=tile-pixel-8192',
  })
}

const have = new Set(bosses.map((b) => b.id))
const missing = Object.keys(EN_NAME_BY_ID)
  .filter((id) => !have.has(id))
  .map((id) => ({ id, name: EN_NAME_BY_ID[id], reason: 'Not matched from collection/boss markers' }))

const tiles = listTiles(path.join(outDir, 'tiles'))
const overviewSrc = path.join(outDir, 'tiles', '0', '0', '0.webp')
if (fs.existsSync(overviewSrc)) {
  fs.copyFileSync(overviewSrc, path.join(outDir, 'overview.webp'))
}

const xs = bosses.map((b) => b.x)
const ys = bosses.map((b) => b.y)

const payload = {
  region: 'verteron',
  faction: 'elyos',
  scrapedAt: new Date().toISOString(),
  sources: [
    {
      id: 'aion2kina-map-data',
      url: 'https://www.aion2kina.com/data/aion2-map-data.json',
      note: 'Full marker dump; subtype collection/boss = field/world bosses',
    },
    {
      id: 'aion2kina-tiles',
      url: 'https://www.aion2kina.com/de/tools/map/verteron/',
      note: 'WebP tiles from map-runtime releases',
    },
  ],
  map: {
    width: verteron?.width ?? 8192,
    height: verteron?.height ?? 8192,
    tileUrlTemplate: '/maps/verteron/tiles/{z}/{x}/{y}.webp',
    overview: '/maps/verteron/overview.webp',
    minZoom: verteron?.tileMinZoom ?? 0,
    maxZoom: Math.max(verteron?.tileMaxZoom ?? 0, tiles.reduce((m, t) => Math.max(m, t.z), 0)),
    tileSize: verteron?.tileSize ?? 256,
    attribution: 'Map data/tiles from aion2kina.com (fan resource). AION 2 © NCSOFT.',
    tiles,
  },
  boundsFromBosses: bosses.length
    ? { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
    : null,
  bosses: bosses.sort((a, b) => a.name.localeCompare(b.name)),
  missing,
  unmatched,
}

fs.mkdirSync(dataDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(dataDir, 'verteron.json'), JSON.stringify(payload, null, 2))
fs.writeFileSync(path.join(outDir, 'verteron-bosses.json'), JSON.stringify(payload, null, 2))
fs.writeFileSync(
  path.join(outDir, 'README.md'),
  [
    '# Verteron map scrape',
    '',
    `- Bosses with coords: **${bosses.length}/24**`,
    `- Missing: ${missing.map((m) => m.name).join(', ') || '—'}`,
    `- Unmatched CN markers: ${unmatched.length}`,
    `- Tiles: **${tiles.length}** WebP (\`tiles/{z}/{x}/{y}.webp\`, z0–z3)`,
    `- Overview: \`overview.webp\``,
    '',
    'Coords:',
    '- `x,y` = Quellkoordinaten / sourceXY',
    '- `mapX,mapY` = pixel on 8192×8192 map image',
    '',
    '```bash',
    'npm run map:scrape',
    '```',
    '',
  ].join('\n'),
)

console.log(`matched=${bosses.length} missing=${missing.length} unmatched=${unmatched.length} tiles=${tiles.length}`)
if (unmatched.length) console.log('unmatched', unmatched)
if (missing.length) console.log('missing', missing)
