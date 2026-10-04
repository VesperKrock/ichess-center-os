import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

// The authenticated run allows reads. Every Settings mutation is intercepted before the network.
const env = fs.readFileSync('.env.local', 'utf8')
const remoteOrigin = new URL(env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]).origin
const credentialChoice = JSON.parse(fs.readFileSync('artifacts/phongtrong-attendance-dataset/credential-selector.json', 'utf8'))
  .matches.find(item => item.role === 'owner').credentialIndex
const lines = fs.readFileSync('testgmailtk.txt', 'utf8').split(/\r?\n/)
const emailIndex = lines.map((line, index) => /^Gmail\s*:/i.test(line) ? index : -1).filter(index => index >= 0)[credentialChoice]
const email = lines[emailIndex].split(':').slice(1).join(':').trim()
const password = lines[emailIndex + 1].split(':').slice(1).join(':').trim()
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-m9-1-browser-'))
const proofDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-m9-1-proof-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const result = { viewport: '1536x728', proofDir, cases: {}, interceptedWrites: [], blockedWrites: [], exceptions: [], dialogs: [] }
let ws, commandId = 0, phase = 'login', dialogAccept = false, failNextSettingsRead = false
let lastCenterARead = null
const pending = new Map(), responseEndpoints = new Map()
try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100)
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++commandId, { resolve, reject })
    ws.send(JSON.stringify({ id: commandId, method, params }))
  })
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data), job = pending.get(message.id), params = message.params
    if (job) { pending.delete(message.id); message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result); return }
    if (message.method === 'Runtime.exceptionThrown') result.exceptions.push(params.exceptionDetails.exception?.description || params.exceptionDetails.text)
    if (message.method === 'Page.javascriptDialogOpening') {
      result.dialogs.push({ message: params.message, accepted: dialogAccept, phase })
      void cdp('Page.handleJavaScriptDialog', { accept: dialogAccept })
    }
    if (message.method === 'Network.requestWillBeSent' && params.request.url.startsWith(remoteOrigin + '/rest/v1/')) {
      const endpoint = params.request.url.slice((remoteOrigin + '/rest/v1/').length).split('?')[0]
      if (endpoint === 'rpc/v2_1_list_center_settings') responseEndpoints.set(params.requestId, phase)
    }
    if (message.method === 'Network.loadingFinished' && responseEndpoints.has(params.requestId)) {
      responseEndpoints.delete(params.requestId)
      void cdp('Network.getResponseBody', { requestId: params.requestId }).then(body => {
        const payload = JSON.parse(body.body)
        if (payload.center_id === 'phongtrong_prod' && payload.ok) lastCenterARead = payload
      }).catch(() => {})
    }
    if (message.method !== 'Fetch.requestPaused') return
    const request = params.request
    const rest = request.url.startsWith(remoteOrigin + '/rest/v1/')
    const storage = request.url.startsWith(remoteOrigin + '/storage/v1/')
    const endpoint = rest ? request.url.slice((remoteOrigin + '/rest/v1/').length).split('?')[0] : 'storage'
    if (endpoint === 'rpc/v2_1_list_center_settings' && failNextSettingsRead) {
      failNextSettingsRead = false
      void cdp('Fetch.failRequest', { requestId: params.requestId, errorReason: 'Failed' })
      return
    }
    if (endpoint === 'rpc/v2_1_mutate_center_settings') {
      result.blockedWrites.push({ endpoint, method: request.method, phase })
      void cdp('Fetch.failRequest', { requestId: params.requestId, errorReason: 'BlockedByClient' })
      return
    }
    const read = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      || rest && endpoint.startsWith('rpc/') && /(?:^|_)(?:get|list|read|verify)(?:_|$)/.test(endpoint)
    if (read) void cdp('Fetch.continueRequest', { requestId: params.requestId })
    else if (rest || storage) {
      result.blockedWrites.push({ endpoint, method: request.method, phase })
      void cdp('Fetch.failRequest', { requestId: params.requestId, errorReason: 'BlockedByClient' })
    } else void cdp('Fetch.continueRequest', { requestId: params.requestId })
  })
  const evaluate = async expression => {
    const value = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text)
    return value.result.value
  }
  const waitFor = async (expression, timeout = 25000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) { if (await evaluate(expression)) return; await delay(140) }
    throw new Error(`UI timeout in ${phase}: ${expression}`)
  }
  const click = async selector => {
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    await evaluate(`(()=>{document.activeElement?.blur();document.querySelector(${JSON.stringify(selector)}).click()})()`)
  }
  const clickPhysical = async selector => {
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    const point = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
    await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
  }
  const set = async (selector, value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));})()`)
  const screenshot = async name => {
    const image = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(path.join(proofDir, `${name}.png`), Buffer.from(image.data, 'base64'))
  }
  const openEdit = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await waitFor('document.querySelector("[data-settings-center-action=\\"open-edit\\"]")?.disabled===false')
      await click('[data-settings-center-action="open-edit"]')
      await delay(180)
      if (await evaluate('!!document.querySelector("[data-settings-center-form]")')) return
    }
    throw new Error(`Profile form did not remain open in ${phase}`)
  }
  const submitMockedProfile = async () => {
    await waitFor('document.querySelector("[data-settings-center-form] button[type=\\"submit\\"]")?.disabled===false')
    await evaluate('document.activeElement?.blur()')
    await evaluate(`document.querySelector('[data-settings-center-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`)
  }
  const switchCenter = async id => {
    phase = `switch-${id}`
    await evaluate('document.activeElement?.blur()')
    await evaluate(`window.location.hash='#/internal/centers'`)
    const selector = `[data-internal-open-center-id="${id}"]:not(:disabled)`
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    await click(selector)
    await waitFor('!!document.querySelector(".settings-module")')
    await click('[data-settings-tab="center-info"]')
    await waitFor('document.querySelector("[data-settings-center-action=\\"open-edit\\"]")?.disabled===false')
  }
  const mutationCount = () => evaluate('window.__m9Mutations.length')
  const waitForMutationCount = async count => {
    for (let i = 0; i < 80 && await mutationCount() < count; i++) await delay(100)
    const actual = await mutationCount()
    if (actual !== count) {
      const state = await evaluate(`(()=>({center:document.body.innerText.match(/Cơ sở:\\s*[^\\n]+/)?.[0],form:!!document.querySelector('[data-settings-center-form]'),error:document.querySelector('.settings-form-error')?.innerText,fields:[...document.querySelectorAll('[data-settings-center-field]')].map(x=>({name:x.dataset.settingsCenterField,value:x.value,valid:x.validity.valid})),refreshDisabled:document.querySelector('[data-module-authoritative-refresh="cai-dat-co-so"]')?.disabled}))()`)
      throw new Error(`Expected ${count} mocked Settings commands; got ${actual} in ${phase}: ${JSON.stringify(state)}`)
    }
  }
  const resolveMutation = async (index, kind, centerId = 'phongtrong_prod') => evaluate(`window.__m9ResolveMutation(${index}, ${JSON.stringify(kind)}, ${JSON.stringify(centerId)})`)
  await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Network.enable')
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
    const originalFetch = window.fetch.bind(window)
    window.__m9Mutations = []
    window.__m9PendingMutations = []
    window.__m9MockNextRead = null
    window.__m9HoldNextRead = false
    window.__m9HeldReads = []
    window.__m9ResolveRead = (index, payload) => {
      const pending = window.__m9HeldReads[index]
      if (!pending) throw new Error('No pending mocked Settings read')
      pending.resolve(new Response(JSON.stringify(payload),
        { status: 200, headers: { 'content-type': 'application/json' } }))
    }
    window.__m9ResolveMutation = (index, kind, centerId) => {
      const pending = window.__m9PendingMutations[index]
      if (!pending) throw new Error('No pending mocked Settings command')
      pending.resolve(new Response(JSON.stringify(kind === 'success'
        ? { ok: true, outcome_code: 'COMMITTED', center_id: centerId }
        : { ok: false, outcome_code: 'STALE_VERSION', center_id: centerId }),
        { status: 200, headers: { 'content-type': 'application/json' } }))
    }
    window.fetch = async (resource, options) => {
      const url = typeof resource === 'string' ? resource : resource?.url || resource?.href || ''
      if (url.includes('/rpc/v2_1_mutate_center_settings')) {
        const body = options?.body || (resource?.clone ? await resource.clone().text() : '{}')
        try { window.__m9Mutations.push(JSON.parse(body)) } catch { window.__m9Mutations.push({}) }
        return new Promise(resolve => window.__m9PendingMutations.push({ resolve }))
      }
      if (url.includes('/rpc/v2_1_list_center_settings') && window.__m9MockNextRead) {
        const payload = window.__m9MockNextRead
        window.__m9MockNextRead = null
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      if (url.includes('/rpc/v2_1_list_center_settings') && window.__m9HoldNextRead) {
        window.__m9HoldNextRead = false
        return new Promise(resolve => window.__m9HeldReads.push({ resolve }))
      }
      return originalFetch(resource, options)
    }
  })()` })
  await cdp('Fetch.enable', { patterns: [
    { urlPattern: `${remoteOrigin}/rest/v1/*`, requestStage: 'Request' },
    { urlPattern: `${remoteOrigin}/storage/v1/*`, requestStage: 'Request' },
  ] })
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1536, height: 728, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/ichess-center-os/' })
  await waitFor('!!document.querySelector("[data-cloud-login-form]")')
  await delay(1000)
  await set('[data-cloud-login-form] [name="email"]', email)
  await set('[data-cloud-login-form] [name="password"]', password)
  await clickPhysical('[data-cloud-login-form] button[type="submit"]')
  await waitFor('!!document.querySelector("[data-internal-open-center-id]") || !!document.querySelector("[data-module-launcher]")')
  if (!(await evaluate(`document.body.innerText.includes('Cơ sở: Phòng Trống')&&!!document.querySelector('[data-module-launcher]')`))) {
    await evaluate(`window.location.hash='#/internal/centers'`)
    await waitFor('!!document.querySelector("[data-internal-open-center-id=\\"phongtrong_prod\\"]:not(:disabled)")')
    await click('[data-internal-open-center-id="phongtrong_prod"]:not(:disabled)')
    await waitFor('!!document.querySelector("[data-module-launcher]")')
  }
  phase = 'settings-open'
  await clickPhysical('[data-module-launcher][data-module-id="cai-dat-co-so"]')
  await waitFor('!!document.querySelector(".settings-module")')
  await click('[data-settings-tab="center-info"]')
  await waitFor('document.querySelector("[data-settings-center-action=\\"open-edit\\"]")?.disabled===false')
  const centerText = await evaluate('document.querySelector(".settings-center-profile-card")?.innerText')
  assert.match(centerText, /Phòng Trống/)
  assert.match(centerText, /0\s*₫/)
  assert.doesNotMatch(centerText, /PHÍ GIÁO TRÌNH KHI TÁI ĐĂNG KÝ\s+Chưa cập nhật/)
  assert.doesNotMatch(await evaluate('document.querySelector(".settings-appearance-panel")?.innerText'), /desktop|\bOwner\b|lớp phủ tương phản/i)
  await screenshot('center-light')
  await openEdit()
  result.cases.profileMoneyValidity = await evaluate(`(()=>{const e=document.querySelector('[data-settings-center-field="renewalMaterialFee"]');return [0,500,1000,1500].map(x=>{e.value=String(x);return {value:x,valid:e.validity.valid,stepMismatch:e.validity.stepMismatch}})})()`)
  assert(result.cases.profileMoneyValidity.every(x => x.valid && !x.stepMismatch))
  const originalName = await evaluate('document.querySelector("[data-settings-center-field=\\"displayName\\"]").value')
  await set('[data-settings-center-field="displayName"]', `${originalName} LOCAL-DRAFT`)
  phase = 'same-center-refresh'
  await clickPhysical('[data-module-authoritative-refresh="cai-dat-co-so"]')
  await waitFor('document.querySelector("[data-settings-center-action=\\"open-edit\\"]")?.disabled===false')
  assert.equal(await evaluate('document.querySelector("[data-settings-center-field=\\"displayName\\"]")?.value'), `${originalName} LOCAL-DRAFT`)
  await click('[data-settings-center-action="cancel"]')
  await openEdit()
  assert.equal(await evaluate('document.querySelector("[data-settings-center-field=\\"displayName\\"]")?.value'), originalName)
  await set('[data-settings-center-field="displayName"]', `${originalName} SWITCH-DRAFT`)
  assert(lastCenterARead)
  await evaluate('window.__m9HoldNextRead=true')
  await clickPhysical('[data-module-authoritative-refresh="cai-dat-co-so"]')
  await waitFor('window.__m9HeldReads.length===1')
  await switchCenter('phongtester_prod')
  await evaluate(`window.__m9ResolveRead(0, ${JSON.stringify(lastCenterARead)})`)
  await openEdit()
  assert.equal(await evaluate('document.querySelector("[data-settings-center-field=\\"displayName\\"]")?.value'), 'Phòng Tester')
  result.cases.lateOldCenterReadIgnored = true
  await click('[data-settings-center-action="cancel"]')
  await switchCenter('phongtrong_prod')

  phase = 'read-failure'
  failNextSettingsRead = true
  await clickPhysical('[data-module-authoritative-refresh="cai-dat-co-so"]')
  await waitFor('document.querySelector(".settings-center-profile-card")?.innerText.includes("Chưa tải được Cài đặt cơ sở")')
  const failedText = await evaluate('document.querySelector(".settings-center-profile-card")?.innerText')
  assert.doesNotMatch(failedText, /Đang tắt|Chưa thiết lập|Chưa cập nhật/)
  await screenshot('read-error-light')
  phase = 'read-recovery'
  await waitFor('document.querySelector("[data-module-authoritative-refresh=\\"cai-dat-co-so\\"]")?.disabled===false')
  await clickPhysical('[data-module-authoritative-refresh="cai-dat-co-so"]')
  await waitFor('document.querySelector("[data-settings-center-action=\\"open-edit\\"]")?.disabled===false')
  await click('[data-settings-tab="tuition-packages"]')
  await click('[data-settings-package-action="open-create"]')
  result.cases.packageMoneyValidity = await evaluate(`(()=>{const e=document.querySelector('[data-settings-package-field="defaultAmount"]');return [0,500,1000,1500].map(x=>{e.value=String(x);return {value:x,valid:e.validity.valid,stepMismatch:e.validity.stepMismatch}})})()`)
  assert(result.cases.packageMoneyValidity.every(x => x.valid && !x.stepMismatch))
  await set('[data-settings-package-field="packageName"]', 'QA LOCAL')
  await set('[data-settings-package-field="totalSessions"]', '12')
  await set('[data-settings-package-field="defaultAmount"]', '')
  await evaluate('document.activeElement?.blur()')
  await evaluate(`document.querySelector('[data-settings-package-form]').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))`)
  result.cases.packageAfterSubmit = await evaluate(`(()=>({form:!!document.querySelector('[data-settings-package-form]'),text:document.querySelector('[data-settings-package-form]')?.innerText.slice(-350),ready:document.querySelector('[data-settings-package-form] button[type="submit"]')?.disabled}))()`)
  await waitFor('document.querySelector("[data-settings-package-form]")?.innerText.includes("Nhập học phí mặc định")')
  assert.equal(await mutationCount(), 0)
  await screenshot('package-validation-light')
  await click('[data-settings-package-action="cancel"]')
  phase = 'deactivate-cancel'
  dialogAccept = false
  await click('[data-settings-package-action="toggle-status"]')
  await waitFor('document.querySelector("[data-settings-package-action=\\"toggle-status\\"]")!==null')
  assert.equal(await mutationCount(), 0)
  assert.match(result.dialogs.at(-1)?.message || '', /không còn được chọn cho lượt gán học phí mới/)
  phase = 'deactivate-confirm'
  dialogAccept = true
  await click('[data-settings-package-action="toggle-status"]')
  await waitForMutationCount(1)
  const deactivatePayload = (await evaluate('window.__m9Mutations'))[0]
  assert.equal(deactivatePayload.p_center_id, 'phongtrong_prod')
  assert.equal(deactivatePayload.p_command.operation, 'SET_TUITION_PACKAGE_STATUS')
  assert.equal(deactivatePayload.p_command.is_active, false)
  assert.equal(await evaluate('document.querySelector("[data-settings-package-action=\\"toggle-status\\"]")?.disabled'), true)
  await click('[data-settings-package-action="toggle-status"]')
  await delay(150)
  assert.equal(await mutationCount(), 1, 'Rapid second click must not dispatch another command')
  await resolveMutation(0, 'failure')
  result.cases.deactivate = { cancelDispatch: 0, confirmDispatch: 1, centerId: deactivatePayload.p_center_id,
    packageId: deactivatePayload.p_command.package_id }
  await click('[data-settings-tab="center-info"]')
  await openEdit()
  phase = 'hold-late-success'
  await set('[data-settings-center-field="displayName"]', `${originalName} MOCK-SUCCESS`)
  await submitMockedProfile()
  await waitForMutationCount(2)
  await switchCenter('phongtester_prod')
  await openEdit()
  await set('[data-settings-center-field="displayName"]', 'Phòng Tester B-DRAFT')
  await resolveMutation(1, 'success')
  await delay(450)
  assert.equal(await evaluate('document.querySelector("[data-settings-center-field=\\"displayName\\"]")?.value'), 'Phòng Tester B-DRAFT')
  result.cases.lateSuccessPreservedB = true
  await switchCenter('phongtrong_prod')
  await openEdit()
  phase = 'hold-late-failure'
  await set('[data-settings-center-field="displayName"]', `${originalName} MOCK-FAILURE`)
  await submitMockedProfile()
  await waitForMutationCount(3)
  await switchCenter('phongtester_prod')
  await openEdit()
  await set('[data-settings-center-field="displayName"]', 'Phòng Tester B-DRAFT-2')
  await resolveMutation(2, 'failure')
  await delay(450)
  assert.equal(await evaluate('document.querySelector("[data-settings-center-field=\\"displayName\\"]")?.value'), 'Phòng Tester B-DRAFT-2')
  result.cases.lateFailurePreservedB = true
  await switchCenter('phongtrong_prod')
  await openEdit()
  phase = 'same-context-failure'
  await set('[data-settings-center-field="displayName"]', `${originalName} MOCK-RETRY`)
  await submitMockedProfile()
  await waitForMutationCount(4)
  await resolveMutation(3, 'failure')
  await waitFor('!!document.querySelector(".settings-form-error")')
  assert.match(await evaluate('document.querySelector(".settings-form-error")?.innerText'), /Cài đặt đã thay đổi/)
  assert.equal(await evaluate('document.querySelector("[data-settings-center-field=\\"displayName\\"]")?.value'), `${originalName} MOCK-RETRY`)
  result.cases.sameContextFailureRetained = true
  phase = 'normal-save'
  await set('[data-settings-center-field="displayName"]', `${originalName} MOCK-NORMAL`)
  await submitMockedProfile()
  await waitForMutationCount(5)
  assert.equal(await evaluate('document.querySelector("[data-module-authoritative-refresh=\\"cai-dat-co-so\\"]")?.disabled'), true,
    'Settings refresh stays disabled while the mocked save is in flight')
  result.cases.refreshDeferredDuringSave = true
  // The next authoritative read is mocked to show the command's committed value; nothing is sent to production.
  assert(lastCenterARead)
  const committedRead = structuredClone(lastCenterARead)
  committedRead.center.display_name = `${originalName} MOCK-NORMAL`
  committedRead.center.version += 1
  await evaluate(`window.__m9MockNextRead=${JSON.stringify(committedRead)}`)
  await resolveMutation(4, 'success')
  await delay(800)
  result.cases.normalAfterResponse = await evaluate(`(()=>({form:!!document.querySelector('[data-settings-center-form]'),error:document.querySelector('.settings-form-error')?.innerText,notice:document.querySelector('.settings-capability-notice')?.innerText,profile:document.querySelector('.settings-center-profile-card')?.innerText.slice(0,170)}))()`)
  await waitFor('!document.querySelector("[data-settings-center-form]")')
  assert.match(await evaluate('document.querySelector(".settings-center-profile-card")?.innerText'), /MOCK-NORMAL/)
  result.cases.normalMockSave = true
  await click('[data-action="toggle-start"]'); await click('[data-ui-theme="dark"]')
  if (await evaluate(`document.querySelector('[data-action="toggle-start"]').getAttribute('aria-expanded')==='true'`)) await click('[data-action="toggle-start"]')
  await screenshot('center-dark')
  result.cases.darkVisible = await evaluate('!!document.querySelector(".settings-center-profile-card")')
  assert.equal(result.cases.darkVisible, true)
  await click('[data-settings-tab="tuition-packages"]')
  await click('[data-settings-package-action="open-create"]')
  await screenshot('package-dark')
  await click('[data-settings-package-action="cancel"]')
  await click('[data-settings-tab="center-info"]')
  phase = 'dark-read-failure'
  await waitFor('document.querySelector("[data-module-authoritative-refresh=\\"cai-dat-co-so\\"]")?.disabled===false')
  failNextSettingsRead = true
  await clickPhysical('[data-module-authoritative-refresh="cai-dat-co-so"]')
  await waitFor('document.querySelector(".settings-center-profile-card")?.innerText.includes("Chưa tải được Cài đặt cơ sở")')
  assert.doesNotMatch(await evaluate('document.querySelector(".settings-center-profile-card")?.innerText'), /Đang tắt|Chưa thiết lập|Chưa cập nhật/)
  await screenshot('read-error-dark')
  result.cases.darkReadFailureVisible = true
  assert.equal(result.blockedWrites.length, 0)
  assert.equal(result.exceptions.length, 0)
  result.interceptedWrites = (await evaluate('window.__m9Mutations')).map((payload, index) => ({
    index, centerId: payload.p_center_id, operation: payload.p_command?.operation,
  }))
  result.status = 'PASS'
} catch (error) {
  result.status = 'FAIL'
  result.error = String(error?.stack || error)
} finally {
  fs.writeFileSync(path.join(proofDir, 'browser-proof.json'), JSON.stringify(result, null, 2))
  ws?.close()
  chrome.kill()
  await delay(300)
  const resolvedTemp = path.resolve(os.tmpdir())
  const resolvedProfile = path.resolve(profile)
  if (resolvedProfile.startsWith(`${resolvedTemp}${path.sep}`)) {
    try { fs.rmSync(resolvedProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) } catch { /* Chrome may still be releasing its temporary profile. */ }
  }
  console.log(JSON.stringify({ status: result.status, error: result.error, proofDir, cases: result.cases,
    interceptedWrites: result.interceptedWrites,
    blockedWrites: result.blockedWrites, exceptions: result.exceptions, dialogCount: result.dialogs.length }, null, 2))
  if (result.status !== 'PASS') process.exitCode = 1
}
