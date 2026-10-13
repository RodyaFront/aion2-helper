import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tmp = path.join(root, 'tmp-scrape')

const npc = await (await fetch('https://dbaion2.ru/data-en/npc/2101074.json')).json()
fs.writeFileSync(path.join(tmp, 'npc-2101074.json'), JSON.stringify(npc, null, 2))
console.log('keys', Object.keys(npc))
console.log(JSON.stringify(npc, null, 2).slice(0, 3000))

const ids = [610530011, 610530012, 610530013, 610530001, 610530010, 610530014]
for (const id of ids) {
  const r = await fetch(`https://dbaion2.ru/en/items/${id}/`)
  const t = await r.text()
  const name = t.match(/data-name="([^"]+)"/)?.[1]
  console.log(id, r.status, name)
}

const ru = await (await fetch('https://dbaion2.ru/npcs/2101074/')).text()
console.log('ru h1', ru.match(/<p class="h1"[^>]*>([^<]+)/)?.[1])

const map = await (await fetch('https://dbaion2.ru/data-en/maps/verteron.json')).json()
fs.writeFileSync(path.join(tmp, 'dbaion2-verteron-en.json'), JSON.stringify(map, null, 2))
console.log('map tf', map.tf, 'size', map.size)
