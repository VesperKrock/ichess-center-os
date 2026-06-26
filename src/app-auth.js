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
            ? renderSignedInState(status, centerBinding)
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
