import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  NEEDS_MEMBERSHIP_SQL_PATCH,
  buildOnlineAccessState,
  canReadModule,
  canWriteEntity,
  canWriteModule,
  getOnlineAccessMessage,
  getReadOnlyReason,
  isOnlineWriteAllowed,
  normalizeOnlineRole,
} from '../src/online-access-control.js'

const repoRoot = process.cwd()

assert.equal(normalizeOnlineRole('owner'), 'owner')
assert.equal(normalizeOnlineRole('QTV'), 'qtv')
assert.equal(normalizeOnlineRole('center-admin'), 'center_admin')
assert.equal(normalizeOnlineRole('center admin'), 'center_admin')
assert.equal(normalizeOnlineRole('teacher'), 'teacher')
assert.equal(normalizeOnlineRole('consultant'), 'consultant')
assert.equal(normalizeOnlineRole('viewer'), 'viewer')
assert.equal(normalizeOnlineRole(''), 'none')
assert.equal(normalizeOnlineRole('surprise-admin'), 'unknown')

const baseInput = {
  isSupabaseConfigured: true,
  isSignedIn: true,
  user: { id: 'user-001', email: 'admin@example.com' },
  centerId: 'dreamhome',
  cloudReady: true,
}

const viewerAccess = buildOnlineAccessState({
  ...baseInput,
  membership: { role: 'viewer' },
})
assert.equal(viewerAccess.canRead, true)
assert.equal(viewerAccess.canWrite, false)
assert.equal(viewerAccess.readOnly, true)
assert.equal(canWriteEntity(viewerAccess, 'student'), false)
assert.equal(getReadOnlyReason(viewerAccess), 'viewer-read-only')

for (const role of ['none', 'unknown']) {
  const access = buildOnlineAccessState({
    ...baseInput,
    membership: { role },
  })
  assert.equal(access.canWrite, false, `${role} must not write cloud`)
  assert.equal(isOnlineWriteAllowed(access, { entityType: 'student' }), false)
}

for (const role of ['center_admin', 'owner', 'qtv']) {
  const access = buildOnlineAccessState({
    ...baseInput,
    membership: { role },
  })
  assert.equal(access.canRead, true, `${role} should read with valid membership`)
  assert.equal(access.canWrite, true, `${role} should write core entity with valid membership`)
  assert.equal(canWriteEntity(access, 'student'), true)
  assert.equal(canWriteModule(access, 'hoc-vien'), true)
}

for (const role of ['teacher', 'consultant']) {
  const access = buildOnlineAccessState({
    ...baseInput,
    membership: { role },
  })
  assert.equal(access.canRead, true, `${role} should read with valid membership`)
  assert.equal(access.canWrite, false, `${role} should not get broad C3.1 write`)
  assert.equal(canReadModule(access, 'hoc-vien'), true)
}

const signedOutAccess = buildOnlineAccessState({
  ...baseInput,
  isSignedIn: false,
  user: null,
  membership: { role: 'owner' },
})
assert.equal(signedOutAccess.canWrite, false)
assert.equal(signedOutAccess.readOnly, true)
assert.equal(signedOutAccess.reason, 'signed-out')

const missingCenterAccess = buildOnlineAccessState({
  ...baseInput,
  centerId: '',
  membership: { role: 'owner' },
})
assert.equal(missingCenterAccess.canWrite, false)
assert.equal(missingCenterAccess.reason, 'missing-center')

const missingMembershipAccess = buildOnlineAccessState({
  ...baseInput,
  membership: null,
})
assert.equal(missingMembershipAccess.canRead, false)
assert.equal(missingMembershipAccess.canWrite, false)
assert.equal(missingMembershipAccess.needsMembershipPatch, true)
assert.equal(getOnlineAccessMessage(missingMembershipAccess), NEEDS_MEMBERSHIP_SQL_PATCH)

const cloudNotReadyAccess = buildOnlineAccessState({
  ...baseInput,
  cloudReady: false,
  membership: { role: 'center_admin' },
})
assert.equal(cloudNotReadyAccess.canRead, true)
assert.equal(cloudNotReadyAccess.canWrite, false)
assert.equal(cloudNotReadyAccess.reason, 'cloud-not-ready')

assert.equal(canWriteEntity(buildOnlineAccessState({
  ...baseInput,
  membership: { role: 'center_admin' },
}), 'attendance_record'), false)

const helperSource = fs.readFileSync(path.join(repoRoot, 'src', 'online-access-control.js'), 'utf8')
const mainSource = fs.readFileSync(path.join(repoRoot, 'src', 'main.js'), 'utf8')
const cloudDbSyncSource = fs.readFileSync(path.join(repoRoot, 'src', 'cloud-db-sync.js'), 'utf8')

assert(helperSource.includes('buildOnlineAccessState'))
assert(mainSource.includes('buildCurrentOnlineAccessState'))
assert(cloudDbSyncSource.includes('cloud-write-read-only'))

const realtimeScannedSources = [helperSource, mainSource, cloudDbSyncSource].join('\n')
assert(!realtimeScannedSources.includes('supabase.channel('), 'C3.1 must not add realtime subscription code.')
assert(!realtimeScannedSources.includes('.on(\'postgres_changes\''), 'C3.1 must not add realtime postgres changes code.')

const docsDir = path.join(repoRoot, 'docs')
const c3SqlFiles = fs
  .readdirSync(docsDir)
  .filter((fileName) => /^supabase-c3/i.test(fileName) && fileName.toLowerCase().endsWith('.sql'))
  .filter((fileName) => fileName !== 'supabase-c3-2-1-membership-realtime-readiness.sql')
assert.deepEqual(c3SqlFiles, [], 'C3.1 must not add Supabase C3 SQL migration files.')

const docs = fs.readFileSync(path.join(repoRoot, 'docs', 'online-access-control-c3-1.md'), 'utf8')
for (const term of [
  'Auth state',
  'Membership source',
  'Role model',
  'Read-only/write gate',
  'Permission matrix',
  'NEEDS MEMBERSHIP SQL PATCH',
  'C3.2',
]) {
  assert(docs.includes(term), `Missing C3.1 docs term: ${term}`)
}

console.log('C3.1 auth membership readonly gate smoke passed')
