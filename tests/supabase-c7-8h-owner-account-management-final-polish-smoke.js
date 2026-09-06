import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * OLD ASSUMPTION: final account polish exposed legacy active/revoked states only.
 * CURRENT ARG-2 CONTRACT: pending credential, reset, restore, repair and handoff are
 * truthful non-success states with plain operator copy.
 * WHY VALID: this extends rather than weakens the original clarity requirement.
 */
const main = readFileSync('src/main.js', 'utf8')
for (const marker of [
  "['pending_credential', 'reset_required', 'restore_pending']",
  "commandState === 'repair_required'",
  'Cần đối soát an toàn',
  'Chờ đổi mật khẩu',
  'Đang thu hồi quyền',
  'Bàn giao Owner',
  'Thay Admin',
]) assert(main.includes(marker), 'ARG-2 account copy/state marker missing: ' + marker)

for (const forbidden of ['JWT', 'service_role', 'SQLSTATE', 'REPAIR_REQUIRED']) {
  assert(!main.includes('>' + forbidden + '<'), 'Operator UI exposes ' + forbidden)
}
assert(!main.includes('ACCOUNT_ACCESS_LIVE_ALLOWED_CENTER_IDS'))
console.log('C7.8H Owner account state/copy smoke PASS under ARG-2')
