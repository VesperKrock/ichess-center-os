import { getUserDisplayName } from './uploader-display.js'

export function createInitialCloudStatus(configStatus) {
  return {
    configStatus,
    authStatus: configStatus === 'configured' ? 'loading' : 'signed-out',
    user: null,
    role: null,
    centerId: '',
    centerName: '',
    membership: null,
    memberships: [],
    membershipStatus: 'idle',
    message: '',
    attachments: [],
    attachmentsStatus: 'idle',
    attachmentsError: '',
    attachmentsMonthKey: '',
    uploadMessage: '',
    uploadMessageTone: '',
    memberProfileMap: {},
    currentMemberProfile: null,
    profileStatus: 'idle',
    profileMessage: '',
    profileMessageTone: '',
  }
}

export function renderCloudStatus(status) {
  const isConfigured = status.configStatus === 'configured'
  const isSignedIn = status.authStatus === 'signed-in' && status.user
  const isBusy = status.authStatus === 'loading' || status.authStatus === 'signing-in'
  const statusLabel = isConfigured ? 'Supabase đã cấu hình' : 'Chưa cấu hình Supabase'

  return `
    <section class="cloud-status-panel" aria-labelledby="cloud-status-title">
      <div class="cloud-status-heading">
        <div>
          <h4 id="cloud-status-title">Supabase Cloud</h4>
          <p>Kiểm tra kết nối, đăng nhập và quyền tại cơ sở được gán cho tài khoản.</p>
        </div>
        <span class="cloud-config-badge ${isConfigured ? 'is-configured' : 'is-missing'}">
          ${statusLabel}
        </span>
      </div>
      ${
        !isConfigured
          ? '<p class="cloud-status-note">Thêm URL và publishable key vào <code>.env.local</code>, sau đó khởi động lại app.</p>'
          : isSignedIn
            ? renderSignedInStatus(status)
            : renderLoginForm(status, isBusy)
      }
      ${renderCloudGallerySummary(status)}
      ${
        status.uploadMessage
          ? `<p class="cloud-upload-message ${status.uploadMessageTone === 'success' ? 'is-success' : 'is-error'}" role="status">${escapeHtml(status.uploadMessage)}</p>`
          : ''
      }
    </section>
  `
}

function renderLoginForm(status, isBusy) {
  return `
    <form class="cloud-login-form" data-cloud-login-form>
      <span class="cloud-auth-state">${isBusy ? 'Đang kiểm tra phiên đăng nhập...' : 'Chưa đăng nhập'}</span>
      <label>
        <span>Email</span>
        <input type="email" name="email" autocomplete="username" required ${isBusy ? 'disabled' : ''} />
      </label>
      <label>
        <span>Mật khẩu</span>
        <input type="password" name="password" autocomplete="current-password" required ${isBusy ? 'disabled' : ''} />
      </label>
      <button type="submit" ${isBusy ? 'disabled' : ''}>
        ${status.authStatus === 'signing-in' ? 'Đang đăng nhập...' : 'Đăng nhập'}
      </button>
      ${renderMessage(status.message)}
    </form>
  `
}

function renderSignedInStatus(status) {
  const membershipText = getMembershipText(status)
  const displayName =
    status.currentMemberProfile?.displayName || getUserDisplayName(status.user)

  return `
    <div class="cloud-account-status">
      <span class="cloud-auth-state is-signed-in">Đã đăng nhập</span>
      <dl>
        <div>
          <dt>Tài khoản</dt>
          <dd>${escapeHtml(displayName || status.user.email || 'Không có email')}</dd>
          ${displayName && status.user.email ? `<small>${escapeHtml(status.user.email)}</small>` : ''}
        </div>
        <div>
          <dt>Cơ sở</dt>
          <dd>${escapeHtml(status.centerName || status.centerId || 'Chưa xác định')}</dd>
        </div>
        <div>
          <dt>Vai trò</dt>
          <dd>${membershipText}</dd>
        </div>
      </dl>
      <button type="button" data-cloud-action="logout" ${status.authStatus === 'loading' ? 'disabled' : ''}>
        Đăng xuất
      </button>
      ${renderMessage(status.message)}
    </div>
    ${renderCloudProfileForm(status)}
  `
}

function renderCloudGallerySummary(status) {
  const isConfigured = status.configStatus === 'configured'
  const isSignedIn = status.authStatus === 'signed-in' && status.user
  const hasMembership = status.membershipStatus === 'loaded' && status.role
  let summary = ''

  if (!isConfigured) {
    summary = 'Chưa cấu hình Supabase.'
  } else if (!isSignedIn) {
    summary = 'Đăng nhập để sử dụng kho ảnh cloud.'
  } else if (!hasMembership) {
    summary =
      status.membershipStatus === 'loading'
        ? 'Đang kiểm tra quyền truy cập...'
        : 'Tài khoản chưa được cấp quyền cho cơ sở nào.'
  } else if (status.attachmentsStatus === 'loading') {
    summary = 'Đang tải thống kê ảnh cloud...'
  } else if (status.attachmentsStatus === 'error') {
    summary = 'Không tải được thống kê ảnh cloud.'
  } else {
    summary = `Kho ảnh cloud: ${status.attachments.length} ảnh · Tháng ${status.attachmentsMonthKey || 'hiện tại'}`
  }

  return `
    <div class="cloud-gallery-summary">
      <span>${escapeHtml(summary)}</span>
      <button
        type="button"
        data-cloud-action="open-gallery"
        ${hasMembership ? '' : 'disabled'}
      >
        Mở kho ảnh cloud
      </button>
    </div>
  `
}

function renderCloudProfileForm(status) {
  if (status.membershipStatus !== 'loaded' || !status.role) {
    return ''
  }

  const profile = status.currentMemberProfile ?? {}
  const isSaving = status.profileStatus === 'saving'

  return `
    <details class="cloud-profile-panel">
      <summary>Hồ sơ cloud</summary>
      <form data-cloud-profile-form>
        <label>
          <span>Tên hiển thị</span>
          <input
            type="text"
            name="displayName"
            maxlength="120"
            value="${escapeAttribute(profile.displayName ?? '')}"
            placeholder="Ví dụ: Đức Thắng"
            ${isSaving ? 'disabled' : ''}
          />
        </label>
        <label>
          <span>Nhãn vai trò</span>
          <input
            type="text"
            name="memberLabel"
            maxlength="120"
            value="${escapeAttribute(profile.memberLabel ?? '')}"
            placeholder="Ví dụ: Admin kỹ thuật"
            ${isSaving ? 'disabled' : ''}
          />
        </label>
        <button type="submit" ${isSaving ? 'disabled' : ''}>
          ${isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}
        </button>
        ${
          status.profileStatus === 'unavailable'
            ? '<p>Chưa thể dùng hồ sơ cloud. Vui lòng chạy SQL S5 và kiểm tra policy.</p>'
            : ''
        }
        ${
          status.profileMessage
            ? `<p class="is-${status.profileMessageTone === 'success' ? 'success' : 'error'}" role="status">${escapeHtml(status.profileMessage)}</p>`
            : ''
        }
      </form>
    </details>
  `
}

function getMembershipText(status) {
  if (status.membershipStatus === 'loading') {
    return 'Đang kiểm tra quyền...'
  }

  if (status.membershipStatus === 'error') {
    return 'Không đọc được quyền qua RLS'
  }

  if (!status.role) {
    return 'Chưa được cấp quyền'
  }

  return escapeHtml(status.role)
}

function renderMessage(message) {
  return message ? `<p class="cloud-status-message" role="status">${escapeHtml(message)}</p>` : ''
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttribute(value) {
  return escapeHtml(value)
}
