const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aionTracker', {
  notify(payload) {
    ipcRenderer.send('tracker:notify', payload)
  },
  /** Windows SAPI speak (used when Chromium voice list is empty). */
  speak(payload) {
    return ipcRenderer.invoke('tracker:speak', payload)
  },
  stopSpeak() {
    ipcRenderer.send('tracker:speak-stop')
  },
  onFocusApp(handler) {
    const listener = () => {
      handler()
    }
    ipcRenderer.on('tracker:focus', listener)
    return () => ipcRenderer.removeListener('tracker:focus', listener)
  },
  loadState(key) {
    return ipcRenderer.invoke('tracker:load-state', key)
  },
  saveState(key, data) {
    return ipcRenderer.invoke('tracker:save-state', key, data)
  },
  detectNpcap() {
    return ipcRenderer.invoke('tracker:npcap-detect')
  },
  getAutoKillStatus() {
    return ipcRenderer.invoke('tracker:auto-kill-status')
  },
  setAutoKillTrack(enabled) {
    return ipcRenderer.invoke('tracker:auto-kill-set', Boolean(enabled))
  },
  /** Detect Npcap and start watcher when driver is present (default-on launch). */
  ensureAutoKillTrack() {
    return ipcRenderer.invoke('tracker:auto-kill-ensure')
  },
  onBossKill(handler) {
    const listener = (_event, payload) => {
      handler(payload)
    }
    ipcRenderer.on('tracker:boss-kill', listener)
    return () => ipcRenderer.removeListener('tracker:boss-kill', listener)
  },
  onFieldSync(handler) {
    const listener = (_event, payload) => {
      handler(payload)
    }
    ipcRenderer.on('tracker:field-sync', listener)
    return () => ipcRenderer.removeListener('tracker:field-sync', listener)
  },
  onSessionEvent(handler) {
    const listener = (_event, payload) => {
      handler(payload)
    }
    ipcRenderer.on('tracker:session-event', listener)
    return () => ipcRenderer.removeListener('tracker:session-event', listener)
  },
  onAutoKillStatus(handler) {
    const listener = (_event, payload) => {
      handler(payload)
    }
    ipcRenderer.on('tracker:auto-kill-status', listener)
    return () => ipcRenderer.removeListener('tracker:auto-kill-status', listener)
  },
  openExternal(url) {
    return ipcRenderer.invoke('tracker:open-external', url)
  },
})
