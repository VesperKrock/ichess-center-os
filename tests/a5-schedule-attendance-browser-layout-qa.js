import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

// Component geometry only. This is deliberately separate from authenticated
// real-app interaction QA and cannot establish successful remote writes.
const folder = path.resolve('artifacts/a5-schedule-attendance-ui')
fs.mkdirSync(folder, { recursive: true })
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-a5-layout-'))
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let ws
let nextId = 0
const pending = new Map()
const exceptions = []
try {
  const portFile = path.join(profile, 'DevToolsActivePort')
  for (let i = 0; i < 100 && !fs.existsSync(portFile); i++) await delay(100)
  const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0])
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const job = pending.get(message.id)
    if (job) {
      pending.delete(message.id)
      message.error ? job.reject(new Error(JSON.stringify(message.error))) : job.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
  })
  const evaluate = async expression => {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  await cdp('Runtime.enable')
  await cdp('Page.enable')
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1536, height: 728, deviceScaleFactor: 1, mobile: false })
  await cdp('Page.navigate', { url: 'http://127.0.0.1:5173/ichess-center-os/' })
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`Boolean(document.querySelector('.app-auth-gate, [data-auth-action], #app') && document.body.innerText.length > 0)`)) break
    await delay(100)
  }
  const results = []
  for (const theme of ['light', 'dark']) for (const size of [3, 18]) {
    await evaluate(`(async () => {
      const { renderScheduleModule } = await import('/ichess-center-os/src/schedule-module.js');
      const students = Array.from({length:${size}}, (_, i) => ({id:'qa-student-'+i, fullName:i === 0 ? 'Nguyễn Hoàng Minh Anh' : 'Học viên QA '+(i+1)}));
      const session = {id:'a5-layout-session',scheduleType:'oneOff',date:'2026-09-21',startTime:'17:30',endTime:'18:30',title:'Turtle 2',status:'scheduled',studentIds:students.map(s=>s.id)};
      const fact = {schedule_session_local_id:session.id,occurrence_date:session.date,class_session_local_id:null,roster_student_ids:session.studentIds,lifecycle_state:'HELD',planned_start_time:'17:30:00',planned_end_time:'18:30:00',room:'Phòng 1',actual_teacher_override:true,actual_teacher_name:'Cô Dạy thay'};
      const rows = students.map((s,i)=>({studentId:s.id,attendanceStatus:i===0?'present':i===1?'makeup':'',candidateState:'ready',makeupCandidates:[],makeupForAttendanceLocalId:i===1?'qa-missed':'',currentMakeupTarget:i===1?{attendance_local_id:'qa-missed',occurrence_date:'2026-09-14',teacher_name:'Thầy Lịch sử'}:null}));
      const html = renderScheduleModule([session],null,{sessionId:session.id,occurrenceDate:session.date,mode:'adminPlaceholder'},[],null,null,null,null,false,null,[],students,'2026-09-21',{rows},{attendanceAvailable:true,occurrenceAttendanceReady:true,a3TeacherReady:true,a3TeacherContext:{occurrences:[fact]}});
      document.body.innerHTML='<div class="desktop-window is-schedule-window" style="position:relative;width:100vw;height:100vh"><div class="window-body" style="height:100%">'+html+'</div></div>';
      document.documentElement.dataset.uiTheme=${JSON.stringify(theme)};
    })()`)
    await delay(100)
    const result = await evaluate(`(() => {
      const panel=document.querySelector('.schedule-admin-attendance-panel'), save=document.querySelector('[data-admin-attendance-action="save"]'), rows=document.querySelector('.schedule-admin-attendance-rows');
      const bounds=panel.getBoundingClientRect(), saveBounds=save.getBoundingClientRect();
      return {theme:document.documentElement.dataset.uiTheme,size:${size},viewport:[innerWidth,innerHeight],horizontalOverflow:document.documentElement.scrollWidth>innerWidth || panel.scrollWidth>panel.clientWidth,panelWidth:bounds.width,panelHeight:bounds.height,saveVisible:saveBounds.bottom<=innerHeight && saveBounds.top>=0,rosterScrollable:rows.scrollHeight>rows.clientHeight,clippedNames:[...panel.querySelectorAll('.session-report-student-name strong')].filter(el=>el.scrollWidth>el.clientWidth).length,statusButtons:[...panel.querySelectorAll('[data-admin-attendance-status]')].length,pickerVisible:Boolean(panel.querySelector('[data-admin-makeup-target]')),header:panel.querySelector('.schedule-report-compact-title').innerText};
    })()`)
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(folder, `layout-${theme}-${size}.png`), Buffer.from(screenshot.data, 'base64'))
    results.push(result)
  }
  fs.writeFileSync(path.join(folder, 'layout-qa.json'), JSON.stringify({ type: 'component-fixture', results, exceptions }, null, 2))
  for (const result of results) {
    assert.equal(result.horizontalOverflow, false)
    assert.equal(result.saveVisible, true)
    assert.equal(result.clippedNames, 0, 'Student names must remain readable')
    assert.equal(result.statusButtons, result.size * 3)
    assert.equal(result.pickerVisible, true)
    assert(result.panelWidth < 600)
    assert(result.panelHeight <= 626)
    if (result.size > 3) assert(result.rosterScrollable)
  }
  assert.equal(exceptions.length, 0)
  console.log('A5_BROWSER_COMPONENT_LAYOUT_QA_PASS (Light/Dark, 1536x728, 3/18 students)')
} finally {
  ws?.close()
  chrome.kill()
}
