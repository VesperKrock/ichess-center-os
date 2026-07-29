import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

const design = read('docs/f23-12b-global-internal-console-va-center-inventory.md')
const authorityDesign = read('docs/f23-12a-platform-owner-role-va-nguon-cap-quyen-server-side.md')
const roadmap = read('docs/f23-11e-2-go-xoa-tep-object-cleanup-va-legal-hold.md')

for (const marker of [
  'F23_12B_STATUS: DONE DESIGN',
  'F23_12B_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_STATUS: DONE DESIGN',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23_12B_IMPLEMENTATION_READINESS: BLOCKED',
  'CANONICAL_MACHINE_ROLE: platform_owner',
  'GLOBAL_CONSOLE_AUTHORITY_SOURCE: SERVER_SIDE_PLATFORM_OWNER_ASSIGNMENT',
  'PLATFORM_OWNER_INDEPENDENT_FROM_CENTER_MEMBERSHIP: YES',
  'GLOBAL_CONSOLE_IS_ACTING_SESSION: NO',
  'CENTER_SWITCH_IS_ACTING_SESSION: NO',
  'GLOBAL_CONTEXT_AND_CENTER_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO',
  'MEMBERSHIP_CONTEXT_AND_ACTING_CONTEXT_SIMULTANEOUSLY_ACTIVE: NO',
  'BROWSER_BACK_REQUIRES_CONTEXT_REVALIDATION: YES',
  'CONTEXT_TRANSITION_CLEARS_INCOMPATIBLE_DATA: YES',
  'LEGACY_OWNER_MEMBERSHIP_GUARD_REUSED_FOR_GLOBAL_CONSOLE: NO',
  'SERVER_DERIVED_AUTHORITY_AND_CAPABILITIES_REQUIRED: YES',
  'CENTER_OPERATIONAL_DATA_IN_GLOBAL_CONSOLE: NO',
  'READ_ONLY_SELF_START_PRIVATE_HR_ACCESS: NO',
  'SINGLE_PLATFORM_OWNER_WRITE_ACTING_ALLOWED: NO',
  'SELF_APPROVAL_ALLOWED: NO',
  'PRIVATE_INVENTORY_EXPORT_DEFAULT: FORBIDDEN',
  'PRIVATE_HR_IN_CENTER_INVENTORY_ALLOWED: NO',
  'DIRECT_CENTER_OPERATIONAL_QUERY_ALLOWED: NO',
  'CLIENT_ONLY_PLATFORM_AUTHORIZATION_ALLOWED: NO',
  'DIRECT_BROWSER_PRIVILEGED_QUERY_ALLOWED: NO',
  'HARDCODED_OPERATOR_EMAIL_ALLOWED: NO',
  'UNIVERSAL_RLS_BYPASS_ALLOWED: NO',
  'RUNTIME_CHANGE: NO',
  'ROUTE_IMPLEMENTED: NO',
  'SQL_CHANGE: NO',
  'MIGRATION_CHANGE: NO',
  'SUPABASE_ACTION: NOT RUN',
  'AUTH_CHANGE: NO',
  'REAL_ASSIGNMENT_CHANGE: NO',
  'F23.12B FINAL TECHNICAL AUDIT PASS - F23.12C DESIGN MAY START',
]) assert(design.includes(marker), `Missing F23.12B marker: ${marker}`)

for (const marker of [
  'REPO FACT',
  'PARTIAL FOUNDATION',
  'DESIGN PROPOSAL',
  'DEFERRED',
  '## 4. Console cũ và Global Console mới',
  'Global Console Shell',
  'Center Inventory',
  'Center Governance Detail',
  'Platform Operators',
  'Global Audit',
  'Requests & Approvals',
  'System Readiness',
  '## 7. Global metadata privacy tiers',
  'G0 — low-sensitivity platform governance metadata',
  'G1 — operator governance metadata',
  'G2 — sensitive governance metadata',
  'G3 — center operational/private data',
  '## 8. Center inventory field contract',
  '`center_id`',
  '`display_name`',
  '`provisioning_status`',
  '`readiness_status`',
  '`owner_summary`',
  '`membership_summary`',
  '`warning_count`',
  '## 10. Search, filter, sort và pagination',
  'server-side opaque stable cursor',
  '## 11. Center Governance Detail',
  '## 12. Action matrix',
  'CREATE REQUEST',
  'REQUIRE ADDITIONAL APPROVAL',
  'REQUIRE ACTING SESSION',
  'SINGLE_OPERATOR_BLOCKED',
  '## 13. Entry sang center',
  'Mở bằng quyền membership của tôi',
  'Mở phiên hỗ trợ cơ sở',
  'Chế độ hỗ trợ chưa khả dụng',
  '## 14. System Readiness và health',
  'AVAILABLE',
  'PARTIAL',
  'NOT IMPLEMENTED',
  'DEGRADED',
  'UNKNOWN',
  '## 15. Server-derived data contract',
  'authority_context',
  'inventory_snapshot',
  'snapshot_version',
  'row_capabilities',
  '## 17. UI state matrix',
  'AUTHORITY_CHECKING',
  'INVENTORY_PARTIAL',
  'INVENTORY_STALE',
  'CENTER_DETAIL_UNAVAILABLE',
  'ADDITIONAL_APPROVAL_REQUIRED',
  'ACTING_NOT_IMPLEMENTED',
  '## 18. Error contract',
  'platform_inventory_unavailable',
  'single_operator_approval_unavailable',
  'acting_service_not_ready',
  '## 19. Route/navigation options',
  'A. Tái dùng `#/internal/centers`',
  'B. Hash namespace mới `#/internal/platform/centers`',
  '**RECOMMENDED DESIGN**, cần technical approval',
  '## 22. Approval gates F23.12B',
]) assert(design.includes(marker), `Missing F23.12B contract: ${marker}`)

for (const marker of [
  '### 4.2 Context transition contract',
  'Global → Membership',
  'Global → Acting',
  'Membership → Global',
  'Membership → Acting',
  'Acting → Global',
  'Acting → Membership',
  'Acting center A → Acting center B',
  'G0 không phải public data',
  'không có public/anonymous API',
  'Low-sensitivity” không có nghĩa là được export tự do',
]) assert(design.includes(marker), `Missing F23.12B audit patch contract: ${marker}`)

for (let index = 1; index <= 15; index += 1) {
  assert(design.includes(`B-AG${index}`), `Missing approval gate B-AG${index}`)
}

for (const state of [
  'AUTHORITY_CHECKING',
  'AUTHORITY_DENIED',
  'AUTHORITY_ACTIVE',
  'AUTHORITY_EXPIRED',
  'AUTHORITY_SUSPENDED',
  'AUTHORITY_ERROR',
  'INVENTORY_LOADING',
  'INVENTORY_EMPTY',
  'INVENTORY_READY',
  'INVENTORY_PARTIAL',
  'INVENTORY_STALE',
  'INVENTORY_ERROR',
  'CENTER_DETAIL_LOADING',
  'CENTER_DETAIL_READY',
  'CENTER_DETAIL_UNAVAILABLE',
  'ACTION_NOT_PERMITTED',
  'ADDITIONAL_APPROVAL_REQUIRED',
  'SINGLE_OPERATOR_BLOCKED',
  'ACTING_NOT_IMPLEMENTED',
]) assert(design.includes(`\`${state}\``), `Missing UI state: ${state}`)

assert(design.includes('Docs smoke chỉ xác nhận design/roadmap markers; không phải runtime security proof'))
assert(design.includes('Không render Student list, Staff list, private documents'))
assert(design.includes('không direct-query toàn bảng bằng privileged key hoặc gọi `service_role` từ browser'))
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(design), 'F23.12B design must not contain an email address')
assert(!design.includes('G0 — public-neutral platform metadata'))
assert(!design.includes('F23.12 implementation DONE'))
assert(!design.includes('CLIENT_ONLY_PLATFORM_AUTHORIZATION_ALLOWED: YES'))
assert(!design.includes('PRIVATE_HR_IN_CENTER_INVENTORY_ALLOWED: YES'))
assert(!design.includes('DIRECT_CENTER_OPERATIONAL_QUERY_ALLOWED: YES'))
assert(!design.includes('SELF_APPROVAL_ALLOWED: YES'))

for (const marker of [
  'F23_12A_FINAL_TECHNICAL_AUDIT: PASS',
  'F23_12A_IMPLEMENTATION_READINESS: BLOCKED',
  'F23.12A FINAL TECHNICAL AUDIT PASS - F23.12B DESIGN MAY START',
]) assert(authorityDesign.includes(marker), `F23.12A sync missing: ${marker}`)

for (const marker of [
  'F23.12 DONE design / Platform Owner và hỗ trợ xuyên cơ sở',
  'F23.12A DONE design',
  'F23.12B DONE design / Global Internal Console và center inventory',
  'F23.12C DONE design / Acting request/session, approval, expiry, revoke và thoát vai fail-closed',
  'F23.12D DONE design / Controlled bootstrap, assignment và revoke drill',
]) {
  assert(design.includes(marker), `F23.12B roadmap missing: ${marker}`)
  assert(authorityDesign.includes(marker), `F23.12A roadmap missing: ${marker}`)
  assert(roadmap.includes(marker), `Canonical roadmap missing: ${marker}`)
}

const privateWorkspaceLabel = ['Teacher', 'Workspace'].join(' ')
assert(!design.includes(privateWorkspaceLabel), 'F23.12B design must not include private workspace labels')

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

for (const content of [design, authorityDesign, roadmap]) {
  for (const marker of mojibakeMarkers) {
    assert(!content.includes(marker), `Mojibake marker found: ${marker}`)
  }
}

console.log('F23.12B Global Internal Console docs smoke: PASS')
