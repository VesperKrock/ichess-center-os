import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { renderAttendanceBoardModule } from '../src/attendance-board-module.js'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const execFileAsync = promisify(execFile)
assert(fs.existsSync(chromePath), 'Chrome is required for the real rendered-geometry smoke.')

const students = Array.from({ length: 6 }, (_, index) => ({
  id: `student-${index + 1}`,
  centerId: 'qa-center',
  fullName: index === 0 ? 'Nguyễn Hoàng Gia Bảo Có Tên Dài' : `Học viên kiểm thử ${index + 1}`,
  classSessionIds: ['class-a'],
  recurringEnrollments: [{ classSessionId: 'class-a', weekdays: ['mon', 'wed', 'fri'] }],
  useAuthoritativeEnrollment: true,
}))
const classSessions = [{
  id: 'class-a',
  name: 'Lớp Cờ vua Nâng cao',
  daysOfWeek: ['mon', 'wed', 'fri'],
  startTime: '17:30',
  endTime: '19:00',
  status: 'active',
}]
const tuitionRecords = students.map((student) => ({
  id: `tuition-${student.id}`,
  studentId: student.id,
  usedSessions: 2,
  totalSessions: 16,
}))
const notes = students.map((student) => ({
  id: `note-${student.id}`,
  studentId: student.id,
  month: '2026-09',
  content: 'Ghi chú dài được thu gọn nhưng vẫn mở được đầy đủ trong hộp chi tiết.',
}))
const board = renderAttendanceBoardModule(
  students,
  classSessions,
  tuitionRecords,
  [],
  [],
  { month: '2026-09', classSessionId: 'all', query: '' },
  null,
  notes,
  null,
  false,
  [],
  0,
  { status: 'locked' },
  false,
  {},
  {
    attendanceAvailable: true,
    tuitionAvailable: true,
    calendarNotesAvailable: true,
    attendanceOperationsReady: true,
  },
)

assert(board.includes('style="--attendance-date-count:'))
assert(board.includes('Dữ liệu ban đầu'))

const css = [
  fs.readFileSync('src/styles.css', 'utf8'),
  fs.readFileSync('src/attendance-v2-8p2-theme.css', 'utf8'),
].join('\n')
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;background:#eef2f7}.desktop-window{position:relative;width:calc(100vw - 32px);height:calc(100vh - 32px);margin:16px;overflow:hidden}.window-body{height:100%;min-height:0}${css}
</style></head><body><main class="desktop-window is-attendance-window"><div class="window-body">${board}</div></main>
<script>
addEventListener('load',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const wrap=document.querySelector('.attendance-board-sheet-wrap');
  const table=document.querySelector('.attendance-board-sheet');
  const headers=[...table.tHead.rows[0].cells];
  const firstRow=[...table.tBodies[0].rows[0].cells];
  const rounded=(value)=>Math.round(value*100)/100;
  const widths=headers.map((cell)=>rounded(cell.getBoundingClientRect().width));
  const bodyWidths=firstRow.map((cell)=>rounded(cell.getBoundingClientRect().width));
  const first=headers[0].getBoundingClientRect();
  const second=headers[1].getBoundingClientRect();
  const classCell=headers[2].getBoundingClientRect();
  const buttons=[...table.querySelectorAll('button')].map((button)=>{
    const b=button.getBoundingClientRect(); const c=button.closest('td').getBoundingClientRect();
    return b.left>=c.left-1&&b.right<=c.right+1&&b.top>=c.top-1&&b.bottom<=c.bottom+1;
  });
  const expected=760+(headers.filter((cell)=>cell.classList.contains('attendance-date-column')).length*66);
  const result={
    viewport:[innerWidth,innerHeight], tableWidth:rounded(table.getBoundingClientRect().width), expected,
    widths, bodyWidths, stickyGap:rounded(second.left-first.right), classGap:rounded(classCell.left-second.right),
    headerBodyAligned:widths.every((width,index)=>Math.abs(width-bodyWidths[index])<=0.51),
    buttonsContained:buttons.every(Boolean), horizontalScroll:wrap.scrollWidth>=wrap.clientWidth,
    tableVerticalScroll:getComputedStyle(wrap).overflowY==='auto'&&wrap.scrollHeight>wrap.clientHeight,
    pageVerticalScroll:document.documentElement.scrollHeight>innerHeight+1,
  };
  const output=document.createElement('script'); output.id='geometry-result'; output.type='application/json';
  output.textContent=JSON.stringify(result); document.body.append(output);
})))
</script></body></html>`

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(html)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const screenshotDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-attendance-geometry-artifacts-'))

try {
  for (const [width, height] of [[1536, 728], [1700, 850]]) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ichess-attendance-geometry-'))
    const screenshotPath = path.join(screenshotDir, `attendance-${width}x${height}.png`)
    const { stdout: dumped } = await execFileAsync(chromePath, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
      `--screenshot=${screenshotPath}`, '--virtual-time-budget=1500', '--dump-dom',
      `http://127.0.0.1:${port}`,
    ], { encoding: 'utf8', timeout: 30000, maxBuffer: 20 * 1024 * 1024 })
    const match = dumped.match(/<script id="geometry-result" type="application\/json">([\s\S]*?)<\/script>/)
    assert(match, `Missing geometry result at ${width}×${height}`)
    const geometry = JSON.parse(match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'))
    assert.equal(geometry.tableWidth, geometry.expected, `Table width mismatch at ${width}×${height}`)
    assert(geometry.stickyGap >= -0.51, `Sticky columns overlap at ${width}×${height}: ${geometry.stickyGap}`)
    assert(geometry.classGap >= -0.51, `Student/class columns overlap at ${width}×${height}: ${geometry.classGap}`)
    assert.equal(geometry.headerBodyAligned, true, `Header/body widths diverge at ${width}×${height}`)
    assert.equal(geometry.buttonsContained, true, `A table control is cut off at ${width}×${height}`)
    assert.equal(geometry.pageVerticalScroll, false, `Unexpected outer page scrollbar at ${width}×${height}`)
    console.log(`Attendance geometry ${width}x${height}: PASS ${JSON.stringify(geometry)}`)
  }
} finally {
  await new Promise((resolve) => server.close(resolve))
}

console.log(`ATTENDANCE_GEOMETRY_ARTIFACTS=${screenshotDir}`)
console.log('Attendance board real geometry smoke: PASS')
