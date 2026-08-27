import { useEffect, useRef, useState } from 'react'
import {
  SHELL_CAPABILITIES,
  allRules,
  deletionVerdict,
  formatBytes,
  scan,
  type Finding,
  type ScanReport,
} from '@mp/core'
import { Findings, Notice, Rail, Readout, SafetySummary, Skipped } from '@mp/ui'
import { MOUNTS, pickMount, pickerSupported, type Mount } from './platform'
import { DEMO_MOUNT, demoSupported, openDemoSandbox } from './demo-fs'
import type { FsaaFsPort } from '@mp/port-fsaa'
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

const DEMO_MOUNT_ENTRY: Mount = {
  id: 'demo',
  label: 'Built-in sandbox',
  path: DEMO_MOUNT,
  expect: 'Caches',
  hint: 'a tree in browser storage - none of your folders',
}

interface NoticeState {
  title: string
  detail: string
  tone: 'warn' | 'error' | 'plain'
}

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [installer, setInstaller] = useState<Event | null>(null)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [pending, setPending] = useState<Finding | null>(null)
  const [busy, setBusy] = useState(false)
  // Kept so a removal can reuse the folder the user already granted.
  const port = useRef<FsaaFsPort | null>(null)

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

  async function scanWith(
    subject: FsaaFsPort,
    mount: Mount,
    options: { mismatch?: boolean; persist?: boolean } = {},
  ) {
    setPhase({ kind: 'scanning', mount, done: 0, total: allRules().length, ruleId: '' })

    const report = await scan(subject, allRules(), {
      onProgress: ({ done, total, ruleId }) =>
        setPhase((current) =>
          current.kind === 'scanning' ? { ...current, done, total, ruleId } : current,
        ),
    })

    if (options.persist !== false) void saveReport(mount.id, report)
    setPhase({
      kind: 'report',
      mount,
      report,
      at: Date.now(),
      mismatch: options.mismatch ?? false,
      cached: false,
    })
  }

  async function run(mount: Mount) {
    const chosen = await pickMount(mount)
    if (!chosen) return
    port.current = chosen.port
    setNotice(null)
    setPending(null)
    await scanWith(chosen.port, mount, { mismatch: chosen.mismatch })
  }

  /** No picker, no permission, no folders of yours: a tree in OPFS. */
  async function runDemo() {
    setNotice(null)
    setPending(null)
    const subject = await openDemoSandbox({ reset: true })
    port.current = subject
    await scanWith(subject, DEMO_MOUNT_ENTRY, { persist: false })
  }

  /**
   * The whole removal path runs here in the tab: policy, permission grant,
   * confirm, `removeEntry`, rescan. There is no second process to re-check it
   * in - the web shell *is* the renderer - so the policy is the fence.
   */
  function attemptDelete(finding: Finding) {
    const verdict = deletionVerdict(finding)
    if (!verdict.allowed) {
      setNotice({ title: verdict.title, detail: verdict.detail, tone: 'plain' })
      return
    }

    if (phase.kind !== 'report') return

    if (!port.current) {
      // A report restored from IndexedDB has no folder handle behind it: the
      // browser does not hand those back across a reload.
      setNotice({
        title: 'This report came from storage',
        detail:
          'It was kept on this device so an offline launch has something to show, but the browser does not restore the folder handle with it. Scan the folder again and the button will work.',
        tone: 'warn',
      })
      return
    }

    setNotice(null)
    setPending(finding)
  }

  async function confirmDelete(finding: Finding) {
    const subject = port.current
    if (!subject || phase.kind !== 'report') return
    setBusy(true)
    try {
      if (!(await subject.requestWriteAccess())) {
        setPending(null)
        setNotice({
          title: 'Write access was not granted',
          detail:
            'The folder was opened for reading. Removing needs readwrite on the same folder, which only you can grant.',
          tone: 'warn',
        })
        return
      }

      await subject.remove(finding.path)
      setPending(null)
      setNotice({
        title: `Removed ${finding.title}`,
        detail: `${formatBytes(finding.bytes)} freed from ${finding.path}.`,
        tone: 'plain',
      })
      await scanWith(subject, phase.mount, { persist: phase.mount.id !== 'demo' })
    } finally {
      setBusy(false)
    }
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
          against that folder. Removal is wired up and real, but v0.0.1 fences it to a sandbox
          folder - a demo has no business deleting your caches.
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

        {!supported && (
          <div className="panel" data-tone="warn" style={{ marginBottom: '1.5rem' }}>
            <h3>This browser cannot open your folders</h3>
            <p>
              Reading a chosen folder needs <code>showDirectoryPicker()</code>, which today means a
              Chromium browser on the desktop. The engine itself runs anywhere - it is the port
              underneath that cannot. The built-in sandbox below works here regardless.
            </p>
          </div>
        )}

        {supported && (
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

          </>
        )}

        {demoSupported() && (
          <p className="demo-entry">
            <button className="button" data-variant="quiet" onClick={() => void runDemo()}>
              or try a built-in sandbox
            </button>
            <span className="ghost">
              a tree in this browser's own storage - no folder access, and the sandbox row really
              deletes
            </span>
          </p>
        )}

        <>
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
                    <SafetySummary findings={phase.report.findings} />

                    {pending && (
                      <div style={{ margin: '1.5rem 0' }}>
                        <Notice
                          tone="warn"
                          title={`Remove ${pending.title}?`}
                          detail={`${formatBytes(pending.bytes)} across ${pending.entries} file(s) at ${pending.path}. This deletes from disk and cannot be undone.`}
                          onDismiss={() => setPending(null)}
                          actions={
                            <button
                              className="button"
                              disabled={busy}
                              onClick={() => void confirmDelete(pending)}
                            >
                              remove for real
                            </button>
                          }
                        />
                      </div>
                    )}

                    {notice && (
                      <div style={{ margin: '1.5rem 0' }}>
                        <Notice
                          title={notice.title}
                          detail={notice.detail}
                          tone={notice.tone}
                          onDismiss={() => setNotice(null)}
                        />
                      </div>
                    )}

                    <Findings
                      findings={phase.report.findings}
                      renderAction={(finding) =>
                        finding.safety === 'safe' ? (
                          <button
                            className="button"
                            data-variant="quiet"
                            disabled={busy}
                            onClick={() => attemptDelete(finding)}
                          >
                            delete
                          </button>
                        ) : null
                      }
                    />
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
      </main>
    </div>
  )
}
