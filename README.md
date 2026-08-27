# mp-electron

A macOS disk-cleanup demo built to make one point: **one domain core, three
platform ports, two shells** - and the third port is what makes an agent's code
safe to generate.

## One core, three platform ports

`packages/core` holds the whole domain: the rule contract, the scan engine, the
safety allowlist. It has no idea where it runs. Every filesystem call goes
through one interface, `FsPort`:

| port | package | shell | delete | scan without picker | background |
|---|---|---|---|---|---|
| `FakeFsPort` | `@mp/core` | tests, evals | yes (in memory) | yes | yes |
| `NodeFsPort` | `@mp/port-node` | Electron | yes | yes | yes |
| `FsaaFsPort` | `@mp/port-fsaa` | PWA | yes, after a grant | **no** | **no** |

The UI branches on `port.capabilities`, never on `isElectron`. A shell
difference is data, not a code path - and the values come from one table,
`SHELL_CAPABILITIES` in core, which the ports and the UI both read, so the
matrix a user sees cannot drift from what the port does.

`pnpm check:arch` fails the build if anything in `core` imports `node:*`,
`electron`, or touches a DOM global, and holds `packages/ui` to the same rule
minus the DOM. That guard is why the same core compiles into both shells.

Two boundaries, not one: `FsPort` bounds the **domain**, and `ScanReport` plus
`PortCapabilities` bounds the **UI**. The web shell happens to run both sides
in one process; the desktop shell puts a process boundary between them. Neither
the core nor the UI notices.

## PWA and desktop: what differs, and why

The web build is a real product surface, not a demo of the desktop one. The
user picks a folder and gets a report; rules outside that folder come back as
*skipped, with a reason*, which the engine treats as a normal outcome rather
than a failure.

It can delete, too. The picker asks for read only, and readwrite is requested
from the click that needs it - a scan never costs more permission than a scan
needs.

What the desktop build has that a browser cannot: the whole home directory with
no picker, background scanning from the tray, and a real trust boundary - the
renderer asks, and a separate process decides.

`apps/web` is that shell, built on the same core:

- the capability matrix in the rail is rendered from `port.capabilities`, so
  the three dark lamps in the `web` column are data, not a screenshot
- rules outside the picked folder appear under *not evaluated here* with the
  reason the engine gave
- a summary line says how many findings are `safe`, how many need a look, and
  how many this build will actually remove - the counts come from the report,
  never from a hand-written number
- `safe` rows carry a delete button; pressing one either removes for real or
  says why it will not
- the last report per mount is kept in IndexedDB, so an offline launch still
  shows something
- service worker and manifest via `vite-plugin-pwa`; it installs

All three ports are held to the same contract test: each one scans the same
fixture and must report the same findings. The web port's test drives a
hand-rolled `FileSystemDirectoryHandle`, since the real API needs an OS picker
dialog that no test runner can open.

`showDirectoryPicker()` is Chromium-only today, and the app says so plainly
instead of failing - Firefox and Safari get an explanation and the OPFS
sandbox, not a blank page.

## The harness: rules that cannot be written wrong

The fake port exists for the two shells - and it turned out to be the thing
that makes generated code verifiable. Evals run headless in CI, in
milliseconds, with no Mac and no disk, and they are deterministic: scans take
`now` as an option and fixtures carry `ageDays`.

Four gates, cheapest first (`pnpm gates`):

```
typecheck        types across all four packages
check:arch       core stays platform-free
test             unit + a cross-port contract test
eval             every rule, against fixtures that ship with the repo
```

Each rule is an eval case with four checks:

```
schema_valid          parses against RuleSchema, allowlist refinements included
registered_in         actually wired into rules/index.ts
runs_against          finds >= 1 thing in its fixture, and nothing under ~/Documents
no_platform_imports   the architecture guard, run per rule
```

## Rails: how QA and PM add a rule

The door is deliberately narrow. There is exactly one thing a non-engineer can
submit, and it is a form, not a prompt:

```bash
pnpm rule:new packages/harness/examples/pip-cache.spec.json
```

The spec (`packages/harness/src/spec/rule-spec.ts`) is validated *before*
anything is generated, and it writes three things: a fixture, an eval case, and
a deterministic prompt. Same spec in, same prompt out - so a bad result is a
bug in the recipe, never "the PM phrased it oddly".

The full path, written for the people who use it, is in
[docs/adding-a-rule.md](docs/adding-a-rule.md).

Four constraints are administrative, enforced by machine, not by review:

- **Path allowlist.** A spec pointing at `~/Documents` is rejected with a
  sentence, before generation. Try `examples/rejected.spec.json`.
- **No `dangerous` from a spec.** `RuleSchema` refuses `origin: 'spec'` with
  `safety: 'dangerous'`. The most likely way to hurt a user is closed off.
- **No new dependencies.** A CI step fails on any `package.json` change.
- **Bounded file scope.** The prompt names the four files that may change; the
  rest of the tree is not the agent's to touch.

What the requester sees at the end is not a diff:

```
Rule "Poetry cache" is ready.
Found 2 folders, 328 KB in the sample data.
Level: safe to delete.
```

Merge stays with an engineer - but review is a minute, because every machine
check is already green.

## The desktop shell

`apps/desktop` is the same core with the other port under it, and the split is
where Electron actually earns its keep:

- the scan runs in the **main process** over `node:fs`; the renderer receives a
  finished `ScanReport` over IPC and has no fs, no rules and no core logic
  beyond types
- a scan runs at launch, before anyone asks - the capability the browser cannot
  have - and reports through a native notification and the tray
- deletion is real, and every path the renderer asks for is re-checked in main:
  it must appear in the report main itself produced, still pass the allowlist,
  and not belong to a `dangerous` rule - then a native dialog asks the human.
  `partitionRemovable` is unit tested against tampered reports.

The three safety levels are the same in both shells: `safe` is offered for
removal, `review` is listed but never removed for you, and `dangerous` is
report-only and refused by main.

Both shells render the same `packages/ui`. The only thing that differs is the
data: the capability matrix, the presence of a delete button, whether a folder
had to be picked.

## What v0.0.1 will actually delete

One folder, on purpose.

The delete path is real and completely wired in both shells - permission grant,
native confirm, the removal itself, the rescan afterwards. But a demo of an
architecture has no business emptying a stranger's Homebrew cache because a
rule was slightly wrong, so `deletionVerdict` in core fences removal to the
`sandbox` rule. Every other `safe` finding offers the button and then answers
with a reason.

```bash
pnpm demo:sandbox   # ~/Library/Caches/ReclaimSandbox, with a test.txt in it
```

Scan `~/Library/Caches`, press remove on **Reclaim sandbox**, and it goes for
real. Press it on anything else and the app tells you why it will not.

The web app also offers **a built-in sandbox** that needs no folder access at
all: a tree in the Origin Private File System, which every modern browser has.
The same `FsaaFsPort`, engine and rules run over it, so the whole path -
including a real deletion - can be watched in Firefox and Safari, where
`showDirectoryPicker()` does not exist.

Shipping for real means adding the other `safe` rules to one list in
`packages/core/src/safety/deletion-policy.ts`. Nothing else in the codebase
changes - and on the desktop side `partitionRemovable` enforces the same policy
in the main process, because the renderer is not trusted to enforce it.

## Running it

```bash
pnpm install
pnpm gates        # typecheck, arch guard, tests, evals, both shell builds
pnpm dev:web
```

The desktop app deletes files for real, so point it at a throwaway tree:

```bash
pnpm demo:home
RECLAIM_HOME="$PWD/.demo-home" pnpm dev:desktop
```

`RECLAIM_HOME` must be absolute - Electron's working directory is
`apps/desktop`, not the shell you typed it in. A relative path used to produce
an empty report that looked exactly like a clean disk; now the app resolves it
and says so on screen.

To see what the rules would report without any UI at all:

```bash
pnpm dry-run                        # every rule, this machine, read-only
pnpm dry-run --rule stale-app-logs
```

## Status

Core, all three ports, the harness, and both shells are done and green.
Building the desktop shell needed no change to the core and no new rule - only
the `NodeFsPort` that already existed and already passed a contract test
against the fake port.

That build order was the point: start with a shell and platform code leaks into
the domain.

Not done, and deliberately: packaging and code signing. `electron-builder`,
notarisation and an update channel are real work that would say nothing new
about the architecture.
