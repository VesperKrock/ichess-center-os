import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import {spawnSync} from 'node:child_process'

// Runs the existing localhost application, with its real Vite environment and
// normal login UI. No response mocks, source transforms, SQL bridge or boot hook.
const mode = 'demo'
const phase=process.argv[2]||'before-ui'
assert(['before-ui','after-ui','operator','restored'].includes(phase))
const canaryId='stu-1783341134938'
const qa=phase==='operator'?JSON.parse(fs.readFileSync('artifacts/dreamhome-final-canary/qa-created.json','utf8')):null
if(phase==='operator')assert(!fs.existsSync('artifacts/dreamhome-final-canary/cleanup-result.json'),'Completed canary must not be set up again')
assert(['dreamhome', 'demo'].includes(mode))
const appUrl = 'http://localhost:5173/ichess-center-os/'
const env = fs.readFileSync('.env.local', 'utf8')
const remoteOrigin = new URL(
  env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1],
).origin
const credentialLines = fs
  .readFileSync('testgmailtk.txt', 'utf8')
  .split(/\r?\n/)
const emailIndex = credentialLines
  .map((line, index) => (/^Gmail\s*:/i.test(line) ? index : -1))
  .filter((i) => i >= 0)[mode === 'demo' ? 2 : 0]
const email = credentialLines[emailIndex]
  .slice(credentialLines[emailIndex].indexOf(':') + 1)
  .trim()
const password = credentialLines[emailIndex + 1]
  .slice(credentialLines[emailIndex + 1].indexOf(':') + 1)
  .trim()
assert(email.includes('@') && password)
const artifacts = path.resolve('artifacts/dreamhome-final-canary')
fs.mkdirSync(artifacts, { recursive: true })
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'ichess-tuition-real-remote-chrome-'),
)
fs.mkdirSync(profile, { recursive: true })
const report = {
  appUrl,
  remoteOrigin,
  centerId:'dreamhome_prod',
  environment:'production',
  mode,
  requests: [],
  runtimeExceptions: [],
  consoleErrors: [],
  blockedWrites: [],
  screenshots: [],
  observations: [],
  receiptCaughtErrors: [],
  assetRequests: [],
}
const chrome = spawn(
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let ws,
  commandId = 0,
  inspectPage
const pending = new Map(),
  requests = new Map(),
  responseJobs = new Set()
try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 150 && !fs.existsSync(portFile); i++) await delay(100)
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  const targets = await (
    await fetch(`http://127.0.0.1:${port}/json/list`)
  ).json()
  ws = new WebSocket(
    targets.find((target) => target.type === 'page').webSocketDebuggerUrl,
  )
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  const cdp = (method, params = {}) =>
    new Promise((resolve, reject) => {
      pending.set(++commandId, { resolve, reject })
      ws.send(JSON.stringify({ id: commandId, method, params }))
    })
  const evaluate = async (expression) => {
    const result = await cdp('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  inspectPage = evaluate
  // Security-sensitive response bodies and request headers are never collected.
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const job = pending.get(message.id)
    if (job) {
      pending.delete(message.id)
      message.error
        ? job.reject(new Error(JSON.stringify(message.error)))
        : job.resolve(message.result)
      return
    }
    const params = message.params
    if (message.method === 'Debugger.paused') {
      const description = params.data?.description || ''
      if (/tuition-receipt-pdf\.js|exportTuitionReceiptById/.test(description)) report.receiptCaughtErrors.push(description)
      cdp('Debugger.resume').catch(() => {})
    }
    if (message.method === 'Page.javascriptDialogOpening') {
      report.observations.push({
        dialog: params.type,
        message: params.message,
      })
      cdp('Page.handleJavaScriptDialog', {
        accept: mode === 'demo' && params.type === 'confirm',
      }).catch(() => {})
    }
    if (message.method === 'Runtime.exceptionThrown')
      report.runtimeExceptions.push(params.exceptionDetails)
    if (
      message.method === 'Runtime.consoleAPICalled' &&
      params.type === 'error'
    )
      report.consoleErrors.push({
        type: params.type,
        text: params.args.map((arg) => arg.value || arg.description).join(' '),
      })
    if (
      message.method === 'Network.requestWillBeSent' &&
      params.request.url.startsWith(remoteOrigin + '/rest/v1/')
    ) {
      const request = {
        requestId: params.requestId,
        url: params.request.url,
        method: params.request.method,
      }
      const args = params.request.postData
        ? JSON.parse(params.request.postData)
        : null
      if (args?.p_center_id) request.centerId = args.p_center_id
      if (mode === 'demo' && /mutate/.test(request.url))
        request.arguments = args
      requests.set(params.requestId, request)
      report.requests.push(request)
    }
    if (message.method === 'Network.requestWillBeSent' && params.request.url.startsWith(appUrl)
      && /tuition-receipt|fontkit/.test(params.request.url)) {
      const request = { requestId: params.requestId, url: params.request.url, method: params.request.method }
      requests.set(params.requestId, request)
      report.assetRequests.push(request)
    }
    if (message.method === 'Network.responseReceived') {
      const request = requests.get(params.requestId)
      if (request) request.status = params.response.status
    }
    if (message.method === 'Network.loadingFailed') {
      const request = requests.get(params.requestId)
      if (request) request.failure = params.errorText
    }
    if (
      message.method === 'Network.loadingFinished' &&
      requests.has(params.requestId)
    ) {
      const request = requests.get(params.requestId)
      const operation = new URL(request.url).pathname.split('/').at(-1)
      if (request.method==='POST' && request.url.startsWith(remoteOrigin) && /package_cycle|tuition|tbhp|student_enrollment/.test(operation)) {
        const task = cdp('Network.getResponseBody', {
          requestId: params.requestId,
        })
          .then(({ body, base64Encoded }) => {
            request.body = JSON.parse(
              base64Encoded ? Buffer.from(body, 'base64').toString() : body,
            )
          })
          .catch((error) => {
            request.bodyError = String(error)
          })
        responseJobs.add(task)
        task.finally(() => responseJobs.delete(task))
      }
    }
    if (message.method === 'Fetch.requestPaused') {
      const request = params.request,
        url = new URL(request.url)
      const rpcName = url.pathname.startsWith('/rest/v1/rpc/')
        ? url.pathname.split('/').at(-1)
        : ''
      const readRpc =
        /(?:^|_)(?:list|get|read|inspect|preview|capability|capabilities|check)(?:_|$)/.test(
          rpcName,
        )
      const args=request.postData?JSON.parse(request.postData):null
      const authorizedCanaryWrite=phase==='operator' && args?.p_center_id==='dreamhome_prod' && (
        (rpcName==='v2_4_mutate_package_cycle' && args.p_command?.student_id===canaryId && args.p_command.operation==='SETUP_INITIAL_CYCLE' && args.p_command.package_catalog_id==='9dbb05c8-9f47-4340-9f8d-169b45f583ac' && args.p_command.opening_context==='NEW_ICHESS' && args.p_command.opening_payment_state==='UNPAID' && args.p_command.opening_pre_ichess_sessions===0)
        || (rpcName==='v2_2_mutate_student_with_enrollments' && args.p_student_local_id===canaryId && args.p_operation==='UPSERT' && args.p_enrollments?.length===1 && args.p_enrollments[0].class_session_id===qa.classId && args.p_enrollments[0].weekdays?.join(',')==='mon')
      )
      if (
        authorizedCanaryWrite ||
        ['GET', 'HEAD', 'OPTIONS'].includes(request.method) ||
        (request.method === 'POST' &&
          readRpc &&
          !/(?:mutate|write|create|record|apply|refresh|reset|delete|issue|bootstrap)/.test(
            rpcName,
          ))
      ) {
        cdp('Fetch.continueRequest', { requestId: params.requestId }).catch(
          () => {},
        )
      } else {
        report.blockedWrites.push({ url: request.url, method: request.method })
        cdp('Fetch.failRequest', {
          requestId: params.requestId,
          errorReason: 'BlockedByClient',
        }).catch(() => {})
      }
    }
  })
  const waitFor = async (expression, timeoutMs = 30000) => {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      if (await evaluate(expression)) return
      await delay(150)
    }
    throw new Error(
      `UI timeout: ${expression}; page: ${String(
        await evaluate('document.body.innerText'),
      )
        .replaceAll(email, '[QA account]')
        .slice(0, 5000)}`,
    )
  }
  const click = async (selector) => {
    let target
    for(let attempt=0;attempt<10;attempt++){
    await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`)
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'center',behavior:'instant'})`,
    )
    await delay(100)
    target = await evaluate(
      `(()=>{const n=document.querySelector(${JSON.stringify(selector)});if(!n)return null;const r=n.getBoundingClientRect();const x=r.x+r.width/2,y=r.y+r.height/2;const hit=document.elementFromPoint(x,y);return{x,y,correct:!!hit&&(hit===n||n.contains(hit)),hit:hit?.outerHTML?.slice(0,300),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};})()`,
    )
    if(target?.correct)break
    await delay(100)
    }
    report.observations.push({ clickTarget: selector, target })
    assert(
      target?.correct,
      `Click target covered: ${selector}; ${JSON.stringify(target)}`,
    )
    const point = { x: target.x, y: target.y }
    await cdp('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...point,
      button: 'left',
      clickCount: 1,
    })
    await cdp('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...point,
      button: 'left',
      clickCount: 1,
    })
    await delay(150)
  }
  const screenshot = async (name) => {
    const capture = await cdp('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    })
    const file = path.join(artifacts, `${mode}-${name}.png`)
    fs.writeFileSync(file, Buffer.from(capture.data, 'base64'))
    report.screenshots.push(file)
  }
  await cdp('Page.enable')
  await cdp('Runtime.enable')
  await cdp('Debugger.enable')
  await cdp('Debugger.setPauseOnExceptions', { state: 'all' })
  await cdp('Network.enable')
  await cdp('Fetch.enable', {
    patterns: [
      { urlPattern: `${remoteOrigin}/rest/v1/*`, requestStage: 'Request' },
    ],
  })
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `
    window.__remoteQaAlerts=[];window.alert=m=>window.__remoteQaAlerts.push(m);
    window.__remoteQaPdfBlobs=[];
    const create=URL.createObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=create(blob);if(blob.type==='application/pdf')window.__remoteQaPdfBlobs.push({blob,url});return url};
  `,
  })
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1536,
    height: 728,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp('Page.navigate', { url: appUrl })
  await waitFor(
    'document.querySelector("[data-cloud-login-form]") || document.querySelector("[data-module-launcher]") || document.querySelector("[data-internal-open-center-id]")',
  )
  if (await evaluate('!!document.querySelector("[data-cloud-login-form]")')) {
    await click('[data-cloud-login-form] [name="email"]')
    await cdp('Input.insertText', { text: email })
    await click('[data-cloud-login-form] [name="password"]')
    await cdp('Input.insertText', { text: password })
    await click('[data-cloud-login-form] button[type="submit"]')
  }
  await waitFor(
    'document.querySelector("[data-internal-open-center-id]") || document.querySelector("[data-module-launcher]")',
    45000,
  )
  if (
    mode === 'demo' &&
    !(await evaluate(
      '!!document.querySelector("[data-internal-open-center-id=dreamhome_prod]")',
    ))
  ) {
    await cdp('Page.navigate', { url: appUrl + '#/internal/centers' })
    await waitFor(
      '!!document.querySelector("[data-internal-open-center-id=dreamhome_prod]")',
      45000,
    )
  }
  const centers = await evaluate(
    '[...document.querySelectorAll("[data-internal-open-center-id]")].map(n=>({id:n.dataset.internalOpenCenterId,text:n.closest("article,tr,section")?.textContent?.slice(0,500)}))',
  )
  report.observations.push({ centerCards: centers })
  const dream = centers.find(
    (center) =>
      center.id === (mode === 'demo' ? 'dreamhome_prod' : 'dreamhome'),
  )
  if (dream) await click(`[data-internal-open-center-id="${dream.id}"]`)
  if (await evaluate('!!document.querySelector("[data-internal-console-action=return-dashboard]")')) {
    await click('[data-internal-console-action=return-dashboard]')
  }
  await click('[data-module-launcher][data-module-id="hoc-phi"]')
  await waitFor(
    '!!document.querySelector("[data-tu-read-status=ready]")',
    45000,
  )
  report.observations.push({
    tuitionText: await evaluate(
      'document.querySelector(".tuition-module")?.innerText',
    ),
    alerts: await evaluate('window.__remoteQaAlerts'),
  })
  const ready = () =>
    waitFor(`document.querySelector('[data-tu-read-status="ready"]')`, 45000)
  const close = () =>
    click('[data-tu-panel] .tuition-form-header [data-tu-action="close"]')
  const textPanel = () =>
    evaluate('document.querySelector("[data-tu-panel]")?.innerText')
  const setField = async (field, value) => {
    const selector = `[data-tu-field="${field}"]`
    const isSelect = await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).tagName==='SELECT'`,
    )
    if (isSelect)
      await evaluate(
        `(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));})()`,
      )
    else {
      await click(selector)
      await cdp('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'a',
        code: 'KeyA',
        windowsVirtualKeyCode: 65,
        modifiers: 2,
      })
      await cdp('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'a',
        code: 'KeyA',
        windowsVirtualKeyCode: 65,
        modifiers: 2,
      })
      await cdp('Input.insertText', { text: String(value) })
    }
  }
  const search = async (value) => {
    await click('[data-tu-filter="query"]')
    await cdp('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'a',
      code: 'KeyA',
      windowsVirtualKeyCode: 65,
      modifiers: 2,
    })
    await cdp('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'a',
      code: 'KeyA',
      windowsVirtualKeyCode: 65,
      modifiers: 2,
    })
    await cdp('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Backspace',
      code: 'Backspace',
      windowsVirtualKeyCode: 8,
    })
    await cdp('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Backspace',
      code: 'Backspace',
      windowsVirtualKeyCode: 8,
    })
    if (value) await cdp('Input.insertText', { text: value })
    await delay(250)
  }
  const openDetail = async (id) => {
    await search('')
    const name=await evaluate(`document.querySelector(${JSON.stringify(`.tuition-clickable-row[data-tuition-row-student-id="${id}"] .tuition-student-cell strong`)})?.textContent`)
    assert(name,'Student must exist in the real remote list')
    await search(name)
    await click(
      `.tuition-clickable-row[data-tuition-row-student-id="${id}"] [data-tu-action="detail"]`,
    )
    await waitFor('!!document.querySelector("[data-tu-panel=detail]")')
  }
  const hardRefresh = async () => {
    const previousDocument=await evaluate('performance.timeOrigin')
    await cdp('Page.reload', { ignoreCache: true })
    await waitFor(`performance.timeOrigin>${previousDocument} && document.readyState==='complete'`,45000)
    if (mode === 'demo') {
      await waitFor('!!document.querySelector("[data-module-launcher], [data-internal-open-center-id]")', 45000)
      await cdp('Page.navigate', { url: appUrl + '#/internal/centers' })
      await waitFor('!!document.querySelector("[data-internal-open-center-id=dreamhome_prod]")',45000)
      // Let the console's independent account-directory reads finish before
      // interacting with a center card that its global render can replace.
      await delay(2000)
      await click('[data-internal-open-center-id=dreamhome_prod]')
      await delay(1000)
      if(await evaluate('!!document.querySelector("[data-internal-open-center-id=dreamhome_prod]")')){
        await click('[data-internal-console-action=return-dashboard]')
      }
    }
    await waitFor('!!document.querySelector("[data-module-launcher]")', 45000)
    if (!(await evaluate('!!document.querySelector(".tuition-module")')))
      await click('[data-module-launcher][data-module-id="hoc-phi"]')
    await ready()
  }
  const capturePdf = async (selector, name) => {
    const n = await evaluate('window.__remoteQaPdfBlobs.length')
    await click(selector)
    await waitFor(`window.__remoteQaPdfBlobs.length>${n} || window.__remoteQaAlerts.length>0`, 45000)
    assert.deepEqual(await evaluate('window.__remoteQaAlerts'), [], 'Receipt export failed in the actual browser')
    const pdf = await evaluate(
      `(async()=>{const p=window.__remoteQaPdfBlobs.at(-1);return{url:p.url,bytes:Array.from(new Uint8Array(await p.blob.arrayBuffer()))}})()`,
    )
    assert(Buffer.from(pdf.bytes).subarray(0, 5).equals(Buffer.from('%PDF-')))
    const tabs = await (
      await fetch(`http://127.0.0.1:${port}/json/list`)
    ).json()
    assert(
      tabs.some((t) => t.url === pdf.url),
      'PDF viewer did not open',
    )
    fs.writeFileSync(
      path.join(artifacts, `${name}.pdf`),
      Buffer.from(pdf.bytes),
    )
    report.observations.push({
      document: name,
      bytes: pdf.bytes.length,
      viewerOpened: true,
    })
    const document=await PDFDocument.load(Buffer.from(pdf.bytes))
    assert.equal(document.getPageCount(),1)
    const {width,height}=document.getPage(0).getSize()
    assert(Math.abs(width-419.5276)<0.02 && Math.abs(height-595.2756)<0.02,'TBHP must be A5 portrait')
    report.document={name,pages:1,width,height}
  }

  const fieldText=async(selector,value)=>{
    await click(selector)
    await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2})
    await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2})
    await cdp('Input.insertText',{text:value})
  }
  const launch=async id=>{
    await click('[data-action=toggle-start]')
    await click(`[data-module-launcher="start-menu"][data-module-id="${id}"]`)
  }
  if(phase==='operator'){
    await search('Nguyễn Tùng Lâm')
    const initialText=await evaluate(`document.querySelector('[data-tuition-row-student-id="${canaryId}"]').innerText`)
    if(initialText.includes('Chưa có gói')){
    await screenshot('operator-before')
    await click(`[data-tu-action=assign][data-tu-student-id="${canaryId}"]`)
    await waitFor('!!document.querySelector("[data-tu-panel=assign]")')
    await setField('packageCatalogId','9dbb05c8-9f47-4340-9f8d-169b45f583ac')
    await screenshot('operator-package-assignment')
    await click('[data-tu-form] button[type=submit]')
    await waitFor(`!document.querySelector('[data-tu-panel=assign]') && document.querySelector('[data-tuition-row-student-id="${canaryId}"]')?.innerText.includes('0/16')`,45000)
    }else{
      assert.match(initialText,/0\/16/)
      assert(fs.existsSync(path.join(artifacts,'operator-attempt-1-ui.json')),'Resume only this task’s existing package assignment')
    }
    report.assignedTuition=await evaluate(`document.querySelector('[data-tuition-row-student-id="${canaryId}"]').innerText`)
    assert.match(report.assignedTuition,/Kỳ 1/)
    assert.match(report.assignedTuition,/Chưa thanh toán/)
    assert(await evaluate(`!!document.querySelector('[data-tu-action=tbhp][data-tu-student-id="${canaryId}"]')`))
    await screenshot('operator-tuition-assigned')
    if(await evaluate('!!document.querySelector("[data-tu-panel]")'))await close()
    await launch('hoc-vien')
    await waitFor(`!!document.querySelector('[data-student-filter=query]')`,45000)
    await fieldText('[data-student-filter=query]','Nguyễn Tùng Lâm')
    await click(`.student-row[data-student-id="${canaryId}"]`)
    await click(`[data-student-action=edit-from-detail][data-student-edit-id="${canaryId}"]`)
    await click('[data-student-form-step="1"]')
    await waitFor(`!!document.querySelector('[data-student-enrollment-day][data-class-session-id="${qa.classId}"]')`,45000)
    const enrollmentSelector=`.student-schedule-slot:has([data-student-enrollment-day][data-class-session-id="${qa.classId}"][value=mon])`
    await click(enrollmentSelector)
    assert(await evaluate(`document.querySelector('[data-student-enrollment-day][data-class-session-id="${qa.classId}"]').checked`))
    await screenshot('operator-class-selected')
    await waitFor('!document.querySelector("[data-student-action=save-form]").disabled',45000)
    await click('[data-student-action=save-form]')
    await waitFor(`!document.querySelector('[data-student-action=save-form]')`,45000)
    report.studentProfile=await evaluate('document.querySelector(".student-detail,.student-module")?.innerText')
    assert.match(report.studentProfile,/QA - Nguyễn Tùng Lâm/)
    await screenshot('operator-student-class-assigned')
    await launch('hoc-phi')
    await ready()
    await search('Nguyễn Tùng Lâm')
    report.afterClassTuition=await evaluate(`document.querySelector('[data-tuition-row-student-id="${canaryId}"]').innerText`)
    assert.match(report.afterClassTuition,/0\/16/)
    await screenshot('operator-tuition-list')
    await openDetail(canaryId)
    report.detail=await textPanel()
    assert.match(report.detail,/0\/16/)
    assert.match(report.detail,/Turtle 1/)
    assert.match(report.detail,/Chưa có Phiếu Thu/)
    await screenshot('operator-tuition-detail')
    await capturePdf('[data-tu-panel=detail] [data-tu-action=tbhp]','dreamhome-nguyen-tung-lam-tbhp-16')
    await close()
    await click(`[data-tu-action=payment][data-tu-student-id="${canaryId}"]`)
    await waitFor('!!document.querySelector("[data-tu-panel=payment]")',45000)
    await delay(1500)
    report.payment=await evaluate(`(()=>{const p=document.querySelector('[data-tu-panel=payment]');return{text:p.innerText,fields:[...p.querySelectorAll('[data-tu-field]')].map(n=>({field:n.dataset.tuField,value:n.value,readonly:n.readOnly,options:n.tagName==='SELECT'?[...n.options].map(o=>({value:o.value,text:o.text})):undefined})),error:p.querySelector('[role=alert]')?.innerText||''}})()`)
    assert.equal(report.payment.error,'')
    const amount=report.payment.fields.find(f=>f.field==='amount')
    assert.equal(Number(amount.value.replace(/\D/g,'')),2400000);assert.equal(amount.readonly,true)
    assert(report.payment.fields.find(f=>f.field==='collectorName').value.trim())
    await setField('payerName','QA người nộp — không lưu')
    assert.equal(await evaluate('document.querySelector("[data-tu-field=payerName]").value'),'QA người nộp — không lưu')
    await setField('payerName','Hoàng Vân')
    await setField('method','transfer')
    assert.equal(await evaluate('document.querySelector("[data-tu-field=method]").value'),'transfer')
    await screenshot('operator-payment-light')
    await close()
    await click('[data-action=toggle-start]');await click('[data-ui-theme=dark]')
    await waitFor('document.documentElement.dataset.uiTheme==="dark"')
    if(await evaluate('!!document.querySelector("[data-module-launcher=start-menu]")'))await click('[data-action=toggle-start]')
    await screenshot('operator-tuition-dark')
    await openDetail(canaryId);await screenshot('operator-detail-dark');await close()
    await click(`[data-tu-action=payment][data-tu-student-id="${canaryId}"]`)
    await waitFor('!!document.querySelector("[data-tu-panel=payment]")',45000)
    assert(!await evaluate('document.querySelector("[data-tu-panel=payment] [role=alert]")?.innerText'))
    await screenshot('operator-payment-dark');await close()
    await hardRefresh();await search('Nguyễn Tùng Lâm')
    report.refreshedTuition=await evaluate(`document.querySelector('[data-tuition-row-student-id="${canaryId}"]').innerText`)
    assert.match(report.refreshedTuition,/0\/16/)
    await screenshot('operator-refreshed-tuition')
    report.paymentSaved=false
    const snapshot=spawnSync(process.execPath,['tests/dreamhome-final-canary-snapshot.js','temporary'],{encoding:'utf8',windowsHide:true,timeout:45000})
    assert.equal(snapshot.status,0,snapshot.stderr)
  }
  if(phase==='restored'){
    await search('Nguyễn Tùng Lâm')
    report.restoredTuition=await evaluate(`document.querySelector('[data-tuition-row-student-id="${canaryId}"]').innerText`)
    assert.match(report.restoredTuition,/Chưa có gói/)
    assert(!await evaluate(`document.querySelector('[data-tu-action=tbhp][data-tu-student-id="${canaryId}"]')`))
    await screenshot('restored-tuition')
    await launch('hoc-vien');await fieldText('[data-student-filter=query]','Nguyễn Tùng Lâm')
    await click(`.student-row[data-student-id="${canaryId}"]`)
    report.restoredProfile=await evaluate('document.querySelector(".student-detail,.student-module")?.innerText')
    await screenshot('restored-student-profile')
    await launch('hoc-phi');await ready()
  }
  report.canaryName = 'Nguyễn Tùng Lâm'
  report.tuitionNames = await evaluate('[...document.querySelectorAll(".tuition-student-cell strong")].map(n=>n.textContent)')
  await search(report.canaryName)
  report.canaryRows = await evaluate('[...document.querySelectorAll("[data-tuition-row-student-id]")].map(n=>({id:n.dataset.tuitionRowStudentId,text:n.innerText}))')
  await screenshot(phase + '-tuition-canary-search')
  await click('[data-action=toggle-start]')
  await click('[data-module-launcher="start-menu"][data-module-id="cai-dat-co-so"]')
  await waitFor('!!document.querySelector("[data-settings-tab=tuition-packages]")')
  await click('[data-settings-tab=tuition-packages]')
  await waitFor('!document.querySelector("[data-settings-package-action=open-create]").disabled',45000)
  await delay(500)
  if(await evaluate('document.documentElement.dataset.uiTheme!=="light"')){
    await click('[data-action=toggle-start]');await click('[data-ui-theme=light]')
    await waitFor('document.documentElement.dataset.uiTheme==="light"')
    if(await evaluate('!!document.querySelector("[data-module-launcher=start-menu]")'))await click('[data-action=toggle-start]')
  }
  const measureSettings = () => evaluate(`(()=>{
    const panel=document.querySelector('.settings-tuition-package-panel'),wrap=panel.querySelector('.settings-class-session-table-wrap'),table=wrap.querySelector('table');
    const box=n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height}};
    return{viewport:{width:innerWidth,height:innerHeight},theme:document.documentElement.dataset.uiTheme,panel:box(panel),wrap:box(wrap),table:box(table),clientWidth:wrap.clientWidth,scrollWidth:wrap.scrollWidth,clientHeight:wrap.clientHeight,scrollHeight:wrap.scrollHeight,rows:[...table.rows].map(row=>({rect:box(row),cells:[...row.cells].map(cell=>({text:cell.innerText,rect:box(cell),scrollWidth:cell.scrollWidth,clientWidth:cell.clientWidth}))})),actions:[...panel.querySelectorAll('[data-settings-package-action]')].map(n=>({action:n.dataset.settingsPackageAction,rect:box(n),disabled:n.disabled})),text:panel.innerText};})()`)
  report.settings=[]
  report.settings.push(await measureSettings())
  await screenshot(phase + '-settings-light')
  await click('[data-action=toggle-start]')
  await click('[data-ui-theme=dark]')
  await waitFor('document.documentElement.dataset.uiTheme==="dark"')
  if(await evaluate('!!document.querySelector("[data-module-launcher=start-menu]")'))await click('[data-action=toggle-start]')
  await delay(150)
  report.settings.push(await measureSettings())
  await screenshot(phase + '-settings-dark')
  const networkDeadline=Date.now()+30000
  while(report.requests.some(r=>r.url.startsWith(remoteOrigin)&&/tuition|package_cycle|center_settings|student_enrollment|core_shared_truth/.test(r.url)&&!r.status&&!r.failure)&&Date.now()<networkDeadline)await delay(150)
  await Promise.allSettled([...responseJobs])
  const relevant = /tuition|package_cycle|center_settings|student_enrollment|core_shared_truth/
  report.failedRelevantReads=report.requests.filter(r=>r.url.startsWith(remoteOrigin)&&relevant.test(r.url)&&(r.failure||!(r.status>=200&&r.status<300)))
  assert.equal(report.runtimeExceptions.length,0)
  assert.equal(report.consoleErrors.length,0)
  assert.equal(report.failedRelevantReads.length,0)
  assert.equal(report.blockedWrites.length,0)
  assert.deepEqual(await evaluate('window.__remoteQaAlerts'),[])
  if(phase!=='before-ui')for(const m of report.settings){
    assert(m.scrollWidth<=m.clientWidth+1,'Package table should not scroll horizontally')
    assert(m.wrap.height<250,'Few package rows should use content height')
    for(const a of m.actions.filter(a=>a.action!=='open-create'))assert(a.rect.x>=m.wrap.x&&a.rect.x+a.rect.width<=m.wrap.x+m.wrap.width,'Action must fit inside table')
  }
  if(phase==='restored'){
    // Supplemental content-size cases run on about:blank, with a static copy
    // of the app's real markup/CSS. They never change remote package records
    // and are separate from the real production screenshots/read proof above.
    const fixture=await evaluate(`(()=>{const c=document.body.cloneNode(true);c.querySelectorAll('script,.desktop-window:not(.is-settings-window)').forEach(n=>n.remove());return{body:c.innerHTML,css:[...document.querySelectorAll('style')].map(n=>n.textContent).join('\\n'),row:document.querySelector('.settings-tuition-package-panel tbody tr').outerHTML};})()`)
    await cdp('Page.navigate',{url:'about:blank'})
    await waitFor('location.href==="about:blank"')
    const {frameTree}=await cdp('Page.getFrameTree')
    await cdp('Page.setDocumentContent',{frameId:frameTree.frame.id,html:`<!doctype html><html data-ui-theme="light"><head><base href="${appUrl}"><style>${fixture.css}</style></head><body>${fixture.body}<span style="position:fixed;right:20px;bottom:55px;z-index:100000;background:#fff;color:#111;padding:5px">Static Settings size fixture — no remote data</span></body></html>`})
    await evaluate('document.fonts.ready.then(()=>true)')
    report.settingsVariants=[]
    for(const theme of ['light','dark'])for(const count of [0,20]){
      await evaluate(`(()=>{document.documentElement.dataset.uiTheme=${JSON.stringify(theme)};const body=document.querySelector('.settings-tuition-package-panel tbody');body.innerHTML=${JSON.stringify(count?fixture.row.repeat(count):'<tr><td class="settings-empty" colspan="8">Chưa có gói học phí nào trong danh mục.</td></tr>')};})()`)
      await delay(100)
      const m=await measureSettings();m.variant=count?'many rows':'empty';m.staticFixture=true
      assert(m.scrollWidth<=m.clientWidth+1)
      assert(m.wrap.height<430)
      if(count)assert(m.scrollHeight>m.clientHeight,'Many package rows must remain scrollable')
      else assert(m.wrap.height<150,'Empty package state should stay compact')
      report.settingsVariants.push(m)
      await screenshot(`settings-static-${count?'many':'empty'}-${theme}`)
    }
  }
  report.passed=true
  fs.writeFileSync(path.join(artifacts,`${phase}-ui.json`),JSON.stringify(report,null,2))
  console.log(JSON.stringify({phase,canaryRows:report.canaryRows,settings:report.settings.map(s=>({theme:s.theme,rows:s.rows.length,wrap:s.wrap,scrollWidth:s.scrollWidth,clientWidth:s.clientWidth})),uncaught:0,consoleErrors:0,failedRelevantReads:0,canaryWrites:report.requests.filter(r=>r.method==='POST'&&/mutate/.test(r.url)).length,paymentWrites:0}))
}catch(error){report.failure=String(error);throw error}
finally{fs.writeFileSync(path.join(artifacts,`${process.argv[2]||'before-ui'}-ui.json`),JSON.stringify(report,null,2));ws?.close();chrome.kill()}
