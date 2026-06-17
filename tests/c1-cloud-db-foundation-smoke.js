import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  CLOUD_ENTITY_TYPE_VALUES,
  CLOUD_ENTITY_TYPES,
  buildCloudEntityRecord,
  sanitizeCloudPayload,
} from '../src/cloud-db-entities.js'
import {
  classifyCloudDbError,
  getCloudDbReadinessMessage,
} from '../src/cloud-db-sync.js'
import {
  createCloudDbPullBackup,
} from '../src/storage.js'
import { renderSettingsModule } from '../src/settings-module.js'

assert.deepEqual(CLOUD_ENTITY_TYPE_VALUES, ['student', 'teacher', 'class_session'])

const recordResult = buildCloudEntityRecord({
  centerId: 'dreamhome',
  entityType: CLOUD_ENTITY_TYPES.STUDENT,
  localId: 'student-001',
  payload: {
    id: 'student-001',
    fullName: 'Học viên Cloud',
    avatarBase64: 'data:image/png;base64,abc',
    temporaryObjectUrl: 'blob:http://localhost/test',
  },
  userId: 'user-001',
})

assert.equal(recordResult.ok, true)
assert.equal(recordResult.data.center_id, 'dreamhome')
assert.equal(recordResult.data.entity_type, 'student')
assert.equal(recordResult.data.local_id, 'student-001')
assert.equal(recordResult.data.payload.fullName, 'Học viên Cloud')
assert.equal(recordResult.data.payload.avatarBase64, undefined)
assert.equal(recordResult.data.payload.temporaryObjectUrl, undefined)

const invalidType = buildCloudEntityRecord({
  centerId: 'dreamhome',
  entityType: 'tuition',
  localId: 'tuition-001',
  payload: { id: 'tuition-001' },
})
assert.equal(invalidType.ok, false)

const sanitized = sanitizeCloudPayload({
  note: 'ok',
  image: 'data:image/jpeg;base64,abc',
  nested: { keep: true },
})
assert.equal(sanitized.note, 'ok')
assert.equal(sanitized.image, undefined)
assert.deepEqual(sanitized.nested, { keep: true })

const sql = fs.readFileSync(new URL('../docs/supabase-c1-cloud-db-foundation.sql', import.meta.url), 'utf8')
assert(sql.includes('create table if not exists public.center_cloud_entities'))
assert(sql.includes('alter table public.center_cloud_entities enable row level security'))
assert(sql.includes('from public.center_members cm'))
assert(sql.includes("entity_type in ('student', 'teacher', 'class_session')"))
assert(!/to\s+anon/i.test(sql), 'SQL must not create anon policies')

const c22Sql = fs.readFileSync(
  new URL('../docs/supabase-c2-2-cloud-db-permissions-fix.sql', import.meta.url),
  'utf8',
)
assert(c22Sql.includes('grant usage on schema public to authenticated'))
assert(c22Sql.includes('grant select on public.center_members to authenticated'))
assert(c22Sql.includes('grant select, insert, update, delete on public.center_cloud_entities to authenticated'))
assert(c22Sql.includes('using (public.is_center_member(center_id))'))
assert(c22Sql.includes("notify pgrst, 'reload schema'"))
assert(!/to\s+anon/i.test(c22Sql), 'C2.2 SQL must not grant anon access')

const sourceFilesToScan = [
  '../src/cloud-db-entities.js',
  '../src/cloud-db-sync.js',
  '../src/main.js',
].map((path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'))
const combinedSource = sourceFilesToScan.join('\n')
assert(!combinedSource.includes('service_role'))
assert(!combinedSource.includes('auth.admin'))
assert(!combinedSource.includes('supabase.auth.admin'))
assert(!combinedSource.includes('localStorage.clear'))

const storage = new Map([
  ['ichessCenterOS.students.dreamhome', '[{"id":"student-001"}]'],
  ['ichessCenterOS.teachers.dreamhome', '[{"id":"teacher-001"}]'],
  ['ichessCenterOS.classSessions.dreamhome', '[{"id":"class-session-001"}]'],
])
const backupStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null
  },
  setItem(key, value) {
    storage.set(key, value)
  },
}
const backupKey = createCloudDbPullBackup(backupStorage)
assert(backupKey.startsWith('ichessCenterOS.backup.beforeCloudPull.'))
const backup = JSON.parse(storage.get(backupKey))
assert.equal(backup.reason, 'before-cloud-db-pull-c1')
assert.equal(backup.phase, 'c2-online-core')
assert.equal(backup.keys.students, '[{"id":"student-001"}]')
assert(!storage.has('ichessCenterOS.tuition.dreamhome'))
assert(!storage.has('ichessCenterOS.cashflow.dreamhome'))

const settingsHtml = renderSettingsModule(
  [],
  [],
  {},
  null,
  {
    configStatus: 'configured',
    authStatus: 'signed-in',
    membershipStatus: 'loaded',
    role: 'owner',
    readinessStatus: 'ready',
    localCounts: { student: 1, teacher: 1, class_session: 1 },
    cloudCounts: { student: 1, teacher: 1, class_session: 1 },
  },
)
assert(settingsHtml.includes('Cloud DB online core'))
assert(settingsHtml.includes('data-cloud-db-action="refresh"'))
assert(settingsHtml.includes('data-cloud-db-action="push"'))
assert(settingsHtml.includes('data-cloud-db-action="pull"'))
assert(settingsHtml.includes('<details class="settings-cloud-db-panel"'))

const objectMessageHtml = renderSettingsModule([], [], {}, null, {
  message: { detail: 'Cloud counts refreshed' },
})
assert(!objectMessageHtml.includes('[object Object]'))
assert(objectMessageHtml.includes('{&quot;detail&quot;:&quot;Cloud counts refreshed&quot;}'))

const blockedHtml = renderSettingsModule([], [], {}, null, {
  configStatus: 'configured',
  authStatus: 'signed-in',
  membershipStatus: 'loaded',
  role: 'owner',
  readinessStatus: 'error',
  cloudCounts: { student: 99, teacher: 99, class_session: 99 },
  message: { detail: 'not ready' },
})
assert(blockedHtml.includes('Học viên —'))
assert(blockedHtml.includes('data-cloud-db-action="push" disabled'))
assert(blockedHtml.includes('data-cloud-db-action="pull" disabled'))
assert(!blockedHtml.includes('[object Object]'))

const schemaError = classifyCloudDbError(
  { status: 400, code: '42703', message: 'column center_cloud_entities.deleted_at does not exist' },
)
assert.equal(schemaError.category, 'schema-not-ready')
assert.equal(
  getCloudDbReadinessMessage(schemaError),
  'Chưa chạy SQL C1/C2.2 hoặc bảng center_cloud_entities chưa sẵn sàng.',
)

const permissionError = classifyCloudDbError(
  { status: 403, code: '42501', message: 'permission denied for table center_cloud_entities' },
)
assert.equal(permissionError.category, 'cloud-permission-denied')
assert.equal(
  getCloudDbReadinessMessage(permissionError),
  'Không đọc được Cloud DB do quyền DreamHome/RLS. Kiểm tra GRANT authenticated, center_members và policy.',
)

console.log('C1 Cloud DB foundation smoke passed')
