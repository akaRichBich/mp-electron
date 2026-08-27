import { defineRule } from '../rule/schema'

export const staleAppLogs = defineRule({
  id: 'stale-app-logs',
  title: 'Stale app logs',
  category: 'logs',
  safety: 'review',
  explain:
    'Log folders nothing has written to in a month, including crash reports. Apps recreate them.',
  // One finding per app folder, so a noisy app can be cleared while today's
  // logs are left where a support engineer can still read them.
  matchers: [{ kind: 'glob', root: '~/Library/Logs', pattern: '*' }],
  minAgeDays: 30,
})
