import assert from 'node:assert/strict'
import { parseV24PackageCycleSnapshot } from '../src/cloud-authoritative-tuition-cycles.js'

const contribution = {
  cycle_id: '10000000-0000-4000-8000-000000000001', student_id: 'fixture-student',
  cycle_number: 1, schedule_session_id: 'fixture-session', occurrence_date: '2026-10-16',
  attendance_status: 'absent', contribution_units: 0, session_number: 0,
  remaining_sessions: 16, total_sessions: 16, allocation_state: 'APPLIED',
}
const snapshot = {
  ok: true, status: 'READY', contract: 'v2.4-package-cycle-v1', center_id: 'fixture-center',
  students: [{ student_id: 'fixture-student', readiness: 'NO_TUITION_PACKAGE', cycles: [] }],
  package_catalog: [], contributions: [contribution],
}
const parse = patch => parseV24PackageCycleSnapshot({ ...snapshot, contributions: [{ ...contribution, ...patch }] }, 'fixture-center')
assert.equal(parse({}).ok, true, 'The first absence is a valid zero-consumption contribution, not a center-wide read failure')
assert.equal(parse({}).contributions[0].sessionNumber, 0)
assert.equal(parse({}).contributions[0].contributionUnits, 0)
assert.equal(parse({}).contributions[0].remainingSessions, 16)
assert.equal(parse({ session_number: 5, remaining_sessions: 11 }).ok, true)
assert.equal(parse({ attendance_status: 'present', contribution_units: 1, session_number: 1, remaining_sessions: 15 }).ok, true)
assert.equal(parse({ attendance_status: 'present', contribution_units: 1, session_number: 0 }).ok, false)
assert.equal(parse({ session_number: -1 }).ok, false)
assert.equal(parse({ session_number: 0.5 }).ok, false)
assert.equal(parse({ contribution_units: 2 }).ok, false)
assert.equal(parse({ remaining_sessions: -1 }).ok, false)
assert.equal(parse({ total_sessions: 0 }).ok, false)
console.log('Zero-consumption Tuition contribution: PASS; first absence keeps center snapshot readable without counting a session')
