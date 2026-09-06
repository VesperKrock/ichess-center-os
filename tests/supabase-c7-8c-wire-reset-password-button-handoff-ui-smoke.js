import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: reset success meant the Admin was operational immediately.
 * CURRENT ARG-2 CONTRACT: reset success exposes a one-time in-memory handoff and leaves
 * reset_required until mandatory credential completion.
 * WHY VALID: the button and handoff remain useful without false activation.
 */
const main = readFileSync('src/main.js', 'utf8')
const auth = readFileSync('src/supabase-auth.js', 'utf8')
const helper = readFileSync('src/account-lifecycle.js', 'utf8')
for (const marker of [
  'handleInternalResetAdminPassword',
  "functions.invoke('reset-center-admin-password'",
  'data-internal-reset-admin-center-id',
  'data-internal-handoff-copy="password"',
  'temporaryPassword: data.temporary_password',
  'closeInternalPasswordHandoff',
]) assert(main.includes(marker), 'ARG-2 reset UI marker missing: ' + marker)

assert(helper.includes('clearEphemeralLifecycleState'))
assert(helper.includes('handoff: null'))
assert(auth.includes('completeRequiredCredentialChange'))
assert(main.includes('data-required-credential-change-form'))
assert(!/localStorage\.setItem\([^\n]*(password|credential)/i.test(main))
assert(!/sessionStorage\.setItem\([^\n]*(password|credential)/i.test(main))
console.log('C7.8C reset/handoff UI smoke PASS under mandatory password change')
