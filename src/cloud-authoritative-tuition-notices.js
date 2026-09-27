const BACKEND_UNAVAILABLE_CODES = new Set([
  '42P01', '42703', '42883', 'PGRST202', 'PGRST205', 'BACKEND_NOT_DEPLOYED',
])

export function createTuitionNoticeCapabilityState(overrides = {}) {
  return {
    centerId: '',
    status: 'idle',
    isLoading: false,
    isSaving: false,
    canWrite: false,
    message: '',
    messageTone: '',
    lastLoadedAt: '',
    ...overrides,
  }
}

export function isTuitionNoticeCapabilityReady(state = {}, centerId = '') {
  const normalizedCenterId = cleanText(centerId)
  return Boolean(normalizedCenterId && state.centerId === normalizedCenterId && state.status === 'ready')
}

export async function pullTuitionNotices({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')
  try {
    const { data, error } = await supabase.rpc('tbhp_list_tuition_notices', {
      p_center_id: normalizedCenterId,
    })
    if (error) return rpcFailure(error, 'NOTICE_READ_FAILED')
    if (!data?.ok || data.center_id !== normalizedCenterId || !Array.isArray(data.notices)) {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', data)
    }
    const notices = data.notices.map((row) => projectNotice(row, normalizedCenterId))
    if (notices.some((notice) => !notice)) return failure('INVALID_SERVER_RESULT', data)
    return {
      ok: true,
      outcome_code: cleanText(data.outcome_code) || 'AUTHORITATIVE_SNAPSHOT',
      centerId: normalizedCenterId,
      canWrite: data.can_write === true,
      notices,
    }
  } catch (error) {
    return rpcFailure(error, 'NOTICE_READ_FAILED')
  }
}

export async function getPrintableTuitionDocument({ supabase, centerId, cycleId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')
  if (!isUuid(cycleId)) return failure('TARGET_CYCLE_NOT_FOUND')
  try {
    const { data, error } = await supabase.rpc('tbhp_get_printable_document', {
      p_center_id: normalizedCenterId,
      p_cycle_id: cycleId,
    })
    if (error) return rpcFailure(error, 'NOTICE_READ_FAILED')
    if (!data?.ok || data.outcome_code !== 'PRINTABLE_DOCUMENT'
      || data.center_id !== normalizedCenterId || !isPlainObject(data.document)) {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', data)
    }
    const document = projectNotice(data.document, normalizedCenterId)
    if (!document) return failure('INVALID_SERVER_RESULT', data)
    return { ok: true, outcome_code: data.outcome_code, document }
  } catch (error) {
    return rpcFailure(error, 'NOTICE_READ_FAILED')
  }
}

export async function mutateTuitionNotice({ supabase, centerId, command, idempotencyKey } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  const normalizedCenterId = cleanText(centerId)
  if (!normalizedCenterId) return failure('INVALID_CENTER')
  if (!isPlainObject(command) || !isUuid(idempotencyKey)) return failure('INVALID_COMMAND')
  try {
    const { data, error } = await supabase.rpc('tbhp_mutate_tuition_notice', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return rpcFailure(error, 'NOTICE_WRITE_FAILED', idempotencyKey)
    const version = Number(data?.notice_version)
    if (!data?.ok || data.outcome_code !== 'COMMITTED' || data.center_id !== normalizedCenterId
      || !isUuid(data.notice_id) || !Number.isSafeInteger(version) || version < 1) {
      return failure(cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT', data, idempotencyKey)
    }
    return { ...data, ok: true, notice_version: version, idempotencyKey }
  } catch (error) {
    return rpcFailure(error, 'NOTICE_WRITE_FAILED', idempotencyKey)
  }
}

export function buildCreateTuitionNoticeCommand(cycle = {}) {
  const version = Number(cycle.version)
  if (!isUuid(cycle.id) || !Number.isSafeInteger(version) || version < 1) {
    throw new Error('Chu kỳ tái đăng ký chưa có phiên bản authoritative hợp lệ.')
  }
  if (Number(cycle.cycleNumber) < 2) {
    throw new Error('Thông báo học phí chỉ dùng cho Tái đăng ký.')
  }
  return {
    operation: 'CREATE_NOTICE',
    notice_id: createTuitionNoticeIdempotencyKey(),
    target_cycle_id: cycle.id,
    expected_cycle_version: version,
  }
}

export function createTuitionNoticeIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không thể tạo mã an toàn cho Thông báo học phí.')
  }
  return globalThis.crypto.randomUUID()
}

export function getTuitionNoticeOutcomeMessage(outcomeCode = '') {
  const messages = {
    CLIENT_NOT_READY: 'Cần đăng nhập lại trước khi lập Thông báo học phí.',
    INVALID_CENTER: 'Chưa xác định được cơ sở đang hoạt động.',
    WRITE_ROLE_REQUIRED: 'Tài khoản hiện tại không có quyền lập Thông báo học phí.',
    RENEWAL_ONLY: 'Tài liệu cũ chỉ hỗ trợ kỳ tái đăng ký.',
    TARGET_CYCLE_NOT_FOUND: 'Không tìm thấy kỳ học cần in.',
    TARGET_CYCLE_NOT_ELIGIBLE: 'Kỳ học này chưa có gói học hoàn chỉnh.',
    PACKAGE_NOT_DEFINED: 'Chưa có gói học.',
    PAYMENT_ALREADY_RECEIVED: 'Tài liệu cũ không hỗ trợ trường hợp này.',
    NOTICE_ALREADY_EXISTS: 'Kỳ này đã có TBHP trong lịch sử.',
    AUTHORITATIVE_SOURCE_MISSING: 'Thiếu dữ liệu chính thức để tạo TBHP.',
    VERSION_STALE: 'Chu kỳ đã thay đổi. Hãy làm mới rồi thử lại.',
    IDEMPOTENCY_CONFLICT: 'Nội dung lần thử lại không còn khớp thao tác ban đầu.',
    NOTICE_READ_FAILED: 'Chưa thể tạo TBHP từ dữ liệu hiện tại.',
    NOTICE_WRITE_FAILED: 'Chưa thể lập Thông báo học phí.',
    INVALID_SERVER_RESULT: 'Máy chủ trả về Thông báo học phí không hợp lệ.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()]
    || 'Chưa thể hoàn tất Thông báo học phí lúc này.'
}

export function isTuitionNoticeBackendUnavailable(result = {}) {
  const code = cleanText(result.outcome_code || result.code).toUpperCase()
  const detail = [result.error, result.message, result.details, result.hint]
    .map(cleanText).join(' ').toUpperCase()
  return BACKEND_UNAVAILABLE_CODES.has(code)
    || [...BACKEND_UNAVAILABLE_CODES].some((candidate) => detail.includes(candidate))
}

function projectNotice(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  const cycleNumber = Number(row.target_term_number)
  const totalSessions = Number(row.total_sessions)
  if (!isUuid(row.id) || !isUuid(row.target_cycle_id)
    || !Number.isSafeInteger(version) || version < 1
    || !Number.isSafeInteger(cycleNumber) || cycleNumber < 1
    || !Number.isSafeInteger(totalSessions) || totalSessions < 1
    || !isPlainObject(row.snapshot)
    || !Array.isArray(row.snapshot.scheduleRows)
    || row.snapshot.scheduleRows.length !== totalSessions) return null
  return {
    id: row.id,
    centerId: expectedCenterId,
    studentId: cleanText(row.student_id),
    tuitionLocalId: cleanText(row.tuition_local_id),
    targetCycleId: row.target_cycle_id,
    targetPeriodId: cleanText(row.target_period_id),
    targetTermNumber: cycleNumber,
    totalSessions,
    snapshot: row.snapshot,
    version,
    issuedAt: cleanText(row.issued_at),
  }
}

function rpcFailure(error = {}, fallbackCode, idempotencyKey = '') {
  const unavailable = isTuitionNoticeBackendUnavailable(error)
  const outcomeCode = unavailable ? 'BACKEND_NOT_DEPLOYED' : fallbackCode
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: unavailable
      ? 'Chức năng Thông báo học phí chưa có trên database.'
      : cleanText(error.message) || getTuitionNoticeOutcomeMessage(outcomeCode),
    details: error,
    idempotencyKey,
    unavailable,
  }
}

function failure(outcomeCode, details = null, idempotencyKey = '') {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: getTuitionNoticeOutcomeMessage(outcomeCode),
    details,
    idempotencyKey,
  }
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(cleanText(value))
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}
