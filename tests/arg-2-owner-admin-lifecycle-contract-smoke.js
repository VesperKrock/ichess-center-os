import assert from 'node:assert/strict'
import { createHash, randomUUID, webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import {
  ACCOUNT_GOVERNANCE_CAPABILITY,
  clearEphemeralLifecycleState,
  createAccountGovernanceCapability,
  isAccountGovernanceReady,
  isCredentialChangeRequired,
  isMembershipBusinessReady,
  normalizeAccountGovernanceCapability,
  validateReviewedAccountEmail,
} from '../src/account-lifecycle.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const read = (path) => readFileSync(path, 'utf8')
const migrationPath = 'supabase/migrations/202609050001_arg_2_owner_admin_lifecycle_governance.sql'
const migration = read(migrationPath)
const main = read('src/main.js')
const auth = read('src/supabase-auth.js')
const lifecycle = read('src/account-lifecycle.js')
const edgePaths = [
  'supabase/functions/list-center-admin-accounts/index.ts',
  'supabase/functions/provision-center-admin-account/index.ts',
  'supabase/functions/reset-center-admin-password/index.ts',
  'supabase/functions/revoke-center-admin-access/index.ts',
  'supabase/functions/restore-center-admin-access/index.ts',
  'supabase/functions/complete-account-credential-change/index.ts',
  'supabase/functions/manage-owner-handoff/index.ts',
  'supabase/functions/manage-owner-recovery/index.ts',
]
const edges = edgePaths.map(read).join('\n')

for (const marker of [
  'create table public.center_access_governance',
  'create table public.account_governance_subjects',
  'create table public.account_governance_commands',
  'create table public.account_governance_events',
  'create table public.account_credential_gates',
  'create table public.account_recovery_custodians',
  'create table public.account_recovery_approvals',
  'on delete restrict',
  'force row level security',
  'arg2_exactly_one_active_owner_required',
  'arg2_at_most_one_active_admin_required',
  'arg2_raw_admin_not_allowed',
  'arg2_idempotency_intent_conflict',
  "state in ('prepared', 'finalized', 'repair_required', 'cancelled')",
  "status = 'revoke_pending'",
  "status = 'reset_required'",
  "status = 'restore_pending'",
  "set role = 'former_owner', status = 'revoked'",
  "set role = 'owner', status = 'active'",
  'arg2_two_custodian_approvals_required',
  'arg2_two_independent_recovery_custodians_required',
  'arg2_shared_owner_recovery_requires_coordinated_plan',
  'arg2_governance_audit_is_append_only',
  'revoke maintain, references, trigger, truncate, update, delete',
  'arg2_session_invalidation_required_before_cancel',
  'account_governance_commands_repair_code_safe',
  'guessed or altered center IDs fail the whole request closed',
  "v_operation := 'already_complete'",
  "v_operation := 'resume_database_finalize'",
  "v_operation := 'resume_session_invalidation'",
  'TARGET_CREDENTIAL_READY_RECONCILED',
]) assert(migration.includes(marker), `Missing ARG-2 SQL marker: ${marker}`)

assert.equal(migration.trimStart().startsWith('begin;'), true, 'ARG-2 migration must be transactional.')
assert.equal(migration.trimEnd().endsWith('commit;'), true, 'ARG-2 migration must commit atomically.')
for (const match of migration.matchAll(/security definer([\s\S]{0,120}?)as \$/gi)) {
  assert(match[1].includes("set search_path = ''"), 'Every SECURITY DEFINER function needs an empty search_path.')
}

for (const table of [
  'center_access_governance',
  'account_governance_subjects',
  'account_governance_commands',
  'account_governance_events',
  'account_credential_gates',
  'account_recovery_custodians',
  'account_recovery_approvals',
]) {
  assert(migration.includes(`revoke all on public.${table} from public, anon, authenticated, service_role`))
}

assert(!/delete\s+from\s+(?:public\.)?center_members/i.test(migration))
assert(!/deleteUser\s*\(/.test(edges), 'ARG-2 must never hard-delete an Auth identity.')
assert(!/\.from\(['"]center_members['"]\)[\s\S]{0,120}\.(insert|update|delete|upsert)\s*\(/.test(edges))
assert(!/admin\.\$\{|admin\.[a-z0-9_-]+@ichess\.vn/i.test(edges + main))
assert(edges.includes('auth.admin.updateUserById'), 'Supported password rotation must revoke target refresh sessions.')
assert(read('supabase/functions/manage-owner-handoff/index.ts').includes("auth.admin.signOut(token, 'global')"))
assert(edges.includes("arg2_prepare_lifecycle_command"))
assert(edges.includes("arg2_mark_command_repair_required"))
assert(edges.includes("arg2_finalize_session_invalidation"))
assert(!/console\.(log|info|warn|error)/.test(edges), 'Lifecycle Edge Functions must not log credentials or PII.')
assert(read('supabase/functions/manage-owner-handoff/index.ts').includes('body.repair !== true'))
assert(read('supabase/functions/manage-owner-handoff/index.ts').includes('governance_command_id: prepared.command_id'))
for (const path of [
  'supabase/functions/reset-center-admin-password/index.ts',
  'supabase/functions/restore-center-admin-access/index.ts',
  'supabase/functions/manage-owner-handoff/index.ts',
]) {
  const source = read(path)
  assert(source.includes('candidate_credential_reissue_required'), `${path} must reconcile a lost response.`)
  assert(source.includes("['prepared', 'repair_required']"), `${path} must resume the same durable command.`)
}
const revoke = read('supabase/functions/revoke-center-admin-access/index.ts')
assert(revoke.includes("prepared.state === 'finalized' && prepared.stage === 'complete'"))
assert(revoke.includes('session_invalidation_reissue_required'))
assert(revoke.includes('authAlreadyCommitted'), 'Revoke retry must reconcile committed Auth state before rotating again.')
const completeCredential = read('supabase/functions/complete-account-credential-change/index.ts')
assert(completeCredential.includes("operation === 'already_complete'"))
assert(completeCredential.includes("operation !== 'resume_session_invalidation'"))
assert(completeCredential.includes('authAlreadyCommitted'),
  'Credential completion retry must recognize the command already committed in Auth.')
assert(completeCredential.includes('invalidationAlreadyCommitted'),
  'Replacement finalization retry must recognize predecessor invalidation already committed in Auth.')
const provision = read('supabase/functions/provision-center-admin-account/index.ts')
assert(provision.includes('invalidationAlreadyCommitted'))
assert(provision.includes("context.state === 'finalized' && context.stage === 'complete'"))
const handoff = read('supabase/functions/manage-owner-handoff/index.ts')
assert(handoff.includes("context.state === 'finalized' && context.stage === 'complete'"))
assert(handoff.includes('invalidationAlreadyCommitted'))
const recovery = read('supabase/functions/manage-owner-recovery/index.ts')
assert(recovery.includes("!['prepared', 'awaiting_credential'].includes(String(context.stage))"))
assert(recovery.includes("context.state === 'finalized' && context.stage === 'complete'"))
assert(recovery.includes('invalidationAlreadyCommitted'))

assert(!main.includes('ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS'))
assert(main.includes("status: admin?.capability || 'failed'"), 'Missing server capability must fail closed.')
assert(!main.includes("status: admin?.capability || 'ready'"), 'Legacy/malformed response must never imply READY.')
assert(main.includes("ownedCenterIds.has(centerId)"), 'Governance capability lookup must request owned centers only.')
assert(main.includes("target_email: reviewedEmail.email"))
assert(main.includes("completeRequiredCredentialChange"))
assert(main.includes("data-required-credential-change-form"))
assert(main.includes("data-internal-owner-handoff-form"))
assert(main.includes("data-internal-replace-admin-center-id"))
assert(main.includes('data-internal-repair-admin-replacement-command-id'))
assert(main.includes("['target_ready', 'authority_swapped'].includes(adminAccount.ownerHandoff.stage)"))
assert(main.includes('data.actor_access_revoked !== false'))
assert(auth.includes("arg2_get_my_credential_gate"))
assert(auth.includes("complete-account-credential-change"))
assert(!/(SUPABASE_SERVICE_ROLE_KEY|service_role)/.test(main + auth + lifecycle), 'Browser code must not contain privileged Auth authority.')
assert(!/setItem\([^\n]*(temporaryPassword|temporary_password|ownerHandoffConfirm|handoff)/.test(main),
  'Temporary credentials and handoff state must never enter browser persistence.')

assert.equal(validateReviewedAccountEmail(' admin@example.com ').email, 'admin@example.com')
assert.equal(validateReviewedAccountEmail('admin.phongtester@ichess.vn').ok, true)
assert.equal(validateReviewedAccountEmail('not-an-email').ok, false)
assert.equal(isMembershipBusinessReady({ status: 'active' }), true)
for (const state of ['pending_credential', 'reset_required', 'revoke_pending', 'revoked', 'restore_pending']) {
  assert.equal(isMembershipBusinessReady({ status: state }), false)
}
assert.equal(isCredentialChangeRequired([{ credential_state: 'temporary' }]), true)
assert.equal(isCredentialChangeRequired([{ credential_state: 'ready' }]), false)

const capability = createAccountGovernanceCapability({
  status: ACCOUNT_GOVERNANCE_CAPABILITY.READY,
  centerId: 'qa-center',
  governanceVersion: 2,
})
assert.equal(isAccountGovernanceReady(capability, 'qa-center'), true)
assert.equal(isAccountGovernanceReady(capability, 'other-center'), false)
assert.equal(normalizeAccountGovernanceCapability({}, 'qa-center').status,
  ACCOUNT_GOVERNANCE_CAPABILITY.FAILED)
assert.equal(isAccountGovernanceReady(normalizeAccountGovernanceCapability({
  capability: 'ready', center_id: 'qa-center',
}, 'qa-center'), 'qa-center'), false, 'READY without a governance version must fail closed.')
const ephemeral = clearEphemeralLifecycleState({
  handoff: { temporaryPassword: 'must-disappear' },
  ownerHandoffConfirm: { email: 'must-disappear@example.com' },
})
assert.equal(ephemeral.handoff, null)
assert.equal(ephemeral.ownerHandoffConfirm, null)
assert.match(randomUUID(), /^[0-9a-f-]{36}$/)

const sha = createHash('sha256').update(readFileSync(migrationPath)).digest('hex').toUpperCase()
assert.match(sha, /^[0-9A-F]{64}$/)
console.log(`ARG-2 owner/admin lifecycle contract smoke PASS (${sha})`)
