const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aionTracker', {
  notify(payload) {
    ipcRenderer.send('tracker:notify', payload)
  },
  setAlarming(active) {
    ipcRenderer.send('tracker:alarming', Boolean(active))
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
})
