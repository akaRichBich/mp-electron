import { defineRule } from '../rule/schema'

export const homebrewCache = defineRule({
  id: 'homebrew-cache',
  title: 'Homebrew downloads',
  category: 'package-manager',
  safety: 'safe',
  explain: 'Installer archives Homebrew already unpacked. They are re-downloaded on demand.',
  matchers: [{ kind: 'dir', path: '~/Library/Caches/Homebrew' }],
})
