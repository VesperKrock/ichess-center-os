import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isMembershipBusinessReady } from '../src/account-lifecycle.js'

/**
 * OLD ASSUMPTION: revoked-user UX was the only non-active access case and the test
 * enforced a historical changed-file list.
 * CURRENT ARG-2 CONTRACT: every credential-transition status is business-denied and
 * resolves to the mandatory password screen or ordinary access-denied UX.
 * WHY VALID: the fail-closed user outcome is broadened without changing business roles.
 */
const auth = readFileSync('src/supabase-auth.js', 'utf8')
const main = readFileSync('src/main.js', 'utf8')
for (const state of ['pending_credential', 'reset_required', 'revoke_pending', 'revoked', 'restore_pending']) {
  assert.equal(isMembershipBusinessReady({ status: state }), false)
}
assert(auth.includes('export async function listCenterMemberships'))
assert(auth.includes('BLOCKED_MEMBERSHIP_STATES.has(status)'))
assert(auth.includes("arg2_get_my_credential_gate"))
assert(main.includes('credentialChangeRequired'))
assert(main.includes('data-required-credential-change-form'))
assert(main.includes('Đổi mật khẩu trước khi tiếp tục'))
assert(!main.includes('ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS'))
console.log('C7.9C access-denied/credential-gate UX smoke PASS under ARG-2')
