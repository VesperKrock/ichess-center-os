import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {buildCanonicalAttendanceLedger} from '../src/attendance-ledger.js'
import {createAttendancePdfProjection, createAttendancePdfSections, generateAttendancePdf} from '../src/attendance-pdf.js'
import {ledgerFixture} from './a6-attendance-ledger-fixtures.js'

const folder=process.env.ATTENDANCE_PDF_QA_DIR || 'artifacts/attendance-pdf-pagination-fix'
fs.mkdirSync(folder,{recursive:true})
const fetchImpl=async url=>new Response(fs.readFileSync(path.join('public',url.slice(1))))
const base=ledgerFixture()
const students=Array.from({length:12},(_,index)=>({id:`pagination-student-${index}`,fullName:index===7?'Nguyễn Hoàng Bảo Khánh Linh':`Học viên kiểm thử ${index+1}`,level:index%2?'Turtle 2':'Dolphin 1',classSessionIds:['unrelated-current-class']}))
const ids=students.map(student=>student.id)
const fact=(id,date,extra={})=>({...base.occurrences[1],schedule_session_local_id:id,occurrence_date:date,roster_student_ids:ids,...extra})
const record=(id,date,studentId,status,extra={})=>({scheduleSessionId:id,date,studentId,attendanceStatus:status,source:'admin',cloudVersion:1,
  attendanceAuthority:'v2.3-occurrence-v1',authorityLocalId:`attendance_record::v2-3::${id}::${date}::${studentId}::admin`,...extra})
const firstAbsence=record('pagination-first','2026-09-08',ids[2],'absent')
const secondAbsence=record('pagination-second','2026-09-10',ids[6],'absent')
const occurrences=[fact('pagination-first','2026-09-08'),fact('pagination-second','2026-09-10'),
  fact('pagination-substitute','2026-09-15',{actual_teacher_override:true,actual_teacher_id:'substitute',actual_teacher_name:'Cô Dạy thay'}),
  fact('pagination-cancelled','2026-09-17',{lifecycle_state:'CANCELLED'}),fact('pagination-unmarked','2026-09-22'),
  fact('pagination-makeup','2026-09-24'),fact('pagination-future','2026-09-29',{lifecycle_state:'PLANNED',planned_teacher_id:'new-teacher',planned_teacher_name:'Thầy mới'})]
const attendanceRecords=[firstAbsence,secondAbsence,
  record('pagination-substitute','2026-09-15',ids[6],'makeup',{makeupForAttendanceLocalId:secondAbsence.authorityLocalId}),
  record('pagination-makeup','2026-09-24',ids[2],'makeup',{makeupForAttendanceLocalId:firstAbsence.authorityLocalId})]
const options={...base,students,occurrences,attendanceRecords}
const turtleModel=buildCanonicalAttendanceLedger({...options,filters:{...base.filters,classSessionId:'class-a'}})
const original=structuredClone(turtleModel)
const turtle=await generateAttendancePdf(turtleModel,{centerName:'KIỂM THỬ phân trang'},{fetchImpl,includeLayoutProof:true})
assert.equal(turtle.pageCount,1,'All 12 rows, 7 occurrences, teacher and makeup notes fit on one approved A4 page')
assert.equal(turtle.pages[0].rowEnd-turtle.pages[0].rowStart,12)
assert(turtle.textRegions.some(region=>region.value.includes('08/09/2026')))
assert(turtle.textRegions.some(region=>region.value.includes('10/09/2026')))
assert.deepEqual(turtleModel,original,'Pagination never modifies the A6 matrix')
fs.writeFileSync(`${folder}/runtime-twelve-student-edge.pdf`,new Uint8Array(await turtle.blob.arrayBuffer()))

const batchModel=buildCanonicalAttendanceLedger({...options,occurrences:[...occurrences,
  fact('pagination-other-ca','2026-09-24',{class_session_local_id:'class-b',planned_start_time:'19:00:00',planned_end_time:'20:00:00',roster_student_ids:ids.slice(0,6)}),
  fact('historical-unknown-a','2026-09-26',{class_session_local_id:'',planned_start_time:'',planned_end_time:'',roster_student_ids:[ids[0]]}),
  fact('historical-unknown-b','2026-09-26',{class_session_local_id:'',planned_start_time:'',planned_end_time:'',roster_student_ids:[ids[1]]})]})
const batchBefore=structuredClone(batchModel)
const batch=await generateAttendancePdf(batchModel,{centerName:'KIỂM THỬ nhiều ca'},{fetchImpl,includeLayoutProof:true})
assert.equal(batch.sections.length,3,'Two known canonical slots and explicitly unassigned history remain separate')
assert.equal(batch.pageCount,3)
assert.deepEqual(batch.sections.map(section=>section.rows.length),[12,6,2])
assert(batch.sections[2].slots[0].unassigned)
assert(batch.sections[2].slots[0].label.includes('Chưa xác định ca'))
assert.equal(batch.sections[2].columns.length,2,'Incomplete historical records keep their distinct occurrence identities')
assert(batch.sections.every(section=>section.slots.length===1&&!section.showSlotCodes))
assert(batch.sections.every(section=>JSON.stringify(section.filters)===JSON.stringify(batch.projection.filters)),'Selected date, teacher and Student filters survive each section')
assert.deepEqual(batch.sections.flatMap(section=>section.columns.map(column=>column.key)).sort(),batch.projection.columns.map(column=>column.key).sort(),'Every canonical occurrence belongs to exactly one section')
const sourceCells=new Map(batch.projection.rows.flatMap(row=>row.cells.map(cell=>[JSON.stringify([row.studentId,cell.key]),cell])))
const expectedPairs=new Set(batch.projection.rows.flatMap(row=>row.cells.filter(cell=>cell.state!=='notExpected').map(cell=>JSON.stringify([row.studentId,cell.key]))))
const printedExpected=new Set()
for(const section of batch.sections)for(const row of section.rows)for(const cell of row.cells){
  const pair=JSON.stringify([row.studentId,cell.key]);assert.deepEqual(cell,sourceCells.get(pair),'Paper slices preserve canonical state and original makeup context verbatim')
  if(cell.state!=='notExpected'){assert(!printedExpected.has(pair));printedExpected.add(pair)}
}
assert.deepEqual(printedExpected,expectedPairs)
assert.deepEqual(batchModel,batchBefore)
assert(!batch.textRegions.some(region=>region.value.includes('Nhiều ca')),'A batch has no mixed super-matrix header')
assert(batch.textRegions.some(region=>region.value==='?'))
assert.equal(batch.textRegions.filter(region=>region.value==='Đã hủy').length,1)
fs.writeFileSync(`${folder}/runtime-multi-ca-batch.pdf`,new Uint8Array(await batch.blob.arrayBuffer()))

const filtered=buildCanonicalAttendanceLedger({...options,filters:{...base.filters,teacherId:'substitute',query:students[6].fullName}})
const filteredSections=createAttendancePdfSections(createAttendancePdfProjection(filtered))
assert.equal(filteredSections.length,1)
assert.equal(filteredSections[0].rows.length,1)
assert.equal(filteredSections[0].columns.length,1)
assert.equal(filteredSections[0].rows[0].cells[0].state,'makeup')
assert.equal(filteredSections[0].rows[0].cells[0].originalDate,'2026-09-10','Cross-date original absence context is retained after filtering')
assert.equal(filteredSections[0].filters.teacherId,'substitute')

const denseIds=Array.from({length:37},(_,index)=>`dense-student-${index}`)
const denseModel=buildCanonicalAttendanceLedger({...base,attendanceRecords:[],students:denseIds.map((id,index)=>({id,fullName:`Học viên ${index+1}`,level:'Turtle 2'})),
  occurrences:Array.from({length:33},(_,index)=>fact(`dense-occurrence-${index}`,'2026-09-21',{roster_student_ids:denseIds}))})
const dense=await generateAttendancePdf(denseModel,{centerName:'KIỂM THỬ ca dày'},{fetchImpl,includeLayoutProof:true})
assert.equal(dense.sections.length,1,'Density does not create additional ca identities')
const densePairs=new Set()
for(const page of dense.pages.filter(page=>page.kind==='matrix')){
  assert(page.columnWidth>=32)
  assert(page.rowEnd-page.rowStart>=2,'No unnecessary one-Student final roster page')
  assert(page.columnEnd-page.columnStart>=2,'No unnecessary one-column final window')
  for(let row=page.rowStart;row<page.rowEnd;row++)for(let col=page.columnStart;col<page.columnEnd;col++){
    const pair=JSON.stringify([row,col]);assert(!densePairs.has(pair));densePairs.add(pair)
  }
}
assert.equal(densePairs.size,37*33)
assert(dense.pages.some(page=>page.rowStart>0)&&dense.pages.some(page=>page.columnStart>0))
fs.writeFileSync(`${folder}/runtime-dense-single-ca.pdf`,new Uint8Array(await dense.blob.arrayBuffer()))

const previous=JSON.parse(fs.readFileSync(new URL('./fixtures/attendance-pdf/runtime-normal-proof.json',import.meta.url),'utf8'))
const [normalModel]=JSON.parse(fs.readFileSync(new URL('./fixtures/attendance-pdf/canonical-prototype-models.json',import.meta.url),'utf8'))
// Render this comparison independently; no preceding smoke run or output file is required.
normalModel.rows.forEach((row,index)=>{
  row.student.level=['Turtle 2','Dolphin 3','Eagle'][index%3]
  row.cells.forEach(cell=>{
    cell.occurrence=normalModel.columns.find(column=>column.key===cell.occurrenceKey)
    cell.originalOccurrence=cell.originalDate?{date:cell.originalDate,teacherName:cell.originalTeacher}:null
  })
})
const normalBefore=structuredClone(normalModel)
const normalResult=await generateAttendancePdf(normalModel,{centerName:previous.projection.centerName,capturedAt:previous.projection.capturedAt},{fetchImpl,includeLayoutProof:true})
// Compare the same JSON proof representation used before the fixture move.
const current=JSON.parse(JSON.stringify({projection:normalResult.projection,textRegions:normalResult.textRegions}))
assert.deepEqual(normalModel,normalBefore,'Normal comparison never modifies the canonical fixture')
assert.deepEqual(current.textRegions,previous.textRegions,'Normal single-ca type sizes, text coordinates and notes remain unchanged')
assert.deepEqual(current.projection,previous.projection)
const result={passed:true,twelveStudentEdgePages:1,canonicalBatchSections:3,canonicalBatchPages:3,denseSingleCaPages:dense.pageCount,
  denseCanonicalCells:densePairs.size,sourceMatrixUnchanged:true,normalTextAndGeometryUnchanged:true,canonicalCellsPreserved:true,filtersPreserved:true,businessWrites:0}
fs.writeFileSync(`${folder}/pagination-qa.json`,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify(result,null,2))
console.log('A7_2_1_ATTENDANCE_PDF_PAGINATION_SMOKE_PASS')
