import { getSupabaseClient } from './supabase-client.js'

export const INSTALLATION_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'IDLE',
  LOADING: 'LOADING',
  READY: 'READY',
  UNAVAILABLE: 'UNAVAILABLE',
  FAILED: 'FAILED',
})

const SERVER_STATES = new Set([
  'TESTER_ACTIVE', 'RESET_PREPARED', 'RESET_ARMED', 'RESET_EXECUTING',
  'HISTORY_SEALED', 'SESSION_DRAINING', 'UNINITIALIZED_NEXT_EPOCH',
  'FRESH_UNINITIALIZED', 'BOOTSTRAP_CLAIMED', 'OPERATIONAL_LOCKED',
  'RESET_REPAIR_REQUIRED', 'LOCKED_EXISTING',
])

export function createInstallationHandoffState() {
  return {
    capabilityStatus: INSTALLATION_CAPABILITY_STATUS.IDLE,
    capability: null,
    message: '',
    actionStatus: 'idle',
    requestId: '',
    commandId: '',
    displayOnceHandoffCode: '',
    displayOnceChallenge: '',
    coolingUntil: '',
    expiresAt: '',
  }
}

export function purgeInstallationHandoffState() {
  return createInstallationHandoffState()
}

export function normalizeInstallationCapability(payload) {
  const state = String(payload?.state || '').trim().toUpperCase()
  const controlVersion = Number(payload?.control_version)
  const installationEpoch = Number(payload?.installation_epoch)
  if (!SERVER_STATES.has(state) || !Number.isInteger(controlVersion) || controlVersion < 1 ||
      !Number.isInteger(installationEpoch) || installationEpoch < 1) {
    return null
  }
  return {
    state,
    controlVersion,
    janitorAvailable: payload.janitor_available === true,
    janitorInProgress: payload.janitor_in_progress === true,
    bootstrapAvailable: payload.bootstrap_available === true,
    targetSessionDrainRequired: payload.target_session_drain_required === true,
    targetSessionDrainCompleted: payload.target_session_drain_completed === true,
    sessionDrainUntil: typeof payload.session_drain_until === 'string' ? payload.session_drain_until : '',
    installationEpoch,
  }
}

function isContractUnavailable(error) {
  return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(String(error?.code || ''))
}

export async function loadInstallationCapability() {
  const client = getSupabaseClient()
  if (!client) return { status: INSTALLATION_CAPABILITY_STATUS.UNAVAILABLE, capability: null }
  const { data, error } = await client.rpc('chb1_get_handoff_capability')
  if (error) {
    return {
      status: isContractUnavailable(error)
        ? INSTALLATION_CAPABILITY_STATUS.UNAVAILABLE
        : INSTALLATION_CAPABILITY_STATUS.FAILED,
      capability: null,
    }
  }
  const capability = normalizeInstallationCapability(data)
  return capability
    ? { status: INSTALLATION_CAPABILITY_STATUS.READY, capability }
    : { status: INSTALLATION_CAPABILITY_STATUS.FAILED, capability: null }
}

function requestId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function ensureInstallationRequestId(state, prefix) {
  return state.requestId
    ? state
    : { ...state, requestId: requestId(prefix) }
}

async function invoke(functionName, body) {
  const client = getSupabaseClient()
  if (!client) throw new Error('handoff_backend_unavailable')
  const { data, error } = await client.functions.invoke(functionName, { body })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.code || 'handoff_action_failed')
  return data
}

export async function inspectInstallationHandoff() {
  return invoke('manage-installation-handoff', { mode: 'inspect' })
}

export async function prepareInstallationHandoff(state, values) {
  const idempotencyKey = state.requestId || requestId('handoff-reset')
  const data = await invoke('manage-installation-handoff', {
    mode: 'prepare',
    idempotency_key: idempotencyKey,
    target_email: values.targetEmail,
    restore_verification_id: values.restoreVerificationId,
    expected_control_version: values.controlVersion,
    current_password: values.currentPassword,
  })
  return {
    ...state,
    actionStatus: 'prepared',
    requestId: idempotencyKey,
    commandId: data.command_id,
    displayOnceHandoffCode: data.handoff_code,
    displayOnceChallenge: data.confirmation_challenge,
    coolingUntil: data.cooling_until,
    expiresAt: data.expires_at,
    message: 'Đã chuẩn bị yêu cầu. Hệ thống đang trong thời gian chờ an toàn 24 giờ.',
  }
}

export async function armInstallationHandoff(state, values) {
  const data = await invoke('manage-installation-handoff', {
    mode: 'arm', command_id: state.commandId || values.commandId,
    confirmation_challenge: values.challenge,
    confirmation_phrase: values.confirmationPhrase,
    current_password: values.currentPassword,
  })
  return { ...state, actionStatus: 'armed', commandId: state.commandId || values.commandId,
    message: data.code === 'handoff_armed' ? 'Yêu cầu đã được khóa phạm vi và sẵn sàng thực thi.' : '' }
}

export async function executeInstallationHandoff(state, currentPassword) {
  const data = await invoke('manage-installation-handoff', {
    mode: 'execute', command_id: state.commandId, current_password: currentPassword,
  })
  return { ...purgeInstallationHandoffState(), actionStatus: 'sealed',
    message: 'Lịch sử đã được niêm phong. Hệ thống đang kết thúc các phiên cũ trước khi bàn giao.',
    sessionDrainUntil: data.session_drain_until || '' }
}

export async function cancelInstallationHandoff(state) {
  await invoke('manage-installation-handoff', { mode: 'cancel', command_id: state.commandId })
  return { ...purgeInstallationHandoffState(), message: 'Đã hủy yêu cầu chuẩn bị bàn giao.' }
}

export async function drainBootstrapTargetSession() {
  return invoke('bootstrap-first-owner', { mode: 'drain_previous_session' })
}

export async function claimFirstOwner(state, values) {
  const idempotencyKey = state.requestId || requestId('first-owner')
  const data = await invoke('bootstrap-first-owner', {
    mode: 'claim', idempotency_key: idempotencyKey,
    center_name: values.centerName,
    handoff_code: values.handoffCode,
    current_password: values.currentPassword,
  })
  return { data, state: { ...purgeInstallationHandoffState(), requestId: idempotencyKey } }
}

export function getInstallationErrorMessage(error, fallback = 'Chưa thể thực hiện. Vui lòng kiểm tra lại.') {
  const raw = String(error?.message || '').toLowerCase()
  if (raw.includes('cooling')) return 'Chưa đủ 24 giờ chờ an toàn.'
  if (raw.includes('manifest') || raw.includes('scope_drift')) return 'Dữ liệu đã thay đổi. Cần tạo lại bản kiểm tra bàn giao.'
  if (raw.includes('backup') || raw.includes('restore')) return 'Chưa có bản sao lưu đã phục hồi kiểm tra còn hiệu lực.'
  if (raw.includes('recent_login') || raw.includes('reauth')) return 'Mật khẩu xác nhận không đúng hoặc phiên xác nhận đã hết hạn.'
  if (raw.includes('confirmation')) return 'Cụm xác nhận chưa khớp.'
  if (raw.includes('claim') || raw.includes('token')) return 'Thông tin khởi tạo không hợp lệ hoặc đã hết hạn.'
  if (raw.includes('conflict')) return 'Yêu cầu này đã được dùng với nội dung khác.'
  return fallback
}
