import { defineRule } from '../rule/schema'

export const npmCache = defineRule({
  id: 'npm-cache',
  title: 'npm cache',
  category: 'package-manager',
  safety: 'safe',
  explain: 'Package tarballs and metadata npm keeps between installs. It refetches whatever it needs.',
  matchers: [{ kind: 'dir', path: '~/.npm/_cacache' }],
})
