import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = path.join(root, 'tmp-scrape')
fs.mkdirSync(tmp, { recursive: true })

async function fetchText(url) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'AionBossTracker-scrape/1.0',
      accept: 'text/html',
    },
  })
  const t = await r.text()
  return { status: r.status, text: t, finalUrl: r.url }
}

function parseItemDrops(html) {
  // Rows look like: <a href="/en/npcs/2600150/">Name</a> ... Verteron ... On map ... 46.7%
  const drops = []
  const re = /href="(\/en\/npcs\/(\d+)\/?)"[^>]*>([^<]+)<\/a>([\s\S]{0,400}?)(\d+(?:\.\d+)?)%/gi
  let m
  while ((m = re.exec(html))) {
    const mobId = m[2]
    const name = m[3].replace(/\s+/g, ' ').trim()
    const ctx = m[4].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
    const rate = Number(m[5])
    const regionMatch = ctx.match(
      /(Verteron|Altgard|Poeta|Eltnen|Ishalgen|Morheim|Chaotic [^ ]+ Reshanta|Reshanta)/i,
    )
    drops.push({
      mobId,
      nameEn: name,
      rate,
      region: regionMatch?.[1] || null,
      hasMap: /On map/i.test(ctx),
      context: ctx.slice(0, 160),
    })
  }
  return drops
}

function parseNpcSpawns(html) {
  // Look for coordinate-like numbers near map data
  const coords = []
  // Common patterns: data-x data-y, or JSON in script
  for (const m of html.matchAll(/data-(?:x|map-x|pos-x)="([^"]+)"[^>]*data-(?:y|map-y|pos-y)="([^"]+)"/gi)) {
    coords.push({ x: Number(m[1]), y: Number(m[2]), kind: 'data-xy' })
  }
  for (const m of html.matchAll(/"x"\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*"y"\s*:\s*(-?\d+(?:\.\d+)?)/g)) {
    coords.push({ x: Number(m[1]), y: Number(m[2]), kind: 'json-xy' })
  }
  for (const m of html.matchAll(/\[(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\]/g)) {
    const x = Number(m[1])
    const y = Number(m[2])
    if (Math.abs(x) > 10 && Math.abs(y) > 10) coords.push({ x, y, kind: 'pair' })
  }
  // Map marker buttons / canvas
  const mapHints = []
  if (/leaflet|mapbox|openlayers/i.test(html)) mapHints.push('map-lib')
  if (/World_L_A|verteron/i.test(html)) mapHints.push('verteron-token')
  const sample = html.includes('spawn') ? 'has-spawn-word' : 'no-spawn-word'
  return { coords: coords.slice(0, 40), count: coords.length, mapHints, sample }
}

// Find item ids via pagefind or direct guess + materials list
const candidates = [
  'https://dbaion2.ru/en/items/?name=Leather',
  'https://dbaion2.ru/pagefind/pagefind.js',
  'https://dbaion2.ru/pagefind/pagefind-entry.json',
]

for (const url of candidates) {
  const { status, text } = await fetchText(url)
  console.log(url, status, text.slice(0, 180).replace(/\s+/g, ' '))
  fs.writeFileSync(path.join(tmp, `probe-${status}-${url.replace(/[^\w]+/g, '_').slice(0, 60)}.txt`), text.slice(0, 50000))
}

const refining = await fetchText('https://dbaion2.ru/en/items/610530001/')
const drops = parseItemDrops(refining.text)
const verteron = drops.filter((d) => /verteron/i.test(d.region || ''))
console.log('refining drops', drops.length, 'verteron', verteron.length)
console.log('sample verteron', verteron.slice(0, 5))
fs.writeFileSync(path.join(tmp, 'refining-drops.json'), JSON.stringify({ drops, verteron }, null, 2))

if (verteron[0]) {
  const npc = await fetchText(`https://dbaion2.ru/en/npcs/${verteron[0].mobId}/`)
  fs.writeFileSync(path.join(tmp, `npc-${verteron[0].mobId}.html`), npc.text)
  const spawns = parseNpcSpawns(npc.text)
  console.log('npc', verteron[0].mobId, npc.status, spawns)
  // Extract title / region
  const h1 = npc.text.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]
  console.log('h1', h1)
  const region = npc.text.match(/Verteron|Altgard|Poeta/i)?.[0]
  console.log('region token', region)
}

// Search pagefind index
const pf = await fetchText('https://dbaion2.ru/pagefind/pagefind-entry.json')
if (pf.status === 200) {
  console.log('pagefind entry', pf.text.slice(0, 500))
}
