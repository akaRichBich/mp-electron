import { useEffect, useState } from 'react'
import { SHELL_CAPABILITIES, formatBytes, type Finding, type ScanReport } from '@mp/core'
import { Findings, Rail, Readout, Skipped } from '@mp/ui'
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
  const [receipt, setReceipt] = useState<{ text: string; tone: 'ok' | 'refused' } | null>(null)

  useEffect(() => {
    const offProgress = api.onProgress(setProgress)
    const offReport = api.onReport((incoming) => {
      setReport(incoming)
      setProgress(null)
    })
    // The startup scan may well have finished before this mounted.
    void api.last().then((existing) => existing && setReport((current) => current ?? existing))
    return () => {
      offProgress()
      offReport()
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
      if (result.refused.length > 0) {
        setReceipt({
          text: `main refused ${result.refused.length} path(s): not in its own report, or outside the allowlist`,
          tone: 'refused',
        })
      } else if (result.removed > 0) {
        setReceipt({
          text: `removed ${result.removed} location(s), ${formatBytes(result.bytes)} reclaimed`,
          tone: 'ok',
        })
      }
    } finally {
      setBusy(false)
    }
  }

  const safe = report?.findings.filter((finding) => finding.safety === 'safe') ?? []
  const safeBytes = safe.reduce((sum, finding) => sum + finding.bytes, 0)
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
          No folder picker, no tab that has to stay open - and here they can also delete.
        </p>

        <hr className="rule" />

        <div className="actions">
          <button
            className="button"
            onClick={() => void rescan()}
            disabled={scanning || busy || !api.boot.homeExists}
          >
            {scanning ? 'scanning…' : report ? 'scan again' : 'scan now'}
          </button>
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
                    safe.length > 0 && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => void remove(safe.map((finding) => finding.path))}
                      >
                        reclaim {safe.length} safe · {formatBytes(safeBytes)}
                      </button>
                    )
                  }
                />
                <Findings
                  findings={report.findings}
                  renderAction={(finding: Finding) => (
                    <>
                      {/* `dangerous` is report-only. Main refuses it either way;
                          this just avoids offering a button that cannot work. */}
                      {finding.safety !== 'dangerous' && (
                        <>
                          <button
                            className="button"
                            data-variant="quiet"
                            disabled={busy}
                            onClick={() => void remove([finding.path])}
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

            {receipt && (
              <p className="receipt" data-tone={receipt.tone === 'refused' ? 'refused' : 'ok'}>
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
