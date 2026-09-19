import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { pullC53CrmSharedTruth } from '../src/cloud-authoritative-crm.js'

const expectedProjectRef = 'zahcfnpaprbnuqpegdmo'
const requiredFlag = 'ICHESS_NEW_CENTER_PRODUCTION_E2E_ALLOW_MUTATION'

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[requiredFlag], 'YES', `${requiredFlag}=YES is required`)
assert.equal(process.env.ICHESS_SUPABASE_PROJECT_REF, expectedProjectRef, 'Unexpected production project')

const url = String(process.env.ICHESS_SUPABASE_URL || '').trim()
const anonKey = String(process.env.ICHESS_SUPABASE_ANON_KEY || '').trim()
const serviceKey = String(process.env.ICHESS_SUPABASE_SERVICE_KEY || '').trim()
const ownerUserId = String(process.env.ICHESS_E2E_OWNER_USER_ID || '').trim()
assert.equal(new URL(url).hostname, `${expectedProjectRef}.supabase.co`)
assert(anonKey && serviceKey && ownerUserId)

const serviceAdminClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const makeClient = () => createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const signIn = async (email, password) => {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  assert.equal(error, null, `sign in failed: ${error?.message}`)
  assert(data.session?.access_token)
  return client
}
const invoke = async (client, functionName, body) => {
  const { data, error } = await client.functions.invoke(functionName, { body })
  assert.equal(error, null, `${functionName} transport failed: ${error?.message}`)
  assert.equal(data?.ok, true, `${functionName} failed: ${data?.code}`)
  return data
}
const listAccount = async (ownerClient, centerId) => {
  const response = await invoke(ownerClient, 'list-center-admin-accounts', {
    center_ids: [centerId],
  })
  assert.equal(response.code, 'center_admin_accounts_loaded')
  assert.equal(response.centers?.length, 1)
  assert.equal(response.centers[0].center_id, centerId)
  return response.centers[0]
}

const { data: ownerLookup, error: ownerLookupError } = await serviceAdminClient.auth.admin.getUserById(ownerUserId)
assert.equal(ownerLookupError, null, `Owner lookup failed: ${ownerLookupError?.message}`)
const ownerEmail = String(ownerLookup.user?.email || '').trim()
assert(ownerEmail)

const { data: ownerLink, error: ownerLinkError } = await serviceAdminClient.auth.admin.generateLink({
  type: 'magiclink',
  email: ownerEmail,
})
assert.equal(ownerLinkError, null, `Owner session link failed: ${ownerLinkError?.message}`)
const ownerTokenHash = String(ownerLink.properties?.hashed_token || '').trim()
assert(ownerTokenHash)
const ownerClient = makeClient()
const { data: ownerSession, error: ownerSessionError } = await ownerClient.auth.verifyOtp({
  type: 'magiclink',
  token_hash: ownerTokenHash,
})
assert.equal(ownerSessionError, null, `Owner session failed: ${ownerSessionError?.message}`)
assert.equal(ownerSession.user?.id, ownerUserId)

const resumeCenterId = String(process.env.ICHESS_E2E_RESUME_CENTER_ID || '').trim()
if (resumeCenterId) {
  assert.match(resumeCenterId, /^handoverqa[0-9a-f]{12}_prod$/)
  const { data: resumeCenter, error: resumeCenterError } = await ownerClient
    .from('centers')
    .select('id,name,created_at')
    .eq('id', resumeCenterId)
    .single()
  assert.equal(resumeCenterError, null, `Resume center lookup failed: ${resumeCenterError?.message}`)
  assert.equal(resumeCenter?.id, resumeCenterId)
  const centerId = resumeCenter.id
  const suffix = centerId.replace(/^handoverqa/, '').replace(/_prod$/, '')
  const activeAccount = await listAccount(ownerClient, centerId)
  assert.equal(activeAccount.admin?.exists, true)
  assert.equal(activeAccount.admin?.state, 'active')
  const adminEmail = String(activeAccount.admin?.email || '')
  assert(adminEmail)

  const resetResult = await invoke(ownerClient, 'reset-center-admin-password', {
    center_id: centerId,
    target_user_id: activeAccount.admin.user_id,
    target_membership_id: activeAccount.admin.membership_id,
    expected_governance_version: activeAccount.governance_version,
    expected_membership_version: activeAccount.admin.membership_version,
    idempotency_key: `handover-reset-${suffix}`,
    repair: true,
  })
  assert.equal(resetResult.code, 'center_admin_password_change_required')
  assert.equal(resetResult.password_display_once, true)
  assert.equal(resetResult.sessions_invalidated, true)
  const resetTemporaryPassword = String(resetResult.temporary_password || '')
  assert(resetTemporaryPassword.length >= 12)

  let resumedAdminClient = await signIn(adminEmail, resetTemporaryPassword)
  const { data: resetGates, error: resetGateError } = await resumedAdminClient.rpc('arg2_get_my_credential_gate')
  assert.equal(resetGateError, null, `Reset gate read failed: ${resetGateError?.message}`)
  assert.equal(resetGates?.gates?.length, 1)
  assert.equal(resetGates.gates[0].credential_state, 'reset_required')
  assert.equal(resetGates.gates[0].command_id, resetResult.command_id)

  const finalPassword = `Final!${randomUUID()}aA7`
  const resetCredentialChange = await invoke(resumedAdminClient, 'complete-account-credential-change', {
    command_id: resetResult.command_id,
    new_password: finalPassword,
  })
  assert.equal(resetCredentialChange.code, 'credential_change_complete')
  await resumedAdminClient.auth.signOut()
  resumedAdminClient = await signIn(adminEmail, finalPassword)

  const { data: businessMemberships, error: businessMembershipError } = await resumedAdminClient
    .from('center_members')
    .select('id,center_id,role,status,membership_version,centers(name,status)')
    .eq('center_id', centerId)
    .eq('status', 'active')
  assert.equal(businessMembershipError, null, `Business membership reload failed: ${businessMembershipError?.message}`)
  assert.equal(businessMemberships?.length, 1)
  assert.equal(businessMemberships[0].role, 'center_admin')

  const finalCustomerLoad = await pullC53CrmSharedTruth({ supabase: resumedAdminClient, centerId })
  assert.equal(finalCustomerLoad.ok, true, `Customer reload after reset failed: ${finalCustomerLoad.error}`)
  assert.deepEqual(finalCustomerLoad.records, [])
  const crossCenterLoad = await pullC53CrmSharedTruth({
    supabase: resumedAdminClient,
    centerId: 'phongkinhdoanh_prod',
  })
  assert.equal(crossCenterLoad.ok, false, 'Disposable Admin crossed the exact-center CRM boundary')

  const finalAccount = await listAccount(ownerClient, centerId)
  assert.equal(finalAccount.admin?.exists, true)
  assert.equal(finalAccount.admin?.state, 'active')
  const phongKinhDoanh = await pullC53CrmSharedTruth({
    supabase: ownerClient,
    centerId: 'phongkinhdoanh_prod',
  })
  assert.equal(phongKinhDoanh.ok, true, `phongkinhdoanh_prod CRM failed: ${phongKinhDoanh.error}`)

  console.log(JSON.stringify({
    ok: true,
    resumed: true,
    center_id: centerId,
    reset_temporary_password_login: true,
    reset_completed: true,
    business_shell_membership_ready: true,
    customer_zero_record_load: finalCustomerLoad.records.length === 0,
    owner_console_active_admin: finalAccount.admin?.state === 'active',
    cross_center_denied: !crossCenterLoad.ok,
    phongkinhdoanh_crm_records: phongKinhDoanh.records.length,
    cleanup_supported: false,
  }, null, 2))
  process.exit(0)
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
const centerName = `Handover QA ${suffix}`
const centerId = `handoverqa${suffix}_prod`
const adminEmail = `handover.qa.${suffix}@example.invalid`
const initialPassword = `Ready!${randomUUID()}aA7`
const finalPassword = `Final!${randomUUID()}aA7`

const { data: createdRows, error: createError } = await ownerClient.rpc('provision_center_for_owner', {
  p_center_name: centerName,
})
assert.equal(createError, null, `Create center failed: ${createError?.message}`)
assert.equal(createdRows?.length, 1)
assert.equal(createdRows[0].id, centerId)
assert.equal(createdRows[0].environment, 'production')
assert.equal(createdRows[0].status, 'active')

const beforeAdmin = await listAccount(ownerClient, centerId)
assert.equal(beforeAdmin.capability, 'ready')
assert.equal(beforeAdmin.governance_version, 1)
assert.equal(beforeAdmin.admin?.exists, false)

const provisionAdmin = await invoke(ownerClient, 'provision-center-admin-account', {
  center_id: centerId,
  target_email: adminEmail,
  idempotency_key: `handover-create-${suffix}`,
  repair: true,
  display_name: `Handover QA ${suffix}`,
  expected_governance_version: beforeAdmin.governance_version,
  mode: 'provision',
  predecessor_membership_id: null,
  expected_membership_version: null,
})
assert.equal(provisionAdmin.code, 'center_admin_credential_handoff_required')
assert.equal(provisionAdmin.center_id, centerId)
assert.equal(provisionAdmin.email, adminEmail)
assert.equal(provisionAdmin.password_display_once, true)
assert.equal(provisionAdmin.credential_handoff_required, true)
const temporaryPassword = String(provisionAdmin.temporary_password || '')
assert(temporaryPassword.length >= 12)

const temporaryAdminClient = await signIn(adminEmail, temporaryPassword)
const { data: temporaryGates, error: temporaryGateError } = await temporaryAdminClient.rpc(
  'arg2_get_my_credential_gate',
)
assert.equal(temporaryGateError, null, `Temporary gate read failed: ${temporaryGateError?.message}`)
assert.equal(temporaryGates?.gates?.length, 1)
assert.equal(temporaryGates.gates[0].center_id, centerId)
assert.equal(temporaryGates.gates[0].credential_state, 'temporary')
assert.equal(temporaryGates.gates[0].command_id, provisionAdmin.command_id)

const credentialChange = await invoke(temporaryAdminClient, 'complete-account-credential-change', {
  command_id: provisionAdmin.command_id,
  new_password: initialPassword,
})
assert.equal(credentialChange.code, 'credential_change_complete')
assert.equal(credentialChange.center_id, centerId)
assert.equal(credentialChange.requires_fresh_login, true)
await temporaryAdminClient.auth.signOut()

let adminClient = await signIn(adminEmail, initialPassword)
const { data: activeMemberships, error: activeMembershipError } = await adminClient
  .from('center_members')
  .select('id,center_id,user_id,role,status,membership_version,centers(name,status)')
  .eq('center_id', centerId)
  .eq('status', 'active')
assert.equal(activeMembershipError, null, `Business membership load failed: ${activeMembershipError?.message}`)
assert.equal(activeMemberships?.length, 1)
assert.equal(activeMemberships[0].role, 'center_admin')
assert.equal(activeMemberships[0].centers?.status, 'active')

const customerLoad = await pullC53CrmSharedTruth({ supabase: adminClient, centerId })
assert.equal(customerLoad.ok, true, `Customer module failed: ${customerLoad.error}`)
assert.deepEqual(customerLoad.records, [])

const crossCenterLoad = await pullC53CrmSharedTruth({
  supabase: adminClient,
  centerId: 'phongkinhdoanh_prod',
})
assert.equal(crossCenterLoad.ok, false, 'Disposable Admin crossed the exact-center CRM boundary')

const activeAccount = await listAccount(ownerClient, centerId)
assert.equal(activeAccount.admin?.exists, true)
assert.equal(activeAccount.admin?.state, 'active')
assert.equal(activeAccount.admin?.email, adminEmail)

const resetResult = await invoke(ownerClient, 'reset-center-admin-password', {
  center_id: centerId,
  target_user_id: activeAccount.admin.user_id,
  target_membership_id: activeAccount.admin.membership_id,
  expected_governance_version: activeAccount.governance_version,
  expected_membership_version: activeAccount.admin.membership_version,
  idempotency_key: `handover-reset-${suffix}`,
  repair: true,
})
assert.equal(resetResult.code, 'center_admin_password_change_required')
assert.equal(resetResult.password_display_once, true)
assert.equal(resetResult.sessions_invalidated, true)
const resetTemporaryPassword = String(resetResult.temporary_password || '')
assert(resetTemporaryPassword.length >= 12)

adminClient = await signIn(adminEmail, resetTemporaryPassword)
const { data: resetGates, error: resetGateError } = await adminClient.rpc('arg2_get_my_credential_gate')
assert.equal(resetGateError, null, `Reset gate read failed: ${resetGateError?.message}`)
assert.equal(resetGates?.gates?.length, 1)
assert.equal(resetGates.gates[0].credential_state, 'reset_required')
assert.equal(resetGates.gates[0].command_id, resetResult.command_id)

const resetCredentialChange = await invoke(adminClient, 'complete-account-credential-change', {
  command_id: resetResult.command_id,
  new_password: finalPassword,
})
assert.equal(resetCredentialChange.code, 'credential_change_complete')
await adminClient.auth.signOut()
adminClient = await signIn(adminEmail, finalPassword)

const finalCustomerLoad = await pullC53CrmSharedTruth({ supabase: adminClient, centerId })
assert.equal(finalCustomerLoad.ok, true, `Customer reload after reset failed: ${finalCustomerLoad.error}`)
assert.deepEqual(finalCustomerLoad.records, [])

const finalAccount = await listAccount(ownerClient, centerId)
assert.equal(finalAccount.admin?.exists, true)
assert.equal(finalAccount.admin?.state, 'active')

const phongKinhDoanh = await pullC53CrmSharedTruth({
  supabase: ownerClient,
  centerId: 'phongkinhdoanh_prod',
})
assert.equal(phongKinhDoanh.ok, true, `phongkinhdoanh_prod CRM failed: ${phongKinhDoanh.error}`)

console.log(JSON.stringify({
  ok: true,
  center_id: centerId,
  governance_ready: beforeAdmin.capability === 'ready',
  temporary_credential_received: true,
  mandatory_password_change: true,
  business_shell_membership_ready: true,
  customer_zero_record_load: customerLoad.records.length === 0,
  owner_console_active_admin: finalAccount.admin?.state === 'active',
  reset_temporary_password_login: true,
  reset_completed: true,
  cross_center_denied: !crossCenterLoad.ok,
  phongkinhdoanh_crm_records: phongKinhDoanh.records.length,
  cleanup_supported: false,
}, null, 2))
