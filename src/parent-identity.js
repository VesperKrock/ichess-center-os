const text = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
export const normalizeParentFullName = value => text(value).toLocaleLowerCase('vi-VN')

export function canonicalParentPhone(value) {
  const raw = text(value)
  if (!raw || /[^+\d\s().-]/.test(raw)) return ''
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0084')) digits = digits.slice(2)
  if (/^0\d{9,10}$/.test(digits)) return `+84${digits.slice(1)}`
  if (/^84\d{9,10}$/.test(digits)) return `+${digits}`
  return /^\+\d{8,15}$/.test(raw.replace(/[\s().-]/g, '')) ? `+${digits}` : ''
}

export function classifyParentIdentityMatch(first = {}, second = {}) {
  if (text(first.centerId) !== text(second.centerId)) return 'DIFFERENT_CENTER'
  const name = normalizeParentFullName(first.name), otherName = normalizeParentFullName(second.name)
  const phone = canonicalParentPhone(first.phone), otherPhone = canonicalParentPhone(second.phone)
  if (name && phone && name === otherName && phone === otherPhone) {
    if (first.birthYear && second.birthYear && String(first.birthYear) !== String(second.birthYear)) return 'QUESTION_CONFLICT'
    return 'EXACT'
  }
  return name && name === otherName || phone && phone === otherPhone ? 'QUESTION' : 'NO_MATCH'
}

export function aggregateStudentParentIdentities(students = [], options = {}) {
  const { centerId = '' } = options
  const groups = []
  for (const student of students.filter(s => s && !s.isDeleted)) {
    const scope = text(student.centerId || student.center_id || centerId)
    const routes = text(student.fatherName) || text(student.motherName)
      ? [['FATHER', student.fatherName, student.fatherPhone, student.fatherBirthYear], ['MOTHER', student.motherName, student.motherPhone, student.motherBirthYear]]
        .filter(([, name, phone]) => text(name) || text(phone))
      : [['UNSPECIFIED', student.parentName || student.guardianName || student.caregiverName,
        student.parentPhone || student.motherPhone || student.fatherPhone || student.guardianPhone || student.caregiverPhone || student.phone, student.parentBirthYear]]
    for (const [guardianRole, rawName, rawPhone, birthYear] of routes) {
      const name = text(rawName), phone = text(rawPhone)
      if (!name && !phone) continue
      const occurrence = { centerId: scope, name, phone, birthYear: birthYear || null, guardianRole, studentId: student.id, student,
        isPrimaryContact: null, financialContactRole: null, academicContactRole: null }
      if (optionsOccurrenceLinked(options, occurrence)) continue
      const group = groups.find(g => classifyParentIdentityMatch(g, occurrence) === 'EXACT')
      if (group) {
        group.occurrences.push(occurrence)
        if (!group.birthYear && occurrence.birthYear) group.birthYear = occurrence.birthYear
      } else groups.push({ centerId: scope, name, phone, birthYear: occurrence.birthYear, occurrences: [occurrence] })
    }
  }
  return groups.map(group => {
    const occurrences = group.occurrences.sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)) || a.guardianRole.localeCompare(b.guardianRole))
    const first = occurrences[0]
    const relatedStudents = [...new Map(occurrences.map(o => [o.studentId, o.student])).values()]
    return { ...group, occurrences, relatedStudents,
      id: `student-parent-${encodeURIComponent(group.centerId)}-${encodeURIComponent(first.studentId)}-${first.guardianRole.toLowerCase()}`,
      identityStatus: !normalizeParentFullName(group.name) || !canonicalParentPhone(group.phone)
        || groups.some(other => other !== group && classifyParentIdentityMatch(group, other).startsWith('QUESTION')) ? 'QUESTION' : 'EXACT_SOURCE_IDENTITY' }
  })
}

function optionsOccurrenceLinked(options, occurrence) {
  return typeof options.isOccurrenceLinked === 'function' && options.isOccurrenceLinked(occurrence)
}
