import { filterNotifications, getNotificationProvider } from './notification-center.js'

const escape = value => String(value ?? '').replace(/[&<>"']/g, character =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

export function renderNotificationAssistantPanel({ notifications = [], readState = 'attention', unreadCount = 0,
  position = { right: 12, bottom: 56 }, loading = false, refreshNotice = '', canOpen = () => true } = {}) {
  const visible = filterNotifications(notifications, { readState })
  const attentionCount = filterNotifications(notifications, { readState: 'attention' }).length
  const unreadVisibleCount = visible.filter(item => !item.readAt).length
  const items = visible.map(item => {
    const known = Boolean(getNotificationProvider(item))
    const action = known && canOpen(item.sourceModule)
      ? `<button type="button" data-notification-action="open-source" data-notification-id="${escape(item.id)}">${escape(item.meta?.actionLabel || 'Mở chi tiết')}</button>` : ''
    return `<article class="notification-item notification-assistant-item ${item.readAt ? 'read' : 'unread'} level-${escape(item.severity)}" data-notification-item="${escape(item.id)}" data-notification-signal="${escape(item.meta?.signal || '')}">
      <div class="notification-item-header"><strong>${escape(item.title)}</strong><span class="notification-state">${item.readAt ? 'Đã xem' : 'Chưa đọc'}</span></div>
      <p>${escape(item.message)}</p>
      <div class="notification-meta"><span>${escape(item.sourceLabel)}</span>${item.meta?.stale ? '<span>Chờ cập nhật</span>' : ''}${known ? '' : '<span>Thông báo lưu trước đây</span>'}</div>
      <div class="notification-assistant-actions">${action}${item.readAt ? '' : `<button type="button" data-notification-action="mark-read" data-notification-id="${escape(item.id)}">Đánh dấu đã xem</button>`}</div>
    </article>`
  }).join('')
  const empty = readState === 'attention' ? 'Không có việc cần xử lý.'
    : readState === 'unread' ? 'Không có thông báo chưa đọc.'
      : readState === 'read' ? 'Không có thông báo đã đọc.' : 'Không có thông báo.'
  return `<section class="notification-center" id="notification-center" aria-label="Thông báo" style="--notification-panel-right: ${Number(position.right)}px; --notification-panel-bottom: ${Number(position.bottom)}px;">
    <div class="notification-center-header"><div><h2>Thông báo</h2><p>${attentionCount} cần xử lý · ${unreadCount} chưa đọc</p></div>
      <div class="notification-center-actions"><button type="button" data-notification-action="refresh-authoritative" ${loading ? 'disabled' : ''}>${loading ? 'Đang tải…' : 'Làm mới'}</button><button type="button" data-notification-action="mark-all-read" ${unreadVisibleCount ? '' : 'disabled'}>Đánh dấu tất cả đã đọc</button></div>
    </div>${refreshNotice}
    <div class="notification-center-filters is-status-only" aria-label="Lọc thông báo"><label><span>Trạng thái</span><select data-notification-filter="readState">${[
      ['attention', 'Cần xử lý'], ['unread', 'Chưa đọc'], ['all', 'Tất cả'], ['read', 'Đã đọc'],
    ].map(([value, label]) => `<option value="${value}" ${value === readState ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>
    <div class="notification-list">${items || `<p class="notification-empty">${empty}</p>`}</div>
  </section>`
}
