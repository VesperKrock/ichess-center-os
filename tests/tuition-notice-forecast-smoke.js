import assert from 'node:assert/strict'
import fs from 'node:fs'
import { forecastTuitionNotice, buildTuitionNoticeForecastLines, projectTuitionNoticeWeekdays, getTuitionNoticeGenerationDate } from '../src/tuition-notice-forecast.js'
import { readTuitionNoticeForecastFacts } from '../src/cloud-authoritative-tuition-notices.js'
import { buildV24PrepareNextCycleCommand } from '../src/cloud-authoritative-tuition-cycles.js'
import { makeA5Notice } from './tuition-notice-a5-fixtures.js'
import { createTuitionNoticePdfProjection, buildTuitionNoticeNotes } from '../src/tuition-notice-pdf.js'

const input = { generatedDate: '2026-10-06', packageSessions: 16, usedSessions: 14, weekdays: ['tue', 'thu'] }
assert.deepEqual(forecastTuitionNotice(input), { sessionsPerWeek: 2, estimatedWeeks: 9, estimatedNextCycleStartDate: '2026-10-15' })
const lines = buildTuitionNoticeForecastLines(forecastTuitionNotice(input))
assert.deepEqual(lines, [
  'Với lịch học 2 buổi/tuần, thời gian dự kiến hoàn thành khóa học khoảng 9 tuần.',
  'Buổi học đầu tiên của khóa mới dự kiến bắt đầu từ Thứ Năm, 15/10/2026.',
])
assert.equal(forecastTuitionNotice({ ...input, weekdays: ['thu'] }).estimatedWeeks, 17)
for (const [packageSessions, weeks] of [[8, 5], [24, 13], [9, 6]]) assert.equal(forecastTuitionNotice({ ...input, packageSessions }).estimatedWeeks, weeks)
for (const usedSessions of [16, 17]) assert.equal(forecastTuitionNotice({ ...input, usedSessions }).estimatedNextCycleStartDate, '2026-10-08')
assert.equal(forecastTuitionNotice({ ...input, usedSessions: 15 }).estimatedNextCycleStartDate, '2026-10-13')
assert.equal(forecastTuitionNotice({ ...input, usedSessions: 14, weekdays: ['thu', 'thu', 'tue'] }).estimatedNextCycleStartDate, '2026-10-13', 'Two distinct Ca occurrences on one day both count')
assert.equal(forecastTuitionNotice({ ...input, usedSessions: null }).estimatedNextCycleStartDate, '')
assert.equal(forecastTuitionNotice({ ...input, generatedDate: '2026-02-30' }).estimatedNextCycleStartDate, '')
assert.equal(forecastTuitionNotice({ generatedDate: '2026-12-31', packageSessions: 16, usedSessions: 16, weekdays: ['fri'] }).estimatedNextCycleStartDate, '2027-01-01')
assert.equal(getTuitionNoticeGenerationDate(new Date('2026-10-05T17:00:00Z')), '2026-10-06')
for (const weekdays of [[], ['unknown'], null]) assert.equal(forecastTuitionNotice({ ...input, weekdays }), null)

const student = { id: 'qa-student', currentStatus: 'Đang theo học', classSessionIds: ['ca'] }
const ca = { id: 'ca', status: 'active', daysOfWeek: ['tue', 'thu'] }
const sets = [{ studentId: student.id, enrollments: [{ classSessionId: ca.id, weekdays: ['thu'] }] }]
assert.deepEqual(projectTuitionNoticeWeekdays(student, sets, [ca]), ['thu'], 'Use selected Student day, not all Ca days')
assert.deepEqual(projectTuitionNoticeWeekdays(student, [], [ca]), [], 'Unresolved legacy multi-day enrollment is omitted')
assert.deepEqual(projectTuitionNoticeWeekdays(student, [], [{ ...ca, daysOfWeek: ['thu'] }]), ['thu'], 'Existing deterministic legacy single-day authority works')
assert.deepEqual(projectTuitionNoticeWeekdays(student, sets, [{ ...ca, status: 'inactive' }]), [])
assert.deepEqual(projectTuitionNoticeWeekdays(student, sets, []), [])
assert.deepEqual(projectTuitionNoticeWeekdays({ ...student, currentStatus: 'Tạm nghỉ' }, sets, [ca]), [])
assert.deepEqual(projectTuitionNoticeWeekdays(student, sets, [{ ...ca, daysOfWeek: ['tue'] }]), [])

// Exercise existing center-scoped READ adapters, including failure omission.
const calls = [], centerId = 'phongtrong_prod'
const operatorSnapshot = { centerId, students: [student], cycleStates: [{ studentId: student.id,
  currentCycle: { totalSessions: 16, usedSessions: 14 }, preparedNextCycle: { totalSessions: 24, usedSessions: 0 } }] }
const query = { select() { return this }, eq(key, value) { calls.push([key, value]); return this }, is() { return this },
  order() { return Promise.resolve({ data: [{ center_id: centerId, entity_type: 'class_session', local_id: ca.id, payload: ca, entity_version: 1 }] }) } }
const supabase = { from(name) { calls.push(['table', name]); return query }, rpc: async (name, args) => {
  calls.push([name, args]); return { data: { ok: true, center_id: centerId, enrollment_sets: [{ student_id: student.id, version: 1,
    enrollments: [{ class_session_id: ca.id, weekdays: ['tue', 'thu'] }] }] } }
} }
const before = JSON.stringify(operatorSnapshot)
const facts = await readTuitionNoticeForecastFacts({ supabase, centerId, studentId: student.id, operatorSnapshot })
assert.deepEqual(facts, { packageSessions: 16, usedSessions: 14, weekdays: ['tue', 'thu'] })
assert(calls.some(([key, value]) => key === 'center_id' && value === centerId))
assert(calls.some(([key, value]) => key === 'entity_type' && value === 'class_session'))
assert(calls.some(([name, args]) => name === 'v2_2_list_student_enrollments' && args.p_center_id === centerId))
assert.equal(JSON.stringify(operatorSnapshot), before)
assert.equal(await readTuitionNoticeForecastFacts({ supabase, centerId: 'other', studentId: student.id, operatorSnapshot }), null)
assert.equal(await readTuitionNoticeForecastFacts({ supabase: { ...supabase, from() { throw Error('Offline') } }, centerId, studentId: student.id, operatorSnapshot }), null)

const notice = makeA5Notice(), noticeBefore = JSON.stringify(notice)
const options = { generatedDate: input.generatedDate, forecastFacts: facts }
const projection = createTuitionNoticePdfProjection(notice, options)
assert.deepEqual(buildTuitionNoticeNotes(projection).paragraphs.slice(1), lines)
assert.equal(JSON.stringify(notice), noticeBefore, 'Forecast never modifies the printable snapshot')
notice.snapshot.tuition.maxCompletionWeeks = 0
assert.equal(createTuitionNoticePdfProjection(notice, options).forecast.estimatedWeeks, 9, 'Legacy deadline is irrelevant to advisory rendering')
assert.equal(buildTuitionNoticeNotes(createTuitionNoticePdfProjection(notice)).paragraphs.length, 1, 'No guessed cadence')
const command = buildV24PrepareNextCycleCommand({ studentId: student.id, id: notice.id, version: 1 }, notice.id)
assert.deepEqual(Object.keys(command), ['operation', 'student_id', 'current_cycle_id', 'package_catalog_id', 'expected_version'])
for (const file of ['src/tuition-notice-forecast.js', 'src/tuition-notice-pdf.js']) assert(!/supabase|localStorage|sessionStorage/.test(fs.readFileSync(file, 'utf8')), 'Pure forecast/PDF have no write authority')
console.log('PASS TBHP forecast: agreed 14/16 Tue+Thu, one/week=17, rollover, missing facts, current Ca read, presentation-only')
