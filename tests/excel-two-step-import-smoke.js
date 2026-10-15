import assert from 'node:assert/strict'
import { parseExcelSchedule, parseExcelDays, parseExcelTime } from '../src/excel-import-normalize.js'
import { createExcelImportManifest, matchExcelStudent, stableExcelJson } from '../src/excel-import-plan.js'
import { executeExcelImport } from '../src/excel-import-service.js'
import { createEmptyStudentFormState } from '../src/student-module.js'
const c1 = { ref: 'CA-1', daysOfWeek: ['tue', 'thu'], startTime: '17:30', endTime: '19:00', teacherDisplayName: 'Fixture Teacher', status: 'active', note: '' }, c2 = { ...c1, ref: 'CA-2', startTime: '19:00', endTime: '20:30' }
assert.deepEqual(parseExcelTime('18h30–20g'), { startTime: '18:30', endTime: '20:00' })
assert.deepEqual(parseExcelDays('T3-T5'), ['tue', 'thu'])
const consecutive = parseExcelSchedule('T3 17:30-19:00; T3 19:00-20:30', [c1, c2]); assert.equal(consecutive.length, 2); assert.equal(consecutive.flatMap(e => e.weekdays).length, 2)
assert.throws(() => parseExcelSchedule('T3 17:30-19:00; T3 17:30-19:00', [c1]), /lặp|chồng/)
const values = { ...createEmptyStudentFormState().values, fullName: 'Fixture Student', birthYear: '2018', birthYearOnly: true, motherName: 'Fixture Guardian', motherPhone: '0900000001', recurringEnrollments: [{ classSessionId: 'CA-1', weekdays: ['tue'] }], useAuthoritativeEnrollment: true }
const facts = { sourceSha256: 'a'.repeat(64), center: {}, ca: [c1], packages: [], students: [{ ref: 'STT-1', stt: 1, values, tuition: null }], cutoff: '2026-10-15', questions: [], skipped: [] }
const empty = { centerId: 'CENTER-A', actorId: 'actor', backend: 'https://backend.example', status: 'active', students: [], ca: [], packages: [], enrollmentSets: [], cycleStates: [] }
const first = await createExcelImportManifest(facts, empty, { createdAt: '2026-10-15T00:00:00Z' }), again = await createExcelImportManifest(facts, empty, { createdAt: first.createdAt })
assert.equal(first.sha256, again.sha256); assert.equal(first.commands.filter(c => c.rpc).length, 2)
assert(first.commands.every(c => !/crm|ph_1|a3|v2_6/.test(c.rpc)))
assert.equal(matchExcelStudent(values, [{ ...values, id: 'one' }]).status, 'EXACT')
assert.equal(matchExcelStudent(values, [{ ...values, motherName: 'Other Guardian', id: 'one' }]).status, 'QUESTION')
const foreign = await createExcelImportManifest(facts, { ...empty, centerId: 'CENTER-B' }, { createdAt: first.createdAt }); assert.notEqual(first.commands[0].key, foreign.commands[0].key)
let snapshot = structuredClone(empty), calls = [], saved = {}, readCount = 0
const result = await executeExcelImport({ manifest: first, approvedSha256: first.sha256, getCurrentCenterId: () => 'CENTER-A', readTarget: async () => { readCount++; return snapshot }, checkpoint: async ledger => { saved = structuredClone(ledger) }, rpc: async (name, args) => { calls.push(name); if (name === 'c5_1_mutate_core_entity') snapshot.ca.push({ ...args.p_payload, cloudVersion: 1 }); else { snapshot.students.push(args.p_student_payload); snapshot.enrollmentSets.push({ studentId: args.p_student_local_id, version: 1, enrollments: args.p_enrollments.map(e => ({ classSessionId: e.class_session_id, weekdays: e.weekdays })) }) } return { data: { ok: true } } } })
assert.equal(result.summary.committed, 2); assert.equal(calls.length, 2); assert(saved['STUDENT:STT-1'].readBack)
const retry = await executeExcelImport({ manifest: first, approvedSha256: first.sha256, getCurrentCenterId: () => 'CENTER-A', readTarget: async () => snapshot, checkpoint: async () => {}, ledger: saved, rpc: async () => { throw Error('must not retry known committed') } }); assert.equal(retry.summary.reconciled, 2)
const before = calls.length
await assert.rejects(() => executeExcelImport({ manifest: first, approvedSha256: first.sha256, getCurrentCenterId: () => 'CENTER-B', readTarget: async () => snapshot, checkpoint: async () => {}, rpc: async () => { calls.push('forbidden') } }), /CENTER_OR_ACTOR_CHANGED/); assert.equal(calls.length, before)
await assert.rejects(() => executeExcelImport({ manifest: { ...first, target: { ...first.target, centerId: 'CENTER-B' } }, approvedSha256: first.sha256 }), /Manifest/)
const delta = await createExcelImportManifest({ ...facts, sourceSha256: 'b'.repeat(64), ca: [{ ...c1, startTime: '16:00' }] }, snapshot, { previous: first }); assert(delta.holds.some(h => h.domain === 'CA'))
const changed = structuredClone(facts); changed.students[0].values.schoolName = 'Changed school'
const review = await createExcelImportManifest(changed, snapshot); assert(review.holds.some(h => h.domain === 'STUDENT')); assert(!review.commands.some(c => c.domain === 'STUDENT' && c.rpc))
assert.equal(stableExcelJson({ b: 1, a: 2 }), stableExcelJson({ a: 2, b: 1 }))
let switchedCenter = 'CENTER-A', forbiddenDispatch = false, interruptedLedger
await assert.rejects(() => executeExcelImport({ manifest: first, approvedSha256: first.sha256, getCurrentCenterId: () => switchedCenter, readTarget: async () => empty, checkpoint: async ledger => { interruptedLedger = ledger; switchedCenter = 'CENTER-B' }, rpc: async () => { forbiddenDispatch = true } }), /CENTER_OR_ACTOR_CHANGED/)
assert.equal(forbiddenDispatch, false); assert.equal(interruptedLedger['CA:CA-1'].status, 'HELD')
console.log('Two-step importer: exact schedule/identity/stable intents/retry/readback/actor-center boundary/corrected-source delta PASS')
