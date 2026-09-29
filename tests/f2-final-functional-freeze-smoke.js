import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { renderCashbookModule } from '../src/cashbook-module.js'
import { renderParentConsultationModule } from '../src/parent-consultation-module.js'
import { renderSettingsModule } from '../src/settings-module.js'

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const between = (source, start, end) => {
  const from = source.indexOf(start)
  assert(from >= 0, `Missing ${start}`)
  const to = source.indexOf(end, from + start.length)
  assert(to > from, `Missing ${end}`)
  return source.slice(from, to)
}

const centerSwitch = between(main, 'async function handleInternalOpenCenter(centerId) {', '\nfunction normalizeInternalCenters(')
const coreReadAt = centerSwitch.indexOf('await bootstrapCoreCloudDataForCurrentCenter(switchSyncId)')
const currentCenterGuardAt = centerSwitch.indexOf("cloudUserSyncId !== switchSyncId || cloudStatus.membershipStatus !== 'loaded'", coreReadAt)
const tuitionRestartAt = centerSwitch.indexOf("refreshModuleAuthoritativeUpstreams('hoc-phi', { reason: 'center-switch' })", currentCenterGuardAt)
assert(coreReadAt >= 0 && currentCenterGuardAt > coreReadAt && tuitionRestartAt > currentCenterGuardAt)
assert(centerSwitch.slice(currentCenterGuardAt, tuitionRestartAt).includes("openWindows.some((item) => item.moduleId === 'hoc-phi')"))

const refreshSource = between(main, 'async function refreshTuitionOperatorSnapshot() {', '\nfunction getTuitionOperatorController()')
let centerId = 'center-a'
const pending = new Map()
const rendered = []
const context = createContext({
  getCurrentCanonicalCenterContext: () => ({ centerId }),
  getSupabaseClient: () => ({}),
  pullTuitionOperatorSnapshot: ({ centerId: requestedCenter }) => new Promise((resolve) => pending.set(requestedCenter, resolve)),
  queueNotificationAttentionRefresh: () => {},
  render: () => rendered.push({ ...context.f2Snapshot() }),
})
runInContext(`
  let tuitionOperatorReadRunId = 0
  let tuitionOperatorSnapshot = { status: 'idle', centerId: '' }
  ${refreshSource}
  globalThis.f2Refresh = refreshTuitionOperatorSnapshot
  globalThis.f2Snapshot = () => tuitionOperatorSnapshot
  globalThis.f2Invalidate = () => { tuitionOperatorReadRunId += 1; tuitionOperatorSnapshot = { status: 'idle', centerId: '' } }
`, context)

const oldRead = context.f2Refresh()
centerId = 'center-b'
context.f2Invalidate()
const currentRead = context.f2Refresh()
assert.equal(context.f2Snapshot().status, 'loading')
pending.get('center-b')({ ok: true, centerId: 'center-b', students: [{ id: 'b' }] })
await currentRead
assert.equal(context.f2Snapshot().status, 'ready')
assert.equal(context.f2Snapshot().students[0].id, 'b')
const rendersBeforeOldResult = rendered.length
pending.get('center-a')({ ok: true, centerId: 'center-a', students: [{ id: 'a' }] })
await oldRead
assert.equal(rendered.length, rendersBeforeOldResult)
assert.equal(context.f2Snapshot().centerId, 'center-b')

centerId = 'center-c'
context.f2Invalidate()
const failedRead = context.f2Refresh()
pending.get('center-c')({ ok: false, outcome_code: 'UNAVAILABLE' })
await failedRead
assert.equal(context.f2Snapshot().status, 'failed')
assert.equal(context.f2Snapshot().centerId, 'center-c')

const settings = renderSettingsModule([], [], undefined, null, {
  configStatus: 'configured', authStatus: 'signed-in', membershipStatus: 'loaded', role: 'admin', readinessStatus: 'ready',
}, { activeTab: 'center-info', centerInfo: { ok: true, centerId: 'phongtrong_prod', name: 'Phòng Trống', status: 'active', environment: 'production' } })
assert(settings.includes('Phòng Trống') && settings.includes('Đang hoạt động'))
for (const technical of ['phongtrong_prod', 'production', 'Dữ liệu cloud', '>active<', 'Mã cơ sở là định danh']) {
  assert(!settings.includes(technical), `Settings exposed ${technical}`)
}
const settingsEdit = renderSettingsModule([], [], undefined, null, null, {
  activeTab: 'center-info',
  centerInfo: { ok: true, centerId: 'phongtrong_prod', name: 'Phòng Trống', status: 'active', environment: 'production' },
  centerProfileFormState: { values: {}, errors: {} },
})
assert(settingsEdit.includes('Chỉnh sửa thông tin cơ sở'))
assert(!settingsEdit.includes('phongtrong_prod') && !settingsEdit.includes('Mã cơ sở:'))

const cashbook = renderCashbookModule([], '2026-09-29', undefined, null, [], null, {}, 'Phòng Trống')
assert(cashbook.includes('các giao dịch đã ghi nhận'))
assert(!cashbook.includes('giao dịch canonical'))
const attachmentNotice = between(main, 'function renderCashflowCloudAuthNotice(', '\nfunction getSettingsCloudDbPanelState()')
const noticeContext = createContext({
  isTransactionAttachmentRoleAllowed: () => true,
  formatRefreshTime: () => '09:00',
  escapeHtml: (value) => String(value),
})
runInContext(`${attachmentNotice}; globalThis.f2Notice = renderCashflowCloudAuthNotice`, noticeContext)
const notice = noticeContext.f2Notice(
  { authStatus: 'signed-in', user: { id: 'admin' }, membershipStatus: 'loaded', role: 'admin' },
  { isLoading: false, lastLoadedAt: '' },
)
assert(notice.includes('Có thể lưu ảnh chứng từ giao dịch.'))
const noticeText = notice.replace(/<[^>]*>/g, '')
assert(!/cloud/i.test(noticeText))

const customer = renderParentConsultationModule(
  [{ id: 'customer-a', parentName: 'Phụ huynh mẫu', phone: '0000000000', customerStage: 'lead' }],
  undefined, [], null, null, null, null, null, {}, { status: 'ready', moduleRefreshStatus: 'ready', links: [] },
)
assert(customer.includes('Giai đoạn / Trạng thái'))
assert(!/\bStage\b/.test(customer.replace(/<[^>]*>/g, '')))
const customerSource = readFileSync(new URL('../src/parent-consultation-module.js', import.meta.url), 'utf8')
for (const label of ['Giai đoạn khách hàng', 'Giai đoạn hiện tại', '<span>Giai đoạn</span>']) {
  assert(customerSource.includes(label))
}
assert(!/(?:'|>|\s)Stage(?:\s|<)/.test(customerSource))

console.log('F2 final functional freeze smoke: PASS')
