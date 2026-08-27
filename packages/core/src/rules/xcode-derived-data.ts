import { defineRule } from '../rule/schema'

export const xcodeDerivedData = defineRule({
  id: 'xcode-derived-data',
  title: 'Xcode DerivedData',
  category: 'build-artifacts',
  safety: 'review',
  explain:
    'Build intermediates and indexes. Removing them is safe but the next build will be a full one.',
  // One finding per project folder, so a stale project can be cleaned while
  // the one you built this morning is left alone.
  matchers: [{ kind: 'glob', root: '~/Library/Developer/Xcode/DerivedData', pattern: '*' }],
  minAgeDays: 7,
})
