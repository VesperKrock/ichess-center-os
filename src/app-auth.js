export function renderAppAuthEntry(status, centerBinding = null) {
  const isConfigured = status.configStatus === 'configured'
  const isSignedIn = status.authStatus === 'signed-in' && status.user
  const isBusy = status.authStatus === 'loading' || status.authStatus === 'signing-in'
  const statusText = getAuthStatusText(status, isConfigured, isSignedIn, isBusy)
  const handoffEntry = renderInstallationHandoffEntry(status, isSignedIn, isBusy)

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
          : handoffEntry
            ? handoffEntry
          : isSignedIn
            ? centerBinding?.status === 'denied'
              ? renderAccessDeniedState(status, centerBinding)
              : renderSignedInState(status, centerBinding)
            : renderLoginForm(status, isBusy)
      }
    </section>
  `
}

function renderInstallationHandoffEntry(status, isSignedIn, isBusy) {
  const handoff = status.installationHandoffState || {}
  const capability = handoff.capability || {}
  if (handoff.capabilityStatus === 'LOADING' && isSignedIn && status.membershipStatus !== 'loaded') {
    return '<p class="app-auth-message">Đang kiểm tra trạng thái khởi tạo hệ thống...</p>'
  }
  if (!isSignedIn && ['FRESH_UNINITIALIZED', 'UNINITIALIZED_NEXT_EPOCH'].includes(capability.state)) {
    return `
      <div class="app-auth-bootstrap-intro">
        <h3>iChess chưa được khởi tạo</h3>
        <p>Người nhận bàn giao cần tự tạo tài khoản, xác nhận email rồi đăng nhập để khởi tạo cơ sở đầu tiên.</p>
      </div>
      <form class="app-auth-form" data-first-owner-signup-form>
        <label><span>Email của bạn</span><input type="email" name="email" autocomplete="username" required /></label>
        <label><span>Mật khẩu do bạn tự đặt</span><input type="password" name="password" autocomplete="new-password" minlength="12" required /></label>
        <label><span>Nhập lại mật khẩu</span><input type="password" name="confirmPassword" autocomplete="new-password" minlength="12" required /></label>
        <button type="submit">Tạo tài khoản nhận bàn giao</button>
      </form>
      ${renderLoginForm(status, isBusy)}
      ${renderMessage(handoff.message)}
    `
  }
  if (!isSignedIn || !capability.targetSessionDrainRequired && !capability.bootstrapAvailable) return ''
  if (capability.targetSessionDrainRequired) {
    const drainCompleted = capability.targetSessionDrainCompleted === true
    return `
      <div class="app-auth-bootstrap-intro">
        <h3>${drainCompleted ? 'Chờ hoàn tất bàn giao' : 'Kết thúc phiên cũ trước khi bàn giao'}</h3>
        <p>${drainCompleted
          ? 'Phiên cũ đã kết thúc. Hãy kiểm tra lại khi thời gian an toàn hoàn tất.'
          : 'Quyền dữ liệu cũ đã được thu hồi. Hãy kết thúc phiên này, sau đó đăng nhập lại khi thời gian an toàn hoàn tất.'}</p>
        <button type="button" data-first-owner-action="drain-session" ${handoff.actionStatus === 'saving' ? 'disabled' : ''}>
          ${handoff.actionStatus === 'saving'
            ? drainCompleted ? 'Đang kiểm tra...' : 'Đang kết thúc phiên...'
            : drainCompleted ? 'Kiểm tra trạng thái bàn giao' : 'Kết thúc phiên cũ'}
        </button>
        ${renderMessage(handoff.message)}
      </div>
    `
  }
  return `
    <form class="app-auth-form first-owner-bootstrap-form" data-first-owner-bootstrap-form>
      <h3>Khởi tạo iChess lần đầu</h3>
      <p>Hành động này chỉ thực hiện một lần. Tài khoản đang đăng nhập sẽ trở thành Owner đầu tiên.</p>
      <label><span>Tên cơ sở đầu tiên</span><input type="text" name="centerName" minlength="2" maxlength="100" required /></label>
      <label><span>Mã bàn giao một lần</span><input type="password" name="handoffCode" autocomplete="off" minlength="32" required /></label>
      <label><span>Xác nhận mật khẩu hiện tại</span><input type="password" name="currentPassword" autocomplete="current-password" required /></label>
      <button type="submit" ${handoff.actionStatus === 'saving' ? 'disabled' : ''}>
        ${handoff.actionStatus === 'saving' ? 'Đang khởi tạo...' : 'Khởi tạo cơ sở và Owner đầu tiên'}
      </button>
      ${renderMessage(handoff.message)}
      <button type="button" data-cloud-action="logout">Đăng xuất</button>
    </form>
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
  const centerName = centerBinding?.centerName || 'Chưa xác định'
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
