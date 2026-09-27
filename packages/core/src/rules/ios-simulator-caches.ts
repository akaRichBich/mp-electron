import { defineRule } from '../rule/schema'

export const iosSimulatorCaches = defineRule({
  id: 'ios-simulator-caches',
  title: 'iOS Simulator caches',
  category: 'cache',
  safety: 'safe',
  origin: 'spec',
  explain: 'Runtime images and caches the simulator rebuilds on demand. Your simulators and their data are elsewhere.',
  matchers: [{ kind: 'dir', path: '~/Library/Developer/CoreSimulator/Caches' }],
})
