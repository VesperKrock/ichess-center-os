import assert from 'node:assert/strict'
import { mutateAuthoritativeCoreEntity } from '../src/cloud-authoritative-core.js'

const calls = []
const supabase = {
  async rpc(name, args) {
    calls.push({ name, args })
    if (args.p_operation === 'DELETE') {
      return {
        data: {
          ok: true,
          outcome_code: 'DELETED',
          center_id: args.p_center_id,
          entity_type: args.p_entity_type,
          local_id: args.p_local_id,
          entity_version: args.p_expected_version + 1,
          payload: null,
          deleted_at: '2026-09-16T00:00:02.000Z',
        },
        error: null,
      }
    }
    return {
      data: {
        ok: true,
        outcome_code: 'COMMITTED',
        center_id: args.p_center_id,
        entity_type: args.p_entity_type,
        local_id: args.p_local_id,
        entity_version: 1,
        payload: args.p_payload,
        updated_at: '2026-09-16T00:00:01.000Z',
        deleted_at: null,
      },
      error: null,
    }
  },
}
const created = await mutateAuthoritativeCoreEntity({
  supabase,
  centerId: 'qa-center-one',
  entityType: 'class_session',
  entity: { id: 'class-x', name: 'Class X' },
  idempotencyKey: '00000000-0000-4000-8000-000000000001',
})
assert.equal(created.ok, true)
assert.equal(created.entity.cloudVersion, 1)

const deleted = await mutateAuthoritativeCoreEntity({
  supabase,
  centerId: 'qa-center-one',
  entityType: 'class_session',
  entity: created.entity,
  idempotencyKey: '00000000-0000-4000-8000-000000000002',
  operation: 'DELETE',
})
assert.equal(deleted.ok, true)
assert.equal(deleted.entity, null)
assert.equal(calls[1].args.p_operation, 'DELETE')
assert.equal(calls[1].args.p_expected_version, 1)
assert.deepEqual(calls[1].args.p_payload, {})

const denied = await mutateAuthoritativeCoreEntity({
  supabase: {
    rpc: async () => ({ data: null, error: { message: 'class_session_delete_referenced' } }),
  },
  centerId: 'qa-center-one',
  entityType: 'class_session',
  entity: created.entity,
  idempotencyKey: '00000000-0000-4000-8000-000000000003',
  operation: 'DELETE',
})
assert.equal(denied.ok, false)
assert.equal(denied.outcome_code, 'CLASS_SESSION_REFERENCED')
assert.match(denied.error, /Ngưng dùng/)
console.log('CLASS_SESSION_C5_1_MUTATION_SMOKE: PASS')
