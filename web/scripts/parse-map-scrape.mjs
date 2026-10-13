import fs from 'node:fs'

function extractKinaCoords(html) {
  const out = []
  const re = /"children":"([^"]+)"\}\],\["\$","span",null,\{"children":\["Respawns every[^"]*"," · ","Quellkoordinaten",": ",(\d+),", ",(\d+)\]/g
  let m
  while ((m = re.exec(html))) {
    out.push({ name: m[1], x: Number(m[2]), y: Number(m[3]), source: 'aion2kina' })
  }
  // fallback looser
  if (!out.length) {
    const re2 = /children":"([^"]+)"[\s\S]{0,200}?Quellkoordinaten",": ",(\d+),", ",(\d+)/g
    while ((m = re2.exec(html))) {
      out.push({ name: m[1], x: Number(m[2]), y: Number(m[3]), source: 'aion2kina' })
    }
  }
  return out
}

function findNumericNear(html, name, window = 800) {
  const hits = []
  let idx = 0
  const lower = html.toLowerCase()
  const needle = name.toLowerCase()
  while (true) {
    idx = lower.indexOf(needle, idx)
    if (idx < 0) break
    const snip = html.slice(idx, idx + window)
    const nums = [...snip.matchAll(/(-?\d{3,6})/g)].map((x) => Number(x[1]))
    hits.push({ idx, nums: nums.slice(0, 20), snip: snip.slice(0, 300).replace(/\s+/g, ' ') })
    idx += needle.length
  }
  return hits
}

const kina = fs.readFileSync('tmp-scrape/kina.html', 'utf8')
const coords = extractKinaCoords(kina)
console.log('KINA coords', coords.length)
console.log(JSON.stringify(coords, null, 2))

const wikily = fs.readFileSync('tmp-scrape/wikily.html', 'utf8')
for (const name of ['Kernon of the West', 'Forest Warrior Aullamu', 'kernon-of-the-west', 'forest-warrior-aullamu', 'Bloodfang Pnyn']) {
  const hits = findNumericNear(wikily, name, 1200)
  console.log('\nWIKILY', name, 'hits', hits.length)
  for (const h of hits.slice(0, 2)) console.log(h)
}

// discover tile URL pattern from kina
const tileUrls = [...kina.matchAll(/\/map-runtime\/releases\/[^"']+?\/maps\/tiles\/verteron\/\d+\/\d+\/\d+\.webp/g)].map((m) => m[0])
console.log('\nKINA tile samples', [...new Set(tileUrls)].slice(0, 20))

const metabot = fs.readFileSync('tmp-scrape/metabot.html', 'utf8')
for (const name of ['kernon-of-the-west', 'forest-warrior-aullamu', 'bloodfang-pnyn']) {
  const hits = findNumericNear(metabot, name, 1500)
  console.log('\nMETABOT', name, 'hits', hits.length)
  for (const h of hits.slice(0, 1)) console.log(h)
}
