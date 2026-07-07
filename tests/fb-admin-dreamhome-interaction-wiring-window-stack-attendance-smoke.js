import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const exists = (file) => fs.existsSync(path.join(root, file))

const failures = []
const assert = (condition, message) => {
  if (!condition) {
    failures.push(message)
  }
}

const docPath = 'docs/fb-admin-dreamhome-interaction-wiring-window-stack-attendance.md'
const testPath = 'tests/fb-admin-dreamhome-interaction-wiring-window-stack-attendance-smoke.js'
const main = read('src/main.js')
const memberProfiles = read('src/member-profiles.js')
const styles = read('src/styles.css')
const doc = exists(docPath) ? read(docPath) : ''

const markers = [
  'FB ADMIN DREAMHOME STATUS: INTERACTION WIRING WINDOW STACK ATTENDANCE',
  'FEEDBACK_SOURCE: ADMIN_DREAMHOME_RUNTIME_QA',
  'C8_TEACHER_ROADMAP_SCOPE: NO',
  'ATTENDANCE_BASELINE_START_FIXED: YES',
  'INFO_BELL_CLICK_FIXED: YES',
  'CENTER_MEMBERS_400_HANDLED: YES',
  'INPUT_SINGLE_CLICK_ACTION_FIXED_APP_WIDE: YES',
  'BLUR_RENDER_CLICK_SWALLOW_REDUCED: YES',
  'WINDOW_BRING_TO_FRONT_POLICY_FIXED: YES',
  'WINDOW_CLOSE_LIFO_POLICY_FIXED: YES',
  'NOTIFICATION_START_LAYER_PRIORITY_PRESERVED: YES',
  'TASKBAR_OVERFLOW_PRIORITY_PRESERVED: YES',
  'SETTINGS_OPEN_FROM_STUDENT_EDIT_BRING_TO_FRONT: YES',
  'SQL_APPLIED_BY_CODEX: NO',
  'DEPLOY_BY_CODEX: NO',
  'COMMIT: NOT RUN',
  'PUSH: NOT RUN',
]

assert(exists(docPath), 'Docs report must exist.')
for (const marker of markers) {
  assert(doc.includes(marker), `Docs marker missing: ${marker}`)
}

assert(
  /CENTER_MEMBER_PROFILE_SELECT_FIELDS\s*=\s*['"]user_id, center_id, role, status['"]/.test(memberProfiles),
  'center_members profile read must use minimal guaranteed fields.',
)
assert(
  !/select\(profileColumns\)/.test(memberProfiles) &&
    !/const profileColumns\s*=/.test(memberProfiles),
  'Runtime must not use the old optional profileColumns select.',
)
assert(
  !/select\([^)]*email_snapshot[^)]*updated_at[^)]*\)/s.test(memberProfiles),
  'Runtime must not hard-require optional email_snapshot/updated_at in center_members GET.',
)

assert(
  /data-attendance-baseline-action="start"/.test(read('src/attendance-board-module.js')) &&
    /data-attendance-baseline-action="start"[\s\S]*addEventListener\('click'/.test(main),
  'Attendance baseline start button and click handler must exist.',
)
assert(
  /renderModuleNotificationBell/.test(main) &&
    /module-notification-bell/.test(read('src/styles.css')) &&
    /bindModuleNotificationOutsidePointer/.test(main),
  'Info/bell notification wiring must exist.',
)

assert(/function bringWindowToFront\(windowId\)/.test(main), 'Window manager must expose bringWindowToFront.')
assert(
  /openModuleWindow\(moduleId\)[\s\S]*const nextWindowId[\s\S]*focusWindow\(nextWindowId\)/.test(main),
  'New module windows must be focused after creation.',
)
assert(
  /function closeWindow\(windowId\)[\s\S]*nextActiveWindow[\s\S]*zIndex: \+\+topZIndex/.test(main),
  'closeWindow must promote the next active window in LIFO/z-index order.',
)
assert(
  /data-student-action="open-settings-module"[\s\S]*openModuleWindowFromChildInteraction\('cai-dat-co-so'\)/.test(main),
  'Open settings from student edit must use the child module window helper.',
)

assert(
  /function isInteractiveActionElement\(element\)/.test(main) &&
    /textEditingActionPointerUntil/.test(main) &&
    /shouldDelayTextEditingRenderFlushForAction/.test(main) &&
    /'summary'/.test(main),
  'Text editing render protection must allow action clicks before deferred flush.',
)
assert(
  /document\.addEventListener\(\s*'pointerdown'[\s\S]*isInteractiveActionElement/.test(main),
  'Pointerdown action guard must be installed before focusout flush.',
)

assert(/\.notification-center[\s\S]*z-index:\s*2147483004/.test(styles), 'Notification priority must be preserved.')
assert(/\.taskbar\s*\{[\s\S]*z-index:\s*2147482000/.test(styles), 'Taskbar priority must be explicit.')
assert(/\.start-menu\s*\{[\s\S]*z-index:\s*2147483003/.test(styles), 'Start menu priority must be explicit.')
assert(/\.window-overflow-menu\s*\{[\s\S]*z-index:\s*2147483001/.test(styles), 'Taskbar overflow priority must be explicit.')

const runtimeAndDocsText = [main, memberProfiles, styles, doc].join('\n')
assert(!/SUPABASE_SERVICE_ROLE_KEY\s*=|service_role\s*key\s*=|service-role-secret/i.test(runtimeAndDocsText), 'No service role secret exposure.')
assert(!/supabase\/functions/.test(runtimeAndDocsText), 'No Supabase function edits should be referenced as runtime changes.')
assert(!/C8_TEACHER_ROADMAP_SCOPE: YES/.test(doc), 'C8 Teacher roadmap must remain out of scope.')
assert(!exists('docs/fb-admin-dreamhome-interaction-wiring-window-stack-attendance.sql'), 'No SQL file for this feedback.')

if (failures.length) {
  console.error('FB admin DreamHome interaction wiring smoke failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('FB admin DreamHome interaction wiring smoke passed.')
