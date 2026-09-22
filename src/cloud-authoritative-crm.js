export const C53_CRM_SHARED_TRUTH_SOURCE_VERSION = 'c5.3-crm-authoritative-shared-truth-v1'
export const C53_CRM_MASKED_CACHE_POLICY = 'MASKED_CACHE_ONLY'

const ADMIN_WRITE_ROLES = new Set(['owner', 'admin', 'center_admin', 'qtv'])

const APPOINTMENT_TYPES = Object.freeze({
  consultation: 'CONSULTATION',
  trialLesson: 'TRIAL_LESSON',
  callback: 'CALLBACK',
  followUp: 'FOLLOW_UP',
  other: 'OTHER',
})
const APPOINTMENT_STATUSES = new Set([
  'scheduled', 'completed', 'missed', 'cancelled', 'rescheduled',
])
const CARE_ENTRY_TYPES = Object.freeze({
  phone: 'CALL_SUMMARY',
  zalo: 'MESSAGE_SUMMARY',
  facebook: 'MESSAGE_SUMMARY',
  email: 'MESSAGE_SUMMARY',
  direct: 'MEETING_SUMMARY',
  note: 'NOTE',
  other: 'NOTE',
})

export function createC53CrmIdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không hỗ trợ crypto.randomUUID cho lệnh CRM C5.3.')
  }
  return globalThis.crypto.randomUUID()
}

export function canWriteC53CrmSharedTruth(accessState = {}) {
  const role = String(accessState?.role || accessState?.membership?.role || '').toLowerCase()
  const canWrite = Boolean(accessState?.canWrite !== false && ADMIN_WRITE_ROLES.has(role))
  return {
    ok: canWrite,
    canWrite,
    role,
    error: canWrite
      ? ''
      : 'Vai trò hiện tại không được ghi CRM. Dữ liệu chưa được lưu.',
  }
}

export async function pullC53CrmSharedTruth({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', 'Thiếu Supabase client; cache CRM chưa thay đổi.')
  }
  const normalizedCenterId = String(centerId || '').trim()
  if (!normalizedCenterId) return failure('INVALID_CENTER', 'Thiếu center_id CRM.')

  try {
    const { data, error } = await supabase.rpc('c5_3_list_crm_shared_truth', {
      p_center_id: normalizedCenterId,
    })
    if (error) return failure('CRM_SHARED_TRUTH_READ_FAILED', String(error.message || error), error)
    if (!data?.ok || !Array.isArray(data.records) || !Array.isArray(data.eligible_consultants)) {
      const outcomeCode = String(data?.outcome_code || 'INVALID_SERVER_RESULT')
      return failure(outcomeCode, getC53CrmOutcomeMessage(outcomeCode), data)
    }
    if (String(data.center_id || '') !== normalizedCenterId) {
      return failure('CENTER_CONTEXT_CHANGED', getC53CrmOutcomeMessage('CENTER_CONTEXT_CHANGED'))
    }
    const records = data.records.map(projectC53CrmRecord)
    const eligibleConsultants = data.eligible_consultants
    if (records.some((record) => !record) || eligibleConsultants.some((consultant) => (
      !consultant
      || typeof consultant !== 'object'
      || Array.isArray(consultant)
      || !cleanText(consultant.userId)
      || !cleanText(consultant.label)
    ))) {
      return failure('INVALID_SERVER_RESULT', getC53CrmOutcomeMessage('INVALID_SERVER_RESULT'), data)
    }
    const consultantLabels = new Map(
      eligibleConsultants.map((consultant) => [cleanText(consultant.userId), cleanText(consultant.label)]),
    )
    const projectedRecords = records.map((record) => {
      const consultantId = cleanText(record.consultantId)
      const authoritativeLabel = consultantLabels.get(consultantId)
      return authoritativeLabel ? { ...record, consultantName: authoritativeLabel } : record
    })
    return {
      ok: true,
      outcome_code: data.outcome_code,
      centerId: normalizedCenterId,
      cachePolicy: data.projection_cache_policy || C53_CRM_MASKED_CACHE_POLICY,
      eligibleConsultants,
      records: projectedRecords,
    }
  } catch (error) {
    return failure('CRM_SHARED_TRUTH_READ_FAILED', String(error?.message || error), error)
  }
}

export async function mutateC53CrmSharedTruth({
  supabase,
  centerId,
  command,
  idempotencyKey = createC53CrmIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', getC53CrmOutcomeMessage('CLIENT_NOT_READY'))
  }
  const normalizedCenterId = String(centerId || '').trim()
  if (!normalizedCenterId) return failure('INVALID_CENTER', getC53CrmOutcomeMessage('INVALID_CENTER'))
  if (!command || typeof command !== 'object' || Array.isArray(command)) {
    return failure('INVALID_COMMAND', getC53CrmOutcomeMessage('INVALID_COMMAND'))
  }

  try {
    const { data, error } = await supabase.rpc('c5_3_mutate_crm_shared_truth', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return failure('SERVER_COMMAND_FAILED', String(error.message || error), error, idempotencyKey)
    if (!data?.ok) {
      const outcomeCode = String(data?.outcome_code || 'SERVER_COMMAND_FAILED')
      return failure(outcomeCode, getC53CrmOutcomeMessage(outcomeCode), data, idempotencyKey)
    }
    if (data.outcome_code !== 'COMMITTED' || !data.case_id) {
      return failure('INVALID_SERVER_RESULT', getC53CrmOutcomeMessage('INVALID_SERVER_RESULT'), data, idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return failure('SERVER_COMMAND_FAILED', String(error?.message || error), error, idempotencyKey)
  }
}

export async function convertF4bCrmCaseToStudent({
  supabase,
  centerId,
  caseId,
  candidateId,
  expectedCaseVersion,
  expectedCandidateVersion,
  mode,
  studentId = '',
  expectedStudentVersion = 0,
  studentPayload = null,
  guardianRole = 'UNSPECIFIED',
  guardianOccupation = '',
  idempotencyKey = createC53CrmIdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', getF4bConversionOutcomeMessage('CLIENT_NOT_READY'), null, idempotencyKey)
  }

  const normalizedCenterId = cleanText(centerId)
  const normalizedMode = cleanText(mode).toUpperCase()
  const caseVersion = Number(expectedCaseVersion)
  const candidateVersion = Number(expectedCandidateVersion)
  const studentVersion = Number(expectedStudentVersion)
  if (!normalizedCenterId || !isUuid(caseId) || !isUuid(candidateId)
    || !Number.isSafeInteger(caseVersion) || caseVersion < 1
    || !Number.isSafeInteger(candidateVersion) || candidateVersion < 1
    || !['CREATE_NEW', 'LINK_EXISTING'].includes(normalizedMode)
    || !Number.isSafeInteger(studentVersion) || studentVersion < 0
    || !isUuid(idempotencyKey)) {
    return failure('INVALID_COMMAND', getF4bConversionOutcomeMessage('INVALID_COMMAND'), null, idempotencyKey)
  }
  if (normalizedMode === 'CREATE_NEW' && (!isPlainObject(studentPayload) || studentVersion !== 0)) {
    return failure('INVALID_STUDENT_PAYLOAD', getF4bConversionOutcomeMessage('INVALID_STUDENT_PAYLOAD'), null, idempotencyKey)
  }
  if (normalizedMode === 'LINK_EXISTING' && (!cleanText(studentId) || studentVersion < 1)) {
    return failure('INVALID_STUDENT_TARGET', getF4bConversionOutcomeMessage('INVALID_STUDENT_TARGET'), null, idempotencyKey)
  }

  try {
    const { data, error } = await supabase.rpc('f4b_convert_crm_case_to_student', {
      p_center_id: normalizedCenterId,
      p_case_id: caseId,
      p_candidate_id: candidateId,
      p_expected_case_version: caseVersion,
      p_expected_candidate_version: candidateVersion,
      p_mode: normalizedMode,
      p_student_local_id: normalizedMode === 'LINK_EXISTING' ? cleanText(studentId) : '',
      p_expected_student_version: normalizedMode === 'LINK_EXISTING' ? studentVersion : 0,
      p_student_payload: normalizedMode === 'CREATE_NEW' ? studentPayload : null,
      p_guardian_role: cleanText(guardianRole).toUpperCase() || 'UNSPECIFIED',
      p_guardian_occupation: cleanText(guardianOccupation),
      p_idempotency_key: idempotencyKey,
    })
    if (error) {
      return failure('F4B_CONVERSION_FAILED', String(error.message || error), error, idempotencyKey)
    }
    if (!data?.ok || data.outcome_code !== 'COMMITTED' || !cleanText(data.student_id)) {
      const outcomeCode = cleanText(data?.outcome_code) || 'INVALID_SERVER_RESULT'
      return failure(outcomeCode, getF4bConversionOutcomeMessage(outcomeCode), data, idempotencyKey)
    }
    if (cleanText(data.center_id) !== normalizedCenterId
      || cleanText(data.case_id) !== cleanText(caseId)
      || cleanText(data.candidate_id) !== cleanText(candidateId)) {
      return failure('CENTER_CONTEXT_CHANGED', getF4bConversionOutcomeMessage('CENTER_CONTEXT_CHANGED'), data, idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return failure('F4B_CONVERSION_FAILED', String(error?.message || error), error, idempotencyKey)
  }
}

export function getF4bConversionOutcomeMessage(outcomeCode = '') {
  const messages = {
    CLIENT_NOT_READY: 'Cần đăng nhập lại trước khi chuyển đổi.',
    INVALID_COMMAND: 'Lệnh chuyển đổi không hợp lệ. Hãy kiểm tra lại thông tin.',
    INVALID_STUDENT_PAYLOAD: 'Thông tin Học viên mới chưa hợp lệ.',
    INVALID_STUDENT_TARGET: 'Học viên có sẵn không còn hợp lệ. Hãy tải lại danh sách.',
    CENTER_ACCESS_DENIED: 'Không được phép chuyển đổi dữ liệu của cơ sở khác.',
    WRITE_ROLE_REQUIRED: 'Tài khoản hiện tại không có quyền chuyển đổi Khách hàng.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Không tìm thấy hồ sơ hiện tại hoặc bạn không có quyền truy cập.',
    CASE_VERSION_STALE: 'Hồ sơ Khách hàng đã thay đổi. Hãy làm mới trước khi thử lại.',
    CANDIDATE_VERSION_STALE: 'Thông tin bé đã thay đổi. Hãy làm mới trước khi thử lại.',
    STUDENT_VERSION_STALE: 'Hồ sơ Học viên đã thay đổi. Hãy làm mới trước khi ghép.',
    CONVERSION_NOT_ELIGIBLE: 'Khách hàng chưa ở trạng thái Sẵn sàng đăng ký.',
    CONVERSION_TARGET_CONFLICT: 'Hồ sơ này đã chuyển đổi sang một Học viên khác.',
    STUDENT_BIRTH_DATE_REQUIRED: 'Cần nhập ngày sinh đầy đủ của Học viên.',
    STUDENT_BIRTH_DATE_INVALID: 'Ngày sinh Học viên không hợp lệ.',
    STUDENT_BIRTH_YEAR_MISMATCH: 'Năm sinh không khớp hồ sơ tư vấn.',
    STUDENT_SCHOOL_REQUIRED: 'Cần nhập trường học của Học viên.',
    STUDENT_LEVEL_REQUIRED: 'Cần chọn cấp độ học cờ.',
    STUDENT_NOT_CURRENT_OR_NOT_FOUND: 'Học viên có sẵn không còn hoạt động hoặc không tồn tại.',
    LINK_COLLISION_REVIEW_REQUIRED: 'Học viên đã có liên hệ chính khác; cần rà soát trước khi ghép.',
    IDEMPOTENCY_KEY_REUSED_WITH_CHANGED_INTENT: 'Nội dung đã thay đổi sau lần gửi trước. Hãy đóng và mở lại thao tác.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đang hoạt động đã thay đổi; kết quả không được sử dụng.',
    INVALID_SERVER_RESULT: 'Máy chủ trả về kết quả chuyển đổi không hợp lệ.',
  }
  return messages[cleanText(outcomeCode).toUpperCase()]
    || 'Chưa thể hoàn tất chuyển đổi. Không có dữ liệu dở dang được giữ lại.'
}

export function buildC53CreateLeadCommand(contact = {}) {
  const phones = [contact.phone, contact.secondaryPhone].map(cleanText).filter(Boolean)
  const emails = [contact.email].map(cleanText).filter(Boolean)
  const initialCareLog = Array.isArray(contact.careLogs) && contact.careLogs.length
    ? buildC53CareLogPayload(contact.careLogs[contact.careLogs.length - 1])
    : null

  return stripUndefined({
    operation: 'CREATE_LEAD',
    local_source_id: requireText(contact.id, 'Thiếu mã nguồn lead CRM.'),
    case_id: createC53CrmIdempotencyKey(),
    candidate_id: cleanText(contact.leadStudentName) ? createC53CrmIdempotencyKey() : undefined,
    contact: {
      display_name: requireText(contact.parentName, 'Cần tên phụ huynh/khách cho canonical Contact.'),
      phones,
      emails,
    },
    safe_state: buildC53SafeCaseState(contact),
    lead_student_name: cleanText(contact.leadStudentName),
    interest_summary: cleanText(contact.leadNeed),
    safe_summary: cleanText(contact.parentFeedbackAboutChild),
    initial_care_log: initialCareLog || undefined,
    appointments: (Array.isArray(contact.appointments) ? contact.appointments : [])
      .map(buildC53AppointmentPayload),
  })
}

export function buildC53SaveCaseCommand(contact = {}, { appointment = null } = {}) {
  return stripUndefined({
    operation: 'SAVE_CASE',
    case_id: requireText(contact.canonicalCaseId, 'Thiếu canonical Case ID.'),
    local_source_id: cleanText(contact.id),
    expected_case_version: requireVersion(contact.cloudCaseVersion, 1, 'Case'),
    expected_state_version: requireVersion(contact.cloudStateVersion, 0, 'CRM state'),
    expected_candidate_version: requireVersion(contact.cloudCandidateVersion, 0, 'Candidate'),
    candidate_id: cleanText(contact.canonicalCandidateId) || undefined,
    safe_state: buildC53SafeCaseState(contact),
    lead_student_name: cleanText(contact.leadStudentName),
    interest_summary: cleanText(contact.leadNeed),
    safe_summary: cleanText(contact.parentFeedbackAboutChild),
    appointment: appointment ? buildC53AppointmentPayload(appointment) : undefined,
  })
}

export function buildC53AppendCareLogCommand(contact = {}, careLog = {}) {
  return {
    operation: 'APPEND_CARE_LOG',
    case_id: requireText(contact.canonicalCaseId, 'Thiếu canonical Case ID.'),
    expected_case_version: requireVersion(contact.cloudCaseVersion, 1, 'Case'),
    care_log: buildC53CareLogPayload(careLog),
  }
}

export function buildC53UpsertAppointmentCommand(contact = {}, appointment = {}) {
  return {
    operation: 'UPSERT_APPOINTMENT',
    case_id: requireText(contact.canonicalCaseId, 'Thiếu canonical Case ID.'),
    expected_case_version: requireVersion(contact.cloudCaseVersion, 1, 'Case'),
    appointment: buildC53AppointmentPayload(appointment),
  }
}

export function buildC53AssignCaseCommand(contact = {}, targetConsultantUserId = '') {
  return {
    operation: 'ASSIGN_CASE',
    case_id: requireText(contact.canonicalCaseId, 'Thiếu canonical Case ID.'),
    expected_case_version: requireVersion(contact.cloudCaseVersion, 1, 'Case'),
    expected_assignment_version: requireVersion(contact.cloudAssignmentVersion, 0, 'Assignment'),
    new_assignment_id: createC53CrmIdempotencyKey(),
    target_consultant_user_id: requireText(targetConsultantUserId, 'Thiếu tài khoản consultant đích.'),
  }
}

export function buildC53ArchiveCaseCommand(contact = {}) {
  return {
    operation: 'ARCHIVE_CASE',
    case_id: requireText(contact.canonicalCaseId, 'Thiếu canonical Case ID.'),
    expected_case_version: requireVersion(contact.cloudCaseVersion, 1, 'Case'),
  }
}

export function buildC53CareLogPayload(careLog = {}) {
  const channel = cleanText(careLog.channel) || 'note'
  return {
    care_log_id: cleanText(careLog.canonicalCareLogId) || createC53CrmIdempotencyKey(),
    entry_type: CARE_ENTRY_TYPES[channel] || 'NOTE',
    payload: {
      contactedAt: cleanText(careLog.contactedAt || careLog.createdAt) || new Date().toISOString(),
      channel,
      content: requireText(careLog.content, 'Nội dung care log không được trống.'),
      result: cleanText(careLog.result),
      nextAction: cleanText(careLog.nextAction),
    },
  }
}

export function buildC53AppointmentPayload(appointment = {}) {
  const type = APPOINTMENT_TYPES[appointment.appointmentType] || APPOINTMENT_TYPES.other
  const status = APPOINTMENT_STATUSES.has(appointment.status) ? appointment.status : 'scheduled'
  return stripUndefined({
    appointment_id: cleanText(appointment.canonicalAppointmentId) || createC53CrmIdempotencyKey(),
    client_appointment_id: requireText(appointment.id, 'Thiếu mã lịch hẹn CRM.'),
    expected_version: requireVersion(appointment.cloudVersion, 0, 'Appointment'),
    appointment_type: type,
    scheduled_at: requireText(appointment.scheduledAt, 'Thiếu thời gian lịch hẹn CRM.'),
    channel: cleanText(appointment.channel || 'other').toUpperCase(),
    status: status.toUpperCase(),
    location: cleanText(appointment.location),
    note: cleanText(appointment.note),
    source_type: cleanText(appointment.sourceType) || undefined,
    source_draft_id: cleanText(appointment.sourceDraftId) || undefined,
  })
}

export function buildC53SafeCaseState(contact = {}) {
  const enrollment = contact.enrollmentDraft && typeof contact.enrollmentDraft === 'object'
    ? contact.enrollmentDraft
    : {}
  return {
    contactType: cleanText(contact.contactType) || 'consultingLead',
    customerStage: cleanText(contact.customerStage) || 'lead',
    consultationStatus: cleanText(contact.consultationStatus) || 'newLead',
    source: cleanText(contact.source) || 'unknown',
    studentBirthYear: cleanText(contact.studentBirthYear),
    interestedProgram: cleanText(contact.interestedProgram),
    preferredSchedule: cleanText(contact.preferredSchedule),
    locationArea: cleanText(contact.locationArea),
    consultedAt: cleanText(contact.consultedAt),
    registeredAt: cleanText(contact.registeredAt),
    nextAction: cleanText(contact.nextAction),
    nextFollowUpAt: cleanText(contact.nextFollowUpAt),
    potentialLevel: cleanText(contact.potentialLevel),
    parentFeedbackAboutChild: cleanText(contact.parentFeedbackAboutChild),
    enrollmentDraft: {
      isReady: Boolean(enrollment.isReady),
      expectedStartDate: cleanText(enrollment.expectedStartDate),
      expectedTrialDate: cleanText(enrollment.expectedTrialDate),
      childChessLevel: cleanText(enrollment.childChessLevel),
      trialDraftId: cleanText(enrollment.trialDraftId),
      trialAppointmentId: cleanText(enrollment.trialAppointmentId),
      trialScheduledAt: cleanText(enrollment.trialScheduledAt),
      note: cleanText(enrollment.note),
      readyAt: enrollment.readyAt || null,
      createdAt: enrollment.createdAt || null,
      updatedAt: enrollment.updatedAt || null,
    },
  }
}

export function projectC53CrmRecord(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  if (!cleanText(record.id) || !cleanText(record.canonicalCaseId)) return null
  return {
    ...record,
    phone: '',
    secondaryPhone: '',
    email: '',
    identityReadOnly: true,
    contactMethodsVisibility: 'MASKED_PROTECTED',
    careLogs: Array.isArray(record.careLogs) ? record.careLogs : [],
    appointments: Array.isArray(record.appointments) ? record.appointments : [],
    enrollmentDraft: record.enrollmentDraft && typeof record.enrollmentDraft === 'object'
      ? { ...record.enrollmentDraft, contactMethodProtected: true }
      : {},
  }
}

export function getC53CrmOutcomeMessage(outcomeCode) {
  const messages = {
    NOT_AUTHENTICATED: 'Phiên đăng nhập không hợp lệ; CRM chưa được lưu.',
    CLIENT_NOT_READY: 'Không kết nối được cloud; CRM chưa được lưu.',
    INVALID_CENTER: 'Cơ sở không hợp lệ; CRM chưa được lưu.',
    CENTER_ACCESS_DENIED: 'Tài khoản không có active membership tại cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Vai trò hiện tại không được ghi CRM.',
    CRM_RUNTIME_NOT_ACTIVE: 'Canonical CRM của cơ sở chưa ở trạng thái ACTIVE/ENABLED.',
    CRM_READ_NOT_ACTIVE: 'Canonical CRM của cơ sở chưa cho phép đọc.',
    INVALID_COMMAND: 'Lệnh CRM không hợp lệ.',
    INVALID_OPERATION: 'Thao tác không thuộc authoritative CRM C5.3.',
    INVALID_PAYLOAD: 'Dữ liệu CRM không hợp lệ hoặc chứa identity cần bảo vệ.',
    CONTACT_METHOD_REQUIRED: 'Lead mới cần ít nhất một số điện thoại hoặc email hợp lệ.',
    INGRESS_CONFLICT: 'Identity Contact đã thay đổi; C5.3 từ chối merge/ghi đè im lặng.',
    SOURCE_IDENTITY_CONFLICT: 'Mã nguồn lead đã được dùng cho identity/nội dung khác.',
    CASE_VERSION_STALE: 'Case đã được tài khoản khác cập nhật. Hãy làm mới trước khi lưu.',
    STATE_VERSION_STALE: 'CRM business state đã thay đổi. Hãy làm mới trước khi lưu.',
    CANDIDATE_VERSION_STALE: 'Candidate identity đã thay đổi. Hãy làm mới trước khi lưu.',
    APPOINTMENT_VERSION_STALE: 'Lịch hẹn đã thay đổi. Hãy làm mới trước khi lưu.',
    ASSIGNMENT_VERSION_STALE: 'Assignment đã thay đổi. Hãy làm mới trước khi gán lại.',
    ACTIVE_ASSIGNMENT_CONFLICT: 'Case đang có assignment active nên không thể đóng/lưu trữ.',
    CONTACT_VERSION_STALE: 'Canonical Contact đã thay đổi; C5.3 không ghi đè identity.',
    IDEMPOTENCY_CONFLICT: 'Khóa retry đã được dùng cho một lệnh CRM khác.',
    CONCURRENT_CONFLICT: 'Có lệnh CRM đồng thời; hãy làm mới rồi thử lại.',
    INVALID_STATE_TRANSITION: 'Chuyển trạng thái Case không hợp lệ theo canonical CRM.',
    RESOURCE_STATE_CONFLICT: 'Case đang ở trạng thái không cho phép sửa.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Không tìm thấy Case hoặc tài khoản không có quyền trên Case.',
    INVALID_APPOINTMENT: 'Lịch hẹn không hợp lệ hoặc chứa identity cần bảo vệ.',
    INVALID_CARE_LOG: 'Care log không hợp lệ.',
    INVALID_INPUT: 'Canonical CRM từ chối dữ liệu đầu vào.',
    RESOURCE_NOT_AVAILABLE: 'Canonical CRM/identity service chưa sẵn sàng.',
    LOOKUP_CONTROL_UNAVAILABLE: 'CRM lookup key chưa sẵn sàng.',
    INVALID_SERVER_RESULT: 'Server trả kết quả CRM không hợp lệ; cache chưa thay đổi.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã đổi; view hiện tại không nhận dữ liệu từ cơ sở trước.',
    CRM_SHARED_TRUTH_READ_FAILED: 'Không đọc được authoritative CRM; cache chưa thay đổi.',
    SERVER_COMMAND_FAILED: 'Không commit được CRM lên server; cache chưa thay đổi.',
    CRM_COMMAND_FAILED: 'Lệnh CRM thất bại trên server; cache chưa thay đổi.',
  }
  return messages[String(outcomeCode || '')] || 'Không thể cập nhật authoritative CRM.'
}

function failure(outcomeCode, error, detail = null, idempotencyKey = null) {
  return { ok: false, outcome_code: outcomeCode, error, detail, idempotencyKey }
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value))
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function requireText(value, message) {
  const normalized = cleanText(value)
  if (!normalized) throw new Error(message)
  return normalized
}

function requireVersion(value, minimum, label) {
  const version = Number(value ?? 0)
  if (!Number.isSafeInteger(version) || version < minimum) {
    throw new Error(`${label} version không hợp lệ.`)
  }
  return version
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, stripUndefined(item)]))
}
