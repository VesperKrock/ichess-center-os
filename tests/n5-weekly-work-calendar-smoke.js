import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
  getCurrentScheduleWeekStartDate, getPreviousScheduleWeekStartDate, getNextScheduleWeekStartDate,
  getVisibleScheduleSessions, renderScheduleModule, createEmptyScheduleFormState,
  createCenterCalendarItemDetailState, createEmptyCenterCalendarItemFormState,
  getSchedulePlannedAppointments,
} from '../src/schedule-module.js'
import {createSchedulePrintSnapshot, renderSchedulePrintDocument} from '../src/schedule-print-module.js'
import {getModuleRefreshContract} from '../src/module-authority-registry.js'
import {buildOnlineAccessState, canWriteEntity} from '../src/online-access-control.js'
import {canWriteC57SharedTruth} from '../src/cloud-authoritative-calendar-notes.js'

const now = new Date('2026-10-06T12:00:00+07:00')
assert.equal(getCurrentScheduleWeekStartDate(now), '2026-10-05')
assert.equal(getPreviousScheduleWeekStartDate('2026-10-05'), '2026-09-28')
assert.equal(getNextScheduleWeekStartDate('2026-10-05'), '2026-10-12')
assert.equal(getNextScheduleWeekStartDate('2026-12-28'), '2027-01-04')
const classes = [{id:'turtle', name:'Ca Turtle', daysOfWeek:['tuesday','thursday'], startTime:'17:30',endTime:'18:30',status:'active'}]
const sessions = ['tuesday','thursday'].map(day => ({id:day, classSessionId:'turtle',scheduleType:'recurring',dayOfWeek:day,
  title:'Ca Turtle',startDate:'2026-09-01',endDate:'2026-10-31',startTime:'17:30',endTime:'18:30',studentIds:['s1'],status:'scheduled'}))
sessions.push({id:'trial',scheduleType:'oneOff',title:'Học thử An',occurrenceReason:'trial',date:'2026-10-07',
  startTime:'18:00',endTime:'18:45',teacherName:'GV Lan',studentIds:[],status:'scheduled'})
sessions.push({id:'cancelled',scheduleType:'oneOff',title:'Ca đã hủy',date:'2026-10-08',
  startTime:'19:00',endTime:'20:00',studentIds:[],status:'cancelled'})
const teacherContext = {assignments:[{class_session_local_id:'turtle',effective_from:'2026-09-28',
  effective_until:null, teacher_id:'teacher',teacher_name:'GV Bình'}],occurrences:[]}
const activity = {id:'meeting',itemType:'other',title:'Đánh giá học viên',startAt:'2026-10-07T16:00:00',
  endAt:'2026-10-07T17:00:00',description:'Ghi chú riêng',location:'Phòng 1',colorKey:'blue'}
const render = (overrides={}) => renderScheduleModule(sessions,overrides.formState || null,
  // A stale legacy report state must never bring Attendance back to the week.
  {sessionId:'trial',occurrenceDate:'2026-10-07',mode:'teacherReport'},[],null,null,null,null,false,null,[],
  [{id:'s1',fullName:'Học viên riêng'}],overrides.week || '2026-10-05',null,{
    classSessions:classes, a3TeacherContext:teacherContext, centerId:'phongtrong_prod',
    viewMode:'classes',
    centerCalendarItems:[activity], centerCalendarTags:[], canEditSchedule:true, canEditCalendar:true, now,
    ...overrides,
  })
const html=render()
assert(html.includes('Lịch làm việc tuần'))
assert.equal((html.match(/data-schedule-day-date=/g)||[]).length,7)
assert(html.includes('data-schedule-day-date="2026-10-06"'))
assert(html.includes('is-today'))
assert(html.includes('GV: GV Bình'))
assert(html.includes('17:30-18:30'))
assert(html.includes('Học thử An'))
assert(!html.includes('Đánh giá học viên'), 'F2 class scope excludes Activity')
const activitiesHtml=render({viewMode:'activities'})
assert(activitiesHtml.includes('Đánh giá học viên'))
assert(!activitiesHtml.includes('Học thử An'), 'F2 Activity scope excludes scheduled sessions')
assert(html.includes('is-cancelled'))
assert(html.includes('Đã hủy'))
assert(!html.includes('Ghi chú riêng'))
assert(!html.includes('Học viên riêng'))
assert(!html.includes('data-a3-teacher-action'))
const forbidden=/a5-card-attendance|schedule-report-panel|data-admin-attendance|data-attendance-save|save-attendance|data-session-guest|data-session-report|Lưu điểm danh|Lý do vắng|schedule-alert-bell/
assert.doesNotMatch(html,forbidden)
const detail=render({planDetail:{sessionId:'tuesday',occurrenceDate:'2026-10-06'}})
assert(detail.includes('data-schedule-plan-detail'))
assert(detail.includes('Học viên riêng'))
assert(detail.includes('data-schedule-plan-action="edit"'))
assert.doesNotMatch(detail,forbidden)
const missingTeacher=render({a3TeacherContext:{assignments:[],occurrences:[]}})
assert(missingTeacher.includes('GV: Chưa rõ'))
assert(!missingTeacher.includes('GV: GV Bình'))
const next=render({week:'2026-10-12',planDetail:{sessionId:'trial',occurrenceDate:'2026-10-07'}})
assert(next.includes('data-schedule-day-date="2026-10-13"'))
assert(!next.includes('Học thử An'))
assert(!next.includes('data-schedule-plan-detail'))
const boundaryItems = [
  {...activity,id:'mon',title:'Monday midnight',startAt:'2026-10-04T17:00:00Z',endAt:'2026-10-04T17:30:00Z'},
  {...activity,id:'tue',title:'Tuesday early',startAt:'2026-10-05T20:00:00Z',endAt:'2026-10-05T21:00:00Z'},
  {...activity,id:'sun',title:'Sunday late',startAt:'2026-10-11T16:00:00Z',endAt:'2026-10-11T16:30:00Z'},
  {...activity,id:'next',title:'Next Monday',startAt:'2026-10-11T17:00:00Z',endAt:'2026-10-11T18:00:00Z'},
]
const boundaryHtml=render({viewMode:'activities',centerCalendarItems:boundaryItems})
const dayHtml=date=>boundaryHtml.split(`data-schedule-day-date="${date}"`)[1].split('</section>')[0]
assert(dayHtml('2026-10-05').includes('Monday midnight'))
assert(!dayHtml('2026-10-05').includes('Tuesday early'))
assert(dayHtml('2026-10-06').includes('Tuesday early'))
assert(dayHtml('2026-10-11').includes('Sunday late'))
assert(!boundaryHtml.includes('Next Monday'))
const crmContacts=[{id:'contact',canonicalCaseId:'canonical-case',leadStudentName:'CRM trial child',parentName:'CRM parent',
  appointments:[
    {id:'date-only',canonicalAppointmentId:'canonical-appointment',appointmentType:'trialLesson',sourceType:'trial-booking',
      scheduledAt:'2026-10-08T00:00:00.000Z',status:'scheduled',note:'CRM private note'},
    {id:'timed',canonicalAppointmentId:'canonical-timed',appointmentType:'callback',scheduledAt:'2026-10-07T11:00:00Z',status:'scheduled'},
    {id:'cancelled',canonicalAppointmentId:'canonical-cancelled',appointmentType:'trialLesson',scheduledAt:'2026-10-09T11:00:00Z',status:'cancelled'},
    {id:'unverified-local',appointmentType:'trialLesson',scheduledAt:'2026-10-08T00:00:00Z',status:'scheduled'},
  ]}]
const crmBefore=JSON.stringify(crmContacts)
const crmProjection=getSchedulePlannedAppointments(crmContacts,'2026-10-05')
assert.equal(crmProjection.length,3)
assert.equal(crmProjection.find(item=>item.id==='date-only').timeLabel,'Chưa rõ giờ')
assert.equal(crmProjection.find(item=>item.id==='timed').timeLabel,'18:00')
assert.equal(getSchedulePlannedAppointments([{...crmContacts[0],canonicalCaseId:''}],'2026-10-05').length,0)
assert.equal(getSchedulePlannedAppointments(crmContacts,'2026-10-12').length,0)
const crmHtml=render({viewMode:'activities',crmContacts})
assert(crmHtml.includes('data-schedule-crm-appointment="date-only"'))
assert(crmHtml.includes('Chưa rõ giờ'))
assert(!crmHtml.includes('CRM private note'))
assert(!crmHtml.includes('unverified-local'))
assert.doesNotMatch(crmHtml,forbidden)
const crmDetail=render({viewMode:'activities',crmContacts,planDetail:{kind:'crm',contactId:'contact',appointmentId:'date-only'}})
assert(crmDetail.includes('data-schedule-appointment-detail'))
assert(crmDetail.includes('CRM private note'))
assert(crmDetail.includes('data-schedule-plan-action="open-contact"'))
assert(!crmDetail.includes('data-schedule-action="save-form"'))
assert.equal(JSON.stringify(crmContacts),crmBefore)
const noWrite=render({canEditSchedule:false,canEditCalendar:false,formState:createEmptyScheduleFormState(),
  planDetail:{sessionId:'tuesday',occurrenceDate:'2026-10-06'},centerCalendarItemState:createCenterCalendarItemDetailState(activity)})
assert(noWrite.includes('data-schedule-plan-detail'))
assert(noWrite.includes('data-center-calendar-detail'))
assert.doesNotMatch(noWrite,/data-schedule-plan-action="edit"|data-schedule-action="(?:open-create|open-create-for-day|save-form)"|data-center-calendar-action="(?:open-create|edit|confirm-delete)"|data-a3-teacher-action/)
const readOnlyCreate=render({canEditSchedule:false,canEditCalendar:false,centerCalendarItemState:createEmptyCenterCalendarItemFormState()})
assert(!readOnlyCreate.includes('data-center-calendar-action="save"'))
for (const role of ['owner','qtv','center_admin','viewer','teacher','consultant']) {
  const access=buildOnlineAccessState({isSupabaseConfigured:true,isSignedIn:true,cloudReady:true,centerId:'phongtrong_prod',membership:{role,center_id:'phongtrong_prod'},role})
  const expected=['owner','qtv','center_admin'].includes(role)
  assert.equal(canWriteEntity(access,'schedule_session'),expected)
  assert.equal(canWriteC57SharedTruth(access).canWrite,expected)
}
assert.equal(getVisibleScheduleSessions(sessions,'2026-10-05',classes).filter(s=>s.classSessionId==='turtle').length,2)
const print=createSchedulePrintSnapshot({centerId:'phongtrong_prod',centerName:'Phòng Trống',weekStartDate:'2026-10-05',
  sessions,classSessions:classes,centerCalendarItems:[activity],teacherContext,createdAt:now.toISOString()})
const document=renderSchedulePrintDocument(print)
assert(document.includes('Lịch làm việc tuần'))
assert(document.includes('Học thử An'))
assert(document.includes('Đánh giá học viên'))
assert.doesNotMatch(document,forbidden)
const boundaryPrint=createSchedulePrintSnapshot({centerId:'phongtrong_prod',weekStartDate:'2026-10-05',
  sessions:[],classSessions:[],centerCalendarItems:boundaryItems,createdAt:now.toISOString()})
assert(boundaryPrint.entries.some(entry=>entry.title==='Monday midnight'&&entry.date==='2026-10-05'))
assert.equal(boundaryPrint.entries.find(entry=>entry.title==='Monday midnight').timeLabel,'00:00-00:30')
assert.equal(boundaryPrint.entries.find(entry=>entry.title==='Tuesday early').timeLabel,'03:00-04:00')
assert(boundaryPrint.entries.some(entry=>entry.title==='Sunday late'&&entry.date==='2026-10-11'))
assert(!boundaryPrint.entries.some(entry=>entry.title==='Next Monday'))
const crmPrint=createSchedulePrintSnapshot({centerId:'phongtrong_prod',weekStartDate:'2026-10-05',sessions:[],classSessions:[],crmContacts})
assert.equal(crmPrint.entries.length,3)
assert(crmPrint.entries.some(entry=>entry.label==='Học thử'&&entry.timeLabel==='Chưa rõ giờ'))
const main=readFileSync('src/main.js','utf8')
const bindings=main.slice(main.indexOf('  // Weekly cards open planning facts only;'),main.indexOf("  document.querySelectorAll('[data-student-sort]')"))
assert(bindings.length>1000)
assert.doesNotMatch(bindings,/v2_9_mutate_attendance_batch|mutateAuthoritativeAttendanceBatch|writeC52Attendance|writeV23Attendance|writeV28AAttendance/)
assert(bindings.includes('detail.centerId !== getCurrentCanonicalCenterContext().centerId'))
assert(main.includes('schedulePlanDetailState?.centerId === getCurrentCanonicalCenterContext().centerId'))
assert(main.includes('schedulePlanDetailState = null\n  scheduleFormState = null'))
assert(main.includes('c53CrmSharedTruthState.centerId === centerId'))
const branch=main.slice(main.indexOf("  if (moduleItem.id === 'thoi-khoa-bieu')"),main.indexOf("  if (moduleItem.id === 'hoc-phi')"))
assert(!branch.includes('attendanceRecords'))
assert(branch.includes('canEditSchedule: canWriteCoreCloudDb(CLOUD_ENTITY_TYPES.SCHEDULE_SESSION)'))
const contract=getModuleRefreshContract('thoi-khoa-bieu')
assert(!contract.optional.includes('attendance'))
assert(contract.optional.includes('crm'))
console.log('N5_WEEKLY_WORK_CALENDAR_SMOKE: PASS')
