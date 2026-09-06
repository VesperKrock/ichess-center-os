import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: Admin email was deterministically derived from center ID.
 * CURRENT ARG-2 CONTRACT: the Owner must enter and review a genuine human email;
 * existing-email collision fails closed and replacement is a distinct workflow.
 * WHY VALID: it preserves explicit operator intent and removes email collision risk.
 */
const main = readFileSync('src/main.js', 'utf8')
const edge = readFileSync('supabase/functions/provision-center-admin-account/index.ts', 'utf8')
for (const marker of [
  'data-internal-create-admin-email',
  'validateReviewedAccountEmail',
  'target_email: reviewedEmail.email',
  "target.mode === 'replace'",
  'data-internal-replace-admin-center-id',
  'predecessor_membership_id',
  'expected_membership_version',
]) assert(main.includes(marker), 'ARG-2 create/replace UI marker missing: ' + marker)

assert(edge.includes('validEmail(email)'))
assert(edge.includes("mode === 'replace_admin'"))
assert(edge.includes('auth_identity_create_failed_review_required'))
assert(!main.includes('getExpectedInternalAdminEmail'))
assert(!/admin\.[a-z0-9_-]+@ichess\.vn/i.test(main + edge))
console.log('C7.8D explicit Admin identity UI smoke PASS')
