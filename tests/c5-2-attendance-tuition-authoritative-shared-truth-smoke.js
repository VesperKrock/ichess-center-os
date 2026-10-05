import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AUTHORITATIVE_ATTENDANCE_TUITION_ENTITY_TYPES,
  mutateAuthoritativeAttendanceTuitionEntities,
} from '../src/cloud-authoritative-attendance-tuition.js'
import { upsertC51AttendanceSessionReportCloudEntities } from '../src/cloud-attendance-realtime.js'

const migration = readFileSync('supabase/migrations/202610050001_n2_attendance_write_authority_audit_foundation.sql', 'utf8')
const main = readFileSync('src/main.js', 'utf8')
assert.deepEqual(AUTHORITATIVE_ATTENDANCE_TUITION_ENTITY_TYPES, [
  'attendance_baseline_state', 'session_report', 'tuition_record_package',
])
assert.match(migration, /if v_type='attendance_record' then[\s\S]*ATTENDANCE_TYPED_COMMAND_REQUIRED/)
assert.match(migration, /if v_type not in \('attendance_baseline_state','session_report','tuition_record_package'\)/)
assert.match(migration, /rename to n2_internal_mutate_attendance_tuition_entities/)
assert.match(migration, /revoke all on function public\.n2_internal_mutate_attendance_tuition_entities/)
assert.doesNotMatch(main, /writeV23OccurrenceAttendanceThroughCloud|mutateV23OccurrenceAttendance/)

const calls = []
const supabase = { rpc: async (name, params) => {
  calls.push({ name, params })
  return { data: { ok: true, outcome_code: 'COMMITTED', results: params.p_mutations.map((item) => ({
    center_id: params.p_center_id, entity_type: item.entity_type, local_id: item.local_id,
    entity_version: 1, updated_at: '2026-10-05T00:00:00Z', deleted_at: null, payload: item.payload,
  })) } }
} }
const rejected = await mutateAuthoritativeAttendanceTuitionEntities({
  supabase, centerId: 'center-a', mutations: [{
    entityType: 'attendance_record', localId: 'attendance-a', expectedVersion: 0,
    entity: { studentId: 'student-a', attendanceStatus: 'present' },
  }],
})
assert.equal(rejected.outcome_code, 'ATTENDANCE_TYPED_COMMAND_REQUIRED')
assert.equal(calls.length, 0)

const allowed = await mutateAuthoritativeAttendanceTuitionEntities({
  supabase, centerId: 'center-a', mutations: [{
    entityType: 'session_report', localId: 'report-a', expectedVersion: 0,
    entity: { id: 'report-a', guestParticipants: [] },
  }],
})
assert.equal(allowed.ok, true)
assert.equal(calls.length, 1)
assert.equal(calls[0].name, 'c5_2_mutate_attendance_tuition_entities')
assert.equal(calls[0].params.p_mutations[0].entity_type, 'session_report')

assert.match(upsertC51AttendanceSessionReportCloudEntities.toString(), /ATTENDANCE_TYPED_COMMAND_REQUIRED/)
console.log('C5_2_ATTENDANCE_TUITION_N2_COMPAT_SMOKE: PASS')
