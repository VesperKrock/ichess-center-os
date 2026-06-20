import assert from 'node:assert/strict'
import fs from 'node:fs'

import { renderScheduleModule } from '../src/schedule-module.js'

const uiFiles = [
  '../src/main.js',
  '../src/schedule-module.js',
  '../src/notification-center.js',
  '../src/notifications.js',
  '../src/storage.js',
]

const mojibakePatterns = ['CĂ¡Âº', 'Ăƒ', 'Ă†Â°', 'HĂ¡Âº', 'GiĂƒ', 'bĂƒÂ¡o', 'cĂ¡ÂºÂ£nh', 'TĂ†Â°']
for (const filePath of uiFiles) {
  const source = fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')
  for (const pattern of mojibakePatterns) {
    assert(!source.includes(pattern), `${filePath} still contains mojibake pattern ${pattern}`)
  }
}

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
assert(mainSource.includes('renderNotificationCenterHotfix(getUnreadNotificationCount())'))
assert(mainSource.includes('function renderModuleNotificationBell'))
assert(mainSource.includes('class="module-notification-bell"'))
assert(mainSource.includes('Không có thông báo cho module này.'))

const hotfixStart = mainSource.indexOf('function renderNotificationCenterHotfix')
const legacyStart = mainSource.indexOf('function renderNotificationCenter(', hotfixStart)
const hotfixRenderer = mainSource.slice(hotfixStart, legacyStart)
assert(hotfixRenderer.includes('Trạng thái'))
assert(hotfixRenderer.includes('Chưa đọc'))
assert(hotfixRenderer.includes('Đã đọc'))
assert(!hotfixRenderer.includes('<span>Module</span>'))
assert(!hotfixRenderer.includes('Tất cả module'))
assert(!hotfixRenderer.includes('data-notification-filter="sourceModule"'))

const teachers = [{ id: 'teacher-hotfix', fullName: 'Giáo viên Hotfix' }]
const students = [{ id: 'student-hotfix', fullName: 'Học viên Hotfix' }]
const sessions = [
  {
    id: 'schedule-hotfix-001',
    scheduleType: 'oneOff',
    title: 'Ca kiểm tra chuông TKB',
    date: '2026-06-10',
    occurrenceDate: '2026-06-10',
    startTime: '19:00',
    endTime: '20:30',
    room: 'Phòng 1',
    teacherId: 'teacher-hotfix',
    studentIds: ['student-hotfix'],
    level: 'beginner',
    status: 'scheduled',
  },
]

const scheduleHtml = renderScheduleModule(
  sessions,
  null,
  null,
  [],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-08',
  null,
  {
    attendanceRecords: [],
    sessionReports: [],
    now: new Date(2026, 5, 17, 10, 0),
  },
)

for (const text of [
  'Cảnh báo',
  'Cảnh báo ca dạy',
  'Giáo viên trễ báo cáo',
  'Admin/Tư vấn cần kiểm tra',
  'Cần QTV/anh Hải chú ý',
]) {
  assert(scheduleHtml.includes(text), `TKB bell is missing clean text: ${text}`)
}
for (const pattern of mojibakePatterns) {
  assert(!scheduleHtml.includes(pattern), `TKB bell rendered mojibake pattern ${pattern}`)
}
assert(!scheduleHtml.includes('<section class="schedule-teacher-alerts"'))

const cleanScheduleHtml = renderScheduleModule(
  sessions,
  null,
  null,
  [{ sessionId: 'schedule-hotfix-001', occurrenceDate: '2026-06-10', learningGroups: [] }],
  null,
  null,
  null,
  null,
  false,
  null,
  teachers,
  students,
  '2026-06-08',
  null,
  {
    attendanceRecords: [],
    sessionReports: [],
    now: new Date(2026, 5, 10, 10, 0),
  },
)
assert(cleanScheduleHtml.includes('Không có ca cần cảnh báo.'))

const styles = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
assert(styles.includes('.module-notification-bell'))
assert(styles.includes('.module-notification-popover'))
assert(styles.includes('.notification-center-filters.is-status-only'))
assert(styles.includes('grid-template-columns: minmax(160px, 220px)'))

const cloudSources = [
  '../src/cloud-attendance-records.js',
  '../src/cloud-session-reports.js',
  '../src/cloud-schedule-sessions.js',
  '../src/cloud-tuition-records.js',
  '../src/cloud-tuition-terms.js',
].map((filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')).join('\n')
assert(cloudSources.includes('NEEDS SQL/ALLOWLIST PATCH'))

for (const forbiddenText of ['prototype', 'placeholder', 'sẽ triển khai', 'debug']) {
  assert(!hotfixRenderer.toLowerCase().includes(forbiddenText), `Notification UI includes ${forbiddenText}`)
}

console.log('F19H.2 hotfix notification mojibake va chuong module smoke passed')
