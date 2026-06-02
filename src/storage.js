const VIEW_MODE_KEY = 'ichess-center-os:view-mode'
const DESKTOP_ORDER_KEY = 'ichess-center-os:desktop-module-order'
const STUDENTS_KEY = 'ichessCenterOS.students.dreamhome'
const VALID_VIEW_MODES = ['grid', 'list']

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
    if (Array.isArray(student.careNotes)) {
      return student
    }

    const legacyNote = String(student.latestCareNote ?? '').trim()
    const hasRealLegacyNote =
      legacyNote &&
      legacyNote !== 'Chưa có ghi chú chăm sóc.' &&
      !legacyNote.toLowerCase().includes('chưa có ghi chú')

    return {
      ...student,
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
