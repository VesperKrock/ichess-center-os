import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

assert.equal(process.argv.length, 2, 'No remote or target arguments are accepted')
for (const name of ['DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'PGHOST']) {
  const value = process.env[name]
  if (!value) continue
  const host = name === 'PGHOST' ? value : new URL(value).hostname
  assert(['localhost', '127.0.0.1', '::1'].includes(host), `${name} must be loopback`)
}
const run = (command, args, input = undefined) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), input, encoding: 'utf8', windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`)
  return result.stdout.trim()
}
const status = JSON.parse(process.platform === 'win32'
  ? run(process.env.ComSpec, ['/d', '/s', '/c', 'npx --no-install supabase status -o json'])
  : run('npx', ['--no-install', 'supabase', 'status', '-o', 'json']))
assert.equal(new URL(status.DB_URL).hostname, '127.0.0.1')
const project = 'ichess-center-os'
const containerName = `supabase_db_${project}`
const containers = run('docker', ['ps', '--filter', `label=com.supabase.cli.project=${project}`,
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}'])
  .split(/\r?\n/).filter(Boolean).map(line => line.split('|'))
  .filter(([, name, image]) => name === containerName && /supabase\/postgres/i.test(image))
assert.equal(containers.length, 1, 'Expected the one guarded local Supabase DB container')
const containerId = containers[0][0]
const psql = sql => run('docker', ['exec', '-i', containerId, 'psql', '-X', '--no-psqlrc',
  '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t'], sql)
assert.equal(psql("select to_regprocedure('public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)') is not null"), 't',
  'V2.3 prerequisite is absent in the local DB')
const stripTransaction = path => readFileSync(path, 'utf8')
  .replace(/^begin;\s*$/mi, '').replace(/^commit;\s*$/mi, '')
// The guarded local DB predates the September 26/27 migrations. Apply their
// exact repository SQL in the same transaction; never reset or link a DB.
const prerequisites = [
  '202609260001_tuition_simple_core.sql',
  '202609260002_tuition_simple_core_early_payment.sql',
  '202609270001_tuition_final_business_alignment.sql',
  '202609270002_tuition_final_legacy_package_lock.sql',
  '202609270003_tuition_final_initial_package_change_terms.sql',
  '202609270004_tuition_payment_snapshot_identity.sql',
  '202609270005_tuition_definitive_initial_setup.sql',
  '202609270006_attendance_occurrence_foundation.sql',
  '202609270007_attendance_teacher_history.sql',
  '202609270008_attendance_makeup_integrity.sql',
].map(name => stripTransaction(`supabase/migrations/${name}`)).join('\n')
const migration = stripTransaction('supabase/migrations/202610050001_n2_attendance_write_authority_audit_foundation.sql')
const qa = readFileSync('tests/n2-attendance-write-authority-audit-local-db-qa.sql', 'utf8')
psql(`begin;\n${prerequisites}\n${migration}\n${qa}\nrollback;`)
assert.equal(psql("select to_regprocedure('public.v2_9_mutate_attendance_batch(text,jsonb,uuid)') is null"), 't',
  'N2 transaction left schema residue')
console.log('N2_ATTENDANCE_LOCAL_DB_QA: PASS (transaction rolled back; no local residue)')
