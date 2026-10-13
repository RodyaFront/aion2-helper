import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = path.join(root, 'tmp-scrape')
fs.mkdirSync(tmp, { recursive: true })

const url = 'https://dbaion2.ru/en/items/610530001/'
const r = await fetch(url, { headers: { 'user-agent': 'AionBossTracker-scrape/1.0' } })
const html = await r.text()
fs.writeFileSync(path.join(tmp, 'refining.html'), html)

const idx = html.indexOf('Drops from')
console.log('Drops from idx', idx)
console.log(html.slice(idx, idx + 2500))

const npcIdx = html.indexOf('/en/npcs/')
console.log('\nfirst npc context', html.slice(Math.max(0, npcIdx - 200), npcIdx + 400))

// Find all unique patterns around percent
const pct = [...html.matchAll(/(\d+(?:\.\d+)?)%/g)].slice(0, 5)
console.log('pct samples', pct.map((m) => html.slice(Math.max(0, m.index - 80), m.index + 20)))
