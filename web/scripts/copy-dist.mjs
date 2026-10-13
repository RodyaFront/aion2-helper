import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.resolve(root, '..', 'dist')
const release = path.join(root, 'release')
const portable = path.join(release, 'AionBossTracker.exe')
const unpacked = path.join(release, 'win-unpacked')
const fastDir = path.join(dist, 'AionBossTracker')

fs.mkdirSync(dist, { recursive: true })

if (fs.existsSync(portable)) {
  fs.copyFileSync(portable, path.join(dist, 'AionBossTracker.exe'))
  console.log('Copied portable → dist/AionBossTracker.exe (slow first unpack)')
}

if (fs.existsSync(unpacked)) {
  fs.rmSync(fastDir, { recursive: true, force: true })
  fs.cpSync(unpacked, fastDir, { recursive: true })
  const readme = path.join(fastDir, 'START-HERE.txt')
  fs.writeFileSync(
    readme,
    [
      'Быстрый запуск (1–3 сек): запусти AionBossTracker.exe из этой папки.',
      '',
      'Портативный dist/AionBossTracker.exe удобен одним файлом, но при каждом',
      'старте распаковывает Electron во временную папку — часто 20–40 сек.',
      '',
      'Эта папка — уже распакованное приложение. Можно держать на диске или в ZIP.',
      '',
    ].join('\n'),
    'utf8',
  )
  console.log('Copied unpacked → dist/AionBossTracker/ (fast launch)')
}
