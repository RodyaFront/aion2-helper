import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Brute nearby IDs + pagefind-ish search via HTML sitemap if any
const candidates = []
for (let id = 610530000; id <= 610530040; id++) candidates.push(id)

for (const id of candidates) {
  const r = await fetch(`https://dbaion2.ru/en/items/${id}/`, {
    headers: { 'user-agent': 'AionBossTracker-scrape/1.0' },
  })
  if (!r.ok) continue
  const t = await r.text()
  const name = t.match(/data-name="([^"]+)"/)?.[1]
  if (!name) continue
  if (/leather|meat|refining|stone/i.test(name)) {
    console.log(id, name)
  }
}

// Also try data-en item JSON
for (const id of [610530011, 610530001]) {
  const urls = [
    `https://dbaion2.ru/data-en/item/${id}.json`,
    `https://dbaion2.ru/data-en/items/${id}.json`,
  ]
  for (const u of urls) {
    const r = await fetch(u)
    console.log(r.status, u, (await r.text()).slice(0, 200).replace(/\s+/g, ' '))
  }
}
