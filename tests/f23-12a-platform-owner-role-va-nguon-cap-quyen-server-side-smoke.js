import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-12a-platform-owner-role-va-nguon-cap-quyen-server-side.md')
const roadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')

for (const marker of [
  'F23_12A_STATUS: DONE DESIGN',
  'F23_12A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'CHECKPOINT_AUDITED: 29cb88d',
  'CANONICAL_MACHINE_ROLE: platform_owner',
  'AUTHORITY_SOURCE_RECOMMENDATION: DEDICATED_SERVER_SIDE_ASSIGNMENT_TABLE',
  'PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: YES',
  'GLOBAL_CONSOLE_IS_ACTING_SESSION: NO',
  'CENTER_SWITCH_IS_ACTING_SESSION: NO',
  'CLIENT_ONLY_AUTHORIZATION_ALLOWED: NO',
  'HARDCODED_OPERATOR_EMAIL_ALLOWED: NO',
  'OWNER_OR_CENTER_ADMIN_SELF_GRANT_ALLOWED: NO',
  'BROWSER_SERVICE_ROLE_ALLOWED: NO',
  'UNIVERSAL_RLS_BYPASS_ALLOWED: NO',
  'SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: NO',
  'SECOND_PLATFORM_OWNER_REQUIRED_FOR_WRITE_ACTING: YES',
  'SELF_APPROVAL_ALLOWED: NO',
  'READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: NO',
  'PRIVATE_HR_READ_REQUIRES_ADDITIONAL_APPROVAL: YES',
  'PRIVATE_EXPORT_DEFAULT: FORBIDDEN',
  'LONG_LIVED_ASSIGNMENT_REVIEW_DEADLINE_REQUIRED: YES',
  'NULL_EXPIRES_AT_MEANS_UNLIMITED_AUTHORITY: NO',
  'OVERDUE_AUTHORITY_REVIEW_FAILS_CLOSED: YES',
  'CANONICAL_ACCOUNT_LIFECYCLE_IMPLEMENTATION_READY: NO',
  'PLATFORM_AUTHORITY_IMPLEMENTATION_BLOCKED_WITHOUT_ACCOUNT_LIFECYCLE: YES',
  'ACCOUNT_LIFECYCLE_DEPENDENCY_ERROR_FAILS_CLOSED: YES',
  'AUTHORITY_MUTATION_WITHOUT_AUDIT_ALLOWED: NO',
  'AUTHORITY_MUTATION_AUDIT_ATOMIC_REQUIRED: YES',
  'TRANSACTIONAL_OUTBOX_ACCEPTABLE: YES',
  'RUNTIME_CHANGE: NO',
  'SQL_CHANGE: NO',
  'MIGRATION_CHANGE: NO',
  'AUTH_CHANGE: NO',
  'SUPABASE_ACTION: NOT RUN',
  'REAL_ACCOUNT_ASSIGNMENT: NO',
  'F23.12A FINAL TECHNICAL AUDIT PASS - F23.12B DESIGN MAY START',
]) assert(design.includes(marker), `Missing F23.12A marker: ${marker}`)

for (let index = 1; index <= 12; index += 1) {
  assert(design.includes(`PLATFORM-AUTH-${index}`), `Missing PLATFORM-AUTH-${index}`)
}

for (const marker of [
  'REPO FACT',
  'PARTIAL FOUNDATION',
  'DESIGN PROPOSAL',
  'DEFERRED',
  'platform_operator_assignments',
  'is_active_platform_owner(auth.uid())',
  'PROPOSED | ACTIVE | SUSPENDED | REVOKED | EXPIRED | REJECTED | CANCELLED',
  'SINGLE_OPERATOR_BOOTSTRAP_MODE',
  '## 10.3 Private-data boundary',
  'review_due_at',
  'last_reviewed_at',
  'last_reviewed_by_user_id',
  'review_status',
  'IMPLEMENTATION PREREQUISITE',
  '## 8. RLS/RPC trust-boundary design',
  '## 9. Global Console khác Acting Session',
  '## 10. Acting session contract',
  'session_id',
  'platform_actor_user_id',
  'target_center_id',
  'requested_at',
  'started_at',
  'expires_at',
  'ended_at',
  'ended_by',
  'end_reason',
  'REQUIRE ACTING SESSION',
  'REQUIRE ADDITIONAL APPROVAL',
  'ALLOW DIRECTLY',
  'FORBIDDEN',
  '## 12. Audit append-only contract',
  '## 12.1 Atomic mutation + audit contract',
  '## 13. Threat model',
  '## 14. UI state contract — không implement UI',
  '## 15. Bootstrap Platform Owner đầu tiên',
  '## 16. Approval gates cần business/technical sign-off',
  '## 17. Open questions Q1–Q15',
  '## 21. Implementation readiness',
]) assert(design.includes(marker), `Missing design contract: ${marker}`)

for (let index = 1; index <= 15; index += 1) {
  assert(design.includes(`| Q${index} |`), `Missing open question Q${index}`)
}

assert(design.includes('| D. Hardcoded email hoặc frontend allowlist'))
assert(design.includes('**REJECTED**'))
assert(design.includes('service_role'))
assert(design.includes('| Xem tài liệu nhân sự private | REQUIRE ADDITIONAL APPROVAL |'))
assert(design.includes('Vẫn cần acting session; capability riêng bind actor/center/subject/action/expiry'))
assert(design.includes('cùng database transaction'))
assert(design.includes('transactional-outbox record cùng commit trong một transaction'))
assert(design.includes('audit precondition, audit insert hoặc outbox insert thất bại thì rollback/deny'))
assert(design.includes('REJECTED` và `CANCELLED` không được biểu diễn bằng `REVOKED`'))
assert(design.includes('Smoke là docs-contract test, không phải runtime security proof.'))
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(design), 'Design must not contain a real or fixture email address')
assert(!design.includes('platform_owner-super_admin'))
assert(!design.includes('| Xem tài liệu nhân sự private | REQUIRE ACTING SESSION |'))
assert(!design.includes('SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: YES'))
assert(!design.includes('SELF_APPROVAL_ALLOWED: YES'))
assert(!design.includes('READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: YES'))
assert(!design.includes('NULL_EXPIRES_AT_MEANS_UNLIMITED_AUTHORITY: YES'))
assert(!design.includes('AUTHORITY_MUTATION_WITHOUT_AUDIT_ALLOWED: YES'))
assert(!design.includes('F23_12A_IMPLEMENTATION_READINESS: READY'))

const forbiddenPrivateWorkspaceLabel = ['Teacher', 'Workspace'].join(' ')
assert(!design.includes(forbiddenPrivateWorkspaceLabel), 'Design must not include private workspace labels')

for (const marker of [
  'F23.11 DONE public/backend',
  'F23.11E.2A DONE backend/public',
  'F23.11E.2B LATER backend',
  'F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở',
  'F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed',
  'F23.12B DONE design / Global Internal Console và center inventory',
  'F23.12C DONE design / Acting request/session, approval, expiry, revoke và thoát vai fail-closed',
  'F23.12D DONE design / Controlled bootstrap, assignment và revoke drill',
]) {
  assert(design.includes(marker), `Design roadmap missing: ${marker}`)
  assert(roadmap.includes(marker), `Canonical roadmap missing: ${marker}`)
}

const characters = (...codePoints) => String.fromCodePoint(...codePoints)
const mojibakeMarkers = [
  characters(0x43, 0x00e1, 0x00ba),
  characters(0x00c3),
  characters(0x00c6, 0x00b0),
  characters(0x48, 0x00e1, 0x00ba),
  characters(0x00e1, 0x00bb),
  characters(
    0x42, 0x75, 0x00e1, 0x00bb, 0x2022, 0x69, 0x20,
    0x68, 0x00e1, 0x00bb, 0x008d, 0x63, 0x20,
    0x6d, 0x00e1, 0x00bb, 0x203a, 0x69,
  ),
  characters(0xfffd),
]

for (const content of [design, roadmap]) {
  for (const marker of mojibakeMarkers) {
    assert(!content.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.12A platform authority design docs smoke: PASS')
