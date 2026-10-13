const urls = [
  'https://dbaion2.ru/en/items/610530001/',
  'https://dbaion2.ru/ru/items/610530001/',
]

for (const url of urls) {
  const r = await fetch(url, {
    headers: {
      'user-agent': 'AionBossTracker-scrape/1.0',
      accept: 'text/html',
    },
  })
  const t = await r.text()
  console.log('\n===', url, r.status, 'len', t.length)
  const scripts = [...t.matchAll(/src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((s) => /assets|chunk|_nuxt|\.js/.test(s))
    .slice(0, 40)
  console.log('scripts', scripts)
  console.log('has drops', t.includes('Drops from'), t.includes('дроп'))
  console.log('has npcs path', (t.match(/\/npcs\/\d+/g) || []).slice(0, 10))
  const jsonBlocks = [...t.matchAll(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)]
  console.log('json blocks', jsonBlocks.length)
  if (jsonBlocks[0]) console.log(jsonBlocks[0][1].slice(0, 400))
  const nuxt = t.match(/__NUXT_DATA__|payload|window\.__/g)
  console.log('markers', nuxt)
  // Look for embedded data attributes
  const dataIds = [...t.matchAll(/data-[a-z-]+="[^"]{0,80}"/g)].slice(0, 20)
  console.log('data attrs', dataIds.map((m) => m[0]))
}
