import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createCenterSwitchDraftTracker } from '../src/center-switch-drafts.js'
import {
  buildInventoryDueNotificationCandidates,
  resolveCurrentInventoryDueNotification,
} from '../src/notification-center.js'
import { buildC57UpsertAdvisoryNoteCommand } from '../src/cloud-authoritative-calendar-notes.js'

const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const between = (start, end) => {
  const from = main.indexOf(start)
  const to = main.indexOf(end, from + start.length)
  assert(from >= 0 && to > from, `Missing current runtime section ${start}`)
  return main.slice(from, to)
}

{
  const tracker = createCenterSwitchDraftTracker()
  const initial = [
    { key: 'student', label: 'Học viên', identity: 'create', value: { fullName: '' } },
    { key: 'settings', label: 'Cài đặt cơ sở', identity: 'center-a', value: { displayName: 'A' } },
  ]
  tracker.observe(initial)
  assert.deepEqual(tracker.dirty(initial), [])
  const edited = [
    { ...initial[0], value: { fullName: 'Local draft' } },
    { ...initial[1], value: { displayName: 'A edited' } },
  ]
  assert.deepEqual(tracker.dirty(edited).map((item) => item.key), ['student', 'settings'])
  tracker.observe(edited)
  assert.equal(tracker.dirty(edited).length, 2, 'Rerender must not erase a draft baseline')
  tracker.observe([edited[0]])
  assert.equal(tracker.dirty([edited[0]]).length, 1, 'Closing one form retains the other draft')
  tracker.reset()
  assert.equal(tracker.dirty([edited[0]]).length, 0, 'Confirmed switch discards old baselines')
}

{
  const due = { id: 'count-a', centerId: 'center-a', countCode: 'KK-A', dueDate: '2026-10-04',
    dueState: 'overdue', status: 'submitted', updatedAt: '2026-10-04T09:00:00Z' }
  const candidate = buildInventoryDueNotificationCandidates([due], { centerId: 'center-a' })[0]
  const notification = { ...candidate, meta: { ...candidate.meta, centerId: 'center-a' } }
  assert.equal(resolveCurrentInventoryDueNotification(notification, [due], 'center-a')?.entityId, 'count-a')
  assert.equal(resolveCurrentInventoryDueNotification(notification, [{ ...due, status: 'completed' }], 'center-a'), null)
  assert.equal(resolveCurrentInventoryDueNotification(notification, [], 'center-a'), null)
  assert.equal(resolveCurrentInventoryDueNotification(notification, [due], 'center-b'), null)
  assert.equal(resolveCurrentInventoryDueNotification(notification, [due], 'center-a')?.dedupeKey, candidate.dedupeKey)
}

const notificationRouteFunction = between('async function openNotificationSourceModule(notificationId)', 'function getNotificationSourceLabel(')
function inventoryRouteHarness(counts, { activeCenter = 'center-a' } = {}) {
  const due = { id: 'count-a', centerId: 'center-a', countCode: 'KK-A', dueDate: '2026-10-04',
    dueState: 'overdue', status: 'submitted', updatedAt: '2026-10-04T09:00:00Z' }
  const candidate = buildInventoryDueNotificationCandidates([due], { centerId: 'center-a' })[0]
  const notification = { ...candidate, id: 'notification-a', meta: { ...candidate.meta, centerId: 'center-a' } }
  const context = {
    notifications: [notification], activeCenter, cloudStatus: { user: { id: 'owner-a' } },
    inventoryCycleCounts: counts, opened: [], alerts: [], refreshes: 0,
    isNotificationCenterOpen: true, isInventoryCycleCountPanelOpen: false,
    selectedInventoryCycleCountId: null,
    getCurrentCanonicalCenterContext: () => ({ centerId: context.activeCenter }),
    isProductionModuleAvailable: () => true,
    getNotificationSnapshotStatus: () => 'fresh',
    getNotificationRoute: () => null,
    refreshModuleAuthoritativeUpstreams: async () => ({ ok: true }),
    resolveCurrentInventoryDueNotification,
    openModuleWindow: (moduleId) => context.opened.push(moduleId),
    refreshNotificationAuthoritativeUpstreams: () => { context.refreshes += 1; context.notifications = [] },
    render() {},
    window: { alert: (message) => context.alerts.push(message) },
  }
  vm.createContext(context)
  vm.runInContext(notificationRouteFunction, context)
  return context
}

{
  const due = { id: 'count-a', centerId: 'center-a', countCode: 'KK-A', dueDate: '2026-10-04',
    dueState: 'overdue', status: 'submitted' }
  const active = inventoryRouteHarness([due])
  await active.openNotificationSourceModule('notification-a')
  assert.deepEqual(active.opened, ['kho-hang'])
  assert.equal(active.selectedInventoryCycleCountId, 'count-a')
  for (const counts of [[{ ...due, status: 'completed' }], []]) {
    const resolved = inventoryRouteHarness(counts)
    await resolved.openNotificationSourceModule('notification-a')
    assert.deepEqual(resolved.opened, [], 'Resolved/missing target cannot open generic Inventory')
    assert.match(resolved.alerts[0], /không còn cần xử lý/)
    assert.equal(resolved.refreshes, 1)
    await resolved.openNotificationSourceModule('notification-a')
    assert.equal(resolved.refreshes, 1, 'Reconciled notification cannot repeat its action')
  }
  const foreign = inventoryRouteHarness([due], { activeCenter: 'center-b' })
  await foreign.openNotificationSourceModule('notification-a')
  assert.deepEqual(foreign.opened, [])
  assert.deepEqual(foreign.alerts, [])
}

{
  const command = buildC57UpsertAdvisoryNoteCommand({
    studentId: 'student-a', monthKey: '2026-10', careStatus: 'sentComment', note: 'Đã gửi nhận xét cụ thể.',
  })
  assert.equal(command.operation, 'UPSERT_ATTENDANCE_ADVISORY_NOTE')
  assert.equal(command.student_local_id, 'student-a')
  assert.equal(command.care_status, 'sentComment')
  assert.equal(command.note, 'Đã gửi nhận xét cụ thể.')
  assert(!main.includes('data-attendance-status-write="review"'))
}

const reviewFunctions = between('function getCurrentReviewReminder(', 'async function openNotificationSourceModule(')
function reviewHarness({ writeResult = { ok: true }, currentCenter = 'center-a', reminders = null,
  staleFirstRead = false } = {}) {
  const state = {
    centerId: 'center-a', accountId: 'owner-a', generation: 3,
    studentId: 'student-a', cycleId: 'cycle-a', studentName: 'Student A', cycleNumber: '1',
    triggerDate: '2026-10-03', note: 'Nhận xét đã gửi.', confirmedSent: true,
    saving: false, committed: false, error: '',
  }
  const context = {
    reviewCompletionState: state,
    currentCenter,
    cloudStatus: { user: { id: 'owner-a' } },
    cloudUserSyncId: 3,
    v28aAttendanceReminders: reminders ?? [{ centerId: 'center-a', studentId: 'student-a',
      cycleId: 'cycle-a', cycleNumber: 1, signal: 'REVIEW_UPDATE_DUE', triggerDate: '2026-10-03' }],
    attendanceAdvisoryNotes: [],
    writeCommands: [],
    providerRefreshes: 0, operationsReads: 0,
    render() {},
    getCurrentCanonicalCenterContext() { return { centerId: this.currentCenter } },
    getStudentsWithCanonicalProjections: () => [{ id: 'student-a', fullName: 'Student A' }],
    refreshV28AAttendanceOperations: async () => {
      context.operationsReads += 1
      return staleFirstRead && context.operationsReads === 1
        ? { ok: false, outcome_code: 'CENTER_CONTEXT_CHANGED' }
        : { ok: true }
    },
    refreshC57CalendarNotesSharedTruth: async () => ({ ok: true }),
    buildC57UpsertAdvisoryNoteCommand,
    writeC57CalendarNotesCommand: async (command) => {
      context.writeCommands.push(command)
      if (writeResult.ok) context.v28aAttendanceReminders = []
      return writeResult
    },
    refreshNotificationAuthoritativeUpstreams: async () => { context.providerRefreshes += 1; return { ok: true } },
    queueNotificationAttentionRefresh: () => { context.providerRefreshes += 1 },
  }
  context.getCurrentCanonicalCenterContext = () => ({ centerId: context.currentCenter })
  vm.createContext(context)
  vm.runInContext(reviewFunctions, context)
  return context
}

{
  const context = reviewHarness()
  await Promise.all([context.completeAttendanceReview(), context.completeAttendanceReview()])
  assert.equal(context.writeCommands.length, 1, 'One explicit save dispatches one advisory command')
  assert.equal(context.writeCommands[0].care_status, 'sentComment')
  assert.equal(context.providerRefreshes, 1)
  assert.equal(context.reviewCompletionState, null, 'Authoritative provider resolution closes the workflow')
}
{
  const context = reviewHarness({ staleFirstRead: true })
  await context.completeAttendanceReview()
  assert.equal(context.writeCommands.length, 1)
  assert.equal(context.operationsReads, 3, 'Same-center superseded read is retried before completion')
}
{
  const context = reviewHarness({ writeResult: { ok: false, error: 'Mock failed' } })
  await context.completeAttendanceReview()
  assert.equal(context.writeCommands.length, 1)
  assert.equal(context.reviewCompletionState.note, 'Nhận xét đã gửi.')
  assert.equal(context.reviewCompletionState.committed, false)
  assert.match(context.reviewCompletionState.error, /Mock failed/)
}
{
  const foreign = reviewHarness({ currentCenter: 'center-b' })
  await foreign.completeAttendanceReview()
  assert.equal(foreign.writeCommands.length, 0)
  const resolved = reviewHarness({ reminders: [] })
  await resolved.completeAttendanceReview()
  assert.equal(resolved.writeCommands.length, 0)
  assert.match(resolved.reviewCompletionState.error, /không còn cần xử lý/)
}

const conversionFunction = between('async function saveF4bConversion()', 'function getParentFriendlyCrmOutcomeMessage(')
function conversionHarness() {
  let settleConversion
  const conversion = new Promise((resolve) => { settleConversion = resolve })
  const context = {
    f4bConversionState: { contactId: 'contact-a', mode: 'CREATE_NEW', values: { guardianRole: 'UNSPECIFIED' } },
    f4bConversionOperationId: 0,
    cloudUserSyncId: 7,
    cloudStatus: { user: { id: 'owner-a' } },
    currentCenter: 'center-a',
    parentConsultations: [{ id: 'contact-a', canonicalCaseId: 'case-a' }],
    parentContactDetailId: null,
    refreshes: [],
    render() {},
    isProductionModuleAvailable: () => true,
    getMergedParentConsultations: () => [{ id: 'contact-a', canonicalCaseId: 'case-a', canonicalCandidateId: 'candidate-a' }],
    getStudentsWithCanonicalProjections: () => [],
    validateF4bConversionForm: () => ({}),
    getCurrentCanonicalCenterContext: () => ({ ok: true, centerId: context.currentCenter }),
    canConvertParentContactToStudent: () => true,
    createC53CrmIdempotencyKey: () => 'command-a',
    checkCloudDbReadiness: async () => ({ ok: true, centerId: 'center-a', supabase: {} }),
    buildF4bStudentPayload: () => ({ fullName: 'Student A' }),
    convertF4bCrmCaseToStudent: () => conversion,
    refreshStudentModuleCoreProjection: async (centerId) => { context.refreshes.push(`student:${centerId}`); return { ok: true } },
    refreshC53CrmSharedTruth: async () => { context.refreshes.push(`crm:${context.currentCenter}`); return { ok: true } },
    refreshParentStudentLinksSharedTruth: async () => { context.refreshes.push(`link:${context.currentCenter}`); return { ok: true } },
  }
  vm.createContext(context)
  vm.runInContext(conversionFunction, context)
  return { context, settleConversion }
}

for (const result of [{ ok: true, studentId: 'student-a' }, { ok: false, error: 'Mock failure' }]) {
  const { context, settleConversion } = conversionHarness()
  const pending = context.saveF4bConversion()
  await Promise.resolve()
  await Promise.resolve()
  context.currentCenter = 'center-b'
  context.cloudUserSyncId += 1
  context.f4bConversionOperationId += 1
  context.f4bConversionState = { contactId: 'contact-b', mode: 'CREATE_NEW', values: { birthDate: '2020-01-01' } }
  settleConversion(result)
  await pending
  assert.equal(context.f4bConversionState.contactId, 'contact-b', 'A completion cannot replace B draft')
  assert.deepEqual(context.refreshes, [], 'A completion cannot refresh B as a conversion result')
}
{
  const { context, settleConversion } = conversionHarness()
  const pending = context.saveF4bConversion()
  await Promise.resolve()
  await Promise.resolve()
  settleConversion({ ok: true, studentId: 'student-a' })
  await pending
  assert.equal(context.f4bConversionState.result.studentId, 'student-a')
  assert.equal(context.refreshes.length, 3, 'Same-center conversion retains normal handoff refresh')
}

console.log('FINAL_1_CROSS_MODULE_FIXES_SMOKE: PASS')
