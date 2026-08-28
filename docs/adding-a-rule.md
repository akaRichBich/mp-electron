# Adding a cleanup rule without writing code

For QA and product. The engineer-facing version is `recipes/add-rule.md`.

## What you can request

One kind of thing: a rule that finds a folder worth cleaning up. Not a screen,
not a setting, not a change to how scanning works.

Every path is checked against the allowlist *before* anything is generated:

| path | verdict |
|---|---|
| `~/Library/Caches/go-build` | allowed |
| `~/.npm/_cacache` | allowed |
| `~/.cache/yarn` | allowed |
| `~/Library/pnpm/store` | refused - outside every allowed prefix |
| `~/go/pkg/mod` | refused - holds source some builds depend on |
| `~/Projects/app/node_modules` | refused - somebody's working directory |

Widening the fence is an engineering decision, deliberately: see
`ALLOWED_PREFIXES` in `packages/core/src/safety/allowlist.ts`.

## Fill in the form

<https://akarichbich.github.io/mp-electron/#request> - it validates as you type
and exports a spec file. Or write the JSON by hand: see
`packages/harness/examples/go-build.spec.json` for a complete one and
`packages/harness/src/spec/rule-spec.ts` for the schema.

| field | notes |
|---|---|
| `what` | how a user would say it; becomes the title and the id |
| `paths` | one or more, each checked against the allowlist |
| `match` | `whole-folder`, or `by-pattern` with a `pattern` |
| `safety` | `safe` or `review`. `dangerous` needs an engineer |
| `explain` | shown to the user word for word: what is lost, how it comes back |
| `minAgeDays` | optional; skip anything touched more recently |
| `fixture.files` | sample files with sizes. Without them it cannot be verified, so it cannot be submitted |
| `requestedBy` | so the PR says whose idea it was |

```bash
pnpm rule:new packages/harness/examples/go-build.spec.json
```

That writes the fixture, an eval case that runs on every commit from now on,
and a deterministic prompt. A refused spec writes nothing and explains why.

## What happens next

**Submit** opens GitHub's editor with the spec file already written; committing
it there creates the branch and the pull request, as you. A workflow then
writes the fixture and the eval case onto that branch and comments with what
the evals say - red at first, because the rule does not exist yet.

An engineer labels the pull request `generate`, and an agent writes the rule in
CI, following `recipes/add-rule.md`. Whatever it touched outside the four files
your request may change is reverted before anything is pushed, and named in the
comment. Then `pnpm gates` runs, cheapest first: `typecheck`, `check:arch`, `test`, `eval`,
and a build of both shells. Your rule's own eval checks four things:

- `schema_valid` - matches the contract, allowlist included
- `registered_in` - actually wired up, not silently inert
- `runs_against` - finds something in your sample data, and nothing under
  `~/Documents` or `~/Desktop`
- `no_platform_imports` - did not reach for the filesystem directly

You review the rule's report against its sample data, not a diff. An engineer
merges; the review is short because everything machine-checkable is green and
only judgment is left.

## What still needs an engineer

- a path outside the allowlist
- a `dangerous` rule
- anything wanting a new dependency
- turning on real deletion (`DELETABLE_RULES` in
  `packages/core/src/safety/deletion-policy.ts`)

## Honest status

All of the above runs today; [PR #5](https://github.com/akaRichBich/mp-electron/pull/5)
is one clean pass through it. What is not built: a preview deployment of your
change, so you can see the rule in the app before it is merged. Submission also
finishes in GitHub's own editor rather than through a direct API integration,
which means you need a GitHub account to file the request.
