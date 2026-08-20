export const C57_CALENDAR_NOTES_SOURCE_VERSION =
  'c5.7-calendar-operational-notes-authoritative-shared-truth-v1'

const WRITE_ROLES = new Set(['owner', 'admin', 'center_admin', 'qtv'])
const ITEM_TYPES = new Set(['meeting', 'event', 'tournament', 'other'])
const COLOR_KEYS = new Set(['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray', 'emerald'])
const RECURRENCE_KEYS = new Set([
  'frequency', 'interval', 'daysOfWeek', 'endMode', 'untilDate', 'count', 'timezone',
])
const CARE_STATUSES = new Set([
  'auto', 'needReview', 'sentComment', 'contactedParent', 'waitingParent', 'completed',
])
const WEEKDAY_KEYS = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])

export function createC57IdempotencyKey() {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Trình duyệt không hỗ trợ crypto.randomUUID cho lệnh C5.7.')
  }
  return globalThis.crypto.randomUUID()
}

export function canWriteC57SharedTruth(accessState = {}) {
  const role = cleanText(accessState?.role || accessState?.membership?.role).toLowerCase()
  const canWrite = Boolean(accessState?.canWrite !== false && WRITE_ROLES.has(role))
  return {
    ok: canWrite,
    canWrite,
    role,
    error: canWrite
      ? ''
      : 'Vai trò hiện tại chỉ được đọc Calendar/Operational Notes; dữ liệu chưa được lưu.',
  }
}

export async function pullC57CalendarNotesSharedTruth({ supabase, centerId } = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') return failure('CLIENT_NOT_READY')
  const normalizedCenterId = requireCenterId(centerId, false)
  if (!normalizedCenterId) return failure('INVALID_CENTER')

  try {
    const { data, error } = await supabase.rpc('c5_7_list_calendar_notes_shared_truth', {
      p_center_id: normalizedCenterId,
    })
    if (error) return failure('SHARED_TRUTH_READ_FAILED', String(error.message || error), error)
    if (!data?.ok || data.outcome_code !== 'AUTHORITATIVE_SNAPSHOT'
      || cleanText(data.center_id) !== normalizedCenterId
      || !Array.isArray(data.calendar_items) || !Array.isArray(data.calendar_tags)
      || !Array.isArray(data.operational_notes)) {
      return failure(String(data?.outcome_code || 'INVALID_SERVER_RESULT'), '', data)
    }

    const calendarTags = data.calendar_tags.map((row) => projectC57CalendarTag(row, normalizedCenterId))
    const calendarItems = data.calendar_items.map((row) => projectC57CalendarItem(row, normalizedCenterId))
    const operationalNotes = data.operational_notes.map((row) => projectC57OperationalNote(row, normalizedCenterId))
    if (calendarTags.some((row) => !row) || calendarItems.some((row) => !row)
      || operationalNotes.some((row) => !row)) {
      return failure('INVALID_SERVER_RESULT', '', data)
    }

    if (hasDuplicateIdentity(calendarTags) || hasDuplicateIdentity(calendarItems)
      || hasDuplicateIdentity(operationalNotes)) {
      return failure('INVALID_SERVER_RESULT', '', data)
    }
    const tagById = new Map(calendarTags.map((row) => [row.id, row]))
    const activeTagLabels = new Set()
    for (const tag of calendarTags) {
      const labelIdentity = tag.label.toLocaleLowerCase('vi-VN')
      if (tag.isActive && activeTagLabels.has(labelIdentity)) {
        return failure('INVALID_SERVER_RESULT', '', data)
      }
      if (tag.isActive) activeTagLabels.add(labelIdentity)
    }
    if (calendarItems.some((row) => {
      const tag = row.tagId ? tagById.get(row.tagId) : null
      return row.tagId ? !tag || row.tagLabel !== tag.label : Boolean(row.tagLabel)
    })) return failure('INVALID_SERVER_RESULT', '', data)
    const noteIdentities = new Set()
    for (const note of operationalNotes) {
      const identity = `${note.noteKind}|${note.studentId}|${note.monthKey}`
      if (noteIdentities.has(identity)) return failure('INVALID_SERVER_RESULT', '', data)
      noteIdentities.add(identity)
    }

    return {
      ok: true,
      outcome_code: data.outcome_code,
      centerId: normalizedCenterId,
      calendarItems,
      calendarTags,
      advisoryNotes: operationalNotes
        .filter((row) => row.noteKind === 'attendanceAdvisory')
        .map((row) => ({
          id: row.id,
          studentId: row.studentId,
          monthKey: row.monthKey,
          careStatus: row.careStatus,
          note: row.note,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          cloudVersion: row.cloudVersion,
        })),
      boardNotes: operationalNotes
        .filter((row) => row.noteKind === 'attendanceBoard')
        .map((row) => ({
          id: row.id,
          studentId: row.studentId,
          month: row.monthKey,
          note: row.note,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          cloudVersion: row.cloudVersion,
        })),
    }
  } catch (error) {
    return failure('SHARED_TRUTH_READ_FAILED', String(error?.message || error), error)
  }
}

export async function mutateC57CalendarNotesSharedTruth({
  supabase,
  centerId,
  command,
  idempotencyKey = createC57IdempotencyKey(),
} = {}) {
  if (!supabase || typeof supabase.rpc !== 'function') {
    return failure('CLIENT_NOT_READY', '', null, idempotencyKey)
  }
  const normalizedCenterId = requireCenterId(centerId, false)
  if (!normalizedCenterId) return failure('INVALID_CENTER', '', null, idempotencyKey)
  if (!isPlainObject(command)) return failure('INVALID_COMMAND', '', null, idempotencyKey)

  try {
    const { data, error } = await supabase.rpc('c5_7_mutate_calendar_notes_shared_truth', {
      p_center_id: normalizedCenterId,
      p_command: command,
      p_idempotency_key: idempotencyKey,
    })
    if (error) return failure('SERVER_COMMAND_FAILED', String(error.message || error), error, idempotencyKey)
    if (!data?.ok) return failure(String(data?.outcome_code || 'SERVER_COMMAND_FAILED'), '', data, idempotencyKey)
    const expectedEntityType = getExpectedEntityType(command.operation)
    if (data.outcome_code !== 'COMMITTED' || cleanText(data.center_id) !== normalizedCenterId
      || cleanText(data.entity_type) !== expectedEntityType
      || !isUuid(data.entity_id) || !positiveInteger(data.entity_version)
      || !isUuid(data.actor_user_id) || !isUuid(data.actor_membership_id)
      || !WRITE_ROLES.has(cleanText(data.actor_role).toLowerCase())
      || !validIso(data.committed_at)) {
      return failure('INVALID_SERVER_RESULT', '', data, idempotencyKey)
    }
    return { ...data, ok: true, idempotencyKey }
  } catch (error) {
    return failure('SERVER_COMMAND_FAILED', String(error?.message || error), error, idempotencyKey)
  }
}

export function buildC57SaveCalendarTagCommand(tag = {}) {
  const version = authoritativeVersion(tag)
  const colorKey = cleanText(tag.colorKey).toLowerCase()
  const defaultItemType = cleanText(tag.defaultItemType).toLowerCase()
  if (!COLOR_KEYS.has(colorKey)) throw new Error('Màu nhãn Calendar không hợp lệ.')
  if (defaultItemType && !ITEM_TYPES.has(defaultItemType)) throw new Error('Loại mặc định của nhãn không hợp lệ.')
  return {
    operation: version ? 'UPDATE_CALENDAR_TAG' : 'CREATE_CALENDAR_TAG',
    tag_id: version ? requireUuid(tag.id, 'Thiếu tag_id authoritative.') : createC57IdempotencyKey(),
    expected_version: version,
    label: requireText(tag.label, 'Tên nhãn không được trống.'),
    color_key: colorKey,
    custom_color: normalizeCustomColor(tag.customColor),
    default_item_type: defaultItemType,
    description: cleanText(tag.description),
  }
}

export function buildC57SetCalendarTagActiveCommand(tag = {}, isActive) {
  return {
    operation: 'SET_CALENDAR_TAG_ACTIVE',
    tag_id: requireUuid(tag.id, 'Thiếu tag_id authoritative.'),
    expected_version: requirePositiveVersion(tag, 'Nhãn Calendar'),
    is_active: Boolean(isActive),
  }
}

export function buildC57SaveCalendarItemCommand(item = {}) {
  const version = authoritativeVersion(item)
  const itemType = cleanText(item.itemType).toLowerCase()
  const colorKey = cleanText(item.colorKey).toLowerCase()
  if (!ITEM_TYPES.has(itemType)) throw new Error('Loại Calendar không hợp lệ; lớp học phải dùng Schedule C5.1.')
  if (!COLOR_KEYS.has(colorKey)) throw new Error('Màu Calendar không hợp lệ.')
  if ((item.participantIds?.length || item.teacherIds?.length || item.staffIds?.length)
    || cleanText(item.linkedSessionId) || cleanText(item.linkedClassSessionId)) {
    throw new Error('Custom Calendar không được ghi identity hoặc Schedule/Class authority thứ hai.')
  }
  const startAt = requireIsoDateTime(item.startAt, 'Thời gian bắt đầu Calendar không hợp lệ.')
  const endAt = requireIsoDateTime(item.endAt, 'Thời gian kết thúc Calendar không hợp lệ.')
  if (new Date(endAt).getTime() < new Date(startAt).getTime()) throw new Error('Thời gian kết thúc trước thời gian bắt đầu.')
  return {
    operation: version ? 'UPDATE_CALENDAR_ITEM' : 'CREATE_CALENDAR_ITEM',
    item_id: version ? requireUuid(item.id, 'Thiếu item_id authoritative.') : createC57IdempotencyKey(),
    expected_version: version,
    item_type: itemType.toUpperCase(),
    item_subtype: cleanText(item.itemSubtype),
    title: requireText(item.title, 'Tiêu đề Calendar không được trống.'),
    description: cleanText(item.description),
    start_at: startAt,
    end_at: endAt,
    all_day: Boolean(item.allDay),
    location: cleanText(item.location),
    room_id: cleanText(item.roomId),
    color_key: colorKey,
    custom_color: normalizeCustomColor(item.customColor),
    tag_id: cleanText(item.tagId) ? requireUuid(item.tagId, 'Nhãn Calendar không hợp lệ.') : null,
    recurrence_rule: normalizeRecurrenceRule(item.recurrenceRule, startAt),
    is_cancelled: Boolean(item.isCancelled),
  }
}

export function buildC57ArchiveCalendarItemCommand(item = {}) {
  return {
    operation: 'ARCHIVE_CALENDAR_ITEM',
    item_id: requireUuid(item.id, 'Thiếu item_id authoritative.'),
    expected_version: requirePositiveVersion(item, 'Calendar item'),
  }
}

export function buildC57UpsertAdvisoryNoteCommand(note = {}) {
  const version = authoritativeVersion(note)
  const careStatus = cleanText(note.careStatus) || 'auto'
  if (!CARE_STATUSES.has(careStatus)) throw new Error('Trạng thái chăm sóc không hợp lệ.')
  return {
    operation: 'UPSERT_ATTENDANCE_ADVISORY_NOTE',
    note_id: version ? requireUuid(note.id, 'Thiếu note_id authoritative.') : createC57IdempotencyKey(),
    expected_version: version,
    student_local_id: requireLocalId(note.studentId),
    month_key: requireMonthKey(note.monthKey),
    care_status: careStatus,
    note: cleanText(note.note),
  }
}

export function buildC57UpsertBoardNoteCommand(note = {}) {
  const version = authoritativeVersion(note)
  return {
    operation: 'UPSERT_ATTENDANCE_BOARD_NOTE',
    note_id: version ? requireUuid(note.id, 'Thiếu note_id authoritative.') : createC57IdempotencyKey(),
    expected_version: version,
    student_local_id: requireLocalId(note.studentId),
    month_key: requireMonthKey(note.month || note.monthKey),
    note: cleanText(note.note),
  }
}

export function createC57RetryFingerprint(command = {}) {
  const semantic = JSON.parse(JSON.stringify(command))
  if (String(semantic.operation || '').startsWith('CREATE_') || Number(semantic.expected_version) === 0) {
    delete semantic.item_id
    delete semantic.tag_id
    delete semantic.note_id
  }
  return stableStringify(semantic)
}

export function projectC57CalendarTag(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  const colorKey = cleanText(row.color_key).toLowerCase()
  const defaultItemType = cleanText(row.default_item_type).toLowerCase()
  const status = cleanText(row.status).toUpperCase()
  if (!areStrings(row, [
    'center_id', 'id', 'label', 'color_key', 'custom_color', 'default_item_type',
    'description', 'status', 'actor_user_id', 'actor_membership_id', 'actor_role',
    'created_at', 'updated_at',
  ]) || cleanText(row.center_id) !== expectedCenterId || !isUuid(row.id) || !positiveInteger(version)
    || !requireBoundedText(row.label, 1, 50) || !COLOR_KEYS.has(colorKey)
    || (defaultItemType && !ITEM_TYPES.has(defaultItemType)) || !['ACTIVE', 'ARCHIVED'].includes(status)
    || !requireBoundedText(row.description, 0, 2000)
    || !validOptionalColor(row.custom_color) || !validServerActor(row)
    || !validIso(row.created_at) || !validIso(row.updated_at)) return null
  return {
    id: row.id,
    centerId: expectedCenterId,
    label: cleanText(row.label),
    colorKey,
    customColor: cleanText(row.custom_color),
    defaultItemType,
    description: cleanText(row.description),
    isActive: status === 'ACTIVE',
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
    cloudVersion: version,
  }
}

export function projectC57CalendarItem(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  const itemType = cleanText(row.item_type).toLowerCase()
  const colorKey = cleanText(row.color_key).toLowerCase()
  const status = cleanText(row.status).toUpperCase()
  const recurrenceRule = projectRecurrenceRule(row.recurrence_rule, row.start_at)
  const tagId = cleanText(row.tag_id)
  if (!areStrings(row, [
    'center_id', 'id', 'item_type', 'item_subtype', 'title', 'description', 'start_at',
    'end_at', 'location', 'room_id', 'color_key', 'custom_color', 'tag_id', 'tag_label',
    'status', 'actor_user_id', 'actor_membership_id', 'actor_role', 'created_at', 'updated_at',
  ]) || cleanText(row.center_id) !== expectedCenterId || !isUuid(row.id) || !positiveInteger(version)
    || !ITEM_TYPES.has(itemType) || !COLOR_KEYS.has(colorKey) || !requireBoundedText(row.title, 1, 200)
    || !requireBoundedText(row.item_subtype, 0, 120) || !requireBoundedText(row.description, 0, 8000)
    || !requireBoundedText(row.location, 0, 500) || !requireBoundedText(row.room_id, 0, 200)
    || !validIso(row.start_at) || !validIso(row.end_at)
    || new Date(row.end_at).getTime() < new Date(row.start_at).getTime()
    || !['ACTIVE', 'ARCHIVED'].includes(status) || (tagId && !isUuid(tagId))
    || row.recurrence_rule !== null && !recurrenceRule || !validOptionalColor(row.custom_color)
    || typeof row.all_day !== 'boolean' || typeof row.is_cancelled !== 'boolean'
    || !validServerActor(row) || !validIso(row.created_at) || !validIso(row.updated_at)) return null
  return {
    id: row.id,
    centerId: expectedCenterId,
    itemType,
    itemSubtype: cleanText(row.item_subtype),
    title: cleanText(row.title),
    description: cleanText(row.description),
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    allDay: Boolean(row.all_day),
    location: cleanText(row.location),
    roomId: cleanText(row.room_id),
    colorKey,
    customColor: cleanText(row.custom_color),
    tagId,
    tagLabel: cleanText(row.tag_label),
    participantType: '',
    participantIds: [],
    teacherIds: [],
    staffIds: [],
    recurrenceRule,
    sourceModule: 'center-calendar',
    linkedSessionId: '',
    linkedClassSessionId: '',
    isCancelled: Boolean(row.is_cancelled),
    isArchived: status === 'ARCHIVED',
    createdBy: cleanText(row.actor_role),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
    cloudVersion: version,
  }
}

export function projectC57OperationalNote(row = {}, expectedCenterId = '') {
  const version = Number(row.version)
  const noteKind = cleanText(row.note_kind).toUpperCase()
  const careStatus = cleanText(row.care_status)
  if (!areStrings(row, [
    'center_id', 'id', 'note_kind', 'student_local_id', 'month_key', 'care_status', 'note',
    'actor_user_id', 'actor_membership_id', 'actor_role', 'created_at', 'updated_at',
  ]) || cleanText(row.center_id) !== expectedCenterId || !isUuid(row.id) || !positiveInteger(version)
    || !['ATTENDANCE_ADVISORY', 'ATTENDANCE_BOARD'].includes(noteKind)
    || !requireBoundedText(row.student_local_id, 1, 200) || /[\u0000-\u001f\u007f]/.test(cleanText(row.student_local_id))
    || !/^\d{4}-(0[1-9]|1[0-2])$/.test(cleanText(row.month_key))
    || (noteKind === 'ATTENDANCE_ADVISORY' ? !CARE_STATUSES.has(careStatus) : careStatus !== '')
    || !requireBoundedText(row.note, 0, 8000) || row.student_reference_verified !== true
    || !validServerActor(row) || !validIso(row.created_at) || !validIso(row.updated_at)) return null
  return {
    id: row.id,
    noteKind: noteKind === 'ATTENDANCE_ADVISORY' ? 'attendanceAdvisory' : 'attendanceBoard',
    studentId: cleanText(row.student_local_id),
    monthKey: cleanText(row.month_key),
    careStatus,
    note: cleanText(row.note),
    createdAt: cleanText(row.created_at),
    updatedAt: cleanText(row.updated_at),
    cloudVersion: version,
  }
}

export function getC57OutcomeMessage(code) {
  const messages = {
    NOT_AUTHENTICATED: 'Phiên đăng nhập không hợp lệ; Calendar/Notes chưa được lưu.',
    CLIENT_NOT_READY: 'Cloud chưa sẵn sàng; Calendar/Notes chưa được lưu.',
    INVALID_CENTER: 'Thiếu hoặc sai center_id; không dùng center mặc định.',
    CENTER_ACCESS_DENIED: 'Tài khoản không có quyền tại đúng cơ sở này.',
    WRITE_ROLE_REQUIRED: 'Vai trò hiện tại không được thay đổi Calendar/Notes.',
    INVALID_COMMAND: 'Lệnh Calendar/Notes không hợp lệ.',
    INVALID_OPERATION: 'Thao tác không thuộc authority C5.7.',
    INVALID_PAYLOAD: 'Dữ liệu Calendar/Notes không hợp lệ.',
    RESOURCE_NOT_FOUND_OR_DENIED: 'Không tìm thấy dữ liệu trong đúng cơ sở.',
    STUDENT_REFERENCE_DENIED: 'Học viên không tồn tại trong canonical Student của đúng cơ sở.',
    TAG_REFERENCE_DENIED: 'Nhãn không tồn tại hoặc không dùng được trong đúng cơ sở.',
    VERSION_STALE: 'Dữ liệu đã đổi ở tài khoản khác; hãy Làm mới trước khi lưu.',
    DUPLICATE_ACTIVE_TAG: 'Đã có nhãn đang dùng cùng tên trong cơ sở.',
    IDEMPOTENCY_CONFLICT: 'Khóa retry đã được dùng cho một lệnh khác.',
    CONCURRENT_CONFLICT: 'Có cập nhật đồng thời; hãy Làm mới rồi thử lại.',
    INVALID_SERVER_RESULT: 'Server trả snapshot không hợp lệ; không cài projection một phần.',
    INVALID_SERVER_STATE: 'Server phát hiện tham chiếu Calendar/Notes không còn hợp lệ.',
    CENTER_CONTEXT_CHANGED: 'Cơ sở đã đổi; view hiện tại không nhận dữ liệu cơ sở trước.',
    SHARED_TRUTH_READ_FAILED: 'Không đọc được authoritative Calendar/Notes.',
    SERVER_COMMAND_FAILED: 'Không commit được Calendar/Notes lên server.',
    COMMITTED_PROJECTION_REFRESH_FAILED: 'Đã commit server nhưng chưa tải lại được projection.',
  }
  return messages[String(code || '')] || 'Không thể cập nhật authoritative Calendar/Notes.'
}

function normalizeRecurrenceRule(value, startAt = '') {
  if (!value) return null
  if (!isPlainObject(value) || Object.keys(value).some((key) => !RECURRENCE_KEYS.has(key))
    || cleanText(value.frequency) !== 'weekly' || value.interval !== 1
    || cleanText(value.timezone) !== 'Asia/Ho_Chi_Minh') throw new Error('Quy tắc lặp Calendar không hợp lệ.')
  const sourceDays = Array.isArray(value.daysOfWeek) ? value.daysOfWeek : []
  const daysOfWeek = sourceDays.map((day) => typeof day === 'string' ? cleanText(day) : '')
  if (!daysOfWeek.length || daysOfWeek.some((day) => !WEEKDAY_KEYS.has(day))
    || new Set(daysOfWeek).size !== daysOfWeek.length) {
    throw new Error('Ngày lặp Calendar không hợp lệ.')
  }
  const endMode = cleanText(value.endMode)
  if (endMode === 'until') {
    if (value.count !== null && value.count !== undefined) {
      throw new Error('Điểm kết thúc lặp Calendar không hợp lệ.')
    }
    const untilDate = requireDate(value.untilDate)
    const occurrenceCount = countWeeklyOccurrences(startAt, daysOfWeek, untilDate)
    if (occurrenceCount < 1 || occurrenceCount > 52) {
      throw new Error('Chuỗi lặp Calendar phải có từ 1 đến 52 lần.')
    }
    return {
      frequency: 'weekly', interval: 1, daysOfWeek, endMode,
      untilDate, count: null, timezone: 'Asia/Ho_Chi_Minh',
    }
  }
  const count = Number(value.count)
  if (endMode !== 'count' || value.untilDate !== null && value.untilDate !== undefined
    || typeof value.count !== 'number' || !Number.isSafeInteger(count) || count < 1 || count > 52) {
    throw new Error('Điểm kết thúc lặp Calendar không hợp lệ.')
  }
  return {
    frequency: 'weekly', interval: 1, daysOfWeek, endMode,
    untilDate: null, count, timezone: 'Asia/Ho_Chi_Minh',
  }
}

function projectRecurrenceRule(value, startAt = '') {
  if (value === null || value === undefined) return null
  try { return normalizeRecurrenceRule(value, startAt) } catch { return null }
}

function countWeeklyOccurrences(startAt, daysOfWeek, untilDate) {
  const startDate = getHoChiMinhDate(startAt)
  const start = parseDateOnly(startDate)
  const until = parseDateOnly(untilDate)
  if (!start || !until || until < start) return 0
  const daySpan = Math.floor((until.getTime() - start.getTime()) / 86400000)
  if (daySpan > 370) return 53
  const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  let count = 0
  for (let offset = 0; offset <= daySpan; offset += 1) {
    const cursor = new Date(start.getTime() + offset * 86400000)
    if (daysOfWeek.includes(weekdayKeys[cursor.getUTCDay()])) count += 1
    if (count > 52) return count
  }
  return count
}

function getHoChiMinhDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function parseDateOnly(value) {
  const text = cleanText(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : date
}

function authoritativeVersion(value = {}) {
  const version = Number(value.cloudVersion ?? value.version ?? 0)
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('Version C5.7 không hợp lệ.')
  return version
}

function requirePositiveVersion(value, label) {
  const version = authoritativeVersion(value)
  if (version < 1) throw new Error(`${label} chưa có version authoritative.`)
  return version
}

function requireCenterId(value, shouldThrow = true) {
  const centerId = cleanText(value)
  const valid = centerId && centerId.length <= 160 && /^[a-zA-Z0-9_-]+$/.test(centerId)
  if (!valid && shouldThrow) throw new Error('center_id C5.7 không hợp lệ; không có fallback.')
  return valid ? centerId : ''
}

function requireLocalId(value) {
  const text = cleanText(value)
  if (!requireBoundedText(text, 1, 200) || /[\u0000-\u001f\u007f]/.test(text)) {
    throw new Error('Student reference không hợp lệ.')
  }
  return text
}

function requireMonthKey(value) {
  const month = cleanText(value)
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Tháng ghi chú không hợp lệ.')
  return month
}

function requireDate(value) {
  const text = cleanText(value)
  const date = new Date(`${text}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== text) throw new Error('Ngày Calendar không hợp lệ.')
  return text
}

function requireIsoDateTime(value, message) {
  const text = cleanText(value)
  const date = new Date(text)
  if (!text || Number.isNaN(date.getTime())) throw new Error(message)
  return date.toISOString()
}

function normalizeCustomColor(value) {
  const color = cleanText(value).toLowerCase()
  if (color && !/^#[0-9a-f]{6}$/.test(color)) throw new Error('Màu tùy chỉnh không hợp lệ.')
  return color
}

function requireText(value, message) {
  const text = cleanText(value)
  if (!text) throw new Error(message)
  return text
}

function requireUuid(value, message) {
  const id = cleanText(value)
  if (!isUuid(id)) throw new Error(message)
  return id
}

function validServerActor(row) {
  return isUuid(row.actor_user_id) && isUuid(row.actor_membership_id)
    && WRITE_ROLES.has(cleanText(row.actor_role).toLowerCase())
}

function validOptionalColor(value) {
  const color = cleanText(value)
  return !color || /^#[0-9a-f]{6}$/i.test(color)
}

function validIso(value) {
  const text = cleanText(value)
  return Boolean(text) && !Number.isNaN(new Date(text).getTime())
}

function positiveInteger(value) {
  const number = Number(value)
  return Number.isSafeInteger(number) && number > 0
}

function requireBoundedText(value, minimum, maximum) {
  const length = cleanText(value).length
  return length >= minimum && length <= maximum
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value))
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function areStrings(value, keys) {
  return isPlainObject(value) && keys.every((key) => typeof value[key] === 'string')
}

function hasDuplicateIdentity(rows) {
  return new Set(rows.map((row) => row.id)).size !== rows.length
}

function getExpectedEntityType(operation) {
  const normalized = cleanText(operation).toUpperCase()
  if (normalized.includes('CALENDAR_TAG')) return 'CALENDAR_TAG'
  if (normalized.includes('CALENDAR_ITEM')) return 'CALENDAR_ITEM'
  if (normalized === 'UPSERT_ATTENDANCE_ADVISORY_NOTE') return 'ATTENDANCE_ADVISORY_NOTE'
  if (normalized === 'UPSERT_ATTENDANCE_BOARD_NOTE') return 'ATTENDANCE_BOARD_NOTE'
  return ''
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (!isPlainObject(value)) return JSON.stringify(value)
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

function failure(outcomeCode, detail = '', raw = null, idempotencyKey = '') {
  return {
    ok: false,
    outcome_code: outcomeCode,
    error: detail || getC57OutcomeMessage(outcomeCode),
    raw,
    idempotencyKey,
  }
}
