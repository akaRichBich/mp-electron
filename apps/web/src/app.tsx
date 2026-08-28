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
import {
  ConfirmDialog,
  Findings,
  Notice,
  Rail,
  Readout,
  Receipt,
  SafetySummary,
  Skipped,
  type Freed,
} from '@mp/ui'
import { MOUNTS, pickMount, pickerSupported, type Mount } from './platform'
import { DEMO_MOUNT, demoSupported, openDemoSandbox } from './demo-fs'
import type { FsaaFsPort } from '@mp/port-fsaa'
import { loadReports, saveReport } from './history'
import { RequestForm } from './request/RequestForm'

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
  label: 'Simulated disk',
  path: DEMO_MOUNT,
  expect: 'Caches',
  hint: 'a tree in browser storage - none of your folders',
  simulated: true,
}

interface NoticeState {
  title: string
  detail: string
  tone: 'warn' | 'error' | 'plain'
}

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [installer, setInstaller] = useState<Event | null>(null)
  // Hash routing, so the form is a link someone can be sent.
  const [route, setRoute] = useState(() => window.location.hash)
  const [notice, setNotice] = useState<NoticeState | null>(null)
  const [pending, setPending] = useState<Finding | null>(null)
  const [receipt, setReceipt] = useState<{ finding: Finding; session: Freed } | null>(null)
  const [freed, setFreed] = useState<Freed>({ items: 0, files: 0, bytes: 0 })
  const [granted, setGranted] = useState(false)
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
    const onHash = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
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
    const outcome = await pickMount(mount)
    if (outcome.kind === 'cancelled') return
    if (outcome.kind === 'failed') {
      setNotice({
        title: `The browser would not open ${mount.path}`,
        detail: mount.blockedByBrowser
          ? `Chromium blocks ~/Library and everything under it for this API, whatever you pick in the dialog, so this folder is out of reach from a tab. It is exactly what the desktop app is for. The browser said: ${outcome.message}`
          : outcome.message,
        tone: 'error',
      })
      return
    }
    port.current = outcome.picked.port
    setNotice(null)
    setPending(null)
    await scanWith(outcome.picked.port, mount, { mismatch: outcome.picked.mismatch })
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
    setReceipt(null)
    setPending(finding)
  }

  async function confirmDelete(finding: Finding) {
    const subject = port.current
    if (!subject || phase.kind !== 'report') return
    setBusy(true)
    try {
      const writable = await subject.requestWriteAccess()
      setGranted(writable)
      if (!writable) {
        setPending(null)
        setNotice({
          title: 'Write access was not granted',
          detail:
            'The folder was opened for reading. Removing needs readwrite on the same folder, which only you can grant.',
          tone: 'warn',
        })
        return
      }

      try {
        await subject.remove(finding.path)
      } catch (error) {
        setPending(null)
        setNotice({
          title: 'It could not be removed',
          detail: `The browser refused: ${error instanceof Error ? error.message : String(error)}`,
          tone: 'error',
        })
        return
      }

      // Trust the report, not the call: `removeEntry` resolving is not the
      // same as the folder being gone.
      if (await subject.stat(finding.path)) {
        setPending(null)
        setNotice({
          title: 'It is still there',
          detail: `The removal reported success but ${finding.path} still exists. Nothing was lost - but do not trust this build to have cleaned it.`,
          tone: 'error',
        })
        return
      }

      const session: Freed = {
        items: freed.items + 1,
        files: freed.files + finding.entries,
        bytes: freed.bytes + finding.bytes,
      }
      setFreed(session)
      setPending(null)
      setReceipt({ finding, session })
      await scanWith(subject, phase.mount, { persist: phase.mount.id !== 'demo' })
    } finally {
      setBusy(false)
    }
  }

  if (route === '#request') {
    return (
      <div className="frame frame-single">
        <RequestForm onBack={() => (window.location.hash = '')} />
      </div>
    )
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
                  {mount.blockedByBrowser && (
                    <small className="blocked">browsers refuse this folder &mdash; desktop only</small>
                  )}
                </button>
              ))}
            </div>

          </>
        )}

        {notice && phase.kind !== 'report' && (
          <div style={{ marginTop: '1.5rem' }}>
            <Notice
              title={notice.title}
              detail={notice.detail}
              tone={notice.tone}
              onDismiss={() => setNotice(null)}
            />
          </div>
        )}

        <p className="demo-entry">
          <a className="button" data-variant="quiet" href="#request">
            request a cleanup rule
          </a>
          <span className="ghost">
            the one thing someone who writes no code can add - a schema, not a prompt
          </span>
        </p>

        {demoSupported() && (
          <p className="demo-entry">
            <button className="button" data-variant="quiet" onClick={() => void runDemo()}>
              or try it on a simulated disk
            </button>
            <span className="ghost">
              a tree in this browser's own storage - no folder access, nothing of yours read or
              removed
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

                {phase.mount.simulated && (
                  <div className="panel" data-tone="warn" style={{ marginBottom: '2rem' }}>
                    <h3>Simulated disk - your files are not involved</h3>
                    <p>
                      This tree lives in this browser's own storage. The paths below are written to
                      look real so that the real rules match them, but nothing here is read from or
                      written to your disk. Removing <code>~/Library/Caches/ReclaimSandbox</code>{' '}
                      here does not touch the folder of that name on your Mac - for that, pick{' '}
                      <b>Caches</b> above.
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
                      scanned={
                        phase.mount.simulated
                          ? `${phase.mount.path} (simulated)`
                          : phase.mount.path
                      }
                    />
                    <SafetySummary findings={phase.report.findings} />

                    {receipt && (
                      <div style={{ margin: '1.5rem 0' }}>
                        <Receipt
                          what={receipt.finding.title}
                          where={
                            phase.mount.simulated
                              ? `${receipt.finding.path} (simulated)`
                              : receipt.finding.path
                          }
                          files={receipt.finding.entries}
                          bytes={receipt.finding.bytes}
                          session={receipt.session}
                          onDismiss={() => setReceipt(null)}
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

      <ConfirmDialog
        open={pending !== null}
        title={pending ? `Remove ${pending.title}?` : ''}
        lines={
          pending
            ? [
                { label: 'size', value: formatBytes(pending.bytes) },
                { label: 'files', value: String(pending.entries) },
                {
                  label: 'path',
                  value:
                    phase.kind === 'report' && phase.mount.simulated
                      ? `${pending.path} (simulated)`
                      : pending.path,
                },
              ]
            : []
        }
        confirmLabel={
          phase.kind === 'report' && phase.mount.simulated ? 'delete from the simulation' : 'delete permanently'
        }
        busy={busy}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && void confirmDelete(pending)}
        footnote={
          phase.kind === 'report' && phase.mount.simulated
            ? 'This is the simulated tree in browser storage. Nothing on your disk changes.'
            : granted
              ? 'This deletes from disk and cannot be undone.'
              : 'This deletes from disk and cannot be undone. The browser will ask you to allow editing this folder next - that prompt is Chrome\u2019s own, and a page cannot replace it.'
        }
      />
    </div>
  )
}
