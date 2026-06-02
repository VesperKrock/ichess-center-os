const baseUrl = import.meta.env?.BASE_URL ?? '/'
const defaultAvatarUrl = `${baseUrl}images/avatar.jpg`

export function renderStudentDetail(student) {
  if (!student) {
    return `
      <section class="student-detail">
        <p class="student-detail-empty">Không tìm thấy hồ sơ học viên.</p>
      </section>
    `
  }

  return `
    <section class="student-detail" aria-label="Chi tiết hồ sơ học viên">
      <div class="student-detail-hero">
        ${renderStudentAvatar(student)}
        <div>
          <h3>${student.fullName}</h3>
          <p>${student.currentStatus} · ${student.level}</p>
        </div>
        <button
          class="student-detail-edit"
          type="button"
          data-student-action="edit-from-detail"
          data-student-edit-id="${student.id}"
        >
          Sửa hồ sơ
        </button>
      </div>

      <div class="student-detail-grid">
        ${renderSection('A. Thông tin học viên', [
          ['Họ và tên', student.fullName],
          ['Ngày sinh', formatBirthDate(student.birthDate)],
          ['Tuổi', `${getAge(student.birthDate)} tuổi`],
          ['Trường học', student.schoolName],
          ['Quê quán', student.hometown],
          ['Sở thích', student.hobbies],
          ['Quốc tịch', student.nationality],
        ])}
        ${renderSection('B. Thông tin phụ huynh', [
          ['Họ và tên phụ huynh', student.parentName],
          ['Năm sinh / tuổi', formatParentAge(student.parentBirthYear)],
          ['Số điện thoại', formatPhoneNumber(student.parentPhone)],
          ['Nghề nghiệp', student.parentJob],
          ['Khu vực sinh sống', student.parentArea],
        ])}
        ${renderSection('C. Trạng thái học', [
          ['Cấp độ', student.level],
          ['Điểm bài thi', student.testScore || 'Chưa có'],
          ['Mốc bot đã vượt qua', student.highestBotMilestone],
          ['Tính cách học viên', student.personality],
          ['Chuyên cần', 'Tự động cập nhật sau'],
          ['Ca học chính', 'Tự động cập nhật sau'],
        ])}
        ${renderSection('D. Chăm sóc / ghi chú', [
          ['Trạng thái hiện tại', student.currentStatus],
          ['Số khóa tái đăng ký', 'Tự động cập nhật sau'],
          ['Tình trạng thu phí', 'Tự động cập nhật sau'],
          ['Thành tích học viên đạt được', student.achievements],
          ['Trao đổi / lưu ý từ phụ huynh', student.parentNotes],
          ['Ghi chú gần nhất', student.latestCareNote],
        ])}
      </div>

      <section class="student-detail-future">
        <h4>E. Kết quả học tập</h4>
        <p>
          Kết quả học tập sẽ được bổ sung ở giai đoạn Giáo viên/Báo cáo phụ huynh.
        </p>
        <ul>
          <li>Cấp độ học hiện tại</li>
          <li>Điểm số bài kiểm tra</li>
          <li>Mốc bot đã vượt qua</li>
          <li>Nhận xét của giáo viên</li>
          <li>Kế hoạch học tập tiếp theo</li>
        </ul>
      </section>
    </section>
  `
}

export function getStudentDetailWindowTitle(student) {
  return student ? `Hồ sơ học viên - ${student.fullName}` : 'Hồ sơ học viên'
}

function renderSection(title, rows) {
  return `
    <section class="student-detail-section">
      <h4>${title}</h4>
      <dl>
        ${rows
          .map(
            ([label, value]) => `
              <div>
                <dt>${label}</dt>
                <dd>${value || 'Chưa có'}</dd>
              </div>
            `,
          )
          .join('')}
      </dl>
    </section>
  `
}

function renderStudentAvatar(student) {
  const initial = student.fullName.trim().charAt(0).toUpperCase()
  const avatarUrl = student.avatarUrl || defaultAvatarUrl

  return `
    <span class="student-detail-avatar" aria-label="Ảnh đại diện ${student.fullName}">
      <img src="${avatarUrl}" alt="" onerror="this.style.display='none'" />
      <span>${initial}</span>
    </span>
  `
}

function formatBirthDate(value) {
  const birthDate = new Date(value)
  const day = String(birthDate.getDate()).padStart(2, '0')
  const month = String(birthDate.getMonth() + 1).padStart(2, '0')
  const year = birthDate.getFullYear()
  return `${day}/${month}/${year}`
}

function getAge(value) {
  const birthDate = new Date(value)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDelta = today.getMonth() - birthDate.getMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age
}

function formatParentAge(parentBirthYear) {
  if (!parentBirthYear) {
    return 'Chưa có'
  }

  const age = new Date().getFullYear() - Number(parentBirthYear)
  return `${parentBirthYear} · ${age} tuổi`
}

function formatPhoneNumber(value) {
  const digits = String(value).replace(/\D/g, '')

  if (digits.length !== 10) {
    return value
  }

  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}
