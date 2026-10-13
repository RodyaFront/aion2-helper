async function connect() {
  const tabs = await (await fetch('http://127.0.0.1:9229/json')).json()
  const page = tabs.find((t) => t.type === 'page')
  if (!page) throw new Error('no page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })
  let id = 1
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data))
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  })
  function send(method, params = {}) {
    const mid = id++
    ws.send(JSON.stringify({ id: mid, method, params }))
    return new Promise((resolve) => pending.set(mid, resolve))
  }
  async function evaluate(expression, awaitPromise = false) {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise })
    if (r.result?.exceptionDetails) {
      throw new Error(JSON.stringify(r.result.exceptionDetails, null, 2))
    }
    return r.result?.result?.value
  }
  await send('Runtime.enable')
  return { ws, evaluate }
}

const step = process.argv[2] || 'set'

if (step === 'set') {
  const { ws, evaluate } = await connect()
  const out = await evaluate(`(async () => {
    const btn = [...document.querySelectorAll('button')].find(b => /Только что убит/i.test(b.textContent || ''))
    if (!btn) return { err: 'no kill button' }
    btn.click()
    await new Promise(r => setTimeout(r, 500))
    const loaded = await window.aionTracker.loadState('bosses')
    const active = (loaded?.bosses || []).filter(b => b.respawnAt != null).map(b => b.name)
    const uiActive = [...document.querySelectorAll('.boss-card')].filter(c => /осталось|готов/i.test(c.textContent || '')).length
    return { fileActive: active, uiHint: uiActive, section: document.querySelector('.section-label')?.textContent }
  })()`, true)
  console.log(JSON.stringify(out, null, 2))
  ws.close()
}
else if (step === 'check') {
  const { ws, evaluate } = await connect()
  const out = await evaluate(`(async () => {
    await new Promise(r => setTimeout(r, 800))
    const loaded = await window.aionTracker.loadState('bosses')
    const fileActive = (loaded?.bosses || []).filter(b => b.respawnAt != null).map(b => ({ name: b.name, respawnAt: b.respawnAt }))
    const cards = [...document.querySelectorAll('.boss-card')].filter(c => {
      const t = c.textContent || ''
      return /\\d+:\\d+/.test(t) || /готов/i.test(t)
    }).map(c => (c.querySelector('h2')?.textContent || '').trim())
    return {
      fileActive,
      uiCardsWithTimer: cards,
      activeStat: [...document.querySelectorAll('.stat')].map(s => s.textContent.trim()),
    }
  })()`, true)
  console.log(JSON.stringify(out, null, 2))
  ws.close()
}
