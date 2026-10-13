const map = await (await fetch('https://dbaion2.ru/data-en/maps/verteron.json')).json()
const mobs = map.layers.filter((l) => l.group === 'Monsters')
for (const l of mobs) {
  console.log(l.id, l.name, 'points', l.points?.length, 'sample', JSON.stringify(l.points?.[0]), 'keys', Object.keys(l))
  // points might be [x,y] or [x,y,npcId]
  const sample3 = l.points?.slice(0, 3)
  console.log('  samples', sample3)
  if (l.npcIds) console.log('  npcIds', l.npcIds.slice?.(0, 5))
  if (l.items) console.log('  items', l.items)
  // dump extra fields
  const { points, ...rest } = l
  console.log('  rest', JSON.stringify(rest).slice(0, 300))
}
