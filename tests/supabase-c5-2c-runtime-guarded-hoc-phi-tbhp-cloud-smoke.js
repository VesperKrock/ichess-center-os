import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'

const repoRoot = process.cwd()
const docsPath = path.join(repoRoot, 'docs', 'supabase-c5-2c-runtime-guarded-hoc-phi-tbhp-cloud.md')
const bridgePath = path.join(repoRoot, 'src', 'cloud-tuition-record-package-bridge.js')
const mainPath = path.join(repoRoot, 'src', 'main.js')
const finalApplyPath = path.join(repoRoot, 'docs', 'supabase-c5-2c-final-apply-hoc-phi-tbhp.sql')

assert(fs.existsSync(docsPath), 'Docs C5.2C must exist.')
assert(fs.existsSync(bridgePath), 'Runtime bridge file must exist.')

const docs = fs.readFileSync(docsPath, 'utf8')
const bridge = fs.readFileSync(bridgePath, 'utf8')
const main = fs.readFileSync(mainPath, 'utf8')
const testSource = fs.readFileSync(new URL(import.meta.url), 'utf8')
const combined = `${docs}\n${bridge}\n${main}`

for (const text of [
  'tuition_record_package',
  'center_cloud_entities',
  'SQL: NOT CREATED / NOT RUN',
  'SUPABASE ACTION: NOT RUN OUTSIDE RUNTIME APP CODE',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
  'ATTENDANCE_TO_TUITION_AUTO_LINK: NO',
  'TEACHER_CONSULTANT_DIRECT_WRITE: HOLD',
  'tuition_record_package::<record.id>',
  'cloud empty',
  'không xóa local',
]) {
  assert(docs.includes(text), `Docs must include: ${text}`)
}

for (const text of [
  "TUITION_RECORD_PACKAGE_ENTITY_TYPE = 'tuition_record_package'",
  'C52_WRITE_ROLES',
  "'owner'",
  "'qtv'",
  "'center_admin'",
  "'admin'",
  'C52_TEACHER_CONSULTANT_WRITE_HOLD',
  'teacher/consultant direct write HOLD',
  'createTuitionRecordPackageLocalId',
  '`${TUITION_RECORD_PACKAGE_ENTITY_TYPE}::${slugifyIdPart(id)}`',
  'pullC52TuitionRecordPackageCloudEntities',
  'upsertC52TuitionRecordPackageCloudEntities',
  'subscribeToC52TuitionRecordPackageRealtime',
  'mergeC52TuitionCloudRecordsIntoLocal',
  'Cloud soft delete observed; local tuition record preserved for safety.',
  'usedSessionsAutoUpdateFromAttendance: false',
  'remainingSessionsAutoUpdateFromAttendance: false',
]) {
  assert(bridge.includes(text), `Bridge must include: ${text}`)
}

for (const text of [
  'bootstrapC52TuitionRecordPackageCloudData',
  'startC52TuitionRealtimeSubscription',
  'stopC52TuitionRealtimeSubscription',
  'writeC52TuitionRecordPackageThroughCloud',
  'saveStoredTuition(tuitionRecords)',
  "void writeC52TuitionRecordPackageThroughCloud(nextRecord, 'tuition-package-save')",
  "void writeC52TuitionRecordPackageThroughCloud(updatedTuitionRecord, 'tuition-payment-save')",
]) {
  assert(main.includes(text), `Main must include: ${text}`)
}

const localSaveIndex = main.indexOf('saveStoredTuition(tuitionRecords)')
const cloudWriteIndex = main.indexOf("void writeC52TuitionRecordPackageThroughCloud(nextRecord, 'tuition-package-save')")
assert(localSaveIndex >= 0 && cloudWriteIndex > localSaveIndex, 'Tuition package save must be local-first before cloud write-through.')

assert(
  !/local_id\s*=\s*[^;\n]*studentId/i.test(bridge) &&
    !/return\s+[^;\n]*studentId[^;\n]*local_id/i.test(bridge),
  'Bridge local_id strategy must not use studentId alone.',
)

for (const forbidden of [
  /update usedSessions from attendance/i,
  /update remainingSessions from attendance/i,
  /attendance_record.*usedSessions/i,
  /session_report.*usedSessions/i,
]) {
  assert(!forbidden.test(`${bridge}\n${main}`), `Forbidden attendance-to-tuition coupling found: ${forbidden}`)
}

assert(!fs.existsSync(finalApplyPath), 'C5.2C must not create a SQL apply file.')

const forbiddenMojibake = [
  String.fromCharCode(0x0102),
  String.fromCharCode(0x00c2),
  String.fromCharCode(0x00c6),
  String.fromCharCode(0x00c4),
  String.fromCharCode(0x00e1, 0x00ba),
  String.fromCharCode(0x00e1, 0x00bb),
  String.fromCharCode(0x00e2, 0x20ac, 0x201d),
  String.fromCharCode(0x00e2, 0x2020),
  String.fromCharCode(0x00ef, 0x00bf, 0x00bd),
  String.fromCharCode(0xfffd),
]

for (const [label, content] of [
  ['docs', docs],
  ['bridge', bridge],
  ['smoke test', testSource],
]) {
  for (const token of forbiddenMojibake) {
    assert(!content.includes(token), `${label} must not include mojibake token: ${token}`)
  }
}

console.log('Smoke C5.2C: PASS')
