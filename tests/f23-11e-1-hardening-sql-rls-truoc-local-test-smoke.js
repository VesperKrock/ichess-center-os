import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(root, filePath), 'utf8')

const migrationsDirectory = path.join(root, 'supabase/migrations')
const supCfMigrationPath =
  'supabase/migrations/202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql'
const staffMigrationPath =
  'supabase/migrations/202607280001_f23_11e_staff_document_private_attachments.sql'
const supCfMigration = read(supCfMigrationPath)
const staffMigration = read(staffMigrationPath)
const staffAdapter = read('src/staff-document-attachments-supabase.js')
const transactionAdapter = read('src/transaction-attachments.js')
const storageAdapter = read('src/supabase-storage.js')
const docs = read('docs/f23-11e-1-hardening-sql-rls-truoc-local-test.md')

const supCfHeader =
  'SUP-CF.1 - Transaction evidence owner/center_admin access policies.'
const headerMatches = fs.readdirSync(migrationsDirectory)
  .filter((fileName) => fileName.endsWith('.sql'))
  .filter((fileName) => read(`supabase/migrations/${fileName}`).includes(supCfHeader))
assert.deepEqual(headerMatches, [path.basename(supCfMigrationPath)])

const owner = membership('user-owner', 'dreamhome_prod', 'owner', 'active')
const admin = membership('user-admin', 'dreamhome_prod', ' center-admin ', ' ACTIVE ')
const teacher = membership('user-teacher', 'dreamhome_prod', 'teacher', 'active')
const consultant = membership('user-consultant', 'dreamhome_prod', 'consultant', 'active')
const inactiveOwner = membership('user-owner', 'dreamhome_prod', 'owner', 'inactive')
const nullStatusOwner = membership('user-owner', 'dreamhome_prod', 'owner', null)

assert.equal(canManage(owner, 'user-owner', 'dreamhome_prod'), true)
assert.equal(canManage(admin, 'user-admin', 'dreamhome_prod'), true)
assert.equal(canManage(teacher, 'user-teacher', 'dreamhome_prod'), false)
assert.equal(canManage(consultant, 'user-consultant', 'dreamhome_prod'), false)
assert.equal(canManage(inactiveOwner, 'user-owner', 'dreamhome_prod'), false)
assert.equal(canManage(nullStatusOwner, 'user-owner', 'dreamhome_prod'), false)
assert.equal(canManage(owner, 'user-owner', 'dreamhome'), false)
assert.equal(canManage(owner, '', 'dreamhome_prod'), false)

const availableAttachment = staffAttachment({ state: 'available' })
const pendingAttachment = staffAttachment({ state: 'pending' })
assert.equal(canReadStaffObject(availableAttachment, owner, 'user-owner'), true)
assert.equal(canReadStaffObject(availableAttachment, admin, 'user-admin'), true)
assert.equal(canReadStaffObject(pendingAttachment, owner, 'user-owner'), true)
assert.equal(canReadStaffObject(pendingAttachment, admin, 'user-admin'), false)
assert.equal(canReadStaffObject(
  staffAttachment({ state: 'failed' }),
  owner,
  'user-owner',
), false)
assert.equal(canReadStaffObject(
  staffAttachment({ state: 'available', archivedAt: '2026-07-28T00:00:00Z' }),
  owner,
  'user-owner',
), false)
assert.equal(canReadStaffObject(availableAttachment, teacher, 'user-teacher'), false)
assert.equal(canReadStaffObject(availableAttachment, consultant, 'user-consultant'), false)
assert.equal(canReadStaffObject(availableAttachment, inactiveOwner, 'user-owner'), false)
assert.equal(canReadStaffObject(availableAttachment, owner, 'other-user'), false)
assert.equal(canReadStaffObject(
  staffAttachment({ centerId: 'other-center' }),
  owner,
  'user-owner',
), false)
assert.equal(canReadStaffObject(
  staffAttachment({
    objectPath: 'centers/dreamhome_prod/wrong-object.pdf',
    storageObjectPath:
      'centers/dreamhome_prod/staff/s-1/documents/d-1/a-1/attachment.pdf',
  }),
  owner,
  'user-owner',
), false)

assert.equal(canInsertStaffObject(pendingAttachment, owner, 'user-owner'), true)
assert.equal(canInsertStaffObject(availableAttachment, owner, 'user-owner'), false)
assert.equal(canInsertStaffObject(
  staffAttachment({
    objectPath: 'centers/dreamhome_prod/staff/s-1/wrong.pdf',
    storageObjectPath:
      'centers/dreamhome_prod/staff/s-1/documents/d-1/a-1/attachment.pdf',
  }),
  owner,
  'user-owner',
), false)

const pendingSelectPolicy = policyBlock(
  staffMigration,
  'create policy "f23_11e read staff document objects by center role"',
  'create policy "f23_11e insert staff document objects by pending metadata"',
)
assert(pendingSelectPolicy.includes("a.state = 'available'"))
assert(pendingSelectPolicy.includes("a.state = 'pending'"))
assert(pendingSelectPolicy.includes('a.uploaded_by_user_id = auth.uid()'))
assert(pendingSelectPolicy.includes('a.object_path = storage.objects.name'))
assert(pendingSelectPolicy.includes('a.archived_at is null'))
assert(!pendingSelectPolicy.includes("a.state = 'failed'"))
assert(!pendingSelectPolicy.includes("a.state = 'archived'"))
assert(!staffMigration.includes('create policy "f23_11e update staff document objects"'))
assert(!staffMigration.includes('create policy "f23_11e delete staff document objects"'))
assert(!staffMigration.includes('public = true'))
assert(staffMigration.includes('public = false'))
assert(staffAdapter.includes('upsert: false'))
assert(!staffAdapter.includes('getPublicUrl'))
assert(!staffAdapter.includes('localStorage'))
assert(!staffAdapter.includes('sessionStorage'))

assert(supCfMigration.includes("lower(btrim(coalesce(cm.status::text, ''))) = 'active'"))
assert(!supCfMigration.includes("coalesce(cm.status, 'active')"))
assert(supCfMigration.includes("in ('owner', 'center_admin')"))
assert(supCfMigration.includes("set search_path = ''"))
assert(!supCfMigration.includes('set search_path = public'))

const canonicalPath =
  'dreamhome_prod/transaction-images/2026/07/TC-20260728-0001-01.jpg'
assert.equal(isValidTransactionPath('dreamhome_prod', canonicalPath), true)
assert.equal(isValidTransactionPath(
  'dreamhomeXprod',
  canonicalPath,
), false)
assert.equal(isValidTransactionPath(
  'dreamhome_prod',
  'dreamhome_prod/transaction-images/2026/13/file.jpg',
), false)
assert.equal(isValidTransactionPath(
  'dreamhome_prod',
  'dreamhome_prod/transaction-images/2026/07/nested/file.jpg',
), false)
assert(supCfMigration.includes(
  "split_part(requested_storage_path, '/', 1) = requested_center_id",
))
assert(supCfMigration.includes(
  "array_length(string_to_array(requested_storage_path, '/'), 1) = 5",
))
assert(!/storage_path\s+like\s+center_id/i.test(supCfMigration))
assert(!/\blike\s+requested_center_id/i.test(supCfMigration))

for (const prerequisite of [
  'SUP-CF.1 prerequisite missing: public.transaction_attachments',
  'SUP-CF.1 prerequisite missing: public.center_members',
  'SUP-CF.1 prerequisite missing: storage.buckets',
  'SUP-CF.1 prerequisite missing: storage.objects',
  'SUP-CF.1 prerequisite missing: transaction-images bucket',
  'SUP-CF.1 prerequisite missing columns on public.transaction_attachments',
  'SUP-CF.1 prerequisite missing columns on public.center_members',
]) assert(supCfMigration.includes(prerequisite), `Missing prerequisite gate: ${prerequisite}`)
assert(!supCfMigration.includes('alter table if exists public.transaction_attachments'))
assert(!supCfMigration.includes("if to_regclass('public.transaction_attachments') is not null"))

const identityGuard = functionBlock(
  supCfMigration,
  'public.guard_transaction_attachment_identity_update()',
  'revoke all on function public.guard_transaction_attachment_identity_update()',
)
for (const field of ['center_id', 'uploaded_by', 'storage_bucket', 'storage_path']) {
  assert(identityGuard.includes(`new.${field}`))
  assert(identityGuard.includes(`old.${field}`))
}
for (const businessField of [
  'transaction_code',
  'transaction_date',
  'month_key',
  'amount',
  'cashflow_type',
  'note',
]) assert(!identityGuard.includes(`new.${businessField}`))
assert.equal(identityChanged(
  transactionRow(),
  { ...transactionRow(), amount: 250000, note: 'Điều chỉnh hợp lệ' },
), false)
assert.equal(identityChanged(
  transactionRow(),
  { ...transactionRow(), center_id: 'other-center' },
), true)

for (const sql of [supCfMigration, staffMigration]) {
  const definerCount = (sql.match(/security definer/gi) || []).length
  const fixedDefinerCount = (
    sql.match(/security definer\s+set search_path = ''/gi) || []
  ).length
  assert.equal(fixedDefinerCount, definerCount)
  assert(!/security definer\s+set search_path\s*=\s*(public|storage)/i.test(sql))
  assert(!/\busing\s*\(\s*true\s*\)/i.test(sql))
  assert(!/\bwith check\s*\(\s*true\s*\)/i.test(sql))
  assert(!sql.includes('public = true'))
}
assert(supCfMigration.includes(
  'revoke all on function public.can_manage_transaction_attachments(text)\n  from public, anon;',
))
assert(staffMigration.includes(
  'revoke all on function public.can_manage_staff_document_attachments(text)\n  from public, anon;',
))
assert(/grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\.transaction_attachments\s+to\s+authenticated/i.test(supCfMigration))
assert(staffMigration.includes(
  'grant select on table public.center_staff_document_attachments to authenticated',
))
assert(!/grant\s+(insert|update|delete)[^;]*center_staff_document_attachments/i.test(staffMigration))

const runtimeSql = [
  transactionAdapter,
  storageAdapter,
  supCfMigration,
  staffAdapter,
  staffMigration,
].join('\n')
const privilegedRoleMarker = ['service', 'role'].join('_')
assert(!runtimeSql.toLowerCase().includes(privilegedRoleMarker))
assert(!/owner\.[a-z0-9._%+-]+@[a-z0-9.-]+/i.test(runtimeSql))
assert(!staffAdapter.includes('FileReader'))
assert(!staffAdapter.includes('readAsDataURL'))
assert(!staffAdapter.includes('createObjectURL'))
assert(!staffAdapter.includes('console.'))

for (const marker of [
  'SUP-CF.1 hardened migration',
  'F23.11E private staff attachment migration',
  'local supabase db reset',
  'static/security verification',
  'migration list',
  'remote dry-run',
  'remote apply',
  'chưa chạy Supabase local reset',
  'F23.11E SQL HARDENING COMPLETE - READY FOR LOCAL MIGRATION TEST',
]) assert(docs.includes(marker), `Missing F23.11E.1 docs marker: ${marker}`)

const mojibakeMarkers = [
  String.fromCodePoint(0x00c3),
  String.fromCodePoint(0x00c2),
  String.fromCodePoint(0x00e2, 0x20ac),
  String.fromCodePoint(0x0102, 0x201a),
  String.fromCodePoint(0x00c6, 0x00b0, 0x00e1),
]
for (const text of [supCfMigration, staffMigration, docs]) {
  assert(!mojibakeMarkers.some((marker) => text.includes(marker)))
}

console.log('F23.11E.1 SQL/RLS hardening static smoke: PASS')

function membership(userId, centerId, role, status) {
  return { userId, centerId, role, status }
}

function normalizeRole(role) {
  return String(role ?? '')
    .trim()
    .toLowerCase()
    .replaceAll('-', '_')
    .replaceAll(' ', '_')
}

function canManage(candidate, userId, centerId) {
  return Boolean(
    userId &&
    centerId?.trim() &&
    candidate?.userId === userId &&
    candidate?.centerId === centerId &&
    String(candidate?.status ?? '').trim().toLowerCase() === 'active' &&
    ['owner', 'center_admin'].includes(normalizeRole(candidate?.role)),
  )
}

function staffAttachment({
  centerId = 'dreamhome_prod',
  state = 'pending',
  archivedAt = null,
  uploaderId = 'user-owner',
  bucketId = 'staff-administrative-documents',
  objectPath = 'centers/dreamhome_prod/staff/s-1/documents/d-1/a-1/attachment.pdf',
  storageObjectPath = objectPath,
  isPrimary = true,
} = {}) {
  return {
    centerId,
    state,
    archivedAt,
    uploaderId,
    bucketId,
    objectPath,
    storageObjectPath,
    isPrimary,
  }
}

function canReadStaffObject(attachment, candidate, userId) {
  return Boolean(
    attachment.bucketId === 'staff-administrative-documents' &&
    attachment.objectPath === attachment.storageObjectPath &&
    !attachment.archivedAt &&
    canManage(candidate, userId, attachment.centerId) &&
    (
      attachment.state === 'available' ||
      (attachment.state === 'pending' && attachment.uploaderId === userId)
    ),
  )
}

function canInsertStaffObject(attachment, candidate, userId) {
  return Boolean(
    attachment.state === 'pending' &&
    attachment.isPrimary &&
    !attachment.archivedAt &&
    attachment.uploaderId === userId &&
    attachment.bucketId === 'staff-administrative-documents' &&
    attachment.objectPath === attachment.storageObjectPath &&
    canManage(candidate, userId, attachment.centerId),
  )
}

function isValidTransactionPath(centerId, storagePath) {
  const segments = String(storagePath ?? '').split('/')
  return Boolean(
    String(centerId ?? '').trim() &&
    segments.length === 5 &&
    segments[0] === centerId &&
    segments[1] === 'transaction-images' &&
    /^\d{4}$/.test(segments[2]) &&
    /^(0[1-9]|1[0-2])$/.test(segments[3]) &&
    !['', '.', '..'].includes(segments[4]) &&
    !storagePath.includes('\\'),
  )
}

function transactionRow() {
  return {
    center_id: 'dreamhome_prod',
    uploaded_by: 'user-owner',
    storage_bucket: 'transaction-images',
    storage_path:
      'dreamhome_prod/transaction-images/2026/07/TC-20260728-0001-01.jpg',
    amount: 100000,
    note: 'Giao dịch',
  }
}

function identityChanged(oldRow, newRow) {
  return ['center_id', 'uploaded_by', 'storage_bucket', 'storage_path']
    .some((field) => oldRow[field] !== newRow[field])
}

function policyBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker)
  const end = source.indexOf(endMarker, start + startMarker.length)
  assert(start >= 0 && end > start)
  return source.slice(start, end)
}

function functionBlock(source, startMarker, endMarker) {
  return policyBlock(source, startMarker, endMarker)
}
