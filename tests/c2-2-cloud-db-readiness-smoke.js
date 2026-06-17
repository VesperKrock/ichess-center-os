import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  classifyCloudDbError,
  getCloudDbReadinessMessage,
} from '../src/cloud-db-sync.js'
import { renderSettingsModule } from '../src/settings-module.js'

const sql = fs.readFileSync(
  new URL('../docs/supabase-c2-2-cloud-db-permissions-fix.sql', import.meta.url),
  'utf8',
)

assert(sql.includes('grant usage on schema public to authenticated'))
assert(sql.includes('grant select on public.center_members to authenticated'))
assert(sql.includes('grant select, insert, update, delete on public.center_cloud_entities to authenticated'))
assert(sql.includes('create policy "center members can select cloud entities"'))
assert(sql.includes('using (public.is_center_member(center_id))'))
assert(sql.includes("notify pgrst, 'reload schema'"))
assert(!/to\s+anon/i.test(sql), 'C2.2 SQL must not grant anon access')
assert(!sql.includes('service_role'))

const schemaError = classifyCloudDbError({
  status: 400,
  code: '42703',
  message: 'column center_cloud_entities.deleted_at does not exist',
})
assert.equal(schemaError.category, 'schema-not-ready')
assert.equal(
  getCloudDbReadinessMessage(schemaError),
  'Chưa chạy SQL C1/C2.2 hoặc bảng center_cloud_entities chưa sẵn sàng.',
)

const permissionError = classifyCloudDbError({
  status: 403,
  code: '42501',
  message: 'permission denied for table center_cloud_entities',
})
assert.equal(permissionError.category, 'cloud-permission-denied')
assert.equal(
  getCloudDbReadinessMessage(permissionError),
  'Không đọc được Cloud DB do quyền DreamHome/RLS. Kiểm tra GRANT authenticated, center_members và policy.',
)

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

const readyHtml = renderSettingsModule([], [], {}, null, {
  configStatus: 'configured',
  authStatus: 'signed-in',
  membershipStatus: 'loaded',
  role: 'owner',
  readinessStatus: 'ready',
  cloudCounts: { student: 2, teacher: 1, class_session: 3 },
  localAngelWingsStatus: {
    isReadyForCloudPush: true,
    studentCount: 29,
    classSessionCount: 4,
    hasTeacher: true,
  },
})
assert(readyHtml.includes('Học viên 2'))
assert(!readyHtml.includes('data-cloud-db-action="push" disabled'))
assert(!readyHtml.includes('data-cloud-db-action="pull" disabled'))

console.log('C2.2 Cloud DB readiness smoke passed')
