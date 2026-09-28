import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

// Authenticated localhost with its configured remote. No mocks, boot hooks,
// synthetic browser records or source transforms. All writes use A5 UI and
// are restricted to the exact isolated QA center by the network guard.
const folder = path.resolve('artifacts/a6-attendance-board')
const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'qa-manifest.json'), 'utf8'))
const env = fs.readFileSync('.env.local', 'utf8')
const remoteOrigin = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]).origin
const lines = fs.readFileSync('testgmailtk.txt', 'utf8').split(/\r?\n/)
const emailIndex = lines.findIndex(line => /^Gmail\s*:/i.test(line))
const email = lines[emailIndex].split(':').slice(1).join(':').trim()
const password = lines[emailIndex + 1].split(':').slice(1).join(':').trim()
assert(email.includes('@') && password)
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-a6-browser-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const report = { type: 'authenticated-real-app', viewport: [1536, 728], centerId: manifest.centerId,
  requests: [], exceptions: [], blockedWrites: [], cases: {}, geometry: [] }
let ws, commandId = 0, phase = 'login'
const pending = new Map(), requests = new Map()
try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let index = 0; index < 150 && !fs.existsSync(portFile); index++) await delay(100)
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++commandId, { resolve, reject }); ws.send(JSON.stringify({ id: commandId, method, params }))
  })
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const job = pending.get(message.id)
    if (job) { pending.delete(message.id); message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result); return }
    const params = message.params
    if (message.method === 'Runtime.exceptionThrown') report.exceptions.push(params.exceptionDetails)
    if (message.method === 'Network.requestWillBeSent' && params.request.url.startsWith(remoteOrigin + '/rest/v1/')) {
      const endpoint = params.request.url.slice((remoteOrigin + '/rest/v1/').length).split('?')[0]
      const request = { endpoint, method: params.request.method, phase }
      if (params.request.postData) {
        const data = JSON.parse(params.request.postData)
        if (data.p_center_id) request.centerId = data.p_center_id
        if (endpoint === 'rpc/v2_3_mutate_occurrence_attendance') {
          request.schedule = data.p_schedule_session_id
          request.date = data.p_occurrence_date
          request.attendance = data.p_attendance.map(row => ({ student: row.student_id, status: row.attendance_status }))
        }
      }
      requests.set(params.requestId, request); report.requests.push(request)
    }
    if (message.method === 'Network.responseReceived') {
      const request = requests.get(params.requestId); if (request) request.status = params.response.status
    }
    if (message.method === 'Fetch.requestPaused') {
      const request = params.request
      const endpoint = request.url.slice((remoteOrigin + '/rest/v1/').length).split('?')[0]
      const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
        || endpoint.startsWith('rpc/') && /(?:^|_)(?:get|list|read|verify)_/.test(endpoint)
      const data = request.postData ? JSON.parse(request.postData) : {}
      const isolatedWrite = phase.startsWith('schedule') && data.p_center_id === manifest.centerId
        && endpoint === 'rpc/v2_3_mutate_occurrence_attendance'
        && ['a6qa_original', 'a6qa_held', 'a6qa_makeup'].includes(data.p_schedule_session_id)
      if (read || isolatedWrite) cdp('Fetch.continueRequest', { requestId: params.requestId }).catch(() => {})
      else { report.blockedWrites.push({ endpoint, method: request.method, phase }); cdp('Fetch.failRequest', { requestId: params.requestId, errorReason: 'BlockedByClient' }).catch(() => {}) }
    }
  })
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value
  }
  const waitFor = async (expression, timeout = 45000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(150) }
    const content = String(await evaluate('document.body.innerText')).replaceAll(email, '[QA account]').slice(-3500)
    throw new Error(`UI timeout: ${expression}; ${content}`)
  }
  const click = async selector => {
    let point
    // Authoritative refresh can replace the desktop DOM between inspection
    // and pointer dispatch; retry against the current element without mocks.
    for (let attempt = 0; attempt < 12; attempt++) {
      await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
      await evaluate(`document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest',inline:'nearest'})`)
      await delay(100)
      point = await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)return null;const r=el.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return{x,y,correct:!!hit&&(hit===el||el.contains(hit))};})()`)
      if (point?.correct) break
      await delay(150)
    }
    assert(point?.correct, `Covered UI control: ${selector}`)
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 })
    await delay(150)
  }
  const set = async (selector, value, type = 'change') => {
    await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event(${JSON.stringify(type)},{bubbles:true}));})()`)
    await delay(200)
  }
  const screenshot = async name => {
    const capture = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(path.join(folder, `${name}.png`), Buffer.from(capture.data, 'base64'))
  }
  const boardReady = async () => waitFor('!!document.querySelector(".attendance-ledger-sheet") && !document.querySelector(".attendance-ledger .attendance-board-empty")')
  const selectorFor = (student, schedule) => `[data-attendance-cell-detail][data-student-id="a6qa_student_${student}"][data-schedule-session-id="a6qa_${schedule}"]`
  const stateFor = async (student, schedule) => evaluate(`document.querySelector(${JSON.stringify(selectorFor(student, schedule))})?.closest('[data-attendance-ledger-state]').dataset.attendanceLedgerState`)
  const headerFor = schedule => `[data-attendance-occurrence-detail][data-schedule-session-id="a6qa_${schedule}"]`
  const detailRoute = async schedule => {
    await click(headerFor(schedule))
    for (let attempt = 0; attempt < 4; attempt++) {
      await click('[data-attendance-open-occurrence]')
      await delay(700)
      if (!(await evaluate('!!document.querySelector("[data-attendance-open-occurrence]")'))) break
    }
    await waitFor('!!document.querySelector("[data-admin-attendance-action=save]:not(:disabled)")')
    const panel = await evaluate('document.querySelector(".schedule-admin-attendance-panel").innerText')
    assert(panel.includes(`${manifest.dates[schedule].slice(8, 10)}/${manifest.dates[schedule].slice(5, 7)}/${manifest.dates[schedule].slice(0, 4)}`), 'Schedule must open the requested occurrence before editing')
    if (schedule === 'second') assert(panel.includes('19:00'))
  }
  const save = async () => {
    const previous = report.requests.filter(request => request.endpoint === 'rpc/v2_3_mutate_occurrence_attendance' && request.method === 'POST').length
    if (!(await evaluate('!!document.querySelector("[data-admin-attendance-action=save]:not(:disabled)")'))) {
      await click('.is-schedule-window [data-module-authoritative-refresh="thoi-khoa-bieu"]')
    }
    await waitFor('!!document.querySelector("[data-admin-attendance-action=save]:not(:disabled)")')
    await click('[data-admin-attendance-action="save"]:not(:disabled)')
    await waitFor(`document.querySelector('.schedule-admin-attendance-panel')?.innerText.includes('Đã lưu điểm danh')`)
    const writes = report.requests.filter(request => request.endpoint === 'rpc/v2_3_mutate_occurrence_attendance' && request.method === 'POST')
    assert.equal(writes.length, previous + 1)
    assert.equal(writes.at(-1).status, 200)
  }
  const closeSchedule = async () => click('.is-schedule-window [data-window-action="close"]')
  const refreshBoard = async () => { await click('.is-attendance-window [data-module-authoritative-refresh="bang-diem-danh"]'); await boardReady() }
  const openBoard = async () => {
    await click('[data-module-launcher][data-module-id="bang-diem-danh"]')
    await waitFor('!!document.querySelector("[data-attendance-read-only]")')
    await set('[data-attendance-board-filter="toDate"]', manifest.toDate)
    await set('[data-attendance-board-filter="fromDate"]', manifest.dates.original)
    await boardReady()
  }

  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable')
  await cdp('Fetch.enable', { patterns: [{ urlPattern: `${remoteOrigin}/rest/v1/*`, requestStage: 'Request' }] })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1536, height: 728, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: 'http://localhost:5173/ichess-center-os/' })
  await waitFor('!!document.querySelector("[data-cloud-login-form]")')
  await click('[data-cloud-login-form] [name="email"]'); await cdp('Input.insertText', { text: email })
  await click('[data-cloud-login-form] [name="password"]'); await cdp('Input.insertText', { text: password })
  await click('[data-cloud-login-form] button[type="submit"]')
  await waitFor('!!document.querySelector("[data-internal-open-center-id]") || !!document.querySelector("[data-module-launcher]")')
  const currentCenter = await evaluate('document.body.innerText.includes("A6 Attendance QA") && !!document.querySelector("[data-module-launcher]")')
  if (!currentCenter && !(await evaluate(`!!document.querySelector('[data-internal-open-center-id="${manifest.centerId}"]')`))) {
    await cdp('Page.navigate', { url: 'http://localhost:5173/ichess-center-os/#/internal/centers' })
  }
  if (!currentCenter) await click(`[data-internal-open-center-id="${manifest.centerId}"]`)
  phase = 'board-initial'
  await openBoard()
  report.cases.authenticated = true
  assert.equal(await stateFor(0, 'held'), 'unmarked')
  assert.equal(await stateFor(0, 'future'), 'future')
  assert.equal(await stateFor(0, 'cancelled'), 'cancelled')
  assert.equal(await stateFor(2, 'unmarked'), 'unmarked', 'Report-only absence must not feed canonical Board')
  report.cases.reportOnlyExcluded = true
  console.log('A6_BROWSER_AUTHENTICATED_BOARD_READ_PASS')

  phase = 'schedule-original'
  await detailRoute('original')
  await click('[data-admin-attendance-student-id="a6qa_student_1"][value="absent"]')
  await save(); await closeSchedule()
  phase = 'schedule-held'
  await detailRoute('held')
  await click('[data-admin-attendance-student-id="a6qa_student_0"][value="present"]')
  await click('[data-admin-attendance-student-id="a6qa_student_1"][value="absent"]')
  await save(); await closeSchedule()
  phase = 'board-after-schedule-save'
  await refreshBoard()
  assert.equal(await stateFor(0, 'held'), 'present')
  assert.equal(await stateFor(1, 'held'), 'absent')
  assert.equal(await stateFor(2, 'held'), 'unmarked')
  report.cases.scheduleSaveBoardRefresh = true
  report.cases.partial = { expected: 18, marked: 2, untouched: 16 }
  console.log('A6_BROWSER_SCHEDULE_SAVE_BOARD_CANONICAL_PASS')

  phase = 'schedule-makeup'
  await detailRoute('makeup')
  await click('[data-admin-attendance-student-id="a6qa_student_1"][value="makeup"]')
  await waitFor('document.querySelector("[data-admin-makeup-target]")?.options.length > 1')
  const target = await evaluate(`(()=>{const picker=document.querySelector('[data-admin-makeup-target]');return [...picker.options].find(option=>option.textContent.includes('${manifest.dates.original.slice(8, 10)}/${manifest.dates.original.slice(5, 7)}'))?.value;})()`)
  assert(target, 'A4 original absence candidate must be available')
  await set('[data-admin-makeup-target]', target)
  await save(); await closeSchedule()
  phase = 'board-cases'
  await set('[data-attendance-board-filter="fromDate"]', manifest.fromDate)
  await boardReady(); await refreshBoard()
  assert.equal(await stateFor(1, 'makeup'), 'makeup')
  await click(selectorFor(1, 'makeup'))
  const detail = await evaluate('document.querySelector(".attendance-ledger-detail").innerText')
  assert(detail.includes(`Học bù cho buổi ${manifest.dates.original.slice(8, 10)}/${manifest.dates.original.slice(5, 7)}`))
  assert(detail.includes('Thầy Lịch sử') && detail.includes('Lớp A'))
  report.cases.makeupOriginalOutsideFilter = true
  await screenshot('makeup-original-detail-light')
  await click('.attendance-ledger-detail [data-attendance-detail-close]')
  await click(headerFor('second'))
  assert((await evaluate('document.querySelector(".attendance-ledger-detail").innerText')).includes('Cô Dạy thay'))
  await click('.attendance-ledger-detail [data-attendance-detail-close]')
  await click(headerFor('held'))
  const heldDetail = await evaluate('document.querySelector(".attendance-ledger-detail").innerText')
  assert(heldDetail.includes('Thầy Lịch sử') && !heldDetail.includes('Thầy Hiện tại') && !heldDetail.includes('Cô Dạy thay'))
  await click('.attendance-ledger-detail [data-attendance-detail-close]')
  report.cases.teacherHistoryAndSubstitute = true
  assert.equal(await evaluate(`[...document.querySelectorAll('[data-attendance-occurrence-key]')].filter(el=>el.dataset.attendanceOccurrenceKey.endsWith('|${manifest.dates.held}')).length`), 2)
  report.cases.sameDateSeparateColumns = true

  await set('[data-attendance-board-filter="classSessionId"]', 'a6qa_class_b')
  assert.equal(await evaluate('document.querySelectorAll("[data-attendance-occurrence-key]").length'), 1)
  await set('[data-attendance-board-filter="classSessionId"]', 'all')
  const teacherValue = await evaluate(`document.querySelector('[data-attendance-board-filter="teacherId"] option') && [...document.querySelector('[data-attendance-board-filter="teacherId"]').options].find(el=>el.textContent.includes('Cô Dạy thay'))?.value`)
  await set('[data-attendance-board-filter="teacherId"]', teacherValue)
  assert.equal(await evaluate('document.querySelectorAll("[data-attendance-occurrence-key]").length'), 1)
  await set('[data-attendance-board-filter="teacherId"]', 'all')
  await set('[data-attendance-board-filter="toDate"]', manifest.dates.held)
  await boardReady()
  assert.equal(await evaluate('document.querySelectorAll("[data-attendance-occurrence-key]").length'), 2)
  await set('[data-attendance-board-filter="toDate"]', manifest.toDate)
  await boardReady()
  const columnsBefore = await evaluate('document.querySelectorAll("[data-attendance-occurrence-key]").length')
  await set('[data-attendance-board-filter="query"]', 'Nguyen Hoang', 'input')
  assert.equal(await evaluate('document.querySelectorAll("[data-attendance-ledger-student]").length'), 1)
  assert.equal(await evaluate('document.querySelectorAll("[data-attendance-occurrence-key]").length'), columnsBefore)
  await set('[data-attendance-board-filter="query"]', '', 'input')
  report.cases.filtersAndSearch = true

  for (const theme of ['light', 'dark']) {
    // Use the existing theme paint attribute; no application state/data changes.
    await evaluate(`document.documentElement.dataset.uiTheme=${JSON.stringify(theme)}`)
    await delay(100)
    const geometry = await evaluate(`(()=>{
      const board=document.querySelector('.attendance-ledger'),scroll=board.querySelector('.attendance-ledger-scroll');
      const r=board.getBoundingClientRect();
      return {theme:document.documentElement.dataset.uiTheme,viewport:[innerWidth,innerHeight],pageOverflow:document.documentElement.scrollWidth>innerWidth,
        boardWithinViewport:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,
        horizontalScroll:scroll.scrollWidth>scroll.clientWidth,verticalScroll:scroll.scrollHeight>scroll.clientHeight,
        studentNames:[...board.querySelectorAll('.attendance-ledger-student strong')].every(el=>el.scrollWidth<=el.clientWidth),
        studentColumnWidth:board.querySelector('tbody .attendance-ledger-student').getBoundingClientRect().width,
        maxStudentRowHeight:Math.max(...[...board.querySelectorAll('tbody .attendance-ledger-student')].map(el=>el.getBoundingClientRect().height)),
        filters:[...board.querySelectorAll('[data-attendance-board-filter]')].every(el=>{const b=el.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight}),
        headerVisible:[...board.querySelectorAll('.attendance-ledger-sheet thead th')].every(el=>el.getBoundingClientRect().height>=50),
        controls:[...board.querySelectorAll('button,input,select,textarea')].map(el=>({tag:el.tagName,text:el.innerText,type:el.type})),
        foreground:getComputedStyle(board).color,background:getComputedStyle(board).backgroundColor};})()`)
    assert.equal(geometry.pageOverflow, false)
    assert(geometry.boardWithinViewport && geometry.horizontalScroll && geometry.verticalScroll && geometry.studentNames && geometry.filters && geometry.headerVisible)
    assert(geometry.studentColumnWidth >= 240, 'Student identity must not inherit the old 46px index-column width')
    assert(geometry.maxStudentRowHeight <= 76, 'Names must not wrap into vertical strips')
    await screenshot(`matrix-${theme}-1536x728`)
    await click(selectorFor(1, 'makeup'))
    geometry.detailWithinViewport = await evaluate(`(()=>{const r=document.querySelector('.attendance-ledger-detail').getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()`)
    assert(geometry.detailWithinViewport)
    await screenshot(`detail-${theme}-1536x728`)
    await click('.attendance-ledger-detail [data-attendance-detail-close]')
    // Scroll to the far right: Student identity stays frozen and headers remain visible.
    const sticky = await evaluate(`(()=>{const scroll=document.querySelector('.attendance-ledger-scroll'),before=document.querySelector('tbody .attendance-ledger-student').getBoundingClientRect().left;scroll.scrollLeft=scroll.scrollWidth;scroll.scrollTop=200;return{before,after:document.querySelector('tbody .attendance-ledger-student').getBoundingClientRect().left};})()`)
    assert(Math.abs(sticky.before - sticky.after) < 1)
    await screenshot(`matrix-scrolled-${theme}`)
    await evaluate(`(()=>{const scroll=document.querySelector('.attendance-ledger-scroll');scroll.scrollLeft=0;scroll.scrollTop=0;})()`)
    report.geometry.push(geometry)
  }
  assert.notEqual(report.geometry[0].background, report.geometry[1].background)
  report.cases.lightDarkGeometry = true
  const readonly = await evaluate(`(()=>{const board=document.querySelector('.attendance-ledger');return [...board.querySelectorAll('[data-attendance-baseline-action],[data-admin-attendance-action],[data-admin-attendance-status],[data-attendance-note-save],[data-attendance-cell-note-save],textarea,input:not([data-attendance-board-filter])')].length===0;})()`)
  assert(readonly)
  assert(report.requests.filter(request => request.phase.startsWith('board')).every(request => !/mutate|upsert|delete|set_|change_|manage_/.test(request.endpoint)))
  report.cases.readOnlyBoard = true
  report.cases.states = ['present', 'absent', 'makeup', 'unmarked', 'future', 'cancelled']

  // Read the real server projection through the normal Supabase singleton and
  // compare all 18 cells in the partial occurrence with canonical records.
  const remote = await evaluate(`(async()=>{const {getSupabaseClient}=await import('/ichess-center-os/src/supabase-client.js');const {data,error}=await getSupabaseClient().from('center_cloud_entities').select('local_id,payload,entity_version').eq('center_id',${JSON.stringify(manifest.centerId)}).eq('entity_type','attendance_record').is('deleted_at',null);if(error)throw new Error(error.message);return data;})()`)
  const heldRecords = remote.filter(row => row.payload.scheduleSessionId === 'a6qa_held')
  assert.equal(heldRecords.length, 2)
  for (let student = 0; student < 18; student++) {
    const row = heldRecords.find(row => row.payload.studentId === `a6qa_student_${student}`)
    assert.equal(await stateFor(student, 'held'), row?.payload.attendanceStatus || 'unmarked')
  }
  fs.writeFileSync(path.join(folder, 'canonical-qa-attendance.json'), JSON.stringify(remote, null, 2))
  report.cases.serverComparison = true
  // Finally prove routing, which is allowed to reveal only A5's editor.
  phase = 'schedule-route-proof'
  await click(selectorFor(0, 'held')); await click('[data-attendance-open-occurrence]')
  await waitFor('!!document.querySelector("[data-admin-attendance-action=save]")')
  assert((await evaluate('document.querySelector(".schedule-admin-attendance-panel").innerText')).includes('Thầy Lịch sử'))
  report.cases.editRoute = true
  await closeSchedule()
  assert.equal(report.exceptions.length, 0)
  assert.equal(report.blockedWrites.length, 0)
  assert.equal(report.requests.filter(request => request.endpoint === 'rpc/v2_3_mutate_occurrence_attendance' && request.method === 'POST').length, 3)
  report.passed = true
  console.log('A6_AUTHENTICATED_BROWSER_QA_PASS (A–L, Light/Dark, 1536x728)')
} catch (error) {
  report.error = String(error.stack || error.message).replaceAll(email, '[QA account]').replaceAll(password, '[secret]')
  console.error(report.error)
  process.exitCode = 1
} finally {
  fs.writeFileSync(path.join(folder, 'browser-proof.json'), JSON.stringify(report, null, 2))
  ws?.close(); chrome.kill()
}
