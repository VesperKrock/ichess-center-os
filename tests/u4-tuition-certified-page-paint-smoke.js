import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  createEditTuitionFormState,
  createEmptyTuitionFormState,
  createPaymentFormState,
  initialTuitionFilters,
  renderTuitionModule,
  resolveTuitionDomainUiState,
} from '../src/tuition-module.js'
import {
  applyModuleUpstreamRefreshResult,
  createLoadingModuleUpstreamHealth,
  getModuleUpstreamUiState,
} from '../src/module-authority-registry.js'

const repoRoot = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
const main = read('src/main.js')
const tuitionModule = read('src/tuition-module.js')
const tuitionTheme = read('src/tuition-theme.css')

const certifiedFigmaNodes = {
  list: ['202:4', '216:2'],
  updatePackage: ['232:4', '239:2'],
  assignPackage: ['252:2', '254:2'],
  careNotes: ['259:2', '260:16'],
  monthEndCare: ['267:5', '273:2'],
}

assert.deepEqual(Object.values(certifiedFigmaNodes).flat(), [
  '202:4', '216:2', '232:4', '239:2', '252:2', '254:2', '259:2', '260:16',
  '267:5', '273:2',
])

const students = Array.from({ length: 100 }, (_, index) => ({
  id: `qa-tuition-student-${index + 1}`,
  fullName: index === 0
    ? 'Học viên QA có tên rất dài để kiểm tra không va chạm cột và thao tác'
    : `Học viên QA ${index + 1}`,
  parentName: index === 0
    ? 'Phụ huynh QA có tên rất dài để kiểm tra hiển thị an toàn'
    : `Phụ huynh QA ${index + 1}`,
  parentPhone: `0909${String(index + 1).padStart(6, '0')}`,
  status: 'active',
  careNotes: index === 0
    ? [{ id: 'qa-note-1', content: 'Ghi chú chăm sóc QA dài nhưng không được làm vỡ bố cục.', tags: ['Học phí'], sourceModule: 'tuition' }]
    : [],
}))

const tuitionRecords = students.slice(0, 50).map((student, index) => ({
  id: `qa-tuition-${index + 1}`,
  studentId: student.id,
  packageName: index === 0
    ? 'Gói học phí QA có tên rất dài để kiểm tra cột và modal'
    : 'Gói 8 buổi QA',
  totalSessions: 8,
  usedSessions: index % 8,
  totalAmount: 987_654_321 + index * 100_000,
  paidAmount: 0,
  discountType: 'none',
  discountValue: 0,
  discountAmount: 0,
  dueDate: '2026-08-30',
  note: index === 0 ? 'Nội dung ghi chú gói rất dài dùng riêng cho kiểm thử trình bày.' : '',
  currentTermId: `qa-term-${index + 1}`,
  currentTermNumber: 1,
  payments: [],
  termHistory: [],
}))

const availability = {
  attendanceAvailable: true,
  calendarNotesAvailable: true,
  financeAvailable: true,
  canVoidPayments: true,
}

const render = ({
  form = null,
  payment = null,
  rollback = null,
  care = null,
  advisory = null,
  availabilityOverrides = {},
} = {}) => renderTuitionModule(
  students,
  tuitionRecords,
  initialTuitionFilters,
  form,
  payment,
  null,
  [],
  [],
  '2026-08',
  rollback,
  [],
  care,
  advisory,
  [],
  'qa-center',
  null,
  {},
  { ...availability, ...availabilityOverrides },
)

const listHtml = render()
assert.equal((listHtml.match(/class="tuition-clickable-row/g) || []).length, 100)
assert.equal((listHtml.match(/<th>/g) || []).length, 7)
assert(!listHtml.includes('Theo dõi gói học, tiến độ buổi và công nợ học viên'), 'PO-approved compact list must not repeat the window heading')
for (const token of [
  'data-tuition-filter="query"',
  'data-tuition-filter="status"',
  'data-tuition-filter="package"',
  'data-tuition-action="open-advisory-window"',
  'data-tuition-action="open-debt"',
  'data-tuition-action="open-detail"',
  'data-tuition-action="open-rollback-preview"',
  'data-tuition-action="open-care-notes"',
  'tuition-package-action',
  'Học viên QA có tên rất dài',
  '987.654.321',
]) assert(listHtml.includes(token), `Tuition list is missing ${token}`)

assert(!listHtml.includes('Đức Tài'), 'Figma sample students must not enter runtime truth')
assert(!listHtml.includes('2.500.000 VNĐ'), 'Figma sample amounts must not enter runtime truth')

assert.equal(resolveTuitionDomainUiState('idle', true), 'idle')
assert.equal(resolveTuitionDomainUiState('loading', false), 'loading')
assert.equal(resolveTuitionDomainUiState('ready', false), 'ready')
assert.equal(resolveTuitionDomainUiState('failed', true), 'failed')

const loadingAvailability = {
  coreStatus: 'ready',
  tuitionStatus: 'ready',
  attendanceStatus: 'loading',
  attendanceAvailable: false,
  calendarNotesStatus: 'loading',
  calendarNotesAvailable: false,
  financeStatus: 'loading',
  financeAvailable: false,
  canVoidPayments: false,
}
const loadingHtml = render({ availabilityOverrides: loadingAvailability })
for (const token of [
  'data-tuition-attendance-state="loading"',
  'data-tuition-notes-state="loading"',
  'data-tuition-finance-state="loading"',
  'Đang tải đối chiếu điểm danh...',
  'Đang tải ghi chú chăm sóc theo tháng và ghi chú điểm danh...',
  'Đang tải số đã thu và dữ liệu thanh toán...',
  'Đang tải…',
]) assert(loadingHtml.includes(token), `Pending Tuition UI is missing ${token}`)
for (const falseFailure of [
  'Đối chiếu điểm danh hiện chưa tải được',
  'Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng',
  'Số đã thu và dữ liệu thanh toán hiện chưa tải được',
  '>Chưa tải<',
]) assert(!loadingHtml.includes(falseFailure), `Pending Tuition UI must not show ${falseFailure}`)

const financeFailedHtml = render({
  availabilityOverrides: {
    ...loadingAvailability,
    attendanceStatus: 'ready',
    attendanceAvailable: true,
    calendarNotesStatus: 'ready',
    calendarNotesAvailable: true,
    financeStatus: 'failed',
  },
})
assert(financeFailedHtml.includes('tuition-domain-notice is-error'))
assert(financeFailedHtml.includes('Số đã thu và dữ liệu thanh toán hiện chưa tải được'))
assert(!financeFailedHtml.includes('Đang tải số đã thu và dữ liệu thanh toán...'))

const attendanceFailedHtml = render({
  availabilityOverrides: {
    ...availability,
    attendanceStatus: 'failed',
    attendanceAvailable: false,
    calendarNotesStatus: 'ready',
    financeStatus: 'ready',
  },
})
assert(attendanceFailedHtml.includes('tuition-domain-notice is-warning'))
assert(attendanceFailedHtml.includes('Đối chiếu điểm danh hiện chưa tải được'))
assert(attendanceFailedHtml.includes('data-tuition-action="open-debt"'))

const notesFailedHtml = render({
  availabilityOverrides: {
    ...availability,
    attendanceStatus: 'ready',
    calendarNotesStatus: 'failed',
    calendarNotesAvailable: false,
    financeStatus: 'ready',
  },
})
assert(notesFailedHtml.includes('c57-shared-truth-notice is-warning'))
assert(notesFailedHtml.includes('Ghi chú chăm sóc theo tháng và ghi chú điểm danh hiện chưa khả dụng. Ghi chú học viên vẫn dùng được.'))
assert(notesFailedHtml.includes('data-tuition-action="open-care-notes"'))
assert(notesFailedHtml.includes('data-tuition-action="open-debt"'))

const packageWhileFinanceLoadingHtml = render({
  form: createEditTuitionFormState(students[0], tuitionRecords[0]),
  availabilityOverrides: loadingAvailability,
})
assert(packageWhileFinanceLoadingHtml.includes('data-tuition-action="save-form"'))
assert(!/data-tuition-action="save-form"[^>]*disabled/.test(packageWhileFinanceLoadingHtml))
assert(packageWhileFinanceLoadingHtml.includes('Đang tải số đã thu và dữ liệu thanh toán...'))

const paymentWhileFinanceLoadingHtml = render({
  payment: {
    ...createPaymentFormState(students[0], tuitionRecords[0]),
    values: {
      ...createPaymentFormState(students[0], tuitionRecords[0]).values,
      amount: '123456',
    },
  },
  availabilityOverrides: loadingAvailability,
})
assert(paymentWhileFinanceLoadingHtml.includes('data-tuition-payment-form'))
assert(/data-tuition-payment-action="save-payment"[^>]*disabled/.test(paymentWhileFinanceLoadingHtml))
assert(paymentWhileFinanceLoadingHtml.includes('Thông tin bạn nhập vẫn được giữ nguyên'))
assert(paymentWhileFinanceLoadingHtml.includes('value="123456"'))

const paymentReadyHtml = render({
  payment: createPaymentFormState(students[0], tuitionRecords[0]),
  availabilityOverrides: {
    ...availability,
    coreStatus: 'ready',
    tuitionStatus: 'ready',
    attendanceStatus: 'ready',
    calendarNotesStatus: 'ready',
    financeStatus: 'ready',
  },
})
assert(/data-tuition-payment-action="save-payment"/.test(paymentReadyHtml))
assert(!/data-tuition-payment-action="save-payment"[^>]*disabled/.test(paymentReadyHtml))

const upstreams = ['core', 'tuition', 'attendance', 'calendar-notes', 'finance']
const makeLoadingRefreshState = (centerId = 'qa-center', contextKey = 'owner:qa-center') => ({
  status: 'loading',
  centerId,
  contextKey,
  upstreams,
  upstreamHealth: createLoadingModuleUpstreamHealth(upstreams),
})
const settle = (state, upstream, ok, outcomeCode = ok ? 'OK' : 'QA_FAILURE') => (
  applyModuleUpstreamRefreshResult(state, {
    upstream,
    ok,
    outcome_code: outcomeCode,
  })
)
const primeRequiredAndOptional = (state) => ['core', 'tuition', 'attendance', 'calendar-notes']
  .reduce((nextState, upstream) => settle(nextState, upstream, true), state)

function createDeferred() {
  let resolve
  const promise = new Promise((settlePromise) => { resolve = settlePromise })
  return { promise, resolve }
}

let refreshState = primeRequiredAndOptional(makeLoadingRefreshState())
assert.equal(getModuleUpstreamUiState(refreshState, 'finance'), 'loading')
const delayedFinanceSuccess = createDeferred()
const financeSuccessRun = delayedFinanceSuccess.promise.then((result) => {
  refreshState = settle(refreshState, 'finance', result.ok, result.outcome_code)
})
assert(render({ availabilityOverrides: loadingAvailability }).includes('Đang tải số đã thu'))
delayedFinanceSuccess.resolve({ ok: true, outcome_code: 'OK' })
await financeSuccessRun
assert.equal(getModuleUpstreamUiState(refreshState, 'finance'), 'ready')
const financeReadyHtml = render({
  availabilityOverrides: {
    ...availability,
    attendanceStatus: 'ready',
    calendarNotesStatus: 'ready',
    financeStatus: 'ready',
  },
})
assert(!financeReadyHtml.includes('Đang tải số đã thu'))
assert(!financeReadyHtml.includes('Số đã thu và dữ liệu thanh toán hiện chưa tải được'))
assert(financeReadyHtml.includes('data-tuition-action="open-debt"'))

refreshState = primeRequiredAndOptional(makeLoadingRefreshState())
const delayedFinanceFailure = createDeferred()
const financeFailureRun = delayedFinanceFailure.promise.then((result) => {
  refreshState = settle(refreshState, 'finance', result.ok, result.outcome_code)
})
assert.equal(getModuleUpstreamUiState(refreshState, 'finance'), 'loading')
delayedFinanceFailure.resolve({ ok: false, outcome_code: 'QA_DELAYED_FAILURE' })
await financeFailureRun
assert.equal(getModuleUpstreamUiState(refreshState, 'finance'), 'failed')

for (const [upstream, shouldSucceed] of [
  ['attendance', true],
  ['attendance', false],
  ['calendar-notes', true],
  ['calendar-notes', false],
]) {
  refreshState = makeLoadingRefreshState()
  for (const readyUpstream of upstreams.filter((item) => item !== upstream)) {
    refreshState = settle(refreshState, readyUpstream, true)
  }
  const delayedOptional = createDeferred()
  const optionalRun = delayedOptional.promise.then((result) => {
    refreshState = settle(refreshState, upstream, result.ok, result.outcome_code)
  })
  assert.equal(getModuleUpstreamUiState(refreshState, upstream), 'loading')
  delayedOptional.resolve({
    ok: shouldSucceed,
    outcome_code: shouldSucceed ? 'OK' : 'QA_OPTIONAL_FAILURE',
  })
  await optionalRun
  assert.equal(
    getModuleUpstreamUiState(refreshState, upstream),
    shouldSucceed ? 'ready' : 'failed',
  )
  assert.equal(getModuleUpstreamUiState(refreshState, 'core'), 'ready')
  assert.equal(getModuleUpstreamUiState(refreshState, 'tuition'), 'ready')
}

let currentRunId = 1
let currentCenterId = 'qa-center'
refreshState = primeRequiredAndOptional(makeLoadingRefreshState(currentCenterId, 'owner:qa-center'))
const applyGuarded = ({ runId, centerId, result }) => {
  if (runId !== currentRunId || centerId !== currentCenterId) return false
  refreshState = settle(refreshState, result.upstream, result.ok, result.outcome_code)
  return true
}
const oldFinanceResponse = createDeferred()
const oldRun = oldFinanceResponse.promise.then((result) => applyGuarded({
  runId: 1,
  centerId: 'qa-center',
  result: { upstream: 'finance', ...result },
}))
currentRunId = 2
refreshState = primeRequiredAndOptional(makeLoadingRefreshState(currentCenterId, 'owner:qa-center'))
assert(applyGuarded({
  runId: 2,
  centerId: 'qa-center',
  result: { upstream: 'finance', ok: true, outcome_code: 'NEWER_OK' },
}))
oldFinanceResponse.resolve({ ok: false, outcome_code: 'OLDER_FAILURE' })
assert.equal(await oldRun, false)
assert.equal(getModuleUpstreamUiState(refreshState, 'finance'), 'ready')

currentCenterId = 'qa-center-b'
refreshState = makeLoadingRefreshState(currentCenterId, 'admin:qa-center-b')
assert.equal(applyGuarded({
  runId: 2,
  centerId: 'qa-center',
  result: { upstream: 'finance', ok: true, outcome_code: 'OLD_CENTER_OK' },
}), false)
assert.equal(getModuleUpstreamUiState(refreshState, 'finance'), 'loading')

const updateHtml = render({
  form: createEditTuitionFormState(students[0], tuitionRecords[0]),
})
for (const token of [
  'data-tuition-form',
  'Cập nhật gói học phí',
  'aria-label="Thiết lập gói"',
  'data-tuition-package-suggestion="8"',
  'data-tuition-form-field="packageName"',
  'data-tuition-form-field="totalSessions"',
  'data-tuition-form-field="usedSessions"',
  'data-tuition-form-field="totalAmount"',
  'data-tuition-form-field="dueDate"',
  'data-tuition-form-field="note"',
  'data-tuition-action="cancel-form"',
  'data-tuition-action="save-form"',
  'data-tuition-action="open-renew"',
  'data-tuition-action="open-undo-empty-period"',
]) assert(updateHtml.includes(token), `Update package dialog is missing ${token}`)
assert(updateHtml.includes('data-preserve-scroll-key="qa-tuition-student-1:edit"'))

const assignHtml = render({
  form: createEmptyTuitionFormState(students[99]),
})
assert(assignHtml.includes('Gán gói học phí'))
assert(assignHtml.includes('Lưu gói'))
assert(!assignHtml.includes('data-tuition-action="open-renew"'))
assert(assignHtml.includes('data-preserve-scroll-key="qa-tuition-student-100:create"'))

const careHtml = render({
  care: {
    studentId: students[0].id,
    values: { tag: 'Học phí QA', content: 'Nội dung draft QA cần được giữ nguyên' },
    error: '',
    saveState: '',
  },
})
for (const token of [
  'Lịch sử ghi chú chăm sóc',
  'Thêm ghi chú chăm sóc',
  'data-tuition-care-note-field="tag"',
  'data-tuition-care-note-field="content"',
  'data-tuition-care-note-suggestion=',
  'data-tuition-care-note-action="save"',
  'data-tuition-care-note-action="clear"',
  'data-tuition-care-note-action="close"',
  'Nội dung draft QA cần được giữ nguyên',
]) assert(careHtml.includes(token), `Care / Notes dialog is missing ${token}`)

const monthEndHtml = render({ advisory: { isOpen: true } })
assert.equal((monthEndHtml.match(/data-tuition-advisory-row=/g) || []).length, 100)
for (const token of [
  'Bảng chăm sóc cuối tháng',
  'Tự tổng hợp từ điểm danh + học phí',
  'Không ghi ngược vào gói học phí',
  'data-tuition-advisory-care-status=',
  'data-tuition-advisory-note=',
  'data-tuition-advisory-action="save"',
  'data-tuition-advisory-window-action="close"',
]) assert(monthEndHtml.includes(token), `Month-end care dialog is missing ${token}`)

const rollbackHtml = render({
  rollback: {
    status: 'ready',
    message: 'Đã tải lịch sử thay đổi.',
    previews: Array.from({ length: 24 }, (_, index) => ({
      action: 'update',
      auditCreatedAt: `2026-08-${String((index % 24) + 1).padStart(2, '0')}T08:00:00.000Z`,
      actorRole: index % 2 ? 'admin' : 'owner',
      entityLocalId: `qa-tuition-${index + 1}`,
      changedFields: ['packageName', 'totalAmount'],
      diffSummary: [
        { field: 'packageName', before: 'Gói cũ QA', after: 'Gói mới QA' },
        { field: 'totalAmount', before: '1000000', after: '1200000' },
      ],
    })),
  },
})
assert.equal((rollbackHtml.match(/class="tuition-rollback-preview-item"/g) || []).length, 24)
for (const token of [
  'Lịch sử thay đổi',
  'Bản xem trước khôi phục',
  'Trước thay đổi',
  'Sau thay đổi',
  'data-tuition-rollback-preview-action="close"',
]) assert(rollbackHtml.includes(token), `History dialog is missing ${token}`)

for (const token of [
  "import './tuition-theme.css'",
  "windowItem.moduleId === 'hoc-phi'",
  "isTuitionWindow ? 'is-tuition-window' : ''",
  "document.querySelectorAll('[data-tuition-row-student-id]')",
  "document.querySelectorAll('[data-tuition-action=\"open-debt\"]')",
  "document.querySelectorAll('[data-tuition-action=\"open-care-notes\"]')",
  "document.querySelectorAll('[data-tuition-action=\"open-advisory-window\"]')",
  "document.querySelector('[data-tuition-form]')?.addEventListener('submit'",
  "document.querySelector('[data-tuition-payment-form]')?.addEventListener('submit'",
  "document.querySelectorAll('[data-tuition-payment-void]')",
  "areModuleActionUpstreamsCurrent('hoc-phi', 'payment')",
  'upstreamHealth: createLoadingModuleUpstreamHealth(upstreams)',
  'recordModuleUpstreamRefreshResult(moduleId, refreshId, centerContext.centerId, contextKey, settledResult)',
  "currentState?.status !== 'loading'",
  'currentState?.contextKey !== contextKey',
  'refreshId !== moduleRefreshRunIds.get(moduleId)',
]) assert(main.includes(token), `Runtime wiring is missing ${token}`)

for (const token of [
  '.desktop-window.is-tuition-window .tuition-module',
  '.desktop-window.is-tuition-window > .window-titlebar',
  '.tuition-table-wrap',
  'position: sticky;',
  'scrollbar-gutter: stable;',
  '.tuition-form-backdrop',
  '.tuition-form-panel',
  '.tuition-domain-notice',
  '.tuition-domain-notice.is-loading',
  '.tuition-domain-notice.is-warning',
  '.tuition-domain-notice.is-error',
  'opacity: 1;',
  '.tuition-care-note-panel',
  '.tuition-rollback-preview-note',
  '.tuition-rollback-preview-diff dd span',
  'font-size: 24px;',
  'font-size: 28px;',
  'font-size: 18px;',
  '.tuition-advisory-table-wrap',
  '@media (max-width: 1280px)',
  '@media (max-width: 1080px)',
  '@media (max-width: 760px)',
]) assert(tuitionTheme.includes(token), `Tuition theme is missing ${token}`)

assert(!/\bzoom\s*:|transform\s*:\s*scale\(/i.test(tuitionTheme))
assert(!/^\s*\.taskbar\b/m.test(tuitionTheme), 'U4 must not style the runtime taskbar')
assert(!/^\s*\.window-titlebar\b/m.test(tuitionTheme), 'U4 titlebar polish must remain Tuition-scoped')
assert(/\.desktop-window\.is-tuition-window > \.window-titlebar h2\s*\{[\s\S]*?font-size:\s*13px;/.test(tuitionTheme), 'Tuition titlebar must preserve the current Figma 13px chrome title')
assert(/\.desktop-window\.is-tuition-window \.tuition-form-header h4\s*\{[\s\S]*?font-size:\s*24px;/.test(tuitionTheme), 'Tuition modal title must match the current Figma 24px title')
assert(/\.desktop-window\.is-tuition-window \.tuition-advisory-window-panel \.tuition-form-header h4\s*\{[\s\S]*?font-size:\s*28px;/.test(tuitionTheme), 'Month-end modal title must match the current Figma 28px title')
assert(!/\.tuition-form-panel\s*\{[^}]*opacity:\s*(?:0|0?\.[0-9]+)/s.test(tuitionTheme), 'Active Tuition modal foreground must not inherit reduced opacity')
assert(!/localStorage|sessionStorage/.test(tuitionModule), 'Tuition renderer must not add browser business authority')
assert(!/supabase|\.rpc\(|insert\(|update\(|delete\(/i.test(tuitionModule), 'Tuition renderer must not mutate server contracts')

function channelToLinear(channel) {
  const normalized = channel / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16))
  return channels.map(channelToLinear).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

for (const [foreground, background, label] of [
  ['#111827', '#ffffff', 'light primary'],
  ['#4b5563', '#ffffff', 'light secondary'],
  ['#6b7280', '#ffffff', 'light placeholder'],
  ['#047857', '#ffffff', 'light positive'],
  ['#b45309', '#ffffff', 'light warning'],
  ['#b91c1c', '#ffffff', 'light danger'],
  ['#f4f4f5', '#14171c', 'dark primary'],
  ['#c7cbd1', '#14171c', 'dark secondary'],
  ['#9ca3af', '#14171c', 'dark placeholder'],
  ['#34d399', '#14171c', 'dark positive'],
  ['#fbbf24', '#14171c', 'dark warning'],
  ['#f87171', '#14171c', 'dark danger'],
  ['#4b5563', '#fafafb', 'light loading notice'],
  ['#b45309', '#fef3c7', 'light optional failure notice'],
  ['#b91c1c', '#fef2f2', 'light finance failure notice'],
  ['#c7cbd1', '#171a20', 'dark loading notice'],
  ['#fbbf24', '#3a2400', 'dark optional failure notice'],
  ['#f87171', '#3a1d20', 'dark finance failure notice'],
  ['#374151', '#f3f4f6', 'light Tuition titlebar'],
  ['#d1d5db', '#171a20', 'dark Tuition titlebar'],
]) assert(contrast(foreground, background) >= 4.5, `${label} contrast must be >= 4.5`)

for (const [indicator, background, label] of [
  ['#047857', '#ffffff', 'light positive indicator'],
  ['#b45309', '#ffffff', 'light warning indicator'],
  ['#b91c1c', '#ffffff', 'light danger indicator'],
  ['#34d399', '#14171c', 'dark positive indicator'],
  ['#fbbf24', '#14171c', 'dark warning indicator'],
  ['#f87171', '#14171c', 'dark danger indicator'],
]) assert(contrast(indicator, background) >= 3, `${label} contrast must be >= 3`)

console.log('U4 tuition certified page paint smoke passed')
