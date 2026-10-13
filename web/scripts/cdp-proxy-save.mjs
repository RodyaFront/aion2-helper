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

const result = await evaluate(`(async () => {
  const btnLabels = [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(Boolean).slice(0, 40)

  const plain = {
    bosses: [{
      id: 'x', name: 'X', nameRu: '', location: '', locationRu: '',
      respawnMinutes: 30, image: '', custom: false,
      respawnAt: Date.now() + 99999, firedAlerts: [],
    }],
  }
  const proxied = new Proxy(plain, { get: (t, p) => Reflect.get(t, p) })
  Object.defineProperty(proxied, 'bosses', {
    enumerable: true,
    get() { return new Proxy(plain.bosses, { get: (t, p) => Reflect.get(t, p) }) },
  })

  let proxySave
  try { proxySave = await window.aionTracker.saveState('bosses', proxied) }
  catch (e) { proxySave = 'ERR:' + e }

  // Click first "Убит" style button if present
  const killBtn = [...document.querySelectorAll('button')].find(b => /убит/i.test(b.textContent || ''))
  if (killBtn) killBtn.click()
  await new Promise(r => setTimeout(r, 400))

  const ls = localStorage.getItem('aion-boss-tracker-state-v1')
  let lsActive = 0
  let fileActive = null
  try { lsActive = (JSON.parse(ls || '{}').bosses || []).filter(b => b.respawnAt != null).length } catch {}
  try {
    const loaded = await window.aionTracker.loadState('bosses')
    fileActive = (loaded?.bosses || []).filter(b => b.respawnAt != null).length
  } catch (e) {
    fileActive = 'ERR:' + e
  }

  return { btnLabels, proxySave, lsActive, fileActive, lsLen: ls?.length ?? 0 }
})()`, true)

console.log(JSON.stringify(result, null, 2))
ws.close()
