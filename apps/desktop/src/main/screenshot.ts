import { writeFileSync } from 'node:fs'
import type { BrowserWindow } from 'electron'

/**
 * Regenerates the images in docs/screenshots, so what is in the README is
 * whatever the app currently renders rather than something cropped by hand
 * six versions ago. Does nothing unless RECLAIM_SHOT is set.
 *
 *   RECLAIM_SHOT=out.png [RECLAIM_SHOT_URL=…] [RECLAIM_SHOT_ZOOM=0.6]
 *   [RECLAIM_SHOT_WAIT=3000] [RECLAIM_SHOT_EVAL='…'] pnpm dev:desktop
 */
export function captureIfAsked(win: BrowserWindow, quit: () => void): void {
  const target = process.env['RECLAIM_SHOT']
  if (!target) return

  const frames = Number(process.env['RECLAIM_SHOT_FRAMES'] ?? 0)
  const interval = Math.round(1000 / Number(process.env['RECLAIM_SHOT_FPS'] ?? 6))

  win.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      void (async () => {
        win.webContents.setZoomFactor(Number(process.env['RECLAIM_SHOT_ZOOM'] ?? 1))
        const script = process.env['RECLAIM_SHOT_EVAL']

        if (frames > 0) {
          // Drive the interaction and film it at the same time.
          if (script) void win.webContents.executeJavaScript(script)
          for (let i = 0; i < frames; i++) {
            writeFileSync(
              `${target}-${String(i).padStart(3, '0')}.png`,
              (await win.webContents.capturePage()).toPNG(),
            )
            await new Promise((done) => setTimeout(done, interval))
          }
          console.log('[shot] wrote', frames, 'frames to', target)
          quit()
          return
        }

        if (script) console.log('[shot]', await win.webContents.executeJavaScript(script))
        await new Promise((done) => setTimeout(done, 500))
        writeFileSync(target, (await win.webContents.capturePage()).toPNG())
        console.log('[shot] wrote', target)
        quit()
      })()
    }, Number(process.env['RECLAIM_SHOT_WAIT'] ?? 3000))
  })
}
