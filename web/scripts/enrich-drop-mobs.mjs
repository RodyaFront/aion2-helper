/**
 * Enrich drop JSON sources with icon / title / grade from dbaion2 npc JSON.
 * Optionally download mob portraits into public/mobs/{mobId}.webp
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dropsDir = path.join(root, 'shared', 'items', 'drops')
const mobsDir = path.join(root, 'public', 'mobs')
const DOWNLOAD_ICONS = process.argv.includes('--download-icons')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url) {
  const r = await fetch(url, {
    headers: { 'user-agent': 'AionBossTracker-enrich/1.0', accept: 'application/json' },
  })
  if (!r.ok) return null
  try {
    return await r.json()
  }
  catch {
    return null
  }
}

async function downloadIcon(iconKey, mobId) {
  if (!iconKey) return null
  const url = `https://dbaion2.ru/icons/${iconKey}.webp`
  const dest = path.join(mobsDir, `${mobId}.webp`)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return `/mobs/${mobId}.webp`
  try {
    const r = await fetch(url)
    if (!r.ok) return null
    fs.mkdirSync(mobsDir, { recursive: true })
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
    return `/mobs/${mobId}.webp`
  }
  catch {
    return null
  }
}

const cache = new Map()

async function enrichMob(mobId) {
  if (cache.has(mobId)) return cache.get(mobId)
  const npc = await fetchJson(`https://dbaion2.ru/data-en/npc/${mobId}.json`)
  if (!npc) {
    const empty = { icon: null, iconUrl: null, title: null, gradeName: null, creatureName: null, race: null }
    cache.set(mobId, empty)
    return empty
  }
  const iconKey = npc.icon || null
  let iconLocal = null
  if (DOWNLOAD_ICONS && iconKey) {
    iconLocal = await downloadIcon(iconKey, mobId)
    await sleep(40)
  }
  const meta = {
    icon: iconKey,
    iconUrl: iconKey ? `https://dbaion2.ru/icons/${iconKey}.webp` : null,
    iconLocal,
    title: npc.title || null,
    gradeName: npc.gradeName || npc.grade || null,
    creatureName: npc.creatureName || npc.creature || null,
    race: npc.race || null,
  }
  cache.set(mobId, meta)
  return meta
}

const files = fs.readdirSync(dropsDir).filter((f) => f.endsWith('.json'))
let updated = 0
for (const file of files) {
  const full = path.join(dropsDir, file)
  const data = JSON.parse(fs.readFileSync(full, 'utf8'))
  let i = 0
  for (const src of data.sources || []) {
    i += 1
    const meta = await enrichMob(String(src.mobId))
    src.icon = meta.icon
    src.iconUrl = meta.iconLocal || meta.iconUrl
    src.title = meta.title
    src.gradeName = meta.gradeName
    src.creatureName = meta.creatureName
    src.race = meta.race
    if (i % 10 === 0) process.stdout.write(`  ${file} ${i}/${data.sources.length}\r`)
    await sleep(30)
  }
  fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`)
  updated += 1
  console.log(`\nupdated ${file} (${data.sources.length} sources)`)
}
console.log(`done ${updated} files, unique mobs cached ${cache.size}, download=${DOWNLOAD_ICONS}`)
