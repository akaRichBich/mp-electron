import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Regenerates docs/screenshots from the running apps, so the README shows what
 * the code currently renders. Needs `pnpm dev:web` on :5173 for the web shots,
 * and ffmpeg for the gif.
 */
const out = resolve('docs/screenshots')
const demoHome = resolve('.demo-home')

function shoot(env: Record<string, string>) {
  execFileSync('pnpm', ['--filter', '@mp/desktop', 'dev'], {
    env: { ...process.env, ...env },
    stdio: 'inherit',
  })
}

console.log('desktop…')
shoot({
  RECLAIM_HOME: demoHome,
  RECLAIM_SHOT: join(out, 'desktop.png'),
  RECLAIM_SHOT_ZOOM: '0.6',
})

console.log('web…')
shoot({
  RECLAIM_SHOT_URL: 'http://localhost:5173',
  RECLAIM_SHOT: join(out, 'web.png'),
  RECLAIM_SHOT_ZOOM: '0.62',
  RECLAIM_SHOT_WAIT: '2500',
  RECLAIM_SHOT_EVAL: `document.querySelector('.demo-entry .button').click(); new Promise(r => setTimeout(() => r('ok'), 2500))`,
})

console.log('web delete, as frames…')
const frames = mkdtempSync(join(tmpdir(), 'reclaim-frames-'))
shoot({
  RECLAIM_SHOT_URL: 'http://localhost:5173',
  RECLAIM_SHOT: join(frames, 'f'),
  RECLAIM_SHOT_FRAMES: '42',
  RECLAIM_SHOT_FPS: '7',
  RECLAIM_SHOT_ZOOM: '0.62',
  RECLAIM_SHOT_WAIT: '1200',
  RECLAIM_SHOT_EVAL: `(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms))
    await w(700)
    document.querySelector('.demo-entry .button').click()
    await w(2600)
    const row = [...document.querySelectorAll('.finding')].find((f) => f.textContent.includes('Reclaim sandbox'))
    row.scrollIntoView({ block: 'center' })
    await w(900)
    row.querySelector('.finding-action .button').click()
    await w(1600)
    ;[...document.querySelectorAll('dialog.confirm button')].find((b) => b.textContent.includes('delete')).click()
    await w(2500)
    document.querySelector('.receipt-card')?.scrollIntoView({ block: 'center' })
    return 'ok'
  })()`,
})

console.log(`encoding ${readdirSync(frames).length} frames…`)
execFileSync(
  'ffmpeg',
  ['-y', '-framerate', '7', '-i', join(frames, 'f-%03d.png'),
   '-vf', 'scale=880:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
   '-loop', '0', join(out, 'web-delete.gif')],
  { stdio: 'inherit' },
)
rmSync(frames, { recursive: true, force: true })
console.log('done')
