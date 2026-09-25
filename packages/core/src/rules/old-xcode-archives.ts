import { defineRule } from '../rule/schema'

export const oldXcodeArchives = defineRule({
  id: 'old-xcode-archives',
  title: 'Old Xcode archives',
  category: 'build-artifacts',
  safety: 'review',
  origin: 'spec',
  explain:
    'Builds you archived for submission. Keep the ones you might have to symbolicate a crash against.',
  // One finding per archive, so a release you may still need to symbolicate
  // against can be kept while the ones around it go.
  matchers: [{ kind: 'glob', root: '~/Library/Developer/Xcode/Archives', pattern: '*' }],
  minAgeDays: 90,
})
