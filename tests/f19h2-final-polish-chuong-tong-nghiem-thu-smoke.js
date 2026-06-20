import assert from 'node:assert/strict'
import fs from 'node:fs'

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

const hotfixStart = mainSource.indexOf('function renderNotificationCenterHotfix')
const legacyStart = mainSource.indexOf('function renderNotificationCenter(', hotfixStart)
const hotfixRenderer = mainSource.slice(hotfixStart, legacyStart)

assert(hotfixRenderer.includes('buildNotificationModuleSummaries(visibleNotifications)'))
assert(hotfixRenderer.includes('notification-module-summary'))
assert(hotfixRenderer.includes('data-notification-module-id'))
assert(hotfixRenderer.includes('Trạng thái'))
assert(hotfixRenderer.includes('Không có thông báo chưa đọc.'))
assert(hotfixRenderer.includes('Không có thông báo.'))
assert(!hotfixRenderer.includes('<span>Module</span>'))
assert(!hotfixRenderer.includes('data-notification-filter="sourceModule"'))
assert(!hotfixRenderer.includes('Tất cả module'))

const summaryStart = mainSource.indexOf('function buildNotificationModuleSummaries')
const summaryEnd = mainSource.indexOf('function renderNotificationCenter(', summaryStart)
const summarySource = mainSource.slice(summaryStart, summaryEnd)

assert(summarySource.includes('sourceModule'))
assert(summarySource.includes('getNotificationModuleLabel'))
assert(summarySource.includes('buildNotificationModuleSummaryTitle'))
assert(summarySource.includes('cảnh báo'))
assert(summarySource.includes('thông báo'))
assert(summarySource.includes('mới'))
assert(summarySource.includes('Chi tiết nằm trong chuông riêng của module.'))
assert(summarySource.includes('modules.some((moduleItem) => moduleItem.id === sourceModule)'))

const moduleClickStart = mainSource.indexOf("document.querySelectorAll('[data-notification-module-id]')")
const moduleClickEnd = mainSource.indexOf("document.querySelectorAll('[data-notification-action=\"mark-read\"]')", moduleClickStart)
const moduleClickSource = mainSource.slice(moduleClickStart, moduleClickEnd)
assert(moduleClickSource.includes('openModuleWindow(moduleId)'))
assert(moduleClickSource.includes('isNotificationCenterOpen = false'))
assert(moduleClickSource.includes('modules.some((moduleItem) => moduleItem.id === moduleId)'))

assert(mainSource.includes('<details class="module-notification-bell"'))
assert(mainSource.includes('function bindModuleNotificationOutsidePointer()'))
assert(mainSource.includes('.module-notification-bell[open], .schedule-alert-bell[open]'))

assert(styles.includes('.notification-module-summary'))
assert(styles.includes('.notification-module-summary-header'))
assert(styles.includes('.notification-center-filters.is-status-only'))

for (const text of ['Học viên', 'Học phí', 'Kho hàng', 'Giáo viên', 'Thời khóa biểu']) {
  assert(mainSource.includes(text) || fs.readFileSync(new URL('../src/notification-center.js', import.meta.url), 'utf8').includes(text))
}

for (const pattern of ['CĂ¡Âº', 'Ăƒ', 'Ă†Â°', 'HĂ¡Âº']) {
  assert(!hotfixRenderer.includes(pattern), `Final notification renderer contains mojibake pattern ${pattern}`)
  assert(!summarySource.includes(pattern), `Final summary helpers contain mojibake pattern ${pattern}`)
}

for (const forbiddenText of ['prototype', 'placeholder', 'sẽ triển khai', 'debug']) {
  assert(!hotfixRenderer.toLowerCase().includes(forbiddenText), `Final notification renderer includes ${forbiddenText}`)
}

const cloudSources = [
  '../src/cloud-attendance-records.js',
  '../src/cloud-session-reports.js',
  '../src/cloud-schedule-sessions.js',
  '../src/cloud-tuition-records.js',
  '../src/cloud-tuition-terms.js',
].map((filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')).join('\n')
assert(cloudSources.includes('NEEDS SQL/ALLOWLIST PATCH'))

console.log('F19H.2 final polish chuong tong nghiem thu smoke passed')
