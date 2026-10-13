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
const cons = []
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    cons.push(msg.params.args?.map((a) => a.value ?? a.description).join(' '))
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    cons.push('EXC:' + (msg.params.exceptionDetails?.text || JSON.stringify(msg.params)))
  }
})

function send(method, params = {}) {
  const mid = id++
  ws.send(JSON.stringify({ id: mid, method, params }))
  return new Promise((resolve) => pending.set(mid, resolve))
}

await send('Runtime.enable')
const r = await send('Runtime.evaluate', {
  expression: `(() => {
    const body = document.body
    return {
      url: location.href,
      readyState: document.readyState,
      boot: !!document.querySelector('.boot-shell'),
      appShell: !!document.querySelector('.app-shell'),
      cards: document.querySelectorAll('.boss-card').length,
      text: (body?.innerText || '').slice(0, 300),
      hasAion: typeof window.aionTracker,
      bg: getComputedStyle(body).backgroundColor,
      childCount: body?.children?.length ?? 0,
    }
  })()`,
  returnByValue: true,
  awaitPromise: true,
})
console.log(JSON.stringify(r.result?.result?.value ?? r, null, 2))
await new Promise((r) => setTimeout(r, 300))
console.log('console', cons)
ws.close()
