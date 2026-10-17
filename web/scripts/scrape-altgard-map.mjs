/**
 * Download Altgard map tiles (z0–z3) from KINA map-runtime.
 * Then run: node scripts/build-altgard-coords.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'maps', 'altgard')

const TILE_SHA = 'sha256-6dc89321e8cf5f287ae91ef15ba912b04fc087a5e3d1ee9234febf52800df2bf'
const TILE_BASE = `https://www.aion2kina.com/map-runtime/releases/${TILE_SHA}/maps/tiles/altgard`

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { headers: { 'User-Agent': 'AionBossTracker-map-scrape' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        try { fs.unlinkSync(dest) } catch {}
        download(new URL(res.headers.location, url).href, dest).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(dest) } catch {}
        reject(new Error(`HTTP ${res.statusCode} ${url}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    })
    req.on('error', (err) => {
      try { fs.unlinkSync(dest) } catch {}
      reject(err)
    })
  })
}

function probeTileExists(z, x, y) {
  const url = `${TILE_BASE}/${z}/${x}/${y}.webp`
  return new Promise((resolve) => {
    https.get(url, { method: 'HEAD', headers: { 'User-Agent': 'AionBossTracker-map-scrape' } }, (res) => {
      resolve(res.statusCode === 200)
    }).on('error', () => resolve(false))
  })
}

async function downloadTiles(maxZ = 3) {
  const tileDir = path.join(outDir, 'tiles')
  let count = 0
  for (let z = 0; z <= maxZ; z++) {
    const max = 2 ** z
    for (let x = 0; x < max; x++) {
      for (let y = 0; y < max; y++) {
        const ok = await probeTileExists(z, x, y)
        if (!ok) continue
        const rel = `${z}/${x}/${y}.webp`
        const dest = path.join(tileDir, rel)
        if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
          count += 1
          continue
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true })
        process.stdout.write(`tile ${rel}... `)
        await download(`${TILE_BASE}/${rel}`, dest)
        console.log(`${fs.statSync(dest).size}b`)
        count += 1
      }
    }
  }
  return count
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  console.log('Downloading Altgard tiles z0–z3…')
  let n = 0
  try {
    n = await downloadTiles(3)
  }
  catch (err) {
    console.warn('tile download failed:', err instanceof Error ? err.message : err)
  }
  const overviewSrc = path.join(outDir, 'tiles', '0', '0', '0.webp')
  if (fs.existsSync(overviewSrc)) {
    fs.copyFileSync(overviewSrc, path.join(outDir, 'overview.webp'))
  }
  console.log(`Tiles ready: ${n}`)
  if (n === 0) {
    console.error('No tiles downloaded — KINA may be down; keep placeholders if present, or re-run later')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
