import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderScheduleModule } from '../src/schedule-module.js'

const root = process.cwd()
const mainSource = readFileSync(join(root, 'src/main.js'), 'utf8')
const scheduleCss = readFileSync(join(root, 'src/schedule-theme.css'), 'utf8')

function render(calendarNotesAvailable, calendarNotesSharedTruthState = {}) {
  return renderScheduleModule(
    [], null, null, [], null, null, null, null, false, null, [], [],
    '2026-08-24', null,
    {
      attendanceAvailable: true,
      calendarNotesAvailable,
      calendarNotesSharedTruthState,
      centerCalendarItems: [],
      centerCalendarTags: [],
      classSessions: [],
    },
  )
}

function assertUnavailableControls(html, state, label) {
  assert(html.includes('data-schedule-action="open-create"'), 'Core Add Session must remain available.')
  assert.equal((html.match(/data-schedule-optional-capability="calendar-notes"/g) || []).length, 2)
  assert.equal((html.match(new RegExp(`data-capability-state="${state}"`, 'g')) || []).length, 2)
  assert.equal((html.match(/disabled aria-disabled="true" tabindex="-1"/g) || []).length, 2)
  assert.equal((html.match(new RegExp(`<span>${label}<\\/span>`, 'g')) || []).length, 2)
  assert(!html.includes('data-center-calendar-action="open-create"'))
  assert(!html.includes('data-center-calendar-tag-action="open-manager"'))
  assert(!html.includes('data-center-calendar-filter="itemType"'))
}

const loadingHtml = render(false, {
  availabilityStatus: 'loading',
  isLoading: true,
  message: 'Đang tải Lịch hoạt động bổ sung...',
})
assertUnavailableControls(loadingHtml, 'loading', 'Đang tải')
assert(!loadingHtml.includes('hiện chưa khả dụng'))
assert(!loadingHtml.includes('hiện chưa tải được'))

const unavailableHtml = render(false, {
  availabilityStatus: 'unavailable',
  messageTone: 'warning',
  message: 'Lịch hoạt động bổ sung hiện chưa khả dụng.',
})
assertUnavailableControls(unavailableHtml, 'unavailable', 'Chưa khả dụng')
assert(unavailableHtml.includes('c57-shared-truth-notice is-warning'))
assert(!unavailableHtml.includes('c57-shared-truth-notice is-error'))

const failedHtml = render(false, {
  availabilityStatus: 'failed',
  messageTone: 'error',
  message: 'Lịch hoạt động bổ sung hiện chưa tải được.',
})
assertUnavailableControls(failedHtml, 'failed', 'Chưa tải được')
assert(failedHtml.includes('c57-shared-truth-notice is-error'))

const availableHtml = render(true, {
  availabilityStatus: 'ready',
  messageTone: 'success',
})
assert(availableHtml.includes('data-center-calendar-action="open-create"'))
assert(availableHtml.includes('data-center-calendar-tag-action="open-manager"'))
assert(!availableHtml.includes('data-schedule-optional-capability="calendar-notes"'))
assert(!availableHtml.includes('is-capability-unavailable'))

const scheduleRenderBranch = mainSource.slice(
  mainSource.indexOf("if (moduleItem.id === 'thoi-khoa-bieu')"),
  mainSource.indexOf("if (moduleItem.id === 'hoc-phi')"),
)
assert(scheduleRenderBranch.includes("isModuleUpstreamCurrent('thoi-khoa-bieu', 'calendar-notes')"))
assert(scheduleRenderBranch.includes('calendarNotesAvailable,'), 'Renderer must receive current capability truth.')

const eventBoundary = mainSource.slice(
  mainSource.indexOf('const canUseScheduleCalendarNotes = () =>'),
  mainSource.indexOf("document.querySelectorAll('[data-schedule-form-field]')"),
)
assert(eventBoundary.includes("isModuleUpstreamCurrent('thoi-khoa-bieu', 'calendar-notes')"))
assert(eventBoundary.includes("querySelector('[data-center-calendar-action=\"open-create\"]')"))
assert(eventBoundary.includes("querySelector('[data-center-calendar-tag-action=\"open-manager\"]')"))
assert(eventBoundary.includes("querySelectorAll('[data-center-calendar-tag-action]')"))
assert(eventBoundary.includes("querySelectorAll('[data-center-calendar-action]')"))
assert((eventBoundary.match(/if \(!canUseScheduleCalendarNotes\(\)\) return/g) || []).length >= 8)
assert(eventBoundary.includes("outcome_code: 'SHARED_TRUTH_NOT_CURRENT'"))

assert(scheduleCss.includes('.schedule-header-actions > button.is-capability-unavailable:disabled'))
assert(scheduleCss.includes('opacity: 1;'))
assert(scheduleCss.includes('[data-capability-state="loading"]:disabled'))
assert(scheduleCss.includes('[data-capability-state="failed"]:disabled'))

console.log('AR-1A Schedule optional capability visibility smoke passed.')
