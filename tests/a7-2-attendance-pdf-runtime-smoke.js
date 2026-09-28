import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {PDFDocument} from 'pdf-lib'
import {generateAttendancePdf,createAttendancePdfProjection,ATTENDANCE_PDF_SOURCE} from '../src/attendance-pdf.js'
import {buildCanonicalAttendanceLedger} from '../src/attendance-ledger.js'
import {renderAttendanceBoardModule} from '../src/attendance-board-module.js'
import {ledgerFixture} from './a6-attendance-ledger-fixtures.js'

const folder=process.env.ATTENDANCE_PDF_QA_DIR || 'artifacts/attendance-pdf-runtime'
fs.mkdirSync(folder,{recursive:true})
const assetReads=[]
const fetchImpl=async url=>{
  assert.match(url,/^\/forms\/(?:tuition-receipt\/fonts\/Tinos-(?:Regular|Bold|Italic)\.ttf|attendance\/ichess-logo\.png)$/)
  assetReads.push(url)
  return new Response(fs.readFileSync(path.join('public',url.slice(1))))
}
const sourceModels=JSON.parse(fs.readFileSync(new URL('./fixtures/attendance-pdf/canonical-prototype-models.json',import.meta.url),'utf8'))
const report={source:ATTENDANCE_PDF_SOURCE,cases:[],businessWrites:0}
const outputs={}
for(const [index,name]of ['normal','dense-month','edge-states'].entries()){
  // Existing A7 models were made by the unchanged A6 builder. Levels are
  // synthetic Student metadata only, never a substitute for slot identity.
  const model=structuredClone(sourceModels[index])
  model.rows.forEach((row,index)=>{
    row.student.level=['Turtle 2','Dolphin 3','Eagle'][index%3]
    // Restore the canonical column links omitted by A7's JSON proof serializer.
    row.cells.forEach(cell=>{
      cell.occurrence=model.columns.find(column=>column.key===cell.occurrenceKey)
      cell.originalOccurrence=cell.originalDate?{date:cell.originalDate,teacherName:cell.originalTeacher}:null
    })
  })
  const before=structuredClone(model)
  const result=await generateAttendancePdf(model,{centerName:'KIỂM THỬ · Dữ liệu giả lập',capturedAt:'2026-09-28T05:00:00Z'},{fetchImpl,includeLayoutProof:true})
  assert.deepEqual(model,before,'Export must leave the source A6 matrix untouched')
  assert.equal(result.source,ATTENDANCE_PDF_SOURCE)
  assert.deepEqual(result.projection.columns.map(column=>column.key),model.columns.map(column=>column.key),'No occurrence aggregation or deduplication inside PDF')
  assert.deepEqual(result.projection.rows.map(row=>row.cells.map(cell=>cell.state)),model.rows.map(row=>row.cells.map(cell=>cell.state)))
  assert.deepEqual(result.projection.rows.map(row=>row.name),model.rows.map(row=>row.student.fullName))
  const bytes=new Uint8Array(await result.blob.arrayBuffer()),doc=await PDFDocument.load(bytes)
  assert.equal(Buffer.from(bytes.slice(0,4)).toString(),'%PDF')
  assert(doc.getPages().every(page=>Math.abs(page.getWidth()-841.8898)<0.001&&Math.abs(page.getHeight()-595.2756)<0.001))
  const pairs=new Set()
  for(const page of result.pages.filter(page=>page.kind==='matrix')){
    assert(page.columnWidth>=32)
    for(let row=page.rowStart;row<page.rowEnd;row++)for(let col=page.columnStart;col<page.columnEnd;col++){
      const key=JSON.stringify([row,col]);assert(!pairs.has(key),'A cell is emitted exactly once');pairs.add(key)
    }
  }
  assert.equal(pairs.size,model.rows.length*model.columns.length,'Pagination must not lose any canonical cell')
  assert(result.textRegions.every(region=>region.x>=23&&region.x+region.width<=841.8898-23&&region.baseline<=595.2756-16))
  if(name==='normal')assert.equal(doc.getPageCount(),1)
  if(name==='dense-month')assert(doc.getPageCount()>=2,'A dense sheet paginates without shrinking fonts')
  if(name==='edge-states'){
    assert.equal(doc.getPageCount(),1)
    const sameDay=result.projection.columns.filter(column=>column.date==='2026-09-19')
    assert.deepEqual(sameDay.map(column=>column.startTime),['17:30','19:00'])
    assert(result.textRegions.some(region=>region.value==='?'))
    assert(result.textRegions.some(region=>region.value==='Đã hủy'))
    assert.equal(result.textRegions.filter(region=>region.value==='Đã hủy').length,1,'Cancellation is named once at column level')
    assert(result.projection.rows.some(row=>row.cells.some(cell=>cell.state==='makeup'&&cell.originalDate==='2026-08-29')))
    assert(result.textRegions.some(region=>region.value.includes('Dạy thay (*)')))
    for(const teacher of ['Thầy Tuấn','Thầy Nam','Cô Mai'])assert(result.textRegions.some(region=>region.value.includes(teacher)))
  }
  assert(!result.textRegions.some(region=>region.value.startsWith('Ca học:')&&/Turtle|Dolphin|Eagle/.test(region.value)))
  fs.writeFileSync(`${folder}/runtime-${name}.pdf`,bytes)
  fs.writeFileSync(`${folder}/runtime-${name}-proof.json`,JSON.stringify(result,(key,value)=>key==='blob'?undefined:value,2)+'\n')
  report.cases.push({name,pageCount:result.pageCount,students:model.rows.length,occurrences:model.columns.length,canonicalCells:pairs.size})
  outputs[name]=result
}

// Stress both dimensions and large note volume through the A6 builder.
const fixture=ledgerFixture(),studentIds=Array.from({length:37},(_,i)=>`stress-student-${i}`)
const stressInput={...fixture,students:studentIds.map((id,index)=>({id,fullName:`Học viên kiểm thử ${index+1}`,level:'Turtle 2'})),attendanceRecords:[],
  occurrences:Array.from({length:49},(_,index)=>({...fixture.occurrences[1],schedule_session_local_id:`stress-real-${index}`,roster_student_ids:studentIds,
    planned_start_time:index%2?'19:00:00':'17:30:00'}))}
const stressModel=buildCanonicalAttendanceLedger(stressInput)
const stress=await generateAttendancePdf(stressModel,{centerName:'KIỂM THỬ phân trang'},{fetchImpl,includeLayoutProof:true})
assert(stress.pages.filter(page=>page.kind==='matrix').some(page=>page.columnStart>0),'Wide matrices paginate horizontally')
assert(stress.pages.filter(page=>page.kind==='matrix').some(page=>page.rowStart>0),'Long rosters paginate vertically')
assert.equal(stress.projection.columns.length,49,'Equal date/time columns keep their genuine canonical identities')
fs.writeFileSync(`${folder}/runtime-pagination-stress.pdf`,new Uint8Array(await stress.blob.arrayBuffer()))
fs.writeFileSync(`${folder}/runtime-pagination-stress-proof.json`,JSON.stringify(stress,(key,value)=>key==='blob'?undefined:value,2)+'\n')
report.cases.push({name:'pagination-stress',pageCount:stress.pageCount,students:37,occurrences:49})

const noteStudent={id:'notes-student',fullName:Array.from({length:14},()=> 'Nguyễn Hoàng Minh').join(' ')}
const noteFacts=[],noteRecords=[]
for(let index=0;index<16;index++){
  const originalId=`notes-original-${index}`,originalDate=`2026-08-${String(index+1).padStart(2,'0')}`,makeupId=`notes-makeup-${index}`
  const originalLocalId=`attendance_record::v2-3::${originalId}::${originalDate}::${noteStudent.id}::admin`
  noteFacts.push({...fixture.occurrences[1],schedule_session_local_id:originalId,occurrence_date:originalDate,roster_student_ids:[noteStudent.id]},
    {...fixture.occurrences[1],schedule_session_local_id:makeupId,occurrence_date:'2026-09-21',roster_student_ids:[noteStudent.id]})
  const record=(id,date,status)=>({scheduleSessionId:id,date,studentId:noteStudent.id,source:'admin',cloudVersion:1,attendanceAuthority:'v2.3-occurrence-v1',attendanceStatus:status,
    authorityLocalId:`attendance_record::v2-3::${id}::${date}::${noteStudent.id}::admin`})
  noteRecords.push(record(originalId,originalDate,'absent'),{...record(makeupId,'2026-09-21','makeup'),makeupForAttendanceLocalId:originalLocalId})
}
const notesModel=buildCanonicalAttendanceLedger({...fixture,students:[noteStudent],occurrences:noteFacts,attendanceRecords:noteRecords})
const notes=await generateAttendancePdf(notesModel,{centerName:'KIỂM THỬ ghi chú dài'},{fetchImpl,includeLayoutProof:true})
assert(notes.pages.some(page=>page.kind==='notes'),'Long makeup notes continue on separate pages without truncation')
for(let day=1;day<=16;day++)assert(notes.textRegions.some(region=>region.value.includes(`${String(day).padStart(2,'0')}/08/2026`)),'Every original absence stays documented')
fs.writeFileSync(`${folder}/runtime-notes-continuation.pdf`,new Uint8Array(await notes.blob.arrayBuffer()))
report.cases.push({name:'notes-continuation',pageCount:notes.pageCount,students:1,occurrences:16})

const options={students:fixture.students,classSessions:fixture.classSessions,filters:fixture.filters,
  availability:{...fixture,attendanceAvailable:true,tuitionAvailable:true,ledgerContext:{status:'ready',occurrences:fixture.occurrences}}}
let captured,captureReady
const html=renderAttendanceBoardModule({...options,onModel:(model,ready)=>{captured=model;captureReady=ready}})
assert(captureReady)
assert.deepEqual(captured,buildCanonicalAttendanceLedger({...fixture,scheduleSessions:[],plannedOccurrences:[]}))
const outside=await generateAttendancePdf(captured,{centerName:'KIỂM THỬ học bù ngoài kỳ'},{fetchImpl,includeLayoutProof:true})
assert(outside.projection.rows.some(row=>row.cells.some(cell=>cell.originalOccurrence?.teacherName==='Thầy Lịch sử'&&cell.originalDate==='2026-08-24')))
assert(outside.textRegions.some(region=>region.value.includes('24/08/2026 17:30 (Thầy Lịch sử)')))
fs.writeFileSync(`${folder}/runtime-canonical-makeup-outside-range.pdf`,new Uint8Array(await outside.blob.arrayBuffer()))
assert.match(html,/data-attendance-export-pdf >In \/ Xuất PDF/)
assert.match(renderAttendanceBoardModule({...options,availability:{...options.availability,attendanceAvailable:false}}),/data-attendance-export-pdf disabled/)
assert.match(renderAttendanceBoardModule({...options,filters:{...fixture.filters,query:'no matching student'}}),/data-attendance-export-pdf disabled/)
assert.throws(()=>createAttendancePdfProjection({...captured,rows:[]}),/Chọn bộ lọc/)
assert.throws(()=>createAttendancePdfProjection({...captured,columns:[...captured.columns,captured.columns[0]]}),/Buổi học/)
const invalid=structuredClone(captured);invalid.rows[0].cells[0].state='fabricated'
assert.throws(()=>createAttendancePdfProjection(invalid),/Ô điểm danh/)
const rename=buildCanonicalAttendanceLedger({...fixture,occurrences:fixture.occurrences.map(fact=>fact.schedule_session_local_id==='makeup'?{...fact,planned_teacher_name:'Tên mới của cùng giáo viên'}:fact)})
const renameProjection=createAttendancePdfProjection(rename)
assert(renameProjection.teachers.some(teacher=>teacher.name==='Thầy Lịch sử'))
assert(renameProjection.teachers.some(teacher=>teacher.name==='Tên mới của cùng giáo viên'))
assert.notEqual(renameProjection.columns.find(column=>column.scheduleSessionId==='held').teacherCode,renameProjection.columns.find(column=>column.scheduleSessionId==='makeup').teacherCode,'Preserve each historical name snapshot even when teacher ID is unchanged')
const pdfSource=fs.readFileSync('src/attendance-pdf.js','utf8')
assert.doesNotMatch(pdfSource,/supabase|\.rpc\(|localStorage|sessionReports|buildCanonicalAttendanceLedger|computeAttendanceCycleState|usedSessions/)
const main=fs.readFileSync('src/main.js','utf8')
const helper=main.slice(main.indexOf('async function exportAttendanceBoardPdf('),main.indexOf('function getCloudAttachmentAccessContext()'))
assert.match(helper,/structuredClone\(snapshot\.model\)/)
assert.doesNotMatch(helper,/refresh|\.rpc\(|attendanceRecords|tuitionRecords|\.push\(|\.save\(|\.update\(|\.delete\(/)
assert(/onModel: \(model, ready\).*\r?\n\s*attendanceBoardPdfSnapshot = ready \? \{ model, centerId: ledgerContext.centerId \}/.test(main),'The actual Board renderer supplies its canonical matrix')
report.canonicalSourceOnly=true;report.sourceBoundaryPassed=true;report.assetReads=assetReads;report.passed=true
fs.writeFileSync(`${folder}/runtime-qa.json`,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report,null,2))
console.log('A7_2_ATTENDANCE_PDF_RUNTIME_SMOKE_PASS')
