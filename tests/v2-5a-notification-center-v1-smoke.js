import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildInventoryDueNotificationCandidates,
  buildMissingSessionReportNotificationCandidates,
  buildScheduleAttentionNotificationCandidates,
  buildStudentBirthdayNotificationCandidates,
  buildV24TuitionNotificationCandidates,
  markNotificationReadById,
  upsertNotificationCandidates,
} from '../src/notification-center.js'

const centerId = 'center-a'
const today = '2026-09-12'

const birthdayCandidates = buildStudentBirthdayNotificationCandidates([
  { id: 'student-birthday', centerId, fullName: 'Học viên sinh nhật', birthDate: '2015-09-12', currentStatus: 'Đang theo học' },
  { id: 'student-other-day', centerId, fullName: 'Học viên ngày khác', birthDate: '2015-09-13', currentStatus: 'Đang theo học' },
  { id: 'student-inactive', centerId, fullName: 'Học viên đã nghỉ', birthDate: '2015-09-12', currentStatus: 'Ngưng học' },
  { id: 'student-foreign', centerId: 'center-b', fullName: 'Học viên cơ sở khác', birthDate: '2015-09-12', currentStatus: 'Đang theo học' },
], { centerId, today })
assert.deepEqual(birthdayCandidates.map((candidate) => candidate.entityId), ['student-birthday'])
assert.equal(birthdayCandidates[0].sourceModule, 'hoc-vien')

const tuitionStudents = [
  { id: 'student-bcht', fullName: 'Bạn BCHT' },
  { id: 'student-renewal', fullName: 'Bạn gia hạn' },
  { id: 'student-exhausted', fullName: 'Bạn hết buổi' },
  { id: 'student-provisional', fullName: 'Bạn tạm thời' },
  { id: 'student-selection', fullName: 'Bạn chọn gói' },
]
const tuitionStates = [
  {
    centerId,
    studentId: 'student-bcht',
    readiness: 'READY',
    currentCycle: { id: 'cycle-bcht', bchtReminder: true, renewalReminder: false, urgentRenewal: false, lifecycleStatus: 'ACTIVE' },
  },
  {
    centerId,
    studentId: 'student-renewal',
    readiness: 'READY',
    currentCycle: { id: 'cycle-renewal', bchtReminder: false, renewalReminder: true, urgentRenewal: false, lifecycleStatus: 'ACTIVE' },
  },
  {
    centerId,
    studentId: 'student-exhausted',
    readiness: 'READY',
    currentCycle: { id: 'cycle-exhausted', bchtReminder: false, renewalReminder: true, urgentRenewal: true, lifecycleStatus: 'ACTIVE' },
  },
  {
    centerId,
    studentId: 'student-provisional',
    readiness: 'READY',
    currentCycle: { id: 'cycle-provisional', bchtReminder: false, renewalReminder: false, urgentRenewal: false, lifecycleStatus: 'PROVISIONAL_UNPAID', paymentStatus: 'UNPAID' },
  },
  {
    centerId,
    studentId: 'student-selection',
    readiness: 'READY',
    currentCycle: { id: 'cycle-selection', bchtReminder: false, renewalReminder: false, urgentRenewal: false, lifecycleStatus: 'NEEDS_PACKAGE_SELECTION' },
  },
  {
    centerId: 'center-b',
    studentId: 'student-foreign',
    readiness: 'READY',
    currentCycle: { id: 'cycle-foreign', bchtReminder: true, lifecycleStatus: 'ACTIVE' },
  },
  {
    centerId,
    studentId: 'student-review',
    readiness: 'LEGACY_REVIEW_REQUIRED',
    currentCycle: { id: 'cycle-review', bchtReminder: true, lifecycleStatus: 'ACTIVE' },
  },
]
const tuitionCandidates = buildV24TuitionNotificationCandidates(tuitionStates, tuitionStudents, { centerId, today })
assert.deepEqual(
  tuitionCandidates.map((candidate) => candidate.meta.signal).sort(),
  ['bcht-due', 'needs-package-selection', 'package-exhausted', 'provisional-unpaid', 'renewal-due'],
)
assert(tuitionCandidates.every((candidate) => candidate.sourceModule === 'hoc-phi'))

const occurrences = [
  {
    id: 'session-makeup',
    centerId,
    scheduleType: 'oneOff',
    occurrenceReason: 'makeup',
    occurrenceDate: today,
    title: 'Ca học bù',
    startTime: '08:00',
    endTime: '09:00',
    status: 'scheduled',
  },
  {
    id: 'session-trial',
    centerId,
    scheduleType: 'oneOff',
    occurrenceReason: 'trial',
    occurrenceDate: today,
    title: 'Ca học thử',
    startTime: '09:00',
    endTime: '10:00',
    status: 'scheduled',
  },
  {
    id: 'session-recurring',
    centerId,
    scheduleType: 'recurring',
    occurrenceDate: today,
    title: 'Ca định kỳ',
    startTime: '18:00',
    endTime: '19:00',
    status: 'scheduled',
  },
  {
    id: 'session-future',
    centerId,
    scheduleType: 'recurring',
    occurrenceDate: '2026-09-13',
    title: 'Ca ngày mai',
    startTime: '18:00',
    endTime: '19:00',
    status: 'scheduled',
  },
]
const scheduleCandidates = buildScheduleAttentionNotificationCandidates(occurrences, { centerId, today })
assert.deepEqual(scheduleCandidates.map((candidate) => candidate.meta.occurrenceReason).sort(), ['makeup', 'trial'])

const missingReportCandidates = buildMissingSessionReportNotificationCandidates(
  occurrences,
  [
    { centerId, sessionId: 'session-makeup', occurrenceDate: today },
    { centerId: 'center-b', sessionId: 'session-trial', occurrenceDate: today },
  ],
  { centerId, now: new Date('2026-09-12T20:00:00') },
)
assert.deepEqual(
  missingReportCandidates.map((candidate) => candidate.entityId).sort(),
  ['session-recurring', 'session-trial'],
  'Only ended exact occurrences without a matching sessionId/date report should be due.',
)
assert(missingReportCandidates.every((candidate) => candidate.sourceModule === 'thoi-khoa-bieu'))

const inventoryCandidates = buildInventoryDueNotificationCandidates([
  { id: 'request-due', centerId, requestCode: 'YC-01', neededDate: today, status: 'pending' },
  { id: 'request-overdue', centerId, requestCode: 'YC-02', neededDate: '2026-09-11', status: 'preparing' },
  { id: 'request-future', centerId, requestCode: 'YC-03', neededDate: '2026-09-13', status: 'pending' },
  { id: 'request-done', centerId, requestCode: 'YC-04', neededDate: today, status: 'fulfilled' },
  { id: 'request-foreign', centerId: 'center-b', requestCode: 'YC-05', neededDate: today, status: 'pending' },
], { centerId, today })
assert.deepEqual(inventoryCandidates.map((candidate) => candidate.entityId).sort(), ['request-due', 'request-overdue'])
assert.equal(inventoryCandidates.find((candidate) => candidate.entityId === 'request-overdue').severity, 'danger')

const firstSync = upsertNotificationCandidates([], [
  ...birthdayCandidates,
  ...tuitionCandidates,
  ...scheduleCandidates,
  ...missingReportCandidates,
  ...inventoryCandidates,
])
const birthdayNotificationId = firstSync.find((candidate) => candidate.dedupeKey === birthdayCandidates[0].dedupeKey).id
const readBirthday = markNotificationReadById(firstSync, birthdayNotificationId, '2026-09-12T10:00:00.000Z')
const sameBirthdaySync = upsertNotificationCandidates(readBirthday, birthdayCandidates)
assert.equal(sameBirthdaySync.find((candidate) => candidate.id === birthdayNotificationId).readAt, '2026-09-12T10:00:00.000Z')
const resolvedSync = upsertNotificationCandidates(sameBirthdaySync, [])
assert.equal(resolvedSync.length, 0, 'A derived notification must resolve when its business signal resolves.')

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const refreshStart = mainSource.indexOf('async function refreshNotificationAuthoritativeUpstreams')
const refreshEnd = mainSource.indexOf('function openModuleWindowFromChildInteraction', refreshStart)
const refreshSource = mainSource.slice(refreshStart, refreshEnd)
assert(refreshSource.includes("'core'"))
assert(refreshSource.includes("'attendance'"))
assert(refreshSource.includes("'package-cycles'"))
assert(!refreshSource.includes("'crm'"), 'Notification refresh must not pull Parent CRM for an unsupported provider.')
assert(!refreshSource.includes("'tuition'"), 'Notification refresh must consume V2-4 state, not legacy Tuition rows.')
assert(refreshSource.includes('isC56InventoryCapabilityReady'))
assert(refreshSource.includes('if (!failures.length)'))

const syncStart = mainSource.indexOf('function syncAppNotifications')
const syncEnd = mainSource.indexOf('function markNotificationRead', syncStart)
const syncSource = mainSource.slice(syncStart, syncEnd)
for (const provider of [
  'buildStudentBirthdayNotificationCandidates',
  'buildV24TuitionNotificationCandidates',
  'buildScheduleAttentionNotificationCandidates',
  'buildMissingSessionReportNotificationCandidates',
  'buildInventoryDueNotificationCandidates',
]) {
  assert(syncSource.includes(provider), `Missing current provider ${provider}.`)
}
assert(syncSource.includes('getVisibleScheduleSessions'))
assert(syncSource.includes('isV24PackageCycleCapabilityReady'))
assert(syncSource.includes('isC56InventoryCapabilityReady'))
assert(!syncSource.includes('buildParentFollowupNotificationCandidates'))
assert(!syncSource.includes('buildTuitionRows'))
assert(!syncSource.includes('giao-vien'), 'Teacher assignment signals belong to V2-6, not V2-5A.')

assert(mainSource.includes('return `${summary.label} — ${summary.count}`'))
assert(mainSource.includes('data-notification-id="${escapeAttribute(notification.id)}"'))
assert(mainSource.includes("if (notificationElement.matches('button'))"))
assert(mainSource.includes('openStudentDetailWindowFromChildInteraction(studentId)'))
assert(mainSource.includes('scheduleWeekStartDate = getCurrentScheduleWeekStartDate'))
assert(mainSource.includes('if (!notification || !isProductionModuleAvailable(notification.sourceModule))'))
assert(mainSource.includes('activeNotificationDataCenterId === binding.currentCenterId'))
assert(mainSource.includes('resetTransientStateForCenterSwitch()'))
assert(mainSource.includes('notificationRefreshRunId += 1'))

const providerSource = fs.readFileSync(new URL('../src/notification-center.js', import.meta.url), 'utf8')
assert(!providerSource.includes('localStorage'))
for (const deferredScope of ['SMS', 'email/push', 'teacher assignment']) {
  assert(!providerSource.toLowerCase().includes(deferredScope.toLowerCase()))
}

console.log('V2-5A Notification Center V1 smoke: PASS')
