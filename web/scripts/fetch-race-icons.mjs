/**
 * Download Elyos / Asmodian official badges and write ≤128×128 WebP icons.
 * Source: aion2guide.wiki (cms.oncehumanwiki.com assets labeled “official badge”).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'races')
const workDir = path.join(root, 'tmp-scrape', 'race-icons')

const SOURCES = {
  elyos: 'https://cms.oncehumanwiki.com/assets/bbca3dd3-965e-460e-9aab-5cd227ba7205',
  asmodian: 'https://cms.oncehumanwiki.com/assets/37e5bfe3-07c2-4405-b710-6880ae293bc3',
}

fs.mkdirSync(workDir, { recursive: true })
fs.mkdirSync(outDir, { recursive: true })

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'user-agent': 'AionBossTracker-race-icons/1.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(dest, buf)
  return { bytes: buf.length, type: res.headers.get('content-type') || '' }
}

for (const [id, url] of Object.entries(SOURCES)) {
  const dest = path.join(workDir, `${id}.bin`)
  process.stdout.write(`dl ${id}… `)
  const meta = await download(url, dest)
  console.log(`${meta.bytes}b ${meta.type}`)
}

const py = `
from PIL import Image
from pathlib import Path
work = Path(r'''${workDir.replace(/\\/g, '/')}''')
out = Path(r'''${outDir.replace(/\\/g, '/')}''')
SIZE = 128

def content_bbox(img, alpha_min=28, lum_min=36):
    px = img.load()
    w, h = img.size
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a >= alpha_min and (r + g + b) >= lum_min:
                xs.append(x)
                ys.append(y)
    if not xs:
        raise SystemExit('no opaque content')
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)

ZOOM = 1.28
for race in ('elyos', 'asmodian'):
    raw = work / f'{race}.bin'
    img = Image.open(raw).convert('RGBA')
    bbox = content_bbox(img)
    cropped = img.crop(bbox)
    print(race, 'src', img.size, 'bbox', bbox, 'crop', cropped.size)
    cw, ch = cropped.size
    # Zoom past the frame so residual transparent margins are clipped;
    # bias slightly upward so the crest sits under the top edge.
    scale = (SIZE / max(cw, ch)) * ZOOM
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    scaled = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ox = (SIZE - nw) // 2
    oy = (SIZE - nh) // 2 - int(SIZE * 0.04)
    canvas.paste(scaled, (ox, oy), scaled)
    dest = out / f'{race}.webp'
    canvas.save(dest, 'WEBP', quality=92, method=6)
    print(' wrote', dest, canvas.size, dest.stat().st_size)
`

const scriptPath = path.join(workDir, 'resize.py')
fs.writeFileSync(scriptPath, py)
const r = spawnSync('python', [scriptPath], { encoding: 'utf8' })
process.stdout.write(r.stdout || '')
process.stderr.write(r.stderr || '')
if (r.status !== 0) process.exit(r.status || 1)
