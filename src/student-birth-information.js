import { formatOperatorDate, parseCanonicalDateParts } from './operator-date-format.js'

// Canonical Student payload: full birthDate OR a four-digit birthYear with
// an empty birthDate. Existing full dates need no precision marker/backfill.
export function getStudentBirthInformation(student = {}) {
  const date = parseCanonicalDateParts(student.birthDate)
  if (date) return { kind: 'full', birthDate: date.canonical, birthYear: String(date.year), date }
  const year = String(student.birthYear ?? '').trim()
  if (!String(student.birthDate ?? '').trim() && /^\d{4}$/.test(year)) {
    return { kind: 'year', birthDate: '', birthYear: year, date: null }
  }
  return { kind: 'unknown', birthDate: '', birthYear: '', date: null }
}

export function formatStudentBirthInformation(student, fallback = '—') {
  const info = getStudentBirthInformation(student)
  return info.kind === 'full' ? formatOperatorDate(info.birthDate)
    : info.kind === 'year' ? info.birthYear : fallback
}

export function getStudentAge(birthDate, now = new Date()) {
  const date = parseCanonicalDateParts(birthDate)
  if (!date) return null
  let age = now.getFullYear() - date.year
  if (now.getMonth() + 1 < date.month
    || (now.getMonth() + 1 === date.month && now.getDate() < date.day)) age -= 1
  return age
}

export function setStudentBirthYearOnly(values, yearOnly) {
  return { ...values, birthYearOnly: yearOnly === true,
    birthYear: values.birthYear || (yearOnly ? getStudentBirthInformation(values).birthYear : '') }
}

export function buildStudentBirthFields(values) {
  return values.birthYearOnly === true
    ? { birthDate: '', birthYear: String(values.birthYear ?? '').trim() }
    : { birthDate: values.birthDate ?? '', birthYear: '' }
}

export function validateStudentBirthFields(values, now = new Date()) {
  if (values.birthYearOnly === true) {
    const year = String(values.birthYear ?? '').trim()
    return /^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= now.getFullYear()
      ? {} : { birthYear: `Nhập năm sinh gồm 4 chữ số từ 1900 đến ${now.getFullYear()}.` }
  }
  if (!String(values.birthDate ?? '').trim()) return {}
  const date = parseCanonicalDateParts(values.birthDate)
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return date && date.canonical <= today ? {} : { birthDate: 'Nhập ngày sinh đầy đủ, hợp lệ và không ở tương lai.' }
}

export function getBirthdayLocalDateKey(value = new Date()) {
  if (typeof value === 'string' && parseCanonicalDateParts(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date) : ''
}
