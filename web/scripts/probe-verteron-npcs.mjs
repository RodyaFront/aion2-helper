import fs from 'node:fs'

const map = await (await fetch('https://dbaion2.ru/data-en/maps/verteron.json')).json()
console.log('layers', map.layers?.length, map.layers?.slice(0, 5).map((l) => ({ id: l.id, group: l.group, name: l.name, pts: l.points?.length })))
const groups = [...new Set(map.layers?.map((l) => l.group))]
console.log('groups', groups)
const mobLayers = map.layers?.filter((l) => /mob|npc|monster|hero|elite/i.test(`${l.id} ${l.group} ${l.name}`))
console.log('mobLayers', mobLayers?.length, mobLayers?.slice(0, 10).map((l) => l.name))

// NPC location listing pages
for (const u of [
  'https://dbaion2.ru/en/npcs/loc/verteron/',
  'https://dbaion2.ru/en/npcs/?loc=verteron',
  'https://dbaion2.ru/en/npcs/cat/monsters/?loc=verteron',
  'https://dbaion2.ru/data-en/maps/verteron/npcs.json',
  'https://dbaion2.ru/data-en/npc/index.json',
  'https://dbaion2.ru/data-en/npcs/verteron.json',
]) {
  const r = await fetch(u)
  const t = await r.text()
  const ids = [...t.matchAll(/\/npcs\/(\d+)/g)].map((m) => m[1])
  console.log(r.status, u, 'ids', new Set(ids).size, t.slice(0, 120).replace(/\s+/g, ' '))
}

// From HTML item page: maybe "Show all" link with query
const item = await (await fetch('https://dbaion2.ru/en/items/610530011/')).text()
const show = [...item.matchAll(/href="([^"]+)"[^>]*>[\s\S]{0,40}(all|more|full)/gi)].slice(0, 10)
console.log('show links', show.map((m) => m[1]))
fs.writeFileSync('tmp-scrape/layer-names.json', JSON.stringify(map.layers?.map((l) => ({ id: l.id, group: l.group, name: l.name, n: l.points?.length })), null, 2))
