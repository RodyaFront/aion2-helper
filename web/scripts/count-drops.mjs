for (const id of [610530011, 610531001, 610530001]) {
  const r = await fetch(`https://dbaion2.ru/en/items/${id}/`)
  const html = await r.text()
  const title = html.match(/Drops from monsters \((\d+)\)/i)?.[1]
  const sectionStart = html.search(/Drops from monsters/i)
  const sectionEnd = html.search(/Dungeon reward|Sold by|Contained in|Other acquisition|Used in crafting/i)
  const section = html.slice(sectionStart, sectionEnd > sectionStart ? sectionEnd : undefined)
  const chunks = section.split(/<a class="who"/i).slice(1)
  const withOdds = chunks.filter((c) => /class="odds"/i.test(c.slice(0, 1500)))
  const verteron = withOdds.filter((c) => /#verteron|Verteron/i.test(c.slice(0, 1500)))
  console.log(id, 'titleCount', title, 'chunks', chunks.length, 'withOdds', withOdds.length, 'verteron', verteron.length)
}
