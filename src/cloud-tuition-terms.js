import { sanitizeCloudPayload } from './cloud-db-entities.js'

export const TUITION_TERM_CLOUD_ENTITY_TYPE = 'tuition_term'
export const TUITION_PAYMENT_CLOUD_ENTITY_TYPE = 'tuition_payment'
export const TUITION_TERM_PAYMENT_CLOUD_SOURCE_VERSION = 'f19h-tuition-term-payment-alpha-v1'
export const TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH = 'NEEDS SQL/ALLOWLIST PATCH'
export const TUITION_RECORD_STORAGE_KEY = 'ichessCenterOS.tuition.dreamhome'

const DEFAULT_CENTER_ID = 'dreamhome'
const ALLOWED_TUITION_TERM_PAYMENT_ENTITY_TYPES = new Set([
  TUITION_TERM_CLOUD_ENTITY_TYPE,
  TUITION_PAYMENT_CLOUD_ENTITY_TYPE,
])
const VALID_TERM_STATUSES = new Set(['current', 'active', 'completed', 'archived'])
const VALID_DISCOUNT_TYPES = new Set(['none', 'amount', 'percent', 'fixed'])

export function isAllowedTuitionTermPaymentCloudEntityType(entityType) {
  return ALLOWED_TUITION_TERM_PAYMENT_ENTITY_TYPES.has(String(entityType || ''))
}

export function createTuitionTermPaymentCloudDryRun({
  centerId = DEFAULT_CENTER_ID,
  tuitionRecords = null,
  storage = getLocalStorage(),
  remoteAllowlistReady = false,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const recordInputs = Array.isArray(tuitionRecords)
    ? tuitionRecords
    : parseJsonArray(storage?.getItem?.(getTuitionRecordStorageKey(normalizedCenterId)))
  const termCandidates = deriveTuitionTermCandidates(recordInputs)
  const paymentCandidates = deriveTuitionPaymentCandidates(recordInputs)
  const termSummary = createTermPaymentDryRunSummary({
    centerId: normalizedCenterId,
    entityType: TUITION_TERM_CLOUD_ENTITY_TYPE,
    total: termCandidates.length,
    tuitionRecordsInspected: recordInputs.length,
    termsDerived: termCandidates.length,
    paymentsDerived: paymentCandidates.length,
    remoteAllowlistReady,
  })
  const paymentSummary = createTermPaymentDryRunSummary({
    centerId: normalizedCenterId,
    entityType: TUITION_PAYMENT_CLOUD_ENTITY_TYPE,
    total: paymentCandidates.length,
    tuitionRecordsInspected: recordInputs.length,
    termsDerived: termCandidates.length,
    paymentsDerived: paymentCandidates.length,
    remoteAllowlistReady,
  })

  recordInputs.forEach((record) => {
    if (!normalizeText(record?.currentTermId)) {
      termSummary.counts.missingCurrentTermId += 1
    }
    if (!Array.isArray(record?.termHistory) || !record.termHistory.length) {
      termSummary.counts.missingTermHistory += 1
    }
  })

  termCandidates.forEach((term, index) => {
    const result = buildTuitionTermCloudEntity({
      centerId: normalizedCenterId,
      term,
    })
    applyTermPaymentDryRunResult(termSummary, result, index, term)
  })

  paymentCandidates.forEach((payment, index) => {
    collectPaymentMetadataCounts(paymentSummary, payment)
    const result = buildTuitionPaymentCloudEntity({
      centerId: normalizedCenterId,
      payment,
    })
    applyTermPaymentDryRunResult(paymentSummary, result, index, payment)

    if (result.ok) {
      paymentSummary.totalEstimatedPaymentAmount += result.payment.amount
    }
  })

  finalizeTermPaymentDryRunSummary(termSummary)
  finalizeTermPaymentDryRunSummary(paymentSummary)

  return {
    centerId: normalizedCenterId,
    sourceVersion: TUITION_TERM_PAYMENT_CLOUD_SOURCE_VERSION,
    localSourceKey: getTuitionRecordStorageKey(normalizedCenterId),
    tuitionRecordsInspected: recordInputs.length,
    termsDerived: termCandidates.length,
    paymentsDerived: paymentCandidates.length,
    entities: {
      [TUITION_TERM_CLOUD_ENTITY_TYPE]: termSummary,
      [TUITION_PAYMENT_CLOUD_ENTITY_TYPE]: paymentSummary,
    },
    total: termSummary.total + paymentSummary.total,
    valid: termSummary.valid + paymentSummary.valid,
    invalid: termSummary.invalid + paymentSummary.invalid,
    skipped: termSummary.skipped + paymentSummary.skipped,
    totalEstimatedPaymentAmount: paymentSummary.totalEstimatedPaymentAmount,
    readyForRealPush: termSummary.readyForRealPush && paymentSummary.readyForRealPush,
    realPushStatus: remoteAllowlistReady
      ? (termSummary.readyForRealPush && paymentSummary.readyForRealPush ? 'ready' : 'blocked')
      : TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH,
    linkageDesignOnly: true,
    runtimeAttendanceLinkageEnabled: false,
    usedSessionsAutoUpdateEnabled: false,
  }
}

export function buildTuitionTermCloudEntity({
  centerId = DEFAULT_CENTER_ID,
  term = {},
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const validation = validateTuitionTermCloudPayload(term)

  if (!validation.ok) {
    return validation
  }

  const localId = createTuitionTermCloudLocalId(validation.term)

  return {
    ok: true,
    term: validation.term,
    localId,
    data: {
      center_id: normalizedCenterId,
      entity_type: TUITION_TERM_CLOUD_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload({
        ...validation.term,
        centerId: normalizedCenterId,
        payloadVersion: validation.term.payloadVersion || TUITION_TERM_PAYMENT_CLOUD_SOURCE_VERSION,
        attendanceLinked: false,
        attendanceLinkagePhase: 'design-only-f19h2f',
        usedSessionsIsPreserved: true,
      }),
      source_module: 'tuitionTerms',
      source_version: TUITION_TERM_PAYMENT_CLOUD_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
    },
  }
}

export function buildTuitionPaymentCloudEntity({
  centerId = DEFAULT_CENTER_ID,
  payment = {},
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const validation = validateTuitionPaymentCloudPayload(payment)

  if (!validation.ok) {
    return validation
  }

  const localId = createTuitionPaymentCloudLocalId(validation.payment)

  return {
    ok: true,
    payment: validation.payment,
    localId,
    data: {
      center_id: normalizedCenterId,
      entity_type: TUITION_PAYMENT_CLOUD_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload({
        ...validation.payment,
        centerId: normalizedCenterId,
        payloadVersion: validation.payment.payloadVersion || TUITION_TERM_PAYMENT_CLOUD_SOURCE_VERSION,
        affectsAttendance: false,
        updatesUsedSessions: false,
      }),
      source_module: 'tuitionPayments',
      source_version: TUITION_TERM_PAYMENT_CLOUD_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
    },
  }
}

export function validateTuitionTermCloudPayload(term = {}) {
  if (!term || typeof term !== 'object' || Array.isArray(term)) {
    return { ok: false, error: 'Tuition term khong phai object hop le.' }
  }

  const tuitionRecordId = normalizeText(term.tuitionRecordId)
  const studentId = normalizeText(term.studentId)
  const termNumber = Math.max(1, normalizeInteger(term.termNumber) || 1)
  const termId = normalizeText(term.termId || term.id) ||
    createDeterministicTuitionTermId({ tuitionRecordId, termNumber })

  if (!termId) {
    return { ok: false, error: 'Thieu termId hoac deterministic id.' }
  }
  if (!tuitionRecordId) {
    return { ok: false, id: termId, error: 'Thieu tuitionRecordId.' }
  }
  if (!studentId) {
    return { ok: false, id: termId, error: 'Thieu studentId.' }
  }

  return {
    ok: true,
    term: {
      termId,
      id: termId,
      tuitionRecordId,
      studentId,
      termNumber,
      packageName: String(term.packageName || ''),
      totalSessions: normalizeNonNegativeNumber(term.totalSessions),
      usedSessions: normalizeNonNegativeNumber(term.usedSessions),
      totalAmount: normalizeNonNegativeNumber(term.totalAmount),
      discountType: normalizeDiscountType(term.discountType, term.discountAmount),
      discountValue: normalizeNonNegativeNumber(term.discountValue ?? term.discountAmount),
      discountAmount: normalizeNonNegativeNumber(term.discountAmount),
      paidAmount: normalizeNonNegativeNumber(term.paidAmount),
      dueDate: String(term.dueDate || ''),
      note: String(term.note || ''),
      status: VALID_TERM_STATUSES.has(term.status) ? term.status : 'current',
      startedAt: normalizeNullableText(term.startedAt || term.startDate),
      endedAt: normalizeNullableText(term.endedAt || term.endDate),
      sourceKind: normalizeText(term.sourceKind || 'currentTerm'),
      sourceModule: String(term.sourceModule || ''),
      sourceTag: String(term.sourceTag || ''),
      createdAt: normalizeNullableText(term.createdAt),
      updatedAt: normalizeNullableText(term.updatedAt || term.createdAt),
    },
  }
}

export function validateTuitionPaymentCloudPayload(payment = {}) {
  if (!payment || typeof payment !== 'object' || Array.isArray(payment)) {
    return { ok: false, error: 'Tuition payment khong phai object hop le.' }
  }

  const tuitionRecordId = normalizeText(payment.tuitionRecordId)
  const studentId = normalizeText(payment.studentId)
  const amount = normalizeNonNegativeNumber(payment.amount)
  const paidAt = normalizeNullableText(payment.paidAt || payment.date)
  const paymentId = normalizeText(payment.paymentId || payment.id) ||
    createDeterministicTuitionPaymentId({
      tuitionRecordId,
      index: payment.paymentIndex,
      amount,
      paidAt,
    })

  if (!paymentId) {
    return { ok: false, error: 'Thieu paymentId hoac deterministic id.' }
  }
  if (!tuitionRecordId) {
    return { ok: false, id: paymentId, error: 'Thieu tuitionRecordId.' }
  }
  if (amount <= 0) {
    return { ok: false, id: paymentId, error: 'Thieu amount hop le.' }
  }

  return {
    ok: true,
    payment: {
      paymentId,
      id: paymentId,
      tuitionRecordId,
      tuitionTermId: normalizeText(payment.tuitionTermId || payment.termId),
      studentId,
      amount,
      paidAt,
      method: String(payment.method || ''),
      note: String(payment.note || ''),
      paymentIndex: normalizeInteger(payment.paymentIndex),
      sourceKind: normalizeText(payment.sourceKind || 'currentPayment'),
      sourceModule: String(payment.sourceModule || ''),
      sourceTag: String(payment.sourceTag || ''),
      createdAt: normalizeNullableText(payment.createdAt),
      updatedAt: normalizeNullableText(payment.updatedAt || payment.createdAt),
    },
  }
}

export function createTuitionTermCloudLocalId(term = {}) {
  const validation = validateTuitionTermCloudPayload(term)

  if (!validation.ok) {
    return ''
  }

  return [
    TUITION_TERM_CLOUD_ENTITY_TYPE,
    validation.term.termId,
  ].map(slugifyIdPart).join('::')
}

export function createTuitionPaymentCloudLocalId(payment = {}) {
  const validation = validateTuitionPaymentCloudPayload(payment)

  if (!validation.ok) {
    return ''
  }

  return [
    TUITION_PAYMENT_CLOUD_ENTITY_TYPE,
    validation.payment.paymentId,
  ].map(slugifyIdPart).join('::')
}

export function evaluateTuitionTermPaymentCloudReadiness({
  cloudReady = false,
  signedIn = false,
  membershipReady = false,
  centerId = DEFAULT_CENTER_ID,
  appAllowlistReady = true,
  remoteAllowlistReady = false,
  dryRunPreview = null,
  explicitUserAction = false,
} = {}) {
  const blockers = []

  if (!cloudReady) {
    blockers.push('Cloud DB chua ready.')
  }
  if (!signedIn) {
    blockers.push('Chua dang nhap Supabase.')
  }
  if (!membershipReady) {
    blockers.push('Chua co quyen center.')
  }
  if (!normalizeText(centerId)) {
    blockers.push('Thieu centerId.')
  }
  if (!appAllowlistReady) {
    blockers.push('App allowlist chua co tuition_term/tuition_payment.')
  }
  if (!remoteAllowlistReady) {
    blockers.push(TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH)
  }
  if (!explicitUserAction) {
    blockers.push('Thieu thao tac nguoi dung explicit.')
  }
  if (!dryRunPreview || dryRunPreview.valid <= 0) {
    blockers.push('Dry-run chua co tuition term/payment hop le.')
  }
  if (dryRunPreview?.invalid > 0) {
    blockers.push('Dry-run con tuition term/payment invalid/skipped.')
  }

  return {
    ok: blockers.length === 0,
    status: blockers.includes(TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH)
      ? TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH
      : blockers.length
        ? 'blocked'
        : 'ready',
    blockers,
  }
}

export function deriveTuitionTermCandidates(tuitionRecords = []) {
  return (Array.isArray(tuitionRecords) ? tuitionRecords : [])
    .filter((record) => record && typeof record === 'object')
    .flatMap((record) => {
      const currentTerm = createCurrentTermCandidate(record)
      const historyTerms = Array.isArray(record.termHistory)
        ? record.termHistory.map((term, index) => ({
            ...term,
            termId: normalizeText(term.id || term.termId) ||
              createDeterministicTuitionTermId({
                tuitionRecordId: record.id,
                termNumber: term.termNumber || index + 1,
              }),
            tuitionRecordId: normalizeText(record.id),
            studentId: normalizeText(record.studentId),
            sourceKind: 'termHistory',
            status: term.status || 'archived',
          }))
        : []

      return [currentTerm, ...historyTerms].filter(Boolean)
    })
}

export function deriveTuitionPaymentCandidates(tuitionRecords = []) {
  return (Array.isArray(tuitionRecords) ? tuitionRecords : [])
    .filter((record) => record && typeof record === 'object')
    .flatMap((record) => {
      const currentPayments = Array.isArray(record.payments)
        ? record.payments.map((payment, index) => createPaymentCandidate({
            record,
            payment,
            index,
            termId: normalizeText(record.currentTermId),
            sourceKind: 'currentPayment',
          }))
        : []
      const historyPayments = Array.isArray(record.termHistory)
        ? record.termHistory.flatMap((term, termIndex) => {
            const termId = normalizeText(term.id || term.termId) ||
              createDeterministicTuitionTermId({
                tuitionRecordId: record.id,
                termNumber: term.termNumber || termIndex + 1,
              })

            return (Array.isArray(term.payments) ? term.payments : []).map((payment, paymentIndex) =>
              createPaymentCandidate({
                record,
                payment,
                index: paymentIndex,
                termId,
                sourceKind: 'termHistoryPayment',
              }),
            )
          })
        : []

      return [...currentPayments, ...historyPayments]
    })
}

function createCurrentTermCandidate(record = {}) {
  if (!record || typeof record !== 'object') {
    return null
  }

  const tuitionRecordId = normalizeText(record.id)
  const termNumber = Math.max(1, normalizeInteger(record.currentTermNumber) || 1)

  return {
    termId: normalizeText(record.currentTermId) ||
      createDeterministicTuitionTermId({ tuitionRecordId, termNumber }),
    tuitionRecordId,
    studentId: normalizeText(record.studentId),
    termNumber,
    packageName: String(record.packageName || ''),
    totalSessions: record.totalSessions,
    usedSessions: record.usedSessions,
    totalAmount: record.totalAmount,
    discountType: record.discountType,
    discountValue: record.discountValue,
    discountAmount: record.discountAmount,
    paidAmount: record.paidAmount,
    dueDate: record.dueDate,
    note: record.note,
    status: 'current',
    startedAt: record.startedAt,
    sourceKind: 'currentTerm',
    sourceModule: record.sourceModule,
    sourceTag: record.sourceTag,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function createPaymentCandidate({
  record = {},
  payment = {},
  index = 0,
  termId = '',
  sourceKind = 'currentPayment',
} = {}) {
  return {
    ...payment,
    originalPaymentId: normalizeText(payment.id || payment.paymentId),
    paymentId: normalizeText(payment.id || payment.paymentId) ||
      createDeterministicTuitionPaymentId({
        tuitionRecordId: record.id,
        index,
        amount: payment.amount,
        paidAt: payment.paidAt || payment.date,
      }),
    tuitionRecordId: normalizeText(record.id),
    tuitionTermId: normalizeText(termId),
    studentId: normalizeText(record.studentId),
    amount: payment.amount,
    paidAt: payment.paidAt || payment.date,
    paymentIndex: index,
    sourceKind,
    sourceModule: payment.sourceModule || record.sourceModule,
    sourceTag: payment.sourceTag || record.sourceTag,
  }
}

function applyTermPaymentDryRunResult(summary, result, index, source) {
  if (result.ok) {
    summary.valid += 1
    summary.validEntities.push(result.data)
    return
  }

  summary.invalid += 1
  summary.skipped += 1

  if (summary.invalidSamples.length < 5) {
    summary.invalidSamples.push({
      index,
      id: normalizeText(source?.termId || source?.paymentId || source?.id),
      tuitionRecordId: normalizeText(source?.tuitionRecordId),
      reason: result.error,
    })
  }
}

function collectPaymentMetadataCounts(summary, payment = {}) {
  if (!normalizeText(payment?.originalPaymentId ?? payment?.paymentId ?? payment?.id)) {
    summary.counts.missingPaymentId += 1
  }
  if (!normalizeText(payment?.paidAt || payment?.date)) {
    summary.counts.missingPaymentDate += 1
  }
  if (normalizeNonNegativeNumber(payment?.amount) <= 0) {
    summary.counts.missingPaymentAmount += 1
  }
}

function finalizeTermPaymentDryRunSummary(summary) {
  summary.estimatedCloudEntityCount = summary.validEntities.length
  summary.appAllowlistReady = isAllowedTuitionTermPaymentCloudEntityType(summary.entityType)
  summary.readyForRealPush =
    summary.appAllowlistReady &&
    summary.remoteAllowlistReady &&
    summary.valid > 0 &&
    summary.invalid === 0
  summary.realPushStatus = summary.remoteAllowlistReady
    ? (summary.readyForRealPush ? 'ready' : 'blocked')
    : TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH
}

function createTermPaymentDryRunSummary({
  centerId,
  entityType,
  total,
  tuitionRecordsInspected,
  termsDerived,
  paymentsDerived,
  remoteAllowlistReady = false,
}) {
  return {
    entityType,
    centerId,
    localSourceKey: getTuitionRecordStorageKey(centerId),
    derivedSource: 'tuition_record payload',
    sourceVersion: TUITION_TERM_PAYMENT_CLOUD_SOURCE_VERSION,
    tuitionRecordsInspected,
    termsDerived,
    paymentsDerived,
    total,
    valid: 0,
    invalid: 0,
    skipped: 0,
    counts: {
      missingCurrentTermId: 0,
      missingTermHistory: 0,
      missingPaymentId: 0,
      missingPaymentDate: 0,
      missingPaymentAmount: 0,
    },
    totalEstimatedPaymentAmount: 0,
    invalidSamples: [],
    estimatedCloudEntityCount: 0,
    appAllowlistReady: false,
    remoteAllowlistReady: Boolean(remoteAllowlistReady),
    readyForRealPush: false,
    realPushStatus: TUITION_TERM_PAYMENT_CLOUD_STATUS_NEEDS_PATCH,
    validEntities: [],
  }
}

function createDeterministicTuitionTermId({ tuitionRecordId, termNumber } = {}) {
  const recordKey = normalizeText(tuitionRecordId)
  const termKey = Math.max(1, normalizeInteger(termNumber) || 1)

  return recordKey ? `term-${slugifyIdPart(recordKey)}-${termKey}` : ''
}

function createDeterministicTuitionPaymentId({
  tuitionRecordId,
  index = 0,
  amount = 0,
  paidAt = '',
} = {}) {
  const recordKey = normalizeText(tuitionRecordId)

  if (!recordKey) {
    return ''
  }

  return [
    'payment',
    recordKey,
    Number.isFinite(Number(index)) ? Number(index) + 1 : 1,
    normalizeNonNegativeNumber(amount),
    normalizeText(paidAt) || 'no-date',
  ].map(slugifyIdPart).join('-')
}

function normalizeDiscountType(discountType, discountAmount = 0) {
  if (VALID_DISCOUNT_TYPES.has(discountType)) {
    return discountType === 'fixed' ? 'amount' : discountType
  }

  return normalizeNonNegativeNumber(discountAmount) > 0 ? 'amount' : 'none'
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

function normalizeNonNegativeNumber(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(0, numberValue) : 0
}

function normalizeInteger(value) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : 0
}

function normalizeNullableText(value) {
  const text = normalizeText(value)
  return text || null
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function getTuitionRecordStorageKey(centerId = DEFAULT_CENTER_ID) {
  return `ichessCenterOS.tuition.${slugifyIdPart(centerId || DEFAULT_CENTER_ID)}`
}

function getLocalStorage() {
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
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
