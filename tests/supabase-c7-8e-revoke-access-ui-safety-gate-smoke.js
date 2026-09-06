import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: a static phongtrong-only allowlist was the revoke authority.
 * CURRENT ARG-2 CONTRACT: exact-center READY capability plus governance and membership
 * versions gate the action; the server repeats Owner authorization.
 * WHY VALID: removing a static UI allowlist is safe because it is replaced by stronger
 * server capability, not by an unconditional enable.
 */
const main = readFileSync('src/main.js', 'utf8')
const edge = readFileSync('supabase/functions/revoke-center-admin-access/index.ts', 'utf8')
for (const marker of [
  'isAccountGovernanceReady(adminAccount?.capability, center.id)',
  'canLiveRevokeInternalAccount',
  'expected_governance_version',
  'expected_membership_version',
  'target_membership_id',
  'data-internal-revoke-typed-confirmation',
]) assert(main.includes(marker), 'ARG-2 revoke UI marker missing: ' + marker)

assert(edge.includes("p_action: 'revoke_admin'"))
assert(edge.includes('p_actor_user_id: actorId'))
assert(!main.includes('ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS'))
assert(!edge.includes('deleteUser('))
console.log('C7.8E revoke UI gate PASS under real governance capability')
