export function renderAppAuthEntry(status, centerBinding = null) {
  const isConfigured = status.configStatus === 'configured'
  const isSignedIn = status.authStatus === 'signed-in' && status.user
  const isBusy = status.authStatus === 'loading' || status.authStatus === 'signing-in'
  const statusText = getAuthStatusText(status, isConfigured, isSignedIn, isBusy)

  return `
    <section class="app-auth-entry" aria-labelledby="app-auth-title">
      <div class="app-auth-heading">
        <div>
          <p class="app-auth-eyebrow">Cổng hệ thống</p>
          <h2 id="app-auth-title">Đăng nhập hệ thống</h2>
        </div>
        <span class="app-auth-state ${isSignedIn ? 'is-signed-in' : ''}">${statusText}</span>
      </div>
      ${
        !isConfigured
          ? '<p class="app-auth-message">Chưa cấu hình Supabase. Thêm URL và publishable key vào .env.local rồi khởi động lại app.</p>'
          : isSignedIn
            ? centerBinding?.status === 'denied'
              ? renderAccessDeniedState(status, centerBinding)
              : renderSignedInState(status, centerBinding)
            : renderLoginForm(status, isBusy)
      }
    </section>
  `
}

function renderLoginForm(status, isBusy) {
  return `
    <form class="app-auth-form" data-cloud-login-form>
      <label>
        <span>Email / Tài khoản</span>
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

function renderSignedInState(status, centerBinding) {
  const email = status.user?.email || 'Không có email'
  const centerName = centerBinding?.centerName || 'DreamHome'
  const bindingMessage =
    centerBinding?.status === 'error'
      ? centerBinding.message
      : `Cơ sở: ${centerName}`

  return `
    <div class="app-auth-account">
      <div>
        <span>Đã đăng nhập</span>
        <strong>${escapeHtml(email)}</strong>
        <small>${escapeHtml(bindingMessage)}</small>
      </div>
      <button type="button" data-cloud-action="logout" ${status.authStatus === 'loading' ? 'disabled' : ''}>
        Đăng xuất
      </button>
      ${renderMessage(status.message)}
    </div>
  `
}

function renderAccessDeniedState(status, centerBinding) {
  const email = status.user?.email || 'Không có email'
  const reason = centerBinding?.deniedReason || status.accessDeniedReason || 'unknown'
  const centerName = centerBinding?.centerName || ''
  const message = getAccessDeniedMessage(reason)
  const helper = getAccessDeniedHelper(reason)

  return `
    <div class="app-auth-access-denied" role="alert">
      <div>
        <span>Đã đăng nhập</span>
        <strong>${escapeHtml(email)}</strong>
        ${centerName ? `<small>Cơ sở: ${escapeHtml(centerName)}</small>` : ''}
      </div>
      <h3>Không có quyền truy cập</h3>
      <p>${escapeHtml(message)}</p>
      <small>${escapeHtml(helper)}</small>
      <div class="app-auth-access-denied-actions">
        <button type="button" data-cloud-action="logout" ${status.authStatus === 'loading' ? 'disabled' : ''}>
          Đăng xuất
        </button>
      </div>
    </div>
  `
}

function getAccessDeniedMessage(reason) {
  if (reason === 'revoked') {
    return 'Quyền truy cập của tài khoản này đã được thu hồi.'
  }

  if (reason === 'paused') {
    return 'Quyền truy cập của tài khoản này đang tạm dừng.'
  }

  if (reason === 'no_membership') {
    return 'Tài khoản này chưa được cấp quyền truy cập cơ sở.'
  }

  return 'Tài khoản này chưa có quyền truy cập đang hoạt động.'
}

function getAccessDeniedHelper(reason) {
  if (reason === 'paused') {
    return 'Vui lòng liên hệ người phụ trách iChess để biết thêm thông tin.'
  }

  if (reason === 'no_membership') {
    return 'Nếu đây là tài khoản mới, vui lòng liên hệ người phụ trách để được cấp quyền.'
  }

  return 'Vui lòng liên hệ người phụ trách iChess để được cấp lại quyền nếu cần.'
}

function getAuthStatusText(status, isConfigured, isSignedIn, isBusy) {
  if (!isConfigured) {
    return 'Chưa cấu hình'
  }

  if (isBusy) {
    return status.authStatus === 'signing-in' ? 'Đang đăng nhập' : 'Đang kiểm tra'
  }

  return isSignedIn ? 'Đã đăng nhập' : 'Chưa đăng nhập'
}

function renderMessage(message) {
  return message ? `<p class="app-auth-message" role="status">${escapeHtml(message)}</p>` : ''
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
