const DEMO_ATTENDANCE_SOURCE_MODULE = 'bang-diem-danh-demo'
const DEMO_ATTENDANCE_BATCH_ID = 'attendance-board-demo-foundation'

const COUNTED_ATTENDANCE_STATUSES = new Set(['present', 'makeup'])
const DEFAULT_ATTENDANCE_CENTER_ID = 'dreamhome'
const ATTENDANCE_RECORDS_STORAGE_KEY_PREFIX = 'ichessCenterOS.attendanceRecords'
const ATTENDANCE_BASELINE_STATE_STORAGE_KEY_PREFIX = 'ichessCenterOS.attendanceBaselineState'

const KNOWN_ATTENDANCE_SOURCES = new Set([
  'teacher',
  'admin',
  'consultant',
  'initialBaseline',
  'correction',
  'imported',
  'legacyReport',
  'unknown',
])

const BASELINE_STATE_STATUSES = new Set(['notStarted', 'draft', 'locked', 'unlocked'])
const BASELINE_AUDIT_ACTIONS = new Set([
  'startBaseline',
  'lockBaseline',
  'unlockBaseline',
  'updateBaselineRecord',
  'saveBaselineDraft',
  'clearBaselineRecords',
  'undoBaselineEdit',
  'correction',
])

export function buildAttendanceRecordsFromSessionReports(sessionReports = []) {
  return (Array.isArray(sessionReports) ? sessionReports : [])
    .filter((report) => !isDemoSessionReport(report))
    .flatMap((report) =>
      (Array.isArray(report?.attendance) ? report.attendance : [])
        .flatMap((attendanceItem, index) =>
          normalizeAttendanceRecordFromSessionReport(report, attendanceItem, index),
        )
        .filter(Boolean),
    )
}

export function normalizeAttendanceRecordFromSessionReport(report, attendanceItem, index = 0) {
  const studentId = normalizeRequiredText(attendanceItem?.studentId)
  const date = normalizeRequiredText(attendanceItem?.occurrenceDate || report?.occurrenceDate)

  if (!studentId || !date) {
    return []
  }

  const attendanceStatus = normalizeRequiredText(
    attendanceItem?.attendanceStatus || attendanceItem?.status || 'unknown',
  )
  const status = normalizeRequiredText(attendanceItem?.status || attendanceStatus)
  const credits = normalizeAttendanceCredits(attendanceItem?.credits)
  const displayedCreditNumbers = credits.length ? [] : getAttendanceItemDisplayedCreditNumbers(attendanceItem)
  const recordCredits = credits.length
    ? credits
    : displayedCreditNumbers.length
      ? displayedCreditNumbers.map((creditNumber) => ({
          creditNumber,
          creditLabel: String(creditNumber),
          creditValue: 1,
        }))
      : [
          {
            creditNumber: null,
            creditLabel: '',
            creditValue: isCountedAttendanceRecord({ attendanceStatus, countsTowardTuition: attendanceItem?.countsTowardTuition }) ? 1 : 0,
          },
        ]

  return recordCredits.map((credit, creditIndex) => {
    const counted = isCountedAttendanceRecord({
      attendanceStatus,
      countsTowardTuition: attendanceItem?.countsTowardTuition,
      credit,
    })

    return {
      id: createAttendanceRecordId(report, attendanceItem, index, creditIndex),
      sourceReportId: normalizeNullableText(report?.id),
      sourceAttendanceIndex: Number.isInteger(index) ? index : null,
      sourceCreditIndex: Number.isInteger(creditIndex) ? creditIndex : null,

      studentId,
      date,
      classSessionId: normalizeNullableText(attendanceItem?.classSessionId || report?.classSessionId),
      scheduleSessionId: normalizeNullableText(attendanceItem?.scheduleSessionId || report?.scheduleSessionId),
      sessionId: normalizeNullableText(attendanceItem?.sessionId || report?.sessionId),
      teacherId: normalizeNullableText(attendanceItem?.teacherId || report?.teacherId),
      teacherName: normalizeNullableText(attendanceItem?.teacherName || report?.teacherName),

      status,
      attendanceStatus,
      counted,

      creditNumber: credit.creditNumber,
      creditLabel: credit.creditLabel,
      creditValue: counted ? credit.creditValue : 0,

      packageId: normalizeNullableText(attendanceItem?.packageId || report?.packageId),
      tuitionTermId: normalizeNullableText(
        attendanceItem?.tuitionTermId ||
          attendanceItem?.termId ||
          report?.tuitionTermId ||
          report?.termId,
      ),

      source: getAttendanceRecordSource(report, attendanceItem),
      submittedByRole: normalizeNullableText(attendanceItem?.submittedByRole || report?.submittedByRole),

      note: String(attendanceItem?.note || ''),
      raw: cloneRawAttendanceSource(report, attendanceItem),

      createdBy: normalizeNullableText(attendanceItem?.createdBy || report?.createdBy),
      updatedBy: normalizeNullableText(attendanceItem?.updatedBy || report?.updatedBy),
      createdAt: normalizeNullableText(attendanceItem?.createdAt || report?.createdAt),
      updatedAt: normalizeNullableText(attendanceItem?.updatedAt || report?.updatedAt),
      lockedAt: normalizeNullableText(attendanceItem?.lockedAt || report?.lockedAt),
      correctionReason: String(attendanceItem?.correctionReason || report?.correctionReason || ''),
    }
  })
}

export function getAttendanceRecordSource(report, attendanceItem) {
  const explicitSource = attendanceItem?.source || report?.source

  if (KNOWN_ATTENDANCE_SOURCES.has(explicitSource)) {
    return explicitSource
  }

  if (
    attendanceItem?.isImportedAttendance ||
    report?.isImportedAttendance ||
    attendanceItem?.importBatchId ||
    report?.importBatchId
  ) {
    return 'imported'
  }

  if (attendanceItem?.isCorrection || report?.isCorrection) {
    return 'correction'
  }

  if (attendanceItem?.submittedByRole === 'teacher' || report?.submittedByRole === 'teacher') {
    return 'teacher'
  }

  if (report?.sourceModule || attendanceItem?.sourceModule) {
    return 'legacyReport'
  }

  return 'unknown'
}

export function isCountedAttendanceRecord(record) {
  if (!record || record.countsTowardTuition === false) {
    return false
  }

  const status = normalizeRequiredText(record.attendanceStatus || record.status)

  return COUNTED_ATTENDANCE_STATUSES.has(status)
}

export function createAttendanceRecordId(report, attendanceItem, index = 0, creditIndex = 0) {
  const parts = [
    'attendance-record',
    report?.id || report?.sessionId || 'report',
    attendanceItem?.studentId || 'student',
    attendanceItem?.occurrenceDate || report?.occurrenceDate || 'date',
    Number.isInteger(index) ? index : 0,
    Number.isInteger(creditIndex) ? creditIndex : 0,
  ]

  return parts.map(slugifyIdPart).join('-')
}

export function getAttendanceRecordsStorageKey(centerId = DEFAULT_ATTENDANCE_CENTER_ID) {
  return `${ATTENDANCE_RECORDS_STORAGE_KEY_PREFIX}.${normalizeStorageCenterId(centerId)}`
}

export function loadStoredAttendanceRecords(centerId = DEFAULT_ATTENDANCE_CENTER_ID, storage = getLocalStorage()) {
  const rawValue = safeStorageGetItem(storage, getAttendanceRecordsStorageKey(centerId))
  const parsedRecords = parseJsonArray(rawValue)

  return normalizeStoredAttendanceRecords(parsedRecords)
}

export function saveStoredAttendanceRecords(
  centerId = DEFAULT_ATTENDANCE_CENTER_ID,
  records = [],
  storage = getLocalStorage(),
) {
  const normalizedRecords = normalizeStoredAttendanceRecords(records)
  safeStorageSetItem(storage, getAttendanceRecordsStorageKey(centerId), JSON.stringify(normalizedRecords))

  return normalizedRecords
}

export function normalizeStoredAttendanceRecords(records = []) {
  return (Array.isArray(records) ? records : [])
    .map((record) => normalizeStoredAttendanceRecord(record))
    .filter(Boolean)
}

export function normalizeStoredAttendanceRecord(record) {
  if (!record || typeof record !== 'object') {
    return null
  }

  const studentId = normalizeRequiredText(record.studentId)
  const date = normalizeRequiredText(record.date || record.occurrenceDate)

  if (!studentId || !date) {
    return null
  }

  const attendanceStatus = normalizeRequiredText(
    record.attendanceStatus || record.status || 'unknown',
  )
  const status = normalizeRequiredText(record.status || attendanceStatus)
  const source = KNOWN_ATTENDANCE_SOURCES.has(record.source) ? record.source : 'unknown'
  const normalizedCreditValue = normalizeCreditValue(record.creditValue)
  const counted = typeof record.counted === 'boolean'
    ? record.counted
    : isCountedAttendanceRecord({
        attendanceStatus,
        status,
        countsTowardTuition: record.countsTowardTuition,
      })

  return {
    id: normalizeRequiredText(record.id) || createStoredAttendanceRecordId({ ...record, studentId, date, source }),
    sourceReportId: normalizeNullableText(record.sourceReportId),
    sourceAttendanceIndex: normalizeNullableInteger(record.sourceAttendanceIndex),
    sourceCreditIndex: normalizeNullableInteger(record.sourceCreditIndex),

    studentId,
    date,
    classSessionId: normalizeNullableText(record.classSessionId),
    scheduleSessionId: normalizeNullableText(record.scheduleSessionId),
    sessionId: normalizeNullableText(record.sessionId),
    teacherId: normalizeNullableText(record.teacherId),
    teacherName: normalizeNullableText(record.teacherName),

    status,
    attendanceStatus,
    counted,

    creditNumber: normalizeCreditNumber(record.creditNumber ?? record.sessionNumber),
    creditLabel: String(record.creditLabel ?? record.displayValue ?? record.creditNumber ?? ''),
    creditValue: counted ? normalizedCreditValue : 0,

    packageId: normalizeNullableText(record.packageId),
    tuitionTermId: normalizeNullableText(record.tuitionTermId || record.termId),

    source,
    submittedByRole: normalizeNullableText(record.submittedByRole),

    note: String(record.note || ''),

    createdBy: normalizeNullableText(record.createdBy),
    updatedBy: normalizeNullableText(record.updatedBy),
    createdAt: normalizeNullableText(record.createdAt),
    updatedAt: normalizeNullableText(record.updatedAt),

    lockedAt: normalizeNullableText(record.lockedAt),
    correctionReason: String(record.correctionReason || ''),

    raw: cloneJsonSafe(record.raw),
  }
}

export function createInitialBaselineAttendanceRecord(input = {}) {
  return normalizeStoredAttendanceRecord({
    ...cloneJsonSafe(input),
    source: 'initialBaseline',
    attendanceStatus: input?.attendanceStatus || input?.status || 'present',
    status: input?.status || input?.attendanceStatus || 'present',
  })
}

export function createAdminAttendanceRecord(input = {}) {
  const attendanceStatus = normalizeRequiredText(input?.attendanceStatus || input?.status || 'present')
  const counted = typeof input?.counted === 'boolean'
    ? input.counted
    : COUNTED_ATTENDANCE_STATUSES.has(attendanceStatus)
  const creditValue = counted ? normalizeCreditValue(input?.creditValue) : 0

  return normalizeStoredAttendanceRecord({
    ...cloneJsonSafe(input),
    id: input?.id || createAdminAttendanceRecordId(input),
    source: 'admin',
    submittedByRole: input?.submittedByRole || 'admin',
    attendanceStatus,
    status: input?.status || attendanceStatus,
    counted,
    creditNumber: input?.creditNumber ?? null,
    creditLabel: input?.creditLabel ?? '',
    creditValue,
  })
}

export function upsertAdminAttendanceRecords({
  records = [],
  inputs = [],
  byName = null,
  at = new Date().toISOString(),
} = {}) {
  const existingRecords = normalizeStoredAttendanceRecords(records)
  const adminInputs = Array.isArray(inputs) ? inputs : []
  const savedRecords = adminInputs
    .map((input) => {
      const existingRecord = existingRecords.find((record) =>
        isSameAdminAttendanceRecord(record, input),
      )
      return createAdminAttendanceRecord({
        ...cloneJsonSafe(input),
        id: existingRecord?.id || createAdminAttendanceRecordId(input),
        createdAt: existingRecord?.createdAt || input?.createdAt || at,
        createdBy: existingRecord?.createdBy || input?.createdBy || byName,
        updatedAt: at,
        updatedBy: byName,
      })
    })
    .filter(Boolean)

  const savedKeySet = new Set(savedRecords.map((record) => getAdminAttendanceRecordMatchKey(record)))
  const nextRecords = [
    ...savedRecords,
    ...existingRecords.filter((record) =>
      record.source !== 'admin' || !savedKeySet.has(getAdminAttendanceRecordMatchKey(record)),
    ),
  ]

  return {
    records: normalizeStoredAttendanceRecords(nextRecords),
    savedRecords,
  }
}

export function createTeacherAttendanceRecord(input = {}) {
  const attendanceStatus = normalizeTeacherStoredAttendanceStatus(input?.attendanceStatus || input?.status || 'present')
  const counted = typeof input?.counted === 'boolean'
    ? input.counted
    : COUNTED_ATTENDANCE_STATUSES.has(attendanceStatus)
  const creditValue = counted ? normalizeCreditValue(input?.creditValue) : 0

  return normalizeStoredAttendanceRecord({
    ...cloneJsonSafe(input),
    id: input?.id || createTeacherAttendanceRecordId(input),
    source: 'teacher',
    submittedByRole: input?.submittedByRole || 'teacher',
    attendanceStatus,
    status: input?.status || attendanceStatus,
    counted,
    creditNumber: input?.creditNumber ?? null,
    creditLabel: input?.creditLabel ?? '',
    creditValue,
  })
}

export function upsertTeacherAttendanceRecords({
  records = [],
  inputs = [],
  byName = null,
  at = new Date().toISOString(),
} = {}) {
  const existingRecords = normalizeStoredAttendanceRecords(records)
  const teacherInputs = Array.isArray(inputs) ? inputs : []
  const savedRecords = teacherInputs
    .map((input) => {
      const existingRecord = existingRecords.find((record) =>
        isSameTeacherAttendanceRecord(record, input),
      )
      return createTeacherAttendanceRecord({
        ...cloneJsonSafe(input),
        id: existingRecord?.id || createTeacherAttendanceRecordId(input),
        createdAt: existingRecord?.createdAt || input?.createdAt || at,
        createdBy: existingRecord?.createdBy || input?.createdBy || byName,
        updatedAt: at,
        updatedBy: byName,
      })
    })
    .filter(Boolean)

  const savedKeySet = new Set(savedRecords.map((record) => getTeacherAttendanceRecordMatchKey(record)))
  const nextRecords = [
    ...savedRecords,
    ...existingRecords.filter((record) =>
      record.source !== 'teacher' || !savedKeySet.has(getTeacherAttendanceRecordMatchKey(record)),
    ),
  ]

  return {
    records: normalizeStoredAttendanceRecords(nextRecords),
    savedRecords,
  }
}

export function canEditAttendanceBaseline(state = {}) {
  return normalizeAttendanceBaselineState(state).status !== 'locked'
}

export function upsertInitialBaselineAttendanceRecord({
  records = [],
  state = {},
  input = {},
  byRole = null,
  byName = null,
  at = new Date().toISOString(),
} = {}) {
  const normalizedState = normalizeAttendanceBaselineState(state)

  if (!canEditAttendanceBaseline(normalizedState)) {
    return {
      records: normalizeStoredAttendanceRecords(records),
      state: normalizedState,
      record: null,
      blocked: true,
      reason: 'baselineLocked',
    }
  }

  const baselineRecord = createInitialBaselineAttendanceRecord({
    ...cloneJsonSafe(input),
    id: createInitialBaselineRecordId(input),
    createdAt: input?.createdAt || at,
    updatedAt: at,
    createdBy: input?.createdBy || byName,
    updatedBy: byName,
  })

  if (!baselineRecord) {
    return {
      records: normalizeStoredAttendanceRecords(records),
      state: normalizedState,
      record: null,
      blocked: true,
      reason: 'invalidRecord',
    }
  }

  const existingRecords = normalizeStoredAttendanceRecords(records)
  const existingRecord = existingRecords.find((record) =>
    record.source === 'initialBaseline' &&
      record.studentId === baselineRecord.studentId &&
      record.date === baselineRecord.date,
  )
  const record = normalizeStoredAttendanceRecord({
    ...baselineRecord,
    id: existingRecord?.id || baselineRecord.id,
    createdAt: existingRecord?.createdAt || baselineRecord.createdAt,
    createdBy: existingRecord?.createdBy || baselineRecord.createdBy,
  })
  const nextRecords = [
    record,
    ...existingRecords.filter((candidate) =>
      !(
        candidate.source === 'initialBaseline' &&
        candidate.studentId === record.studentId &&
        candidate.date === record.date
      ),
    ),
  ]
  const nextState = normalizeAttendanceBaselineState({
    ...normalizedState,
    status: normalizedState.status === 'notStarted' ? 'draft' : normalizedState.status,
    lastActionAt: at,
    lastActionBy: byName,
    auditLog: [
      ...normalizedState.auditLog,
      createAttendanceBaselineAuditEntry('updateBaselineRecord', {
        at,
        byRole,
        byName,
        studentId: record.studentId,
        recordId: record.id,
        note: record.note,
      }),
    ],
  })

  return {
    records: nextRecords,
    state: nextState,
    record,
    blocked: false,
    reason: '',
  }
}

export function removeInitialBaselineAttendanceRecord({
  records = [],
  state = {},
  studentId = '',
  date = '',
  byRole = null,
  byName = null,
  at = new Date().toISOString(),
} = {}) {
  const normalizedState = normalizeAttendanceBaselineState(state)

  if (!canEditAttendanceBaseline(normalizedState)) {
    return {
      records: normalizeStoredAttendanceRecords(records),
      state: normalizedState,
      removedRecord: null,
      blocked: true,
      reason: 'baselineLocked',
    }
  }

  const normalizedStudentId = normalizeRequiredText(studentId)
  const normalizedDate = normalizeRequiredText(date)
  const existingRecords = normalizeStoredAttendanceRecords(records)
  const removedRecord = existingRecords.find((record) =>
    record.source === 'initialBaseline' &&
      record.studentId === normalizedStudentId &&
      record.date === normalizedDate,
  ) || null
  const nextRecords = existingRecords.filter((record) =>
    !(
      record.source === 'initialBaseline' &&
      record.studentId === normalizedStudentId &&
      record.date === normalizedDate
    ),
  )
  const nextState = normalizeAttendanceBaselineState({
    ...normalizedState,
    status: normalizedState.status === 'notStarted' ? 'draft' : normalizedState.status,
    lastActionAt: at,
    lastActionBy: byName,
    auditLog: [
      ...normalizedState.auditLog,
      createAttendanceBaselineAuditEntry('updateBaselineRecord', {
        at,
        byRole,
        byName,
        studentId: normalizedStudentId,
        recordId: removedRecord?.id || null,
        note: 'Xóa dữ liệu nền trong ô điểm danh.',
      }),
    ],
  })

  return {
    records: nextRecords,
    state: nextState,
    removedRecord,
    blocked: false,
    reason: '',
  }
}

export function clearInitialBaselineAttendanceRecordsInMonth({
  records = [],
  state = {},
  month = '',
  byRole = null,
  byName = null,
  at = new Date().toISOString(),
} = {}) {
  const normalizedState = normalizeAttendanceBaselineState(state)

  if (!canEditAttendanceBaseline(normalizedState)) {
    return {
      records: normalizeStoredAttendanceRecords(records),
      state: normalizedState,
      removedRecords: [],
      blocked: true,
      reason: 'baselineLocked',
    }
  }

  const normalizedMonth = normalizeRequiredText(month)
  const existingRecords = normalizeStoredAttendanceRecords(records)
  const removedRecords = existingRecords.filter((record) =>
    record.source === 'initialBaseline' &&
      (!normalizedMonth || record.date.startsWith(normalizedMonth)),
  )
  const nextRecords = existingRecords.filter((record) =>
    !(
      record.source === 'initialBaseline' &&
      (!normalizedMonth || record.date.startsWith(normalizedMonth))
    ),
  )
  const nextState = normalizeAttendanceBaselineState({
    ...normalizedState,
    status: normalizedState.status === 'notStarted' ? 'draft' : normalizedState.status,
    lastActionAt: at,
    lastActionBy: byName,
    auditLog: [
      ...normalizedState.auditLog,
      createAttendanceBaselineAuditEntry('clearBaselineRecords', {
        at,
        byRole,
        byName,
        note: normalizedMonth
          ? `Xóa dữ liệu nền đang nhập trong tháng ${normalizedMonth}.`
          : 'Xóa dữ liệu nền đang nhập.',
      }),
    ],
  })

  return {
    records: nextRecords,
    state: nextState,
    removedRecords,
    blocked: false,
    reason: '',
  }
}

export function saveAttendanceBaselineDraftState(
  state = {},
  { byRole = null, byName = null, at = new Date().toISOString(), note = '' } = {},
) {
  const normalizedState = normalizeAttendanceBaselineState(state)

  if (!canEditAttendanceBaseline(normalizedState)) {
    return normalizedState
  }

  return normalizeAttendanceBaselineState({
    ...normalizedState,
    status: normalizedState.status === 'notStarted' ? 'draft' : normalizedState.status,
    lastActionAt: at,
    lastActionBy: byName,
    auditLog: [
      ...normalizedState.auditLog,
      createAttendanceBaselineAuditEntry('saveBaselineDraft', {
        at,
        byRole,
        byName,
        note: note || 'Lưu thay đổi dữ liệu nền điểm danh.',
      }),
    ],
  })
}

export function parseInitialBaselineCellInput(value) {
  const rawValue = String(value ?? '').trim().toUpperCase()

  if (!rawValue || rawValue === '-') {
    return {
      valid: true,
      action: 'delete',
      normalizedText: '',
      input: null,
      error: '',
    }
  }

  if (/^\d+(\+\d+)*$/.test(rawValue)) {
    const creditNumbers = rawValue.split('+').map(Number)

    if (creditNumbers.some((creditNumber) =>
      !Number.isInteger(creditNumber) || creditNumber <= 0 || creditNumber > 99,
    )) {
      return createInvalidBaselineCellParseResult()
    }

    return {
      valid: true,
      action: 'upsert',
      normalizedText: rawValue,
      input: {
        status: 'present',
        attendanceStatus: 'present',
        counted: true,
        creditValue: creditNumbers.length,
        creditNumber: creditNumbers.length === 1 ? creditNumbers[0] : null,
        creditLabel: rawValue,
        note: 'Dữ liệu nền nhập trực tiếp trên bảng.',
        raw: {
          attendanceItem: {
            displayValue: rawValue,
            credits: creditNumbers.map((creditNumber) => ({
              displayValue: String(creditNumber),
              sessionNumber: creditNumber,
              value: creditNumber,
            })),
          },
        },
      },
      error: '',
    }
  }

  if (rawValue === 'T') {
    return createStatusBaselineCellParseResult(rawValue, 'trial', false, 0, 'Học thử')
  }

  if (rawValue === 'V') {
    return createStatusBaselineCellParseResult(rawValue, 'absent', false, 0, 'Vắng')
  }

  if (rawValue === 'P' || rawValue === 'CP') {
    return createStatusBaselineCellParseResult(rawValue, 'excused', false, 0, 'Có phép')
  }

  if (rawValue === 'B') {
    return createStatusBaselineCellParseResult(rawValue, 'makeup', true, 1, 'Học bù')
  }

  return createInvalidBaselineCellParseResult()
}

export function getStudentAttendanceCredits(records = [], studentId = '') {
  const normalizedStudentId = normalizeRequiredText(studentId)
  const normalizedRecords = normalizeStoredAttendanceRecords(records)
    .filter((record) => record.studentId === normalizedStudentId && record.counted)
  const baselineDateKeys = new Set(
    normalizedRecords
      .filter((record) => record.source === 'initialBaseline')
      .map((record) => record.date),
  )

  return normalizedRecords
    .filter((record) => record.source === 'initialBaseline' || !baselineDateKeys.has(record.date))
    .flatMap((record) =>
      getAttendanceCreditNumbersFromRecord(record).map((creditNumber) => ({
        studentId: record.studentId,
        date: record.date,
        recordId: record.id,
        source: record.source,
        creditNumber,
      })),
    )
    .sort((firstCredit, secondCredit) =>
      firstCredit.date.localeCompare(secondCredit.date) ||
        firstCredit.creditNumber - secondCredit.creditNumber ||
        firstCredit.recordId.localeCompare(secondCredit.recordId),
    )
}

export function getLastAttendanceCreditNumber(records = [], studentId = '') {
  const credits = getStudentAttendanceCredits(records, studentId)

  return credits.length ? Math.max(...credits.map((credit) => credit.creditNumber)) : 0
}

export function getNextAttendanceCreditNumber(records = [], studentId = '') {
  return getLastAttendanceCreditNumber(records, studentId) + 1
}

export function validateStudentAttendanceCreditSequence(records = [], studentId = '') {
  const credits = getStudentAttendanceCredits(records, studentId)
  let expectedCreditNumber = 1

  for (const credit of credits) {
    if (credit.creditNumber !== expectedCreditNumber) {
      return {
        valid: false,
        expectedCreditNumber,
        actualCreditNumber: credit.creditNumber,
        credit,
        error:
          `Số buổi không hợp lệ. Học viên này đang cần buổi tiếp theo là ${expectedCreditNumber}, nhưng bạn nhập ${credit.creditNumber}.`,
      }
    }

    expectedCreditNumber += 1
  }

  return {
    valid: true,
    expectedCreditNumber,
    actualCreditNumber: null,
    credit: null,
    error: '',
  }
}

export function getBaselineEditableDateRange(referenceDate = new Date()) {
  const today = toLocalDateOnly(referenceDate)
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)

  return {
    startDate: formatLocalDateKey(start),
    endDate: formatLocalDateKey(today),
  }
}

export function isDateInBaselineEditableRange(dateKey, referenceDate = new Date()) {
  const normalizedDate = normalizeRequiredText(dateKey)
  const { startDate, endDate } = getBaselineEditableDateRange(referenceDate)

  return normalizedDate >= startDate && normalizedDate <= endDate
}

export function createInitialBaselineEditSnapshot(records = [], state = {}) {
  return {
    records: normalizeStoredAttendanceRecords(records),
    state: normalizeAttendanceBaselineState(state),
  }
}

export function restoreInitialBaselineEditSnapshot(snapshot = {}) {
  return {
    records: normalizeStoredAttendanceRecords(snapshot.records),
    state: normalizeAttendanceBaselineState({
      ...snapshot.state,
      auditLog: [
        ...(Array.isArray(snapshot.state?.auditLog) ? snapshot.state.auditLog : []),
        createAttendanceBaselineAuditEntry('undoBaselineEdit', {
          note: 'Hoàn tác nhập dữ liệu nền gần nhất.',
        }),
      ],
    }),
  }
}

export function getAttendanceBaselineStateStorageKey(centerId = DEFAULT_ATTENDANCE_CENTER_ID) {
  return `${ATTENDANCE_BASELINE_STATE_STORAGE_KEY_PREFIX}.${normalizeStorageCenterId(centerId)}`
}

export function loadAttendanceBaselineState(centerId = DEFAULT_ATTENDANCE_CENTER_ID, storage = getLocalStorage()) {
  const rawValue = safeStorageGetItem(storage, getAttendanceBaselineStateStorageKey(centerId))
  return normalizeAttendanceBaselineState(parseJsonObject(rawValue))
}

export function saveAttendanceBaselineState(
  centerId = DEFAULT_ATTENDANCE_CENTER_ID,
  state = {},
  storage = getLocalStorage(),
) {
  const normalizedState = normalizeAttendanceBaselineState(state)
  safeStorageSetItem(storage, getAttendanceBaselineStateStorageKey(centerId), JSON.stringify(normalizedState))

  return normalizedState
}

export function normalizeAttendanceBaselineState(state = {}) {
  const sourceState = state && typeof state === 'object' ? state : {}
  const status = BASELINE_STATE_STATUSES.has(sourceState.status) ? sourceState.status : 'notStarted'

  return {
    status,
    lockedAt: normalizeNullableText(sourceState.lockedAt),
    lockedBy: normalizeNullableText(sourceState.lockedBy),
    unlockedAt: normalizeNullableText(sourceState.unlockedAt),
    unlockedBy: normalizeNullableText(sourceState.unlockedBy),
    lastActionAt: normalizeNullableText(sourceState.lastActionAt),
    lastActionBy: normalizeNullableText(sourceState.lastActionBy),
    unlockReason: String(sourceState.unlockReason || ''),
    note: String(sourceState.note || ''),
    auditLog: (Array.isArray(sourceState.auditLog) ? sourceState.auditLog : [])
      .map((entry) => normalizeAttendanceBaselineAuditEntry(entry))
      .filter(Boolean),
  }
}

export function createAttendanceBaselineAuditEntry(action, payload = {}) {
  const normalizedAction = BASELINE_AUDIT_ACTIONS.has(action) ? action : 'updateBaselineRecord'
  const at = normalizeNullableText(payload?.at) || new Date().toISOString()

  return normalizeAttendanceBaselineAuditEntry({
    id: payload?.id || createBaselineAuditEntryId(normalizedAction, at, payload),
    action: normalizedAction,
    at,
    byRole: payload?.byRole,
    byName: payload?.byName,
    studentId: payload?.studentId,
    recordId: payload?.recordId,
    reason: payload?.reason,
    note: payload?.note,
  })
}

export function startAttendanceBaselineDraft(
  state = {},
  { byRole = null, byName = null, at = new Date().toISOString(), note = '' } = {},
) {
  const normalizedState = normalizeAttendanceBaselineState(state)

  if (normalizedState.status === 'locked') {
    return normalizedState
  }

  return normalizeAttendanceBaselineState({
    ...normalizedState,
    status: 'draft',
    lastActionAt: at,
    lastActionBy: byName,
    note: note || normalizedState.note,
    auditLog: [
      ...normalizedState.auditLog,
      createAttendanceBaselineAuditEntry('startBaseline', {
        at,
        byRole,
        byName,
        note,
      }),
    ],
  })
}

export function lockAttendanceBaselineState(
  state = {},
  { byRole = null, byName = null, at = new Date().toISOString(), note = '' } = {},
) {
  const normalizedState = normalizeAttendanceBaselineState(state)

  return normalizeAttendanceBaselineState({
    ...normalizedState,
    status: 'locked',
    lockedAt: at,
    lockedBy: byName,
    lastActionAt: at,
    lastActionBy: byName,
    note: note || normalizedState.note,
    auditLog: [
      ...normalizedState.auditLog,
      createAttendanceBaselineAuditEntry('lockBaseline', {
        at,
        byRole,
        byName,
        note,
      }),
    ],
  })
}

export function unlockAttendanceBaselineState(
  state = {},
  { byRole = null, byName = null, at = new Date().toISOString(), reason = '', note = '' } = {},
) {
  const normalizedState = normalizeAttendanceBaselineState(state)
  const unlockReason = String(reason || '').trim()

  return normalizeAttendanceBaselineState({
    ...normalizedState,
    status: 'unlocked',
    unlockedAt: at,
    unlockedBy: byName,
    lastActionAt: at,
    lastActionBy: byName,
    unlockReason,
    note: note || normalizedState.note,
    auditLog: [
      ...normalizedState.auditLog,
      createAttendanceBaselineAuditEntry('unlockBaseline', {
        at,
        byRole,
        byName,
        reason: unlockReason,
        note,
      }),
    ],
  })
}

export function buildUnifiedAttendanceRecords({ sessionReports = [], storedRecords = [] } = {}) {
  const adapterRecords = buildAttendanceRecordsFromSessionReports(sessionReports)
  const normalizedStoredRecords = normalizeStoredAttendanceRecords(storedRecords)
  const recordMap = new Map()

  adapterRecords.forEach((record) => {
    recordMap.set(getUnifiedAttendanceRecordKey(record), record)
  })

  normalizedStoredRecords.forEach((record) => {
    const duplicateAdapterKey = getTeacherAdapterDedupeKey(record)
    if (record.source === 'teacher' && duplicateAdapterKey) {
      recordMap.delete(duplicateAdapterKey)
    }
    recordMap.set(getUnifiedAttendanceRecordKey(record), record)
  })

  return Array.from(recordMap.values())
}

function isDemoSessionReport(report) {
  return Boolean(
    report?.isDemoAttendance ||
      report?.sourceModule === DEMO_ATTENDANCE_SOURCE_MODULE ||
      report?.demoBatchId === DEMO_ATTENDANCE_BATCH_ID,
  )
}

function normalizeAttendanceCredits(credits) {
  return (Array.isArray(credits) ? credits : [])
    .flatMap((credit) => {
      if (credit && typeof credit === 'object') {
        const displayedCreditNumbers = parseCreditNumbersFromText(credit.displayValue ?? credit.creditLabel)
        if (displayedCreditNumbers.length && credit.sessionNumber === undefined && credit.value === undefined) {
          return displayedCreditNumbers.map((creditNumber) => ({
            creditNumber,
            creditLabel: String(creditNumber),
            creditValue: 1,
          }))
        }

        const creditNumber = normalizeCreditNumber(
          credit.sessionNumber ?? credit.value ?? credit.displayValue,
        )
        const creditLabel = String(credit.displayValue ?? credit.sessionNumber ?? credit.value ?? '')

        return [{
          creditNumber,
          creditLabel,
          creditValue: creditNumber === null ? 0 : 1,
        }]
      }

      const displayedCreditNumbers = parseCreditNumbersFromText(credit)
      if (displayedCreditNumbers.length) {
        return displayedCreditNumbers.map((creditNumber) => ({
          creditNumber,
          creditLabel: String(creditNumber),
          creditValue: 1,
        }))
      }

      const creditNumber = normalizeCreditNumber(credit)

      return [{
        creditNumber,
        creditLabel: creditNumber === null ? String(credit ?? '') : String(creditNumber),
        creditValue: creditNumber === null ? 0 : 1,
      }]
    })
    .filter((credit) => credit.creditNumber !== null || credit.creditLabel)
}

function normalizeCreditNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function normalizeCreditValue(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : 1
}

function normalizeNullableInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numberValue = Number(value)
  return Number.isInteger(numberValue) ? numberValue : null
}

function normalizeRequiredText(value) {
  return String(value ?? '').trim()
}

function normalizeNullableText(value) {
  const text = String(value ?? '').trim()
  return text || null
}

function cloneRawAttendanceSource(report, attendanceItem) {
  return {
    report: cloneJsonSafe(report),
    attendanceItem: cloneJsonSafe(attendanceItem),
  }
}

function cloneJsonSafe(value) {
  if (!value || typeof value !== 'object') {
    return value ?? null
  }

  return JSON.parse(JSON.stringify(value))
}

function normalizeStorageCenterId(centerId) {
  return slugifyIdPart(centerId || DEFAULT_ATTENDANCE_CENTER_ID)
}

function getLocalStorage() {
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

function safeStorageGetItem(storage, key) {
  try {
    return storage?.getItem?.(key) ?? null
  } catch {
    return null
  }
}

function safeStorageSetItem(storage, key, value) {
  try {
    storage?.setItem?.(key, value)
  } catch {
    // Storage can be unavailable in tests or restricted browser modes.
  }
}

function parseJsonArray(rawValue) {
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function parseJsonObject(rawValue) {
  if (!rawValue) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function normalizeAttendanceBaselineAuditEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const action = BASELINE_AUDIT_ACTIONS.has(entry.action) ? entry.action : 'updateBaselineRecord'
  const at = normalizeNullableText(entry.at) || new Date().toISOString()

  return {
    id: normalizeRequiredText(entry.id) || createBaselineAuditEntryId(action, at, entry),
    action,
    at,
    byRole: normalizeNullableText(entry.byRole),
    byName: normalizeNullableText(entry.byName),
    studentId: normalizeNullableText(entry.studentId),
    recordId: normalizeNullableText(entry.recordId),
    reason: String(entry.reason || ''),
    note: String(entry.note || ''),
  }
}

function createBaselineAuditEntryId(action, at, payload = {}) {
  return [
    'attendance-baseline-audit',
    action,
    at,
    payload?.recordId || payload?.studentId || 'entry',
  ].map(slugifyIdPart).join('-')
}

function createStoredAttendanceRecordId(record) {
  return [
    'attendance-record',
    record.source || 'stored',
    record.studentId || 'student',
    record.date || 'date',
    record.creditNumber ?? record.creditLabel ?? 'record',
  ].map(slugifyIdPart).join('-')
}

function createInitialBaselineRecordId(input = {}) {
  return [
    'initial-baseline',
    input?.studentId || 'student',
    input?.date || input?.occurrenceDate || 'date',
  ].map(slugifyIdPart).join('-')
}

function createAdminAttendanceRecordId(input = {}) {
  return [
    'admin-attendance',
    input?.studentId || 'student',
    input?.date || input?.occurrenceDate || 'date',
    getAdminAttendanceSessionKey(input),
  ].map(slugifyIdPart).join('-')
}

function isSameAdminAttendanceRecord(record, input = {}) {
  return record?.source === 'admin' &&
    record.studentId === normalizeRequiredText(input?.studentId) &&
    record.date === normalizeRequiredText(input?.date || input?.occurrenceDate) &&
    getAdminAttendanceSessionKey(record) === getAdminAttendanceSessionKey(input)
}

function getAdminAttendanceRecordMatchKey(record = {}) {
  return [
    normalizeRequiredText(record.studentId),
    normalizeRequiredText(record.date || record.occurrenceDate),
    getAdminAttendanceSessionKey(record),
    'admin',
  ].join(':')
}

function getAdminAttendanceSessionKey(record = {}) {
  return normalizeRequiredText(
    record.sessionId ||
      record.scheduleSessionId ||
      record.classSessionId ||
      'session',
  )
}

function createTeacherAttendanceRecordId(input = {}) {
  return [
    'teacher-attendance',
    input?.studentId || 'student',
    input?.date || input?.occurrenceDate || 'date',
    getTeacherAttendanceSessionKey(input),
  ].map(slugifyIdPart).join('-')
}

function isSameTeacherAttendanceRecord(record, input = {}) {
  return record?.source === 'teacher' &&
    record.studentId === normalizeRequiredText(input?.studentId) &&
    record.date === normalizeRequiredText(input?.date || input?.occurrenceDate) &&
    getTeacherAttendanceSessionKey(record) === getTeacherAttendanceSessionKey(input)
}

function getTeacherAttendanceRecordMatchKey(record = {}) {
  return [
    normalizeRequiredText(record.studentId),
    normalizeRequiredText(record.date || record.occurrenceDate),
    getTeacherAttendanceSessionKey(record),
    'teacher',
  ].join(':')
}

function getTeacherAttendanceSessionKey(record = {}) {
  return normalizeRequiredText(
    record.sessionId ||
      record.scheduleSessionId ||
      record.classSessionId ||
      'session',
  )
}

function normalizeTeacherStoredAttendanceStatus(status) {
  const rawStatus = normalizeRequiredText(status)
  if (rawStatus === 'excusedAbsent') {
    return 'excused'
  }
  if (rawStatus === 'unexcusedAbsent') {
    return 'absent'
  }
  return rawStatus || 'present'
}

function getAttendanceCreditNumbersFromRecord(record) {
  const sourceCredits = Array.isArray(record?.raw?.attendanceItem?.credits)
    ? record.raw.attendanceItem.credits
    : []
  const creditNumbers = sourceCredits
    .map((credit) => normalizeCreditNumber(credit?.sessionNumber ?? credit?.value ?? credit?.displayValue))
    .filter((creditNumber) => Number.isFinite(creditNumber) && creditNumber > 0)

  if (creditNumbers.length) {
    return creditNumbers
  }

  const displayedCreditNumbers =
    parseCreditNumbersFromText(record?.creditLabel).length
      ? parseCreditNumbersFromText(record?.creditLabel)
      : parseCreditNumbersFromText(record?.raw?.attendanceItem?.displayValue).length
        ? parseCreditNumbersFromText(record?.raw?.attendanceItem?.displayValue)
        : parseCreditNumbersFromText(record?.raw?.attendanceItem?.creditLabel)

  if (displayedCreditNumbers.length) {
    return displayedCreditNumbers
  }

  const creditNumber = normalizeCreditNumber(record?.creditNumber ?? record?.creditLabel)

  if (Number.isFinite(creditNumber) && creditNumber > 0) {
    return [creditNumber]
  }

  const creditValue = Number(record?.creditValue)

  return Number.isFinite(creditValue) && creditValue > 0 ? [creditValue] : []
}

function getAttendanceItemDisplayedCreditNumbers(attendanceItem) {
  const explicitCreditNumber = normalizeCreditNumber(
    attendanceItem?.creditNumber ?? attendanceItem?.sessionNumber,
  )

  if (Number.isFinite(explicitCreditNumber) && explicitCreditNumber > 0) {
    return [explicitCreditNumber]
  }

  return [
    ...parseCreditNumbersFromText(attendanceItem?.displayValue),
    ...parseCreditNumbersFromText(attendanceItem?.creditLabel),
  ]
}

function parseCreditNumbersFromText(value) {
  const text = normalizeRequiredText(value)

  if (!/^\d+(\+\d+)*$/.test(text)) {
    return []
  }

  return text
    .split('+')
    .map((part) => Number(part))
    .filter((creditNumber) => Number.isFinite(creditNumber) && creditNumber > 0)
}

function areCreditNumbersContinuous(creditNumbers = []) {
  return creditNumbers.every((creditNumber, index) =>
    index === 0 || creditNumber === creditNumbers[index - 1] + 1,
  )
}

function createStatusBaselineCellParseResult(normalizedText, attendanceStatus, counted, creditValue, note) {
  return {
    valid: true,
    action: 'upsert',
    normalizedText,
    input: {
      status: attendanceStatus,
      attendanceStatus,
      counted,
      creditValue,
      creditNumber: counted ? creditValue : null,
      creditLabel: normalizedText,
      note,
      raw: {
        attendanceItem: {
          displayValue: normalizedText,
          credits: counted
            ? [{ displayValue: normalizedText, sessionNumber: creditValue, value: creditValue }]
            : [],
        },
      },
    },
    error: '',
  }
}

function createInvalidBaselineCellParseResult() {
  return {
    valid: false,
    action: 'invalid',
    normalizedText: '',
    input: null,
    error: 'Giá trị không hợp lệ. Vui lòng nhập số 1-99, dạng 3+4, T, V, P, CP, B hoặc để trống.',
  }
}

function toLocalDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return toLocalDateOnly(new Date())
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getUnifiedAttendanceRecordKey(record) {
  const sourceReportId = normalizeNullableText(record?.sourceReportId)
  const sourceAttendanceIndex = normalizeNullableInteger(record?.sourceAttendanceIndex)

  if (sourceReportId && sourceAttendanceIndex !== null) {
    const sourceCreditIndex = normalizeNullableInteger(record?.sourceCreditIndex) ?? 0
    return ['source', sourceReportId, sourceAttendanceIndex, sourceCreditIndex].join(':')
  }

  return ['stored', normalizeRequiredText(record?.id)].join(':')
}

function getTeacherAdapterDedupeKey(record = {}) {
  const sourceReportId = normalizeNullableText(record?.sourceReportId)
  const sourceAttendanceIndex = normalizeNullableInteger(record?.sourceAttendanceIndex)

  if (sourceReportId && sourceAttendanceIndex !== null) {
    const sourceCreditIndex = normalizeNullableInteger(record?.sourceCreditIndex) ?? 0
    return ['source', sourceReportId, sourceAttendanceIndex, sourceCreditIndex].join(':')
  }

  return ''
}

function slugifyIdPart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'empty'
}
