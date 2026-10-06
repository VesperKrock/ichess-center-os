import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildCanonicalAttendanceLedger } from '../src/attendance-ledger.js'
import { buildTuitionRows } from '../src/tuition-module.js'
import { buildReportData } from '../src/report-module.js'
import { buildScheduleAttentionNotificationCandidates, tagNotificationCandidates, upsertNotificationCandidates } from '../src/notification-center.js'
import { buildOverdueAttendanceCandidates, getAttendanceReminderFilters, getNotificationAttendanceMonthRange,
  getNotificationRoute, getPersistableNotificationItems } from '../src/notification-operational-assistant.js'
import { getStoredNotifications, saveStoredNotifications, saveNotificationViewedState,
  setCurrentInstallationStorageNamespace, setCurrentStorageCenterId, setCurrentNotificationAccountId } from '../src/storage.js'

const centerId = 'n6-fixture', now = new Date('2026-10-06T01:00:00Z')
const range = getNotificationAttendanceMonthRange(now)
assert.deepEqual(range, { fromDate:'2026-10-01', toDate:'2026-10-31', classSessionId:'all', teacherId:'all', query:'' })
assert.equal(getNotificationAttendanceMonthRange(new Date('2026-10-31T17:01:00Z')).fromDate, '2026-11-01')
const students = ['s1','s2','s3'].map(id => ({ id, centerId, fullName:id }))
const classSessions = ['turtle','dolphin','zero'].map(id => ({ id, centerId, displayLabel:id === 'turtle' ? 'Turtle' : id }))
const planned = (id, ca, date, ids) => ({ id, centerId, classSessionId:ca, occurrenceDate:date,
  startTime:'17:30', endTime:'18:30', studentIds:ids, scheduleType:'oneOff', cloudVersion:1 })
const plannedOccurrences = [planned('t1','turtle','2026-10-01',['s1','s2']),
  planned('t2','turtle','2026-10-02',['s1','s2']), planned('t5','turtle','2026-10-05',['s1','s2']),
  planned('today','turtle','2026-10-06',['s1','s2']), planned('future','turtle','2026-10-08',['s1','s2']),
  planned('d3','dolphin','2026-10-03',['s1']), planned('zero','zero','2026-10-01',['s3'])]
const mark = (id, studentId, scheduleSessionId, classSessionId, date, attendanceStatus, extra = {}) => ({
  id, authorityLocalId:id, centerId, cloudVersion:1, attendanceAuthority:'v2.3-occurrence-v1', source:'admin',
  studentId, scheduleSessionId, classSessionId, date, attendanceStatus, ...extra,
})
const attendanceRecords = [mark('p','s1','t1','turtle','2026-10-01','present'),
  mark('v','s2','t1','turtle','2026-10-01','absent'), mark('source-v','s3','old','turtle','2026-09-15','absent'),
  mark('b','s3','d3','dolphin','2026-10-03','makeup',{makeupForAttendanceLocalId:'source-v'}),
  mark('zero-p','s3','zero','zero','2026-10-01','present'),
  mark('legacy-poison','s1','t5','turtle','2026-10-05','present',{source:'teacherReport'})]
const cancelled = { center_id:centerId, schedule_session_local_id:'t2', occurrence_date:'2026-10-02',
  class_session_local_id:'turtle', roster_student_ids:['s1','s2'], lifecycle_state:'CANCELLED' }
const source = {status:'ready',centerId,...range,students,classSessions,plannedOccurrences,attendanceRecords,
  occurrences:[cancelled, {...cancelled,schedule_session_local_id:'d3',occurrence_date:'2026-10-03',
    class_session_local_id:'dolphin',roster_student_ids:['s1'],lifecycle_state:'HELD'},
    {...cancelled, center_id:'other',schedule_session_local_id:'foreign',lifecycle_state:'HELD'}],
  makeupBookings:[{center_id:centerId,state:'COMPLETED',student_local_id:'s3',source_attendance_local_id:'source-v',
    destination_schedule_local_id:'d3',destination_date:'2026-10-03'}]}
const before = structuredClone(source)
const canonicalSource = {...source,occurrences:source.occurrences.filter(fact=>fact.center_id === centerId)}
const candidates = buildOverdueAttendanceCandidates(source,{centerId,now})
assert.deepEqual(candidates.map(c=>[c.meta.classSessionId,c.meta.overdueUnmarkedCount]), [['turtle',2],['dolphin',1]])
assert.equal(candidates[0].title,'Ca Turtle còn 2 ô quá ngày chưa điểm danh.')
assert.equal(candidates[0].sourceModule,'bang-diem-danh')
assert.deepEqual(source,before,'Derivation never mutates canonical truth or a booking')
for(const item of candidates) {
  const route = getNotificationRoute(item,centerId)
  assert.deepEqual(route,{moduleId:'bang-diem-danh',classSessionId:item.meta.classSessionId,month:'2026-10'})
  const model = buildCanonicalAttendanceLedger({...canonicalSource,filters:getAttendanceReminderFilters(route),monthlyProjection:true,now})
  assert.equal(item.meta.overdueUnmarkedCount,model.overdueUnmarkedCount,'Bell and the destination board use the identical count')
}
assert.equal(getNotificationRoute(candidates[0],'other'),null)
assert.equal(getNotificationRoute({...candidates[0],meta:{...candidates[0].meta,month:'2026-13'}},centerId),null)
for(const bad of [{...source,status:'loading'},{...source,status:'failed'},{...source,centerId:'other'},
  {...source,fromDate:'2026-09-01',toDate:'2026-09-30'}]) assert.equal(buildOverdueAttendanceCandidates(bad,{centerId,now}).length,0)
assert.equal(buildOverdueAttendanceCandidates({...source,plannedOccurrences:[],occurrences:[],attendanceRecords:[],makeupBookings:[]},{centerId,now}).length,0)
let current = upsertNotificationCandidates([],candidates,{readyProviders:['attendance-overdue']})
current = upsertNotificationCandidates(current,[...candidates,...candidates],{readyProviders:['attendance-overdue']})
assert.equal(current.length,2,'One item per center + Ca + month across refresh/replayed candidates')
const corrected = {...source,attendanceRecords:[...attendanceRecords,
  mark('c1','s1','t5','turtle','2026-10-05','present'),mark('c2','s2','t5','turtle','2026-10-05','present')]}
current = upsertNotificationCandidates(current,buildOverdueAttendanceCandidates(corrected,{centerId,now}),{readyProviders:['attendance-overdue']})
assert.equal(current.length,1);assert.equal(current[0].meta.classSessionId,'dolphin','Normal refresh removes a resolved Ca without touching Attendance')
const failed = upsertNotificationCandidates(current,[],{readyProviders:[]})
assert.equal(failed[0].meta.stale,true,'Failed reads cannot silently resolve a reminder')

const memory = new Map()
globalThis.localStorage = {getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}
setCurrentInstallationStorageNamespace('n6');setCurrentStorageCenterId(centerId);setCurrentNotificationAccountId('operator')
const unrelated = {id:'unrelated',dedupeKey:'unrelated',type:'system',sourceModule:'he-thong',title:'Existing',message:'Existing'}
saveStoredNotifications(getPersistableNotificationItems([...current,unrelated]))
saveNotificationViewedState(getPersistableNotificationItems(current.map(item=>({...item,readAt:now.toISOString()}))))
assert.equal(getStoredNotifications([]).length,1)
assert([...memory.values()].every(value=>!value.includes('attendance-overdue')),'No persisted derived reminder or viewed row')

const planning = tagNotificationCandidates(buildScheduleAttentionNotificationCandidates([{id:'trial',centerId,
  scheduleType:'oneOff',occurrenceDate:'2026-10-06',occurrenceReason:'trial',title:'Học thử',startTime:'16:00',endTime:'17:00'}],
  {centerId,today:now}),{centerId,providerId:'schedule-attention'})[0]
assert.equal(planning.sourceLabel,'Lịch làm việc tuần')
assert.deepEqual(getNotificationRoute(planning,centerId),{moduleId:'thoi-khoa-bieu',sessionId:'trial',occurrenceDate:'2026-10-06'})
assert.equal(getNotificationRoute(planning,'other'),null)

// Existing authoritative totals win over poisoned local Attendance/report/month inputs.
const state = {studentId:'s3',centerId,readiness:'READY',currentCycle:{id:'cycle',usedSessions:6,totalSessions:16,remainingSessions:10}}
const rows = month => buildTuitionRows(students,[{usedSessions:99}], [{students:[{id:'s3',status:'present'}]}],[],
  {month,packageCycleReady:true,packageCycleStudentStates:[state]})
assert.equal(rows('2026-09')[2].tuition.usedSessions,6)
assert.deepEqual(rows('2026-09')[2],rows('2026-10')[2],'Month navigation never resets Tuition')
const ledger = buildCanonicalAttendanceLedger({...canonicalSource,filters:range,monthlyProjection:true,now})
const report = buildReportData({filters:{weekStartDate:'2026-09-28',reportDate:'2026-10-03'},attendanceLedger:ledger,
  attendanceRecords:[{status:'absent'}],sessionReports:[{students:[{status:'present'}]}],tuitionRecords:[{paidAmount:999999}],
  cashflowTransactions:[{id:'money',date:'2026-10-03',type:'income',amount:123000}]})
assert.equal(report.attendanceSummary.source,'A6_CANONICAL_ATTENDANCE_LEDGER')
assert.equal(report.attendanceSummary.presentCount,2)
assert.equal(report.attendanceSummary.absentCount,1)
assert.equal(report.attendanceSummary.makeupCount,1,'One destination B; original V remains a separate historical absence')
assert.equal(report.dailyIncome,123000,'Only Finance transactions contribute money')
assert.equal(buildReportData({filters:report.filters,attendanceLedger:ledger,tuitionRecords:[{paidAmount:999999}]}).dailyIncome,0)

// The integration refresh and route execute existing readers only. Frozen writes stay separate.
const main = fs.readFileSync('src/main.js','utf8')
const refresh = main.match(/async function runNotificationAuthoritativeRefresh\([\s\S]*?\n\}/)[0]
assert(refresh.includes('getNotificationAttendanceMonthRange()'))
assert(refresh.includes('includeMakeupBookings: true'))
assert(refresh.includes('getAttendanceLedgerPlannedOccurrences'))
assert(!/mutate|RESOLVE/.test(refresh))
assert(!main.includes('buildIncompleteAttendanceCandidates('))
assert(!main.includes('buildMissingSessionReportNotificationCandidates('))
const bellRoute = main.slice(main.indexOf("if (notification.meta?.signal === 'attendance-overdue')"),main.indexOf("if (route?.moduleId === 'hoc-phi'"))
assert(bellRoute.includes('confirmAttendanceBoardNavigation()'))
assert(bellRoute.includes('attendanceBoardFilters = getAttendanceReminderFilters(route)'))
assert(bellRoute.includes("refreshModuleAuthoritativeUpstreams('bang-diem-danh'"))
assert(bellRoute.includes("openModuleWindowFromChildInteraction('bang-diem-danh'"))
assert(!/mutate|resolveCurrentSchedule/.test(bellRoute))
for(const call of main.matchAll(/save(?:StoredNotifications|NotificationViewedState)\(([^\n]+)\)/g))
  assert(call[1].startsWith('getPersistableNotificationItems('),'Every Bell persistence entry point excludes derived reminders')
console.log('N6_DOWNSTREAM_INTEGRATION_SMOKE PASS')
