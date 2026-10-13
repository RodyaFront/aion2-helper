const tabs = await (await fetch('http://127.0.0.1:9229/json')).json()
const page = tabs.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true })
  ws.addEventListener('error', rej, { once: true })
})
let id = 1
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
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
await send('Runtime.enable')
const expr = `(() => {
  const input = document.querySelector('.search-input');
  const active = [...document.querySelectorAll('.filter-btn')].find(b => b.classList.contains('is-active'))?.textContent;
  return {
    searchValue: input?.value ?? null,
    filterBtn: active,
    section: document.querySelector('.section-label')?.textContent,
    cardNames: [...document.querySelectorAll('.boss-card h2')].map(h => h.textContent),
    cardCount: document.querySelectorAll('.boss-card').length,
  };
})()`
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
console.log(JSON.stringify(r.result?.result?.value ?? r, null, 2))
ws.close()
