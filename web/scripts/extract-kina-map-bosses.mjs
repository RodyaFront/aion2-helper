import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(fs.readFileSync(path.join(root, 'tmp-scrape', 'aion2-map-data.json'), 'utf8'))
const i18n = JSON.parse(fs.readFileSync(path.join(root, 'tmp-scrape', 'aion2-map-i18n.json'), 'utf8'))

const markers = data.markersByMap.World_L_A
console.log('markers', markers.length)

const subtypes = new Map()
for (const m of markers) {
  const key = `${m.category}/${m.subtype}`
  subtypes.set(key, (subtypes.get(key) || 0) + 1)
}
console.log('subtypes', [...subtypes.entries()].sort((a, b) => b[1] - a[1]))

const named = markers.filter((m) => m.name && String(m.name).trim())
console.log('named markers', named.length)
console.log('named samples', named.slice(0, 20).map((m) => ({ name: m.name, subtype: m.subtype, x: m.x, y: m.y, sourceX: m.sourceX, sourceY: m.sourceY })))

// Search i18n for Kernon / boss names
const i18nRaw = JSON.stringify(i18n)
console.log('i18n top', Object.keys(i18n))
for (const s of ['Kernon', 'Bloodfang', 'Kutar', 'worldBoss', 'eliteMonster', 'boss']) {
  console.log('i18n', s, (i18nRaw.match(new RegExp(s, 'gi')) || []).length)
}

// Find markers near known Bloodfang coords 3509,3531
function near(x, y, tol = 30) {
  return markers.filter((m) => Math.abs(m.x - x) <= tol && Math.abs(m.y - y) <= tol)
}
console.log('near Bloodfang 3509,3531', near(3509, 3531).map((m) => ({ name: m.name, subtype: m.subtype, x: m.x, y: m.y, sourceX: m.sourceX, sourceY: m.sourceY, id: m.id })))
console.log('near Rotten 3845,4914', near(3845, 4914).map((m) => ({ name: m.name, subtype: m.subtype, x: m.x, y: m.y, sourceX: m.sourceX, sourceY: m.sourceY })))

// Maybe world bosses use sourceX/sourceY swapped / different space
console.log('near source Bloodfang', markers.filter((m) => Math.abs(m.sourceX - 3509) <= 30 && Math.abs(m.sourceY - 3531) <= 30).slice(0, 5))

// Check if i18n maps marker id -> name
function findI18nPaths(obj, pred, path = [], acc = []) {
  if (!obj || typeof obj !== 'object') return acc
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => findI18nPaths(v, pred, [...path, String(i)], acc))
    return acc
  }
  if (pred(obj)) acc.push({ path: path.join('.'), obj })
  for (const [k, v] of Object.entries(obj)) findI18nPaths(v, pred, [...path, k], acc)
  return acc
}

const bossish = findI18nPaths(i18n, (o) => typeof o === 'object' && o && (String(o.en || o.name || '').includes('Kernon') || String(o.en || '').includes('Bloodfang')))
console.log('i18n bossish', bossish.slice(0, 10))
