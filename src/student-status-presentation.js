import { studentStatuses } from './student-data.js'

// Read-only labels. The first existing Student status is also the edit form's
// established fallback. Do not install this presentation value into raw records
// or use it to replace enrollment, Attendance, Tuition or Notification authority.
export function getStudentStatusPresentation(student = {}) {
  for (const value of [student?.currentStatus, student?.status]) {
    const label = studentStatuses.find(status => status === String(value ?? '').trim())
    if (label) return label
  }
  return studentStatuses[0]
}
