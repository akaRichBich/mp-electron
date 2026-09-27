import { defineRule } from '../rule/schema'

export const yarnCache = defineRule({
  id: 'yarn-cache',
  title: 'Yarn cache',
  category: 'package-manager',
  safety: 'safe',
  origin: 'spec',
  explain: 'Packages Yarn keeps so a reinstall is offline. It refetches whatever it needs.',
  matchers: [
    { kind: 'dir', path: '~/Library/Caches/Yarn' },
    { kind: 'dir', path: '~/.cache/yarn' },
  ],
})
