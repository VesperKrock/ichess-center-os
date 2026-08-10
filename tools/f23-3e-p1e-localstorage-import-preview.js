#!/usr/bin/env node

// F23.3E-P1E explicit offline preview only.
// P1E_IMPORT_TOOL_AUTOMATIC_BROWSER_HARVEST: NO
// P1E_IMPORT_TOOL_DATABASE_WRITE: NO
// P1E_IMPORT_TOOL_NETWORK_IO: NO
// P1E_LEGACY_CONVERTED_PROVES_CANONICAL_CONVERSION: NO

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FORMAT_VERSION = 1
const MAX_INPUT_BYTES = 10 * 1024 * 1024
const DIGEST_PATTERN = /^[0-9a-f]{64}$/
const SUPPORTED_STAGES = new Map([
  ['lead', 'LEGACY_STAGE_LEAD_CLAIM'],
  ['consulting', 'LEGACY_STAGE_CONSULTING_CLAIM'],
  ['converted', 'LEGACY_CONVERTED_CLAIM_REVIEW_REQUIRED'],
])

const isPlainObject = (value) => value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)

const canonicalize = (value) => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('UNSUPPORTED_FIELD_TYPE')
    return value
  }
  if (Array.isArray(value)) return value.map(canonicalize)
  if (isPlainObject(value)) {
    const result = Object.create(null)
    for (const key of Object.keys(value).sort()) {
      Object.defineProperty(result, key, {
        value: canonicalize(value[key]),
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
    return result
  }
  throw new Error('UNSUPPORTED_FIELD_TYPE')
}

const stableJson = (value) => JSON.stringify(canonicalize(value))
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex')
const digestValue = (value) => sha256(stableJson(value))

const parseArguments = (argv) => {
  const options = { input: '', expectedCenter: '', priorManifest: '', pretty: false }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--pretty') {
      options.pretty = true
      continue
    }
    if (!['--input', '--expected-center', '--prior-manifest'].includes(token) || index + 1 >= argv.length) {
      throw new Error('INVALID_ARGUMENTS')
    }
    const value = argv[index + 1]
    index += 1
    if (token === '--input') options.input = value
    if (token === '--expected-center') options.expectedCenter = value
    if (token === '--prior-manifest') options.priorManifest = value
  }
  if (!options.input || !options.expectedCenter) throw new Error('INVALID_ARGUMENTS')
  return options
}

const readJsonFile = (path, errorCode) => {
  const source = readFileSync(resolve(path), 'utf8')
  if (Buffer.byteLength(source, 'utf8') > MAX_INPUT_BYTES) throw new Error('INPUT_TOO_LARGE')
  try {
    return JSON.parse(source)
  } catch {
    throw new Error(errorCode)
  }
}

const validateEnvelope = (envelope, expectedCenter) => {
  if (!isPlainObject(envelope)
      || envelope.format_version !== FORMAT_VERSION
      || typeof envelope.source_center_id !== 'string'
      || typeof envelope.source_storage_key !== 'string'
      || !Array.isArray(envelope.records)) {
    throw new Error('PARTIAL_OR_MALFORMED_EXPORT')
  }
  if (envelope.source_center_id !== expectedCenter
      || envelope.source_storage_key !== `ichessCenterOS.parentConsultations.${expectedCenter}`) {
    throw new Error('CENTER_NAMESPACE_MISMATCH')
  }
  canonicalize(envelope)
}

const withoutManifestDigest = (manifest) => Object.fromEntries(
  Object.entries(manifest).filter(([key]) => key !== 'manifest_digest'),
)

const loadPriorRecordDigests = (path, expectedCenter, sourceStorageKeyDigest) => {
  if (!path) return new Map()
  const prior = readJsonFile(path, 'MALFORMED_PRIOR_MANIFEST')
  if (!isPlainObject(prior) || typeof prior.manifest_digest !== 'string'
      || !DIGEST_PATTERN.test(prior.manifest_digest)
      || digestValue(withoutManifestDigest(prior)) !== prior.manifest_digest) {
    throw new Error('PRIOR_MANIFEST_DIGEST_MISMATCH')
  }
  if (prior.format_version !== FORMAT_VERSION
      || prior.source_center_id !== expectedCenter
      || prior.source_storage_key_digest !== sourceStorageKeyDigest
      || !Array.isArray(prior.records)) {
    throw new Error('PRIOR_MANIFEST_PROVENANCE_MISMATCH')
  }
  const records = new Map()
  for (const row of prior.records) {
    if (!isPlainObject(row)
        || !DIGEST_PATTERN.test(String(row.legacy_source_id_digest || ''))
        || !DIGEST_PATTERN.test(String(row.record_digest || ''))
        || records.has(row.legacy_source_id_digest)) {
      throw new Error('PRIOR_MANIFEST_RECORD_DIGEST_MISMATCH')
    }
    records.set(row.legacy_source_id_digest, row.record_digest)
  }
  return records
}

const validateArrayOfObjects = (record, field, validationCodes) => {
  if (!(field in record)) return []
  if (!Array.isArray(record[field]) || record[field].some((value) => !isPlainObject(value))) {
    validationCodes.push(`UNSUPPORTED_${field.toUpperCase()}_TYPE`)
    return []
  }
  return record[field]
}

const validateStringArray = (record, field, validationCodes) => {
  if (!(field in record)) return []
  if (!Array.isArray(record[field]) || record[field].some((value) => typeof value !== 'string')) {
    validationCodes.push(`UNSUPPORTED_${field.toUpperCase()}_TYPE`)
    return []
  }
  return record[field].filter((value) => value.trim())
}

const previewRecord = (record, recordIndex, priorDigests, sourceNamespace) => {
  const validationCodes = []
  const reviewCodes = []
  const objectRecord = isPlainObject(record) ? record : {}
  if (!isPlainObject(record)) validationCodes.push('MALFORMED_RECORD')

  const legacyId = typeof objectRecord.id === 'string' && objectRecord.id.trim()
    ? objectRecord.id.trim()
    : ''
  if (!legacyId) validationCodes.push('MISSING_LEGACY_ID')

  const locatorMaterial = legacyId
    ? { ...sourceNamespace, legacy_source_id: legacyId }
    : { ...sourceNamespace, invalid_record_index: recordIndex }
  const legacySourceIdDigest = digestValue(locatorMaterial)
  const recordDigest = digestValue(record)
  const stage = typeof objectRecord.customerStage === 'string' ? objectRecord.customerStage : ''
  const legacyStageClaim = SUPPORTED_STAGES.get(stage) || 'UNSUPPORTED_LEGACY_STAGE'
  if (!SUPPORTED_STAGES.has(stage)) validationCodes.push('UNSUPPORTED_LEGACY_STAGE')
  if (stage === 'converted') reviewCodes.push('LEGACY_CONVERTED_CLAIM_REVIEW_REQUIRED')

  const careLogs = validateArrayOfObjects(objectRecord, 'careLogs', validationCodes)
  const appointments = validateArrayOfObjects(objectRecord, 'appointments', validationCodes)
  const linkedStudentIds = validateStringArray(objectRecord, 'linkedStudentIds', validationCodes)
  const directStudentClaim = typeof objectRecord.studentId === 'string' && objectRecord.studentId.trim() ? 1 : 0
  if ('studentId' in objectRecord && typeof objectRecord.studentId !== 'string') {
    validationCodes.push('UNSUPPORTED_STUDENTID_TYPE')
  }
  const linkedStudentClaimCount = new Set([
    ...linkedStudentIds,
    ...(directStudentClaim ? [objectRecord.studentId.trim()] : []),
  ]).size
  if (linkedStudentClaimCount) reviewCodes.push('LEGACY_STUDENT_LINK_CLAIM_REVIEW_REQUIRED')
  if (appointments.length) reviewCodes.push('LEGACY_APPOINTMENT_DEFERRED_REVIEW_REQUIRED')

  let enrollmentDraftPresent = false
  if ('enrollmentDraft' in objectRecord) {
    if (!isPlainObject(objectRecord.enrollmentDraft)) validationCodes.push('UNSUPPORTED_ENROLLMENTDRAFT_TYPE')
    else if (Object.keys(objectRecord.enrollmentDraft).length) {
      enrollmentDraftPresent = true
      reviewCodes.push('LEGACY_ENROLLMENT_DRAFT_DEFERRED_REVIEW_REQUIRED')
    }
  }

  const candidateEvidencePresent = [
    'studentName', 'leadStudentName', 'studentBirthYear', 'leadStudentAge',
    'leadNeed', 'parentFeedbackAboutChild',
  ].some((field) => typeof objectRecord[field] === 'string' && objectRecord[field].trim())
  if (candidateEvidencePresent) reviewCodes.push('LEGACY_CHILD_EVIDENCE_CANDIDATE_REVIEW_REQUIRED')
  if (validationCodes.length) reviewCodes.push('RECORD_VALIDATION_REVIEW_REQUIRED')

  const priorDigest = priorDigests.get(legacySourceIdDigest)
  if (priorDigest && priorDigest !== recordDigest) {
    reviewCodes.push('DIVERGENT_LOCAL_EDIT_REVIEW_REQUIRED')
  }

  return {
    record_index: recordIndex,
    legacy_source_id_digest: legacySourceIdDigest,
    record_digest: recordDigest,
    legacy_stage_claim: legacyStageClaim,
    care_log_count: careLogs.length,
    linked_student_claim_count: linkedStudentClaimCount,
    student_link_review_required: linkedStudentClaimCount > 0,
    appointment_count: appointments.length,
    enrollment_draft_present: enrollmentDraftPresent,
    candidate_evidence_review_required: candidateEvidencePresent,
    validation_codes: [...new Set(validationCodes)].sort(),
    review_codes: [...new Set(reviewCodes)].sort(),
    proposed_action: 'REVIEW_ONLY',
  }
}

const markDuplicateLocators = (records) => {
  const counts = new Map()
  for (const row of records) {
    counts.set(row.legacy_source_id_digest, (counts.get(row.legacy_source_id_digest) || 0) + 1)
  }
  for (const row of records) {
    if (counts.get(row.legacy_source_id_digest) > 1) {
      row.review_codes = [...new Set([...row.review_codes, 'DUPLICATE_LEGACY_ID_REVIEW_REQUIRED'])].sort()
    }
  }
  return [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0)
}

const buildManifest = (envelope, expectedCenter, priorManifestPath) => {
  validateEnvelope(envelope, expectedCenter)
  const sourceStorageKeyDigest = digestValue(envelope.source_storage_key)
  const priorDigests = loadPriorRecordDigests(priorManifestPath, expectedCenter, sourceStorageKeyDigest)
  const sourceNamespace = {
    format_version: envelope.format_version,
    source_center_id: envelope.source_center_id,
    source_storage_key: envelope.source_storage_key,
  }
  const records = envelope.records.map((record, index) => previewRecord(record, index, priorDigests, sourceNamespace))
  const duplicateLegacyLocatorCount = markDuplicateLocators(records)
  const manifest = {
    format_version: FORMAT_VERSION,
    ok: true,
    outcome_code: 'IMPORT_PREVIEW_GENERATED',
    source_center_id: expectedCenter,
    source_storage_key_digest: sourceStorageKeyDigest,
    export_digest: digestValue(envelope),
    record_count: records.length,
    valid_record_count: records.filter((row) => row.validation_codes.length === 0).length,
    review_required_count: records.filter((row) => row.review_codes.length > 0).length,
    converted_claim_count: records.filter((row) => row.legacy_stage_claim === 'LEGACY_CONVERTED_CLAIM_REVIEW_REQUIRED').length,
    duplicate_legacy_locator_count: duplicateLegacyLocatorCount,
    records,
  }
  return { ...manifest, manifest_digest: digestValue(manifest) }
}

const emitFailure = (code) => {
  const safeCode = /^[A-Z0-9_]+$/.test(String(code || '')) ? code : 'IMPORT_PREVIEW_FAILED'
  process.stdout.write(`${JSON.stringify({ format_version: FORMAT_VERSION, ok: false, outcome_code: safeCode })}\n`)
  process.stderr.write(`F23_3E_P1E_IMPORT_PREVIEW_ERROR:${safeCode}\n`)
  process.exitCode = 1
}

try {
  const options = parseArguments(process.argv.slice(2))
  const envelope = readJsonFile(options.input, 'MALFORMED_EXPORT')
  const manifest = buildManifest(envelope, options.expectedCenter, options.priorManifest)
  process.stdout.write(`${JSON.stringify(manifest, null, options.pretty ? 2 : 0)}\n`)
} catch (error) {
  emitFailure(error?.message)
}
