export function createSampleNotifications() {
  const now = Date.now()

  return [
    {
      id: 'notif-001',
      type: 'system',
      level: 'info',
      title: 'Notification Center đã sẵn sàng',
      message: 'Chuông thông báo sẽ dùng để nhận cảnh báo quan trọng từ các module sau này.',
      sourceModule: 'system',
      createdAt: new Date(now - 8 * 60 * 1000).toISOString(),
      read: false,
    },
    {
      id: 'notif-002',
      type: 'tuition',
      level: 'warning',
      title: 'Mẫu cảnh báo học phí',
      message: 'Sau này Module Học phí sẽ báo học viên còn 2, 1, 0 hoặc âm buổi tại đây.',
      sourceModule: 'hoc-phi',
      createdAt: new Date(now - 32 * 60 * 1000).toISOString(),
      read: false,
    },
    {
      id: 'notif-003',
      type: 'student',
      level: 'info',
      title: 'Mẫu ghi chú học viên',
      message:
        'Sau này ghi chú quan trọng có thể xuất hiện tại đây sau khi được chốt nghiệp vụ.',
      sourceModule: 'hoc-vien',
      createdAt: new Date(now - 76 * 60 * 1000).toISOString(),
      read: false,
    },
    {
      id: 'notif-004',
      type: 'system',
      level: 'success',
      title: 'Đã lưu trạng thái thông báo',
      message: 'Thông báo đã đọc sẽ được lưu lại trên trình duyệt bằng localStorage.',
      sourceModule: 'system',
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      read: true,
    },
  ]
}
