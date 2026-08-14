import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildC54ArchiveCategoryCommand,
  buildC54CloseReconciliationCommand,
  buildC54SaveCategoryCommand,
  buildC54SaveSettingsCommand,
  buildC54SaveTransactionCommand,
  buildC54UpsertReconciliationCommand,
  buildC54VoidTransactionCommand,
  canWriteC54FinanceSharedTruth,
  createC54FinanceRetryFingerprint,
  mutateC54FinanceSharedTruth,
  projectC54CashbookReconciliation,
  projectC54CashbookSettings,
  projectC54FinanceCategory,
  projectC54FinanceTransaction,
  pullC54FinanceSharedTruth,
} from '../src/cloud-authoritative-finance.js'
import {
  C54_LEGACY_FINANCE_SCOPES,
  getC54LegacyFinanceSnapshotKey,
  inspectAndQuarantineC54LegacyFinance,
} from '../src/legacy-finance-quarantine.js'
import { sampleCashflowCategories, sampleCashflowTransactions } from '../src/cashflow-data.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const root = process.cwd()
const paths = {
  migration: 'supabase/migrations/202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql',
  hardening: 'supabase/migrations/202608140006_c5_4_reconciliation_currentness_hardening.sql',
  adapter: 'src/cloud-authoritative-finance.js',
  legacy: 'src/legacy-finance-quarantine.js',
  main: 'src/main.js',
  cashflow: 'src/cashflow-module.js',
  cashbook: 'src/cashbook-module.js',
  attachments: 'src/transaction-attachments.js',
  report: 'docs/c5-4-finance-cashbook-authoritative-shared-truth.md',
  qa: 'tests/c5-4-finance-cashbook-authoritative-shared-truth-local-db-qa.js',
}
for (const path of Object.values(paths)) assert(existsSync(join(root, path)), `Missing C5.4 artifact: ${path}`)
const read = (path) => readFileSync(join(root, path), 'utf8')
const sha256 = (path) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex').toUpperCase()
const content = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, read(path)]))
const includesAll = (source, tokens, label) => {
  for (const token of tokens) assert(source.includes(token), `${label}: missing ${token}`)
}
const excludesAll = (source, tokens, label) => {
  for (const token of tokens) assert(!source.includes(token), `${label}: forbidden ${token}`)
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
])
assert.equal(inheritedHashes.size, 24)
for (const [name, hash] of inheritedHashes) {
  assert.equal(sha256(`supabase/migrations/${name}`), hash, `Inherited migration drift: ${name}`)
}

includesAll(content.migration, [
  'create table public.finance_category',
  'create table public.finance_transaction',
  'amount_minor bigint not null',
  "status text not null default 'POSTED'",
  'create table public.finance_cashbook_settings',
  'opening_balance_minor bigint not null',
  'create table public.finance_reconciliation',
  'create table public.finance_transaction_attachment_binding',
  'references public.transaction_attachments(center_id, id)',
  'create table public.finance_audit_event',
  'create table public.finance_command_result',
  'force row level security',
  'revoke all on table public.%I from public, anon, authenticated, service_role',
  'create function public.c5_4_list_finance_shared_truth',
  'create function public.c5_4_mutate_finance_shared_truth',
  "pg_catalog.lower(cm.role) in ('owner', 'admin', 'center_admin', 'qtv')",
  "'VERSION_STALE'",
  "'IDEMPOTENCY_CONFLICT'",
  "'CLOSED_PERIOD'",
  "'PROTECTED_TRANSACTION'",
  "'TUITION_PAYMENT_EXCEEDS_OUTSTANDING'",
  'from public.center_cloud_entities e',
  "e.entity_type = 'tuition_record_package'",
  "v_tuition_entity.payload->>'paidAmount'",
  "'ATTACHMENT_NOT_FOUND_OR_DENIED'",
  "'ATTACHMENT_ALREADY_BOUND'",
  "set status = 'VOIDED'",
  "pg_catalog.set_config('ichess.c5_4_attachment_write', 'on', true)",
  "grant execute on function public.c5_4_list_finance_shared_truth(text) to authenticated",
  "grant execute on function public.c5_4_mutate_finance_shared_truth(text, jsonb, uuid) to authenticated",
], 'C5.4 SQL contract')
excludesAll(content.migration, [
  'alter publication supabase_realtime',
  'delete from public.finance_transaction',
  'grant select on table public.finance_transaction',
  'to anon;',
], 'C5.4 fail-closed SQL')

includesAll(content.hardening, [
  'create function public.c5_4_guard_reconciliation_currentness()',
  "'c5.4.cashbook|' || new.center_id",
  "old.status = 'OPEN' and new.status = 'CLOSED'",
  'new.system_closing_balance_minor := v_system_closing_balance::bigint',
  'new.difference_minor := v_difference::bigint',
  'c5_4_closed_period_reconciliation_denied',
  'before insert or update on public.finance_reconciliation',
  'from public, anon, authenticated, service_role',
], 'C5.4 reconciliation close currentness hardening')

includesAll(content.adapter, [
  "supabase.rpc('c5_4_list_finance_shared_truth'",
  "supabase.rpc('c5_4_mutate_finance_shared_truth'",
  "operation: version > 0 ? 'UPDATE_TRANSACTION' : 'CREATE_TRANSACTION'",
  "operation: 'VOID_TRANSACTION'",
  "operation: 'ARCHIVE_CATEGORY'",
  "operation: 'UPSERT_SETTINGS'",
  "operation: 'UPSERT_RECONCILIATION'",
  "operation: 'CLOSE_RECONCILIATION'",
  'amount_minor: requireMoneyMinor(transaction.amount)',
], 'C5.4 adapter')
excludesAll(content.adapter, ['localStorage', 'saveStoredCashflow'], 'C5.4 adapter local boundary')

includesAll(content.legacy, [
  "'cashflow'", "'cashflowCategories'", "'cashbookSettings'", "'cashbookReconciliations'",
  "classification: 'FIXTURE_SAMPLE'", "classification: 'RECONSTRUCTABLE_CACHE'",
  "classification: 'REAL_LOCAL_ONLY'", "classification: 'UNCERTAIN'",
  "authorityStatus: 'QUARANTINED_NOT_ACTIVE'", "migrationStatus: 'MIGRATION_REQUIRED'",
  "SHA-256:${checksum}",
], 'C5.4 legacy quarantine')
excludesAll(content.legacy, ['supabase', '.rpc(', ".from('"], 'No silent legacy upload')

includesAll(content.main, [
  'let cashflowTransactions = []',
  'let cashflowCategories = []',
  'inspectAndQuarantineC54LegacyFinance',
  'async function refreshC54FinanceSharedTruth',
  'async function writeC54FinanceCommand',
  'pullC54FinanceSharedTruth',
  'mutateC54FinanceSharedTruth',
  "refreshC54FinanceSharedTruth({ reason: 'module-open' })",
  "refreshC54FinanceSharedTruth({ reason: 'module-reopen' })",
  "refreshC54FinanceSharedTruth({ reason: 'manual-refresh' })",
  "refreshC54FinanceSharedTruth({ reason: 'after-server-commit', silent: true })",
  'buildC54SaveTransactionCommand(nextTransaction',
  "reason: 'tuition-payment-finance-commit'",
  'attachmentIntent: getC54AttachmentRetryIntent(stagedFile)',
  'uploadedAttachmentId !== authoritativeResult.effectiveAttachmentId',
  'buildC54VoidTransactionCommand(transaction)',
  'buildC54ArchiveCategoryCommand(category)',
  'buildC54SaveSettingsCommand(nextSettings)',
  'buildC54UpsertReconciliationCommand(nextReconciliation)',
  'buildC54CloseReconciliationCommand(currentReconciliation)',
  'const replayMatches = [',
  'Payment/source này đã commit với nội dung khác',
  'file private được giữ lại, không silent-delete chứng từ tài chính',
], 'C5.4 UI integration')
excludesAll(content.main, [
  'getStoredCashflow', 'readStoredCashflow', 'saveStoredCashflow',
  'getStoredCashflowCategories', 'saveStoredCashflowCategories',
  'getStoredCashbookSettings', 'saveStoredCashbookSettings',
  'getStoredCashbookReconciliations', 'saveStoredCashbookReconciliations',
], 'No active legacy Finance authority in main')
assert(content.main.indexOf('mutateC54FinanceSharedTruth')
  < content.main.indexOf("refreshC54FinanceSharedTruth({ reason: 'after-server-commit', silent: true })"))
includesAll(content.cashflow, ['data-cashflow-action="refresh-authoritative"', 'finance-shared-truth-notice'], 'Cashflow refresh UX')
includesAll(content.cashbook, ['data-cashbook-action="refresh-authoritative"', 'finance-shared-truth-notice'], 'Cashbook refresh UX')
includesAll(content.attachments, ["['owner', 'admin', 'center_admin', 'qtv']"], 'Attachment role parity')

assert.equal(canWriteC54FinanceSharedTruth({ role: 'owner' }).ok, true)
assert.equal(canWriteC54FinanceSharedTruth({ role: 'center_admin' }).ok, true)
assert.equal(canWriteC54FinanceSharedTruth({ role: 'teacher' }).ok, false)

const category = projectC54FinanceCategory({
  id: '11111111-1111-4111-8111-111111111111', name: 'Manual', category_type: 'BOTH',
  is_archived: false, version: 2,
})
assert.equal(category.cloudVersion, 2)
const transaction = projectC54FinanceTransaction({
  id: '22222222-2222-4222-8222-222222222222', transaction_code: 'TC-20260814-0001',
  cashflow_type: 'INCOME', category_id: category.id, category_name: category.name,
  amount_minor: 123456, transaction_date: '2026-08-14', method: 'Cash', status: 'POSTED',
  version: 3, attachments: [],
})
assert.equal(transaction.amount, 123456)
assert.equal(transaction.cloudVersion, 3)
assert.throws(() => buildC54SaveTransactionCommand({ ...transaction, amount: 1.5 }, { category }), /số nguyên/i)
assert.equal(buildC54SaveTransactionCommand(transaction, { category }).operation, 'UPDATE_TRANSACTION')
assert.equal(buildC54VoidTransactionCommand(transaction).expected_version, 3)
assert.equal(buildC54SaveCategoryCommand(category).operation, 'UPDATE_CATEGORY')
assert.equal(buildC54ArchiveCategoryCommand(category).operation, 'ARCHIVE_CATEGORY')
assert.equal(buildC54SaveSettingsCommand({ openingBalance: 0, openingDate: '2026-08-14' }).operation, 'UPSERT_SETTINGS')
const projectedSettings = projectC54CashbookSettings(null, [transaction])
assert.equal(projectedSettings.isConfigured, false)
assert.equal(projectedSettings.openingDate, '2026-08-14')
const reconciliation = projectC54CashbookReconciliation({
  id: '33333333-3333-4333-8333-333333333333', reconciliation_date: '2026-08-14',
  system_closing_balance_minor: 123456, actual_cash_minor: 123456, difference_minor: 0,
  status: 'OPEN', checked_by_name: 'Owner', version: 1,
})
assert.equal(buildC54UpsertReconciliationCommand(reconciliation).expected_version, 1)
assert.equal(buildC54CloseReconciliationCommand(reconciliation).operation, 'CLOSE_RECONCILIATION')
const retryTransactionA = buildC54SaveTransactionCommand({
  ...transaction, id: 'local-retry-a', localSourceId: 'local-retry-a', cloudVersion: 0,
}, {
  category,
  attachmentAction: 'BIND',
  attachmentId: '55555555-5555-4555-8555-555555555555',
})
const retryTransactionB = buildC54SaveTransactionCommand({
  ...transaction, id: 'local-retry-b', localSourceId: 'local-retry-b', cloudVersion: 0,
}, {
  category,
  attachmentAction: 'BIND',
  attachmentId: '66666666-6666-4666-8666-666666666666',
})
assert.equal(
  createC54FinanceRetryFingerprint(retryTransactionA, { attachmentIntent: 'same-file' }),
  createC54FinanceRetryFingerprint(retryTransactionB, { attachmentIntent: 'same-file' }),
)
assert.notEqual(
  createC54FinanceRetryFingerprint(retryTransactionA, { attachmentIntent: 'same-file' }),
  createC54FinanceRetryFingerprint(retryTransactionB, { attachmentIntent: 'changed-file' }),
)
assert.notEqual(
  createC54FinanceRetryFingerprint(retryTransactionA, { attachmentIntent: 'same-file' }),
  createC54FinanceRetryFingerprint({ ...retryTransactionB, amount_minor: 123457 }, { attachmentIntent: 'same-file' }),
)

const mockRead = await pullC54FinanceSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'READ_OK', center_id: 'center-a', categories: [], transactions: [],
    settings: null, reconciliations: [],
  }, error: null }) },
})
assert.equal(mockRead.ok, true)
assert.equal(mockRead.transactions.length, 0)
const invalidMockRead = await pullC54FinanceSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'READ_OK', center_id: 'center-a', categories: [],
    transactions: [{ id: 'malformed' }], settings: null, reconciliations: [],
  }, error: null }) },
})
assert.equal(invalidMockRead.ok, false)
assert.equal(invalidMockRead.outcome_code, 'INVALID_SERVER_RESULT')
let calls = 0
const mockMutation = await mutateC54FinanceSharedTruth({
  centerId: 'center-a', idempotencyKey: '44444444-4444-4444-8444-444444444444',
  command: { operation: 'UPSERT_SETTINGS' },
  supabase: { rpc: async () => { calls += 1; return { data: null, error: { message: 'offline' } } } },
})
assert.equal(mockMutation.ok, false)
assert.equal(mockMutation.outcome_code, 'SERVER_COMMAND_FAILED')
assert.equal(calls, 1)

class MemoryStorage {
  constructor(entries = {}) { this.items = new Map(Object.entries(entries)) }
  getItem(key) { return this.items.has(String(key)) ? this.items.get(String(key)) : null }
  setItem(key, value) { this.items.set(String(key), String(value)) }
}
const centerId = 'legacy-center'
const fixtureEntries = Object.fromEntries(C54_LEGACY_FINANCE_SCOPES.map((scope) => [
  `ichessCenterOS.${scope}.${centerId}`,
  JSON.stringify(scope === 'cashflow' ? sampleCashflowTransactions
    : scope === 'cashflowCategories' ? sampleCashflowCategories
      : scope === 'cashbookSettings' ? { openingBalance: 0, isConfigured: false }
        : []),
]))
const fixtureResult = await inspectAndQuarantineC54LegacyFinance({ storage: new MemoryStorage(fixtureEntries), centerId })
assert.equal(fixtureResult.ok, true)
assert.equal(fixtureResult.migrationRequired, false)

const realTransactionRaw = JSON.stringify([{ id: 'real-1', type: 'income', amount: 987654 }])
const realStorage = new MemoryStorage({
  [`ichessCenterOS.cashflow.${centerId}`]: realTransactionRaw,
  [`ichessCenterOS.cashbookSettings.${centerId}`]: JSON.stringify({ openingBalance: 500000, isConfigured: true }),
})
const realResult = await inspectAndQuarantineC54LegacyFinance({
  storage: realStorage, centerId, now: () => '2026-08-14T00:00:00.000Z',
})
assert.equal(realResult.ok, true)
assert.equal(realResult.migrationRequired, true)
assert.equal(realResult.snapshot.authorityStatus, 'QUARANTINED_NOT_ACTIVE')
assert.equal(realResult.snapshot.summary.transactionCount, 1)
assert.equal(realResult.snapshot.sources.cashflow.raw, realTransactionRaw)
assert.equal(realStorage.getItem(`ichessCenterOS.cashflow.${centerId}`), realTransactionRaw)
const snapshotRaw = realStorage.getItem(getC54LegacyFinanceSnapshotKey(centerId))
realStorage.setItem(`ichessCenterOS.cashflow.${centerId}`, JSON.stringify([{ id: 'changed' }]))
const replayedSnapshot = await inspectAndQuarantineC54LegacyFinance({ storage: realStorage, centerId })
assert.equal(replayedSnapshot.preserved, true)
assert.equal(realStorage.getItem(getC54LegacyFinanceSnapshotKey(centerId)), snapshotRaw)
const otherCenterId = 'legacy-center-b'
const otherCenterStorage = new MemoryStorage({
  [`ichessCenterOS.cashflow.${otherCenterId}`]: JSON.stringify([{ id: 'real-b', type: 'expense', amount: 123 }]),
})
const otherCenterResult = await inspectAndQuarantineC54LegacyFinance({
  storage: otherCenterStorage, centerId: otherCenterId,
})
assert.equal(otherCenterResult.ok, true)
assert.equal(otherCenterResult.migrationRequired, true)
assert.notEqual(otherCenterResult.snapshotKey, realResult.snapshotKey)
assert.equal(otherCenterResult.snapshot.centerId, otherCenterId)
assert.equal(realResult.snapshot.centerId, centerId)

console.log(`C5_4_MIGRATION_SHA256=${sha256(paths.migration)}`)
console.log(`C5_4_HARDENING_MIGRATION_SHA256=${sha256(paths.hardening)}`)
console.log('C5_4_FINANCE_CASHBOOK_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS')
