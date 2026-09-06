import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: live buttons were authorized by a hardcoded center ID.
 * CURRENT ARG-2 CONTRACT: all rollout centers use the same real capability and
 * currentness/version boundary; unavailable/failed states remain fail-closed.
 * WHY VALID: this retains the UI safety objective while removing environment-specific
 * authorization from browser code.
 */
const main = readFileSync('src/main.js', 'utf8')
const helper = readFileSync('src/account-lifecycle.js', 'utf8')
assert(main.includes('isAccountGovernanceReady(adminAccount?.capability, center.id)'))
assert(main.includes('openInternalRevokeAccessConfirm'))
assert(main.includes('openInternalRestoreAccessConfirm'))
assert(main.includes('data-internal-revoke-admin-center-id'))
assert(main.includes('data-internal-restore-admin-center-id'))
assert(main.includes('createLifecycleRequestId'))
assert(helper.includes("String(capability?.centerId || '') === String(centerId || '')"))
assert(!main.includes('ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS'))
assert(!main.includes("new Set(['phongtrong_prod'])"))
console.log('C7.8G revoke/restore wiring PASS under exact-center capability')
