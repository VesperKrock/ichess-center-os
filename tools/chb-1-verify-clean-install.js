import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const sha256 = (value) => createHash('sha256').update(value).digest('hex').toUpperCase()
const manifest = JSON.parse(read('supabase/clean-install/manifest.json'))
const schema = read(manifest.schemaFile)
const overlay = read(manifest.overlayMigration)

assert.equal(sha256(schema), manifest.schemaSha256, 'Clean schema SHA-256 drifted.')
assert.equal(sha256(overlay), manifest.overlayMigrationSha256, 'CHB-1 overlay SHA-256 drifted.')
assert(/CREATE TABLE(?: IF NOT EXISTS)? "public"\."centers"/i.test(schema), 'Physical schema is missing centers.')
assert(/CREATE TABLE(?: IF NOT EXISTS)? "public"\."center_access_governance"/i.test(schema), 'Physical schema is missing ARG governance.')
assert(/CREATE TABLE(?: IF NOT EXISTS)? "public"\."crm_contact"/i.test(schema), 'Physical schema is missing Parent CRM.')
assert(/CREATE TABLE(?: IF NOT EXISTS)? "public"\."center_inventory_items"/i.test(schema), 'Physical schema is missing Inventory.')
assert(/CREATE TABLE(?: IF NOT EXISTS)? "public"\."center_staff_hr_members"/i.test(schema), 'Physical schema is missing Staff/HR.')
assert(!/^COPY\s/im.test(schema), 'Schema-only package must not contain COPY data.')
assert(!/^INSERT\s+INTO\s/im.test(schema), 'Schema-only package must not contain row inserts.')
assert(!/CREATE (?:OR REPLACE )?FUNCTION\s+(?:"public"\.)?"?f23_3e_p3d_execute_conversion/i.test(schema), 'P3D executor is frozen.')
assert(!/CREATE (?:OR REPLACE )?(?:FUNCTION|TABLE)[^\n]*p4b/i.test(schema), 'P4B executable contract is frozen.')
assert(!/dreamhome|angel wings/i.test(schema), 'Clean schema must not carry a tester center/fixture name.')
assert(!/CREATE SCHEMA\s+"?storage"?/i.test(schema), 'Physical public schema must not recreate Storage schema.')
assert(!/CREATE TABLE\s+"storage"\./i.test(schema), 'Physical public schema must not recreate Storage tables.')
assert(overlay.includes("'staff-administrative-documents'"))
assert(overlay.includes("'transaction-images'"))
assert(overlay.includes('chb1_supabase_storage_platform_required'))
assert(!/CREATE\s+(?:SCHEMA|TABLE|TYPE|FUNCTION)\s+"?storage"?\./i.test(overlay),
  'CHB-1 overlay must not recreate Supabase-owned Storage infrastructure.')
assert(!/INSERT\s+INTO\s+storage\.objects/i.test(overlay),
  'CHB-1 overlay must not import Storage objects.')
assert(overlay.includes('drop policy if exists "members can view transaction images"'))
assert(overlay.includes("'FRESH_UNINITIALIZED'"))
assert(overlay.includes("'TESTER_ACTIVE'"))
assert(overlay.includes('chb1_claim_first_owner'))
assert(overlay.includes('chb1_execute_handoff_reset'))
assert(overlay.includes("(auth.jwt() ->> 'role') is distinct from 'service_role'"))
assert(overlay.includes('force row level security'))
assert(!/delete\s+from\s+(?:auth\.users|public\.installation_handoff_events)/i.test(overlay))

console.log('CHB-1 clean-install package verifier: PASS')
