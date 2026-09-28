import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

// Exercise the installed A2/A3/A4 contracts in isolated rollback transactions.
// No credentials or operational payloads are written to QA output.
const password = fs.readFileSync('matkhausupabase.txt', 'utf8').trim()
const url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim())
assert(!url.password)
const checks = []
for (const file of [
  'tests/a3-teacher-history-transaction-qa.sql',
  'tests/a4-makeup-integrity-transaction-qa.sql',
]) {
  const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', 'supabase_db_ichess-center-os',
    'psql', '-X', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-d', url.href, '-q', '-A', '-t'], {
    env: { ...process.env, PGPASSWORD: password },
    input: `begin;\n${fs.readFileSync(file, 'utf8')}\n${file.includes('a4-')
      ? fs.readFileSync('tests/a5-schedule-attendance-transaction-qa.sql', 'utf8') : ''}\nrollback;`,
    encoding: 'utf8', windowsHide: true, timeout: 30000,
  })
  assert.equal(result.status, 0, `${file}: ${result.stderr.replaceAll(password, '[REDACTED]').replaceAll(url.href, '[DATABASE]')}`)
  assert.match(result.stdout, /(?:A2|A3|A4)_.*(?:QA_)?PASS/)
  checks.push({ file, passed: true, rolledBack: true })
  if (file.includes('a4-')) {
    assert.match(result.stdout, /A5_TRANSACTION_QA_PASS/)
    checks.push({ file: 'tests/a5-schedule-attendance-transaction-qa.sql', passed: true, rolledBack: true })
  }
}
fs.mkdirSync('artifacts/a5-schedule-attendance-ui', { recursive: true })
fs.writeFileSync('artifacts/a5-schedule-attendance-ui/server-qa.json', JSON.stringify(checks, null, 2))
console.log(JSON.stringify(checks))
