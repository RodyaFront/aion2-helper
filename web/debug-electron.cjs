const http = require('http')
const fs = require('fs')
const path = require('path')
const { app, BrowserWindow } = require('electron')
const root = path.join(__dirname, '.output', 'public')
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.webp':'image/webp', '.json':'application/json' }
app.whenReady().then(() => {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent((req.url||'/').split('?')[0])
    if (rel === '/') rel = '/index.html'
    const file = path.join(root, rel)
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('nf'); return }
      const ext = path.extname(file).toLowerCase()
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
      res.end(data)
    })
  })
  server.listen(0, '127.0.0.1', async () => {
    const port = server.address().port
    const win = new BrowserWindow({ width: 1000, height: 700, show: false, webPreferences: { contextIsolation: true } })
    win.webContents.on('console-message', (e) => console.log('CONSOLE', e.message))
    await win.loadURL(`http://127.0.0.1:${port}/`)
    await new Promise(r => setTimeout(r, 3000))
    const dump = await win.webContents.executeJavaScript(`({
      cards: document.querySelectorAll('.boss-card').length,
      title: document.querySelector('h1')?.textContent || '',
      text: document.body.innerText.slice(0, 200)
    })`)
    console.log('DUMP', JSON.stringify(dump))
    app.quit()
  })
})
