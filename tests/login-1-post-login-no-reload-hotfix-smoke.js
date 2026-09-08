import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renderAppAuthEntry } from '../src/app-auth.js'

const main = readFileSync('src/main.js', 'utf8')
const capability = readFileSync('src/first-owner-bootstrap.js', 'utf8')

const syncStart = main.indexOf('async function syncCloudUser')
const syncEnd = main.indexOf('function createInitialCloudDbState', syncStart)
assert(syncStart >= 0 && syncEnd > syncStart, 'syncCloudUser source boundary must exist')
const syncSource = main.slice(syncStart, syncEnd)

const membershipResolution = syncSource.indexOf(
  'const resolvedMembership = await resolveActiveCenterMembership(user.id)',
)
const noMembershipProbe = syncSource.indexOf(
  'if (!resolvedMembership.ok) {\n      await refreshInstallationHandoffCapability(syncId)',
)
const membershipCommit = syncSource.indexOf(
  "membershipStatus: resolvedMembership.ok ? 'loaded' : 'missing'",
)
const firstSettledRender = syncSource.indexOf('\n  render()\n', membershipCommit)
const backgroundProbe = syncSource.indexOf(
  'void refreshInstallationHandoffCapability(syncId).then',
  firstSettledRender,
)
const coreBootstrap = syncSource.indexOf(
  'await bootstrapCoreCloudDataForCurrentCenter(syncId)',
  firstSettledRender,
)

assert(membershipResolution >= 0)
assert(noMembershipProbe > membershipResolution,
  'Only a genuine no-membership result may wait for CHB capability.')
assert(membershipCommit > noMembershipProbe)
assert(firstSettledRender > membershipCommit,
  'Authoritative membership must be committed and rendered in the same page.')
assert(backgroundProbe > firstSettledRender,
  'An existing member must probe optional CHB capability without blocking the OS render.')
assert(coreBootstrap > backgroundProbe,
  'Core bootstrap must continue without awaiting optional CHB capability.')

assert(main.includes(
  "await syncCloudUser(user, { force: true, reason: 'manual-sign-in' })",
), 'Explicit password login must force one authoritative post-login sync.')

assert(capability.includes('Promise.race(['),
  'The optional capability request needs a bounded settlement path.')
assert(capability.includes("code: 'HANDOFF_CAPABILITY_TIMEOUT'"))
assert(capability.includes('INSTALLATION_CAPABILITY_STATUS.FAILED'),
  'A timeout or network failure must fail closed, never imply UNINITIALIZED.')

const activeMemberHtml = renderAppAuthEntry({
  configStatus: 'configured',
  authStatus: 'signed-in',
  user: { id: 'owner-1', email: 'owner@example.test' },
  membershipStatus: 'loaded',
  installationHandoffState: { capabilityStatus: 'LOADING', capability: null },
}, {
  status: 'bound',
  currentCenterId: 'center-1',
  centerName: 'Center 1',
})
assert(activeMemberHtml.includes('data-cloud-action="logout"'))
assert(!activeMemberHtml.includes('data-first-owner-bootstrap-form'),
  'A valid existing member must not be diverted into bootstrap UI.')

const claimantHtml = renderAppAuthEntry({
  configStatus: 'configured',
  authStatus: 'signed-in',
  user: { id: 'claimant-1', email: 'claimant@example.test' },
  membershipStatus: 'loading',
  installationHandoffState: { capabilityStatus: 'LOADING', capability: null },
}, { status: 'loading' })
assert(!claimantHtml.includes('data-cloud-login-form'),
  'A no-membership claimant may wait for the truthful bootstrap capability result.')

console.log('LOGIN-1 post-login no-reload hotfix smoke: PASS')
