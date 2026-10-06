import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createReportChecklistController } from '../src/report-checklist-controller.js'
import { createCenterSwitchDraftTracker } from '../src/center-switch-drafts.js'
import { runAuthoritativeCoreSave } from '../src/core-save-recovery.js'

// Execute the actual switch handler locally. No Supabase client or network is used.
const source = fs.readFileSync(process.env.N8_MAIN_SOURCE || new URL('../src/main.js', import.meta.url), 'utf8')
const observe = process.argv.includes('--observe-baseline')
function declaration(name) {
  const start = source.search(new RegExp(`^(?:async )?function ${name}\\(`, 'm'))
  assert(start >= 0, `Missing production function: ${name}`)
  const rest = source.slice(start + 1)
  const next = rest.search(/\n(?:async )?function /)
  return source.slice(start, next < 0 ? source.length : start + 1 + next)
}
const stateNames = `attendanceBoardDraft f4bConversionState c53CrmSharedTruthState studentFormState teacherFormState
  tuitionOperatorState c54FinanceSharedTruthState v24PackageCycleCapabilityState f5bReceiptCapabilityState
  scheduleFormState c57CalendarNotesSharedTruthState c56InventorySharedTruthState v27aInventoryCycleCountCapabilityState
  v21CenterSettingsCapabilityState reviewCompletionState a3TeacherDialogState v26TeacherRegistryCapabilityState
  v22StudentEnrollmentCapabilityState parentLinkReviewState parentIdentityEditState cashflowFormState
  parentConsultationFormState parentQuickNoteState scheduleCalendarItemState scheduleCalendarTagState scheduleReportState
  sessionReportLearningFormState sessionReportGuestFormState sessionReportGuestState attendanceBaselineDraftState
  attendanceCellNoteFormState attendanceBoardNoteFormState cashflowCategoryFormState cashbookSettingsFormState
  cashbookReconciliationFormState inventoryFormState inventoryMovementFormState inventoryRequestFormState
  inventoryRequestStatusFormState settingsCenterProfileFormState settingsTuitionPackageFormState
  settingsClassSessionFormState staffFormState staffDepartmentFormState`.split(/\s+/).filter(Boolean)
function fixture() {
  const calls = { alert: 0, confirm: 0, close: 0, reset: 0, destination: 0 }
  const stop = new Error('LOCAL_SWITCH_BOUNDARY')
  const context = Object.fromEntries(stateNames.map(name => [name, {}]))
  Object.assign(context, {
    cloudStatus: {}, cloudUserSyncId: 0, internalCenterSwitchState: {},
    getInternalCenterById: id => ({ id }), canOpenInternalCenter: () => true,
    getActiveMembershipForInternalCenter: () => ({ role: 'owner', status: 'active' }),
    getCurrentResolvedCenterId: () => 'local-center-a',
    getCurrentAttendanceBoardDraft: () => context.attendanceBoardDraft,
    centerSwitchDraftTracker: createCenterSwitchDraftTracker(),
    closeCenterBoundWorkspacesForSwitch: () => { calls.close++ },
    resetCloudRuntimeStateForOwnerCenterSwitch: () => { calls.reset++ },
    setCurrentStorageCenterId: () => { calls.destination++; throw stop },
    createInternalCenterSwitchState: () => ({}), render: () => {},
    window: { alert: () => { calls.alert++ }, confirm: () => { calls.confirm++; return false }, location: {} },
    isStaffSaving: false, isStaffDepartmentSaving: false, isStaffAdministrativeProfileSaving: false,
    isStaffAccountLinkSaving: false, isStaffLifecycleSaving: false, isTeacherStaffLinkSaving: false,
    savingStaffDocumentWindowIds: new Set(), uploadingStaffDocumentWindowIds: new Set(),
    savingStaffAdministrativeGovernanceWindowIds: new Set(), cloudUploadingTransactionId: '',
    reportChecklistController: null, authoritativeCoreSavesInFlight: new Set(),
    staffAdministrativeProfileWindowStates: new Map(), staffDocumentWindowStates: new Map(),
    isInventoryCycleCountPanelOpen: false, selectedInventoryCycleCountId: '',
    inventoryCycleCountObservedByLineId: {}, inventoryCycleCountExplanationByLineId: {}, inventoryCycleCountDueDate: '',
    attendanceBaselineDraftRecords: null, careNoteDrafts: {},
    runAuthoritativeCoreSaveCommand: runAuthoritativeCoreSave,
  })
  vm.createContext(context)
  for (const name of ['getCenterBoundDrafts', 'getCenterWritesInFlight', 'handleInternalOpenCenter']) {
    vm.runInContext(declaration(name), context)
  }
  if (/^async function runAuthoritativeCoreSave\(/m.test(source)) {
    vm.runInContext(declaration('runAuthoritativeCoreSave'), context)
  }
  const attempt = async () => {
    try { await context.handleInternalOpenCenter('local-center-b') }
    catch (error) { if (error !== stop) throw error }
    return { ...calls }
  }
  return { context, calls, attempt }
}
const results = []
async function blocked(name, configure) {
  const f = fixture()
  await configure(f.context)
  const calls = await f.attempt()
  const safe = calls.alert === 1 && calls.confirm === 0 && calls.close === 0 && calls.reset === 0 && calls.destination === 0
  results.push({ name, safe, calls })
  if (!observe) assert(safe, `${name}: pending authoritative write must block before draft confirmation or center reset`)
}
for (const name of ['a3TeacherDialogState', 'v26TeacherRegistryCapabilityState', 'v22StudentEnrollmentCapabilityState',
  'parentLinkReviewState', 'parentIdentityEditState', 'cashflowFormState', 'studentFormState',
  'c54FinanceSharedTruthState', 'v21CenterSettingsCapabilityState']) {
  await blocked(name, c => { c[name].isSaving = true })
}
await blocked('attendance batch', c => { c.attendanceBoardDraft.saving = true })
for (const name of ['isStaffAccountLinkSaving', 'isStaffLifecycleSaving', 'isTeacherStaffLinkSaving']) {
  await blocked(name, c => { c[name] = true })
}

// A real controller, with its RPC still pending, must be visible to the global guard.
let complete
const controller = createReportChecklistController({
  getContext: () => ({ centerId: 'local-center-a', accountId: 'local-owner' }), canWrite: () => true,
  getSupabase: () => ({ rpc: async (rpc, args) => rpc === 'n6_1_set_daily_checklist_item'
    ? new Promise(resolve => { complete = resolve })
    : { data: { ok: true, center_id: args.p_center_id, business_date: args.p_business_date,
      template_key: args.p_template_key, items: [] } } }),
})
await controller.select({ businessDate: '2026-10-06' })
const pending = controller.setCompleted('pt-01', true)
assert.equal(controller.getState().savingKey, 'pt-01')
await blocked('actual Checklist pending RPC', c => { c.reportChecklistController = controller })
complete({ error: { message: 'LOCAL MOCK FAILURE' } })
await pending
assert.equal(controller.getState().savingKey, '')
const idleChecklist = fixture()
idleChecklist.context.reportChecklistController = controller
assert.equal((await idleChecklist.attempt()).destination, 1, 'A settled checklist RPC must release the switch lock')

const dirty = fixture()
dirty.context.a3TeacherDialogState = { kind: 'occurrence', scheduleId: 'local-session', occurrenceDate: '2026-10-06', teacherId: 'teacher-a' }
dirty.context.centerSwitchDraftTracker.observe(dirty.context.getCenterBoundDrafts())
dirty.context.a3TeacherDialogState = { ...dirty.context.a3TeacherDialogState, teacherId: 'teacher-b' }
const dirtyCalls = await dirty.attempt()
const dirtySafe = dirtyCalls.confirm === 1 && dirtyCalls.destination === 0 && dirtyCalls.close === 0
results.push({ name: 'changed teacher-assignment draft: one cancel confirmation', safe: dirtySafe, calls: dirtyCalls })
if (!observe) assert(dirtySafe, 'An unsaved teacher assignment must not disappear silently on center switch')

if (!observe) {
  const core = fixture(), releases = []
  const operation = () => new Promise(resolve => releases.push(resolve))
  const options = { entityLabel: 'Local Student', executeCommand: operation, isContextCurrent: () => true,
    installCommittedEntity: () => {}, refreshProjection: async () => ({ ok: true }) }
  const first = core.context.runAuthoritativeCoreSave(options)
  const second = core.context.runAuthoritativeCoreSave(options)
  assert.equal((await core.attempt()).destination, 0, 'Core writes without an open form must also block switching')
  releases[0]({ ok: false, error: 'LOCAL MOCK FAILURE' })
  await first
  assert.equal(core.context.authoritativeCoreSavesInFlight.size, 1, 'One settlement must not release another pending write')
  releases[1]({ ok: false, error: 'LOCAL MOCK FAILURE' })
  await second
  assert.equal(core.context.authoritativeCoreSavesInFlight.size, 0)
  assert.equal((await core.attempt()).destination, 1)
  const exception = core.context.runAuthoritativeCoreSave({ ...options, executeCommand: async () => { throw Error('LOCAL MOCK THROW') } })
  await exception
  assert.equal(core.context.authoritativeCoreSavesInFlight.size, 0, 'Thrown commands must release the lock')
  results.push({ name: 'parallel core saves and exception release', safe: true })
}
console.log(JSON.stringify({ mode: observe ? 'FROZEN BASELINE OBSERVATION' : 'CURRENT FIX ASSERTIONS', networkCalls: 0, results }, null, 2))
if (!observe) console.log('N8_CENTER_SWITCH_WRITE_GUARD_SMOKE: PASS')
