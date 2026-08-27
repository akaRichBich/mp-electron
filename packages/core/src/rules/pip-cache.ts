import { defineRule } from '../rule/schema'

export const pipCache = defineRule({
  id: 'pip-cache',
  title: 'pip cache',
  category: 'package-manager',
  safety: 'safe',
  explain: 'Downloaded Python packages and built wheels. They are restored on the next install.',
  matchers: [{ kind: 'dir', path: '~/Library/Caches/pip' }],
})
