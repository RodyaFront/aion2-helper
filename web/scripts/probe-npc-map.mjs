import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = path.join(root, 'tmp-scrape')

async function get(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'AionBossTracker-scrape/1.0' } })
  return { status: r.status, text: await r.text(), url: r.url }
}

// Eternal Gartua is Verteron boss on refining stone page - find a Verteron NPC from drops
const item = await get('https://dbaion2.ru/en/items/610530001/')
const lis = [...item.text.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)]
  .map((m) => m[1])
  .filter((li) => /class="who"/i.test(li) && /odds/i.test(li))

const parsed = lis.map((li) => {
  const mobId = li.match(/\/en\/npcs\/(\d+)/)?.[1]
  const name = li.match(/<span[^>]*>\s*([^<]+)/)?.[1]?.trim()
  const region = li.match(/class="where"[^>]*>[\s\S]*?<a[^>]*>([^<]+)/)?.[1]
    || li.match(/class="where"[^>]*>([^<]+)/)?.[1]?.trim()
  const rate = Number(li.match(/class="odds"[^>]*>(\d+(?:\.\d+)?)%/)?.[1])
  const onmap = li.match(/class="onmap"[^>]*href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&')
  return { mobId, name, region, rate, onmap }
}).filter((d) => d.mobId)

const verteron = parsed.filter((d) => /verteron/i.test(d.region || '') || /verteron/i.test(d.onmap || ''))
console.log('parsed drops', parsed.length, 'verteron', verteron.length)
console.log(verteron.slice(0, 8))

const sample = verteron[0]
if (!sample) process.exit(0)

const npc = await get(`https://dbaion2.ru/en/npcs/${sample.mobId}/`)
fs.writeFileSync(path.join(tmp, `npc-${sample.mobId}.html`), npc.text)
console.log('npc status', npc.status, 'len', npc.text.length)

// Look for spawn / map data
const keys = ['spawn', 'coords', 'positions', 'markers', 'mapX', 'sourceX', 'World_L']
for (const k of keys) {
  const i = npc.text.toLowerCase().indexOf(k.toLowerCase())
  if (i >= 0) console.log('found', k, 'at', i, npc.text.slice(i, i + 200).replace(/\s+/g, ' '))
}

const mapUrl = `https://dbaion2.ru/en/map/#verteron&npc=${sample.mobId}`
const map = await get(`https://dbaion2.ru/en/map/`)
fs.writeFileSync(path.join(tmp, 'map.html'), map.text)
console.log('map page', map.status, map.text.length)

// Find JS bundles that might load spawn JSON
const scripts = [...map.text.matchAll(/src="(\/[^"]+\.js)"/g)].map((m) => m[1])
console.log('map scripts', scripts.slice(0, 20))

// Common data endpoints
for (const u of [
  `https://dbaion2.ru/data/npcs/${sample.mobId}.json`,
  `https://dbaion2.ru/en/npcs/${sample.mobId}.json`,
  `https://dbaion2.ru/api/npc/${sample.mobId}`,
  `https://dbaion2.ru/data/spawns/${sample.mobId}.json`,
  `https://dbaion2.ru/map/data/verteron.json`,
  `https://dbaion2.ru/data/maps/verteron.json`,
]) {
  const res = await get(u)
  console.log(res.status, u, res.text.slice(0, 120).replace(/\s+/g, ' '))
}
