const { app, BrowserWindow, shell, Notification, Tray, Menu, nativeImage, ipcMain } = require('electron')
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const isDev = !app.isPackaged
let staticServer = null
let mainWindow = null
let tray = null
let isAlarming = false
let quitting = false

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

app.setAppUserModelId('com.aion.bosstracker')

/** Fixed port so Chromium origin (and localStorage mirror) stay stable across launches. */
const STATIC_PORT = 41787
const STATIC_URL = `http://127.0.0.1:${STATIC_PORT}/`

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}
else {
  app.on('second-instance', () => {
    focusMainWindow()
  })
}

const SPLASH_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#0e1116;color:#9aa3b2;font-family:Segoe UI,Candara,sans-serif}
.wrap{padding:1.25rem 1.5rem}
.brand{font-size:.6875rem;letter-spacing:.08em;text-transform:uppercase;color:#6b7383;margin:0 0 .5rem}
h1{margin:0;font-size:1.55rem;color:#e6e9ef;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(22.5rem,1fr));gap:1rem;margin-top:1.5rem}
.card{height:8.5rem;border:1px solid #2c3340;border-radius:.375rem;background:#161a22;overflow:hidden;display:grid;grid-template-columns:6.75rem 1fr}
.art{background:#0c0f14}
.body{padding:.75rem 1rem;display:grid;gap:.5rem;align-content:start}
.bar{height:.75rem;border-radius:.125rem;background:#222832;animation:pulse 1.1s ease-in-out infinite}
.bar.w40{width:40%}.bar.w60{width:60%}.bar.w80{width:80%}.bar.h2{height:1.5rem;margin-top:.25rem}
@keyframes pulse{0%,100%{opacity:.45}50%{opacity:.9}}
</style></head><body><div class="wrap">
<p class="brand">AION 2 · Lamuatan</p>
<h1>Трекер боссов · Verteron</h1>
<p style="margin:.35rem 0 0;font-size:.875rem">Загрузка…</p>
<div class="grid">
${Array.from({ length: 6 }, () => `<div class="card"><div class="art"></div><div class="body"><div class="bar w60"></div><div class="bar w40"></div><div class="bar w80 h2"></div></div></div>`).join('')}
</div></div></body></html>`

function publicRoot() {
  return path.join(__dirname, '..', '.output', 'public')
}

function statePath(key) {
  const name = key === 'settings' ? 'tracker-settings.json' : 'tracker-state.json'
  return path.join(app.getPath('userData'), name)
}

function trayIcon() {
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAAD/eHIxAAAAH0lEQVQokWNk+M9Qz0BFwDiqYZQBqYZhmGpgAAB5uwMJG3rY1gAAAABJRU5ErkJggg==',
  )
}

function focusMainWindow() {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function buildTray() {
  if (tray) return
  tray = new Tray(trayIcon())
  tray.setToolTip('AION 2 — трекер боссов')
  tray.on('click', () => focusMainWindow())
  tray.on('double-click', () => focusMainWindow())
  updateTrayMenu()
}

function updateTrayMenu() {
  if (!tray) return
  const menu = Menu.buildFromTemplate([
    {
      label: isAlarming ? 'Будильник активен — открыть' : 'Открыть трекер',
      click: () => focusMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => {
        quitting = true
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
  tray.setToolTip(isAlarming ? 'AION 2 — босс готов!' : 'AION 2 — трекер боссов')
}

function probeStaticUrl(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve(false)
    })
    req.on('error', () => resolve(false))
  })
}

function startStaticServer(root) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const raw = decodeURIComponent((req.url || '/').split('?')[0])
        let rel = raw === '/' ? '/index.html' : raw
        if (rel.endsWith('/')) rel += 'index.html'

        const filePath = path.normalize(path.join(root, rel))
        if (!filePath.startsWith(root)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.writeHead(404)
            res.end('Not found')
            return
          }
          const ext = path.extname(filePath).toLowerCase()
          res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400',
          })
          res.end(data)
        })
      }
      catch (error) {
        res.writeHead(500)
        res.end(String(error))
      }
    })

    server.once('error', reject)
    server.listen(STATIC_PORT, '127.0.0.1', () => {
      resolve({ server, url: STATIC_URL })
    })
  })
}

async function ensureStaticUrl(root) {
  try {
    const started = await startStaticServer(root)
    staticServer = started.server
    return started.url
  }
  catch (error) {
    if (error && error.code === 'EADDRINUSE') {
      const alive = await probeStaticUrl(STATIC_URL)
      if (alive) return STATIC_URL
    }
    throw error
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 820,
    minHeight: 600,
    backgroundColor: '#0e1116',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
    // Paint splash first, then show — avoid empty chrome.
    show: false,
  })

  mainWindow.webContents.on('console-message', (_e, _level, message) => {
    console.log('[renderer]', message)
  })

  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000')
    mainWindow.show()
    return
  }

  const root = publicRoot()
  const indexHtml = path.join(root, 'index.html')
  if (!fs.existsSync(indexHtml)) {
    await mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        `<body style="background:#0e1116;color:#eef1f6;font-family:Segoe UI,sans-serif;padding:2rem">`
        + `<h1>Не найден UI</h1><p>${indexHtml}</p></body>`,
      )}`,
    )
    mainWindow.show()
    return
  }

  // Instant skeleton, then swap to HTTP SPA (never file:// — Nuxt assets break).
  await mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(SPLASH_HTML)}`)
  mainWindow.show()

  try {
    const url = await ensureStaticUrl(root)
    await mainWindow.loadURL(url)
  }
  catch (error) {
    console.error(error)
    await mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        `<body style="background:#0e1116;color:#eef1f6;font-family:Segoe UI,sans-serif;padding:2rem">`
        + `<h1>Не удалось запустить UI</h1>`
        + `<p>Порт ${STATIC_PORT} занят или UI недоступен. Закрой все окна AionBossTracker в Диспетчере задач и запусти снова.</p>`
        + `<pre style="white-space:pre-wrap;color:#9aa3b2">${String(error)}</pre></body>`,
      )}`,
    )
  }
}

ipcMain.handle('tracker:load-state', (_event, key) => {
  try {
    const file = statePath(key === 'settings' ? 'settings' : 'bosses')
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  catch {
    return null
  }
})

ipcMain.handle('tracker:save-state', (_event, key, data) => {
  try {
    const file = statePath(key === 'settings' ? 'settings' : 'bosses')
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data), 'utf8')
    return true
  }
  catch (error) {
    console.error('[tracker:save-state]', error)
    return false
  }
})

ipcMain.on('tracker:notify', (_event, payload = {}) => {
  const title = String(payload.title || 'AION 2')
  const body = String(payload.body || '')
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title,
    body,
    silent: false,
    urgency: 'critical',
    timeoutType: 'never',
  })
  notification.on('click', () => {
    focusMainWindow()
    if (mainWindow) mainWindow.webContents.send('tracker:focus')
  })
  notification.show()
})

ipcMain.on('tracker:alarming', (_event, active) => {
  isAlarming = Boolean(active)
  updateTrayMenu()
  if (isAlarming && tray) {
    tray.displayBalloon?.({
      title: 'AION 2 — босс готов',
      content: 'Таймер респауна закончился. Открой трекер.',
    })
  }
})

if (gotSingleInstanceLock) {
  app.whenReady().then(async () => {
    buildTray()
    await createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) void createWindow()
      else focusMainWindow()
    })
  })
}

app.on('before-quit', () => {
  quitting = true
  if (staticServer) {
    staticServer.close()
    staticServer = null
  }
})

app.on('window-all-closed', () => {
  // Keep tray app alive on Windows; server stays until before-quit.
})
