export const ledgerFixture = () => {
  const fact = (id, date, values = {}) => ({
    center_id: 'a6-fixture', schedule_session_local_id: id, occurrence_date: date,
    class_session_local_id: 'class-a', lifecycle_state: 'HELD',
    planned_start_time: '17:30:00', planned_end_time: '18:30:00',
    roster_student_ids: ['student-a', 'student-b', 'student-left'],
    planned_teacher_id: 'teacher-history', planned_teacher_name: 'Thầy Lịch sử',
    actual_teacher_override: false, context_origin: 'CURRENT_SCHEDULE', ...values,
  })
  const record = (id, date, studentId, status, values = {}) => ({
    id: `${id}-${studentId}`, authorityLocalId: `attendance_record::v2-3::${id}::${date}::${studentId}::admin`,
    scheduleSessionId: id, sessionId: id, date, studentId, attendanceStatus: status,
    source: 'admin', attendanceAuthority: 'v2.3-occurrence-v1', cloudVersion: 1, ...values,
  })
  const missed = record('original', '2026-08-24', 'student-b', 'absent')
  return {
    students: [
      { id: 'student-a', fullName: 'Nguyễn Hoàng Minh Anh', studentCode: 'HV001', classSessionIds: ['class-b'] },
      { id: 'student-b', fullName: 'Trần An Bình', studentCode: 'HV002' },
      { id: 'student-left', fullName: 'Lê Học viên đã rời lớp', currentStatus: 'Đã nghỉ', isDeleted: true },
      { id: 'student-later', fullName: 'Học viên vào lớp sau', classSessionIds: ['class-a'] },
    ],
    classSessions: [
      { id: 'class-a', displayLabel: 'Lớp A', instructorName: 'Giáo viên hiện tại khác' },
      { id: 'class-b', displayLabel: 'Lớp B' },
    ],
    occurrences: [
      fact('original', '2026-08-24'),
      fact('held', '2026-09-21'),
      fact('second', '2026-09-21', { class_session_local_id: 'class-b', planned_start_time: '19:00:00',
        actual_teacher_override: true, actual_teacher_id: 'substitute', actual_teacher_name: 'Cô Dạy thay' }),
      fact('makeup', '2026-09-22'),
      fact('cancelled', '2026-09-23', { lifecycle_state: 'CANCELLED' }),
      fact('future', '2026-09-30', { lifecycle_state: 'PLANNED' }),
    ],
    attendanceRecords: [
      missed,
      record('held', '2026-09-21', 'student-a', 'present'),
      record('held', '2026-09-21', 'student-b', 'absent'),
      record('second', '2026-09-21', 'student-a', 'absent'),
      record('makeup', '2026-09-22', 'student-b', 'makeup', { makeupForAttendanceLocalId: missed.authorityLocalId }),
      // Poison fallbacks: none may become operational truth.
      record('held', '2026-09-21', 'student-left', 'absent', { attendanceAuthority: '', source: 'teacherReport' }),
      record('held', '2026-09-21', 'student-left', 'present', { source: 'initialBaseline' }),
      record('held', '2026-09-21', 'student-left', 'absent', { cloudVersion: 0 }),
      record('future', '2026-09-30', 'student-a', 'absent'),
      record('cancelled', '2026-09-23', 'student-a', 'absent'),
    ],
    packageCycleReady: true,
    packageCycleStudentStates: [{ studentId: 'student-a', currentCycle: {
      id: 'cycle-a', cycleNumber: 1, usedSessions: 4, totalSessions: 8, remainingSessions: 4, packageName: 'Gói 8 buổi',
    } }],
    now: new Date('2026-09-28T05:00:00Z'),
    filters: { fromDate: '2026-09-01', toDate: '2026-09-30', classSessionId: 'all', teacherId: 'all', query: '' },
  }
}
