const id = 610530011
const html = await (await fetch(`https://dbaion2.ru/en/items/${id}/`)).text()
const allWho = [...html.matchAll(/class="who"[^>]*href="[^"]*\/npcs\/(\d+)/gi)]
const allWho2 = [...html.matchAll(/href="[^"]*\/npcs\/(\d+)\/?"[^>]*class="who"/gi)]
const allNpc = [...html.matchAll(/\/npcs\/(\d+)\//g)]
console.log('who1', allWho.length, 'who2', allWho2.length, 'allNpc', allNpc.length)
console.log('title', html.match(/Drops from monsters \((\d+)\)/)?.[1])

// Find if there's a JSON blob with drops
const idx = html.indexOf('"drops"')
console.log('drops json idx', idx)
if (idx >= 0) console.log(html.slice(idx, idx + 400))

const idx2 = html.indexOf('drops:')
console.log('drops: idx', idx2)

// Astro frontmatter / props
for (const pat of ['__NEXT_DATA__', 'astro-island', 'define:vars', 'data-drops', 'application/ld+json']) {
  console.log(pat, html.includes(pat))
}

// Islands
const islands = [...html.matchAll(/<astro-island[^>]*props="([^"]*)"/g)]
console.log('islands', islands.length)
if (islands[0]) console.log(decodeURIComponent(islands[0][1]).slice(0, 500))
