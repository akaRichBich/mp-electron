import { defineRule } from '../rule/schema'

export const poetryCache = defineRule({
  id: 'poetry-cache',
  title: 'Poetry cache',
  category: 'package-manager',
  safety: 'safe',
  origin: 'spec',
  explain: 'Downloaded Python packages Poetry keeps between installs. They are fetched again when needed.',
  matchers: [{ kind: 'dir', path: '~/Library/Caches/pypoetry' }],
})
