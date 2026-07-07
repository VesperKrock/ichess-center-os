import fs from 'node:fs'
import path from 'node:path'

const rootDir = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(rootDir, filePath), 'utf8')
const exists = (filePath) => fs.existsSync(path.join(rootDir, filePath))

const docsPath = 'docs/fb-admin-dreamhome-vong-1-3-settings-parent-wiring.md'
const settingsPath = 'src/settings-module.js'
const parentPath = 'src/parent-consultation-module.js'
const mainPath = 'src/main.js'
const cloudBootstrapPath = 'src/cloud-bootstrap.js'
const cloudSyncPath = 'src/cloud-db-sync.js'
const studentPath = 'src/student-module.js'

const docs = read(docsPath)
const settings = read(settingsPath)
const parent = read(parentPath)
const main = read(mainPath)
const cloudBootstrap = read(cloudBootstrapPath)
const cloudSync = read(cloudSyncPath)
const student = read(studentPath)

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const requiredMarkers = [
  'FB ADMIN DREAMHOME STATUS: VONG 1 3 SETTINGS PARENT WIRING',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_MANUAL_QA',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'CENTER_CLASS_SETTINGS_CLOUD_WIRED: YES',
  'CENTER_CLASS_SETTINGS_SHARED_WITH_STUDENTS: YES',
  'CENTER_SETTINGS_INFO_TAB_ENABLED: YES',
  'CENTER_SETTINGS_TUITION_PACKAGE_TAB_ENABLED: YES',
  'CENTER_SETTINGS_SAMPLE_DATA_TAB_ENABLED: YES',
  'CENTER_SETTINGS_DEV_COPY_HIDDEN: YES',
  'PARENT_MODULE_DERIVED_FROM_STUDENTS: YES',
  'PARENT_CONTACTS_GROUPED_BY_PHONE: YES',
  'PARENT_CONTACT_DETAIL_LINKS_STUDENTS: YES',
  'PARENT_SEARCH_FILTER_WORKS: YES',
  'ATTENDANCE_BASELINE_LOGIC_DEFERRED: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]

assert(exists(docsPath), 'Docs feedback file must exist.')
requiredMarkers.forEach((marker) => {
  assert(docs.includes(marker), `Missing docs marker: ${marker}`)
})

;['Thông tin cơ sở', 'Ca học / Lớp', 'Gói học phí', 'Danh mục nhập liệu'].forEach((label) => {
  assert(settings.includes(label), `Settings tab missing: ${label}`)
})

;[
  'đã lên kế hoạch',
  'Cloud DB online core',
  'Angel Wings',
  'localStorage',
  'Đẩy local lên cloud',
  'Tải cloud về local',
  'Khôi phục',
].forEach((blockedText) => {
  assert(!settings.includes(blockedText), `Settings module still renders blocked text: ${blockedText}`)
})

assert(
  cloudBootstrap.includes("'class_session'") &&
    cloudSync.includes('CLOUD_ENTITY_TYPES.CLASS_SESSION') &&
    main.includes("queueCoreCloudSync('class-session-save')") &&
    main.includes("queueCoreCloudSync('class-session-status')"),
  'Class session settings must use existing class_session cloud bridge.',
)

assert(
  settings.includes('data-settings-class-session-action="open-create"') &&
    student.includes('classSessionIds') &&
    student.includes('renderClassSessionCheckboxes') &&
    student.includes('data-student-class-session-id') &&
    main.includes('classSessions = getStoredClassSessions'),
  'Student form must continue to read the shared class/session list.',
)

assert(
  parent.includes('buildDerivedParentContactsFromStudents') &&
    parent.includes('mergeParentContactsWithStudents') &&
    parent.includes('relatedStudents') &&
    parent.includes('isDerivedFromStudents'),
  'Parent module must derive contacts from students.',
)

assert(
  parent.includes('normalizePhone(phone)') &&
    parent.includes('fallback:${normalizeText(parentName)}'),
  'Parent contacts must group by phone or stable fallback.',
)

assert(
  parent.includes('data-parent-linked-student-id') &&
    main.includes('openStudentDetailWindow(studentId)'),
  'Parent contact detail must link back to student profiles.',
)

assert(
  parent.includes('contact.studentNames') &&
    parent.includes('contact.relatedStudents') &&
    parent.includes('student.fullName'),
  'Parent search/filter must include parent and student fields.',
)

const changedRuntimeFiles = [
  settingsPath,
  parentPath,
  mainPath,
  cloudBootstrapPath,
  cloudSyncPath,
]

changedRuntimeFiles.forEach((filePath) => {
  const source = read(filePath)
  assert(!/service_role|SUPABASE_SERVICE_ROLE|secret\s*=/i.test(source), `Potential secret exposure in ${filePath}`)
})

const forbiddenChangedPaths = [
  'supabase/functions',
  'sql',
  'migrations',
  'c8-teacher',
  'teacher-portal',
]

forbiddenChangedPaths.forEach((segment) => {
  assert(
    !changedRuntimeFiles.some((filePath) => filePath.toLowerCase().includes(segment)),
    `Forbidden path touched: ${segment}`,
  )
})

console.log('PASS fb-admin-dreamhome-vong-1-3-settings-parent-wiring smoke')
