import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

assert.equal(process.argv.length, 2, 'This local QA runner accepts no arguments')
assert.equal(process.env.ICHESS_F1_LOCAL_QA_ALLOW_MUTATION, 'YES')
assert(!process.env.SUPABASE_PROJECT_REF, 'A linked/remote project reference is forbidden')

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  return result
}
const requireSuccess = (result, label) => {
  if (result.status !== 0) throw new Error(`${label}: ${result.stdout}\n${result.stderr}`)
  return result.stdout
}
const cliCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const cliArgs = (tail) => process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx --no-install supabase ${tail}`]
  : ['--no-install', 'supabase', ...tail.split(' ')]
const status = JSON.parse(requireSuccess(run(cliCommand, cliArgs('status -o json')), 'local status'))
assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(status.DB_URL).hostname))

const containers = requireSuccess(run('docker', [
  'ps', '--filter', 'label=com.supabase.cli.project=ichess-center-os',
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'local DB discovery').trim().split(/\r?\n/).filter(Boolean)
  .map((line) => line.split('|'))
  .filter(([, name]) => name === 'supabase_db_ichess-center-os')
assert.equal(containers.length, 1)
assert(/supabase\/postgres/i.test(containers[0][2]))

const sql = readFileSync('tests/f1-student-reliability-local-db-qa.sql', 'utf8')
requireSuccess(run('docker', [
  'exec', '-i', containers[0][0], 'psql', '-X', '--no-psqlrc',
  '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q',
], { input: sql }), 'F1 transactional QA')

const residue = requireSuccess(run('docker', [
  'exec', '-i', containers[0][0], 'psql', '-X', '--no-psqlrc',
  '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
], {
  input: `
    select
      (select count(*) from public.centers where id like 'f1_student_qa_%')
      + (select count(*) from public.center_members where center_id like 'f1_student_qa_%')
      + (select count(*) from public.center_cloud_entities where center_id like 'f1_student_qa_%');
  `,
}), 'F1 residue check').trim()
assert.equal(residue, '0')

console.log('F1_STUDENT_RELIABILITY_LOCAL_DB_QA: PASS (residue=0)')
