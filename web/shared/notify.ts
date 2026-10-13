/** Windows / browser toast. Silent OS blip — app plays its own Web Audio. */
export function notifyNative(title: string, body: string) {
  if (typeof window === 'undefined') return

  const api = window.aionTracker
  if (api?.notify) {
    api.notify({ title, body })
    return
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      // eslint-disable-next-line no-new
      new Notification(title, { body, silent: true, requireInteraction: true })
    }
    catch {
      // ignore
    }
  }
}
