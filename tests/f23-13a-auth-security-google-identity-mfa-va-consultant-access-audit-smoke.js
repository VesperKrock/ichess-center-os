import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-13a-auth-security-google-identity-mfa-va-consultant-access-audit.md')
const platformDesign = read('docs/f23-12d-controlled-platform-owner-bootstrap-assignment-va-revoke-drill.md')
const canonicalRoadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')
const realtimeRoadmapPath = path.join(root, 'RoadmapRealTime.txt')
const realtimeRoadmap = fs.existsSync(realtimeRoadmapPath)
  ? fs.readFileSync(realtimeRoadmapPath, 'utf8')
  : ''

for (const marker of [
  'F23_13_STATUS: DONE DESIGN',
  'F23_13A_STATUS: DONE DESIGN',
  'F23_13A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13B_STATUS: DONE DESIGN',
  'F23_13B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13C_STATUS: DONE DESIGN',
  'F23_13C_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13D_STATUS: DONE DESIGN',
  'F23_13D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_13_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12_STATUS: DESIGN COMPLETE',
  'F23_12D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_13A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_13_RUNTIME_IMPLEMENTATION: NOT STARTED',
  'F23_13_AUTH_CONFIGURATION_CHANGE: NO',
  'F23_13_SUPABASE_ACTION: NOT RUN',
  'RUNTIME_CHANGE: NO',
  'SQL_CHANGE: NO',
  'MIGRATION_CHANGE: NO',
  'AUTH_CHANGE: NO',
  'SUPABASE_ACTION: NOT RUN',
  'REAL_ACCOUNT_CHANGE: NO',
  'REAL_CONSULTANT_ACCOUNT_CREATED: NO',
  'F23.13 FINAL TECHNICAL AUDIT PASS - DESIGN CLOSEOUT COMPLETE',
]) assert(design.includes(marker), `Missing status/boundary marker: ${marker}`)

for (const marker of [
  'F23_12D_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12_FINAL_TECHNICAL_AUDIT: PASS',
  'F23.12D FINAL TECHNICAL AUDIT PASS - F23.13 DESIGN MAY START',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12B_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12C_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12D_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12_RUNTIME_IMPLEMENTATION: NOT STARTED',
]) assert(platformDesign.includes(marker), `F23.12 final-audit sync missing: ${marker}`)

assert(
  !platformDesign.includes('F23.12D GLOBAL AUTHORITY MUTEX AND EXECUTION ENVELOPE HARDENING COMPLETE - READY FOR FINAL AUDIT'),
  'F23.12D stale final line must be replaced.',
)

for (const classification of [
  'REPO FACT',
  'PARTIAL FOUNDATION',
  'DESIGN PROPOSAL',
  'DEFERRED',
]) assert(design.includes(classification), `Missing audit classification: ${classification}`)

for (const repoFact of [
  'signInWithPassword({ email, password })',
  'Không có username-to-email resolver',
  'Không có form/call `auth.updateUser`',
  '`reset-center-admin-password`',
  '`provision-center-admin-account`',
  'domain là constant cố định trong function source',
  '`list-center-admin-accounts`',
  '`revoke-center-admin-access`',
  '`restore-center-admin-access`',
  'auth_disable_not_implemented',
  'không revoke Auth session',
  '`INITIAL_SESSION`, `TOKEN_REFRESHED`, `USER_UPDATED`',
  '`center_members` unique theo `(center_id, user_id)`',
  'role mặc định `admin`',
  'Không có permission-override table/service/effective-permission resolver',
  'PostgreSQL policies cùng command được OR',
  '`consultant` tồn tại trong online role constants',
  'Parent consultations được lưu localStorage theo center namespace',
  'Không có consultant account provisioning server function',
  'manual linking local bị tắt',
  'TOTP và phone MFA local đều tắt',
]) assert(design.includes(repoFact), `Missing repo-truth conclusion: ${repoFact}`)

for (const marker of [
  'G1 — Google Sign-In',
  'G2 — Link Google identity',
  'G3 — Google Workspace restriction',
  'GOOGLE_IDENTITY_DEFAULT_MODEL: LINK_TO_EXISTING_ICHESS_ACCOUNT',
  'GOOGLE_AUTO_CREATE_ACCOUNT_ALLOWED: NO',
  'GOOGLE_EMAIL_MATCH_AUTO_LINK_ALLOWED: NO',
  'GOOGLE_IDENTITY_REPLACES_CANONICAL_ACCOUNT_ID: NO',
  'GOOGLE_EMAIL_IS_AUTHORITY: NO',
  'GOOGLE_AUTO_LINK_BY_EMAIL: NO',
  'GOOGLE_AUTO_ACCOUNT_PROVISIONING: NO',
  'GOOGLE_CALENDAR_IN_F23_13_SCOPE: NO',
  'GOOGLE_DRIVE_IN_F23_13_SCOPE: NO',
  'GOOGLE_CLASSROOM_IN_F23_13_SCOPE: NO',
  'fresh iChess re-auth',
  'state digest, nonce, PKCE',
  'exact immutable provider subject',
  'Provider token không lưu localStorage/sessionStorage',
]) assert(design.includes(marker), `Missing Google identity contract: ${marker}`)

for (const state of [
  'UNLINKED',
  'LINK_PENDING',
  'LINKED',
  'REAUTH_REQUIRED',
  'CONFLICT',
  'REVOKED',
  'UNLINKED_BY_USER',
  'UNLINKED_BY_ADMIN',
]) assert(design.includes(state), `Missing identity-link lifecycle state: ${state}`)

for (const method of [
  'TOTP authenticator',
  'WebAuthn/passkey',
  'Hardware-backed security key',
  'SMS OTP',
  'Email OTP',
  'Recovery codes',
]) assert(design.includes(method), `Missing MFA taxonomy method: ${method}`)

for (const state of [
  'NOT_ENROLLED',
  'ENROLLMENT_PENDING',
  'ENROLLED',
  'CHALLENGE_REQUIRED',
  'VERIFIED',
  'RECOVERY_REQUIRED',
  'RESET_PENDING_APPROVAL',
  'SUSPENDED',
  'REVOKED',
]) assert(design.includes(state), `Missing MFA lifecycle state: ${state}`)

for (const marker of [
  'MFA_CLIENT_ONLY_ENFORCEMENT_ALLOWED: NO',
  'MFA_RECOVERY_BYPASSES_ACCOUNT_LIFECYCLE: NO',
  'PLATFORM_OWNER_PRODUCTION_HARDWARE_BACKED_MFA_REQUIRED: YES',
  'STEP_UP_DEFAULT_FRESHNESS_MINUTES: 10',
  'STEP_UP_CRITICAL_FRESHNESS_MINUTES: 5',
  'STEP_UP_CLIENT_TIMESTAMP_IS_AUTHORITY: NO',
  'RECOVERY_CODE_RECOMMENDED_COUNT: 10',
  'RECOVERY_CODE_SINGLE_USE: YES',
  'RECOVERY_CODE_PLAINTEXT_STORAGE_ALLOWED: NO',
  'CENTER_ADMIN_CAN_RESET_PLATFORM_OWNER_MFA: NO',
  'Đổi mật khẩu',
  'Link/unlink Google',
  'Platform Owner bootstrap/grant',
  'Sensitive export',
]) assert(design.includes(marker), `Missing MFA/step-up/recovery contract: ${marker}`)

for (const capability of [
  'crm.lead.read',
  'crm.lead.create',
  'crm.lead.update',
  'crm.care_log.create',
  'parent.basic.read',
  'student.basic.read_limited',
  'tuition.quote.read',
  'tuition.payment_status.read_limited',
  'schedule.summary.read',
  'report.sales_summary.read',
  'staff.private_hr.read',
  'staff.private_hr.download',
  'cashflow.full.read',
  'cashflow.write',
  'account.manage',
  'permission.manage',
  'center.manage',
  'platform.manage',
  'acting.start',
  'storage.private.delete',
]) assert(design.includes(`\`${capability}\``), `Missing consultant capability: ${capability}`)

for (const marker of [
  'CONSULTANT_IS_PLATFORM_ROLE: NO',
  'CONSULTANT_CROSS_CENTER_ACCESS_ALLOWED: NO',
  'CONSULTANT_PERMISSION_UI_ONLY_GUARD_ALLOWED: NO',
  'Số điện thoại',
  'Email',
  'Địa chỉ',
  'Ngày sinh',
  'Học viên',
  'Học phí',
  'Lịch sử chăm sóc',
  'Ghi chú nội bộ',
  'Tài liệu private',
  'Thông tin nhân sự',
  'Dữ liệu tài chính',
  'Hồ sơ Nhân viên/Tư vấn',
  'Tài khoản đăng nhập',
  'Center membership',
  'Role consultant',
  'Permission overrides',
  'masking phải ở server projection/query, không chỉ CSS/DOM',
]) assert(design.includes(marker), `Missing consultant masking/provisioning contract: ${marker}`)

for (let index = 1; index <= 22; index += 1) {
  assert(design.includes(`| T${index} |`), `Missing threat T${index}`)
}

for (let index = 1; index <= 20; index += 1) {
  assert(design.includes(`| A-AG${index} `), `Missing approval gate A-AG${index}`)
}

for (const code of [
  'identity_link_not_available',
  'identity_link_reauth_required',
  'identity_link_conflict',
  'identity_already_linked',
  'identity_provider_mismatch',
  'identity_callback_invalid',
  'mfa_enrollment_required',
  'mfa_challenge_required',
  'mfa_challenge_failed',
  'mfa_recovery_required',
  'mfa_reset_pending',
  'mfa_factor_invalid',
  'account_lifecycle_blocked',
  'consultant_access_denied',
  'consultant_center_mismatch',
  'permission_not_granted',
  'security_service_unavailable',
]) assert(design.includes(code), `Missing safe error code: ${code}`)

const roadmapMarkers = [
  'F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở',
  'F23.12A DONE design / Role platform_owner và nguồn cấp quyền server-side fail-closed',
  'F23.12B DONE design / Global Internal Console và center inventory',
  'F23.12C DONE design / Acting request-session, approval, expiry, revoke và safe exit',
  'F23.12D DONE design / Controlled Platform Owner bootstrap, assignment và revoke drill',
  'F23.13 DONE design / Bảo mật tài khoản, liên kết Google identity, MFA và quyền Tư vấn',
  'F23.13A DONE design / Audit nền Auth-security và chốt boundary',
  'F23.13B DONE design / Liên kết Google identity và login-recovery semantics',
  'F23.13C DONE design / MFA-2FA enrollment, enforcement, step-up và recovery',
  'F23.13D DONE design / Quyền Tư vấn, provisioning, capability matrix và server enforcement',
]

for (const marker of roadmapMarkers) {
  assert(design.includes(marker), `Design roadmap missing: ${marker}`)
  assert(canonicalRoadmap.includes(marker), `Canonical roadmap missing: ${marker}`)
}

for (const marker of [
  'F23.13 FINAL TECHNICAL AUDIT: PASS',
  'F23.13 IMPLEMENTATION: BLOCKED',
  'F23.13 RUNTIME IMPLEMENTATION: NOT STARTED',
]) {
  assert(design.includes(marker), `Design closeout marker missing: ${marker}`)
  assert(canonicalRoadmap.includes(marker), `Canonical closeout marker missing: ${marker}`)
}

if (realtimeRoadmap) {
  assert(realtimeRoadmap.includes('F23.11E.2A DONE backend/public'))
  assert(realtimeRoadmap.includes('F23.11E.2B LATER backend'))
  assert(!realtimeRoadmap.includes('F23.11E.2 DONE backend /'))
  assert(realtimeRoadmap.includes('SUP-CF.1 DONE backend/public'))
  assert(realtimeRoadmap.includes('migration đã apply remote và bất biến'))
}

for (const forbidden of [
  'GOOGLE_AUTO_LINK_BY_EMAIL: YES',
  'GOOGLE_AUTO_ACCOUNT_PROVISIONING: YES',
  'MFA_CLIENT_ONLY_ENFORCEMENT_ALLOWED: YES',
  'CONSULTANT_CROSS_CENTER_ACCESS_ALLOWED: YES',
  'CONSULTANT_PERMISSION_UI_ONLY_GUARD_ALLOWED: YES',
  'HARDCODED_SECURITY_EMAIL_ALLOWED: YES',
  'F23_13_STATUS: IN PROGRESS DESIGN',
  'F23_13_FINAL_TECHNICAL_AUDIT: NOT RUN',
  'F23_13_IMPLEMENTATION_READINESS: READY',
  'F23_13_RUNTIME_IMPLEMENTATION: DONE',
  'F23.13 IN PROGRESS design /',
  'F23.13 DESIGN PACKAGE COMPLETE - READY FOR FINAL TECHNICAL AUDIT',
  'F23_13A_IMPLEMENTATION_READINESS: READY',
  'F23_12A_IMPLEMENTATION_READINESS: READY',
  'platform_owner-super_admin',
]) assert(!design.includes(forbidden), `Forbidden claim found: ${forbidden}`)

assert(
  !design.includes('F23.13A AUTH SECURITY FOUNDATION AUDIT COMPLETE - READY FOR TECHNICAL AUDIT'),
  'F23.13A stale pre-audit final line must be replaced.',
)

assert(!/```sql/i.test(design), 'Design-only doc must not contain executable SQL fences.')
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(design), 'Design must not contain a real/fixture email address.')

const secretPatterns = [
  /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/i,
  /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*\S+/i,
  /\bsb_secret_[A-Za-z0-9_-]+/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /totp[_ -]?secret\s*[:=]\s*\S+/i,
  /recovery[_ -]?code\s*[:=]\s*\S+/i,
]
for (const pattern of secretPatterns) assert(!pattern.test(design), `Potential secret found: ${pattern}`)

const privateWorkspaceLabel = ['Teacher', 'Workspace'].join(' ')
assert(!design.includes(privateWorkspaceLabel), 'Design must not include private workspace labels.')

const characters = (...codePoints) => String.fromCodePoint(...codePoints)
const mojibakeMarkers = [
  characters(0x43, 0x00e1, 0x00ba),
  characters(0x00c3),
  characters(0x00c6, 0x00b0),
  characters(0x48, 0x00e1, 0x00ba),
  characters(0x00e1, 0x00bb),
  characters(0xfffd),
]

for (const content of [design, platformDesign, canonicalRoadmap, realtimeRoadmap]) {
  for (const marker of mojibakeMarkers) {
    assert(!content.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.13A Auth-security Google identity MFA consultant access docs smoke: PASS')
