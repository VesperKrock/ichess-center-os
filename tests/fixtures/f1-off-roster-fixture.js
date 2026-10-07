export const f1Fixture = () => {
  const centerId = 'f1-disposable'
  const studentId = 'que-phuong'
  const occurrence = (schedule, date, regular, extra = {}) => ({ center_id: centerId,
    schedule_session_local_id: schedule, occurrence_date: date,
    class_session_local_id: regular ? 'evening' : 'weekend', schedule_type: 'recurring',
    planned_start_time: regular ? '19:00:00' : '10:30:00',
    planned_end_time: regular ? '20:30:00' : '12:00:00',
    roster_student_ids: regular ? [studentId] : ['weekend-child'],
    lifecycle_state: 'HELD', planned_teacher_name: '', actual_teacher_override: false,
    context_origin: 'CURRENT_SCHEDULE', ...extra })
  const source = f1Record('friday','2026-10-02',studentId,'absent')
  return { centerId, studentId, now: new Date('2026-10-08T07:00:00Z'), monthlyProjection: true,
    students: [{id:studentId,fullName:'Quế Phương',studentCode:'HV001',birthYear:2017,level:'Level 2',
      classSessionIds:['evening']}, {id:'weekend-child',fullName:'Nguyễn Hoàng Minh Anh',birthYear:2018,level:'Level 1',classSessionIds:['weekend']}],
    classSessions: [{id:'evening',name:'T4 + T6 · 19:00–20:30',daysOfWeek:['wed','fri'],startTime:'19:00',endTime:'20:30'},
      {id:'weekend',name:'T7 + CN · 10:30–12:00',daysOfWeek:['sat','sun'],startTime:'10:30',endTime:'12:00'}],
    scheduleSessions: ['wednesday','friday','saturday','sunday'].map((id,i)=>({id,
      classSessionId:i<2?'evening':'weekend',scheduleType:'recurring',dayOfWeek:['wed','fri','sat','sun'][i],
      studentIds:i<2?[studentId]:['weekend-child'],cloudVersion:1,startDate:'2026-09-01',status:'scheduled'})),
    enrollmentSets: [{studentId,version:1,enrollments:[{classSessionId:'evening',weekdays:['wed','fri']}]}],
    occurrences: [occurrence('friday','2026-10-02',true),occurrence('saturday','2026-10-03',false),
      occurrence('sunday','2026-10-04',false),occurrence('wednesday','2026-10-07',true),
      occurrence('saturday','2026-10-10',false,{lifecycle_state:'PLANNED'}),
      occurrence('sunday','2026-10-11',false,{lifecycle_state:'PLANNED'})],
    attendanceRecords:[source],makeupBookings:[],filters:{month:'2026-10'},
    packageCycleReady:true,packageCycleStudentStates:[{studentId,currentCycle:{id:'cycle',cycleNumber:1,
      packageName:'Gói 16 buổi',totalSessions:16,usedSessions:0,remainingSessions:16}}],
  }
}
export function f1Record(schedule,date,student,status,extra={}) {
  const id=`f1-${schedule}-${date}-${student}`
  return {id,authorityLocalId:id,attendanceAuthority:'v2.3-occurrence-v1',source:'admin',cloudVersion:1,
    studentId:student,scheduleSessionId:schedule,sessionId:schedule,date,
    classSessionId:['wednesday','friday'].includes(schedule)?'evening':'weekend',
    attendanceStatus:status,status,...extra}
}
