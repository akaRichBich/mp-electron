import { statSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  app,
  dialog,
  ipcMain,
  nativeImage,
  shell,
} from 'electron'
import { SHELL_CAPABILITIES, allRules, checkPath, formatBytes, scan, type ScanReport } from '@mp/core'
import { NodeFsPort } from '@mp/port-node'
import { partitionRemovable } from './guard'
import { CHANNELS, type Boot, type RemoveResult } from '../shared/ipc'

/**
 * Everything platform-shaped lives here. The renderer gets a ScanReport and a
 * capability record over IPC and knows nothing about fs, paths or rules - the
 * same UI package the PWA uses renders it.
 *
 * RECLAIM_HOME re-roots the whole app at a throwaway directory. That is how
 * this gets demoed and tested without deleting anyone's real caches.
 */
// RECLAIM_HOME may be written relative, but Electron's cwd is apps/desktop,
// not wherever it was typed. Resolve it, and say so when it does not exist -
// an empty report from a missing directory looks exactly like a clean disk.
const override = process.env['RECLAIM_HOME']
const home = override ? resolve(override) : homedir()
const demo = home !== homedir()
const homeExists = statSync(home, { throwIfNoEntry: false })?.isDirectory() ?? false
const port = new NodeFsPort(home)

if (demo && !homeExists) {
  console.error(`[reclaim] RECLAIM_HOME=${override} resolved to ${home}, which does not exist`)
}

let win: BrowserWindow | null = null
let tray: Tray | null = null
let lastReport: ScanReport | null = null
let scanning = false

function asset(name: string): string {
  return fileURLToPath(new URL(`../../build/${name}`, import.meta.url))
}

async function runScan(options: { notify: boolean }): Promise<ScanReport> {
  if (!homeExists) {
    return { portId: port.id, capabilities: port.capabilities, findings: [], skipped: [], totalBytes: 0 }
  }
  if (scanning && lastReport) return lastReport
  scanning = true
  try {
    const report = await scan(port, allRules(), {
      onProgress: (progress) => win?.webContents.send(CHANNELS.progress, progress),
    })
    lastReport = report
    tray?.setToolTip(`Reclaim - ${formatBytes(report.totalBytes)} reclaimable`)
    win?.webContents.send(CHANNELS.report, report)

    if (options.notify && report.totalBytes > 0 && Notification.isSupported()) {
      new Notification({
        title: `${formatBytes(report.totalBytes)} can be reclaimed`,
        body: `Across ${report.findings.length} location${report.findings.length === 1 ? '' : 's'} in ${home}`,
        silent: true,
      })
        .on('click', () => showWindow())
        .show()
    }
    return report
  } finally {
    scanning = false
  }
}

function showWindow() {
  if (win) {
    win.show()
    win.focus()
    return
  }
  createWindow()
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 880,
    minHeight: 620,
    show: false,
    backgroundColor: '#0b0d10',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 22 },
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      // An ESM preload (.mjs) only loads with the sandbox off. Isolation and
      // the lack of node integration are what actually keep the renderer thin.
      sandbox: false,
    },
  })

  win.webContents.on('preload-error', (_event, path, error) =>
    console.error('[preload]', path, error),
  )

  win.on('ready-to-show', () => win?.show())
  win.on('closed', () => {
    win = null
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(fileURLToPath(new URL('../renderer/index.html', import.meta.url)))
}

function createTray() {
  const icon = nativeImage.createFromPath(asset('trayTemplate.png'))
  icon.setTemplateImage(true)
  tray = new Tray(icon)
  tray.setToolTip('Reclaim')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Reclaim', click: () => showWindow() },
      {
        label: 'Scan now',
        click: () => {
          void runScan({ notify: true })
        },
      },
      { type: 'separator' },
      { label: demo ? `Demo home: ${home}` : home, enabled: false },
      { type: 'separator' },
      { label: 'Quit', click: () => app.exit(0) },
    ]),
  )
}

ipcMain.on(CHANNELS.boot, (event) => {
  const boot: Boot = { home, demo, homeExists, capabilities: SHELL_CAPABILITIES.desktop }
  event.returnValue = boot
})

ipcMain.handle(CHANNELS.scan, () => runScan({ notify: false }))

// A scan that finished before the window mounted still has a result. The UI
// pulls it rather than relying on a push arriving after it subscribed.
ipcMain.handle(CHANNELS.last, () => lastReport)

ipcMain.handle(CHANNELS.reveal, (_event, path: string) => {
  if (!checkPath(path).ok) return
  shell.showItemInFolder(port.realPath(path))
})

/**
 * The renderer is not trusted with paths. Every one is checked twice: it must
 * appear in the report main itself produced, and it must still pass the
 * allowlist. Then a native dialog asks the human.
 */
ipcMain.handle(CHANNELS.remove, async (_event, paths: string[]): Promise<RemoveResult> => {
  const findings = lastReport?.findings ?? []
  const bytesByPath = new Map(findings.map((finding) => [finding.path, finding.bytes]))
  const { allowed, refused, bytes } = partitionRemovable(paths, findings)

  if (allowed.length === 0) return { removed: 0, bytes: 0, refused, report: lastReport }

  const question = {
    type: 'warning' as const,
    buttons: ['Remove', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    message: `Remove ${allowed.length} location${allowed.length === 1 ? '' : 's'}?`,
    detail: `${formatBytes(bytes)} will be deleted from disk. This cannot be undone.\n\n${allowed.join('\n')}`,
  }
  const { response } = win
    ? await dialog.showMessageBox(win, question)
    : await dialog.showMessageBox(question)

  if (response !== 0) return { removed: 0, bytes: 0, refused: [], report: lastReport }

  // A path that throws, or that survives its own removal, is reported back
  // rather than counted as removed.
  const removed: string[] = []
  for (const path of allowed) {
    try {
      await port.remove(path)
      if (await port.stat(path)) throw new Error('still present after removal')
      removed.push(path)
    } catch (error) {
      console.error('[reclaim] could not remove', path, error)
      refused.push(path)
    }
  }

  const report = await runScan({ notify: false })
  const removedBytes = removed.reduce((sum, path) => sum + (bytesByPath.get(path) ?? 0), 0)
  return { removed: removed.length, bytes: removedBytes, refused, report }
})

void app.whenReady().then(() => {
  createTray()
  createWindow()
  // The capability the browser does not have: scan the whole home, unattended,
  // before anyone asks.
  void runScan({ notify: true })

  app.on('activate', () => showWindow())
})

app.on('window-all-closed', () => {
  // A tray-resident app on macOS. Elsewhere, closing the window ends it.
  if (process.platform !== 'darwin') app.quit()
})
