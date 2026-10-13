// Search item HTML list page via pagefind or craft materials sitemap
const urls = [
  'https://dbaion2.ru/pagefind/en_c0cb23e821/index/index.json',
  'https://dbaion2.ru/en/search/?q=Fresh+Raw+Meat',
  'https://dbaion2.ru/search/?q=Fresh+Raw+Meat',
]

for (const u of urls) {
  const r = await fetch(u, { headers: { 'user-agent': 'AionBossTracker-scrape/1.0' } })
  const t = await r.text()
  console.log(r.status, u, t.slice(0, 300).replace(/\s+/g, ' '))
  const ids = [...t.matchAll(/\/items\/(\d+)/g)].map((m) => m[1])
  console.log('ids', [...new Set(ids)].slice(0, 20))
}

// Broader ID scan for Meat
for (let id = 610520000; id <= 610520050; id++) {
  const r = await fetch(`https://dbaion2.ru/en/items/${id}/`)
  if (!r.ok) continue
  const t = await r.text()
  const name = t.match(/data-name="([^"]+)"/)?.[1]
  if (name && /meat|leather|flesh/i.test(name)) console.log(id, name)
}
for (let id = 610540000; id <= 610540030; id++) {
  const r = await fetch(`https://dbaion2.ru/en/items/${id}/`)
  if (!r.ok) continue
  const t = await r.text()
  const name = t.match(/data-name="([^"]+)"/)?.[1]
  if (name && /meat|leather/i.test(name)) console.log(id, name)
}
