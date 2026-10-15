// A Ca display label is never a teacher identity or an occurrence attribution.
export function validateTeacherDisplayName(value) {
  if (value == null) return ''
  if (typeof value !== 'string' || value.length > 160 || /[\u0000-\u001f\u007f<>]/.test(value)) return 'Tên giáo viên cần là chữ trên một dòng, tối đa 160 ký tự.'
  return ''
}
export function normalizeTeacherDisplayName(value) {
  return validateTeacherDisplayName(value) ? '' : String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
}
