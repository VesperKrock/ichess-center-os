import { getUploaderDisplayName, getUserDisplayName } from './uploader-display.js'

export function createInitialCloudStatus(configStatus) {
  return {
    configStatus,
    authStatus: configStatus === 'configured' ? 'loading' : 'signed-out',
    user: null,
    role: null,
    membershipStatus: 'idle',
    message: '',
    attachments: [],
    attachmentsStatus: 'idle',
    attachmentsError: '',
    attachmentsMonthKey: '',
    uploadMessage: '',
    uploadMessageTone: '',
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
          <p>Kiểm tra kết nối, đăng nhập và quyền tại cơ sở DreamHome.</p>
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
      ${renderCloudAttachments(status)}
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
  const displayName = getUserDisplayName(status.user)

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
          <dd>DreamHome</dd>
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

function renderCloudAttachments(status) {
  const isConfigured = status.configStatus === 'configured'
  const isSignedIn = status.authStatus === 'signed-in' && status.user
  const hasMembership = status.membershipStatus === 'loaded' && status.role
  let content = ''

  if (!isConfigured) {
    content = '<p class="cloud-empty-state">Chưa cấu hình Supabase.</p>'
  } else if (!isSignedIn) {
    content = '<p class="cloud-empty-state">Đăng nhập để xem ảnh giao dịch cloud.</p>'
  } else if (status.membershipStatus === 'loading') {
    content = '<p class="cloud-empty-state">Đang kiểm tra quyền truy cập...</p>'
  } else if (!hasMembership) {
    content = '<p class="cloud-error-state">Tài khoản chưa được cấp quyền cho DreamHome.</p>'
  } else if (status.attachmentsStatus === 'loading') {
    content = '<p class="cloud-empty-state">Đang tải metadata ảnh giao dịch...</p>'
  } else if (status.attachmentsStatus === 'error') {
    content = `<p class="cloud-error-state">${escapeHtml(status.attachmentsError)}</p>`
  } else if (!status.attachments.length) {
    content = '<p class="cloud-empty-state">Chưa có ảnh giao dịch cloud trong tháng này.</p>'
  } else {
    content = `
      <div class="cloud-attachments-list" role="list">
        ${status.attachments
          .map((attachment) => renderCloudAttachmentRow(attachment, status.user))
          .join('')}
      </div>
    `
  }

  return `
    <section class="cloud-attachments-panel" aria-labelledby="cloud-attachments-title">
      <div class="cloud-attachments-heading">
        <h5 id="cloud-attachments-title">Ảnh giao dịch cloud tháng này</h5>
        ${
          status.attachmentsMonthKey
            ? `<span>${escapeHtml(status.attachmentsMonthKey)}</span>`
            : ''
        }
      </div>
      ${content}
    </section>
  `
}

function renderCloudAttachmentRow(attachment, currentUser) {
  return `
    <article class="cloud-attachment-row" role="listitem">
      <div>
        <strong>${escapeHtml(attachment.transactionCode || 'Chưa có mã')}</strong>
        <span>${formatDate(attachment.transactionDate)} · ${formatMoney(attachment.amount)}</span>
      </div>
      <div>
        <strong title="${escapeHtml(attachment.fileName)}">${escapeHtml(attachment.fileName || attachment.originalName || 'Chưa có tên file')}</strong>
        <span>Tải lên bởi: ${escapeHtml(getUploaderDisplayName(attachment, currentUser))}</span>
      </div>
      <time datetime="${escapeHtml(attachment.createdAt)}">${formatDateTime(attachment.createdAt)}</time>
      ${
        attachment.signedUrl
          ? `<a href="${escapeHtml(attachment.signedUrl)}" target="_blank" rel="noopener noreferrer">Xem ảnh</a>`
          : '<span class="cloud-signed-url-error">Không tạo được link xem</span>'
      }
    </article>
  `
}

function renderMessage(message) {
  return message ? `<p class="cloud-status-message" role="status">${escapeHtml(message)}</p>` : ''
}

function formatMoney(amount) {
  return `${Number(amount || 0).toLocaleString('vi-VN')} VNĐ`
}

function formatDate(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Không rõ ngày'
}

function formatDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Không rõ thời gian'
  }

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
