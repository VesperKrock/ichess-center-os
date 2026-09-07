import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  INSTALLATION_CAPABILITY_STATUS,
  createInstallationHandoffState,
  ensureInstallationRequestId,
  normalizeInstallationCapability,
  purgeInstallationHandoffState,
} from '../src/first-owner-bootstrap.js'

const read = (path) => readFileSync(path, 'utf8')
const migration = read('supabase/migrations/202609070001_chb_1_first_owner_bootstrap_governance.sql')
const handoffEdge = read('supabase/functions/manage-installation-handoff/index.ts')
const bootstrapEdge = read('supabase/functions/bootstrap-first-owner/index.ts')
const cleanSchema = read('supabase/clean-install/schema.sql')
const frontend = read('src/first-owner-bootstrap.js') + read('src/main.js') + read('src/app-auth.js')
const auth = read('src/supabase-auth.js')
const center = read('src/app-center-binding.js')
const storage = read('src/storage.js')

for (const state of [
  'TESTER_ACTIVE', 'RESET_PREPARED', 'RESET_ARMED', 'RESET_EXECUTING',
  'HISTORY_SEALED', 'SESSION_DRAINING', 'UNINITIALIZED_NEXT_EPOCH',
  'BOOTSTRAP_CLAIMED', 'OPERATIONAL_LOCKED',
]) assert(migration.includes(`'${state}'`), `Missing state ${state}`)

for (const marker of [
  'installation_handoff_control', 'installation_restore_verifications',
  'installation_handoff_commands', 'installation_handoff_scopes',
  'installation_center_epochs', 'installation_session_drain_targets',
  'installation_handoff_events', 'chb1_internal_actor_owns_complete_scope',
  'chb1_prepare_handoff_reset', 'chb1_arm_handoff_reset',
  'chb1_execute_handoff_reset', 'chb1_promote_uninitialized_if_drained',
  'chb1_claim_session_drain',
  'chb1_claim_first_owner', 'chb1_installation_write_fenced',
  "interval '24 hours'", "interval '7 days'",
  'CHUẨN BỊ BÀN GIAO HỆ THỐNG', 'chb1_frozen_manifest_drift',
  'chb1_changed_intent_conflict', 'arg2_activate_center_governance',
  "set status = 'archived'", "set status = 'revoked'",
]) assert(migration.includes(marker), `Missing CHB-1 SQL marker: ${marker}`)

assert.equal(migration.trimStart().startsWith('begin;'), true)
assert.equal(migration.trimEnd().endsWith('commit;'), true)
for (const match of migration.matchAll(/security definer([\s\S]{0,140}?)as \$/gi)) {
  assert(match[1].includes("set search_path = ''"), 'Every SECURITY DEFINER needs an empty search_path.')
}
for (const table of [
  'installation_handoff_control', 'installation_restore_verifications',
  'installation_handoff_commands', 'installation_handoff_scopes',
  'installation_center_epochs', 'installation_session_drain_targets',
  'installation_handoff_events',
]) {
  assert(migration.includes(`alter table public.${table} force row level security`))
  assert(migration.includes(`revoke all on public.${table} from public, anon, authenticated, service_role`))
}
assert(!/delete\s+from\s+(?:auth\.users|public\.centers|public\.center_members|public\.installation_handoff_events)/i.test(migration))
assert(!/delete\s+from\s+storage\.objects/i.test(migration), 'Linked Storage history must not be deleted.')
assert(!/deleteUser\s*\(/.test(handoffEdge + bootstrapEdge), 'Auth hard-delete is forbidden.')
assert(!/console\.(log|info|warn|error)/.test(handoffEdge + bootstrapEdge), 'Edge must not log PII or secrets.')
assert(handoffEdge.includes('auth.admin.updateUserById'))
assert(bootstrapEdge.includes("auth.admin.signOut(token, 'global')"))
assert(handoffEdge.includes("mode === 'prepare'") && handoffEdge.includes("mode === 'execute'"))
assert(bootstrapEdge.includes("mode === 'claim'") && bootstrapEdge.includes("mode === 'drain_previous_session'"))
assert(bootstrapEdge.includes("['PENDING', 'FAILED', 'SUCCEEDED']"),
  'A previously completed target drain must be safely reconcilable after the safety window.')
assert(bootstrapEdge.includes("context.target_drain_state === 'SUCCEEDED'"))
assert(bootstrapEdge.includes('reconcileServerDrainTargets(context)'),
  'The exact bootstrap target must be able to repair unfinished server drains after the resetting Owner is sealed.')
assert(bootstrapEdge.includes("['SESSION_DRAINING', 'RESET_REPAIR_REQUIRED']"),
  'The bootstrap target must resume a durable repair state instead of getting stranded.')
assert(migration.includes("p_actor_user_id is distinct from v_command.target_user_id"),
  'Only the resetting Owner or exact bootstrap target may attest server-side session drain repair.')
assert(migration.includes("v_command.actor_user_id is distinct from p_actor_user_id"),
  'An unrelated caller must not obtain or execute the resetting Owner repair work.')
assert(migration.includes("'server_drain_targets'"),
  'The service-only bootstrap context must expose the bounded drain repair work to the exact target.')
assert(migration.includes("v_control.installation_state in ('SESSION_DRAINING','RESET_REPAIR_REQUIRED')"),
  'A target-side repair state must remain visible as pending session-drain work, never as a dead end.')
assert(handoffEdge.includes('leftIsActor - rightIsActor'),
  'The resetting Owner must be drained last so earlier failures preserve a repair-capable session.')
assert(bootstrapEdge.includes("admin.rpc('chb1_claim_session_drain'") &&
  handoffEdge.includes("admin.rpc('chb1_claim_session_drain'"),
  'Every external session mutation must hold a durable per-target claim.')
assert(migration.includes("drain_state in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')"))
assert(migration.includes("lease_until = pg_catalog.clock_timestamp() + interval '2 minutes'"))
assert(migration.includes('v_target.attempt_id is distinct from p_attempt_id'),
  'A stale or concurrent worker must not record another worker session mutation.')
assert(bootstrapEdge.includes('app_metadata?.handoff_command_id') &&
  handoffEdge.includes('app_metadata?.handoff_command_id'),
  'Lost-response reconciliation must rely on administrator-controlled app metadata.')
assert(!/user_metadata\?\.handoff_command_id|user_metadata:\s*\{[\s\S]{0,160}handoff_command_id/.test(
  bootstrapEdge + handoffEdge,
), 'User-editable metadata must never attest a completed credential rotation.')
assert(frontend.includes('result.sign_in_again !== false'),
  'The client must not repeat a completed global sign-out during drain reconciliation.')
assert(!/SUPABASE_SERVICE_ROLE_KEY/.test(frontend), 'Service role must never enter browser source.')
assert(!/localStorage|sessionStorage/.test(read('src/first-owner-bootstrap.js')), 'Handoff secrets stay memory-only.')
assert(frontend.includes('iChess chưa được khởi tạo'))
assert(frontend.includes('Chuẩn bị bàn giao hệ thống'))
assert(frontend.includes("['FRESH_UNINITIALIZED', 'UNINITIALIZED_NEXT_EPOCH']"),
  'Self-signup must be visible only while the installation is uninitialized.')
assert(auth.includes('client.auth.signUp'), 'The recipient must create their own Auth identity.')
assert(auth.includes("export const CURRENT_CENTER_ID = ''"))
assert(!center.includes('DreamHome'))
assert(storage.includes("const DEFAULT_STORAGE_CENTER_ID = 'unbound'"))
assert(storage.includes('currentInstallationStorageNamespace'))
assert(cleanSchema.includes("raise exception 'owner_membership_required'"),
  'Legacy center creation must still require an existing active Owner.')
assert(migration.includes('chb1_supabase_storage_platform_required'))
assert(migration.includes("'staff-administrative-documents'"))
assert(migration.includes("'transaction-images'"))
assert(migration.includes('drop policy if exists "members can view transaction attachments"'))
assert(migration.includes('drop policy if exists "members can view transaction images"'))
assert(!/insert\s+into\s+storage\.objects/i.test(migration), 'CHB-1 must not seed Storage objects.')

const failClosed = normalizeInstallationCapability({ state: 'TESTER_ACTIVE' })
assert.equal(failClosed, null, 'Incomplete capability payload must fail closed.')
assert(frontend.includes(': INSTALLATION_CAPABILITY_STATUS.FAILED'),
  'A network or validation failure must stay failed and never imply an uninitialized installation.')
assert.equal(normalizeInstallationCapability({ state: 'TESTER_ACTIVE', control_version: 1 }), null,
  'A capability without an installation epoch must fail closed.')
const ready = normalizeInstallationCapability({
  state: 'UNINITIALIZED_NEXT_EPOCH', control_version: 4,
  bootstrap_available: true, target_session_drain_completed: true, installation_epoch: 2,
})
assert.equal(ready.bootstrapAvailable, true)
assert.equal(ready.targetSessionDrainCompleted, true)
assert.equal(ready.installationEpoch, 2)
const memory = { ...createInstallationHandoffState(), requestId: 'secret-request', displayOnceHandoffCode: 'secret' }
const purged = purgeInstallationHandoffState(memory)
assert.equal(purged.capabilityStatus, INSTALLATION_CAPABILITY_STATUS.IDLE)
assert.equal(purged.requestId, '')
assert.equal(purged.displayOnceHandoffCode, '')
const continuing = ensureInstallationRequestId(createInstallationHandoffState(), 'handoff-reset')
assert.match(continuing.requestId, /^handoff-reset-/)
assert.equal(ensureInstallationRequestId(continuing, 'handoff-reset').requestId, continuing.requestId,
  'A lost-response retry must keep the same in-memory request ID.')
assert(frontend.includes('await refreshInstallationHandoffCapability(syncId)'))
assert(frontend.includes("await syncCloudUser(null, { force: true, reason: 'handoff-reset-history-sealed' })"),
  'A completed reset response must immediately purge the old Owner session and browser projections.')
assert(frontend.includes("setCurrentStorageCenterId('')"))
assert(frontend.includes("getSupabaseInstallationNamespace()}-unresolved"))

console.log('CHB-1 handoff/bootstrap contract smoke: PASS')
