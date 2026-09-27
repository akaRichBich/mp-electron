import { defineRule } from '../rule/schema'

export const playwrightBrowsers = defineRule({
  id: 'playwright-browsers',
  title: 'Playwright browsers',
  category: 'cache',
  safety: 'review',
  origin: 'spec',
  explain: 'Browser builds Playwright downloads for tests. Removing them means the next test run downloads them again.',
  matchers: [{ kind: 'dir', path: '~/Library/Caches/ms-playwright' }],
})
