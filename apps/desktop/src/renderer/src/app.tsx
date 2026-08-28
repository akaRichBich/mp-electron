import { useEffect, useState } from 'react'
import {
  SHELL_CAPABILITIES,
  deletableFindings,
  deletionVerdict,
  formatBytes,
  type Finding,
  type ScanReport,
} from '@mp/core'
import { Findings, Notice, Rail, Readout, Receipt, SafetySummary, Skipped, type Freed } from '@mp/ui'
import type { DesktopApi, ScanProgress } from '../../shared/ipc'

declare global {
  interface Window {
    reclaim: DesktopApi
  }
}

const api = window.reclaim

export function App() {
  const [report, setReport] = useState<ScanReport | null>(null)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<
    { kind: 'removed'; what: string; where: string; files: number; bytes: number; session: Freed }
    | { kind: 'refused'; text: string }
    | null
  >(null)
  const [freed, setFreed] = useState<Freed>({ items: 0, files: 0, bytes: 0 })
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null)

  useEffect(() => {
    const offProgress = api.onProgress(setProgress)
    const offReport = api.onReport((incoming) => {
      setReport(incoming)
      setProgress(null)
    })
    const offCancelled = api.onCancelled(() => setProgress(null))
    // The startup scan may well have finished before this mounted.
    void api.last().then((existing) => existing && setReport((current) => current ?? existing))
    return () => {
      offProgress()
      offReport()
      offCancelled()
    }
  }, [])

  async function rescan() {
    setReceipt(null)
    setProgress({ done: 0, total: 0, ruleId: '' })
    setReport(await api.scan())
    setProgress(null)
  }

  async function remove(paths: string[]) {
    setBusy(true)
    try {
      const result = await api.remove(paths)
      if (result.report) setReport(result.report)

      if (result.removed > 0) {
        const session: Freed = {
          items: freed.items + result.removed,
          files: freed.files + result.files,
          bytes: freed.bytes + result.bytes,
        }
        setFreed(session)
        setReceipt({
          kind: 'removed',
          what: `${result.removed} location${result.removed === 1 ? '' : 's'}`,
          where: paths.length === 1 ? paths[0]! : `${paths.length} paths`,
          files: result.files,
          bytes: result.bytes,
          session,
        })
      } else if (result.refused.length > 0) {
        setReceipt({
          kind: 'refused',
          text: `main refused ${result.refused.length} path(s): not in its own report, outside the allowlist, or not something this build deletes`,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  // Only what main would actually accept, so the button never promises more
  // than the policy allows.
  const removable = deletableFindings(report?.findings ?? [])
  const removableBytes = removable.reduce((sum, finding) => sum + finding.bytes, 0)

  function attemptDelete(finding: Finding) {
    const verdict = deletionVerdict(finding)
    if (!verdict.allowed) {
      setNotice({ title: verdict.title, detail: verdict.detail })
      return
    }
    void remove([finding.path])
  }
  const scanning = progress !== null

  return (
    <div className="frame" data-shell="desktop">
      <header className="titlebar">reclaim</header>

      <Rail
        badge="desktop"
        portId="node"
        portLabel="node:fs, main process"
        columns={[
          { label: 'web', capabilities: SHELL_CAPABILITIES.web },
          { label: 'app', capabilities: SHELL_CAPABILITIES.desktop },
        ]}
        active={1}
      >
        The renderer has no <b>fs</b> and no rules. It receives a <b>ScanReport</b> over IPC and
        renders it with the same <b>@mp/ui</b> the web preview uses.
      </Rail>

      <main className="main">
        {api.boot.demo && api.boot.homeExists && (
          <div className="demo-banner">
            demo home · RECLAIM_HOME={api.boot.home} · nothing outside this directory is touched
          </div>
        )}

        {!api.boot.homeExists && (
          <div className="panel" data-tone="error" style={{ marginBottom: '1.5rem' }}>
            <h3>RECLAIM_HOME does not exist</h3>
            <p>
              It resolved to <code>{api.boot.home}</code>. A relative path is resolved against
              Electron's working directory (<code>apps/desktop</code>), not the shell you typed it
              in - pass an absolute one. Run <code>pnpm demo:home</code> and use the path it prints.
            </p>
          </div>
        )}

        <span className="eyebrow">full disk access</span>

        <h1 className="title">
          The whole home directory.
          <br />
          <b>Scanned before you asked.</b>
        </h1>

        <p className="lede">
          The same rules as the web preview, running in the main process over <code>node:fs</code>.
          No folder picker, no tab that has to stay open. Removal is real, and v0.0.1 fences it to
          the sandbox folder so a demo cannot take anything you wanted.
        </p>

        <hr className="rule" />

        <div className="actions">
          {scanning ? (
            <button className="button" data-variant="danger" onClick={() => void api.cancel()}>
              stop scanning
            </button>
          ) : (
            <button
              className="button"
              onClick={() => void rescan()}
              disabled={busy || !api.boot.homeExists}
            >
              {report ? 'scan again' : 'scan now'}
            </button>
          )}
          <span className="ghost">
            {scanning && progress
              ? `rule ${progress.done + 1}/${progress.total}${progress.ruleId ? ` · ${progress.ruleId}` : ''}`
              : api.boot.home}
          </span>
        </div>

        {scanning && <div className="sweep" />}

        {report && !scanning && (
          <section style={{ marginTop: '2.75rem' }}>
            {report.findings.length === 0 ? (
              <div className="panel">
                <h3>Nothing to reclaim</h3>
                <p>
                  No rule matched anything under <code>{api.boot.home}</code>. The rules that found
                  nothing are listed below with the reason.
                </p>
              </div>
            ) : (
              <>
                <Readout
                  bytes={report.totalBytes}
                  locations={report.findings.length}
                  scanned={api.boot.home}
                  action={
                    removable.length > 0 && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => void remove(removable.map((finding) => finding.path))}
                      >
                        reclaim {removable.length} · {formatBytes(removableBytes)}
                      </button>
                    )
                  }
                />
                <SafetySummary findings={report.findings} />
                <Findings
                  findings={report.findings}
                  renderAction={(finding: Finding) => (
                    <>
                      {/* Offered for every `safe` finding; the ones this build
                          will not touch answer with a reason instead. */}
                      {finding.safety === 'safe' && (
                        <>
                          <button
                            className="button"
                            data-variant="quiet"
                            disabled={busy}
                            onClick={() => attemptDelete(finding)}
                          >
                            remove
                          </button>{' '}
                        </>
                      )}
                      <button
                        className="button"
                        data-variant="quiet"
                        onClick={() => void api.reveal(finding.path)}
                      >
                        reveal
                      </button>
                    </>
                  )}
                />
              </>
            )}

            {notice && (
              <div style={{ marginTop: '2rem' }}>
                <Notice
                  title={notice.title}
                  detail={notice.detail}
                  tone="plain"
                  onDismiss={() => setNotice(null)}
                />
              </div>
            )}

            {receipt?.kind === 'removed' && (
              <div style={{ marginTop: '1.75rem' }}>
                <Receipt
                  what={receipt.what}
                  where={receipt.where}
                  files={receipt.files}
                  bytes={receipt.bytes}
                  session={receipt.session}
                  onDismiss={() => setReceipt(null)}
                />
              </div>
            )}

            {receipt?.kind === 'refused' && (
              <p className="receipt" data-tone="refused">
                {receipt.text}
              </p>
            )}

            <Skipped skipped={report.skipped} />
          </section>
        )}
      </main>
    </div>
  )
}
