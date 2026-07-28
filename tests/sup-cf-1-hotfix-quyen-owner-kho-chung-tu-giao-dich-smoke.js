import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { isTransactionAttachmentRoleAllowed } from '../src/transaction-attachments.js'

const root = process.cwd()
const read = (filePath) => fs.readFileSync(path.join(root, filePath), 'utf8')

const main = read('src/main.js')
const attachments = read('src/transaction-attachments.js')
const storage = read('src/supabase-storage.js')
const migrationPath =
  'supabase/migrations/202607230001_sup_cf_1_transaction_attachment_owner_center_admin_policies.sql'
const migration = read(migrationPath)
const doc = read('docs/sup-cf-1-hotfix-quyen-owner-kho-chung-tu-giao-dich.md')

assert.equal(isTransactionAttachmentRoleAllowed('owner'), true)
assert.equal(isTransactionAttachmentRoleAllowed('center_admin'), true)
assert.equal(isTransactionAttachmentRoleAllowed('teacher'), false)
assert.equal(isTransactionAttachmentRoleAllowed('consultant'), false)
assert.equal(isTransactionAttachmentRoleAllowed('viewer'), false)
assert.equal(isTransactionAttachmentRoleAllowed(''), false)

assert(main.includes('function getCloudAttachmentAccessContext()'))
assert(main.includes('isTransactionAttachmentRoleAllowed(status.role)'))
assert(main.includes("reason: 'membership-loading'"))
assert(main.includes('centerId: access.centerId'))
assert(main.includes('listTransactionAttachmentsByMonth({ centerId: access.centerId, monthKey })'))
assert(main.includes('addSignedUrlsToAttachments(result.data, access.centerId)'))
assert(main.includes('createTransactionImageSignedUrl('))
assert(main.includes('centerId || attachment.centerId'))
assert(main.includes('listTransactionAttachmentsByTransactionCode({\n    centerId,'))
assert(main.includes('deleteTransactionImageObject(attachment.storagePath, centerId)'))
assert(main.includes('deleteTransactionAttachmentMetadata(attachment.id, centerId)'))
assert(main.includes('listTransactionAttachmentsByTransactionCode({\n    centerId: access.centerId,'))
assert(main.includes('buildTransactionImageStoragePath({\n      centerId: access.centerId,'))
assert(main.includes('uploadTransactionImageBlob({\n      centerId: access.centerId,'))
assert(main.includes('createTransactionAttachmentMetadata({\n    centerId: access.centerId,'))
assert(main.includes('access.centerId !== centerId'))

assert(attachments.includes("new Set(['owner', 'center_admin'])"))
assert(attachments.includes('getCurrentCenterMembership(user.id, normalizedCenterId)'))
assert(attachments.includes('isTransactionAttachmentRoleAllowed(membership.role)'))
assert(storage.includes('isTransactionAttachmentRoleAllowed'))
assert(storage.includes('getCurrentCenterMembership(user.id, normalizedCenterId)'))

assert(migration.includes('create or replace function public.can_manage_transaction_attachments'))
assert(migration.includes('auth.uid() is not null'))
assert(migration.includes("lower(btrim(coalesce(cm.status::text, ''))) = 'active'"))
assert(migration.includes("in ('owner', 'center_admin')"))
assert(!migration.includes("coalesce(cm.status, 'active')"))
assert(migration.includes('alter table public.transaction_attachments enable row level security'))
assert(!migration.includes('alter table if exists public.transaction_attachments enable row level security'))
assert(migration.includes("set public = false"))
assert(migration.includes("where id = 'transaction-images'"))
assert(migration.includes('create or replace function public.is_valid_transaction_attachment_path'))
assert(migration.includes("split_part(requested_storage_path, '/', 1) = requested_center_id"))
assert(migration.includes("array_length(string_to_array(requested_storage_path, '/'), 1) = 5"))
assert(!/storage_path\s+like\s+center_id/i.test(migration))
assert(migration.includes('uploaded_by = auth.uid()'))
assert(migration.includes('transaction_attachment_identity_immutable'))
assert(migration.includes('new.center_id'))
assert(migration.includes('new.uploaded_by'))
assert(migration.includes('new.storage_bucket'))
assert(migration.includes('new.storage_path'))
assert(migration.includes('on storage.objects'))
assert(migration.includes("bucket_id = 'transaction-images'"))
assert(migration.includes('(storage.foldername(name))[1]'))
assert(migration.includes('SUP-CF.1 prerequisite missing: public.transaction_attachments'))
assert(migration.includes('SUP-CF.1 prerequisite missing: public.center_members'))
assert(migration.includes('SUP-CF.1 prerequisite missing: transaction-images bucket'))
assert(migration.includes("set search_path = ''"))

const runtimeAndMigration = [main, attachments, storage, migration].join('\n')
assert(!runtimeAndMigration.includes('owner.duchai@ichess.vn'))
assert(!migration.includes('dreamhome_prod'))
assert(!migration.includes('dreamhome'))
assert(!runtimeAndMigration.includes('service_role'))
assert(!migration.includes('public = true'))
assert(/grant\s+select,\s*insert,\s*update,\s*delete\s+on\s+table\s+public\.transaction_attachments\s+to\s+authenticated/i.test(migration))
assert(migration.includes('from public, anon;'))

for (const marker of [
  'Target Trace',
  'Root Cause',
  'RLS Patch',
  'Access Matrix',
  'POLICY FIX PREPARED - AWAITING REMOTE APPLY APPROVAL',
  'SUP-CF.1 HARDENED - READY FOR LOCAL MIGRATION TEST',
]) {
  assert(doc.includes(marker), `Doc missing marker: ${marker}`)
}

console.log('SUP-CF.1 transaction evidence owner/center_admin hotfix smoke passed')
