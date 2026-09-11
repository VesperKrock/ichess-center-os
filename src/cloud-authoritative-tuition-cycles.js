export const V24_PACKAGE_CYCLE_CONTRACT = 'v2.4-package-cycle-v1'

export const V24_PACKAGE_CYCLE_CAPABILITY_STATUS = Object.freeze({
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
})

const BACKEND_UNAVAILABLE_CODES = new Set(['PGRST202', 'PGRST205', '42P01', '42883'])
const BCHT_STATES = new Set(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'])

export function createV24PackageCycleCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: V24_PACKAGE_CYCLE_CAPABILITY_STATUS.IDLE,
    isLoading: false,
    isSaving: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isV24PackageCycleCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(
    normalizedCenterId
      && state.status === V24_PACKAGE_CYCLE_CAPABILITY_STATUS.READY
      && cleanText(state.centerId) === normalizedCenterId,
  )
}

export function isV24PackageCycleBackendUnavailable(result = {}) {
  const codes = [result?.outcome_code, result?.code, result?.detail?.code]
    .map((value) => cleanText(value).toUpperCase())
  const detail = [result?.error, result?.message, result?.details, result?.hint, result?.detail?.message]
    .map(cleanText)
    .join(' ')
    .toLowerCase()
  return codes.some((code) => BACKEND_UNAVAILABLE_CODES.has(code))
    || detail.includes('v2_4_list_package_cycle_state') && detail.includes('does not exist')
}

export async function pullV24PackageCycleState({ supabase, centerId } = {}) {
  const normalizedCenterId = cleanText(centerId)
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  if (!normalizedCenterId) return failure('INVALID_CENTER')
  try {
    const { data, error } = await supabase.rpc('v2_4_list_package_cycle_state', {
      p_center_id: normalizedCenterId,
    })
    if (error) return rpcFailure(error, 'PACKAGE_CYCLE_READ_FAILED')
    if (!data?.ok || data.status !== 'READY' || data.contract !== V24_PACKAGE_CYCLE_CONTRACT
      || cleanText(data.center_id) !== normalizedCenterId
      || !Array.isArray(data.students) || !Array.isArray(data.package_catalog)
      || !Array.isArray(data.contributions)) {
      return failure('INVALID_SERVER_RESULT')
    }
    const students = data.students.map((item) => projectStudentCycleState(item, normalizedCenterId))
    const packageCatalog = data.package_catalog.map((item) => projectCatalogPackage(item, normalizedCenterId))
    const contributions = data.contributions.map((item) => projectContribution(item, normalizedCenterId))
    if (students.some((item) => !item) || packageCatalog.some((item) => !item)
      || contributions.some((item) => !item)) {
      return failure('INVALID_SERVER_RESULT')
    }
    return {
      ok: true,
      outcome_code: 'AUTHORITATIVE_SNAPSHOT',
      centerId: normalizedCenterId,
      students,
      packageCatalog,
      contributions,
    }
  } catch (error) {
    return rpcFailure(error, 'PACKAGE_CYCLE_READ_FAILED')
  }
}

export async function mutateV24PackageCycle({
  supabase,
  centerId,
  command,
  idempotencyKey = createV24IdempotencyKey(),
} = {}) {
  const normalizedCenterId = cleanText(centerId)
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY', idempotencyKey)
  if (!normalizedCenterId || !isPlainObject(command)) return failure('INVALID_COMMAND', idempotencyKey)
  try {
    const { data, error } = await supabase.rpc('v2_4_mutate_package_cycle', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return rpcFailure(error, 'PACKAGE_CYCLE_WRITE_FAILED', idempotencyKey)
    if (!data?.ok || cleanText(data.center_id) !== normalizedCenterId
      || cleanText(data.outcome_code) !== 'COMMITTED') {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return rpcFailure(error, 'PACKAGE_CYCLE_WRITE_FAILED', idempotencyKey)
  }
}

export function buildV24StartCycleCommand({
  studentId,
  tuitionLocalId,
  packageCatalogId,
  baselineUsedSessions,
  baselineCutoffDate,
  baselineReviewNote,
} = {}) {
  return {
    operation: 'START_CYCLE',
    student_id: requireText(studentId, 'Không xác định được học viên.'),
    tuition_local_id: requireText(tuitionLocalId, 'Không xác định được hồ sơ học phí.'),
    package_catalog_id: requireUuid(packageCatalogId, 'Vui lòng chọn gói trong danh mục.'),
    baseline_used_sessions: requireNonNegativeInteger(
      baselineUsedSessions,
      'Số buổi đã dùng ban đầu không hợp lệ.',
    ),
    baseline_cutoff_date: requireDateKey(
      baselineCutoffDate,
      'Ngày chốt dữ liệu ban đầu không hợp lệ.',
    ),
    baseline_review_note: requireText(
      baselineReviewNote,
      'Vui lòng ghi ngắn gọn căn cứ đối chiếu số buổi ban đầu.',
    ).slice(0, 2000),
  }
}

export function buildV24UpdateBchtCommand(cycle = {}, bchtStatus = '', bchtNote = '') {
  const normalizedStatus = cleanText(bchtStatus).toUpperCase()
  if (!BCHT_STATES.has(normalizedStatus)) throw new Error('Trạng thái BCHT không hợp lệ.')
  return {
    operation: 'UPDATE_BCHT',
    student_id: requireText(cycle.studentId, 'Không xác định được học viên.'),
    cycle_id: requireUuid(cycle.id, 'Không xác định được chu kỳ học phí.'),
    expected_version: requirePositiveInteger(cycle.version, 'Dữ liệu chu kỳ chưa đủ mới.'),
    bcht_status: normalizedStatus,
    bcht_note: cleanText(bchtNote),
  }
}

export function buildV24SelectProvisionalPackageCommand(cycle = {}, packageCatalogId = '') {
  return {
    operation: 'SELECT_PROVISIONAL_PACKAGE',
    student_id: requireText(cycle.studentId, 'Không xác định được học viên.'),
    cycle_id: requireUuid(cycle.id, 'Không xác định được chu kỳ học phí.'),
    package_catalog_id: requireUuid(packageCatalogId, 'Vui lòng chọn gói trong danh mục.'),
    expected_version: requirePositiveInteger(cycle.version, 'Dữ liệu chu kỳ chưa đủ mới.'),
  }
}

export function createV24IdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) throw new Error('Trình duyệt không thể tạo mã an toàn cho thao tác này.')
  return globalThis.crypto.randomUUID()
}

export function createV24RetryFingerprint(command = {}) {
  return stableStringify(command)
}

export function getV24StudentCycleState(studentStates = [], studentId = '') {
  const normalizedStudentId = cleanText(studentId)
  return (Array.isArray(studentStates) ? studentStates : [])
    .find((item) => cleanText(item?.studentId) === normalizedStudentId) || null
}

export function getV24OutcomeMessage(outcomeCode = '') {
  const messages = {
    CLIENT_NOT_READY: 'Cần đăng nhập và chọn đúng cơ sở trước khi cập nhật chu kỳ học phí.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    INVALID_COMMAND: 'Thông tin chu kỳ học phí chưa hợp lệ.',
    BACKEND_NOT_DEPLOYED: 'Tự động theo chu kỳ gói học phí hiện chưa khả dụng.',
    CENTER_ACCESS_DENIED: 'Tài khoản hiện tại không có quyền thay đổi chu kỳ tại cơ sở này.',
    STUDENT_NOT_FOUND: 'Không tìm thấy học viên trong cơ sở hiện tại.',
    TUITION_NOT_FOUND: 'Không tìm thấy hồ sơ học phí hiện tại của học viên.',
    PACKAGE_NOT_AVAILABLE: 'Gói đã chọn không còn khả dụng. Hãy tải lại danh mục.',
    PACKAGE_CHANGE_LOCKED: 'Chu kỳ đã có thanh toán hợp lệ nên không thể đổi gói tại đây.',
    INVALID_BASELINE: 'Số buổi hoặc ngày chốt ban đầu không hợp lệ.',
    CYCLE_ALREADY_STARTED: 'Học viên đã có chu kỳ học phí. Hãy tải lại dữ liệu mới nhất.',
    STALE_VERSION: 'Chu kỳ đã thay đổi ở nơi khác. Hãy tải lại trước khi lưu.',
    IDEMPOTENCY_CONFLICT: 'Lần thử lại không còn khớp với nội dung ban đầu.',
    PACKAGE_CYCLE_READ_FAILED: 'Chưa tải được tiến độ chu kỳ học phí. Dữ liệu học phí hiện tại vẫn được giữ nguyên.',
    PACKAGE_CYCLE_WRITE_FAILED: 'Chưa thể xác nhận đã lưu. Nội dung hiện tại vẫn được giữ nguyên.',
    INVALID_SERVER_RESULT: 'Chưa thể xác nhận dữ liệu chu kỳ mới nhất.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã thay đổi; kết quả cũ không được sử dụng.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()]
    || 'Chưa thể hoàn tất thao tác chu kỳ học phí lúc này.'
}

function projectStudentCycleState(row = {}, centerId = '') {
  const studentId = cleanText(row.student_id)
  const readiness = cleanText(row.readiness).toUpperCase()
  if (!studentId || !['READY', 'LEGACY_REVIEW_REQUIRED', 'NO_TUITION_PACKAGE'].includes(readiness)
    || !Array.isArray(row.cycles)) return null
  const currentCycle = row.current_cycle == null
    ? null
    : projectCycle(row.current_cycle, centerId, studentId)
  if (row.current_cycle != null && !currentCycle) return null
  const cycles = row.cycles.map((cycle) => projectCycleHistory(cycle, centerId, studentId))
  if (cycles.some((cycle) => !cycle)) return null
  return { centerId, studentId, readiness, currentCycle, cycles }
}

function projectCycle(row = {}, centerId = '', studentId = '') {
  const version = Number(row.version)
  const cycleNumber = Number(row.cycle_number)
  const usedSessions = Number(row.used_sessions)
  const pendingSessions = Number(row.pending_sessions)
  const totalSessions = row.total_sessions == null ? null : Number(row.total_sessions)
  if (!isUuid(row.id) || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(cycleNumber) || cycleNumber < 1
    || !Number.isSafeInteger(usedSessions) || usedSessions < 0
    || !Number.isSafeInteger(pendingSessions) || pendingSessions < 0
    || (totalSessions !== null && (!Number.isSafeInteger(totalSessions) || totalSessions < 1))) return null
  return {
    id: row.id,
    centerId,
    studentId,
    cycleNumber,
    tuitionLocalId: cleanText(row.tuition_local_id),
    packageCatalogId: cleanText(row.package_catalog_id),
    packageName: cleanText(row.package_name),
    totalSessions,
    price: row.price == null ? null : Number(row.price),
    baselineUsed: Number(row.baseline_used) || 0,
    baselineCutoffDate: cleanText(row.baseline_cutoff_date),
    baselineReviewNote: cleanText(row.baseline_review_note),
    contributedSessions: Number(row.contributed_sessions) || 0,
    pendingSessions,
    usedSessions,
    remainingSessions: row.remaining_sessions == null ? null : Number(row.remaining_sessions),
    lifecycleStatus: cleanText(row.lifecycle_status),
    paymentPeriodId: cleanText(row.payment_period_id),
    paymentStatus: cleanText(row.payment_status),
    paidAmount: Number(row.paid_amount) || 0,
    bchtStatus: cleanText(row.bcht_status),
    bchtNote: cleanText(row.bcht_note),
    reminderState: cleanText(row.reminder_state),
    bchtReminder: row.bcht_reminder === true,
    renewalReminder: row.renewal_reminder === true,
    urgentRenewal: row.urgent_renewal === true,
    version,
  }
}

function projectContribution(row = {}, centerId = '') {
  const studentId = cleanText(row.student_id)
  const scheduleSessionId = cleanText(row.schedule_session_id)
  const occurrenceDate = cleanText(row.occurrence_date)
  const cycleNumber = Number(row.cycle_number)
  const contributionUnits = Number(row.contribution_units)
  const sessionNumber = row.session_number == null ? null : Number(row.session_number)
  const remainingSessions = row.remaining_sessions == null ? null : Number(row.remaining_sessions)
  const totalSessions = row.total_sessions == null ? null : Number(row.total_sessions)
  if (!studentId || !scheduleSessionId || !/^\d{4}-\d{2}-\d{2}$/.test(occurrenceDate)
    || !Number.isSafeInteger(cycleNumber) || cycleNumber < 1
    || ![0, 1].includes(contributionUnits)
    || (sessionNumber !== null && (!Number.isSafeInteger(sessionNumber) || sessionNumber < 1))
    || (remainingSessions !== null && (!Number.isSafeInteger(remainingSessions) || remainingSessions < 0))
    || (totalSessions !== null && (!Number.isSafeInteger(totalSessions) || totalSessions < 1))) return null
  return {
    centerId, studentId, scheduleSessionId, occurrenceDate,
    attendanceStatus: cleanText(row.attendance_status),
    contributionUnits, allocationState: cleanText(row.allocation_state),
    makeupReason: cleanText(row.makeup_reason), cycleId: cleanText(row.cycle_id),
    cycleNumber, packageName: cleanText(row.package_name), totalSessions,
    sessionNumber, remainingSessions,
    lifecycleStatus: cleanText(row.cycle_lifecycle_status),
    paymentStatus: cleanText(row.payment_status),
  }
}

function projectCycleHistory(row = {}, centerId = '', studentId = '') {
  const version = Number(row.version)
  const cycleNumber = Number(row.cycle_number)
  if (!isUuid(row.id) || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(cycleNumber) || cycleNumber < 1) return null
  return {
    id: row.id, centerId, studentId, cycleNumber,
    packageName: cleanText(row.package_name),
    totalSessions: row.total_sessions == null ? null : Number(row.total_sessions),
    usedSessions: Number(row.used_sessions) || 0,
    lifecycleStatus: cleanText(row.lifecycle_status),
    paymentStatus: cleanText(row.payment_status),
    bchtStatus: cleanText(row.bcht_status),
    version,
  }
}

function projectCatalogPackage(row = {}, centerId = '') {
  const version = Number(row.version)
  const totalSessions = Number(row.total_sessions)
  const defaultAmount = Number(row.default_amount)
  if (!isUuid(row.id) || !cleanText(row.package_name)
    || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(totalSessions) || totalSessions < 1
    || !Number.isSafeInteger(defaultAmount) || defaultAmount < 0) return null
  return {
    id: row.id, centerId, packageName: cleanText(row.package_name), totalSessions,
    defaultAmount, isActive: row.is_active === true, version,
  }
}

function rpcFailure(error = {}, fallback, idempotencyKey = '') {
  const code = mapRpcError(error) || fallback
  const result = failure(code, idempotencyKey)
  result.detail = error
  result.unavailable = isV24PackageCycleBackendUnavailable({ ...result, detail: error })
  if (result.unavailable) {
    result.outcome_code = 'BACKEND_NOT_DEPLOYED'
    result.error = getV24OutcomeMessage('BACKEND_NOT_DEPLOYED')
  }
  return result
}

function mapRpcError(error = {}) {
  const message = cleanText(error.message).toLowerCase()
  const mapping = [
    ['v2_4_center_access_denied', 'CENTER_ACCESS_DENIED'],
    ['v2_4_student_not_found', 'STUDENT_NOT_FOUND'],
    ['v2_4_tuition_not_found', 'TUITION_NOT_FOUND'],
    ['v2_4_package_not_available', 'PACKAGE_NOT_AVAILABLE'],
    ['v2_4_provisional_package_locked_by_payment', 'PACKAGE_CHANGE_LOCKED'],
    ['v2_4_invalid_baseline', 'INVALID_BASELINE'],
    ['v2_4_cycle_already_started', 'CYCLE_ALREADY_STARTED'],
    ['v2_4_stale_version', 'STALE_VERSION'],
    ['v2_4_idempotency_conflict', 'IDEMPOTENCY_CONFLICT'],
  ]
  return mapping.find(([needle]) => message.includes(needle))?.[1] || ''
}

function failure(outcomeCode, idempotencyKey = '', detail = null) {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: getV24OutcomeMessage(outcomeCode),
    idempotencyKey,
    detail,
  }
}

function requireText(value, message) {
  const normalized = cleanText(value)
  if (!normalized) throw new Error(message)
  return normalized
}

function requireUuid(value, message) {
  const normalized = cleanText(value)
  if (!isUuid(normalized)) throw new Error(message)
  return normalized
}

function requireDateKey(value, message) {
  const normalized = cleanText(value)
  const date = /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? new Date(`${normalized}T00:00:00Z`) : null
  if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error(message)
  }
  return normalized
}

function requireNonNegativeInteger(value, message) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(message)
  return number
}

function requirePositiveInteger(value, message) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 1) throw new Error(message)
  return number
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value))
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function cleanText(value) {
  return String(value ?? '').trim()
}
