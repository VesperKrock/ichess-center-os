import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

assert.equal(process.argv.length, 2, 'This local QA runner accepts no arguments')
assert(!process.env.SUPABASE_PROJECT_REF, 'A linked/remote project reference is forbidden')

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    maxBuffer: 64 * 1024 * 1024, ...options,
  })
  if (result.error) throw result.error
  return result
}
const requireSuccess = (result, label) => {
  if (result.status !== 0) throw new Error(`${label}: ${result.stdout}\n${result.stderr}`)
  return result.stdout
}

const cliCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const cliArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx --no-install supabase status -o json']
  : ['--no-install', 'supabase', 'status', '-o', 'json']
const localStatus = JSON.parse(requireSuccess(run(cliCommand, cliArgs), 'local Supabase status'))
for (const url of [localStatus.DB_URL, localStatus.API_URL]) {
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(url).hostname.toLowerCase()),
    'F5B-B2A QA endpoint must be loopback')
}

const discovery = requireSuccess(run('docker', [
  'ps', '--filter', 'label=com.supabase.cli.project=ichess-center-os',
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'local Docker discovery').trim().split(/\r?\n/).filter(Boolean)
  .map((line) => line.split('|')).filter(([, name]) => name === 'supabase_db_ichess-center-os')
assert.equal(discovery.length, 1, 'Expected exactly one guarded local database container')
assert(/supabase\/postgres/i.test(discovery[0][2]))

const sql = readFileSync('tests/f5b-b2a-prepared-next-cycle-authority-local-db-qa.sql', 'utf8')
const result = run('docker', [
  'exec', '-i', discovery[0][0], 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t',
], { input: sql })
const output = requireSuccess(result, 'transactional F5B-B2A local DB QA')
assert.match(output, /F5B_B2A_LOCAL_DB_QA: PASS/)

console.log('F5B_B2A_PREPARED_NEXT_CYCLE_LOCAL_DB_QA: PASS')
