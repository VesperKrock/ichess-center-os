import { sanitizeCloudPayload } from './cloud-db-entities.js'

export const TUITION_RECORD_CLOUD_ENTITY_TYPE = 'tuition_record'
export const TUITION_PACKAGE_CLOUD_ENTITY_TYPE = 'tuition_package'
export const TUITION_CLOUD_SOURCE_VERSION = 'f19h-tuition-alpha-v1'
export const TUITION_CLOUD_STATUS_NEEDS_PATCH = 'NEEDS SQL/ALLOWLIST PATCH'
export const TUITION_RECORD_STORAGE_KEY = 'ichessCenterOS.tuition.dreamhome'
export const TUITION_PACKAGE_STORAGE_KEY = 'ichessCenterOS.tuitionPackages.dreamhome'

const DEFAULT_CENTER_ID = 'dreamhome'
const ALLOWED_TUITION_CLOUD_ENTITY_TYPES = new Set([
  TUITION_RECORD_CLOUD_ENTITY_TYPE,
  TUITION_PACKAGE_CLOUD_ENTITY_TYPE,
])
const VALID_DISCOUNT_TYPES = new Set(['none', 'amount', 'percent', 'fixed'])

export function isAllowedTuitionCloudEntityType(entityType) {
  return ALLOWED_TUITION_CLOUD_ENTITY_TYPES.has(String(entityType || ''))
}

export function createTuitionCloudDryRun({
  centerId = DEFAULT_CENTER_ID,
  tuitionRecords = null,
  tuitionPackages = null,
  storage = getLocalStorage(),
  remoteAllowlistReady = false,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const recordInputs = Array.isArray(tuitionRecords)
    ? tuitionRecords
    : parseJsonArray(storage?.getItem?.(getTuitionRecordStorageKey(normalizedCenterId)))
  const packageInputs = Array.isArray(tuitionPackages)
    ? tuitionPackages
    : parseJsonArray(storage?.getItem?.(getTuitionPackageStorageKey(normalizedCenterId)))
  const recordSummary = createTuitionEntityDryRunSummary({
    centerId: normalizedCenterId,
    entityType: TUITION_RECORD_CLOUD_ENTITY_TYPE,
    localSourceKey: getTuitionRecordStorageKey(normalizedCenterId),
    total: recordInputs.length,
    remoteAllowlistReady,
  })
  const packageSummary = createTuitionEntityDryRunSummary({
    centerId: normalizedCenterId,
    entityType: TUITION_PACKAGE_CLOUD_ENTITY_TYPE,
    localSourceKey: getTuitionPackageStorageKey(normalizedCenterId),
    total: packageInputs.length,
    remoteAllowlistReady,
  })

  recordInputs.forEach((record, index) => {
    const result = buildTuitionRecordCloudEntity({
      centerId: normalizedCenterId,
      record,
    })
    applyTuitionDryRunResult(recordSummary, result, index, record)

    if (result.ok) {
      recordSummary.counts.tuitionRecords += 1
      recordSummary.totalEstimatedAmount += result.record.totalAmount
      if (!result.record.studentId) {
        recordSummary.counts.missingStudentId += 1
      }
      if (!result.record.packageName) {
        recordSummary.counts.missingPackageIdentity += 1
      }
    }
  })

  packageInputs.forEach((tuitionPackage, index) => {
    const result = buildTuitionPackageCloudEntity({
      centerId: normalizedCenterId,
      tuitionPackage,
    })
    applyTuitionDryRunResult(packageSummary, result, index, tuitionPackage)

    if (result.ok) {
      packageSummary.counts.tuitionPackages += 1
      packageSummary.totalEstimatedAmount += result.tuitionPackage.price
      if (!result.tuitionPackage.id || !result.tuitionPackage.name) {
        packageSummary.counts.missingPackageIdentity += 1
      }
    }
  })

  finalizeTuitionDryRunSummary(recordSummary)
  finalizeTuitionDryRunSummary(packageSummary)

  return {
    centerId: normalizedCenterId,
    sourceVersion: TUITION_CLOUD_SOURCE_VERSION,
    entities: {
      [TUITION_RECORD_CLOUD_ENTITY_TYPE]: recordSummary,
      [TUITION_PACKAGE_CLOUD_ENTITY_TYPE]: packageSummary,
    },
    total: recordSummary.total + packageSummary.total,
    valid: recordSummary.valid + packageSummary.valid,
    invalid: recordSummary.invalid + packageSummary.invalid,
    skipped: recordSummary.skipped + packageSummary.skipped,
    totalEstimatedAmount:
      recordSummary.totalEstimatedAmount + packageSummary.totalEstimatedAmount,
    readyForRealPush: recordSummary.readyForRealPush && packageSummary.readyForRealPush,
    realPushStatus: remoteAllowlistReady
      ? (recordSummary.readyForRealPush && packageSummary.readyForRealPush ? 'ready' : 'blocked')
      : TUITION_CLOUD_STATUS_NEEDS_PATCH,
  }
}

export function buildTuitionRecordCloudEntity({
  centerId = DEFAULT_CENTER_ID,
  record = {},
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const validation = validateTuitionRecordCloudPayload(record)

  if (!validation.ok) {
    return validation
  }

  const localId = createTuitionRecordCloudLocalId(validation.record)

  return {
    ok: true,
    record: validation.record,
    localId,
    data: {
      center_id: normalizedCenterId,
      entity_type: TUITION_RECORD_CLOUD_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload({
        ...validation.record,
        centerId: normalizedCenterId,
        payloadVersion: validation.record.payloadVersion || TUITION_CLOUD_SOURCE_VERSION,
        attendanceLinked: false,
        attendanceLinkagePhase: 'not-enabled-f19h2e',
        tuitionTermEntity: 'tuition_term',
        tuitionPaymentEntity: 'tuition_payment',
        tuitionTermPaymentSplitEnabled: false,
      }),
      source_module: 'tuition',
      source_version: TUITION_CLOUD_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
    },
  }
}

export function buildTuitionPackageCloudEntity({
  centerId = DEFAULT_CENTER_ID,
  tuitionPackage = {},
  userId = null,
} = {}) {
  const normalizedCenterId = normalizeText(centerId) || DEFAULT_CENTER_ID
  const validation = validateTuitionPackageCloudPayload(tuitionPackage)

  if (!validation.ok) {
    return validation
  }

  const localId = createTuitionPackageCloudLocalId(validation.tuitionPackage)

  return {
    ok: true,
    tuitionPackage: validation.tuitionPackage,
    localId,
    data: {
      center_id: normalizedCenterId,
      entity_type: TUITION_PACKAGE_CLOUD_ENTITY_TYPE,
      local_id: localId,
      payload: sanitizeCloudPayload({
        ...validation.tuitionPackage,
        centerId: normalizedCenterId,
        payloadVersion: validation.tuitionPackage.payloadVersion || TUITION_CLOUD_SOURCE_VERSION,
      }),
      source_module: 'tuitionPackages',
      source_version: TUITION_CLOUD_SOURCE_VERSION,
      created_by: userId || null,
      updated_by: userId || null,
      deleted_at: null,
    },
  }
}

export function validateTuitionRecordCloudPayload(record = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { ok: false, error: 'Tuition record khong phai object hop le.' }
  }

  const studentId = normalizeText(record.studentId)
  const currentTermId = normalizeText(record.currentTermId)
  const currentTermNumber = Math.max(1, normalizeInteger(record.currentTermNumber) || 1)
  const packageName = normalizeText(record.packageName)
  const id = normalizeText(record.id) ||
    createDeterministicTuitionRecordId({
      studentId,
      packageName,
      currentTermId,
      currentTermNumber,
    })

  if (!id) {
    return { ok: false, error: 'Thieu tuition id hoac deterministic id.' }
  }
  if (!studentId) {
    return { ok: false, id, error: 'Thieu studentId.' }
  }

  const totalSessions = normalizeNonNegativeNumber(record.totalSessions)
  const usedSessions = normalizeNonNegativeNumber(record.usedSessions)
  const totalAmount = normalizeNonNegativeNumber(record.totalAmount)
  const paidAmount = normalizeNonNegativeNumber(record.paidAmount)
  const discountType = normalizeDiscountType(record.discountType, record.discountAmount)
  const discountValue = normalizeNonNegativeNumber(record.discountValue ?? record.discountAmount)
  const discountAmount = normalizeNonNegativeNumber(record.discountAmount)
  const remainingAmount = normalizeNullableNumber(record.remainingAmount)

  return {
    ok: true,
    record: {
      id,
      studentId,
      packageName: packageName || 'Goi hoc',
      totalSessions,
      usedSessions,
      hasTotalSessionsData: record.hasTotalSessionsData !== false,
      hasUsedSessionsData: record.hasUsedSessionsData !== false,
      totalAmount,
      discountType,
      discountValue,
      discountAmount,
      paidAmount,
      remainingAmount,
      paymentStatus: normalizeText(record.paymentStatus),
      dueDate: normalizeText(record.dueDate),
      note: String(record.note || ''),
      currentTermNumber,
      currentTermId: currentTermId || `term-${slugifyIdPart(id)}-${currentTermNumber}`,
      startedAt: normalizeNullableText(record.startedAt),
      payments: normalizeTuitionPaymentPayloads(record.payments),
      termHistory: normalizeTuitionTermPayloads(record.termHistory),
      sourceModule: String(record.sourceModule || ''),
      sourceTag: String(record.sourceTag || ''),
      importBatchId: String(record.importBatchId || ''),
      datasetId: String(record.datasetId || ''),
      datasetVersion: String(record.datasetVersion || ''),
      isControlledFixture: Boolean(record.isControlledFixture),
      createdAt: normalizeNullableText(record.createdAt),
      updatedAt: normalizeNullableText(record.updatedAt || record.createdAt),
    },
  }
}

export function validateTuitionPackageCloudPayload(tuitionPackage = {}) {
  if (!tuitionPackage || typeof tuitionPackage !== 'object' || Array.isArray(tuitionPackage)) {
    return { ok: false, error: 'Tuition package khong phai object hop le.' }
  }

  const name = normalizeText(
    tuitionPackage.name ||
      tuitionPackage.packageName ||
      tuitionPackage.displayLabel ||
      tuitionPackage.label,
  )
  const id = normalizeText(tuitionPackage.id) || createDeterministicTuitionPackageId(name)

  if (!id) {
    return { ok: false, error: 'Thieu package id hoac package name.' }
  }
  if (!name) {
    return { ok: false, id, error: 'Thieu package name.' }
  }

  const totalSessions = normalizeNonNegativeNumber(
    tuitionPackage.totalSessions ?? tuitionPackage.sessionCount,
  )
  const price = normalizeNonNegativeNumber(
    tuitionPackage.price ?? tuitionPackage.amount ?? tuitionPackage.totalAmount,
  )

  return {
    ok: true,
    tuitionPackage: {
      id,
      name,
      displayLabel: String(tuitionPackage.displayLabel || name),
      totalSessions,
      sessionCount: totalSessions,
      price,
      description: String(tuitionPackage.description || tuitionPackage.note || ''),
      isActive: tuitionPackage.isActive !== false,
      sourceModule: String(tuitionPackage.sourceModule || ''),
      sourceTag: String(tuitionPackage.sourceTag || ''),
      importBatchId: String(tuitionPackage.importBatchId || ''),
      datasetId: String(tuitionPackage.datasetId || ''),
      datasetVersion: String(tuitionPackage.datasetVersion || ''),
      isControlledFixture: Boolean(tuitionPackage.isControlledFixture),
      createdAt: normalizeNullableText(tuitionPackage.createdAt),
      updatedAt: normalizeNullableText(tuitionPackage.updatedAt || tuitionPackage.createdAt),
    },
  }
}

export function createTuitionRecordCloudLocalId(record = {}) {
  const validation = validateTuitionRecordCloudPayload(record)

  if (!validation.ok) {
    return ''
  }

  return [
    TUITION_RECORD_CLOUD_ENTITY_TYPE,
    validation.record.id,
  ].map(slugifyIdPart).join('::')
}

export function createTuitionPackageCloudLocalId(tuitionPackage = {}) {
  const validation = validateTuitionPackageCloudPayload(tuitionPackage)

  if (!validation.ok) {
    return ''
  }

  return [
    TUITION_PACKAGE_CLOUD_ENTITY_TYPE,
    validation.tuitionPackage.id,
  ].map(slugifyIdPart).join('::')
}

export function evaluateTuitionCloudReadiness({
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
    blockers.push('App allowlist chua co tuition_record/tuition_package.')
  }
  if (!remoteAllowlistReady) {
    blockers.push(TUITION_CLOUD_STATUS_NEEDS_PATCH)
  }
  if (!explicitUserAction) {
    blockers.push('Thieu thao tac nguoi dung explicit.')
  }
  if (!dryRunPreview || dryRunPreview.valid <= 0) {
    blockers.push('Dry-run chua co tuition entity hop le.')
  }
  if (dryRunPreview?.invalid > 0) {
    blockers.push('Dry-run con tuition entity invalid/skipped.')
  }

  return {
    ok: blockers.length === 0,
    status: blockers.includes(TUITION_CLOUD_STATUS_NEEDS_PATCH)
      ? TUITION_CLOUD_STATUS_NEEDS_PATCH
      : blockers.length
        ? 'blocked'
        : 'ready',
    blockers,
  }
}

function applyTuitionDryRunResult(summary, result, index, source) {
  if (result.ok) {
    summary.valid += 1
    summary.validEntities.push(result.data)
    return
  }

  summary.invalid += 1
  summary.skipped += 1

  if (!normalizeText(source?.studentId)) {
    summary.counts.missingStudentId += summary.entityType === TUITION_RECORD_CLOUD_ENTITY_TYPE ? 1 : 0
  }
  if (!normalizeText(source?.id) && !normalizeText(source?.name || source?.packageName || source?.displayLabel)) {
    summary.counts.missingPackageIdentity += 1
  }

  if (summary.invalidSamples.length < 5) {
    summary.invalidSamples.push({
      index,
      id: normalizeText(source?.id),
      studentId: normalizeText(source?.studentId),
      reason: result.error,
    })
  }
}

function finalizeTuitionDryRunSummary(summary) {
  summary.estimatedCloudEntityCount = summary.validEntities.length
  summary.appAllowlistReady = isAllowedTuitionCloudEntityType(summary.entityType)
  summary.readyForRealPush =
    summary.appAllowlistReady &&
    summary.remoteAllowlistReady &&
    summary.valid > 0 &&
    summary.invalid === 0
  summary.realPushStatus = summary.remoteAllowlistReady
    ? (summary.readyForRealPush ? 'ready' : 'blocked')
    : TUITION_CLOUD_STATUS_NEEDS_PATCH
}

function createTuitionEntityDryRunSummary({
  centerId,
  entityType,
  localSourceKey,
  total,
  remoteAllowlistReady = false,
}) {
  return {
    entityType,
    centerId,
    localSourceKey,
    sourceVersion: TUITION_CLOUD_SOURCE_VERSION,
    total,
    valid: 0,
    invalid: 0,
    skipped: 0,
    counts: {
      tuitionRecords: 0,
      tuitionPackages: 0,
      missingStudentId: 0,
      missingPackageIdentity: 0,
    },
    totalEstimatedAmount: 0,
    invalidSamples: [],
    estimatedCloudEntityCount: 0,
    appAllowlistReady: false,
    remoteAllowlistReady: Boolean(remoteAllowlistReady),
    readyForRealPush: false,
    realPushStatus: TUITION_CLOUD_STATUS_NEEDS_PATCH,
    validEntities: [],
  }
}

function normalizeTuitionPaymentPayloads(payments) {
  return (Array.isArray(payments) ? payments : [])
    .filter((payment) => payment && typeof payment === 'object')
    .map((payment, index) => ({
      id: normalizeText(payment.id) || `payment-${index + 1}`,
      amount: normalizeNonNegativeNumber(payment.amount),
      paidAt: normalizeNullableText(payment.paidAt || payment.date),
      method: String(payment.method || ''),
      note: String(payment.note || ''),
      sourceModule: String(payment.sourceModule || ''),
      sourceTag: String(payment.sourceTag || ''),
    }))
}

function normalizeTuitionTermPayloads(termHistory) {
  return (Array.isArray(termHistory) ? termHistory : [])
    .filter((term) => term && typeof term === 'object')
    .map((term, index) => ({
      id: normalizeText(term.id) || `term-history-${index + 1}`,
      termNumber: Math.max(1, normalizeInteger(term.termNumber) || index + 1),
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
      status: ['completed', 'archived'].includes(term.status) ? term.status : 'archived',
      startedAt: normalizeNullableText(term.startedAt),
      endedAt: normalizeNullableText(term.endedAt),
      payments: normalizeTuitionPaymentPayloads(term.payments),
    }))
}

function createDeterministicTuitionRecordId({
  studentId,
  packageName,
  currentTermId,
  currentTermNumber,
} = {}) {
  const studentKey = normalizeText(studentId)
  const packageKey = normalizeText(currentTermId) || normalizeText(packageName)

  if (!studentKey || !packageKey) {
    return ''
  }

  return [
    'tuition',
    studentKey,
    packageKey,
    currentTermNumber || 1,
  ].map(slugifyIdPart).join('-')
}

function createDeterministicTuitionPackageId(name) {
  const normalizedName = normalizeText(name)
  return normalizedName ? `package-${slugifyIdPart(normalizedName)}` : ''
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

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return normalizeNonNegativeNumber(value)
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

function getTuitionPackageStorageKey(centerId = DEFAULT_CENTER_ID) {
  return `ichessCenterOS.tuitionPackages.${slugifyIdPart(centerId || DEFAULT_CENTER_ID)}`
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
