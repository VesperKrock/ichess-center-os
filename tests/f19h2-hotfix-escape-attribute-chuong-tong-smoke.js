import assert from 'node:assert/strict'
import fs from 'node:fs'

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const helperDefinitionIndex = mainSource.indexOf('function escapeAttribute(value)')
const helperCallIndex = mainSource.indexOf('escapeAttribute(summary.sourceModule)')

assert(helperDefinitionIndex > -1, 'main.js must define escapeAttribute before using it.')
assert(helperCallIndex > -1, 'Notification summary should still escape module id attributes.')
assert(mainSource.includes('return escapeHtml(value)'), 'escapeAttribute should reuse the existing text escape helper.')

const hotfixStart = mainSource.indexOf('function renderNotificationCenterHotfix')
const legacyStart = mainSource.indexOf('function renderNotificationCenter(', hotfixStart)
const hotfixRenderer = mainSource.slice(hotfixStart, legacyStart)

assert(hotfixRenderer.includes('notification-module-summary'))
assert(hotfixRenderer.includes('data-notification-module-id="${escapeAttribute(summary.sourceModule)}"'))
assert(hotfixRenderer.includes('aria-label="${escapeAttribute(summary.title)}"'))
assert(hotfixRenderer.includes('Trạng thái'))
assert(!hotfixRenderer.includes('data-notification-filter="sourceModule"'))
assert(!hotfixRenderer.includes('<span>Module</span>'))
assert(!hotfixRenderer.includes('Tất cả module'))

for (const pattern of ['CĂ¡Âº', 'Ăƒ', 'Ă†Â°', 'HĂ¡Âº']) {
  assert(!hotfixRenderer.includes(pattern), `Notification renderer contains mojibake pattern ${pattern}`)
}

for (const forbiddenText of ['prototype', 'placeholder', 'sẽ triển khai', 'debug']) {
  assert(!hotfixRenderer.toLowerCase().includes(forbiddenText), `Notification renderer includes ${forbiddenText}`)
}

console.log('F19H.2 hotfix escapeAttribute chuong tong smoke passed')
