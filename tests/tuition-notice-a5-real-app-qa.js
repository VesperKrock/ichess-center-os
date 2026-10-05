import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { projectTuitionNoticeWeekdays, forecastTuitionNotice, buildTuitionNoticeForecastLines, getTuitionNoticeGenerationDate } from '../src/tuition-notice-forecast.js'

// Runs the existing localhost application, with its real Vite environment and
// normal login UI. No response mocks, source transforms, SQL bridge or boot hook.
const mode = 'demo'
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
const artifacts = path.resolve('artifacts/l2-simple-tbhp/runtime')
fs.mkdirSync(artifacts, { recursive: true })
const profile = fs.mkdtempSync(
  path.join(os.tmpdir(), 'ichess-tuition-real-remote-chrome-'),
)
fs.mkdirSync(profile, { recursive: true })
const report = {
  appUrl,
  remoteOrigin,
  mode,
  requests: [],
  runtimeExceptions: [],
  consoleErrors: [],
  blockedWrites: [],
  screenshots: [],
  observations: [],
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
  commandId = 0
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
      if (/package_cycle|tuition|tbhp|student_enrollments/.test(operation)
        || (operation === 'center_cloud_entities' && new URL(request.url).searchParams.get('entity_type') === 'eq.class_session')) {
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
      if (
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
      '!!document.querySelector("[data-internal-open-center-id=phongtrong_prod]")',
    ))
  ) {
    await cdp('Page.navigate', { url: appUrl + '#/internal/centers' })
    await waitFor(
      '!!document.querySelector("[data-internal-open-center-id=phongtrong_prod]")',
      45000,
    )
  }
  const centers = await evaluate(
    '[...document.querySelectorAll("[data-internal-open-center-id]")].map(n=>({id:n.dataset.internalOpenCenterId,text:n.closest("article,tr,section")?.textContent?.slice(0,500)}))',
  )
  report.observations.push({ centerCards: centers })
  const dream = centers.find(
    (center) =>
      center.id === (mode === 'demo' ? 'phongtrong_prod' : 'dreamhome'),
  )
  if (dream) await click(`[data-internal-open-center-id="${dream.id}"]`)
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
      await waitFor('!!document.querySelector("[data-internal-open-center-id=phongtrong_prod]")',45000)
      // Let the console's independent account-directory reads finish before
      // interacting with a center card that its global render can replace.
      await delay(2000)
      await click('[data-internal-open-center-id=phongtrong_prod]')
      await delay(1000)
      if(await evaluate('!!document.querySelector("[data-internal-open-center-id=phongtrong_prod]")')){
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
    await waitFor(`window.__remoteQaPdfBlobs.length>${n}`, 45000)
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
  }

  await Promise.allSettled([...responseJobs])
  const initial = report.requests.filter(r => r.method === 'POST' && r.url.endsWith('/rpc/tuition_operator_read')).at(-1)
  assert(initial?.status === 200 && initial.body?.ok && initial.body.center_id === 'phongtrong_prod')
  const before = JSON.stringify({cycle:initial.body.cycle_state,receipts:initial.body.receipt_state})
  await screenshot('phongtrong-list')
  const studentId = 'attqa_20260928_student_06'
  assert(initial.body.students.some(s => s.id === studentId && /^ATT QA/.test(s.fullName)), 'Existing ATT QA Student only')
  await openDetail(studentId)
  await screenshot('phongtrong-detail')
  await capturePdf('[data-tu-panel=detail] [data-tu-action=tbhp]', 'phongtrong-bao-ngoc-tbhp-a5')
  await Promise.allSettled([...responseJobs])
  const printRead = report.requests.filter(r => r.method === 'POST' && r.url.endsWith('/rpc/tuition_operator_read')).at(-1).body
  const currentCycle = printRead.cycle_state.students.find(s => s.student_id === studentId).current_cycle
  const classRead = report.requests.filter(r => new URL(r.url).searchParams.get('entity_type') === 'eq.class_session' && r.body).at(-1).body
  const enrollmentRead = report.requests.filter(r => r.method === 'POST' && r.url.endsWith('/rpc/v2_2_list_student_enrollments')).at(-1).body
  assert.equal(enrollmentRead.center_id, 'phongtrong_prod')
  assert(classRead.every(c => c.center_id === 'phongtrong_prod'))
  const enrollmentSets = enrollmentRead.enrollment_sets.map(s => ({ studentId: s.student_id,
    enrollments: s.enrollments.map(e => ({ classSessionId: e.class_session_id, weekdays: e.weekdays })) }))
  const weekdays = projectTuitionNoticeWeekdays(printRead.students.find(s => s.id === studentId), enrollmentSets, classRead.map(c => c.payload))
  const facts = { generatedDate: getTuitionNoticeGenerationDate(), packageSessions: currentCycle.total_sessions,
    usedSessions: currentCycle.used_sessions, weekdays }
  const forecast = forecastTuitionNotice(facts)
  assert(forecast?.estimatedNextCycleStartDate, 'Current Ca data must support forecast')
  const bytes = fs.readFileSync(path.join(artifacts,'phongtrong-bao-ngoc-tbhp-a5.pdf'))
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(),1)
  const size = pdf.getPage(0).getSize()
  assert(Math.abs(size.width-419.5276)<0.02 && Math.abs(size.height-595.2756)<0.02)
  const deps = path.join(os.tmpdir(), 'ichess-tuition-pdf-render-270927/node_modules')
  const { createCanvas } = await import(pathToFileURL(path.join(deps, '@napi-rs/canvas/index.js')))
  const pdfjs = await import(pathToFileURL(path.join(deps, 'pdfjs-dist/legacy/build/pdf.mjs')))
  const rendered = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise
  const renderedPage = await rendered.getPage(1), viewport = renderedPage.getViewport({ scale: 3 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  await renderedPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  fs.writeFileSync(path.join(artifacts, 'phongtrong-bao-ngoc-tbhp-a5.png'), canvas.toBuffer('image/png'))
  const items = (await renderedPage.getTextContent()).items.filter(item => item.str?.trim())
  const text = items.map(item => item.str).join(' ').replace(/\s+/g, ' ')
  const noticeLines = ['Học viên được học bù trong khóa học nếu vắng học có thông báo (P).', ...buildTuitionNoticeForecastLines(forecast)]
  for (const line of noticeLines) assert(text.includes(line), `Actual application PDF is missing ${line}`)
  assert(!/tối đa|Ngày học|Giáo viên|Tiến độ|Buổi đã học/.test(text))
  for (const item of items) {
    assert(item.transform[4] >= 0 && item.transform[4] + item.width <= 419.6276)
    for (const other of items.filter(other => other !== item && Math.abs(other.transform[5] - item.transform[5]) < 0.2 && other.transform[4] > item.transform[4])) {
      assert(item.transform[4] + item.width <= other.transform[4] + 0.6, `Overlap: ${item.str} / ${other.str}`)
    }
  }
  const jsQR = (await import(pathToFileURL(path.join(os.tmpdir(), 'ichess-tbc-qr-qa/node_modules/jsqr/dist/jsQR.js')))).default
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  assert(jsQR(pixels.data, canvas.width, canvas.height)?.data.includes('442228866'), 'Actual runtime company QR scans')
  await close()
  await hardRefresh()
  await Promise.allSettled([...responseJobs])
  const after = report.requests.filter(r=>r.method === 'POST' && r.url.endsWith('/rpc/tuition_operator_read')).at(-1)
  assert.equal(JSON.stringify({cycle:after.body.cycle_state,receipts:after.body.receipt_state}),before)
  const reads=report.requests.filter(r=>r.method==='POST' && r.url.endsWith('/rpc/tbhp_get_printable_document'))
  assert.equal(reads.length,1)
  assert.equal(reads[0].body.document.snapshot.center.id, 'phongtrong_prod')
  const phone = reads[0].body.document.snapshot.center.phone?.trim() || '090 1197 260'
  assert.equal(items.filter(item => item.str.includes(phone)).length, 2)
  assert(reads[0].status===200 && reads[0].body.ok)
  report.failedTuitionReads=report.requests.filter(r=>/tuition|package_cycle|tbhp/.test(r.url)&&(r.failure||!(r.status>=200&&r.status<300)))
  assert.equal(report.failedTuitionReads.length,0)
  assert.equal(report.runtimeExceptions.length,0)
  assert.equal(report.consoleErrors.length,0)
  assert.equal(report.blockedWrites.length,0)
  assert.deepEqual(await evaluate('window.__remoteQaAlerts'),[])
  report.passed=true
  report.businessMutationRequests=0
  report.document={studentId,studentName:'ATT QA - Bảo Ngọc',pageCount:1,size,phone,facts,forecast,noticeLines, noClippingOrOverlap:true}
  report.qaMutation = null
  report.dreamHomeWrites = 0
  console.log(JSON.stringify({passed:true,a5Documents:1,uncaught:0,consoleErrors:0,businessWrites:0}))
} catch(error) { report.failure=String(error); throw error }
finally { fs.writeFileSync(path.join(artifacts,'real-app-qa.json'),JSON.stringify(report,null,2));ws?.close();chrome.kill() }
