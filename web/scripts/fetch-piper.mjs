/**
 * Download Piper Windows binary + EN/RU medium voices into vendor/piper.
 * Idempotent: skips files that already exist with non-trivial size.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import https from 'node:https'
import http from 'node:http'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vendor = path.join(root, 'vendor', 'piper')
const binDir = path.join(vendor, 'bin')
const voicesDir = path.join(vendor, 'voices')

const PIPER_ZIP = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip'

const VOICES = [
  {
    id: 'en_US-lessac-medium',
    onnx: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx',
    json: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json',
  },
  {
    id: 'ru_RU-irina-medium',
    onnx: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx',
    json: 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx.json',
  },
]

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const get = url.startsWith('https') ? https.get : http.get
    const req = get(url, { headers: { 'User-Agent': 'AionBossTracker-piper-fetch' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        try { fs.unlinkSync(dest) } catch {}
        const next = new URL(res.headers.location, url).href
        download(next, dest).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(dest) } catch {}
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
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

function freshEnough(file, minBytes) {
  try {
    return fs.statSync(file).size >= minBytes
  }
  catch {
    return false
  }
}

async function ensureFile(url, dest, minBytes, label) {
  if (freshEnough(dest, minBytes)) {
    console.log(`OK  ${label}`)
    return
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const tmp = `${dest}.part`
  console.log(`GET ${label}`)
  await download(url, tmp)
  fs.renameSync(tmp, dest)
  console.log(`OK  ${label} (${fs.statSync(dest).size} bytes)`)
}

function extractZip(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true })
  const r = spawnSync('tar', ['-xf', zipPath, '-C', outDir], { stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    throw new Error(`Failed to extract ${zipPath}`)
  }
}

function findPiperExe(dir) {
  if (!fs.existsSync(dir)) return null
  const direct = path.join(dir, 'piper.exe')
  if (fs.existsSync(direct)) return direct
  for (const name of fs.readdirSync(dir)) {
    const nested = path.join(dir, name, 'piper.exe')
    if (fs.existsSync(nested)) return nested
  }
  return null
}

async function main() {
  fs.mkdirSync(voicesDir, { recursive: true })
  fs.mkdirSync(binDir, { recursive: true })

  const zipPath = path.join(vendor, 'piper_windows_amd64.zip')
  const piperExe = findPiperExe(binDir) || findPiperExe(path.join(binDir, 'piper'))

  if (!piperExe || !freshEnough(piperExe, 100_000)) {
    await ensureFile(PIPER_ZIP, zipPath, 1_000_000, 'piper_windows_amd64.zip')
    // Clean bin before extract
    fs.rmSync(binDir, { recursive: true, force: true })
    fs.mkdirSync(binDir, { recursive: true })
    extractZip(zipPath, binDir)
    const found = findPiperExe(binDir) || findPiperExe(path.join(binDir, 'piper'))
    if (!found) throw new Error('piper.exe not found after extract')
    console.log(`OK  piper.exe → ${found}`)
  }
  else {
    console.log(`OK  piper.exe → ${piperExe}`)
  }

  for (const voice of VOICES) {
    await ensureFile(voice.onnx, path.join(voicesDir, `${voice.id}.onnx`), 1_000_000, `${voice.id}.onnx`)
    await ensureFile(voice.json, path.join(voicesDir, `${voice.id}.onnx.json`), 100, `${voice.id}.onnx.json`)
  }

  fs.writeFileSync(
    path.join(vendor, 'voices.json'),
    JSON.stringify({
      en: 'en_US-lessac-medium',
      ru: 'ru_RU-irina-medium',
    }, null, 2),
    'utf8',
  )
  console.log('Piper vendor ready:', vendor)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
