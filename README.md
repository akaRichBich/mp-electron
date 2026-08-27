# mp-electron

A macOS disk-cleanup demo built to make one point: **one domain core, three
platform ports** - and the third port is what makes an agent's code safe to
generate.

## One core, three platform ports

`packages/core` holds the whole domain: the rule contract, the scan engine, the
safety allowlist. It has no idea where it runs. Every filesystem call goes
through one interface, `FsPort`:

| port | package | shell | delete | scan without picker | background |
|---|---|---|---|---|---|
| `FakeFsPort` | `@mp/core` | tests, evals | yes (in memory) | yes | yes |
| `NodeFsPort` | `@mp/port-node` | Electron | yes | yes | yes |
| `FsaaFsPort` | `@mp/port-fsaa` | PWA | **no** | **no** | **no** |

The UI branches on `port.capabilities`, never on `isElectron`. A shell
difference is data, not a code path.

`pnpm check:arch` fails the build if anything in `core` imports `node:*`,
`electron`, or touches a DOM global. That guard is why the same core can be
compiled into both shells at all.

## PWA and desktop: what differs, and why

The web build is a real product surface, not a demo of the desktop one. The
user picks a folder, gets a report, and cannot delete anything - so the port
serves one mount and rules outside it are reported as *skipped, with a reason*,
which the engine treats as a normal outcome rather than a failure.

The desktop build gets what a browser cannot give: the whole home directory
with no picker, background scanning from the tray, and real deletion.

One honesty note: `canDelete: false` on the web port is a product decision, not
an API limit. The File System Access API can remove entries with a readwrite
grant. Turning it on is a deliberate edit to that file.

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

## Status

Core, all three ports, and the harness are done and green
(`pnpm install && pnpm gates`). The two shells - `apps/web` (PWA) and
`apps/desktop` (Electron) - are next. That order is the point: build a shell
first and platform code leaks into the domain.
