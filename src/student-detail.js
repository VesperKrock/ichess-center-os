import { buildStudentTuitionLink } from './student-tuition-links.js'

const baseUrl = import.meta.env?.BASE_URL ?? '/'
const defaultAvatarUrl = `${baseUrl}images/avatar.jpg`

export const careNoteSuggestions = [
  'Phụ huynh cần được nhắc học phí',
  'Phụ huynh muốn đổi lịch học',
  'Học viên nghỉ nhiều buổi',
  'Học viên tiến bộ tốt',
  'Cần theo sát thái độ học',
  'Cần gửi bài luyện thêm',
  'Cần gọi lại phụ huynh',
  'Đã trao đổi với phụ huynh',
  'Cần xếp lịch học bù',
  'Phụ huynh phản hồi tích cực',
]

export const emptyCareNoteDraft = {
  content: '',
  tag: '',
  error: '',
  editingNoteId: '',
}

export function renderStudentDetail(student, teachers = [], classSessions = [], tuitionRecords = []) {
  if (!student) {
    return renderStudentNotFound()
  }

  const careNotes = getSortedCareNotes(student)
  const latestCareNote = careNotes[0]
  const assignedTeacherLabel = getAssignedTeacherLabel(student, teachers)
  const classSessionLabel = getStudentClassSessionLabel(student, classSessions)
  const primaryParentPhone = student.motherPhone || student.fatherPhone || student.parentPhone
  const studentTuitionLink = buildStudentTuitionLink(student, tuitionRecords, classSessions)

  return `
    <section class="student-detail student-detail-overview" aria-label="Hồ sơ tổng quan học viên">
      <div class="student-detail-hero">
        <div class="student-avatar-stack">
          ${renderStudentAvatar(student)}
          <button
            class="student-avatar-clear"
            type="button"
            data-student-detail-action="clear-avatar"
            data-student-id="${student.id}"
            ${student.avatarUrl ? '' : 'disabled'}
          >
            Xóa avatar
          </button>
        </div>
        <div class="student-detail-hero-main">
          <h3>${student.fullName}</h3>
          <p>${displayValue(student.currentStatus)} · ${getEscapedLevelLabel(student.level)} · Mốc bot: ${displayValue(student.highestBotMilestone)}</p>
          <p>${formatBirthDate(student.birthDate)} · ${formatAgeLabel(student.birthDate)} · ${getGenderLabel(student.gender)}</p>
          <p>Trường: ${getSchoolLabel(student)} · PH: ${displayValue(student.parentName)} · ${displayValue(formatPhoneNumber(primaryParentPhone))}</p>
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

      <div class="student-overview-grid">
        ${renderOverviewTile('Thông tin học viên', [
          ['Họ và tên', student.fullName],
          ['Ngày sinh', formatBirthDate(student.birthDate)],
          ['Tuổi', formatAgeLabel(student.birthDate)],
          ['Giới tính', getGenderLabel(student.gender)],
          ['Trường', getSchoolLabel(student)],
          ['Tỉnh/TP', student.hometown],
          ['Sở thích', student.hobbies],
          ['Quốc tịch', student.nationality],
        ])}
        ${renderOverviewTile('Phụ huynh / Liên hệ', [
          ['Phụ huynh', student.parentName],
          ['SĐT ba', formatPhoneNumber(student.fatherPhone)],
          ['SĐT mẹ', formatPhoneNumber(student.motherPhone || (!student.fatherPhone ? student.parentPhone : ''))],
          ['Năm sinh / tuổi', formatParentAge(student.parentBirthYear)],
          ['Nghề nghiệp', student.parentJob],
          ['Khu vực', student.parentArea],
        ])}
        ${renderStudentFamilyTuitionTile(studentTuitionLink)}
        ${renderOverviewTile('Trạng thái học', [
          ['Cấp độ học', getEscapedLevelLabel(student.level)],
          ['Điểm bài kiểm tra gần nhất', formatTestScore(student.testScore)],
          ['Mốc bot', student.highestBotMilestone],
          ['Tính cách', student.personality],
          ['GV phụ trách', assignedTeacherLabel],
          ['Ca học / Lớp', classSessionLabel],
        ])}
        ${renderOverviewTile(
          'Chăm sóc',
          [
            ['Trạng thái', student.currentStatus],
            ['Số ghi chú', `${careNotes.length}`],
            ['Ghi chú mới nhất', summarizeText(latestCareNote?.content)],
            ['Thành tích', summarizeText(student.achievements)],
            ['Lưu ý phụ huynh', summarizeText(student.parentNotes)],
          ],
          `<button type="button" class="student-detail-open-button" data-student-detail-action="open-care-notes" data-student-id="${student.id}">Mở chi tiết</button>`,
        )}
        ${renderOverviewTile(
          'Kết quả học tập',
          [
            ['Cấp độ học hiện tại', getEscapedLevelLabel(student.level)],
            ['Điểm bài kiểm tra gần nhất', formatTestScore(student.testScore)],
            ['Mốc bot', student.highestBotMilestone],
            ['Nhận xét GV', 'Sẽ cập nhật sau'],
            ['Kế hoạch học tập', 'Sẽ cập nhật sau'],
          ],
          `<button type="button" class="student-detail-open-button" data-student-detail-action="open-learning" data-student-id="${student.id}">Mở chi tiết</button>`,
        )}
        ${renderOverviewTile('Tự động sau', [
          ['Chuyên cần', 'Tự động cập nhật sau'],
          ['Ca học chính', 'Tự động cập nhật sau'],
          ['Tái đăng ký', 'Tự động cập nhật sau'],
          ['Tình trạng thu phí', 'Tự động cập nhật sau'],
        ])}
      </div>
    </section>
  `
}

export function renderStudentCareNotes(student, careNoteDraft = emptyCareNoteDraft) {
  if (!student) {
    return renderStudentNotFound()
  }

  const isEditing = Boolean(careNoteDraft.editingNoteId)

  return `
    <section class="student-care-notes student-care-window" aria-label="Chăm sóc và ghi chú học viên">
      <div class="student-care-layout">
        <div class="student-care-history-panel">
          <h4>Lịch sử ghi chú chăm sóc</h4>
          ${renderCareNoteHistory(student)}
        </div>
        <div class="student-care-form">
          <h4>${isEditing ? 'Sửa ghi chú chăm sóc' : 'Thêm ghi chú chăm sóc'}</h4>
          <label>
            <span>Tag / chủ đề</span>
            <input
              type="text"
              value="${escapeAttribute(careNoteDraft.tag ?? '')}"
              data-care-note-field="tag"
              data-care-note-student-id="${student.id}"
              placeholder="Ví dụ: Lịch học, Học phí"
            />
          </label>
          <label>
            <span>Nội dung ghi chú</span>
            <textarea
              data-care-note-field="content"
              data-care-note-student-id="${student.id}"
              placeholder="Nhập nội dung đã trao đổi hoặc việc cần theo dõi..."
            >${careNoteDraft.content ?? ''}</textarea>
          </label>
          ${
            careNoteDraft.error
              ? `<p class="care-note-error">${careNoteDraft.error}</p>`
              : ''
          }
          <div class="care-note-suggestions" aria-label="Gợi ý nhanh ghi chú">
            ${careNoteSuggestions
              .slice(0, 8)
              .map(
                (suggestion) => `
                  <button type="button" data-care-note-suggestion="${escapeAttribute(suggestion)}" data-care-note-student-id="${student.id}">
                    ${suggestion}
                  </button>
                `,
              )
              .join('')}
          </div>
          <div class="care-note-actions">
            <button type="button" data-care-note-action="save" data-care-note-student-id="${student.id}">
              ${isEditing ? 'Lưu thay đổi' : 'Lưu ghi chú'}
            </button>
            <button type="button" data-care-note-action="clear" data-care-note-student-id="${student.id}">
              ${isEditing ? 'Hủy sửa' : 'Hủy nhập'}
            </button>
          </div>
        </div>
      </div>
    </section>
  `
}

export function renderStudentLearningResult(student) {
  if (!student) {
    return renderStudentNotFound()
  }

  return `
    <section class="student-learning-window" aria-label="Kết quả học tập học viên">
      <div class="student-learning-stats">
        ${renderLearningStat('Cấp độ học hiện tại', getEscapedLevelLabel(student.level))}
        ${renderLearningStat('Điểm bài kiểm tra gần nhất', formatTestScore(student.testScore))}
        ${renderLearningStat('Mốc bot', displayValue(student.highestBotMilestone))}
      </div>
      <section class="student-learning-panel">
        <h4>Biểu đồ tiến bộ</h4>
        <p>Chưa có dữ liệu học tập thật. Giáo viên sẽ cập nhật ở phase sau.</p>
      </section>
      <section class="student-learning-panel">
        <h4>Nhận xét giáo viên</h4>
        <p>Sẽ cập nhật sau.</p>
      </section>
      <section class="student-learning-panel">
        <h4>Kế hoạch học tập tiếp theo</h4>
        <p>Sẽ cập nhật sau.</p>
      </section>
    </section>
  `
}

export function getStudentDetailWindowTitle(student) {
  return student ? `Hồ sơ học viên - ${student.fullName}` : 'Hồ sơ học viên'
}

export function getStudentCareNotesWindowTitle(student) {
  return student ? `Chăm sóc / Ghi chú - ${student.fullName}` : 'Chăm sóc / Ghi chú'
}

export function getStudentLearningWindowTitle(student) {
  return student ? `Kết quả học tập - ${student.fullName}` : 'Kết quả học tập'
}

function renderStudentNotFound() {
  return `
    <section class="student-detail">
      <p class="student-detail-empty">Không tìm thấy hồ sơ học viên.</p>
    </section>
  `
}

function renderOverviewTile(title, rows, action = '') {
  return `
    <section class="student-overview-tile">
      <div class="student-overview-tile-header">
        <h4>${title}</h4>
        ${action ? `<div class="student-overview-actions">${action}</div>` : ''}
      </div>
      <dl>
        ${rows
          .map(
            ([label, value]) => `
              <div>
                <dt>${label}</dt>
                <dd>${displayValue(value)}</dd>
              </div>
            `,
          )
          .join('')}
      </dl>
    </section>
  `
}

function renderStudentFamilyTuitionTile(link) {
  const warningHtml = link.warnings.length
    ? `
      <div class="student-link-warning-list" aria-label="Cảnh báo chăm sóc">
        <strong>Cảnh báo chăm sóc</strong>
        <div>
          ${link.warnings
            .map(
              (warning) => `
                <span class="student-link-warning is-${warning.tone}">
                  ${warning.label}
                </span>
              `,
            )
            .join('')}
        </div>
      </div>
    `
    : '<p class="student-family-tuition-empty">Không có cảnh báo chăm sóc nổi bật.</p>'
  const contactEmpty = link.parent.hasContact
    ? ''
    : '<p class="student-family-tuition-empty">Chưa có thông tin phụ huynh/người liên hệ.</p>'
  const tuitionEmpty = link.tuition.hasTuition
    ? ''
    : '<p class="student-family-tuition-empty">Chưa có dữ liệu học phí liên kết cho học viên này.</p>'

  return renderOverviewTile(
    'Liên kết phụ huynh & học phí',
    [
      ['Phụ huynh/người chăm sóc', link.parent.parentName],
      ['SĐT ba', formatPhoneNumber(link.parent.fatherPhone)],
      ['SĐT mẹ', formatPhoneNumber(link.parent.motherPhone)],
      ['Số liên hệ chính', formatPhoneNumber(link.parent.primaryPhone)],
      ['Trạng thái học viên', link.studentStatus],
      ['Tổng quan học phí', link.tuition.label],
      ['Còn lại', Number.isFinite(link.tuition.remainingSessions) ? `${link.tuition.remainingSessions} buổi` : '—'],
      ['Cần thanh toán', link.tuition.hasTuition ? formatMoney(link.tuition.payableAmount) : '—'],
      ['Đã thanh toán', link.tuition.hasTuition ? formatMoney(link.tuition.paidAmount) : '—'],
    ],
    '',
  ).replace('</section>', `${contactEmpty}${tuitionEmpty}${warningHtml}</section>`)
}

function renderLearningStat(label, value) {
  return `
    <div class="student-learning-stat">
      <span>${label}</span>
      <strong>${displayValue(value)}</strong>
    </div>
  `
}

function renderCareNoteHistory(student) {
  const careNotes = getSortedCareNotes(student)

  if (!careNotes.length) {
    return `<p class="care-note-empty">Chưa có ghi chú chăm sóc.</p>`
  }

  return `
    <div class="care-note-list">
      ${careNotes
        .map(
          (note) => `
            <article class="care-note-item">
              <div>
                <strong>${note.author || 'Admin DreamHome'}</strong>
                <time datetime="${note.createdAt}">${formatDateTime(note.createdAt)}</time>
              </div>
              <p>${note.content}</p>
              ${
                note.tags?.length
                  ? `<div class="care-note-tags">${note.tags
                      .map((tag) => `<span>${tag}</span>`)
                      .join('')}</div>`
                  : ''
              }
              <div class="care-note-item-actions">
                <button type="button" data-care-note-action="edit" data-care-note-student-id="${student.id}" data-care-note-id="${note.id}">
                  Sửa
                </button>
                <button type="button" data-care-note-action="delete" data-care-note-student-id="${student.id}" data-care-note-id="${note.id}">
                  Xóa
                </button>
              </div>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function getAssignedTeacherLabel(student, teachers = []) {
  const assignedTeacherId = String(student?.assignedTeacherId ?? '').trim()

  if (!assignedTeacherId) {
    return 'Chưa phân công'
  }

  const teacher = teachers.find((item) => String(item?.id ?? '') === assignedTeacherId)

  if (!teacher) {
    return 'Không tìm thấy giáo viên'
  }

  const teacherName = String(teacher.displayName || teacher.fullName || 'Giáo viên').trim()
  return `${teacherName} - ${getTeacherStatusLabel(teacher.status)}`
}

function getStudentClassSessionLabel(student, classSessions = []) {
  const classSessionIds = Array.isArray(student?.classSessionIds)
    ? Array.from(new Set(student.classSessionIds.map((id) => String(id ?? '').trim()).filter(Boolean)))
    : []

  if (!classSessionIds.length) {
    return 'Chưa phân lớp'
  }

  const classSessionLookup = new Map(
    classSessions
      .filter((classSession) => classSession && classSession.id)
      .map((classSession) => [String(classSession.id), classSession]),
  )

  return classSessionIds
    .map((classSessionId) => {
      const classSession = classSessionLookup.get(classSessionId)
      if (!classSession) {
        return 'Ca học không tìm thấy'
      }

      const label = classSession.displayLabel || classSession.name || 'Ca học'
      return classSession.status === 'inactive' ? `${label} (Đã ngưng)` : label
    })
    .join(', ')
}

function getTeacherStatusLabel(status) {
  const statusLabels = {
    active: 'Đang dạy',
    paused: 'Tạm nghỉ',
    inactive: 'Ngừng dạy',
  }

  return statusLabels[status] ?? 'Chưa cập nhật'
}

function getSortedCareNotes(student) {
  return [...(student.careNotes ?? [])].sort(
    (firstNote, secondNote) => new Date(secondNote.createdAt) - new Date(firstNote.createdAt),
  )
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

function displayValue(value) {
  const text = String(value ?? '').trim()
  return text && !text.toLowerCase().includes('chưa có') ? text : '—'
}

function getGenderLabel(value) {
  const genderLabels = {
    male: 'Nam',
    female: 'Nữ',
  }

  return genderLabels[value] ?? 'Chưa cập nhật giới tính'
}

function getLevelLabel(level) {
  const studentLevelOptions = [
    'Dolphin 1',
    'Dolphin 2',
    'Dolphin 3',
    'Dolphin 4',
    'Turtle 1',
    'Turtle 2',
    'Turtle 3',
    'Bee 1',
    'Bee 2',
    'Bee 3',
    'Monkey 1',
    'Monkey 2',
    'Monkey 3',
    'Elephant 1',
    'Elephant 2',
    'Elephant 3',
    'Jaguar',
    'Lion',
    'Eagle',
  ]
  const levelMap = {
    'Nhập môn': 'Dolphin 1',
    'Cơ bản': 'Dolphin 2',
    'Trung cấp': 'Dolphin 3',
    'Nâng cao': 'Dolphin 4',
  }
  const levelText = String(levelMap[level] ?? level ?? '').trim()
  const canonicalLevel = studentLevelOptions.find(
    (option) => option.toLowerCase() === levelText.toLowerCase(),
  )

  if (canonicalLevel) {
    return canonicalLevel
  }

  const legacyLevelMatch = levelText.match(/^(?:level\s*)?(\d{1,2})$/i)
  const legacyLevelNumber = legacyLevelMatch ? Number(legacyLevelMatch[1]) : null

  return legacyLevelNumber && legacyLevelNumber >= 1 && legacyLevelNumber <= 15
    ? studentLevelOptions[legacyLevelNumber - 1]
    : levelText || 'Dolphin 1'
}

function getEscapedLevelLabel(level) {
  return escapeHtml(getLevelLabel(level))
}

function getSchoolLabel(student) {
  const schoolName = displayValue(student.schoolName)
  const schoolLevel = displayValue(student.schoolLevel)

  if (schoolName === '—') {
    return schoolLevel === '—' ? '—' : schoolLevel
  }

  return schoolLevel === '—' ? schoolName : `${schoolName} (${schoolLevel})`
}

function formatBirthDate(value) {
  if (!value) {
    return '—'
  }

  const birthDate = new Date(value)
  const day = String(birthDate.getDate()).padStart(2, '0')
  const month = String(birthDate.getMonth() + 1).padStart(2, '0')
  const year = birthDate.getFullYear()
  return `${day}/${month}/${year}`
}

function getAge(value) {
  if (!value) {
    return null
  }

  const birthDate = new Date(value)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDelta = today.getMonth() - birthDate.getMonth()

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1
  }

  return age
}

function formatAgeLabel(value) {
  const age = getAge(value)
  return Number.isFinite(age) ? `${age} tuổi` : '—'
}

function formatParentAge(parentBirthYear) {
  if (!parentBirthYear) {
    return '—'
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

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function summarizeText(value, maxLength = 110) {
  const text = displayValue(value)

  if (text === '—' || text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength).trim()}...`
}

function formatTestScore(value) {
  if (value === '' || value === null || value === undefined) {
    return '—'
  }

  const score = Number(String(value).replace(',', '.'))
  return Number.isFinite(score) ? `${score}/10` : '—'
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeAttribute(value) {
  return String(value).replace(/"/g, '&quot;')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
