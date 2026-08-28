import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildC56CreateRequestCommand,
  buildC56PostMovementCommand,
  buildC56SaveItemCommand,
  canWriteC56InventorySharedTruth,
  createC56InventoryRetryFingerprint,
  mutateC56InventorySharedTruth,
  pullC56InventorySharedTruth,
} from '../src/cloud-authoritative-inventory.js'
import {
  getC56LegacyInventoryManifestKey,
  inspectAndQuarantineC56LegacyInventory,
} from '../src/legacy-inventory-quarantine.js'
import { sampleInventoryItems } from '../src/inventory-data.js'
import { sampleInventoryRequests } from '../src/inventory-request-data.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const root = process.cwd()
const paths = {
  migration: 'supabase/migrations/202608140009_c5_6_inventory_authoritative_shared_truth.sql',
  adapter: 'src/cloud-authoritative-inventory.js',
  legacy: 'src/legacy-inventory-quarantine.js',
  main: 'src/main.js',
  inventoryModule: 'src/inventory-module.js',
  report: 'docs/c5-6-inventory-authoritative-shared-truth.md',
  qa: 'tests/c5-6-inventory-authoritative-shared-truth-local-db-qa.js',
}
for (const path of Object.values(paths)) assert(existsSync(join(root, path)), `Missing C5.6 artifact: ${path}`)
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex').toUpperCase()
const content = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, read(path)]))
const includesAll = (source, tokens, label) => {
  tokens.forEach((token) => assert(source.includes(token), `${label}: missing ${token}`))
}
const excludesAll = (source, tokens, label) => {
  tokens.forEach((token) => assert(!source.includes(token), `${label}: forbidden ${token}`))
}

const inheritedHashes = new Map([
  ['20260722000000_remote_schema.sql', '55FF5BBEA43BD236CBD5E7729849F0742CB310E88B6D9926FF7BCA307425AB31'],
  ['20260722000100_transaction_images_bucket_prerequisite.sql', 'B390417734E1A308F189E8C06FBE480084C5EEC5C64B1CBC5FBF51D360522B62'],
  ['202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql', '0B470519BE78BAD892E5E483A22466C22FF089CE96B9A58FD7806A50992F77BD'],
  ['202607280001_f23_11e_staff_document_private_attachments.sql', 'E95D0171E667F61661AE69AB15CB898638B2CEDC9C726E4BA0D6A370037C3C9C'],
  ['202607280002_f23_11e_1_staff_document_attachment_replace_version_history.sql', 'CEF01BDC82B5F59323A6C807ACE7DBE3CEF8C11DD2B382FC2E18EC02827DB1E8'],
  ['202607280003_f23_11e_2_staff_document_attachment_removal_cleanup_legal_hold.sql', '2EBA642C6AB79E9EB6A22782FF4B9104F55369D74CEB1E9E0D5EADB6B5433984'],
  ['202607310001_f23_3e_p1a_canonical_crm_schema_and_control_root.sql', '81CC20F0952CCBB109BFD7571F05D62F9BEAD26C6915B76A68C2ADEF1F9AD9C6'],
  ['202607310002_f23_3e_p1b_conversion_request_draft_and_scoped_idempotency_runtime.sql', 'BB9F6FFBC225DE9EB63C262083A3887241211CBC4DF9253DA9ED4E3D5A52BC9F'],
  ['202608100001_f23_3e_p1c_transactional_audit_and_durable_outbox_runtime.sql', '210DBF731912BBACE0DA847B805CEB42C001DE2CC968FE6EE5562519A64205FA'],
  ['202608100002_f23_3e_p1d_typed_crm_service_operations_runtime.sql', 'BAE3968BF042C880865D17CAD1D8369F46E366CD990D5194361E0DF043A63722'],
  ['202608100003_f23_3e_p1e_rls_read_masking_and_import_readiness.sql', '33B502519901449AD9661C4F54579C7667399775B9CF9859E1832F5B5E4D0F19'],
  ['202608110001_f23_3e_p2a_identity_review_mutex_reservation_schema_foundation.sql', '55BBEB5B3500E41E7658EFC2FCE0A63E4D2CB7F6C32AE619A55E5D464FB37773'],
  ['202608110002_f23_3e_p2b_versioned_normalization_and_exact_center_masked_candidate_search.sql', 'F9CE4F514DCCAD17B0BAF476C709E8E8005A91E06B81C93F4800C484F61F989B'],
  ['202608110003_f23_3e_p2c_reviewed_match_decision_and_create_new_reservation_typed_runtime.sql', '7334E762FFE21DE2880BF5E3E29196CE66D4CB0B265E86D74EEDC43D4334BA46'],
  ['202608120001_f23_3e_p3b_fresh_step_up_final_capability_and_single_use_conversion_authority_runtime.sql', '8232FFD8EF0A63FB60E2A3FDE957EC542A3F196DA4272BF420FF7F3E98F099F0'],
  ['202608120002_f23_3e_p3c_canonical_student_guardian_binding_relationship_runtime.sql', '70B3FA5416D2B045EBB615032A3708302871149B86DF171B633F3429B18B206A'],
  ['202608120003_f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa.sql', 'F3FB385FA3564E05656C6093C86F14492893F3B3B57777286A1CE11728979CC3'],
  ['202608130001_f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation.sql', '1683C22BE216CDBF33C6424F849933523BFE61C01349D66E2BFD9FCF87119EAC'],
  ['202608130002_f23_3e_p4b_safe_server_bridge_auth_step_up_conversion_ui_legacy_projection.sql', '677156C5393BA813B6B95E52BC0ECE6F8C79672AF43DD5ED649BF57EA9E9959F'],
  ['202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql', '2F6C19E4C77611D2FB89A5AACB856D2AE667C6CCD3224778B23D93367E873754'],
  ['202608140001_c5_2_attendance_tuition_authoritative_shared_truth.sql', '3F61DF80CF2F71673C0B22D888C8BEB4E32416D59F750544DCCD181E2E97A414'],
  ['202608140002_c5_2_baseline_singleton_review_hardening.sql', '76E0D817D8A325CB3CECF3C3FF84F74C6CE91E5F37919C297C1AEF44EEBB9BF7'],
  ['202608140003_c5_3_crm_authoritative_shared_truth.sql', '200E5E72E05680E7CF46F57A25A6F0AC61B23F16F04C98AD3630B6590A398E80'],
  ['202608140004_c5_3_independent_review_identity_candidate_audit_hardening.sql', '8C458EEC66AE60CA8E94013A09B9084A7A6A727F16BD02718230F3FE0A076247'],
  ['202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql', '60E0B7114231172738E037F50A4EECB9C6345786E4D6CEF91A5DADD6B5C71F27'],
  ['202608140006_c5_4_reconciliation_currentness_hardening.sql', 'EA0C398D79B16B798A2BF8AD9C857B96B223DFB26202DCA2B9165D871BA97993'],
  ['202608140007_c5_5_staff_hr_authoritative_shared_truth.sql', '63642029F0C6FA298EFCD9577C50F8FB4FD7F93F44190A24EEC602AE064D992C'],
  ['202608140008_c5_5_independent_review_access_projection_attachment_hardening.sql', '932CB8B12F25465D0CA685F303BD24B2F5B4A665CD1C5D493C10E6EDBE55D34F'],
])
assert.equal(inheritedHashes.size, 28)
for (const [name, hash] of inheritedHashes) {
  assert.equal(sha256(`supabase/migrations/${name}`), hash, `Inherited migration drift: ${name}`)
}

includesAll(content.migration, [
  'create table public.center_inventory_items',
  'create table public.center_inventory_movements',
  'create table public.center_inventory_requests',
  'create table public.center_inventory_audit_events',
  'create table public.center_inventory_command_results',
  'force row level security',
  'revoke all on table public.center_inventory_items from public, anon, authenticated, service_role',
  'create or replace function public.c5_6_list_inventory_shared_truth',
  'create or replace function public.c5_6_mutate_inventory_shared_truth',
  "v_role not in ('owner', 'admin', 'center_admin', 'qtv')",
  "'VERSION_STALE'", "'IDEMPOTENCY_CONFLICT'", "'NEGATIVE_STOCK'",
  "'INVALID_WORKFLOW_TRANSITION'", "e.entity_type = 'student'",
  'before_quantity', 'after_quantity', 'actor_membership_id',
  'grant execute on function public.c5_6_list_inventory_shared_truth(text) to authenticated',
], 'C5.6 SQL contract')
excludesAll(content.migration, [
  'insert into public.center_members',
  'insert into auth.users',
  'insert into public.center_cloud_entities',
  'insert into public.center_cashflow',
  'insert into public.center_finance',
  'requested_by_phone',
  'delete from public.center_inventory',
  'alter publication supabase_realtime',
], 'C5.6 SQL boundaries')

includesAll(content.main, [
  "from './cloud-authoritative-inventory.js'",
  "from './legacy-inventory-quarantine.js'",
  'refreshC56InventorySharedTruth',
  "reason: 'module-open'",
  "reason: 'module-reopen'",
  "reason: 'manual-refresh'",
  'writeC56InventoryCommand',
  'Thay đổi đã được lưu và danh sách Kho hàng đã được cập nhật.',
  'inventoryItems = result.items.filter((item) => !item.isArchived)',
  "resetC56InventoryRuntimeForAccessBoundary('')",
], 'C5.6 runtime')
excludesAll(content.main, [
  'getStoredInventory(', 'getStoredInventoryMovements(', 'getStoredInventoryRequests(',
  'saveStoredInventory(', 'saveStoredInventoryMovements(', 'saveStoredInventoryRequests(',
  'inventoryItems = [nextItem', 'inventoryMovements = [movement',
], 'C5.6 no browser authority')
assert.equal((content.main.match(/syncInventoryMovementToCashflow\(/g) || []).length, 1,
  'Inventory→Finance helper must remain disabled and uncalled')
const inventorySubwindowBlock = content.main.slice(
  content.main.indexOf('function openInventorySubwindow'),
  content.main.indexOf('function openStudentDetailWindow', content.main.indexOf('function openInventorySubwindow')),
)
assert(inventorySubwindowBlock.includes("refreshC56InventorySharedTruth({ reason: 'movement-history-open' })"))
const tuitionPaymentOpenBlock = content.main.slice(
  content.main.indexOf('function openTuitionPaymentForm'),
  content.main.indexOf('function openTuitionPaymentSourceTransaction'),
)
assert(!tuitionPaymentOpenBlock.includes('refreshC56InventorySharedTruth'),
  'Tuition form must not trigger an unrelated Inventory refresh')
includesAll(content.inventoryModule, [
  'data-inventory-action="refresh-authoritative"',
  'Chỉ thay đổi qua thao tác Nhập/Xuất kho.',
  'Tài khoản đang đăng nhập',
  'không tự trừ tồn kho hoặc tạo nhập/xuất kho',
], 'C5.6 Inventory UX boundary')

assert.equal(canWriteC56InventorySharedTruth({ role: 'owner' }).ok, true)
assert.equal(canWriteC56InventorySharedTruth({ role: 'center_admin' }).ok, true)
assert.equal(canWriteC56InventorySharedTruth({ role: 'qtv' }).ok, true)
assert.equal(canWriteC56InventorySharedTruth({ role: 'teacher' }).ok, false)

const itemDraft = {
  name: 'Bộ cờ C5.6', category: 'Bàn cờ / quân cờ', unit: 'Bộ', quantity: 5,
  lowStockThreshold: 1, condition: 'Đang dùng', location: 'Kho A', note: '',
}
const createItemOne = buildC56SaveItemCommand(itemDraft)
const createItemTwo = buildC56SaveItemCommand(itemDraft)
assert.equal(createC56InventoryRetryFingerprint(createItemOne), createC56InventoryRetryFingerprint(createItemTwo))
const authoritativeItem = { ...itemDraft, id: crypto.randomUUID(), cloudVersion: 2 }
const movementOne = buildC56PostMovementCommand({
  type: 'out', quantity: 2, movementDate: '2026-08-14', reason: 'Cấp lớp', note: '',
}, authoritativeItem)
const movementTwo = buildC56PostMovementCommand({
  type: 'out', quantity: 2, movementDate: '2026-08-14', reason: 'Cấp lớp', note: '',
}, authoritativeItem)
assert.equal(createC56InventoryRetryFingerprint(movementOne), createC56InventoryRetryFingerprint(movementTwo))
const requestDraft = {
  requestedByName: 'Người đề xuất', requestedByRole: 'Giáo viên', requestedByPhone: 'SECRET-PHONE',
  studentName: 'Lớp A', linkedStudentId: '', itemTypes: ['book'], itemDetails: '2 sách',
  usageModes: ['centerClass'], usageLocationDetail: 'Phòng A', neededDate: '2026-08-20',
  priority: 'normal', adminNote: '',
}
const requestCommand = buildC56CreateRequestCommand(requestDraft)
assert.equal(Object.hasOwn(requestCommand, 'requested_by_phone'), false)
assert.equal(JSON.stringify(requestCommand).includes('SECRET-PHONE'), false)

const emptyPull = await pullC56InventorySharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    items: [], movements: [], requests: [],
  }, error: null }) },
})
assert.equal(emptyPull.ok, true)
assert.deepEqual(emptyPull.items, [])
const malformedPull = await pullC56InventorySharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    items: [{ center_id: 'center-b', id: crypto.randomUUID(), version: 1, quantity: 0,
      low_stock_threshold: 0, status: 'active', name: 'Wrong', category: 'X', unit: 'Cái',
      condition: 'Đang dùng', created_at: '2026-08-14', updated_at: '2026-08-14' }],
    movements: [], requests: [],
  }, error: null }) },
})
assert.equal(malformedPull.ok, false)
assert.equal(malformedPull.outcome_code, 'INVALID_SERVER_RESULT')
assert.equal(Object.hasOwn(malformedPull, 'items'), false)
const validServerItemId = crypto.randomUUID()
const validServerItem = {
  center_id: 'center-a', id: validServerItemId, version: 2, quantity: 3,
  low_stock_threshold: 1, status: 'active', name: 'Valid item', category: 'Khác',
  unit: 'Cái', condition: 'Đang dùng', location: '', note: '',
  created_at: '2026-08-14T00:00:00.000Z', updated_at: '2026-08-14T00:00:00.000Z',
}
const malformedMovementPull = await pullC56InventorySharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    items: [validServerItem],
    movements: [{
      center_id: 'center-a', id: crypto.randomUUID(), item_id: validServerItemId,
      item_name: 'Valid item', movement_type: 'OUT', quantity: 2,
      before_quantity: 3, after_quantity: 2, cost_amount_minor: 0,
      movement_date: '2026-08-14', reason: 'Malformed math', note: '',
      cost_method: '', supplier_name: '', actor_user_id: crypto.randomUUID(),
      actor_membership_id: crypto.randomUUID(), actor_role: 'owner',
      created_at: '2026-08-14T00:00:00.000Z',
    }],
    requests: [],
  }, error: null }) },
})
assert.equal(malformedMovementPull.ok, false)
assert.equal(malformedMovementPull.outcome_code, 'INVALID_SERVER_RESULT')
assert.equal(Object.hasOwn(malformedMovementPull, 'movements'), false)
const malformedRequestPull = await pullC56InventorySharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    items: [validServerItem], movements: [],
    requests: [{
      center_id: 'center-a', id: crypto.randomUUID(), request_code: 'DXK-20260814-0001',
      version: 1, requester_display_name: 'Requester', requester_role_label: '',
      student_display_name: 'Student', linked_student_id: '', item_types: ['book'],
      other_item_text: '', item_details: 'Details', usage_modes: ['centerClass'],
      other_usage_text: '', usage_location_detail: 'Room', needed_date: '2026-08-20',
      priority: 'NORMAL', status: 'BROKEN', admin_note: '',
      created_by_user_id: crypto.randomUUID(), created_by_membership_id: crypto.randomUUID(),
      created_by_role: 'owner', handled_by_user_id: '', handled_by_membership_id: '',
      handled_by_role: '', handled_at: '', created_at: '2026-08-14T00:00:00.000Z',
      updated_at: '2026-08-14T00:00:00.000Z',
    }],
  }, error: null }) },
})
assert.equal(malformedRequestPull.ok, false)
assert.equal(malformedRequestPull.outcome_code, 'INVALID_SERVER_RESULT')
assert.equal(Object.hasOwn(malformedRequestPull, 'requests'), false)
const failedMutation = await mutateC56InventorySharedTruth({
  centerId: 'center-a', command: createItemOne, idempotencyKey: crypto.randomUUID(),
  supabase: { rpc: async () => ({ data: null, error: { message: 'offline' } }) },
})
assert.equal(failedMutation.ok, false)
assert.equal(failedMutation.outcome_code, 'SERVER_COMMAND_FAILED')

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)) }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}
const sampleCenter = 'sample-center'
const sampleStorage = new MemoryStorage({
  [`ichessCenterOS.inventory.${sampleCenter}`]: JSON.stringify(sampleInventoryItems),
  [`ichessCenterOS.inventoryRequests.${sampleCenter}`]: JSON.stringify(sampleInventoryRequests),
  [`ichessCenterOS.inventoryMovements.${sampleCenter}`]: JSON.stringify([]),
})
const fixture = await inspectAndQuarantineC56LegacyInventory({ storage: sampleStorage, centerId: sampleCenter })
assert.equal(fixture.ok, true)
assert.equal(fixture.migrationRequired, false)
assert.equal(fixture.classifications.inventory.classification, 'FIXTURE_SAMPLE')
assert.equal(fixture.classifications.inventoryRequests.classification, 'FIXTURE_SAMPLE')

const realCenter = 'real-center'
const sensitiveMarker = '090-PRIVATE-INVENTORY-LEGACY'
const realKey = `ichessCenterOS.inventoryRequests.${realCenter}`
const realStorage = new MemoryStorage({
  [realKey]: JSON.stringify([{ id: 'real-request', requestedByPhone: sensitiveMarker }]),
})
const quarantine = await inspectAndQuarantineC56LegacyInventory({
  storage: realStorage, centerId: realCenter, now: () => '2026-08-14T00:00:00.000Z',
})
assert.equal(quarantine.ok, true)
assert.equal(quarantine.migrationRequired, true)
const manifestRaw = realStorage.getItem(getC56LegacyInventoryManifestKey(realCenter))
assert(manifestRaw && !manifestRaw.includes(sensitiveMarker))
assert.equal(JSON.parse(manifestRaw).containsRawInventoryPayload, false)
assert(realStorage.getItem(realKey).includes(sensitiveMarker), 'Original exact-center legacy key must remain recoverable')
assert.equal(typeof realStorage.removeItem, 'function')
assert(!content.legacy.includes('removeItem('), 'Quarantine must never delete legacy Inventory')

const emptyServerWithLegacy = await pullC56InventorySharedTruth({
  centerId: realCenter,
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: realCenter,
    items: [], movements: [], requests: [],
  }, error: null }) },
})
assert.equal(emptyServerWithLegacy.ok, true)
assert.deepEqual(emptyServerWithLegacy.requests, [])
assert(realStorage.getItem(realKey).includes(sensitiveMarker))
const nonemptyServerItemId = crypto.randomUUID()
const nonemptyServerWithLegacy = await pullC56InventorySharedTruth({
  centerId: realCenter,
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: realCenter,
    items: [{
      center_id: realCenter, id: nonemptyServerItemId, version: 1, quantity: 4,
      low_stock_threshold: 1, status: 'active', name: 'Server only', category: 'Khác',
      unit: 'Cái', condition: 'Đang dùng', location: '', note: '',
      created_at: '2026-08-14T00:00:00.000Z', updated_at: '2026-08-14T00:00:00.000Z',
    }], movements: [], requests: [],
  }, error: null }) },
})
assert.equal(nonemptyServerWithLegacy.ok, true)
assert.deepEqual(nonemptyServerWithLegacy.items.map((item) => item.id), [nonemptyServerItemId])
assert.deepEqual(nonemptyServerWithLegacy.requests, [])
assert(realStorage.getItem(realKey).includes(sensitiveMarker))

console.log(`C5_6_MIGRATION_SHA256: ${sha256(paths.migration)}`)
console.log('C5_6_INVENTORY_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS')
