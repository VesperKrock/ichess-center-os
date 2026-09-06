export const ACCOUNT_GOVERNANCE_CAPABILITY = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

export const BLOCKED_CREDENTIAL_STATES = Object.freeze(new Set([
  'temporary',
  'reset_required',
  'locked',
]))

export const BLOCKED_MEMBERSHIP_STATES = Object.freeze(new Set([
  'pending_credential',
  'reset_required',
  'revoke_pending',
  'revoked',
  'restore_pending',
]))

export function createAccountGovernanceCapability(overrides = {}) {
  return {
    status: ACCOUNT_GOVERNANCE_CAPABILITY.IDLE,
    centerId: '',
    governanceVersion: null,
    error: '',
    ...overrides,
  }
}

export function normalizeAccountGovernanceCapability(value, centerId = '') {
  const status = String(value?.status || value?.capability || '').trim().toLowerCase()
  const normalizedStatus = Object.values(ACCOUNT_GOVERNANCE_CAPABILITY).includes(status)
    ? status
    : ACCOUNT_GOVERNANCE_CAPABILITY.FAILED

  return createAccountGovernanceCapability({
    status: normalizedStatus,
    centerId: String(value?.centerId || value?.center_id || centerId || '').trim(),
    governanceVersion: Number.isInteger(Number(value?.governanceVersion ?? value?.governance_version))
      ? Number(value?.governanceVersion ?? value?.governance_version)
      : null,
    error: String(value?.error || '').trim(),
  })
}

export function isAccountGovernanceReady(capability, centerId) {
  return capability?.status === ACCOUNT_GOVERNANCE_CAPABILITY.READY &&
    String(capability?.centerId || '') === String(centerId || '') &&
    Number.isInteger(capability?.governanceVersion) && capability.governanceVersion >= 1
}

export function normalizeReviewedAccountEmail(value) {
  return String(value || '').trim().toLowerCase()
}

export function validateReviewedAccountEmail(value) {
  const email = normalizeReviewedAccountEmail(value)
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, email: '', error: 'Vui lòng nhập email đăng nhập hợp lệ.' }
  }
  return { ok: true, email, error: '' }
}

export function createLifecycleRequestId(action, centerId) {
  const prefix = String(action || 'account').replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
  const center = String(centerId || 'center').replace(/[^a-z0-9_-]/gi, '-').toLowerCase()
  return `arg2-${prefix}-${center}-${crypto.randomUUID()}`
}

export function isCredentialChangeRequired(gates = []) {
  return (Array.isArray(gates) ? gates : []).some((gate) =>
    BLOCKED_CREDENTIAL_STATES.has(String(gate?.credential_state || gate?.credentialState || '').toLowerCase()),
  )
}

export function getCredentialGate(gates = []) {
  return (Array.isArray(gates) ? gates : []).find((gate) =>
    BLOCKED_CREDENTIAL_STATES.has(String(gate?.credential_state || gate?.credentialState || '').toLowerCase()),
  ) || null
}

export function isMembershipBusinessReady(membership) {
  return String(membership?.status || '').trim().toLowerCase() === 'active'
}

export function clearEphemeralLifecycleState(state = {}) {
  return {
    ...state,
    handoff: null,
    handoffCopyMessage: '',
    createConfirm: null,
    resetConfirm: null,
    revokeConfirm: null,
    restoreConfirm: null,
    ownerHandoffConfirm: null,
  }
}

export function getAccountLifecycleErrorMessage(error, fallback = 'Không hoàn tất được thay đổi tài khoản.') {
  const raw = String(error?.context?.body?.code || error?.code || error?.message || error || '').toLowerCase()
  if (raw.includes('idempotency_intent_conflict')) return 'Yêu cầu này đã được dùng cho một thay đổi khác. Vui lòng tải lại và thử lại.'
  if (raw.includes('version_stale') || raw.includes('stale')) return 'Quyền tài khoản vừa thay đổi. Vui lòng tải lại trước khi tiếp tục.'
  if (raw.includes('owner_required')) return 'Chỉ Owner hiện tại của cơ sở mới được thực hiện thao tác này.'
  if (raw.includes('existing_identity') || raw.includes('already_registered') || raw.includes('email')) return 'Email này đã có tài khoản. Hệ thống không tự ghép tài khoản; vui lòng kiểm tra lại.'
  if (raw.includes('repair_required')) return 'Thay đổi chưa hoàn tất và cần được đối soát an toàn. Không có quyền mới nào được cấp.'
  if (raw.includes('governance_not_ready') || raw.includes('not_found')) return 'Quản lý vòng đời tài khoản chưa sẵn sàng cho cơ sở này.'
  if (/arg2_|pgrst|sqlstate|rpc|service[_ -]?role|schema|postgres|supabase|edge[ _-]?function|functions?/.test(raw)) return fallback
  return String(error?.message || fallback)
}
