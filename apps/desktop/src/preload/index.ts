import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type Boot, type DesktopApi, type RemoveResult, type ScanProgress } from '../shared/ipc'
import type { ScanReport } from '@mp/core'

function subscribe<T>(channel: string, handler: (payload: T) => void): () => void {
  const listener = (_event: unknown, payload: T) => handler(payload)
  ipcRenderer.on(channel, listener)
  return () => void ipcRenderer.off(channel, listener)
}

const api: DesktopApi = {
  boot: ipcRenderer.sendSync(CHANNELS.boot) as Boot,
  scan: () => ipcRenderer.invoke(CHANNELS.scan) as Promise<ScanReport>,
  last: () => ipcRenderer.invoke(CHANNELS.last) as Promise<ScanReport | null>,
  remove: (paths) => ipcRenderer.invoke(CHANNELS.remove, paths) as Promise<RemoveResult>,
  reveal: (path) => ipcRenderer.invoke(CHANNELS.reveal, path) as Promise<void>,
  onProgress: (handler) => subscribe<ScanProgress>(CHANNELS.progress, handler),
  onReport: (handler) => subscribe<ScanReport>(CHANNELS.report, handler),
}

contextBridge.exposeInMainWorld('reclaim', api)
