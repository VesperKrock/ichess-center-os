import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

// Read-only evidence across every center, including payment linkage tables.
const phase = process.argv[2]
assert(['before', 'after'].includes(phase))
const password = fs.readFileSync('matkhausupabase.txt', 'utf8').trim()
const url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim())
assert(!url.password, 'Keep database credentials out of command arguments')
const tables = ['center_cloud_entities', 'center_tuition_package_cycles', 'finance_transaction',
  'center_tuition_receipts', 'center_tuition_receipt_payment_links', 'center_tuition_attendance_contributions']
const entries = tables.map(table => `'${table}', (select coalesce(jsonb_agg(to_jsonb(s) order by center_id),'[]'::jsonb) from
  (select center_id,count(*) n,md5(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text)) hash from public.${table} t group by center_id) s)`)
const sql = `begin transaction read only; select jsonb_build_object(${entries.join(',')}); rollback;`
const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', 'supabase_db_ichess-center-os',
  'psql', '-X', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-d', url.href, '-q', '-A', '-t'], {
  env: { ...process.env, PGPASSWORD: password }, input: sql, encoding: 'utf8', windowsHide: true, timeout: 30000,
})
assert.equal(result.status, 0, 'Read-only remote audit failed; credentials are intentionally not logged')
const data = JSON.parse(result.stdout.trim())
const folder = 'artifacts/tuition-receipt-a5-runtime'
fs.writeFileSync(`${folder}/remote-${phase}.json`, JSON.stringify(data, null, 2))
if (phase === 'after') assert.deepEqual(data, JSON.parse(fs.readFileSync(`${folder}/remote-before.json`)), 'Business data changed')
console.log(JSON.stringify({ phase, readOnly: true, businessDataUnchanged: phase === 'after', demo: Object.fromEntries(
  tables.map(table => [table, data[table].find(row => row.center_id === 'phongtrong_prod')?.n ?? 0]),
)}))
