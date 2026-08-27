import type { Rule } from './schema'

const rules = new Map<string, Rule>()

export function register(...toAdd: Rule[]): void {
  for (const rule of toAdd) {
    const existing = rules.get(rule.id)
    if (existing) throw new Error(`duplicate rule id "${rule.id}"`)
    rules.set(rule.id, rule)
  }
}

export function allRules(): Rule[] {
  return [...rules.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function getRule(id: string): Rule | undefined {
  return rules.get(id)
}
