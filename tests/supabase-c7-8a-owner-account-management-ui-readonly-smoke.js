import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: account cards inferred readiness from legacy list shape and email.
 * CURRENT ARG-2 CONTRACT: the server capability and versioned membership govern every
 * action, while account cards remain an Owner-only management surface.
 * WHY VALID: it preserves read-first UI safety and eliminates email-as-authority.
 */
const main = readFileSync('src/main.js', 'utf8')
const helper = readFileSync('src/account-lifecycle.js', 'utf8')
for (const marker of [
  'isAccountGovernanceReady(adminAccount?.capability, center.id)',
  'adminAccount?.membershipVersion',
  'adminAccount.governanceVersion',
  'data-internal-reset-admin-center-id',
  'data-internal-revoke-admin-center-id',
  'data-internal-restore-admin-center-id',
  'data-internal-replace-admin-center-id',
  'data-internal-owner-handoff-start-center-id',
]) assert(main.includes(marker), 'ARG-2 Owner UI marker missing: ' + marker)

assert(helper.includes("READY: 'ready'"))
assert(helper.includes("UNAVAILABLE: 'unavailable'"))
assert(helper.includes("FAILED: 'failed'"))
assert(!main.includes('ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS'))
console.log('C7.8A Owner account UI smoke PASS under capability authority')
