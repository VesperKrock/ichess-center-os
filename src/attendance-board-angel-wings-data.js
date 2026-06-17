export const ANGEL_WINGS_SOURCE_MODULE = 'angel-wings-import'
export const ANGEL_WINGS_SOURCE_TAG = 'angel-wings-2026-06'
export const ANGEL_WINGS_DATASET_ID = 'angel-wings-2026-06'
export const ANGEL_WINGS_DATASET_VERSION = 'f15k5-real-linked-dataset-v1'
export const ANGEL_WINGS_IMPORT_BATCH_ID = 'angel-wings-2026-06-f15k5'
export const ANGEL_WINGS_TEACHER_ID = 'teacher-pham-duc-thang'
export const ANGEL_WINGS_TEACHER_NAME = 'Phạm Đức Thắng'
export const ANGEL_WINGS_CREATED_AT = '2026-06-01T00:00:00.000Z'
export const ANGEL_WINGS_UPDATED_AT = '2026-06-17T00:00:00.000Z'
export const ANGEL_WINGS_PACKAGE_CATALOG_KEY = 'ichessCenterOS.tuitionPackages.dreamhome'

export const angelWingsPackageCatalog = [
  {
    id: 'package-8-sessions',
    name: 'Gói 8 buổi',
    sessionCount: 8,
    price: 1000000,
    displayLabel: 'Gói 8 buổi — 1.000.000 VNĐ',
  },
  {
    id: 'package-16-sessions',
    name: 'Gói 16 buổi',
    sessionCount: 16,
    price: 1800000,
    displayLabel: 'Gói 16 buổi — 1.800.000 VNĐ',
  },
  {
    id: 'package-32-sessions',
    name: 'Gói 32 buổi',
    sessionCount: 32,
    price: 3200000,
    displayLabel: 'Gói 32 buổi — 3.200.000 VNĐ',
  },
].map((item) => withSource(item))

export const angelWingsClassSessions = [
  {
    id: 'class-session-aw-t4-t6-1900-2030',
    name: 'T4-T6 19:00-20:30',
    displayLabel: 'T4-T6 19:00-20:30',
    daysLabel: 'T4-T6',
    dayLabel: 'T4-T6',
    startTime: '19:00',
    endTime: '20:30',
  },
  {
    id: 'class-session-aw-t7-cn-1500-1630',
    name: 'T7-CN 15:00-16:30',
    displayLabel: 'T7-CN 15:00-16:30',
    daysLabel: 'T7-CN',
    dayLabel: 'T7-CN',
    startTime: '15:00',
    endTime: '16:30',
  },
  {
    id: 'class-session-aw-t7-cn-1030-1200',
    name: 'T7-CN 10:30-12:00',
    displayLabel: 'T7-CN 10:30-12:00',
    daysLabel: 'T7-CN',
    dayLabel: 'T7-CN',
    startTime: '10:30',
    endTime: '12:00',
  },
  {
    id: 'class-session-aw-t7-cn-1730-1900',
    name: 'T7-CN 17:30-19:00',
    displayLabel: 'T7-CN 17:30-19:00',
    daysLabel: 'T7-CN',
    dayLabel: 'T7-CN',
    startTime: '17:30',
    endTime: '19:00',
  },
].map((item) =>
  withSource({
    ...item,
    status: 'active',
    teacherId: ANGEL_WINGS_TEACHER_ID,
    teacherName: ANGEL_WINGS_TEACHER_NAME,
    note: 'Dữ liệu chuẩn Angel Wings 06/2026.',
    createdAt: ANGEL_WINGS_CREATED_AT,
    updatedAt: ANGEL_WINGS_UPDATED_AT,
  }),
)

export const angelWingsAttendanceSheets = [
  {
    classSessionId: 'class-session-aw-t4-t6-1900-2030',
    dates: [
      '2026-05-29',
      '2026-06-03',
      '2026-06-05',
      '2026-06-10',
      '2026-06-12',
      '2026-06-17',
      '2026-06-19',
      '2026-06-24',
      '2026-06-26',
      '2026-07-01',
    ],
    rows: [
      ['Nguyễn Quang Minh', 2016, ['1', '-', '2', '-', '3', '-', '-', '-', '-', '-']],
      ['Nguyễn Khánh Ngọc', 2016, ['8', '1', '2', '-', '-', '-', '-', '-', '-', '-']],
      ['Nguyễn Long Sơn', 2020, ['8', '1', '2', '-', '-', '-', '-', '-', '-', '-']],
      ['Nguyễn Minh Khôi', 2022, ['-', '6', '-', '7', '-', '-', '-', '-', '-', '-']],
      ['Minh Anh', 2019, ['-', '-', '-', '3', '4', '-', '-', '-', '-', '-']],
      ['Lưu Mỹ Kim', 2020, ['-', '-', '-', 'T', '1', '-', '-', '-', '-', '-']],
      ['Trần Ngọc Tường Lam', 2017, ['-', '-', '-', 'T', '1', '-', '-', '-', '-', '-']],
      ['Trần Phúc Thịnh', 2020, ['-', '-', '-', 'T', '1', '-', '-', '-', '-', '-']],
      ['Nguyễn Đông Quân', 2019, ['-', '-', '-', 'T', '1', '-', '-', '-', '-', '-']],
      ['Nguyễn Minh Gia Khang', 2017, ['-', '-', '-', 'T', '-', '-', '-', '-', '-', '-']],
    ],
  },
  {
    classSessionId: 'class-session-aw-t7-cn-1500-1630',
    dates: [
      '2026-05-30',
      '2026-05-31',
      '2026-06-06',
      '2026-06-07',
      '2026-06-13',
      '2026-06-14',
      '2026-06-20',
      '2026-06-21',
      '2026-06-27',
      '2026-06-28',
    ],
    rows: [
      ['Đặng Hồ Thanh Lâm', 2014, ['2', '3', '-', '4', '5', '6', '-', '-', '-', '-']],
      ['Đặng Hồ Thanh Mai', 2017, ['1', '2', '-', '3', '-', '4', '-', '-', '-', '-']],
      ['Nguyễn Chu Hải Nam', 2016, ['6', '7', '-', '-', '-', '-', '-', '-', '-', '-']],
      ['Nguyễn Đình Quốc Huy', 2018, ['-', '-', '7', '8', '-', '-', '-', '-', '-', '-']],
      ['Vũ Minh Nghĩa', 2014, ['-', '-', '-', '-', 'T', '-', '-', '-', '-', '-']],
      ['Vũ Minh Hải', 2016, ['-', '-', '-', '-', 'T', '-', '-', '-', '-', '-']],
    ],
  },
  {
    classSessionId: 'class-session-aw-t7-cn-1030-1200',
    dates: [
      '2026-05-30',
      '2026-05-31',
      '2026-06-06',
      '2026-06-07',
      '2026-06-13',
      '2026-06-14',
      '2026-06-20',
      '2026-06-21',
      '2026-06-27',
      '2026-06-28',
    ],
    rows: [
      ['Hà Ngô Tường Minh', 2018, ['-', '4', '-', '-', '-', '-', '-', '-', '-', '-']],
      ['Phan Trần Minh Huy', 2016, ['5', '6', '7', '8', '1', '2', '-', '-', '-', '-']],
      ['Trần Hữu Minh', 2019, ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
      ['Nhữ Minh Khánh', 2014, ['4', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
      ['Nguyễn Quốc Duy', 2020, ['5', '6', '7', '8', '1', '2', '-', '-', '-', '-']],
      ['Đặng Minh Quân', 2017, ['-', '-', '1', '2', '-', '3', '-', '-', '-', '-']],
      ['Đặng Minh Tuấn', 2018, ['-', '-', '1', '2', '-', '3', '-', '-', '-', '-']],
    ],
  },
  {
    classSessionId: 'class-session-aw-t7-cn-1730-1900',
    dates: [
      '2026-05-30',
      '2026-05-31',
      '2026-06-06',
      '2026-06-07',
      '2026-06-13',
      '2026-06-14',
      '2026-06-20',
      '2026-06-21',
      '2026-06-27',
      '2026-06-28',
    ],
    rows: [
      ['Nguyễn Đình Minh Trí', 2017, ['4', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
      ['Nghiêm Phúc Minh', 2018, ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
      ['Đỗ Hải Yến', 2016, ['7', '8', '1', '2', '3', '4', '-', '-', '-', '-']],
      ['Đỗ Minh Tuyết', 2018, ['3+4', '5+6', '7+8', '1+2', '3', '4', '-', '-', '-', '-']],
      ['Lương Thị Lam', 2020, ['2', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
      ['Bảo Trâm', 2021, ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-']],
    ],
  },
]

export const angelWingsStudentsSource = angelWingsAttendanceSheets.flatMap((sheet) =>
  sheet.rows.map(([fullName, birthYear, cells]) => ({
    fullName,
    birthYear,
    cells,
    classSessionId: sheet.classSessionId,
  })),
)

export function buildAngelWingsRealDataset() {
  const students = angelWingsStudentsSource.map((student, index) => buildStudent(student, index))
  const studentsByKey = new Map(
    students.map((student) => [`${normalizeName(student.fullName)}:${student.birthYear}`, student]),
  )
  const teachers = buildAngelWingsTeacherRoster(students)
  const parentConsultations = students.map((student, index) => buildParentContact(student, index))
  const tuitionRecords = students.map((student) => buildTuitionRecord(student))
  const schedule = buildScheduleSessions(studentsByKey)
  const sessionReports = buildSessionReports(studentsByKey)

  return {
    students,
    teachers,
    parentConsultations,
    classSessions: angelWingsClassSessions,
    tuitionPackages: angelWingsPackageCatalog,
    tuitionRecords,
    schedule,
    sessionReports,
    attendanceAdvisoryNotes: [],
    summary: summarizeAngelWingsDataset({
      students,
      teachers,
      parentConsultations,
      classSessions: angelWingsClassSessions,
      tuitionPackages: angelWingsPackageCatalog,
      tuitionRecords,
      schedule,
      sessionReports,
    }),
  }
}

export function upsertAngelWingsAttendanceData() {
  return buildAngelWingsRealDataset()
}

export function buildAngelWingsTeacherRoster(students = []) {
  const mainTeacher = buildTeacher(students)
  const fallbackTeachers = [
    {
      id: 'teacher-nguyen-minh-khoi',
      fullName: 'Nguyễn Minh Khôi',
      displayName: 'Thầy Khôi',
      phone: '0901234567',
      email: 'khoi.teacher@example.com',
      status: 'active',
      teacherType: 'fulltime',
      teachingLevels: ['Dolphin 1', 'Dolphin 2'],
      levels: ['Dolphin 1', 'Dolphin 2'],
      note: 'Roster dự phòng để Module Giáo viên không bị rỗng sau import Angel Wings.',
    },
    {
      id: 'teacher-pham-ngoc-linh',
      fullName: 'Phạm Ngọc Linh',
      displayName: 'Cô Linh',
      phone: '0934567890',
      email: 'linh.teacher@example.com',
      status: 'active',
      teacherType: 'collaborator',
      teachingLevels: ['Dolphin 1'],
      levels: ['Dolphin 1'],
      note: 'Roster dự phòng có dấu cho dữ liệu vận hành test.',
    },
    {
      id: 'teacher-tran-hoang-anh',
      fullName: 'Trần Hoàng Anh',
      displayName: 'Cô Anh',
      phone: '0912345678',
      email: 'anh.teacher@example.com',
      status: 'active',
      teacherType: 'parttime',
      teachingLevels: ['Dolphin 2', 'Turtle 1'],
      levels: ['Dolphin 2', 'Turtle 1'],
      note: 'Roster dự phòng có dấu cho dữ liệu vận hành test.',
    },
    {
      id: 'teacher-vo-thanh-tung',
      fullName: 'Võ Thanh Tùng',
      displayName: 'Thầy Tùng',
      phone: '0956789012',
      email: 'tung.teacher@example.com',
      status: 'active',
      teacherType: 'fulltime',
      teachingLevels: ['Dolphin 1', 'Turtle 1'],
      levels: ['Dolphin 1', 'Turtle 1'],
      note: 'Roster dự phòng có dấu cho dữ liệu vận hành test.',
    },
    {
      id: 'teacher-le-quoc-bao',
      fullName: 'Lê Quốc Bảo',
      displayName: 'Thầy Bảo',
      phone: '0923456789',
      email: 'bao.teacher@example.com',
      status: 'paused',
      teacherType: 'collaborator',
      teachingLevels: ['Turtle 1'],
      levels: ['Turtle 1'],
      note: 'Giữ trong roster để tra cứu lịch sử giáo viên.',
    },
  ].map((teacher) =>
    withSource({
      ...teacher,
      assignedStudentIds: [],
      currentStudentCount: 0,
      availableClassSessionIds: [],
      createdAt: ANGEL_WINGS_CREATED_AT,
      updatedAt: ANGEL_WINGS_UPDATED_AT,
      isFallbackTeacherRoster: true,
      isControlledFixture: true,
    }),
  )

  return [mainTeacher, ...fallbackTeachers]
}

export function mergeAngelWingsTeacherRoster(existingTeachers = [], students = []) {
  const roster = buildAngelWingsTeacherRoster(students)
  const shouldBackfillRoster =
    existingTeachers.length <= 1 || !existingTeachers.some((teacher) => teacher.id !== ANGEL_WINGS_TEACHER_ID)
  const sourceTeachers = shouldBackfillRoster ? [...existingTeachers, ...roster] : [...existingTeachers, roster[0]]
  const mergedByKey = new Map()

  sourceTeachers.forEach((teacher) => {
    if (!teacher?.id && !teacher?.fullName) {
      return
    }

    const normalizedFullName = normalizeName(teacher.fullName)
    const key =
      teacher.id === ANGEL_WINGS_TEACHER_ID || normalizedFullName === normalizeName(ANGEL_WINGS_TEACHER_NAME)
        ? ANGEL_WINGS_TEACHER_ID
        : teacher.id || normalizedFullName
    const existing = mergedByKey.get(key) || {}
    const normalizedTeacher =
      key === ANGEL_WINGS_TEACHER_ID || teacher.id === ANGEL_WINGS_TEACHER_ID
        ? buildTeacher(students)
        : {
            ...existing,
            ...teacher,
            updatedAt: teacher.updatedAt || existing.updatedAt || ANGEL_WINGS_UPDATED_AT,
          }

    mergedByKey.set(key, normalizedTeacher)
  })

  return Array.from(mergedByKey.values())
}

export function removeAngelWingsAttendanceData() {
  return {
    students: [],
    teachers: [],
    parentConsultations: [],
    classSessions: [],
    tuitionRecords: [],
    schedule: [],
    sessionReports: [],
    attendanceAdvisoryNotes: [],
    tuitionPackages: [],
    removedSourceTag: ANGEL_WINGS_SOURCE_TAG,
  }
}

export function removeLegacyDemoAttendanceReports(sessionReports = []) {
  return sessionReports.filter(
    (report) =>
      !(
        report?.isDemoAttendance ||
        report?.sourceModule === 'bang-diem-danh-demo' ||
        report?.demoBatchId === 'attendance-board-demo-foundation'
      ),
  )
}

export function parseAngelWingsAttendanceCell(value) {
  const displayValue = String(value || '').trim()

  if (!displayValue || displayValue === '-') {
    return null
  }

  if (displayValue.toUpperCase() === 'T') {
    return {
      attendanceStatus: 'trial',
      status: 'trial',
      displayValue: 'T',
      credits: [
        {
          displayValue: 'T',
          sessionNumber: null,
          creditType: 'trial',
        },
      ],
      countsTowardTuition: false,
    }
  }

  const creditNumbers = displayValue
    .split('+')
    .map((part) => Number(part.trim()))
    .filter((credit) => Number.isInteger(credit) && credit > 0)

  if (!creditNumbers.length) {
    return null
  }

  return {
    attendanceStatus: 'present',
    status: 'present',
    displayValue,
    credits: creditNumbers.map((credit) => ({
      displayValue: String(credit),
      sessionNumber: credit,
    })),
    countsTowardTuition: true,
    isCombinedCredit: creditNumbers.length > 1,
    needsMakeupReview: creditNumbers.length > 1,
  }
}

export function summarizeAngelWingsDataset(dataset) {
  const attendanceItems = dataset.sessionReports.flatMap((report) => report.attendance || [])
  const attendanceCells = attendanceItems.length
  const attendanceCredits = attendanceItems.reduce(
    (total, item) => total + (Array.isArray(item.credits) && item.credits.length ? item.credits.length : 0),
    0,
  )
  const demoReportsInRealMode = dataset.sessionReports.filter(
    (report) =>
      report.isDemoAttendance ||
      report.sourceModule === 'bang-diem-danh-demo' ||
      report.demoBatchId === 'attendance-board-demo-foundation',
  ).length

  return {
    students: dataset.students.length,
    teachers: dataset.teachers.filter((teacher) => teacher.id === ANGEL_WINGS_TEACHER_ID).length,
    parentConsultations: dataset.parentConsultations.length,
    classSessions: dataset.classSessions.length,
    tuitionPackages: dataset.tuitionPackages.length,
    tuitionRecords: dataset.tuitionRecords.length,
    schedule: dataset.schedule.length,
    sessionReports: dataset.sessionReports.length,
    attendanceCells,
    attendanceCredits,
    demoReportsInRealMode,
  }
}

export function createF15K5BackupSnapshot(storage = globalThis.localStorage) {
  if (!storage) {
    return null
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupKey = `ichessCenterOS.backup.beforeF15K5AngelWings.${timestamp}`
  const keys = getF15K5StorageKeys()
  const snapshot = keys.reduce((backup, key) => {
    backup[key] = storage.getItem(key)
    return backup
  }, {})

  storage.setItem(
    backupKey,
    JSON.stringify({
      createdAt: new Date().toISOString(),
      datasetId: ANGEL_WINGS_DATASET_ID,
      datasetVersion: ANGEL_WINGS_DATASET_VERSION,
      keys,
      values: snapshot,
    }),
  )

  return { backupKey, keys }
}

export function writeAngelWingsPackageCatalog(storage = globalThis.localStorage, packages = angelWingsPackageCatalog) {
  if (!storage) {
    return
  }

  storage.setItem(ANGEL_WINGS_PACKAGE_CATALOG_KEY, JSON.stringify(packages))
}

export function getF15K5StorageKeys() {
  return [
    'ichessCenterOS.students.dreamhome',
    'ichessCenterOS.teachers.dreamhome',
    'ichessCenterOS.parentConsultations.dreamhome',
    'ichessCenterOS.classSessions.dreamhome',
    ANGEL_WINGS_PACKAGE_CATALOG_KEY,
    'ichessCenterOS.tuition.dreamhome',
    'ichessCenterOS.schedule.dreamhome',
    'ichessCenterOS.sessionReports.dreamhome',
    'ichessCenterOS.attendanceAdvisoryNotes.dreamhome',
  ]
}

function buildStudent(source, index) {
  const id = createStudentId(source.fullName)

  return withSource({
    id,
    studentCode: `AW-${String(index + 1).padStart(3, '0')}`,
    fullName: source.fullName,
    birthYear: String(source.birthYear),
    birthDate: `${source.birthYear}-01-01`,
    schoolName: 'Trường học cập nhật sau',
    hometown: 'TP. Hồ Chí Minh',
    hobbies: 'Cờ vua',
    nationality: 'Việt Nam',
    parentName: `Phụ huynh ${source.fullName}`,
    parentPhone: createFixturePhone(index),
    parentArea: 'Cơ sở Angel Wings',
    level: 'Dolphin 1',
    classSessionIds: [source.classSessionId],
    assignedTeacherId: ANGEL_WINGS_TEACHER_ID,
    mainTeacherName: ANGEL_WINGS_TEACHER_NAME,
    currentStatus: 'Đang theo học',
    latestCareNote: 'Dữ liệu chuẩn Angel Wings 06/2026.',
    careNotes: [],
    createdAt: ANGEL_WINGS_CREATED_AT,
    updatedAt: ANGEL_WINGS_UPDATED_AT,
    isControlledFixture: true,
  })
}

function buildTeacher(students) {
  return withSource({
    id: ANGEL_WINGS_TEACHER_ID,
    fullName: ANGEL_WINGS_TEACHER_NAME,
    displayName: 'Thầy Thắng',
    phone: '0900000606',
    email: 'thang.angelwings@example.com',
    status: 'active',
    teacherType: 'fulltime',
    levels: ['Dolphin 1', 'Dolphin 2', 'Turtle 1'],
    teachingLevels: ['Dolphin 1', 'Dolphin 2', 'Turtle 1'],
    availableClassSessionIds: angelWingsClassSessions.map((item) => item.id),
    assignedStudentIds: students.map((student) => student.id),
    currentStudentCount: students.length,
    scheduleNote: 'Giáo viên chính bộ dữ liệu Angel Wings 06/2026.',
    note: 'Dữ liệu chuẩn Angel Wings 06/2026.',
    createdAt: ANGEL_WINGS_CREATED_AT,
    updatedAt: ANGEL_WINGS_UPDATED_AT,
    isControlledFixture: true,
  })
}

function buildParentContact(student, index) {
  const contactedAt = '2026-06-15T09:00:00.000Z'

  return withSource({
    id: `parent-aw-${student.id.replace(/^student-aw-/, '')}`,
    contactType: 'currentParent',
    parentName: `Phụ huynh ${student.fullName}`,
    phone: createFixturePhone(index),
    secondaryPhone: '',
    email: `phuhuynh.${student.studentCode.toLowerCase()}@example.com`,
    studentName: student.fullName,
    studentId: student.id,
    leadStudentName: '',
    studentBirthYear: student.birthYear,
    leadStudentAge: '',
    leadNeed: 'Theo dõi lịch học và điểm danh Angel Wings 06/2026.',
    parentFeedbackAboutChild: 'Cần cập nhật sau buổi học.',
    consultationStatus: 'activeCare',
    source: 'walkIn',
    interestedProgram: 'Cờ vua thiếu nhi',
    preferredSchedule: getClassSessionLabelById(student.classSessionIds[0]),
    locationArea: 'Cơ sở Angel Wings',
    consultedAt: '2026-06-15',
    registeredAt: '2026-06-15',
    lastContactAt: contactedAt,
    lastNote: 'Liên hệ fixture có kiểm soát cho bộ Angel Wings 06/2026.',
    careLogs: [
      {
        id: `care-log-aw-${student.id}`,
        contactedAt,
        channel: 'note',
        content: 'Tạo liên kết phụ huynh cho dataset Angel Wings 06/2026.',
        result: 'Đã liên kết với học viên.',
        nextAction: '',
        createdAt: contactedAt,
      },
    ],
    appointments: [],
    createdAt: ANGEL_WINGS_CREATED_AT,
    updatedAt: ANGEL_WINGS_UPDATED_AT,
    isControlledFixture: true,
  })
}

function buildTuitionRecord(student) {
  const source = angelWingsStudentsSource.find((item) => createStudentId(item.fullName) === student.id)
  const paidCycleCount = getRequiredPaidCycleCount(source?.cells || [], 8)

  return withSource({
    id: `tuition-aw-${student.id.replace(/^student-aw-/, '')}`,
    studentId: student.id,
    packageId: 'package-8-sessions',
    packageName: 'Gói 8 buổi',
    totalSessions: 8,
    usedSessions: 0,
    totalAmount: 1000000,
    paidAmount: 1000000 * paidCycleCount,
    discountAmount: 0,
    currentTermNumber: paidCycleCount,
    currentTermId: `term-aw-${student.id}-${paidCycleCount}`,
    dueDate: '2026-06-30',
    startedAt: '2026-05-29T00:00:00.000Z',
    termHistory: Array.from({ length: paidCycleCount }, (_, index) =>
      withSource({
        id: `term-aw-${student.id}-${index + 1}`,
        termNumber: index + 1,
        packageId: 'package-8-sessions',
        packageName: 'Gói 8 buổi',
        totalSessions: 8,
        usedSessions: 0,
        totalAmount: 1000000,
        paidAmount: 1000000,
        paymentStatus: 'paid',
      }),
    ),
    note: 'Học phí fixture có kiểm soát cho Angel Wings 06/2026, không tạo Thu chi/Sổ quỹ.',
    isImportedTuitionFixture: true,
    skipCashflowSync: true,
    createdAt: ANGEL_WINGS_CREATED_AT,
    updatedAt: ANGEL_WINGS_UPDATED_AT,
    isControlledFixture: true,
  })
}

function buildScheduleSessions(studentsByKey) {
  return angelWingsAttendanceSheets.flatMap((sheet) => {
    const classSession = angelWingsClassSessions.find((item) => item.id === sheet.classSessionId)
    const studentIds = sheet.rows
      .map(([fullName, birthYear]) => studentsByKey.get(`${normalizeName(fullName)}:${birthYear}`)?.id)
      .filter(Boolean)

    return sheet.dates.map((date) =>
      withSource({
        id: `schedule-aw-${sheet.classSessionId}-${date}`,
        scheduleType: 'oneOff',
        title: `Angel Wings ${classSession.displayLabel}`,
        classSessionId: sheet.classSessionId,
        teacherId: ANGEL_WINGS_TEACHER_ID,
        teacherName: ANGEL_WINGS_TEACHER_NAME,
        studentIds,
        date,
        startDate: date,
        endDate: date,
        dayOfWeek: getScheduleDayOfWeek(date),
        startTime: classSession.startTime,
        endTime: classSession.endTime,
        room: 'Cơ sở Angel Wings',
        groupName: classSession.displayLabel,
        level: 'mixed',
        status: 'done',
        note: 'Lịch học chuẩn từ bảng Angel Wings 06/2026.',
        createdAt: ANGEL_WINGS_CREATED_AT,
        updatedAt: ANGEL_WINGS_UPDATED_AT,
        isControlledFixture: true,
      }),
    )
  })
}

function buildSessionReports(studentsByKey) {
  const reports = []

  angelWingsAttendanceSheets.forEach((sheet) => {
    sheet.dates.forEach((date, dateIndex) => {
      const attendance = sheet.rows
        .map(([fullName, birthYear, cells]) => {
          const parsed = parseAngelWingsAttendanceCell(cells[dateIndex])
          const student = studentsByKey.get(`${normalizeName(fullName)}:${birthYear}`)

          if (!parsed || !student) {
            return null
          }

          return withSource({
            studentId: student.id,
            studentName: fullName,
            classSessionId: sheet.classSessionId,
            teacherId: ANGEL_WINGS_TEACHER_ID,
            occurrenceDate: date,
            attendanceStatus: parsed.attendanceStatus,
            status: parsed.status,
            displayValue: parsed.displayValue,
            credits: parsed.credits,
            countsTowardTuition: parsed.countsTowardTuition,
            note: parsed.attendanceStatus === 'trial' ? 'Học thử từ bảng Angel Wings 06/2026.' : '',
            isImportedAttendance: true,
            isCombinedCredit: Boolean(parsed.isCombinedCredit),
            needsMakeupReview: Boolean(parsed.needsMakeupReview),
          })
        })
        .filter(Boolean)

      if (!attendance.length) {
        return
      }

      const classSession = angelWingsClassSessions.find((item) => item.id === sheet.classSessionId)

      reports.push(
        withSource({
          id: `session-report-aw-${sheet.classSessionId}-${date}`,
          sessionId: `schedule-aw-${sheet.classSessionId}-${date}`,
          classSessionId: sheet.classSessionId,
          occurrenceDate: date,
          teacherId: ANGEL_WINGS_TEACHER_ID,
          teacherName: ANGEL_WINGS_TEACHER_NAME,
          isImportedAttendance: true,
          attendance,
          learningGroups: [],
          guestParticipants: [],
          teachingAssistantNotes: `Nguồn Angel Wings 06/2026 · ${classSession.displayLabel}`,
          classSituation: '',
          suggestions: '',
          createdAt: ANGEL_WINGS_CREATED_AT,
          updatedAt: ANGEL_WINGS_UPDATED_AT,
          isControlledFixture: true,
        }),
      )
    })
  })

  return reports
}

function getRequiredPaidCycleCount(cells, packageTotalSessions) {
  let highestCycle = 1
  let cycleOffset = 0
  let lastCredit = null

  ;(cells || []).forEach((cell) => {
    const parsed = parseAngelWingsAttendanceCell(cell)

    if (!parsed?.countsTowardTuition) {
      return
    }

    parsed.credits.forEach((credit) => {
      const sessionNumber = Number(credit.sessionNumber)

      if (lastCredit !== null && sessionNumber <= lastCredit) {
        cycleOffset += packageTotalSessions
      }

      highestCycle = Math.max(highestCycle, Math.floor((cycleOffset + sessionNumber - 1) / packageTotalSessions) + 1)
      lastCredit = sessionNumber
    })
  })

  return highestCycle
}

function withSource(value) {
  return {
    ...value,
    sourceModule: ANGEL_WINGS_SOURCE_MODULE,
    sourceTag: ANGEL_WINGS_SOURCE_TAG,
    importBatchId: ANGEL_WINGS_IMPORT_BATCH_ID,
    datasetId: ANGEL_WINGS_DATASET_ID,
    datasetVersion: ANGEL_WINGS_DATASET_VERSION,
  }
}

function createStudentId(fullName) {
  return `student-aw-${slugify(fullName)}`
}

function createFixturePhone(index) {
  return `0906${String(index + 1).padStart(6, '0')}`
}

function getClassSessionLabelById(classSessionId) {
  return angelWingsClassSessions.find((item) => item.id === classSessionId)?.displayLabel || ''
}

function getScheduleDayOfWeek(dateValue) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[new Date(`${dateValue}T00:00:00`).getDay()]
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
}

function slugify(value) {
  return normalizeName(value).replace(/\s+/g, '-')
}
