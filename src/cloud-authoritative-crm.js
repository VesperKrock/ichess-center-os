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
    if (!data?.ok || !Array.isArray(data.records)) {
      const outcomeCode = String(data?.outcome_code || 'INVALID_SERVER_RESULT')
      return failure(outcomeCode, getC53CrmOutcomeMessage(outcomeCode), data)
    }
    if (String(data.center_id || '') !== normalizedCenterId) {
      return failure('CENTER_CONTEXT_CHANGED', getC53CrmOutcomeMessage('CENTER_CONTEXT_CHANGED'))
    }
    return {
      ok: true,
      outcome_code: data.outcome_code,
      centerId: normalizedCenterId,
      cachePolicy: data.projection_cache_policy || C53_CRM_MASKED_CACHE_POLICY,
      eligibleConsultants: Array.isArray(data.eligible_consultants) ? data.eligible_consultants : [],
      records: data.records.map(projectC53CrmRecord).filter(Boolean),
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
      interestedProgram: cleanText(enrollment.interestedProgram),
      preferredSchedule: cleanText(enrollment.preferredSchedule),
      learningGoal: cleanText(enrollment.learningGoal),
      expectedStartDate: cleanText(enrollment.expectedStartDate),
      expectedTrialDate: cleanText(enrollment.expectedTrialDate),
      childChessLevel: cleanText(enrollment.childChessLevel),
      trialDraftId: cleanText(enrollment.trialDraftId),
      trialAppointmentId: cleanText(enrollment.trialAppointmentId),
      trialScheduledAt: cleanText(enrollment.trialScheduledAt),
      note: cleanText(enrollment.note),
      advisorName: cleanText(enrollment.advisorName),
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
