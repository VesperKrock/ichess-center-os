import assert from 'node:assert/strict'
import fs from 'node:fs'

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

assert(mainSource.includes('let moduleNotificationOutsidePointerBound = false'))
assert(mainSource.includes('bindModuleNotificationOutsidePointer()'))
assert(mainSource.includes('function bindModuleNotificationOutsidePointer()'))

const handlerStart = mainSource.indexOf('function bindModuleNotificationOutsidePointer()')
const handlerEnd = mainSource.indexOf('function getNotificationPanelPosition', handlerStart)
const handlerSource = mainSource.slice(handlerStart, handlerEnd)

assert(handlerSource.includes('document.addEventListener(\'pointerdown\''))
assert(handlerSource.includes('.module-notification-bell, .schedule-alert-bell'))
assert(handlerSource.includes('.module-notification-bell[open], .schedule-alert-bell[open]'))
assert(handlerSource.includes('target.closest?'))
assert(handlerSource.includes('bell === activeBell'))
assert(handlerSource.includes('bell.contains(target)'))
assert(handlerSource.includes('bell.removeAttribute(\'open\')'))

const globalNotificationStart = mainSource.indexOf('function bindNotificationOutsidePointer()')
const globalNotificationEnd = mainSource.indexOf('function bindModuleNotificationOutsidePointer()', globalNotificationStart)
const globalNotificationSource = mainSource.slice(globalNotificationStart, globalNotificationEnd)
assert(globalNotificationSource.includes('isNotificationCenterOpen'))
assert(globalNotificationSource.includes('.notification-center'))
assert(globalNotificationSource.includes('[data-action="toggle-notifications"]'))

const renderModuleBellStart = mainSource.indexOf('function renderModuleNotificationBell')
const renderModuleBellEnd = mainSource.indexOf('function renderWindowBody', renderModuleBellStart)
const renderModuleBellSource = mainSource.slice(renderModuleBellStart, renderModuleBellEnd)
assert(renderModuleBellSource.includes('<details class="module-notification-bell"'))
assert(renderModuleBellSource.includes('module-notification-popover'))

const scheduleSource = fs.readFileSync(new URL('../src/schedule-module.js', import.meta.url), 'utf8')
assert(scheduleSource.includes('<details class="schedule-alert-bell"'))
assert(scheduleSource.includes('schedule-alert-popover'))

const scopedSources = [handlerSource, renderModuleBellSource].join('\n')
for (const pattern of ['CĂ¡Âº', 'Ăƒ', 'Ă†Â°', 'HĂ¡Âº']) {
  assert(!scopedSources.includes(pattern), `Module bell hotfix contains mojibake pattern ${pattern}`)
}

for (const forbiddenText of ['prototype', 'placeholder', 'sẽ triển khai', 'debug']) {
  assert(!handlerSource.toLowerCase().includes(forbiddenText), `Outside-click handler includes ${forbiddenText}`)
}

const cloudSources = [
  '../src/cloud-attendance-records.js',
  '../src/cloud-session-reports.js',
  '../src/cloud-schedule-sessions.js',
  '../src/cloud-tuition-records.js',
  '../src/cloud-tuition-terms.js',
].map((filePath) => fs.readFileSync(new URL(filePath, import.meta.url), 'utf8')).join('\n')
assert(cloudSources.includes('NEEDS SQL/ALLOWLIST PATCH'))

console.log('F19H.2 hotfix dong chuong module khi bam ra ngoai smoke passed')
