const sampleTuitionTemplates = [
  {
    packageName: 'Gói 8 buổi',
    totalSessions: 8,
    usedSessions: 6,
    totalAmount: 1200000,
    discountAmount: 0,
    paidAmount: 1200000,
    dueDate: '2026-06-15',
    note: 'Còn 2 buổi, nên nhắc phụ huynh chuẩn bị tái đăng ký.',
  },
  {
    packageName: 'Gói 16 buổi',
    totalSessions: 16,
    usedSessions: 15,
    totalAmount: 2200000,
    discountAmount: 200000,
    paidAmount: 1600000,
    dueDate: '2026-06-08',
    note: 'Còn 1 buổi và còn nợ một phần học phí.',
  },
  {
    packageName: 'Gói 32 buổi',
    totalSessions: 32,
    usedSessions: 32,
    totalAmount: 4000000,
    discountAmount: 0,
    paidAmount: 4000000,
    dueDate: '2026-06-03',
    note: 'Đã hết số buổi trong gói.',
  },
  {
    packageName: 'Gói linh hoạt 12 buổi',
    totalSessions: 12,
    usedSessions: 14,
    totalAmount: 1800000,
    discountAmount: 0,
    paidAmount: 1400000,
    dueDate: '2026-05-30',
    note: 'Đã học vượt số buổi đăng ký, cần xử lý ngay.',
  },
  {
    packageName: 'Gói 8 buổi',
    totalSessions: 8,
    usedSessions: 3,
    totalAmount: 1200000,
    discountAmount: 100000,
    paidAmount: 800000,
    dueDate: '2026-06-22',
    note: 'Đang học bình thường, còn nợ học phí.',
  },
]

export function createSampleTuitionRecords(students) {
  return students.slice(0, sampleTuitionTemplates.length).map((student, index) => ({
    id: `tuition-sample-${String(index + 1).padStart(3, '0')}`,
    studentId: student.id,
    ...sampleTuitionTemplates[index],
  }))
}
