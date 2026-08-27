# Working in this repo

## The one architectural rule

`packages/core` knows nothing about the platform it runs on. It never imports
`node:*`, `electron`, or touches `window`/`document`/`process`. Every
filesystem call goes through `FsPort` (`packages/core/src/ports/fs-port.ts`),
which has three implementations:

| port | package | used by | can delete |
|---|---|---|---|
| `FakeFsPort` | `@mp/core` | tests, evals, CI | yes (in memory) |
| `NodeFsPort` | `@mp/port-node` | Electron shell | yes |
| `FsaaFsPort` | `@mp/port-fsaa` | PWA | no, by product decision |

`packages/ui` is held to a weaker version of the same rule: DOM is its job,
node and electron are not. `pnpm check:arch` enforces both. If you need
something the port does not expose, widen `FsPort` and implement it in all
three - do not reach around it.

Differences between shells are expressed as `port.capabilities`, never as
`if (isElectron)`. The capability values live in one table,
`SHELL_CAPABILITIES` in core, which both the ports and the UI read.

## The shells

`apps/web` runs the scan in the tab. `apps/desktop` runs it in the Electron
main process and sends the renderer a finished `ScanReport` - the renderer has
no fs, no rules, and no core logic beyond types. Both render the same
`packages/ui`.

The desktop app deletes for real. Point it at a throwaway tree while working on
it, never at your own home:

```
pnpm demo:home
RECLAIM_HOME="$PWD/.demo-home" pnpm dev:desktop
```

Paths arriving from the renderer are re-checked in main (`partitionRemovable`):
a path must appear in the report main itself produced *and* still pass the
allowlist. Never relax that to make a UI change easier.

## Adding a rule

Follow `recipes/add-rule.md`. Do not invent a second way to do it.

Files a rule may touch, and no others:

```
packages/core/src/rules/<id>.ts
packages/core/src/rules/index.ts        (registration line only)
packages/harness/src/eval/cases/<id>.json
packages/harness/fixtures/<id>.json
```

A rule never needs a new dependency. If you think it does, stop and say so.

## Gates

`pnpm gates` runs all of them: `typecheck`, `check:arch`, `test`, `eval`,
and a build of both shells.
Everything must be green before you report the work as done. If a gate fails
three times, stop and hand back with the failing output - do not keep patching.

## Determinism

Scans take `now` as an option and fixtures carry `ageDays`, so an eval run is
byte-for-byte reproducible. Never call `Date.now()` inside a rule.
