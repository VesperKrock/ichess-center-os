import { buildStudentTuitionLink } from './student-tuition-links.js'
import {
  formatOperatorDate,
  formatOperatorDateTime,
  parseCanonicalDateParts,
} from './operator-date-format.js'
import {
  V22_WEEKDAY_LABELS,
  V22_WEEKDAY_ORDER,
  getV22ClassSessionWeekdays,
  normalizeV22Enrollments,
} from './student-recurring-enrollment.js'

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

export function renderStudentDetail(student, _teachers = [], classSessions = [], tuitionRecords = []) {
  if (!student) {
    return renderStudentNotFound()
  }

  const careNotes = getSortedCareNotes(student)
  const latestCareNote = careNotes[0]
  const classSessionLabel = getStudentClassSessionLabel(student, classSessions)
  const studentTuitionLink = buildStudentTuitionLink(student, tuitionRecords, classSessions)
  const studentStatusFact = ['Trạng thái', student.currentStatus]
  const primaryParentPhone = studentTuitionLink.parent.primaryPhone
    || student.motherPhone
    || student.fatherPhone
    || student.parentPhone
  const readOnlyProjection = student.readOnlyProjection === true

  return `
    <section class="student-detail student-detail-overview" aria-label="Hồ sơ tổng quan học viên">
      <h3 class="student-detail-page-title">Hồ sơ học viên</h3>
      <div class="student-detail-hero">
        <div class="student-avatar-stack">
          ${renderStudentAvatar(student)}
          <button
            class="student-avatar-clear"
            type="button"
            data-student-detail-action="clear-avatar"
            data-student-id="${student.id}"
            ${student.avatarUrl && !readOnlyProjection ? '' : 'disabled'}
          >
            Xóa avatar
          </button>
        </div>
        <div class="student-detail-hero-main">
          <h3>${student.fullName}</h3>
          <div class="student-detail-hero-badges" aria-label="Trạng thái và cấp độ học viên">
            <span class="student-detail-status-badge ${getStudentProfileStatusClass(studentStatusFact[1])}" aria-label="${studentStatusFact[0]}">${displayValue(studentStatusFact[1])}</span>
            <span class="student-detail-level-badge">${getEscapedLevelLabel(student.level)}</span>
          </div>
          <p class="student-detail-identity-meta">${formatBirthDate(student.birthDate)} · ${formatAgeLabel(student.birthDate)} · ${getGenderLabel(student.gender)}</p>
          <p class="student-detail-contact-meta">PH: ${displayValue(student.parentName)} · ${displayValue(formatPhoneNumber(primaryParentPhone))}</p>
        </div>
        <div class="student-detail-hero-actions">
          <button
            class="student-detail-edit"
            type="button"
            data-student-action="edit-from-detail"
            data-student-edit-id="${student.id}"
            ${readOnlyProjection ? 'disabled' : ''}
          >
            ${readOnlyProjection ? 'Hồ sơ chỉ đọc' : 'Sửa hồ sơ'}
          </button>
          <span class="student-detail-delete-slot"></span>
        </div>
      </div>

      <div class="student-overview-grid">
        <div class="student-operational-grid">
          ${renderOverviewTile(
            'Học tập',
            [
              ['Cấp độ hiện tại', getEscapedLevelLabel(student.level)],
              ['Điểm bài kiểm tra gần nhất', formatTestScore(student.testScore)],
              ['Mốc bot', student.highestBotMilestone],
              ['Tính cách', student.personality],
              ['Ca học / Lớp', classSessionLabel],
            ],
            '',
            'student-learning-summary-tile',
          )}
          ${renderStudentParentContactTile(student, studentTuitionLink)}
          ${renderStudentTuitionTile(studentTuitionLink)}
        </div>
        ${renderStudentScheduleOverview(student, classSessions)}
        <div class="student-secondary-grid">
          ${renderOverviewTile(
            'Chăm sóc',
            [
              ['Số ghi chú', `${careNotes.length}`],
              ['Ghi chú mới nhất', summarizeText(latestCareNote?.content)],
              ['Thành tích', summarizeText(student.achievements)],
              ['Lưu ý phụ huynh', summarizeText(student.parentNotes)],
            ],
            `<button type="button" class="student-detail-open-button" data-student-detail-action="open-care-notes" data-student-id="${student.id}">Mở chi tiết</button>`,
            'student-care-summary-tile',
          )}
          ${renderOverviewTile(
            'Kết quả học tập',
            [
              ['Cấp độ học hiện tại', getEscapedLevelLabel(student.level)],
              ['Điểm bài kiểm tra gần nhất', formatTestScore(student.testScore)],
              ['Mốc bot', student.highestBotMilestone],
            ],
            '',
            'student-learning-result-tile',
          )}
        </div>
        ${renderOverviewTile(
          'Thông tin bổ sung',
          [
            ['Trường', student.schoolName],
            ['Bậc học', student.schoolLevel],
            ['Tỉnh/TP', student.hometown],
            ['Sở thích', student.hobbies],
            ['Quốc tịch', student.nationality],
          ],
          '',
          'student-supplementary-tile',
        )}
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
      <header class="student-care-page-header">
        <h3>Chăm sóc / Ghi chú <span>— ${escapeHtml(student.fullName)}</span></h3>
      </header>
      <div class="student-care-layout">
        <div class="student-care-history-panel">
          <h4>Lịch sử ghi chú chăm sóc</h4>
          ${renderCareNoteHistory(student)}
        </div>
        <div class="student-care-form">
          <h4>${isEditing ? 'Sửa ghi chú chăm sóc' : 'Thêm ghi chú chăm sóc'}</h4>
          <div class="student-care-form-card">
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
            <p class="care-note-suggestion-label">Gợi ý nhanh:</p>
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

function renderOverviewTile(title, rows, action = '', className = '', footer = '') {
  return `
    <section class="student-overview-tile${className ? ` ${className}` : ''}">
      <div class="student-overview-tile-header">
        <h4>${title}</h4>
        ${action ? `<div class="student-overview-actions">${action}</div>` : ''}
      </div>
      ${rows.length
        ? `<dl>
            ${rows
              .map(
                ([label, value]) => `
                  <div class="${isStudentOverviewMetricLabel(label) ? 'student-overview-metric-row' : ''}">
                    <dt>${label}</dt>
                    <dd>${displayValue(value)}</dd>
                  </div>
                `,
              )
              .join('')}
          </dl>`
        : ''}
      ${footer}
    </section>
  `
}

function isStudentOverviewMetricLabel(label) {
  return ['Ca học / Lớp', 'Còn lại', 'Cần thanh toán', 'Đã thanh toán'].includes(label)
}

function renderStudentParentContactTile(student, link) {
  const hasParentDetails = link.parent.hasContact
    || [student.parentBirthYear, student.parentJob, student.parentArea]
      .some((value) => String(value ?? '').trim())
  const parentWarnings = hasParentDetails
    ? link.warnings.filter((warning) => ['missing-parent-name', 'missing-parent-phone'].includes(warning.key))
    : []

  return renderOverviewTile(
    'Phụ huynh / Liên hệ',
    hasParentDetails
      ? [
          ['Phụ huynh', link.parent.parentName],
          ['Số liên hệ chính', formatPhoneNumber(link.parent.primaryPhone)],
          ['SĐT ba', formatPhoneNumber(link.parent.fatherPhone)],
          ['SĐT mẹ', formatPhoneNumber(link.parent.motherPhone)],
          ['Năm sinh / tuổi', formatParentAge(student.parentBirthYear)],
          ['Nghề nghiệp', student.parentJob],
          ['Khu vực sinh sống', student.parentArea],
        ]
      : [],
    '',
    'student-parent-contact-tile',
    `${hasParentDetails ? '' : '<p class="student-profile-card-empty">Chưa có thông tin phụ huynh/người liên hệ.</p>'}${renderStudentWarningList(parentWarnings)}`,
  )
}

function renderStudentTuitionTile(link) {
  const tuitionWarnings = link.tuition.hasTuition
    ? link.warnings.filter((warning) => ['tuition-debt', 'tuition-low-session'].includes(warning.key))
    : []

  return renderOverviewTile(
    'Học phí',
    link.tuition.hasTuition
      ? [
          ['Gói học phí', link.tuition.packageName],
          ['Trạng thái', link.tuition.statusLabel],
          ['Còn lại', Number.isFinite(link.tuition.remainingSessions) ? `${link.tuition.remainingSessions} buổi` : '—'],
          ['Cần thanh toán', formatMoney(link.tuition.payableAmount)],
          ['Đã thanh toán', formatMoney(link.tuition.paidAmount)],
        ]
      : [],
    '',
    'student-tuition-summary-tile',
    `${link.tuition.hasTuition ? '' : '<p class="student-profile-card-empty">Chưa có dữ liệu học phí.</p>'}${renderStudentWarningList(tuitionWarnings)}`,
  )
}

function renderStudentWarningList(warnings = []) {
  if (!warnings.length) {
    return ''
  }

  return `
      <div class="student-link-warning-list" aria-label="Lưu ý hồ sơ">
        <strong>Lưu ý</strong>
        <div>
          ${warnings
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
                <strong>${note.author || 'Người dùng hiện tại'}</strong>
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
  const enrollmentLookup = new Map(
    normalizeV22Enrollments(student?.recurringEnrollments)
      .map((entry) => [entry.classSessionId, entry]),
  )

  return classSessionIds
    .map((classSessionId) => {
      const classSession = classSessionLookup.get(classSessionId)
      if (!classSession) {
        return 'Ca học không tìm thấy'
      }

      const label = classSession.displayLabel || classSession.name || 'Ca học'
      const enrollment = enrollmentLookup.get(classSessionId)
      const weekdayLabel = (enrollment?.weekdays || [])
        .map((day) => V22_WEEKDAY_LABELS[day] || day)
        .join(' · ')
      const withDays = weekdayLabel
        ? `${label} · ${weekdayLabel}`
        : enrollment?.legacyReviewRequired
          ? `${label} · Cần chọn ngày`
          : label
      return classSession.status === 'inactive' ? `${withDays} (Đã ngưng)` : withDays
    })
    .join(', ')
}

function renderStudentScheduleOverview(student, classSessions = []) {
  const classSessionIds = Array.isArray(student?.classSessionIds)
    ? Array.from(new Set(student.classSessionIds.map((id) => String(id ?? '').trim()).filter(Boolean)))
    : []
  const classSessionLookup = new Map(
    classSessions
      .filter((classSession) => classSession?.id)
      .map((classSession) => [String(classSession.id), classSession]),
  )
  const enrollmentLookup = new Map(
    normalizeV22Enrollments(student?.recurringEnrollments)
      .map((entry) => [entry.classSessionId, entry]),
  )
  const slotsByWeekday = new Map(V22_WEEKDAY_ORDER.map((weekday) => [weekday, []]))
  const unresolved = []

  classSessionIds.forEach((classSessionId) => {
    const classSession = classSessionLookup.get(classSessionId)
    const enrollment = enrollmentLookup.get(classSessionId)
    if (!classSession) {
      unresolved.push('Ca học cũ không còn trong danh mục')
      return
    }

    const availableDays = new Set(getV22ClassSessionWeekdays(classSession))
    const enrolledDays = (enrollment?.weekdays || []).filter((weekday) => availableDays.has(weekday))
    if (!enrolledDays.length) {
      unresolved.push(`${getStudentClassSessionDisplayLabel(classSession)} · Cần chọn ngày`)
      return
    }

    enrolledDays.forEach((weekday) => {
      slotsByWeekday.get(weekday)?.push(classSession)
    })
  })
  slotsByWeekday.forEach((slots) => slots.sort(compareStudentProfileScheduleSlots))

  return `
    <section class="student-overview-tile student-schedule-overview-tile" aria-label="Lịch học định kỳ từ Thứ Hai đến Chủ nhật">
      <div class="student-overview-tile-header">
        <h4>Lịch học định kỳ</h4>
      </div>
      ${classSessionIds.length
        ? `<div class="student-profile-schedule-grid">
            ${V22_WEEKDAY_ORDER.map((weekday) => `
              <section data-student-profile-weekday="${weekday}">
                <header><strong>${V22_WEEKDAY_LABELS[weekday]}</strong></header>
                <div>
                  ${slotsByWeekday.get(weekday).length
                    ? slotsByWeekday.get(weekday).map(renderStudentProfileScheduleSlot).join('')
                    : '<span class="student-profile-schedule-empty">—</span>'}
                </div>
              </section>
            `).join('')}
          </div>`
        : `<div class="student-profile-schedule-unassigned">
            <strong>Chưa phân lớp</strong>
            <span>Học viên chưa có lịch học định kỳ.</span>
          </div>`}
      ${unresolved.length
        ? `<div class="student-profile-schedule-warnings">${unresolved.map((message) => `<span>${escapeHtml(message)}</span>`).join('')}</div>`
        : ''}
    </section>
  `
}

function renderStudentProfileScheduleSlot(classSession) {
  const instructorName = String(classSession?.instructorName || '').trim()
  const isInactive = classSession?.status === 'inactive'
  return `
    <article class="student-profile-schedule-slot ${isInactive ? 'is-inactive' : ''}">
      <strong>${escapeHtml(formatStudentProfileScheduleTime(classSession))}</strong>
      <span class="${instructorName ? '' : 'is-unassigned'}">${escapeHtml(instructorName || 'Chưa xếp giáo viên')}</span>
      ${isInactive ? '<small>Đã ngưng</small>' : ''}
    </article>
  `
}

function compareStudentProfileScheduleSlots(first, second) {
  return (
    String(first?.startTime || '').localeCompare(String(second?.startTime || '')) ||
    String(first?.endTime || '').localeCompare(String(second?.endTime || '')) ||
    getStudentClassSessionDisplayLabel(first).localeCompare(getStudentClassSessionDisplayLabel(second), 'vi')
  )
}

function formatStudentProfileScheduleTime(classSession = {}) {
  const startTime = String(classSession.startTime || '').trim()
  const endTime = String(classSession.endTime || '').trim()
  return startTime && endTime
    ? `${startTime}–${endTime}`
    : startTime || endTime || getStudentClassSessionDisplayLabel(classSession)
}

function getStudentClassSessionDisplayLabel(classSession = {}) {
  return String(classSession.displayLabel || classSession.name || 'Ca học').trim()
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

function getStudentProfileStatusClass(value) {
  const status = String(value ?? '').trim().toLowerCase()

  if (status === 'đang theo học') {
    return 'is-active'
  }

  if (status === 'bảo lưu') {
    return 'is-paused'
  }

  if (status === 'ngưng học') {
    return 'is-stopped'
  }

  return ''
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

function formatBirthDate(value) {
  if (!value) {
    return '—'
  }

  return formatOperatorDate(value, '—')
}

function getAge(value) {
  if (!value) {
    return null
  }

  const birthDate = parseCanonicalDateParts(value)
  if (!birthDate) return null
  const today = new Date()
  let age = today.getFullYear() - birthDate.year
  const monthDelta = today.getMonth() + 1 - birthDate.month

  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.day)) {
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
  return formatOperatorDateTime(value, '—')
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
