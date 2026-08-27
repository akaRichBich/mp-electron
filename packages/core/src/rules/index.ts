import { register } from '../rule/registry'
import { goBuildCache } from './go-build-cache'
import { homebrewCache } from './homebrew-cache'
import { pipCache } from './pip-cache'
import { poetryCache } from './poetry-cache'
import { sandbox } from './sandbox'
import { staleAppLogs } from './stale-app-logs'
import { xcodeDerivedData } from './xcode-derived-data'

// The single place a rule becomes real. `registered_in` in the eval suite
// asserts against this file, so a generated rule that is never wired up fails
// CI instead of silently doing nothing.
register(goBuildCache, homebrewCache, pipCache, poetryCache, sandbox, staleAppLogs, xcodeDerivedData)

export { goBuildCache, homebrewCache, pipCache, poetryCache, sandbox, staleAppLogs, xcodeDerivedData }
