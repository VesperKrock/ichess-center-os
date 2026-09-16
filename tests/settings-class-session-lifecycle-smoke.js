import assert from 'node:assert/strict'
import { renderSettingsModule } from '../src/settings-module.js'

const classes = [
  {
    id: 'class-unused', name: 'Class unused', displayLabel: 'Class unused',
    daysLabel: 'T2', daysOfWeek: ['mon'], startTime: '18:00', endTime: '19:00', status: 'active',
  },
  {
    id: 'class-referenced', name: 'Class referenced', displayLabel: 'Class referenced',
    daysLabel: 'T3', daysOfWeek: ['tue'], startTime: '18:00', endTime: '19:00', status: 'active',
  },
]
const html = renderSettingsModule(classes, [], undefined, null, null, {
  activeTab: 'class-sessions',
  classSessionDeletePolicies: {
    'class-unused': { ok: true, canDelete: true, message: '' },
    'class-referenced': {
      ok: true,
      canDelete: false,
      message: 'Không thể xóa vĩnh viễn vì có lịch sử. Hãy dùng “Ngưng dùng”.',
    },
  },
})
const unusedButton = html.match(/<button[\s\S]*?data-class-session-id="class-unused"[\s\S]*?>[\s\S]*?Xóa[\s\S]*?<\/button>/)?.[0] || ''
const referencedButton = html.match(/<button[\s\S]*?data-class-session-id="class-referenced"[\s\S]*?>[\s\S]*?Xóa[\s\S]*?<\/button>/)?.[0] || ''
assert(unusedButton)
assert(!unusedButton.includes('aria-disabled="true"'))
assert(referencedButton)
assert(referencedButton.includes('disabled aria-disabled="true"'))
assert(html.includes('settings-class-session-delete-note'))
assert(html.includes('Ngưng dùng'))
assert(html.includes('data-settings-class-session-action="toggle-status"'))
console.log('SETTINGS_CLASS_SESSION_LIFECYCLE_SMOKE: PASS')
