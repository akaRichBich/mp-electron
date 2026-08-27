import { register } from '../rule/registry'
import { homebrewCache } from './homebrew-cache'
import { pipCache } from './pip-cache'
import { poetryCache } from './poetry-cache'
import { xcodeDerivedData } from './xcode-derived-data'

// The single place a rule becomes real. `registered_in` in the eval suite
// asserts against this file, so a generated rule that is never wired up fails
// CI instead of silently doing nothing.
register(homebrewCache, pipCache, poetryCache, xcodeDerivedData)

export { homebrewCache, pipCache, poetryCache, xcodeDerivedData }
