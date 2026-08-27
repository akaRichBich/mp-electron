import { defineRule } from '../rule/schema'

export const goBuildCache = defineRule({
  id: 'go-build-cache',
  title: 'Go build cache',
  category: 'build-artifacts',
  safety: 'safe',
  origin: 'spec',
  explain: 'Compiled Go packages kept between builds. The next `go build` recreates whatever it needs.',
  matchers: [{ kind: 'dir', path: '~/Library/Caches/go-build' }],
})
