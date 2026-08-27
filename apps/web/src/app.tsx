import { useEffect, useState } from 'react'
import { SHELL_CAPABILITIES, allRules, scan, type ScanReport } from '@mp/core'
import { Findings, Rail, Readout, Skipped } from '@mp/ui'
import { MOUNTS, pickMount, pickerSupported, type Mount } from './platform'
import { loadReports, saveReport } from './history'

type Phase =
  | { kind: 'idle' }
  | { kind: 'scanning'; mount: Mount; done: number; total: number; ruleId: string }
  | {
      kind: 'report'
      mount: Mount
      report: ScanReport
      at: number
      mismatch: boolean
      cached: boolean
    }

const supported = pickerSupported()

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [installer, setInstaller] = useState<Event | null>(null)

  // An offline launch still has something to show: the last report per mount.
  useEffect(() => {
    void loadReports().then((stored) => {
      const latest = stored[0]
      const mount = latest && MOUNTS.find((m) => m.id === latest.mountId)
      if (latest && mount) {
        setPhase((current) =>
          current.kind === 'idle'
            ? { kind: 'report', mount, report: latest.report, at: latest.at, mismatch: false, cached: true }
            : current,
        )
      }
    })
  }, [])

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setInstaller(event)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function run(mount: Mount) {
    const picked = await pickMount(mount)
    if (!picked) return

    setPhase({ kind: 'scanning', mount, done: 0, total: allRules().length, ruleId: '' })

    const report = await scan(picked.port, allRules(), {
      onProgress: ({ done, total, ruleId }) =>
        setPhase((current) =>
          current.kind === 'scanning' ? { ...current, done, total, ruleId } : current,
        ),
    })

    void saveReport(mount.id, report)
    setPhase({ kind: 'report', mount, report, at: Date.now(), mismatch: picked.mismatch, cached: false })
  }

  return (
    <div className="frame">
      <Rail
        badge="web preview"
        portId="fsaa"
        portLabel="File System Access API"
        columns={[
          { label: 'web', capabilities: SHELL_CAPABILITIES.web },
          { label: 'app', capabilities: SHELL_CAPABILITIES.desktop },
        ]}
        active={0}
      >
        The UI reads <b>port.capabilities</b>, never <b>isElectron</b>. Both shells import the same{' '}
        <b>@mp/core</b>; only the port under it changes.
      </Rail>

      <main className="main">
        <span className="eyebrow">read-only preview</span>

        <h1 className="title">
          See what your Mac is holding on to.
          <br />
          <b>Without installing anything.</b>
        </h1>

        <p className="lede">
          Pick a folder and the same rules that ship in the desktop app run right here, in the tab,
          against that folder. Nothing is removed - this port has no delete, by design.
        </p>

        {installer && (
          <p style={{ marginTop: '1.4rem' }}>
            <button
              className="linkish"
              onClick={() => {
                void (installer as Event & { prompt?: () => void }).prompt?.()
                setInstaller(null)
              }}
            >
              install as an app
            </button>
          </p>
        )}

        <hr className="rule" />

        {!supported ? (
          <div className="panel" data-tone="warn">
            <h3>This browser has no File System Access API</h3>
            <p>
              Reading a chosen folder needs <code>showDirectoryPicker()</code>, which today means a
              Chromium browser on the desktop. Firefox and Safari have not shipped it. The engine
              itself runs anywhere - it is the port underneath that cannot.
            </p>
          </div>
        ) : (
          <>
            <div className="mounts">
              {MOUNTS.map((mount) => (
                <button
                  className="mount"
                  key={mount.id}
                  onClick={() => void run(mount)}
                  disabled={phase.kind === 'scanning'}
                >
                  <b>{mount.label}</b>
                  <code>{mount.path}</code>
                  <small>{mount.hint}</small>
                </button>
              ))}
            </div>

            {phase.kind === 'scanning' && (
              <section style={{ marginTop: '2.5rem' }}>
                <div className="sweep" />
                <div className="ghost">
                  scanning {phase.mount.path} · rule {phase.done + 1}/{phase.total}
                  {phase.ruleId && ` · ${phase.ruleId}`}
                </div>
              </section>
            )}

            {phase.kind === 'report' && (
              <section style={{ marginTop: '2.75rem' }}>
                {phase.cached && (
                  <p className="ghost" style={{ marginBottom: '1.5rem' }}>
                    last report for {phase.mount.path}, kept on this device ·{' '}
                    {new Date(phase.at).toLocaleString()}
                  </p>
                )}

                {phase.mismatch && (
                  <div className="panel" data-tone="warn" style={{ marginBottom: '2rem' }}>
                    <h3>That folder does not look like {phase.mount.expect}</h3>
                    <p>
                      The report below still describes what was actually read, but the rules were
                      written for <code>{phase.mount.path}</code>, so they may find nothing.
                    </p>
                  </div>
                )}

                {phase.report.findings.length === 0 ? (
                  <div className="panel">
                    <h3>Nothing to reclaim here</h3>
                    <p>
                      No rule matched anything in <code>{phase.mount.path}</code>. That is a real
                      result, not an error - the rules that were not applicable are listed below.
                    </p>
                  </div>
                ) : (
                  <>
                    <Readout
                      bytes={phase.report.totalBytes}
                      locations={phase.report.findings.length}
                      scanned={phase.mount.path}
                    />
                    <Findings findings={phase.report.findings} />
                  </>
                )}

                <Skipped skipped={phase.report.skipped} />

                <p style={{ marginTop: '2.5rem' }}>
                  <button className="linkish" onClick={() => setPhase({ kind: 'idle' })}>
                    scan a different folder
                  </button>
                </p>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
