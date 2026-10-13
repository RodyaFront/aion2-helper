const tabs = await (await fetch('http://127.0.0.1:9229/json')).json()
const page = tabs.find((t) => t.type === 'page')
if (!page) throw new Error('no page on 9229')

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
    throw new Error(JSON.stringify(r.result.exceptionDetails))
  }
  return r.result?.result?.value
}

await send('Runtime.enable')

const before = await evaluate(`(() => {
  const ls = localStorage.getItem('aion-boss-tracker-state-v1')
  let lsActive = 0
  try { lsActive = (JSON.parse(ls || '{}').bosses || []).filter(b => b.respawnAt != null).length } catch {}
  return {
    hasBridge: typeof window.aionTracker?.saveState === 'function',
    lsLen: ls ? ls.length : 0,
    lsActive,
  }
})()`)
console.log('before', before)

const savePlain = await evaluate(`(async () => {
  const payload = { bosses: [{ id: 'probe', name: 'Probe', nameRu: '', location: '', locationRu: '', respawnMinutes: 30, image: '', custom: false, respawnAt: Date.now() + 120000, firedAlerts: [] }] }
  try {
    const ok = await window.aionTracker.saveState('bosses', payload)
    return { ok }
  } catch (e) {
    return { err: String(e) }
  }
})()`, true)
console.log('savePlain', savePlain)

const saveFromStore = await evaluate(`(async () => {
  try {
    // Touch live pinia via DOM app — mark one killed through exposed store if present
    const keys = Object.keys(window)
    const piniaHint = keys.filter(k => k.includes('pinia') || k.includes('__vue'))
    // Direct: read reactive from a card click path is hard; instead pass bosses from localStorage shape
    const ls = localStorage.getItem('aion-boss-tracker-state-v1')
    if (!ls) return { skip: 'no ls' }
    const data = JSON.parse(ls)
    // Re-wrap as if from pinia: use the object as-is
    const ok = await window.aionTracker.saveState('bosses', data)
    return { ok, bosses: data.bosses?.length }
  } catch (e) {
    return { err: String(e) }
  }
})()`, true)
console.log('saveFromStore', saveFromStore)

const loadBack = await evaluate(`(async () => {
  try {
    const data = await window.aionTracker.loadState('bosses')
    const active = (data?.bosses || []).filter(b => b.respawnAt != null).length
    return { has: !!data, count: data?.bosses?.length ?? 0, active }
  } catch (e) {
    return { err: String(e) }
  }
})()`, true)
console.log('loadBack', loadBack)

ws.close()
