const VIEW_MODE_KEY = 'ichess-center-os:view-mode'
const DESKTOP_ORDER_KEY = 'ichess-center-os:desktop-module-order'
const STUDENTS_KEY = 'ichessCenterOS.students.dreamhome'
const VALID_VIEW_MODES = ['grid', 'list']
const LEGACY_SAMPLE_TEACHER_NAMES = ['Thầy Thắng', 'Cô Vân', 'Thầy Hải']
const UNASSIGNED_TEACHER_NAME = 'Chưa phân công'

export function getViewMode() {
  const savedMode = localStorage.getItem(VIEW_MODE_KEY)
  return VALID_VIEW_MODES.includes(savedMode) ? savedMode : 'grid'
}

export function saveViewMode(mode) {
  if (VALID_VIEW_MODES.includes(mode)) {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }
}

export function getDesktopModuleOrder(validModuleIds) {
  try {
    const savedOrder = JSON.parse(localStorage.getItem(DESKTOP_ORDER_KEY))

    if (!Array.isArray(savedOrder)) {
      return validModuleIds
    }

    const knownSavedIds = savedOrder.filter((id) => validModuleIds.includes(id))
    const newIds = validModuleIds.filter((id) => !knownSavedIds.includes(id))
    return [...knownSavedIds, ...newIds]
  } catch {
    return validModuleIds
  }
}

export function saveDesktopModuleOrder(moduleIds) {
  localStorage.setItem(DESKTOP_ORDER_KEY, JSON.stringify(moduleIds))
}

export function getStoredStudents(defaultStudents) {
  try {
    const storedStudents = JSON.parse(localStorage.getItem(STUDENTS_KEY))

    if (Array.isArray(storedStudents)) {
      const migratedStudents = normalizeStudents(storedStudents)
      saveStoredStudents(migratedStudents)
      return migratedStudents
    }
  } catch {
    localStorage.removeItem(STUDENTS_KEY)
  }

  const migratedDefaultStudents = normalizeStudents(defaultStudents)
  saveStoredStudents(migratedDefaultStudents)
  return migratedDefaultStudents
}

export function saveStoredStudents(students) {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(normalizeStudents(students)))
}

function normalizeStudents(students) {
  return students.map((student) => {
    const mainTeacherName = normalizeStudentTeacherName(student.mainTeacherName)

    if (Array.isArray(student.careNotes)) {
      return {
        ...student,
        mainTeacherName,
      }
    }

    const legacyNote = String(student.latestCareNote ?? '').trim()
    const hasRealLegacyNote =
      legacyNote &&
      legacyNote !== 'Chưa có ghi chú chăm sóc.' &&
      !legacyNote.toLowerCase().includes('chưa có ghi chú')

    return {
      ...student,
      mainTeacherName,
      careNotes: hasRealLegacyNote
        ? [
            {
              id: `note_legacy_${student.id}`,
              createdAt: student.updatedAt
                ? new Date(student.updatedAt).toISOString()
                : new Date().toISOString(),
              author: 'Admin DreamHome',
              content: legacyNote,
              tags: [],
            },
          ]
        : [],
    }
  })
}

function normalizeStudentTeacherName(mainTeacherName) {
  return LEGACY_SAMPLE_TEACHER_NAMES.includes(mainTeacherName)
    ? UNASSIGNED_TEACHER_NAME
    : mainTeacherName
}
