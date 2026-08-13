export const TEST_IMPORT_SOURCE_TAG = 'qa-attendance-import-v1'
export const TEST_IMPORT_BATCH_ID = 'qa-attendance-batch-v1'

export function buildAttendanceSharedTruthFixture() {
  const classSessions = [
    {
      id: 'class-session-qa-t4-t6-1900-2030',
      name: 'T4-T6 19:00-20:30',
      displayLabel: 'T4-T6 19:00-20:30',
      daysLabel: 'T4-T6',
      daysOfWeek: ['wed', 'fri'],
      startTime: '19:00',
      endTime: '20:30',
      status: 'active',
    },
    {
      id: 'class-session-qa-t7-cn-1030-1200',
      name: 'T7-CN 10:30-12:00',
      displayLabel: 'T7-CN 10:30-12:00',
      daysLabel: 'T7-CN',
      daysOfWeek: ['sat', 'sun'],
      startTime: '10:30',
      endTime: '12:00',
      status: 'active',
    },
  ]
  const students = [
    {
      id: 'student-qa-primary',
      studentCode: 'QA-001',
      fullName: 'Hoc vien QA chinh',
      classSessionIds: [classSessions[0].id],
      currentStatus: 'Dang theo hoc',
    },
    {
      id: 'student-qa-combined',
      studentCode: 'QA-002',
      fullName: 'Hoc vien QA bu hoc',
      classSessionIds: [classSessions[1].id],
      currentStatus: 'Dang theo hoc',
    },
  ]
  const teachers = [
    {
      id: 'teacher-qa-shared-truth',
      fullName: 'Giao vien QA',
      status: 'active',
      assignedStudentIds: students.map((student) => student.id),
    },
  ]
  const tuitionRecords = students.map((student) => ({
    id: `tuition-${student.id}`,
    studentId: student.id,
    totalSessions: 8,
    usedSessions: 0,
    paidAmount: 1000000,
    totalAmount: 1000000,
  }))
  const sessionReports = [
    ...['2026-05-29', '2026-06-03', '2026-06-05', '2026-06-10', '2026-06-12', '2026-06-17', '2026-06-19', '2026-06-24', '2026-06-26', '2026-07-01'].map(
      (date, index) => createReport({
        id: `report-primary-${date}`,
        date,
        classSessionId: classSessions[0].id,
        student: students[0],
        teacher: teachers[0],
        displayValue: index === 3 ? 'T' : String((index % 8) + 1),
      }),
    ),
    ...['2026-05-30', '2026-05-31', '2026-06-06', '2026-06-07', '2026-06-13', '2026-06-14', '2026-06-20', '2026-06-21', '2026-06-27', '2026-06-28'].map(
      (date, index) => createReport({
        id: `report-combined-${date}`,
        date,
        classSessionId: classSessions[1].id,
        student: students[1],
        teacher: teachers[0],
        displayValue: date === '2026-06-06' ? '7+8' : String((index % 8) + 1),
      }),
    ),
  ]

  return { students, teachers, classSessions, tuitionRecords, sessionReports }
}

function createReport({ id, date, classSessionId, student, teacher, displayValue }) {
  const isTrial = displayValue === 'T'
  const creditNumbers = isTrial
    ? []
    : displayValue.split('+').map(Number)

  return {
    id,
    sessionId: `session-${id}`,
    occurrenceDate: date,
    classSessionId,
    teacherId: teacher.id,
    teacherName: teacher.fullName,
    sourceModule: 'qa-attendance-import',
    sourceTag: TEST_IMPORT_SOURCE_TAG,
    importBatchId: TEST_IMPORT_BATCH_ID,
    isImportedAttendance: true,
    attendance: [
      {
        studentId: student.id,
        studentName: student.fullName,
        classSessionId,
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        attendanceStatus: isTrial ? 'trial' : 'present',
        status: isTrial ? 'trial' : 'present',
        displayValue,
        credits: isTrial
          ? [{ displayValue: 'T', sessionNumber: null, creditType: 'trial' }]
          : creditNumbers.map((credit) => ({ displayValue: String(credit), sessionNumber: credit })),
        countsTowardTuition: !isTrial,
        isCombinedCredit: creditNumbers.length > 1,
        needsMakeupReview: creditNumbers.length > 1,
        note: isTrial ? 'Học thử.' : creditNumbers.length > 1 ? 'Can kiem tra hoc bu.' : '',
        sourceModule: 'qa-attendance-import',
        sourceTag: TEST_IMPORT_SOURCE_TAG,
        importBatchId: TEST_IMPORT_BATCH_ID,
        isImportedAttendance: true,
      },
    ],
  }
}
