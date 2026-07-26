export const STAFF_EMPLOYMENT_TYPES = [
  { value: 'unspecified', label: 'Chưa xác định' },
  { value: 'full-time', label: 'Toàn thời gian' },
  { value: 'part-time', label: 'Bán thời gian' },
  { value: 'collaborator', label: 'Cộng tác viên' },
  { value: 'contract', label: 'Hợp đồng' },
]

export const STAFF_EMPLOYMENT_STATUSES = [
  { value: 'active', label: 'Đang làm việc', tone: 'active' },
  { value: 'on-leave', label: 'Tạm nghỉ', tone: 'leave' },
  { value: 'terminated', label: 'Đã nghỉ việc', tone: 'terminated' },
  { value: 'archived', label: 'Đã lưu trữ', tone: 'archived' },
]

export const DEPARTMENT_STATUSES = [
  { value: 'active', label: 'Đang hoạt động' },
  { value: 'archived', label: 'Đã lưu trữ' },
]

const STAFF_ACCOUNT_ROLE_LABELS = Object.freeze({
  owner: 'Chủ hệ thống',
  qtv: 'Quản trị viên',
  admin: 'Quản lý cơ sở',
  center_admin: 'Quản lý cơ sở',
  teacher: 'Giáo viên',
  consultant: 'Tư vấn',
  viewer: 'Chỉ xem',
})

const ACTIVE_MEMBERSHIP_STATUS = 'active'
const STAFF_ACCOUNT_ROLES = new Set([
  'owner',
  'qtv',
  'admin',
  'center_admin',
  'teacher',
  'consultant',
  'viewer',
])
const STAFF_ACCOUNT_MEMBERSHIP_STATUSES = new Set([
  'active',
  'revoked',
  'paused',
  'disabled',
  'inactive',
  'suspended',
])
const ELEVATED_TEACHER_COMPATIBLE_ROLES = new Set(['owner', 'qtv', 'admin', 'center_admin'])

export const initialStaffFilters = {
  query: '',
  departmentId: 'all',
  employmentStatus: 'active',
  teacherLink: 'all',
  accountLink: 'all',
  weekStartDate: getWeekStartDate(getTodayDate()),
  location: 'all',
  person: 'all',
}

const emptyStaffFormValues = {
  employeeCode: '',
  fullName: '',
  phone: '',
  email: '',
  departmentId: '',
  positionTitle: '',
  employmentType: 'unspecified',
  employmentStatus: 'active',
  startDate: '',
  endDate: '',
  note: '',
}

const emptyDepartmentFormValues = {
  name: '',
  code: '',
  description: '',
  sortOrder: '',
}

const attendanceStatuses = ['Có mặt', 'Vắng', 'Dạy bù', 'Nghỉ phép', 'Chưa chấm']
const emptyAttendanceStateText = 'Chưa có đủ dữ liệu chấm công/ca dạy trong khoảng thời gian này.'

export function createEmptyStaffFormState() {
  return {
    mode: 'create',
    staffId: null,
    centerId: '',
    values: { ...emptyStaffFormValues },
    errors: {},
    message: '',
    isSaving: false,
  }
}

export function createEditStaffFormState(staffMember) {
  return {
    mode: 'edit',
    staffId: staffMember.id,
    centerId: staffMember.centerId || '',
    values: {
      employeeCode: staffMember.employeeCode || '',
      fullName: staffMember.fullName || '',
      phone: staffMember.phone || '',
      email: staffMember.email || '',
      departmentId: staffMember.departmentId || '',
      positionTitle: staffMember.positionTitle || '',
      employmentType: normalizeEmploymentType(staffMember.employmentType),
      employmentStatus: normalizeEmploymentStatus(staffMember.employmentStatus),
      startDate: staffMember.startDate || '',
      endDate: staffMember.endDate || '',
      note: staffMember.note || '',
    },
    errors: {},
    message: '',
    isSaving: false,
    links: {
      hasTeacherLink: Boolean(staffMember.teacherId),
      hasAccountLink: Boolean(staffMember.accountUserId || staffMember.membershipId),
    },
  }
}

export function createEmptyDepartmentFormState() {
  return {
    mode: 'create',
    departmentId: null,
    centerId: '',
    values: { ...emptyDepartmentFormValues },
    errors: {},
    message: '',
    isSaving: false,
  }
}

export function createEditDepartmentFormState(department) {
  return {
    mode: 'edit',
    departmentId: department.id,
    centerId: department.centerId || '',
    values: {
      name: department.name || '',
      code: department.code || '',
      description: department.description || '',
      sortOrder: department.sortOrder ?? '',
    },
    errors: {},
    message: '',
    isSaving: false,
  }
}

export function createStaffId() {
  return `staff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createDepartmentId() {
  return `department-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function validateStaffForm(
  values,
  { staffMembers = [], departments = [], currentStaffId = null, allowedArchivedDepartmentId = '' } = {},
) {
  const errors = {}
  const employmentStatus = normalizeEmploymentStatus(values.employmentStatus)
  const fullName = cleanText(values.fullName)
  const employeeCode = cleanText(values.employeeCode)
  const email = cleanText(values.email)
  const departmentId = cleanText(values.departmentId)
  const startDate = cleanText(values.startDate)
  const endDate = cleanText(values.endDate)

  if (!fullName) {
    errors.fullName = 'Vui lòng nhập họ và tên nhân viên.'
  }

  if (employeeCode && hasDuplicateEmployeeCode(staffMembers, employeeCode, currentStaffId)) {
    errors.employeeCode = 'Mã nhân viên đã được sử dụng trong cơ sở này.'
  }

  if (email && !email.includes('@')) {
    errors.email = 'Email cần có ký tự @.'
  }

  if (departmentId) {
    const department = departments.find((item) => item.id === departmentId)
    if (!department || (department.status === 'archived' && department.id !== allowedArchivedDepartmentId)) {
      errors.departmentId = 'Phòng ban không còn hoạt động trong cơ sở hiện tại.'
    }
  }

  if (!STAFF_EMPLOYMENT_TYPES.some((item) => item.value === values.employmentType)) {
    errors.employmentType = 'Loại hình làm việc không hợp lệ.'
  }

  if (!STAFF_EMPLOYMENT_STATUSES.some((item) => item.value === values.employmentStatus)) {
    errors.employmentStatus = 'Trạng thái làm việc không hợp lệ.'
  }

  if (startDate && !isDateKey(startDate)) {
    errors.startDate = 'Ngày bắt đầu không hợp lệ.'
  }

  if (isEmploymentEndDateEnabled(employmentStatus) && endDate && !isDateKey(endDate)) {
    errors.endDate = 'Ngày kết thúc không hợp lệ.'
  }

  if (isEmploymentEndDateEnabled(employmentStatus) && startDate && endDate && endDate < startDate) {
    errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu.'
  }

  return errors
}

export function validateDepartmentForm(values, { departments = [], currentDepartmentId = null } = {}) {
  const errors = {}
  const name = cleanText(values.name)
  const code = cleanText(values.code)

  if (!name) {
    errors.name = 'Vui lòng nhập tên phòng ban.'
  }

  if (name && hasDuplicateDepartmentName(departments, name, currentDepartmentId)) {
    errors.name = 'Tên phòng ban đã được sử dụng trong cơ sở này.'
  }

  if (code && hasDuplicateDepartmentCode(departments, code, currentDepartmentId)) {
    errors.code = 'Mã phòng ban đã được sử dụng trong cơ sở này.'
  }

  if (
    values.sortOrder !== '' &&
    values.sortOrder !== null &&
    values.sortOrder !== undefined &&
    !Number.isFinite(Number(values.sortOrder))
  ) {
    errors.sortOrder = 'Thứ tự hiển thị cần là số.'
  }

  return errors
}

export function buildStaffMemberFromForm(values, existingStaffMember = null, centerId = '') {
  const now = new Date().toISOString()
  const employmentStatus = normalizeEmploymentStatus(values.employmentStatus)
  const nextEndDate = getPersistedEmploymentEndDate(values.endDate, employmentStatus, existingStaffMember?.endDate || '')

  return {
    ...existingStaffMember,
    id: existingStaffMember?.id || createStaffId(),
    centerId: cleanText(existingStaffMember?.centerId || centerId),
    employeeCode: cleanText(values.employeeCode),
    fullName: cleanText(values.fullName),
    phone: cleanText(values.phone),
    email: cleanText(values.email),
    departmentId: cleanText(values.departmentId),
    positionTitle: cleanText(values.positionTitle),
    employmentType: normalizeEmploymentType(values.employmentType),
    employmentStatus,
    startDate: isDateKey(values.startDate) ? values.startDate : '',
    endDate: nextEndDate,
    teacherId: cleanText(existingStaffMember?.teacherId),
    accountUserId: cleanText(existingStaffMember?.accountUserId),
    membershipId: cleanText(existingStaffMember?.membershipId),
    accountLinkedAt: cleanText(existingStaffMember?.accountLinkedAt),
    note: cleanText(values.note),
    createdAt: existingStaffMember?.createdAt || now,
    updatedAt: now,
    archivedAt: employmentStatus === 'archived'
      ? existingStaffMember?.archivedAt || now
      : existingStaffMember?.archivedAt || '',
  }
}

export function buildDepartmentFromForm(values, existingDepartment = null, centerId = '') {
  const now = new Date().toISOString()

  return {
    ...existingDepartment,
    id: existingDepartment?.id || createDepartmentId(),
    centerId: cleanText(existingDepartment?.centerId || centerId),
    name: cleanText(values.name),
    code: cleanText(values.code),
    description: cleanText(values.description),
    sortOrder: Number.isFinite(Number(values.sortOrder)) && values.sortOrder !== ''
      ? Number(values.sortOrder)
      : existingDepartment?.sortOrder || 0,
    status: existingDepartment?.status === 'archived' ? 'archived' : 'active',
    createdAt: existingDepartment?.createdAt || now,
    updatedAt: now,
    archivedAt: existingDepartment?.archivedAt || '',
  }
}

export function archiveStaffMember(staffMember) {
  const now = new Date().toISOString()
  return {
    ...staffMember,
    employmentStatus: 'archived',
    updatedAt: now,
    archivedAt: staffMember.archivedAt || now,
  }
}

export function restoreStaffMember(staffMember) {
  const now = new Date().toISOString()
  return {
    ...staffMember,
    employmentStatus: 'active',
    updatedAt: now,
    archivedAt: '',
  }
}

export function archiveDepartment(department) {
  const now = new Date().toISOString()
  return {
    ...department,
    status: 'archived',
    updatedAt: now,
    archivedAt: department.archivedAt || now,
  }
}

export function restoreDepartment(department) {
  const now = new Date().toISOString()
  return {
    ...department,
    status: 'active',
    updatedAt: now,
    archivedAt: '',
  }
}

export function getFilteredStaffMembers(staffMembers = [], departments = [], filters = initialStaffFilters) {
  const activeFilters = normalizeStaffFilters(filters)
  const departmentLookup = createDepartmentLookup(departments)
  const query = normalizeSearchText(activeFilters.query)

  return (Array.isArray(staffMembers) ? staffMembers : [])
    .filter((staffMember) => {
      const department = departmentLookup.get(staffMember.departmentId)
      const valuesForSearch = [
        staffMember.employeeCode,
        staffMember.fullName,
        staffMember.phone,
        staffMember.email,
        staffMember.positionTitle,
        department?.name,
      ]
      const matchesQuery = !query || valuesForSearch.some((value) =>
        normalizeSearchText(value).includes(query),
      )
      const matchesDepartment =
        activeFilters.departmentId === 'all' ||
        (activeFilters.departmentId === 'none' && !staffMember.departmentId) ||
        staffMember.departmentId === activeFilters.departmentId
      const matchesStatus =
        activeFilters.employmentStatus === 'all' ||
        staffMember.employmentStatus === activeFilters.employmentStatus
      const matchesTeacherLink =
        activeFilters.teacherLink === 'all' ||
        (activeFilters.teacherLink === 'linked' && Boolean(staffMember.teacherId)) ||
        (activeFilters.teacherLink === 'unlinked' && !staffMember.teacherId)
      const hasAccountLink = Boolean(staffMember.accountUserId || staffMember.membershipId)
      const matchesAccountLink =
        activeFilters.accountLink === 'all' ||
        (activeFilters.accountLink === 'linked' && hasAccountLink) ||
        (activeFilters.accountLink === 'unlinked' && !hasAccountLink)

      return matchesQuery &&
        matchesDepartment &&
        matchesStatus &&
        matchesTeacherLink &&
        matchesAccountLink
    })
    .sort((first, second) =>
      compareText(first.fullName, second.fullName) ||
      compareText(first.employeeCode, second.employeeCode),
    )
}

export function findStaffMemberByTeacherId(staffMembers = [], teacherId = '') {
  const normalizedTeacherId = cleanText(teacherId)
  const matches = (Array.isArray(staffMembers) ? staffMembers : []).filter(
    (staffMember) => cleanText(staffMember?.teacherId) === normalizedTeacherId,
  )

  return {
    status: matches.length > 1 ? 'duplicate' : matches.length === 1 ? 'linked' : 'unlinked',
    staffMember: matches.length === 1 ? matches[0] : null,
    matches,
  }
}

export function findStaffMemberByMembershipId(
  staffMembers = [],
  membershipId = '',
  currentCenterId = '',
) {
  const normalizedMembershipId = cleanText(membershipId)
  const matches = normalizedMembershipId
    ? getCenterScopedStaffMembers(staffMembers, currentCenterId).filter(
        (staffMember) => cleanText(staffMember?.membershipId) === normalizedMembershipId,
      )
    : []

  return createStaffAccountReverseLookup(matches)
}

export function findStaffMemberByAccountUserId(
  staffMembers = [],
  accountUserId = '',
  currentCenterId = '',
) {
  const normalizedAccountUserId = cleanText(accountUserId)
  const matches = normalizedAccountUserId
    ? getCenterScopedStaffMembers(staffMembers, currentCenterId).filter(
        (staffMember) => cleanText(staffMember?.accountUserId) === normalizedAccountUserId,
      )
    : []

  return createStaffAccountReverseLookup(matches)
}

export function resolveStaffAccountLink({
  staffMember = null,
  staffMembers = [],
  memberships = [],
  currentCenterId = '',
} = {}) {
  if (!staffMember) {
    return createStaffAccountLinkResult('unlinked')
  }

  const accountUserId = cleanText(staffMember.accountUserId)
  const membershipId = cleanText(staffMember.membershipId)

  if (!accountUserId && !membershipId) {
    return createStaffAccountLinkResult('unlinked')
  }

  if (!accountUserId || !membershipId) {
    return createStaffAccountLinkResult(
      'malformed',
      null,
      'Thiếu accountUserId hoặc membershipId trong hồ sơ nhân viên.',
    )
  }

  if (staffMember.centerId && currentCenterId && staffMember.centerId !== currentCenterId) {
    return createStaffAccountLinkResult(
      'malformed',
      null,
      'Hồ sơ nhân viên thuộc cơ sở khác.',
    )
  }

  const membershipMatches = (Array.isArray(memberships) ? memberships : []).filter(
    (membership) => cleanText(membership?.id) === membershipId,
  )

  if (membershipMatches.length !== 1) {
    return createStaffAccountLinkResult(
      'malformed',
      null,
      membershipMatches.length > 1
        ? 'Có nhiều membership trùng stable ID.'
        : 'Membership không còn tồn tại hoặc chưa đọc được từ cơ sở hiện tại.',
    )
  }

  const membership = membershipMatches[0]
  if (currentCenterId && cleanText(membership.centerId) !== currentCenterId) {
    return createStaffAccountLinkResult(
      'malformed',
      membership,
      'Membership thuộc cơ sở khác.',
    )
  }

  if (cleanText(membership.accountUserId) !== accountUserId) {
    return createStaffAccountLinkResult(
      'malformed',
      membership,
      'Membership không thuộc accountUserId đang lưu trên hồ sơ nhân viên.',
    )
  }

  if (!STAFF_ACCOUNT_ROLES.has(cleanText(membership.role).toLowerCase())) {
    return createStaffAccountLinkResult(
      'malformed',
      membership,
      'Membership có quyền hệ thống không hợp lệ.',
    )
  }

  if (!STAFF_ACCOUNT_MEMBERSHIP_STATUSES.has(cleanText(membership.status).toLowerCase())) {
    return createStaffAccountLinkResult(
      'malformed',
      membership,
      'Membership có trạng thái không hợp lệ.',
    )
  }

  const membershipLookup = findStaffMemberByMembershipId(staffMembers, membershipId, currentCenterId)
  const accountLookup = findStaffMemberByAccountUserId(staffMembers, accountUserId, currentCenterId)
  if (membershipLookup.status === 'duplicate' || accountLookup.status === 'duplicate') {
    return createStaffAccountLinkResult(
      'malformed',
      membership,
      'Có nhiều hồ sơ nhân viên đang dùng cùng tài khoản hoặc membership.',
    )
  }

  return createStaffAccountLinkResult(
    isAccountMembershipActive(membership) ? 'linked' : 'linked-inactive',
    membership,
    isAccountMembershipActive(membership) ? '' : 'Membership hiện không hoạt động.',
  )
}

export function getAvailableStaffAccountMemberships({
  memberships = [],
  staffMembers = [],
  currentStaffId = '',
  currentCenterId = '',
} = {}) {
  const active = []
  const inactive = []
  const invalid = []
  const linked = []
  const membershipIdCounts = new Map()
  const accountUserIdCounts = new Map()
  const sourceMemberships = Array.isArray(memberships) ? memberships : []

  sourceMemberships.forEach((membership) => {
    const membershipId = cleanText(membership?.id)
    const accountUserId = cleanText(membership?.accountUserId)
    if (membershipId) {
      membershipIdCounts.set(membershipId, (membershipIdCounts.get(membershipId) || 0) + 1)
    }
    if (accountUserId) {
      accountUserIdCounts.set(accountUserId, (accountUserIdCounts.get(accountUserId) || 0) + 1)
    }
  })
  const hasDirectoryDuplicate = [
    ...membershipIdCounts.values(),
    ...accountUserIdCounts.values(),
  ].some((count) => count > 1)

  sourceMemberships.forEach((membership) => {
    const membershipId = cleanText(membership?.id)
    const accountUserId = cleanText(membership?.accountUserId)
    const centerId = cleanText(membership?.centerId)
    const role = cleanText(membership?.role).toLowerCase()

    if (
      !membershipId ||
      !accountUserId ||
      !centerId ||
      centerId !== currentCenterId ||
      !STAFF_ACCOUNT_ROLES.has(role) ||
      !STAFF_ACCOUNT_MEMBERSHIP_STATUSES.has(cleanText(membership?.status).toLowerCase())
    ) {
      invalid.push(membership)
      return
    }

    const membershipLookup = findStaffMemberByMembershipId(staffMembers, membershipId, currentCenterId)
    const accountLookup = findStaffMemberByAccountUserId(staffMembers, accountUserId, currentCenterId)
    const linkedElsewhere = [...membershipLookup.matches, ...accountLookup.matches].some(
      (staffMember) => staffMember.id !== currentStaffId,
    )

    if (linkedElsewhere) {
      linked.push(membership)
      return
    }

    if (isAccountMembershipActive(membership)) {
      active.push(membership)
    } else {
      inactive.push(membership)
    }
  })

  return {
    active: active.sort(compareAccountMemberships),
    inactive: inactive.sort(compareAccountMemberships),
    invalid,
    linked,
    hasMalformedDuplicate:
      hasDirectoryDuplicate || hasMalformedStaffAccountDuplicate(staffMembers, currentCenterId),
  }
}

export function isAccountMembershipActive(membership) {
  return cleanText(membership?.status).toLowerCase() === ACTIVE_MEMBERSHIP_STATUS
}

export function getStaffAccountRoleLabel(role) {
  const normalizedRole = cleanText(role).toLowerCase()
  return STAFF_ACCOUNT_ROLE_LABELS[normalizedRole] || normalizedRole || 'Chưa xác định'
}

export function getStaffTeacherAccountWarning(staffMember, membership) {
  const role = cleanText(membership?.role).toLowerCase()
  const hasTeacherProfile = Boolean(cleanText(staffMember?.teacherId))

  if (hasTeacherProfile && role && role !== 'teacher' && !ELEVATED_TEACHER_COMPATIBLE_ROLES.has(role)) {
    return 'Tài khoản hiện chưa có quyền Giáo viên.'
  }

  if (!hasTeacherProfile && role === 'teacher') {
    return 'Tài khoản có quyền Giáo viên nhưng chưa liên kết hồ sơ Giáo viên.'
  }

  return ''
}

export function linkStaffMemberToAccount(staffMember, membership, linkedAt = new Date().toISOString()) {
  return {
    ...staffMember,
    accountUserId: cleanText(membership?.accountUserId),
    membershipId: cleanText(membership?.id),
    accountLinkedAt: linkedAt,
    updatedAt: linkedAt,
  }
}

export function unlinkStaffMemberFromAccount(staffMember, updatedAt = new Date().toISOString()) {
  return {
    ...staffMember,
    accountUserId: '',
    membershipId: '',
    accountLinkedAt: '',
    updatedAt,
  }
}

export function renderStaffModule({
  staffMembers = [],
  departments = [],
  teachers = [],
  scheduleSessions = [],
  sessionReports = [],
  filters = initialStaffFilters,
  formState = null,
  isDepartmentPanelOpen = false,
  departmentFormState = null,
  accountMemberships = [],
  accountDirectoryState = {},
  accountLinkState = null,
  notice = '',
} = {}) {
  const activeFilters = normalizeStaffFilters(filters)
  const filteredStaffMembers = getFilteredStaffMembers(staffMembers, departments, activeFilters)
  const summary = buildStaffSummary(staffMembers)
  const staffData = buildStaffAttendanceData({
    teachers,
    scheduleSessions,
    sessionReports,
    filters: activeFilters,
  })

  return `
    <section class="staff-module" aria-label="Nhân viên">
      <div class="staff-toolbar">
        <div>
          <h3>Nhân viên</h3>
          <p>Hồ sơ nhân sự và phòng ban lưu local theo cơ sở. Liên kết giáo viên/tài khoản chỉ hiển thị read-only trong phase này.</p>
        </div>
        <div class="staff-toolbar-actions">
          <button type="button" data-staff-action="open-create">+ Thêm nhân viên</button>
          <button type="button" data-staff-action="open-departments">Phòng ban</button>
        </div>
      </div>

      ${notice ? `<p class="staff-notice" role="status">${escapeHtml(notice)}</p>` : ''}

      <div class="staff-filters" aria-label="Bộ lọc nhân viên">
        <label>
          <span>Tìm kiếm</span>
          <input type="search" value="${escapeAttribute(activeFilters.query)}" data-staff-filter="query" />
        </label>
        <label>
          <span>Phòng ban</span>
          <select data-staff-filter="departmentId">
            ${renderOption('all', 'Tất cả phòng ban', activeFilters.departmentId)}
            ${renderOption('none', 'Chưa có phòng ban', activeFilters.departmentId)}
            ${departments
              .map((department) => renderOption(department.id, getDepartmentDisplayName(department), activeFilters.departmentId))
              .join('')}
          </select>
        </label>
        <label>
          <span>Trạng thái</span>
          <select data-staff-filter="employmentStatus">
            ${renderOption('active', 'Đang làm việc', activeFilters.employmentStatus)}
            ${renderOption('on-leave', 'Tạm nghỉ', activeFilters.employmentStatus)}
            ${renderOption('terminated', 'Đã nghỉ việc', activeFilters.employmentStatus)}
            ${renderOption('archived', 'Đã lưu trữ', activeFilters.employmentStatus)}
            ${renderOption('all', 'Tất cả trạng thái', activeFilters.employmentStatus)}
          </select>
        </label>
        <label>
          <span>Giáo viên</span>
          <select data-staff-filter="teacherLink">
            ${renderOption('all', 'Tất cả', activeFilters.teacherLink)}
            ${renderOption('linked', 'Đã liên kết', activeFilters.teacherLink)}
            ${renderOption('unlinked', 'Chưa liên kết', activeFilters.teacherLink)}
          </select>
        </label>
        <label>
          <span>Tài khoản</span>
          <select data-staff-filter="accountLink">
            ${renderOption('all', 'Tất cả', activeFilters.accountLink)}
            ${renderOption('linked', 'Đã liên kết', activeFilters.accountLink)}
            ${renderOption('unlinked', 'Chưa liên kết', activeFilters.accountLink)}
          </select>
        </label>
      </div>

      <div class="staff-summary" aria-label="Tổng quan nhân viên">
        ${renderStaffStat('Tổng nhân viên', summary.total, 'neutral')}
        ${renderStaffStat('Đang làm việc', summary.active, 'active')}
        ${renderStaffStat('Tạm nghỉ', summary.onLeave, 'leave')}
        ${renderStaffStat('Đã nghỉ việc', summary.terminated, 'terminated')}
        ${renderStaffStat('Chưa có phòng ban', summary.noDepartment, 'location')}
      </div>

      <section class="staff-panel" aria-labelledby="staff-profile-list-title">
        <div class="staff-panel-heading">
          <h4 id="staff-profile-list-title">Hồ sơ nhân viên</h4>
          <span>${filteredStaffMembers.length.toLocaleString('vi-VN')} hồ sơ</span>
        </div>
        ${
          filteredStaffMembers.length
            ? renderStaffProfileTable(
                filteredStaffMembers,
                departments,
                teachers,
                staffMembers,
                accountMemberships,
                accountDirectoryState,
              )
            : `<div class="staff-empty"><p>Chưa có hồ sơ nhân viên.</p><button type="button" data-staff-action="open-create">+ Thêm nhân viên</button></div>`
        }
      </section>

      ${
        formState
          ? renderStaffForm(formState, departments, {
              staffMember: staffMembers.find((item) => item.id === formState.staffId) || null,
              staffMembers,
              teachers,
              accountMemberships,
              accountDirectoryState,
            })
          : ''
      }
      ${isDepartmentPanelOpen ? renderDepartmentPanel(departments, staffMembers, departmentFormState) : ''}
      ${
        accountLinkState
          ? renderStaffAccountLinkModal({
              state: accountLinkState,
              staffMember: staffMembers.find((item) => item.id === accountLinkState.staffId) || null,
              staffMembers,
              memberships: accountMemberships,
              directoryState: accountDirectoryState,
            })
          : ''
      }

      <details class="staff-attendance-details">
        <summary>Chấm công theo lịch dạy hiện có</summary>
        ${renderAttendanceSection(staffData, activeFilters)}
      </details>
    </section>
  `
}

export function buildStaffAttendanceData({
  teachers = [],
  scheduleSessions = [],
  sessionReports = [],
  filters = initialStaffFilters,
} = {}) {
  const activeFilters = normalizeStaffFilters(filters)
  const weekDays = buildWeekDays(activeFilters.weekStartDate)
  const teacherLookup = createTeacherLookup(teachers)
  const reportLookup = createSessionReportLookup(sessionReports)
  const allRows = buildAttendanceRows(scheduleSessions, weekDays, teacherLookup, reportLookup)
  const locationOptions = Array.from(new Set(allRows.map((row) => row.location).filter(Boolean))).sort(
    compareText,
  )
  const personOptions = buildPersonOptions(teachers, allRows)
  const filteredRows = allRows.filter((row) => {
    const matchesLocation = activeFilters.location === 'all' || row.location === activeFilters.location
    const matchesPerson = activeFilters.person === 'all' || row.personKey === activeFilters.person

    return matchesLocation && matchesPerson
  })
  const personRows = buildPersonRows(filteredRows)
  const topPerson = personRows[0] ?? null

  return {
    filters: activeFilters,
    weekLabel: `${formatDate(weekDays[0])} - ${formatDate(weekDays[weekDays.length - 1])}`,
    locationOptions,
    personOptions,
    attendanceRows: filteredRows,
    personRows,
    summary: {
      activePeople: personRows.length,
      totalSessions: filteredRows.length,
      locationCount: new Set(filteredRows.map((row) => row.location).filter(Boolean)).size,
      topPersonLabel: topPerson
        ? `${topPerson.personName} · ${topPerson.totalSessions.toLocaleString('vi-VN')} buổi`
        : 'Chưa có dữ liệu',
    },
  }
}

function renderStaffProfileTable(
  staffMembers,
  departments,
  teachers,
  allStaffMembers,
  accountMemberships,
  accountDirectoryState,
) {
  const departmentLookup = createDepartmentLookup(departments)
  const teacherLookup = createTeacherLookup(teachers)

  return `
    <div class="staff-table-wrap staff-profile-table-wrap">
      <table class="staff-table staff-profile-table">
        <thead>
          <tr>
            <th>Mã</th>
            <th>Họ tên</th>
            <th>Phòng ban</th>
            <th>Chức danh</th>
            <th>Loại hình</th>
            <th>Trạng thái</th>
            <th>Thời gian làm việc</th>
            <th>Giáo viên</th>
            <th>Tài khoản</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${staffMembers.map((staffMember) => renderStaffProfileRow(
            staffMember,
            departmentLookup,
            teacherLookup,
            allStaffMembers,
            accountMemberships,
            accountDirectoryState,
          )).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderStaffProfileRow(
  staffMember,
  departmentLookup,
  teacherLookup,
  staffMembers,
  accountMemberships,
  accountDirectoryState,
) {
  const department = staffMember.departmentId ? departmentLookup.get(staffMember.departmentId) : null
  const status = getEmploymentStatusMeta(staffMember.employmentStatus)
  const teacherStatus = getTeacherLinkStatus(staffMember, teacherLookup)
  const accountStatus = getStaffAccountListStatus(
    staffMember,
    staffMembers,
    accountMemberships,
    accountDirectoryState,
  )
  const isArchived = staffMember.employmentStatus === 'archived'

  return `
    <tr class="${isArchived ? 'is-archived' : ''}">
      <td title="${escapeAttribute(staffMember.employeeCode)}">${escapeHtml(staffMember.employeeCode || '—')}</td>
      <td>
        <strong title="${escapeAttribute(staffMember.fullName)}">${escapeHtml(staffMember.fullName)}</strong>
        <span title="${escapeAttribute([staffMember.phone, staffMember.email].filter(Boolean).join(' · '))}">${escapeHtml([staffMember.phone, staffMember.email].filter(Boolean).join(' · ') || 'Chưa có liên hệ')}</span>
      </td>
      <td title="${escapeAttribute(getDepartmentDisplayName(department))}">${department ? escapeHtml(getDepartmentDisplayName(department)) : 'Chưa có phòng ban'}</td>
      <td title="${escapeAttribute(staffMember.positionTitle)}">${escapeHtml(staffMember.positionTitle || '—')}</td>
      <td>${escapeHtml(getEmploymentTypeLabel(staffMember.employmentType))}</td>
      <td><span class="staff-status is-${status.tone}">${escapeHtml(status.label)}</span></td>
      <td>${escapeHtml(formatEmploymentPeriod(staffMember))}</td>
      <td>
        <span class="staff-link-status ${teacherStatus.tone}" title="${escapeAttribute(teacherStatus.title)}">${escapeHtml(teacherStatus.label)}</span>
        ${
          teacherStatus.teacherId
            ? `<div class="staff-row-actions staff-link-actions">
                <button type="button" data-staff-action="open-linked-teacher" data-teacher-id="${escapeAttribute(teacherStatus.teacherId)}">Mở hồ sơ Giáo viên</button>
                <button type="button" data-staff-action="unlink-teacher" data-staff-id="${escapeAttribute(staffMember.id)}" data-teacher-id="${escapeAttribute(teacherStatus.teacherId)}">Gỡ liên kết</button>
              </div>`
            : ''
        }
      </td>
      <td><span class="staff-link-status ${escapeAttribute(accountStatus.tone)}">${escapeHtml(accountStatus.label)}</span></td>
      <td>
        <div class="staff-row-actions">
          <button type="button" data-staff-action="open-edit" data-staff-id="${escapeAttribute(staffMember.id)}">Sửa</button>
          ${
            isArchived
              ? `<button type="button" data-staff-action="restore" data-staff-id="${escapeAttribute(staffMember.id)}">Khôi phục</button>`
              : `<button type="button" data-staff-action="archive" data-staff-id="${escapeAttribute(staffMember.id)}">Lưu trữ</button>`
          }
        </div>
      </td>
    </tr>
  `
}

function renderStaffForm(formState, departments, accountContext = {}) {
  const values = { ...emptyStaffFormValues, ...(formState.values || {}) }
  const activeDepartments = departments.filter((department) => department.status !== 'archived')
  const selectedArchivedDepartment = departments.find(
    (department) => department.id === values.departmentId && department.status === 'archived',
  )
  const departmentOptions = selectedArchivedDepartment
    ? [...activeDepartments, selectedArchivedDepartment]
    : activeDepartments
  const title = formState.mode === 'edit' ? 'Sửa hồ sơ nhân viên' : 'Thêm nhân viên'
  const employmentStatus = normalizeEmploymentStatus(values.employmentStatus)
  const endDateDisabled = !isEmploymentEndDateEnabled(employmentStatus)
  const endDateValue = endDateDisabled ? '' : values.endDate
  const endDateHint = endDateDisabled ? 'Đến nay' : ''

  return `
    <div class="staff-modal" role="presentation">
      <form class="staff-form" data-staff-form aria-labelledby="staff-form-title">
        <div class="staff-form-heading">
          <div>
            <h4 id="staff-form-title">${title}</h4>
            <p>Thông tin này không tạo tài khoản, không cấp quyền và không thay đổi hồ sơ giáo viên.</p>
          </div>
          <button type="button" data-staff-action="close-form" aria-label="Đóng">×</button>
        </div>
        ${formState.message ? `<p class="staff-form-message" role="alert">${escapeHtml(formState.message)}</p>` : ''}
        <div class="staff-form-grid">
          ${renderTextField('employeeCode', 'Mã nhân viên', values.employeeCode, formState.errors)}
          ${renderTextField('fullName', 'Họ và tên', values.fullName, formState.errors)}
          ${renderTextField('phone', 'Điện thoại', values.phone, formState.errors, 'tel')}
          ${renderTextField('email', 'Email', values.email, formState.errors, 'email')}
          <label>
            <span>Phòng ban</span>
            <select data-staff-form-field="departmentId">
              ${renderOption('', 'Chưa có phòng ban', values.departmentId)}
              ${departmentOptions.map((department) => renderOption(department.id, getDepartmentDisplayName(department), values.departmentId)).join('')}
            </select>
            ${renderFieldError(formState.errors.departmentId)}
          </label>
          ${renderTextField('positionTitle', 'Chức danh', values.positionTitle, formState.errors)}
          <label>
            <span>Loại hình làm việc</span>
            <select data-staff-form-field="employmentType">
              ${STAFF_EMPLOYMENT_TYPES.map((item) => renderOption(item.value, item.label, values.employmentType)).join('')}
            </select>
            ${renderFieldError(formState.errors.employmentType)}
          </label>
          <label>
            <span>Trạng thái làm việc</span>
            <select data-staff-form-field="employmentStatus">
              ${STAFF_EMPLOYMENT_STATUSES.map((item) => renderOption(item.value, item.label, values.employmentStatus)).join('')}
            </select>
            ${renderFieldError(formState.errors.employmentStatus)}
          </label>
          ${renderTextField('startDate', 'Ngày bắt đầu', values.startDate, formState.errors, 'date')}
          ${renderTextField('endDate', 'Ngày kết thúc', endDateValue, formState.errors, 'date', 'data-staff-form-field', {
            disabled: endDateDisabled,
            placeholder: endDateHint,
            hint: endDateHint,
          })}
          <label class="staff-form-wide">
            <span>Ghi chú</span>
            <textarea data-staff-form-field="note" rows="3">${escapeHtml(values.note)}</textarea>
            ${renderFieldError(formState.errors.note)}
          </label>
        </div>
        ${renderStaffAccountCard({ formState, ...accountContext })}
        <div class="staff-readonly-links" aria-label="Trạng thái liên kết read-only">
          <span>Hồ sơ Giáo viên: ${formState.links?.hasTeacherLink ? 'Đã liên kết' : 'Chưa liên kết'}</span>
          <span>Tài khoản: ${formState.links?.hasAccountLink ? 'Đã liên kết' : 'Chưa liên kết'}</span>
        </div>
        <div class="staff-form-actions">
          <button type="button" data-staff-action="close-form">Hủy</button>
          <button type="submit" data-staff-action="save" ${formState.isSaving ? 'disabled' : ''}>Lưu hồ sơ</button>
        </div>
      </form>
    </div>
  `
}

function renderStaffAccountCard({
  formState,
  staffMember,
  staffMembers = [],
  teachers = [],
  accountMemberships = [],
  accountDirectoryState = {},
} = {}) {
  const hasStoredLink = Boolean(staffMember?.accountUserId || staffMember?.membershipId)
  const isDirectoryLoading = ['idle', 'loading'].includes(accountDirectoryState.status)
  const isDirectoryUnavailable = accountDirectoryState.status === 'error'
  const currentCenterId = accountDirectoryState.centerId || staffMember?.centerId || ''

  if (formState.mode !== 'edit' || !staffMember) {
    return `
      <section class="staff-account-card" aria-labelledby="staff-account-card-title">
        <div class="staff-account-card-heading">
          <h5 id="staff-account-card-title">Tài khoản và quyền</h5>
          <span class="staff-link-status is-unlinked">Chưa liên kết</span>
        </div>
        <dl class="staff-account-meta">
          ${renderStaffAccountMetaRow('Tài khoản', 'Chưa liên kết')}
          ${renderStaffAccountMetaRow('Quyền hệ thống', 'Chưa có')}
        </dl>
        <p class="staff-account-note">Lưu hồ sơ nhân viên trước khi liên kết tài khoản hiện hữu.</p>
      </section>
    `
  }

  if (isDirectoryLoading) {
    return `
      <section class="staff-account-card" aria-labelledby="staff-account-card-title">
        <div class="staff-account-card-heading">
          <h5 id="staff-account-card-title">Tài khoản và quyền</h5>
          <span class="staff-link-status ${hasStoredLink ? 'is-linked' : 'is-unlinked'}">${hasStoredLink ? 'Đã lưu liên kết' : 'Chưa liên kết'}</span>
        </div>
        <p class="staff-account-note" role="status">Đang đọc account và membership mới nhất...</p>
      </section>
    `
  }

  if (isDirectoryUnavailable) {
    return `
      <section class="staff-account-card" aria-labelledby="staff-account-card-title">
        <div class="staff-account-card-heading">
          <h5 id="staff-account-card-title">Tài khoản và quyền</h5>
          <span class="staff-link-status is-warning">Chưa đọc được quyền</span>
        </div>
        ${
          hasStoredLink
            ? ''
            : `<dl class="staff-account-meta">
                ${renderStaffAccountMetaRow('Tài khoản', 'Chưa liên kết')}
                ${renderStaffAccountMetaRow('Quyền hệ thống', 'Chưa có')}
              </dl>`
        }
        <p class="staff-account-warning" role="alert">${escapeHtml(accountDirectoryState.error || 'Không đọc được dữ liệu account/membership hiện tại.')}</p>
        <button type="button" data-staff-account-action="reload-directory">Tải lại</button>
      </section>
    `
  }

  const link = resolveStaffAccountLink({
    staffMember,
    staffMembers,
    memberships: accountMemberships,
    currentCenterId,
  })

  if (link.status === 'unlinked') {
    const canLink = staffMember.employmentStatus !== 'archived'
    return `
      <section class="staff-account-card" aria-labelledby="staff-account-card-title">
        <div class="staff-account-card-heading">
          <h5 id="staff-account-card-title">Tài khoản và quyền</h5>
          <span class="staff-link-status is-unlinked">Chưa liên kết</span>
        </div>
        <dl class="staff-account-meta">
          ${renderStaffAccountMetaRow('Tài khoản', 'Chưa liên kết')}
          ${renderStaffAccountMetaRow('Quyền hệ thống', 'Chưa có')}
        </dl>
        ${
          canLink
            ? `<button type="button" data-staff-account-action="open-link" data-staff-id="${escapeAttribute(staffMember.id)}">Liên kết tài khoản</button>`
            : '<p class="staff-account-note">Hồ sơ đã lưu trữ không nhận liên kết tài khoản mới.</p>'
        }
      </section>
    `
  }

  if (link.status === 'malformed') {
    return `
      <section class="staff-account-card is-warning" aria-labelledby="staff-account-card-title">
        <div class="staff-account-card-heading">
          <h5 id="staff-account-card-title">Tài khoản và quyền</h5>
          <span class="staff-link-status is-warning">Cần kiểm tra</span>
        </div>
        <strong>Liên kết tài khoản cần kiểm tra</strong>
        <p class="staff-account-warning" role="alert">${escapeHtml(link.reason)}</p>
        <p class="staff-account-note">Hệ thống không tự sửa hoặc tự gỡ reference đang lưu.</p>
      </section>
    `
  }

  const membership = link.membership
  const teacherWarning = getStaffTeacherAccountWarning(staffMember, membership)
  const teacher = staffMember.teacherId
    ? teachers.find((item) => item.id === staffMember.teacherId)
    : null
  const roleLabel = getStaffAccountRoleLabel(membership.role)

  return `
    <section class="staff-account-card ${link.status === 'linked-inactive' ? 'is-warning' : ''}" aria-labelledby="staff-account-card-title">
      <div class="staff-account-card-heading">
        <h5 id="staff-account-card-title">Tài khoản và quyền</h5>
        <span class="staff-link-status ${link.status === 'linked' ? 'is-linked' : 'is-warning'}">${link.status === 'linked' ? 'Đã liên kết' : 'Membership không hoạt động'}</span>
      </div>
      <dl class="staff-account-meta">
        ${renderStaffAccountMetaRow('Email đăng nhập', membership.email || 'Chưa có dữ liệu email')}
        ${membership.displayName ? renderStaffAccountMetaRow('Tên hiển thị', membership.displayName) : ''}
        ${renderStaffAccountMetaRow('Trạng thái tài khoản', getStaffAccountStatusLabel(membership.accountStatus))}
        ${renderStaffAccountMetaRow('Trạng thái membership', getStaffMembershipStatusLabel(membership.status))}
        ${renderStaffAccountMetaRow('Cơ sở', accountDirectoryState.centerName || membership.centerId || 'Chưa xác định')}
        ${renderStaffAccountMetaRow('Quyền hệ thống', `${roleLabel} (${membership.role || 'unknown'})`)}
        ${renderStaffAccountMetaRow('Chức danh', staffMember.positionTitle || 'Chưa cập nhật')}
        ${staffMember.accountLinkedAt ? renderStaffAccountMetaRow('Liên kết lúc', formatAccountLinkedAt(staffMember.accountLinkedAt)) : ''}
        ${staffMember.teacherId ? renderStaffAccountMetaRow('Hồ sơ Giáo viên', teacher ? 'Đã liên kết' : 'Liên kết cần kiểm tra') : ''}
      </dl>
      ${link.reason ? `<p class="staff-account-warning">${escapeHtml(link.reason)}</p>` : ''}
      ${teacherWarning ? `<p class="staff-account-warning">${escapeHtml(teacherWarning)}</p>` : ''}
      <div class="staff-account-actions">
        <button type="button" data-staff-account-action="open-management" data-staff-id="${escapeAttribute(staffMember.id)}">Mở quản lý tài khoản</button>
        <button type="button" data-staff-account-action="unlink" data-staff-id="${escapeAttribute(staffMember.id)}">Gỡ liên kết tài khoản</button>
      </div>
    </section>
  `
}

function renderStaffAccountLinkModal({
  state,
  staffMember,
  staffMembers,
  memberships,
  directoryState,
}) {
  const availability = getAvailableStaffAccountMemberships({
    memberships,
    staffMembers,
    currentStaffId: state.staffId,
    currentCenterId: state.centerId,
  })
  const selectedMembership = memberships.find(
    (membership) => membership.id === state.selectedMembershipId,
  )

  return `
    <div class="staff-account-modal" role="presentation">
      <section class="staff-account-window" role="dialog" aria-modal="true" aria-labelledby="staff-account-link-title">
        <div class="staff-form-heading">
          <div>
            <h4 id="staff-account-link-title">Liên kết tài khoản</h4>
            <p>Nhân viên: ${escapeHtml(getStaffDisplayLabel(staffMember))}</p>
          </div>
          <button type="button" data-staff-account-action="close-link" aria-label="Đóng">×</button>
        </div>
        ${state.message ? `<p class="staff-form-message" role="alert">${escapeHtml(state.message)}</p>` : ''}
        ${
          directoryState.status === 'loading'
            ? '<p class="staff-account-note" role="status">Đang tải membership mới nhất...</p>'
            : directoryState.status === 'error'
              ? `<p class="staff-account-warning" role="alert">${escapeHtml(directoryState.error || 'Không đọc được membership.')}</p>`
              : renderStaffAccountMembershipPicker(availability, selectedMembership, state, staffMember, directoryState)
        }
        <div class="staff-account-actions">
          <button type="button" data-staff-account-action="reload-directory" ${state.isSaving ? 'disabled' : ''}>Tải lại</button>
          <button type="button" data-staff-account-action="close-link" ${state.isSaving ? 'disabled' : ''}>Hủy</button>
        </div>
      </section>
    </div>
  `
}

function renderStaffAccountMembershipPicker(
  availability,
  selectedMembership,
  state,
  staffMember,
  directoryState,
) {
  if (availability.hasMalformedDuplicate) {
    return '<p class="staff-account-warning" role="alert">Liên kết tài khoản cần kiểm tra: đang có account hoặc membership được gắn với nhiều hồ sơ nhân viên. Không thể tạo liên kết mới.</p>'
  }

  if (selectedMembership) {
    const canConfirmSelectedMembership = isAccountMembershipActive(selectedMembership)
    return `
      <section class="staff-account-confirm" aria-label="Xác nhận liên kết tài khoản">
        <h5>Xác nhận liên kết</h5>
        <dl class="staff-account-meta">
          ${renderStaffAccountMetaRow('Nhân viên', getStaffDisplayLabel(staffMember))}
          ${renderStaffAccountMetaRow('Tài khoản', selectedMembership.email || 'Chưa có dữ liệu email')}
          ${renderStaffAccountMetaRow('Quyền hệ thống', getStaffAccountRoleLabel(selectedMembership.role))}
          ${renderStaffAccountMetaRow('Trạng thái membership', getStaffMembershipStatusLabel(selectedMembership.status))}
          ${renderStaffAccountMetaRow('Cơ sở', directoryState.centerName || selectedMembership.centerId)}
        </dl>
        ${canConfirmSelectedMembership ? '' : '<p class="staff-account-warning" role="alert">Membership hiện không hoạt động</p>'}
        <p class="staff-account-note">Chỉ reference stable ID được lưu trên hồ sơ Nhân viên. Account, membership và role không bị thay đổi.</p>
        <div class="staff-account-actions">
          <button type="button" data-staff-account-action="cancel-confirm" ${state.isSaving ? 'disabled' : ''}>Quay lại</button>
          <button type="button" data-staff-account-action="confirm-link" ${state.isSaving || !canConfirmSelectedMembership ? 'disabled' : ''}>${state.isSaving ? 'Đang liên kết...' : 'Liên kết tài khoản'}</button>
        </div>
      </section>
    `
  }

  return `
    <label class="staff-account-search">
      <span>Tìm theo email hoặc tên hiển thị</span>
      <input type="search" value="${escapeAttribute(state.query || '')}" data-staff-account-query />
    </label>
    ${availability.invalid.length ? `<p class="staff-account-warning">${availability.invalid.length.toLocaleString('vi-VN')} membership thiếu stable ID hoặc sai cơ sở đã bị loại khỏi danh sách.</p>` : ''}
    ${renderStaffAccountMembershipSection('Membership đang hoạt động', availability.active, true)}
    ${renderStaffAccountMembershipSection('Membership không hoạt động', availability.inactive, false)}
    ${
      !availability.active.length && !availability.inactive.length
        ? '<p class="staff-account-note">Không có account/membership current center chưa liên kết với hồ sơ nhân viên khác.</p>'
        : ''
    }
  `
}

function renderStaffAccountMembershipSection(title, memberships, canLink) {
  if (!memberships.length) {
    return ''
  }

  return `
    <section class="staff-account-membership-section">
      <h5>${escapeHtml(title)}</h5>
      <div class="staff-account-membership-list">
        ${memberships.map((membership) => renderStaffAccountMembershipOption(membership, canLink)).join('')}
      </div>
    </section>
  `
}

function renderStaffAccountMembershipOption(membership, canLink) {
  const searchText = normalizeSearchText([membership.email, membership.displayName].filter(Boolean).join(' '))
  return `
    <article class="staff-account-membership-option" data-staff-account-option data-account-search-text="${escapeAttribute(searchText)}">
      <div>
        <strong>${escapeHtml(membership.email || 'Chưa có dữ liệu email')}</strong>
        <span>${escapeHtml([membership.displayName, getStaffAccountRoleLabel(membership.role)].filter(Boolean).join(' · '))}</span>
        <small>Membership: ${escapeHtml(getStaffMembershipStatusLabel(membership.status))} · Tài khoản: ${escapeHtml(getStaffAccountStatusLabel(membership.accountStatus))}</small>
        ${canLink ? '' : '<small class="staff-account-warning">Membership hiện không hoạt động</small>'}
      </div>
      <button type="button" data-staff-account-action="select-membership" data-membership-id="${escapeAttribute(membership.id)}" ${canLink ? '' : 'disabled'}>${canLink ? 'Chọn' : 'Không thể liên kết'}</button>
    </article>
  `
}

function renderStaffAccountMetaRow(label, value) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`
}

function renderDepartmentPanel(departments, staffMembers, departmentFormState) {
  return `
    <div class="staff-modal" role="presentation">
      <section class="staff-department-panel" aria-labelledby="staff-department-title">
        <div class="staff-form-heading">
          <div>
            <h4 id="staff-department-title">Phòng ban</h4>
            <p>Quản lý phòng ban local theo cơ sở. Lưu trữ phòng ban không xóa liên kết nhân viên cũ.</p>
          </div>
          <button type="button" data-staff-department-action="close" aria-label="Đóng">×</button>
        </div>
        <button type="button" class="staff-inline-primary" data-staff-department-action="open-create">+ Thêm phòng ban</button>
        ${departmentFormState ? renderDepartmentForm(departmentFormState) : ''}
        ${
          departments.length
            ? renderDepartmentTable(departments, staffMembers)
            : '<p class="staff-empty">Chưa có phòng ban.</p>'
        }
      </section>
    </div>
  `
}

function renderDepartmentForm(formState) {
  const values = { ...emptyDepartmentFormValues, ...(formState.values || {}) }
  const title = formState.mode === 'edit' ? 'Sửa phòng ban' : 'Thêm phòng ban'

  return `
    <form class="staff-department-form" data-staff-department-form aria-label="${escapeAttribute(title)}">
      <strong>${title}</strong>
      ${formState.message ? `<p class="staff-form-message" role="alert">${escapeHtml(formState.message)}</p>` : ''}
      ${renderTextField('name', 'Tên phòng ban', values.name, formState.errors, 'text', 'data-staff-department-field')}
      ${renderTextField('code', 'Mã', values.code, formState.errors, 'text', 'data-staff-department-field')}
      ${renderTextField('sortOrder', 'Thứ tự hiển thị', values.sortOrder, formState.errors, 'number', 'data-staff-department-field')}
      <label>
        <span>Mô tả</span>
        <textarea data-staff-department-field="description" rows="2">${escapeHtml(values.description)}</textarea>
        ${renderFieldError(formState.errors.description)}
      </label>
      <div class="staff-form-actions">
        <button type="button" data-staff-department-action="cancel-form">Hủy</button>
        <button type="submit" data-staff-department-action="save" ${formState.isSaving ? 'disabled' : ''}>Lưu phòng ban</button>
      </div>
    </form>
  `
}

function renderDepartmentTable(departments, staffMembers) {
  return `
    <div class="staff-table-wrap">
      <table class="staff-table staff-department-table">
        <thead>
          <tr>
            <th>Tên</th>
            <th>Mã</th>
            <th>Mô tả</th>
            <th>Trạng thái</th>
            <th>Nhân viên</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${departments
            .slice()
            .sort((first, second) => Number(first.sortOrder || 0) - Number(second.sortOrder || 0) || compareText(first.name, second.name))
            .map((department) => renderDepartmentRow(department, staffMembers))
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderDepartmentRow(department, staffMembers) {
  const referencedCount = staffMembers.filter((staffMember) => staffMember.departmentId === department.id).length
  const isArchived = department.status === 'archived'

  return `
    <tr class="${isArchived ? 'is-archived' : ''}">
      <td><strong title="${escapeAttribute(department.name)}">${escapeHtml(department.name)}</strong></td>
      <td title="${escapeAttribute(department.code)}">${escapeHtml(department.code || '—')}</td>
      <td title="${escapeAttribute(department.description)}">${escapeHtml(department.description || '—')}</td>
      <td><span class="staff-status is-${isArchived ? 'archived' : 'active'}">${escapeHtml(isArchived ? 'Đã lưu trữ' : 'Đang hoạt động')}</span></td>
      <td>${referencedCount.toLocaleString('vi-VN')}</td>
      <td>
        <div class="staff-row-actions">
          <button type="button" data-staff-department-action="open-edit" data-department-id="${escapeAttribute(department.id)}">Sửa</button>
          ${
            isArchived
              ? `<button type="button" data-staff-department-action="restore" data-department-id="${escapeAttribute(department.id)}">Khôi phục</button>`
              : `<button type="button" data-staff-department-action="archive" data-department-id="${escapeAttribute(department.id)}">Lưu trữ</button>`
          }
        </div>
      </td>
    </tr>
  `
}

function renderAttendanceSection(staffData, activeFilters) {
  return `
    <div class="staff-attendance-section">
      <div class="staff-filters staff-attendance-filters" aria-label="Bộ lọc chấm công nhân viên">
        <label>
          <span>Tuần hiện tại</span>
          <input type="date" value="${escapeAttribute(activeFilters.weekStartDate)}" data-staff-filter="weekStartDate" />
        </label>
        <label>
          <span>Địa điểm dạy</span>
          <select data-staff-filter="location">
            ${renderOption('all', 'Tất cả địa điểm', activeFilters.location)}
            ${staffData.locationOptions.map((location) => renderOption(location, location, activeFilters.location)).join('')}
          </select>
        </label>
        <label>
          <span>Nhân sự / Giáo viên</span>
          <select data-staff-filter="person">
            ${renderOption('all', 'Tất cả nhân sự', activeFilters.person)}
            ${staffData.personOptions.map((person) => renderOption(person.key, person.name, activeFilters.person)).join('')}
          </select>
        </label>
      </div>
      <div class="staff-summary" aria-label="Tổng quan chấm công">
        ${renderStaffStat('Nhân sự hoạt động', staffData.summary.activePeople, 'neutral')}
        ${renderStaffStat('Tổng buổi trong kỳ', staffData.summary.totalSessions, 'sessions')}
        ${renderStaffStat('Địa điểm dạy', staffData.summary.locationCount, 'location')}
        ${renderStaffStat('Hoạt động nhiều nhất', staffData.summary.topPersonLabel, 'top')}
      </div>
      <div class="staff-layout">
        <section class="staff-panel" aria-labelledby="staff-summary-table-title">
          <div class="staff-panel-heading">
            <h4 id="staff-summary-table-title">Tổng buổi theo nhân sự</h4>
            <span>${escapeHtml(staffData.weekLabel)}</span>
          </div>
          ${staffData.personRows.length ? renderStaffPersonTable(staffData.personRows) : `<p class="staff-empty">${emptyAttendanceStateText}</p>`}
        </section>
        <section class="staff-panel" aria-labelledby="staff-attendance-table-title">
          <div class="staff-panel-heading">
            <h4 id="staff-attendance-table-title">Bảng chấm công</h4>
            <span>${attendanceStatuses.join(' · ')}</span>
          </div>
          ${staffData.attendanceRows.length ? renderStaffAttendanceTable(staffData.attendanceRows) : `<p class="staff-empty">${emptyAttendanceStateText}</p>`}
        </section>
      </div>
    </div>
  `
}

function buildAttendanceRows(scheduleSessions, weekDays, teacherLookup, reportLookup) {
  return (Array.isArray(scheduleSessions) ? scheduleSessions : [])
    .flatMap((session) => expandSessionToWeekRows(session, weekDays))
    .filter((row) => row.personName || row.teacherId)
    .map((row) => {
      const teacher = row.teacherId ? teacherLookup.get(String(row.teacherId)) : null
      const personName = getTeacherDisplayName(teacher) || row.personName || 'Chưa rõ giáo viên'
      const personKey = row.teacherId ? `teacher:${row.teacherId}` : `name:${normalizeSearchText(personName)}`
      const report = reportLookup.get(`${row.sessionId}:${row.date}`)

      return {
        ...row,
        personName,
        personKey,
        status: getAttendanceStatus(row, report),
        note: report?.classSituation || report?.teachingAssistantNotes || row.note || '—',
      }
    })
    .sort(
      (firstRow, secondRow) =>
        String(firstRow.date).localeCompare(String(secondRow.date)) ||
        String(firstRow.startTime).localeCompare(String(secondRow.startTime)) ||
        compareText(firstRow.personName, secondRow.personName),
    )
}

function expandSessionToWeekRows(session, weekDays) {
  if (!session || session.status === 'archived') {
    return []
  }

  if (session.scheduleType === 'oneOff') {
    const date = String(session.date ?? '').slice(0, 10)

    if (!weekDays.includes(date)) {
      return []
    }

    return [buildAttendanceRow(session, date)]
  }

  return weekDays
    .filter((date) => {
      if (getDayOfWeekId(date) !== session.dayOfWeek) {
        return false
      }

      const startDate = String(session.startDate ?? '')
      const endDate = String(session.endDate ?? '')

      return (!startDate || date >= startDate) && (!endDate || date <= endDate)
    })
    .map((date) => buildAttendanceRow(session, date))
}

function buildAttendanceRow(session, date) {
  return {
    id: `${session.id}-${date}`,
    sessionId: session.id,
    date,
    teacherId: String(session.teacherId || ''),
    personName: String(session.teacherName || ''),
    location: String(session.room || 'Chưa có địa điểm'),
    className: session.title || session.groupName || 'Ca dạy',
    startTime: session.startTime || '',
    endTime: session.endTime || '',
    scheduleStatus: session.status || 'scheduled',
    occurrenceReason: session.occurrenceReason || '',
    note: session.note || '',
  }
}

function buildPersonRows(attendanceRows) {
  const rowMap = new Map()

  attendanceRows.forEach((row) => {
    if (!rowMap.has(row.personKey)) {
      rowMap.set(row.personKey, {
        personName: row.personName,
        locations: new Set(),
        totalSessions: 0,
        latestSession: '',
        notes: new Set(),
      })
    }

    const item = rowMap.get(row.personKey)
    item.locations.add(row.location)
    item.totalSessions += 1
    item.latestSession = !item.latestSession || row.date > item.latestSession ? row.date : item.latestSession

    if (row.status === 'Chưa chấm') {
      item.notes.add('Có buổi chưa chấm')
    }
  })

  return Array.from(rowMap.values())
    .map((item) => ({
      ...item,
      locations: Array.from(item.locations).sort(compareText),
      note: item.notes.size ? Array.from(item.notes).join(', ') : 'Theo ca dạy hiện có',
    }))
    .sort(
      (firstRow, secondRow) =>
        secondRow.totalSessions - firstRow.totalSessions ||
        compareText(firstRow.personName, secondRow.personName),
    )
}

function buildPersonOptions(teachers, attendanceRows) {
  const optionMap = new Map()

  ;(teachers ?? []).forEach((teacher) => {
    const teacherName = getTeacherDisplayName(teacher)

    if (teacher?.id && teacherName) {
      optionMap.set(`teacher:${teacher.id}`, teacherName)
    }
  })

  attendanceRows.forEach((row) => {
    optionMap.set(row.personKey, row.personName)
  })

  return Array.from(optionMap, ([key, name]) => ({ key, name })).sort((first, second) =>
    compareText(first.name, second.name),
  )
}

function renderStaffPersonTable(rows) {
  return `
    <div class="staff-table-wrap">
      <table class="staff-table">
        <thead>
          <tr>
            <th>Nhân sự</th>
            <th>Địa điểm dạy</th>
            <th>Tổng buổi</th>
            <th>Buổi gần nhất</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.personName)}</td>
                  <td>${escapeHtml(row.locations.join(', ') || 'Chưa có địa điểm')}</td>
                  <td><strong>${row.totalSessions.toLocaleString('vi-VN')}</strong></td>
                  <td>${formatDate(row.latestSession)}</td>
                  <td>${escapeHtml(row.note)}</td>
                </tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderStaffAttendanceTable(rows) {
  return `
    <div class="staff-table-wrap staff-attendance-table-wrap">
      <table class="staff-table staff-attendance-table">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Nhân sự/Giáo viên</th>
            <th>Địa điểm dạy</th>
            <th>Ca/Lớp</th>
            <th>Trạng thái</th>
            <th>Ghi chú</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(renderStaffAttendanceRow).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderStaffAttendanceRow(row) {
  return `
    <tr>
      <td>
        <strong>${formatDate(row.date)}</strong>
        <span>${escapeHtml(formatTimeRange(row))}</span>
      </td>
      <td>${escapeHtml(row.personName)}</td>
      <td>${escapeHtml(row.location)}</td>
      <td>${escapeHtml(row.className)}</td>
      <td><span class="staff-status is-${getAttendanceStatusTone(row.status)}">${escapeHtml(row.status)}</span></td>
      <td title="${escapeAttribute(row.note)}">${escapeHtml(row.note)}</td>
    </tr>
  `
}

function renderTextField(name, label, value, errors, type = 'text', attributeName = 'data-staff-form-field', options = {}) {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input type="${escapeAttribute(type)}" value="${escapeAttribute(value)}" ${attributeName}="${escapeAttribute(name)}"${options.disabled ? ' disabled' : ''}${options.placeholder ? ` placeholder="${escapeAttribute(options.placeholder)}"` : ''} />
      ${options.hint ? `<small class="staff-field-hint">${escapeHtml(options.hint)}</small>` : ''}
      ${renderFieldError(errors?.[name])}
    </label>
  `
}

function renderFieldError(error) {
  return error ? `<small class="staff-field-error">${escapeHtml(error)}</small>` : ''
}

function renderStaffStat(label, value, tone) {
  return `
    <article class="staff-stat is-${tone}">
      <span>${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `
}

function buildStaffSummary(staffMembers) {
  const list = Array.isArray(staffMembers) ? staffMembers : []
  return {
    total: list.length,
    active: list.filter((item) => item.employmentStatus === 'active').length,
    onLeave: list.filter((item) => item.employmentStatus === 'on-leave').length,
    terminated: list.filter((item) => item.employmentStatus === 'terminated').length,
    noDepartment: list.filter((item) => item.employmentStatus !== 'archived' && !item.departmentId).length,
  }
}

function getAttendanceStatus(row, report) {
  if (row.scheduleStatus === 'cancelled') {
    return 'Vắng'
  }

  if (row.occurrenceReason === 'makeup') {
    return 'Dạy bù'
  }

  if (report) {
    return 'Có mặt'
  }

  return 'Chưa chấm'
}

function getAttendanceStatusTone(status) {
  const tones = {
    'Có mặt': 'present',
    Vắng: 'absent',
    'Dạy bù': 'makeup',
    'Nghỉ phép': 'leave',
    'Chưa chấm': 'pending',
  }

  return tones[status] ?? 'pending'
}

function getTeacherLinkStatus(staffMember, teacherLookup) {
  if (!staffMember.teacherId) {
    return { label: 'Chưa liên kết', tone: 'is-unlinked', title: 'Chưa liên kết hồ sơ Giáo viên', teacherId: '' }
  }

  const teacher = teacherLookup.get(String(staffMember.teacherId))

  if (!teacher) {
    return {
      label: 'Liên kết Giáo viên không hợp lệ',
      tone: 'is-warning',
      title: 'Không tìm thấy hồ sơ Giáo viên tương ứng trong cơ sở hiện tại.',
      teacherId: staffMember.teacherId,
    }
  }

  const teacherName = getTeacherDisplayName(teacher) || 'Giáo viên'
  return {
    label: `Đã liên kết · ${teacherName}`,
    tone: 'is-linked',
    title: teacherName,
    teacherId: staffMember.teacherId,
  }
}

function createTeacherLookup(teachers) {
  return new Map((teachers ?? []).map((teacher) => [String(teacher.id), teacher]))
}

function createDepartmentLookup(departments) {
  return new Map((departments ?? []).map((department) => [String(department.id), department]))
}

function createSessionReportLookup(sessionReports) {
  return new Map(
    (sessionReports ?? []).map((report) => [
      `${report.sessionId}:${report.occurrenceDate || report.date}`,
      report,
    ]),
  )
}

function normalizeStaffFilters(filters = {}) {
  return {
    ...initialStaffFilters,
    ...filters,
    query: String(filters.query || ''),
    departmentId: String(filters.departmentId || 'all'),
    employmentStatus: String(filters.employmentStatus || 'active'),
    teacherLink: String(filters.teacherLink || 'all'),
    accountLink: String(filters.accountLink || 'all'),
    weekStartDate: isDateKey(filters.weekStartDate)
      ? getWeekStartDate(filters.weekStartDate)
      : getWeekStartDate(getTodayDate()),
    location: String(filters.location || 'all'),
    person: String(filters.person || 'all'),
  }
}

function normalizeEmploymentType(value) {
  return STAFF_EMPLOYMENT_TYPES.some((item) => item.value === value) ? value : 'unspecified'
}

function normalizeEmploymentStatus(value) {
  return STAFF_EMPLOYMENT_STATUSES.some((item) => item.value === value) ? value : 'active'
}

function getEmploymentTypeLabel(value) {
  return STAFF_EMPLOYMENT_TYPES.find((item) => item.value === value)?.label || 'Chưa xác định'
}

function getEmploymentStatusMeta(value) {
  return STAFF_EMPLOYMENT_STATUSES.find((item) => item.value === value) || STAFF_EMPLOYMENT_STATUSES[0]
}

function isEmploymentEndDateEnabled(employmentStatus) {
  return normalizeEmploymentStatus(employmentStatus) === 'terminated'
}

function getCenterScopedStaffMembers(staffMembers, currentCenterId) {
  return (Array.isArray(staffMembers) ? staffMembers : []).filter((staffMember) =>
    !currentCenterId || !staffMember?.centerId || cleanText(staffMember.centerId) === currentCenterId,
  )
}

function createStaffAccountReverseLookup(matches) {
  return {
    status: matches.length > 1 ? 'duplicate' : matches.length === 1 ? 'linked' : 'unlinked',
    staffMember: matches.length === 1 ? matches[0] : null,
    matches,
  }
}

function createStaffAccountLinkResult(status, membership = null, reason = '') {
  return { status, membership, reason }
}

function hasMalformedStaffAccountDuplicate(staffMembers, currentCenterId) {
  const membershipCounts = new Map()
  const accountCounts = new Map()

  getCenterScopedStaffMembers(staffMembers, currentCenterId).forEach((staffMember) => {
    const membershipId = cleanText(staffMember?.membershipId)
    const accountUserId = cleanText(staffMember?.accountUserId)

    if (membershipId) {
      membershipCounts.set(membershipId, (membershipCounts.get(membershipId) || 0) + 1)
    }
    if (accountUserId) {
      accountCounts.set(accountUserId, (accountCounts.get(accountUserId) || 0) + 1)
    }
  })

  return [...membershipCounts.values(), ...accountCounts.values()].some((count) => count > 1)
}

function compareAccountMemberships(first, second) {
  return compareText(first.displayName || first.email, second.displayName || second.email) ||
    compareText(first.email, second.email)
}

function getStaffAccountListStatus(
  staffMember,
  staffMembers,
  memberships,
  directoryState,
) {
  const hasStoredLink = Boolean(staffMember.accountUserId || staffMember.membershipId)
  if (!hasStoredLink) {
    return { label: 'Chưa liên kết', tone: 'is-unlinked' }
  }

  if (directoryState.status !== 'loaded') {
    return { label: 'Đã lưu liên kết', tone: 'is-linked' }
  }

  const link = resolveStaffAccountLink({
    staffMember,
    staffMembers,
    memberships,
    currentCenterId: directoryState.centerId,
  })

  if (link.status === 'malformed') {
    return { label: 'Liên kết cần kiểm tra', tone: 'is-warning' }
  }

  if (link.status === 'linked-inactive') {
    return { label: 'Đã liên kết · Không hoạt động', tone: 'is-warning' }
  }

  return { label: 'Đã liên kết', tone: 'is-linked' }
}

function getStaffMembershipStatusLabel(status) {
  const labels = {
    active: 'Đang hoạt động',
    revoked: 'Đã thu hồi',
    paused: 'Tạm dừng',
    disabled: 'Đã vô hiệu hóa',
    inactive: 'Không hoạt động',
    suspended: 'Tạm khóa',
  }
  const normalizedStatus = cleanText(status).toLowerCase()
  return labels[normalizedStatus] || normalizedStatus || 'Chưa xác định'
}

function getStaffAccountStatusLabel(status) {
  const labels = {
    active: 'Đang hoạt động',
    disabled: 'Đã vô hiệu hóa',
    banned: 'Đã khóa',
    unknown: 'Chưa có dữ liệu',
  }
  const normalizedStatus = cleanText(status).toLowerCase()
  return labels[normalizedStatus] || normalizedStatus || 'Chưa có dữ liệu'
}

function getStaffDisplayLabel(staffMember) {
  if (!staffMember) {
    return 'Không tìm thấy hồ sơ nhân viên'
  }

  return [staffMember.employeeCode, staffMember.fullName].filter(Boolean).join(' · ') || 'Nhân viên'
}

function formatAccountLinkedAt(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Chưa xác định'
    : new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
}

function getPersistedEmploymentEndDate(endDate, employmentStatus, existingEndDate = '') {
  const normalizedStatus = normalizeEmploymentStatus(employmentStatus)

  if (normalizedStatus === 'terminated') {
    return isDateKey(endDate) ? endDate : ''
  }

  if (normalizedStatus === 'archived') {
    return isDateKey(endDate) ? endDate : isDateKey(existingEndDate) ? existingEndDate : ''
  }

  return ''
}

function formatEmploymentPeriod(staffMember) {
  const status = normalizeEmploymentStatus(staffMember?.employmentStatus)
  const startDate = formatDate(staffMember?.startDate)

  if (status === 'active' || status === 'on-leave') {
    return `${startDate} → Đến nay`
  }

  if (status === 'terminated') {
    const endDate = formatDate(staffMember?.endDate)
    return `${startDate} → ${endDate === '—' ? 'Chưa cập nhật' : endDate}`
  }

  const archivedEndDate = formatDate(staffMember?.endDate)
  return `${startDate} → ${archivedEndDate === '—' ? 'Chưa cập nhật' : archivedEndDate}`
}

function getDepartmentDisplayName(department) {
  if (!department) {
    return ''
  }

  return department.status === 'archived' ? `${department.name} · Đã lưu trữ` : department.name
}

function hasDuplicateEmployeeCode(staffMembers, employeeCode, currentStaffId = null) {
  const normalizedCode = normalizeSearchText(employeeCode)
  return (staffMembers ?? []).some((staffMember) =>
    staffMember.id !== currentStaffId &&
    normalizeSearchText(staffMember.employeeCode) === normalizedCode,
  )
}

function hasDuplicateDepartmentName(departments, name, currentDepartmentId = null) {
  const normalizedName = normalizeSearchText(name)
  return (departments ?? []).some((department) =>
    department.id !== currentDepartmentId &&
    normalizeSearchText(department.name) === normalizedName,
  )
}

function hasDuplicateDepartmentCode(departments, code, currentDepartmentId = null) {
  const normalizedCode = normalizeSearchText(code)
  return (departments ?? []).some((department) =>
    department.id !== currentDepartmentId &&
    normalizeSearchText(department.code) === normalizedCode,
  )
}

function buildWeekDays(weekStartDate) {
  const startDate = parseDateKey(weekStartDate) ?? new Date()
  return Array.from({ length: 7 }, (_, index) => toDateKey(addDays(startDate, index)))
}

function getWeekStartDate(value) {
  const date = parseDateKey(value) ?? new Date()
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day

  return toDateKey(addDays(date, mondayOffset))
}

function getDayOfWeekId(value) {
  const date = parseDateKey(value)

  if (!date) {
    return ''
  }

  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()]
}

function getTodayDate() {
  return toDateKey(new Date())
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function parseDateKey(value) {
  if (!isDateKey(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateKey(value) {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))
}

function formatDate(value) {
  const [year, month, day] = String(value ?? '').split('-')
  return year && month && day ? `${day}/${month}/${year}` : '—'
}

function formatTimeRange(row) {
  return [row.startTime, row.endTime].filter(Boolean).join(' - ') || 'Chưa có giờ'
}

function getTeacherDisplayName(teacher) {
  return String(teacher?.displayName || teacher?.fullName || teacher?.name || '').trim()
}

function compareText(firstValue, secondValue) {
  return String(firstValue ?? '').localeCompare(String(secondValue ?? ''), 'vi', {
    sensitivity: 'base',
  })
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function cleanText(value) {
  return String(value ?? '').trim()
}

function renderOption(value, label, selectedValue) {
  return `<option value="${escapeAttribute(value)}" ${
    String(value) === String(selectedValue) ? 'selected' : ''
  }>${escapeHtml(label)}</option>`
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
