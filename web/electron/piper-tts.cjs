const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawn } = require('node:child_process')
const { pathToFileURL } = require('node:url')
const { app } = require('electron')

const VOICE_BY_LANG = {
  en: 'en_US-lessac-medium',
  'en-us': 'en_US-lessac-medium',
  'en-gb': 'en_US-lessac-medium',
  ru: 'ru_RU-irina-medium',
  'ru-ru': 'ru_RU-irina-medium',
}

let piperChild = null
let playChild = null

function vendorRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'piper')
  }
  return path.join(__dirname, '..', 'vendor', 'piper')
}

function findPiperExe(root) {
  const candidates = [
    path.join(root, 'bin', 'piper', 'piper.exe'),
    path.join(root, 'bin', 'piper.exe'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c)) return c
  }
  const bin = path.join(root, 'bin')
  if (!fs.existsSync(bin)) return null
  for (const name of fs.readdirSync(bin)) {
    const nested = path.join(bin, name, 'piper.exe')
    if (fs.existsSync(nested)) return nested
  }
  return null
}

function resolveVoiceId(lang) {
  const key = String(lang || 'en-US').replace(/_/g, '-').toLowerCase()
  if (VOICE_BY_LANG[key]) return VOICE_BY_LANG[key]
  const prefix = key.split('-')[0]
  return VOICE_BY_LANG[prefix] || VOICE_BY_LANG.en
}

function isAvailable() {
  const root = vendorRoot()
  const exe = findPiperExe(root)
  if (!exe) return false
  const voice = resolveVoiceId('en-US')
  const model = path.join(root, 'voices', `${voice}.onnx`)
  return fs.existsSync(model)
}

function cacheDir() {
  const dir = path.join(app.getPath('userData'), 'piper-cache')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function cacheKey(voiceId, text) {
  return crypto.createHash('sha1').update(`${voiceId}\n${text}`).digest('hex')
}

function stop() {
  for (const child of [piperChild, playChild]) {
    if (!child) continue
    try { child.kill() } catch {}
  }
  piperChild = null
  playChild = null
}

function runPiper(exe, model, text, outWav) {
  return new Promise((resolve, reject) => {
    const cwd = path.dirname(exe)
    stop()
    const child = spawn(exe, ['--model', model, '--output_file', outWav], {
      cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    piperChild = child
    let err = ''
    child.stderr.on('data', (d) => { err += d.toString() })
    child.on('error', (e) => {
      piperChild = null
      reject(e)
    })
    child.on('exit', (code) => {
      piperChild = null
      if (code === 0 && fs.existsSync(outWav) && fs.statSync(outWav).size > 44) {
        resolve()
      }
      else {
        reject(new Error(`piper exit ${code}: ${err.trim() || 'no wav'}`))
      }
    })
    child.stdin.write(text, 'utf8')
    child.stdin.end()
  })
}

function playWav(wavPath, volumePct) {
  const vol = Math.max(0, Math.min(1, (Number(volumePct) || 80) / 100))
  const uri = pathToFileURL(wavPath).href.replace(/'/g, "''")
  const ps = [
    'Add-Type -AssemblyName PresentationCore',
    '$mp = New-Object System.Windows.Media.MediaPlayer',
    `$mp.Volume = ${vol}`,
    `$mp.Open([Uri]::new('${uri}'))`,
    '$sw = [Diagnostics.Stopwatch]::StartNew()',
    'while (-not $mp.NaturalDuration.HasTimeSpan) {',
    '  if ($sw.ElapsedMilliseconds -gt 8000) { break }',
    '  Start-Sleep -Milliseconds 20',
    '}',
    'if ($mp.NaturalDuration.HasTimeSpan) {',
    '  $mp.Play()',
    '  $ms = [Math]::Max(80, [int]$mp.NaturalDuration.TimeSpan.TotalMilliseconds + 100)',
    '  Start-Sleep -Milliseconds $ms',
    '}',
    '$mp.Stop()',
    '$mp.Close()',
  ].join('; ')

  return new Promise((resolve) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-Command', ps],
      { windowsHide: true },
    )
    playChild = child
    const done = () => {
      playChild = null
      resolve()
    }
    child.once('exit', done)
    child.once('error', done)
  })
}

async function synthesizeToFile(text, lang) {
  const clean = String(text || '').trim()
  if (!clean) return null

  const root = vendorRoot()
  const exe = findPiperExe(root)
  if (!exe) throw new Error('piper.exe missing — run npm run piper:fetch')

  const voiceId = resolveVoiceId(lang)
  const model = path.join(root, 'voices', `${voiceId}.onnx`)
  if (!fs.existsSync(model)) throw new Error(`voice model missing: ${voiceId}`)

  const outWav = path.join(cacheDir(), `${cacheKey(voiceId, clean)}.wav`)
  if (fs.existsSync(outWav) && fs.statSync(outWav).size > 44) {
    return outWav
  }

  const tmp = `${outWav}.tmp.wav`
  try {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
  }
  catch {}
  await runPiper(exe, model, clean, tmp)
  fs.renameSync(tmp, outWav)
  return outWav
}

async function speak(text, lang, volumePct) {
  const wav = await synthesizeToFile(text, lang)
  if (!wav) return
  await playWav(wav, volumePct)
}

module.exports = {
  isAvailable,
  speak,
  stop,
  vendorRoot,
}
