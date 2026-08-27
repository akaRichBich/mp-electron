import { defineRule } from '../rule/schema'

/**
 * The one place v0.0.1 will actually delete. `pnpm demo:sandbox` creates it.
 * See `deletionVerdict` for why everything else is fenced off.
 */
export const sandbox = defineRule({
  id: 'sandbox',
  title: 'Reclaim sandbox',
  category: 'demo',
  safety: 'safe',
  explain:
    'A folder this demo makes for itself, holding nothing of yours. The only thing v0.0.1 removes.',
  // Two homes on purpose: the desktop app reaches the first, and the second is
  // outside ~/Library, which is the only kind of folder a browser may open.
  matchers: [
    { kind: 'dir', path: '~/Library/Caches/ReclaimSandbox' },
    { kind: 'dir', path: '~/.cache/ReclaimSandbox' },
  ],
})
