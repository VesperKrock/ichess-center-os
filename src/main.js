import './styles.css'
import { modules } from './modules.js'
import {
  getDeletedNotificationIds,
  getDesktopModuleOrder,
  getStoredNotifications,
  getStoredStudents,
  getStoredTuition,
  getViewMode,
  saveDeletedNotificationIds,
  saveDesktopModuleOrder,
  saveStoredNotifications,
  saveStoredStudents,
  saveStoredTuition,
  saveViewMode,
} from './storage.js'
import { createSampleNotifications } from './notifications.js'
import { sampleStudents } from './student-data.js'
import { createSampleTuitionRecords } from './tuition-data.js'
import {
  emptyCareNoteDraft,
  getStudentCareNotesWindowTitle,
  getStudentDetailWindowTitle,
  getStudentLearningWindowTitle,
  renderStudentCareNotes,
  renderStudentDetail,
  renderStudentLearningResult,
} from './student-detail.js'
import {
  buildStudentFromForm,
  createEditStudentFormState,
  createEmptyStudentFormState,
  formatStudentPhoneNumber,
  initialStudentFilters,
  isStudentFormReady,
  renderStudentModule,
  validateStudentForm,
} from './student-module.js'
import {
  buildTuitionRows,
  createEditTuitionFormState,
  createEmptyTuitionFormState,
  createPaymentFormState,
  createRenewTuitionFormState,
  createTuitionWarningNotification,
  initialTuitionFilters,
  normalizePaymentFormValues,
  normalizeTuitionFormValues,
  renderTuitionModule,
  validatePaymentForm,
  validateRenewTuitionForm,
  validateTuitionForm,
} from './tuition-module.js'

const app = document.querySelector('#app')

let currentViewMode = getViewMode()
let isStartMenuOpen = false
let isWindowOverflowOpen = false
let isNotificationCenterOpen = false
let notificationPanelPosition = { right: 12, bottom: 56 }
let openWindows = []
let nextWindowNumber = 1
let topZIndex = 20
let desktopModuleOrder = getDesktopModuleOrder(modules.map((moduleItem) => moduleItem.id))
let shortcutDragState = null
let suppressNextModuleClick = false
let shortcutDocumentDragBound = false
let notificationOutsidePointerBound = false
let studentFilters = { ...initialStudentFilters }
let students = getStoredStudents(sampleStudents)
let tuitionRecords = getStoredTuition(createSampleTuitionRecords(students))
let notifications = getStoredNotifications(createSampleNotifications())
let deletedNotificationIds = getDeletedNotificationIds()
notifications = syncTuitionNotifications(notifications)
let studentFormState = null
let tuitionFilters = { ...initialTuitionFilters }
let tuitionFormState = null
let tuitionPaymentFormState = null
let tuitionDetailState = null
let careNoteDrafts = {}

function render() {
  app.innerHTML = `
    <div class="app-shell">
      <main class="desktop-area">
        ${renderDashboard()}
        <div class="window-layer" aria-label="Các cửa sổ đang mở">
          ${renderOpenWindows()}
        </div>
      </main>
      ${renderTaskbar()}
      ${renderSystemOverlay()}
    </div>
  `

  bindEvents()
  updateClock()
}

function renderDashboard() {
  const moduleButtons = getOrderedModules()
    .map(
      (moduleItem) => `
        <button
          class="module-button"
          type="button"
          data-module-id="${moduleItem.id}"
          data-shortcut-id="${moduleItem.id}"
        >
          <span>${moduleItem.name}</span>
        </button>
      `,
    )
    .join('')

  return `
    <section class="dashboard" aria-labelledby="dashboard-title">
      <h1 class="sr-only" id="dashboard-title">Desktop DreamHome</h1>
      <div class="desktop-surface">
        <div class="module-list ${currentViewMode}" aria-label="Danh sách chức năng">
          ${moduleButtons}
        </div>
      </div>
    </section>
  `
}

function renderOpenWindows() {
  return [...openWindows]
    .sort((firstWindow, secondWindow) => firstWindow.zIndex - secondWindow.zIndex)
    .map((windowItem) => renderModuleWindow(windowItem))
    .join('')
}

function getOrderedModules() {
  const modulesById = new Map(modules.map((moduleItem) => [moduleItem.id, moduleItem]))
  return desktopModuleOrder.map((moduleId) => modulesById.get(moduleId)).filter(Boolean)
}

function renderModuleWindow(windowItem) {
  const title = getWindowTitle(windowItem)

  if (!title || windowItem.minimized) {
    return ''
  }

  const style = `
    left: ${windowItem.x}px;
    top: ${windowItem.y}px;
    width: ${windowItem.width}px;
    height: ${windowItem.height}px;
    z-index: ${windowItem.zIndex};
  `

  return `
    <section
      class="desktop-window ${windowItem.maximized ? 'maximized' : ''}"
      style="${style}"
      data-window-id="${windowItem.id}"
      aria-labelledby="${windowItem.id}-title"
    >
      <div class="window-titlebar" data-drag-window-id="${windowItem.id}">
        <h2 id="${windowItem.id}-title">${title}</h2>
        <div class="window-controls">
          <button type="button" data-window-action="minimize" data-window-id="${windowItem.id}" aria-label="Thu nhỏ ${title}">-</button>
          <button type="button" data-window-action="maximize" data-window-id="${windowItem.id}" aria-label="Phóng to hoặc khôi phục ${title}">□</button>
          <button type="button" data-window-action="close" data-window-id="${windowItem.id}" aria-label="Đóng ${title}">X</button>
        </div>
      </div>
      <div class="window-body">
        ${renderWindowBody(windowItem)}
      </div>
    </section>
  `
}

function renderWindowBody(windowItem) {
  if (windowItem.type === 'student-detail') {
    return renderStudentDetail(getStudentById(windowItem.studentId))
  }

  if (windowItem.type === 'student-care-notes') {
    return renderStudentCareNotes(
      getStudentById(windowItem.studentId),
      careNoteDrafts[windowItem.studentId] ?? emptyCareNoteDraft,
    )
  }

  if (windowItem.type === 'student-learning') {
    return renderStudentLearningResult(getStudentById(windowItem.studentId))
  }

  const moduleItem = modules.find((item) => item.id === windowItem.moduleId)

  if (!moduleItem) {
    return ''
  }

  if (moduleItem.id === 'hoc-vien') {
    return renderStudentModule(students, studentFilters, studentFormState)
  }

  if (moduleItem.id === 'hoc-phi') {
    return renderTuitionModule(
      students,
      tuitionRecords,
      tuitionFilters,
      tuitionFormState,
      tuitionPaymentFormState,
      tuitionDetailState,
    )
  }

  return `
    <div class="room-heading">
      <p class="room-description">${moduleItem.shortDescription}</p>
      <span class="status-badge">${getStatusLabel(moduleItem.status)}</span>
    </div>
    <p class="phase-note">
      Module này đang ở giai đoạn khung. Nội dung nghiệp vụ sẽ được bổ sung ở phase sau.
    </p>
    <div class="room-grid">
      ${renderPlannedList('Chức năng dự kiến', moduleItem.plannedFeatures)}
      ${renderPlannedList('Dữ liệu dự kiến', moduleItem.plannedData)}
    </div>
  `
}

function getWindowTitle(windowItem) {
  if (windowItem.type === 'student-detail') {
    return getStudentDetailWindowTitle(getStudentById(windowItem.studentId))
  }

  if (windowItem.type === 'student-care-notes') {
    return getStudentCareNotesWindowTitle(getStudentById(windowItem.studentId))
  }

  if (windowItem.type === 'student-learning') {
    return getStudentLearningWindowTitle(getStudentById(windowItem.studentId))
  }

  const moduleItem = modules.find((item) => item.id === windowItem.moduleId)
  return moduleItem?.name
}

function getStudentById(studentId) {
  return students.find((student) => student.id === studentId)
}

function getLatestCareNoteContent(careNotes) {
  return [...(careNotes ?? [])].sort(
    (firstNote, secondNote) => new Date(secondNote.createdAt) - new Date(firstNote.createdAt),
  )[0]?.content ?? ''
}

function renderPlannedList(title, items) {
  const listItems = items.map((item) => `<li>${item}</li>`).join('')

  return `
    <section class="planned-panel" aria-label="${title}">
      <h3>${title}</h3>
      <ul>${listItems}</ul>
    </section>
  `
}

function renderTaskbar() {
  const visibleWindows = openWindows.slice(0, 4)
  const overflowWindows = openWindows.slice(4)
  const activeWindowId = getActiveWindowId()
  const unreadCount = getUnreadNotificationCount()
  const windowButtons = visibleWindows
    .map((windowItem) => {
      const title = getWindowTitle(windowItem)

      if (!title) {
        return ''
      }

      return `
        <button
          class="taskbar-window ${windowItem.minimized ? 'minimized' : ''} ${windowItem.id === activeWindowId ? 'active' : ''}"
          type="button"
          data-taskbar-window-id="${windowItem.id}"
        >
          ${title}
        </button>
      `
    })
    .join('')

  return `
    <footer class="taskbar">
      <div class="taskbar-left">
        <button
          class="start-button ${isStartMenuOpen ? 'active' : ''}"
          type="button"
          data-action="toggle-start"
          aria-expanded="${isStartMenuOpen}"
          aria-controls="start-menu"
        >
          Start
        </button>
        <span class="taskbar-item app-name">iChess Center OS</span>
        <span class="taskbar-item">Cơ sở: DreamHome</span>
        <span class="taskbar-item">Vai trò: Quản lý cơ sở</span>
      </div>
      <div class="taskbar-windows" aria-label="Cửa sổ đang mở">
        ${windowButtons}
        ${
          overflowWindows.length
            ? `
              <button
                class="taskbar-overflow ${isWindowOverflowOpen ? 'active' : ''}"
                type="button"
                data-action="toggle-window-overflow"
                aria-expanded="${isWindowOverflowOpen}"
                aria-controls="window-overflow-menu"
              >
                ^
              </button>
            `
            : ''
        }
      </div>
      <div class="taskbar-right">
        <div class="view-toggle taskbar-view-toggle" aria-label="Chọn chế độ hiển thị">
          <button
            class="${currentViewMode === 'grid' ? 'active' : ''}"
            type="button"
            data-view-mode="grid"
          >
            Dạng ô vuông
          </button>
          <button
            class="${currentViewMode === 'list' ? 'active' : ''}"
            type="button"
            data-view-mode="list"
          >
            Dạng danh sách
          </button>
        </div>
        <time class="taskbar-clock" id="taskbar-clock" aria-label="Ngày giờ hiện tại"></time>
        <button
          class="notification-bell ${isNotificationCenterOpen ? 'active' : ''}"
          type="button"
          data-action="toggle-notifications"
          aria-expanded="${isNotificationCenterOpen}"
          aria-controls="notification-center"
          aria-label="Thông báo, ${unreadCount} chưa đọc"
        >
          <span class="notification-bell-icon" aria-hidden="true">🔔</span>
          ${
            unreadCount
              ? `<span class="notification-badge">${unreadCount}</span>`
              : '<span class="notification-badge empty">0</span>'
          }
        </button>
      </div>
      ${isStartMenuOpen ? renderStartMenu() : ''}
      ${isWindowOverflowOpen ? renderWindowOverflowMenu(overflowWindows, activeWindowId) : ''}
    </footer>
  `
}

function renderSystemOverlay() {
  if (!isNotificationCenterOpen) {
    return '<div class="system-overlay-root" id="system-overlay-root"></div>'
  }

  return `
    <div class="system-overlay-root active" id="system-overlay-root">
      ${renderNotificationCenter(getUnreadNotificationCount())}
    </div>
  `
}

function renderNotificationCenter(unreadCount) {
  const readCount = notifications.length - unreadCount
  const notificationItems = notifications
    .map(
      (notification) => `
        <article
          class="notification-item ${notification.read ? 'read' : 'unread'} level-${notification.level}"
          data-notification-id="${notification.id}"
          tabindex="0"
          aria-label="${escapeHtml(notification.title)}"
        >
          <div class="notification-item-header">
            <strong>${escapeHtml(notification.title)}</strong>
            <span class="notification-state">${notification.read ? 'Đã đọc' : 'Chưa đọc'}</span>
          </div>
          <p>${escapeHtml(notification.message)}</p>
          <div class="notification-meta">
            <span>${escapeHtml(getNotificationSourceLabel(notification.sourceModule))}</span>
            <time datetime="${notification.createdAt}">${formatNotificationTime(notification.createdAt)}</time>
          </div>
          ${
            notification.read
              ? ''
              : `
                <button
                  class="notification-read-button"
                  type="button"
                  data-notification-action="mark-read"
                  data-notification-id="${notification.id}"
                >
                  Đánh dấu đã đọc
                </button>
              `
          }
        </article>
      `,
    )
    .join('')

  return `
    <section
      class="notification-center"
      id="notification-center"
      style="--notification-panel-right: ${notificationPanelPosition.right}px; --notification-panel-bottom: ${notificationPanelPosition.bottom}px;"
      aria-label="Thông báo"
    >
      <div class="notification-center-header">
        <div>
          <h2>Thông báo</h2>
          <p>${unreadCount} chưa đọc</p>
        </div>
        <div class="notification-center-actions">
          <button
            type="button"
            data-notification-action="mark-all-read"
            ${unreadCount ? '' : 'disabled'}
          >
            Đánh dấu tất cả đã đọc
          </button>
          <button
            type="button"
            data-notification-action="clear-read"
            ${readCount ? '' : 'disabled'}
          >
            Xóa đã đọc
          </button>
        </div>
      </div>
      <div class="notification-list">
        ${notificationItems || '<p class="notification-empty">Chưa có thông báo.</p>'}
      </div>
    </section>
  `
}

function renderWindowOverflowMenu(overflowWindows, activeWindowId) {
  const windowItems = overflowWindows
    .map((windowItem) => {
      const title = getWindowTitle(windowItem)

      if (!title) {
        return ''
      }

      return `
        <button
          class="${windowItem.minimized ? 'minimized' : ''} ${windowItem.id === activeWindowId ? 'active' : ''}"
          type="button"
          data-taskbar-window-id="${windowItem.id}"
        >
          ${title}
        </button>
      `
    })
    .join('')

  return `
    <nav class="window-overflow-menu" id="window-overflow-menu" aria-label="Cửa sổ khác">
      <p>Cửa sổ</p>
      ${windowItems}
    </nav>
  `
}

function getActiveWindowId() {
  return openWindows
    .filter((windowItem) => !windowItem.minimized)
    .reduce(
      (activeWindow, windowItem) =>
        !activeWindow || windowItem.zIndex > activeWindow.zIndex ? windowItem : activeWindow,
      null,
    )?.id
}

function renderStartMenu() {
  const moduleItems = modules
    .map(
      (moduleItem) => `
        <button class="start-menu-module" type="button" data-module-id="${moduleItem.id}">
          ${moduleItem.name}
        </button>
      `,
    )
    .join('')

  return `
    <nav class="start-menu" id="start-menu" aria-label="Start menu">
      <div class="start-menu-section">
        <button type="button" data-action="show-desktop">Về desktop</button>
        <button type="button" data-view-mode="grid">Dạng ô vuông</button>
        <button type="button" data-view-mode="list">Dạng danh sách</button>
      </div>
      <div class="start-menu-section">
        <p>Danh sách module</p>
        <div class="start-menu-modules">
          ${moduleItems}
        </div>
      </div>
    </nav>
  `
}

function openModuleWindow(moduleId) {
  const existingWindow = openWindows.find((windowItem) => windowItem.moduleId === moduleId)

  if (existingWindow) {
    focusWindow(existingWindow.id)
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    render()
    return
  }

  const offset = (openWindows.length % 7) * 28

  openWindows.push({
    id: `window-${nextWindowNumber}`,
    moduleId,
    x: 72 + offset,
    y: 42 + offset,
    width: 760,
    height: 520,
    zIndex: ++topZIndex,
    minimized: false,
    maximized: true,
    restoreBounds: {
      x: 72 + offset,
      y: 42 + offset,
      width: 760,
      height: 520,
    },
  })
  nextWindowNumber += 1
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function openStudentDetailWindow(studentId) {
  const existingWindow = openWindows.find(
    (windowItem) => windowItem.type === 'student-detail' && windowItem.studentId === studentId,
  )

  if (existingWindow) {
    focusWindow(existingWindow.id)
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    render()
    return
  }

  const offset = (openWindows.length % 7) * 28

  openWindows.push({
    id: `window-${nextWindowNumber}`,
    type: 'student-detail',
    studentId,
    x: 120 + offset,
    y: 70 + offset,
    width: 820,
    height: 560,
    zIndex: ++topZIndex,
    minimized: false,
    maximized: true,
    restoreBounds: {
      x: 120 + offset,
      y: 70 + offset,
      width: 820,
      height: 560,
    },
  })
  nextWindowNumber += 1
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function openStudentSubWindow(studentId, type) {
  const existingWindow = openWindows.find(
    (windowItem) => windowItem.type === type && windowItem.studentId === studentId,
  )

  if (existingWindow) {
    focusWindow(existingWindow.id)
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    render()
    return
  }

  const offset = (openWindows.length % 7) * 28
  const nextWindowId = `window-${nextWindowNumber}`

  openWindows.push({
    id: nextWindowId,
    type,
    studentId,
    x: 132 + offset,
    y: 78 + offset,
    width: type === 'student-care-notes' ? 920 : 820,
    height: 560,
    zIndex: ++topZIndex,
    minimized: false,
    maximized: true,
    restoreBounds: {
      x: 132 + offset,
      y: 78 + offset,
      width: type === 'student-care-notes' ? 920 : 820,
      height: 560,
    },
  })
  nextWindowNumber += 1
  focusWindow(nextWindowId)
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function openStudentEditForm(studentId) {
  const student = getStudentById(studentId)

  if (!student) {
    return
  }

  if (!openWindows.some((windowItem) => windowItem.moduleId === 'hoc-vien')) {
    const offset = (openWindows.length % 7) * 28
    openWindows.push({
      id: `window-${nextWindowNumber}`,
      moduleId: 'hoc-vien',
      x: 72 + offset,
      y: 42 + offset,
      width: 760,
      height: 520,
      zIndex: ++topZIndex,
      minimized: false,
      maximized: true,
      restoreBounds: {
        x: 72 + offset,
        y: 42 + offset,
        width: 760,
        height: 520,
      },
    })
    nextWindowNumber += 1
  }

  const studentWindow = openWindows.find((windowItem) => windowItem.moduleId === 'hoc-vien')
  studentFormState = createEditStudentFormState(student)
  studentFilters = {
    ...studentFilters,
    selectedStudentId: student.id,
  }

  if (studentWindow) {
    focusWindow(studentWindow.id)
  }

  render()
}

function focusWindow(windowId) {
  const nextZIndex = ++topZIndex

  openWindows = openWindows.map((windowItem) =>
    windowItem.id === windowId
      ? { ...windowItem, minimized: false, zIndex: nextZIndex }
      : windowItem,
  )
}

function minimizeWindow(windowId) {
  openWindows = openWindows.map((windowItem) =>
    windowItem.id === windowId ? { ...windowItem, minimized: true } : windowItem,
  )
  render()
}

function toggleMaximizeWindow(windowId) {
  openWindows = openWindows.map((windowItem) => {
    if (windowItem.id !== windowId) {
      return windowItem
    }

    if (windowItem.maximized) {
      return {
        ...windowItem,
        ...windowItem.restoreBounds,
        maximized: false,
        restoreBounds: null,
        zIndex: ++topZIndex,
      }
    }

    return {
      ...windowItem,
      maximized: true,
      minimized: false,
      restoreBounds: {
        x: windowItem.x,
        y: windowItem.y,
        width: windowItem.width,
        height: windowItem.height,
      },
      zIndex: ++topZIndex,
    }
  })
  render()
}

function closeWindow(windowId) {
  openWindows = openWindows.filter((windowItem) => windowItem.id !== windowId)
  render()
}

function showDesktop() {
  openWindows = openWindows.map((windowItem) => ({ ...windowItem, minimized: true }))
  isStartMenuOpen = false
  isWindowOverflowOpen = false
  isNotificationCenterOpen = false
  render()
}

function getStatusLabel(status) {
  const statusLabels = {
    placeholder: 'Khung trống',
    planned: 'Đã lên kế hoạch',
    'in-progress': 'Đang triển khai',
  }

  return statusLabels[status] ?? status
}

function bindEvents() {
  bindNotificationOutsidePointer()

  document.querySelectorAll('[data-view-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      currentViewMode = button.dataset.viewMode
      saveViewMode(currentViewMode)
      isStartMenuOpen = false
      isWindowOverflowOpen = false
      isNotificationCenterOpen = false
      render()
    })
  })

  document.querySelectorAll('[data-module-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (suppressNextModuleClick) {
        suppressNextModuleClick = false
        return
      }

      openModuleWindow(button.dataset.moduleId)
    })
  })

  document.querySelector('[data-action="toggle-start"]')?.addEventListener('click', () => {
    isStartMenuOpen = !isStartMenuOpen
    isWindowOverflowOpen = false
    isNotificationCenterOpen = false
    render()
  })

  document.querySelector('[data-action="toggle-window-overflow"]')?.addEventListener('click', () => {
    isWindowOverflowOpen = !isWindowOverflowOpen
    isStartMenuOpen = false
    isNotificationCenterOpen = false
    render()
  })

  document.querySelector('[data-action="toggle-notifications"]')?.addEventListener('click', (event) => {
    notificationPanelPosition = getNotificationPanelPosition(event.currentTarget)
    isNotificationCenterOpen = !isNotificationCenterOpen
    isStartMenuOpen = false
    isWindowOverflowOpen = false
    render()
  })

  document.querySelector('[data-action="show-desktop"]')?.addEventListener('click', () => {
    showDesktop()
  })

  document.querySelectorAll('[data-window-id]').forEach((windowElement) => {
    windowElement.addEventListener('pointerdown', (event) => {
      if (event.target.closest('[data-student-detail-action]')) {
        return
      }

      focusWindow(windowElement.dataset.windowId)
      const focusedWindow = openWindows.find((item) => item.id === windowElement.dataset.windowId)

      if (focusedWindow) {
        windowElement.style.zIndex = focusedWindow.zIndex
      }
    })
  })

  document.querySelectorAll('[data-window-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const { windowAction, windowId } = button.dataset

      if (windowAction === 'minimize') {
        minimizeWindow(windowId)
      }

      if (windowAction === 'maximize') {
        toggleMaximizeWindow(windowId)
      }

      if (windowAction === 'close') {
        closeWindow(windowId)
      }
    })
  })

  document.querySelectorAll('[data-taskbar-window-id]').forEach((button) => {
    button.addEventListener('click', () => {
      focusWindow(button.dataset.taskbarWindowId)
      isStartMenuOpen = false
      isWindowOverflowOpen = false
      isNotificationCenterOpen = false
      render()
    })
  })

  document.querySelectorAll('[data-notification-id]').forEach((notificationElement) => {
    notificationElement.addEventListener('click', (event) => {
      if (event.target.closest('[data-notification-action]')) {
        return
      }

      markNotificationRead(notificationElement.dataset.notificationId)
    })

    notificationElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      markNotificationRead(notificationElement.dataset.notificationId)
    })
  })

  document.querySelectorAll('[data-notification-action="mark-read"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      markNotificationRead(button.dataset.notificationId)
    })
  })

  document.querySelector('[data-notification-action="mark-all-read"]')?.addEventListener('click', () => {
    notifications = notifications.map((notification) => ({ ...notification, read: true }))
    saveStoredNotifications(notifications)
    render()
  })

  document.querySelector('[data-notification-action="clear-read"]')?.addEventListener('click', () => {
    const readNotificationIds = notifications
      .filter((notification) => notification.read)
      .map((notification) => notification.id)
    deletedNotificationIds = Array.from(new Set([...deletedNotificationIds, ...readNotificationIds]))
    saveDeletedNotificationIds(deletedNotificationIds)
    notifications = notifications.filter((notification) => !notification.read)
    saveStoredNotifications(notifications)
    render()
  })

  document.querySelectorAll('[data-tuition-filter]').forEach((control) => {
    control.addEventListener('input', () => {
      tuitionFilters = {
        ...tuitionFilters,
        [control.dataset.tuitionFilter]: control.value,
      }
      render()

      const nextControl = document.querySelector(
        `[data-tuition-filter="${control.dataset.tuitionFilter}"]`,
      )
      nextControl?.focus()
    })
  })

  document.querySelectorAll('[data-tuition-action="open-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      const student = students.find((item) => item.id === button.dataset.tuitionStudentId)

      if (!student) {
        return
      }

      const tuitionRecord = tuitionRecords.find((record) => record.studentId === student.id)
      tuitionFormState = tuitionRecord
        ? createEditTuitionFormState(student, tuitionRecord)
        : createEmptyTuitionFormState(student)
      tuitionPaymentFormState = null
      tuitionDetailState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-row-student-id]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if (
        event.target.closest('[data-tuition-action="open-debt"]') ||
        event.target.closest('[data-tuition-action="open-detail"]')
      ) {
        return
      }

      openTuitionPackageForm(row.dataset.tuitionRowStudentId)
    })

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      if (
        event.target.closest('[data-tuition-action="open-debt"]') ||
        event.target.closest('[data-tuition-action="open-detail"]')
      ) {
        return
      }

      event.preventDefault()
      openTuitionPackageForm(row.dataset.tuitionRowStudentId)
    })
  })

  document.querySelectorAll('[data-tuition-action="open-payment"]').forEach((button) => {
    button.addEventListener('click', () => {
      const student = students.find((item) => item.id === button.dataset.tuitionStudentId)
      const tuitionRecord = tuitionRecords.find((record) => record.studentId === button.dataset.tuitionStudentId)

      if (!student || !tuitionRecord) {
        return
      }

      tuitionPaymentFormState = createPaymentFormState(student, tuitionRecord)
      tuitionFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-action="open-debt"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const student = students.find((item) => item.id === button.dataset.tuitionStudentId)
      const tuitionRecord = tuitionRecords.find((record) => record.studentId === button.dataset.tuitionStudentId)

      if (!student || !tuitionRecord) {
        return
      }

      const debtAmount = Math.max(0, tuitionRecord.totalAmount - tuitionRecord.paidAmount)
      tuitionPaymentFormState = createPaymentFormState(
        student,
        tuitionRecord,
        debtAmount > 0 ? 'collect' : 'history',
      )
      tuitionFormState = null
      tuitionDetailState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-action="open-detail"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      tuitionDetailState = {
        studentId: button.dataset.tuitionStudentId,
      }
      tuitionFormState = null
      tuitionPaymentFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-action="cancel-form"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-payment-action="cancel-payment"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionPaymentFormState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-detail-action="close-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      tuitionDetailState = null
      render()
    })
  })

  document.querySelectorAll('[data-tuition-package-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!tuitionFormState) {
        return
      }

      const totalSessions = button.dataset.tuitionPackageSuggestion
      tuitionFormState = {
        ...tuitionFormState,
        values: {
          ...tuitionFormState.values,
          packageName: `Gói ${totalSessions} buổi`,
          totalSessions,
        },
        errors: {
          ...tuitionFormState.errors,
          packageName: undefined,
          totalSessions: undefined,
        },
      }
      render()
    })
  })

  document.querySelector('[data-tuition-action="open-renew"]')?.addEventListener('click', (event) => {
    const tuitionRecord = tuitionRecords.find((record) => record.id === event.currentTarget.dataset.tuitionId)
    const student = tuitionRecord
      ? students.find((item) => item.id === tuitionRecord.studentId)
      : null

    if (!student || !tuitionRecord) {
      return
    }

    tuitionFormState = createRenewTuitionFormState(student, tuitionRecord)
    tuitionPaymentFormState = null
    tuitionDetailState = null
    render()
  })

  document.querySelectorAll('[data-tuition-form-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!tuitionFormState) {
        return
      }

      tuitionFormState = {
        ...tuitionFormState,
        values: {
          ...tuitionFormState.values,
          [control.dataset.tuitionFormField]: control.value,
        },
        errors: {
          ...tuitionFormState.errors,
          [control.dataset.tuitionFormField]: undefined,
        },
      }
    })
  })

  document.querySelector('[data-tuition-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!tuitionFormState) {
      return
    }

    const errors = tuitionFormState.mode === 'renew'
      ? validateRenewTuitionForm(tuitionFormState.values)
      : validateTuitionForm(tuitionFormState.values)

    if (Object.keys(errors).length) {
      tuitionFormState = {
        ...tuitionFormState,
        errors,
      }
      render()
      return
    }

    const normalizedValues = normalizeTuitionFormValues(tuitionFormState.values)
    const currentRecord = tuitionRecords.find((record) => record.id === tuitionFormState.tuitionId)
    const nextRecord = tuitionFormState.mode === 'renew' && currentRecord
      ? createRenewedTuitionRecord(currentRecord, normalizedValues)
      : {
          id: tuitionFormState.tuitionId || `tuition-${tuitionFormState.studentId}-${Date.now()}`,
          studentId: tuitionFormState.studentId,
          ...normalizedValues,
          payments: currentRecord?.payments ?? [],
          currentTermNumber: currentRecord?.currentTermNumber ?? 1,
          currentTermId:
            currentRecord?.currentTermId ??
            `term-${tuitionFormState.tuitionId || tuitionFormState.studentId}-${Date.now()}`,
          startedAt: currentRecord?.startedAt ?? new Date().toISOString(),
          termHistory: currentRecord?.termHistory ?? [],
        }

    tuitionRecords = tuitionFormState.mode === 'edit' || tuitionFormState.mode === 'renew'
      ? tuitionRecords.map((record) => (record.id === nextRecord.id ? nextRecord : record))
      : [nextRecord, ...tuitionRecords]
    saveStoredTuition(tuitionRecords)
    notifications = syncTuitionNotifications(notifications)
    tuitionFormState = null
    render()
  })

  document.querySelectorAll('[data-tuition-payment-field]').forEach((control) => {
    control.addEventListener('input', () => {
      if (!tuitionPaymentFormState) {
        return
      }

      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        values: {
          ...tuitionPaymentFormState.values,
          [control.dataset.tuitionPaymentField]: control.value,
        },
        errors: {
          ...tuitionPaymentFormState.errors,
          [control.dataset.tuitionPaymentField]: undefined,
        },
      }

      if (control.dataset.tuitionPaymentField === 'amount') {
        render()
        const nextControl = document.querySelector('[data-tuition-payment-field="amount"]')
        nextControl?.focus()
      }
    })
  })

  document.querySelector('[data-tuition-payment-form]')?.addEventListener('submit', (event) => {
    event.preventDefault()

    if (!tuitionPaymentFormState) {
      return
    }

    const errors = validatePaymentForm(tuitionPaymentFormState.values)

    if (Object.keys(errors).length) {
      tuitionPaymentFormState = {
        ...tuitionPaymentFormState,
        errors,
      }
      render()
      return
    }

    const normalizedPayment = normalizePaymentFormValues(tuitionPaymentFormState.values)
    const paymentRecord = {
      id: `payment-${tuitionPaymentFormState.tuitionId}-${Date.now()}`,
      ...normalizedPayment,
      createdAt: new Date().toISOString(),
    }

    tuitionRecords = tuitionRecords.map((record) => {
      if (record.id !== tuitionPaymentFormState.tuitionId) {
        return record
      }

      return {
        ...record,
        paidAmount: record.paidAmount + normalizedPayment.amount,
        payments: [paymentRecord, ...(record.payments ?? [])],
      }
    })
    saveStoredTuition(tuitionRecords)
    notifications = syncTuitionNotifications(notifications)
    tuitionPaymentFormState = null
    render()
  })

  document.querySelectorAll('[data-student-filter]').forEach((control) => {
    control.addEventListener('input', () => {
      const filterName = control.dataset.studentFilter
      const cursorPosition = 'selectionStart' in control ? control.selectionStart : null

      studentFilters = {
        ...studentFilters,
        [filterName]: control.value,
      }
      render()

      const nextControl = document.querySelector(`[data-student-filter="${filterName}"]`)
      nextControl?.focus()

      if (cursorPosition !== null && 'setSelectionRange' in nextControl) {
        nextControl.setSelectionRange(cursorPosition, cursorPosition)
      }
    })
  })

  document.querySelectorAll('[data-student-sort]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const sortBy = button.dataset.studentSort

      studentFilters = {
        ...studentFilters,
        sortBy,
        sortDirection:
          studentFilters.sortBy === sortBy && studentFilters.sortDirection === 'asc' ? 'desc' : 'asc',
      }
      render()
    })
  })

  document.querySelector('[data-student-action="open-create"]')?.addEventListener('click', () => {
    studentFormState = createEmptyStudentFormState()
    render()
  })

  document.querySelectorAll('[data-student-action="open-edit"]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation()
      const student = students.find((item) => item.id === button.dataset.studentEditId)

      if (!student) {
        return
      }

      studentFormState = createEditStudentFormState(student)
      render()
    })
  })

  document.querySelectorAll('[data-student-action="edit-from-detail"]').forEach((button) => {
    button.addEventListener('click', () => {
      openStudentEditForm(button.dataset.studentEditId)
    })
  })

  document.querySelectorAll('[data-student-detail-action]').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
      event.stopImmediatePropagation()
    })

    button.addEventListener('mousedown', (event) => {
      event.stopPropagation()
      event.stopImmediatePropagation()
    })

    button.addEventListener('click', (event) => {
      event.stopPropagation()
      event.stopImmediatePropagation()
      const { studentDetailAction, studentId } = button.dataset

      if (studentDetailAction === 'open-care-notes') {
        setTimeout(() => openStudentSubWindow(studentId, 'student-care-notes'), 0)
        return
      }

      if (studentDetailAction === 'open-learning') {
        setTimeout(() => openStudentSubWindow(studentId, 'student-learning'), 0)
        return
      }

      if (studentDetailAction === 'clear-avatar') {
        const student = getStudentById(studentId)

        if (!student?.avatarUrl) {
          return
        }

        students = students.map((item) =>
          item.id === studentId
            ? {
                ...item,
                avatarUrl: '',
                updatedAt: new Date().toISOString(),
              }
            : item,
        )
        saveStoredStudents(students)
        render()
      }
    })
  })

  document.querySelectorAll('[data-student-form-field]').forEach((control) => {
    control.addEventListener('input', () => {
      let nextValue = control.value

      if (control.dataset.studentFormField === 'parentBirthYear') {
        nextValue = nextValue.replace(/\D/g, '').slice(0, 4)
        control.value = nextValue
      }

      studentFormState = {
        ...studentFormState,
        values: {
          ...studentFormState.values,
          [control.dataset.studentFormField]: nextValue,
        },
        errors: {
          ...studentFormState.errors,
          [control.dataset.studentFormField]: undefined,
        },
      }
      updateStudentFormSaveButton()
    })

    control.addEventListener('blur', () => {
      const fieldName = control.dataset.studentFormField

      if (fieldName === 'parentPhone') {
        control.value = formatStudentPhoneNumber(control.value)
      }

      studentFormState = {
        ...studentFormState,
        values: {
          ...studentFormState.values,
          [fieldName]: control.value,
        },
        errors: validateStudentForm({
          ...studentFormState.values,
          [fieldName]: control.value,
        }),
      }
      render()
    })
  })

  document.querySelectorAll('[data-student-form-step]').forEach((button) => {
    button.addEventListener('click', () => {
      studentFormState = {
        ...studentFormState,
        step: Number(button.dataset.studentFormStep),
      }
      render()
    })
  })

  document.querySelectorAll('[data-student-parent-note-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      const suggestion = button.dataset.studentParentNoteSuggestion
      const currentNotes = studentFormState.values.parentNotes.trim()
      const nextNotes = currentNotes ? `${currentNotes}\n${suggestion}` : suggestion

      studentFormState = {
        ...studentFormState,
        values: {
          ...studentFormState.values,
          parentNotes: nextNotes,
        },
        errors: {
          ...studentFormState.errors,
          parentNotes: undefined,
        },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-field]').forEach((control) => {
    control.addEventListener('input', () => {
      const studentId = control.dataset.careNoteStudentId
      careNoteDrafts = {
        ...careNoteDrafts,
        [studentId]: {
          ...(careNoteDrafts[studentId] ?? emptyCareNoteDraft),
          [control.dataset.careNoteField]: control.value,
          error: '',
        },
      }
    })
  })

  document.querySelectorAll('[data-care-note-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      const studentId = button.dataset.careNoteStudentId
      const currentDraft = careNoteDrafts[studentId] ?? emptyCareNoteDraft
      const suggestion = button.dataset.careNoteSuggestion
      const nextContent = currentDraft.content
        ? `${currentDraft.content}\n${suggestion}`
        : suggestion

      careNoteDrafts = {
        ...careNoteDrafts,
        [studentId]: {
          ...currentDraft,
          content: nextContent,
          error: '',
        },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="clear"]').forEach((button) => {
    button.addEventListener('click', () => {
      const { careNoteStudentId } = button.dataset
      careNoteDrafts = {
        ...careNoteDrafts,
        [careNoteStudentId]: { ...emptyCareNoteDraft },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => {
      const { careNoteStudentId, careNoteId } = button.dataset
      const student = getStudentById(careNoteStudentId)
      const note = student?.careNotes?.find((item) => item.id === careNoteId)

      if (!note) {
        return
      }

      careNoteDrafts = {
        ...careNoteDrafts,
        [careNoteStudentId]: {
          content: note.content ?? '',
          tag: note.tags?.[0] ?? '',
          error: '',
          editingNoteId: note.id,
        },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="delete"]').forEach((button) => {
    button.addEventListener('click', () => {
      const { careNoteStudentId, careNoteId } = button.dataset

      if (!window.confirm('Xóa ghi chú chăm sóc này?')) {
        return
      }

      students = students.map((student) => {
        if (student.id !== careNoteStudentId) {
          return student
        }

        const nextCareNotes = (student.careNotes ?? []).filter((note) => note.id !== careNoteId)
        const latestCareNote = getLatestCareNoteContent(nextCareNotes)

        return {
          ...student,
          careNotes: nextCareNotes,
          latestCareNote,
          updatedAt: new Date().toISOString(),
        }
      })
      saveStoredStudents(students)
      careNoteDrafts = {
        ...careNoteDrafts,
        [careNoteStudentId]: { ...emptyCareNoteDraft },
      }
      render()
    })
  })

  document.querySelectorAll('[data-care-note-action="save"]').forEach((button) => {
    button.addEventListener('click', () => {
      const studentId = button.dataset.careNoteStudentId
      const currentDraft = careNoteDrafts[studentId] ?? emptyCareNoteDraft
      const content = currentDraft.content.trim()

      if (!content) {
        careNoteDrafts = {
          ...careNoteDrafts,
          [studentId]: {
            ...currentDraft,
            error: 'Nội dung ghi chú không được để trống.',
          },
        }
        render()
        return
      }

      students = students.map((student) => {
        if (student.id !== studentId) {
          return student
        }

        const currentCareNotes = student.careNotes ?? []
        const nextCareNotes = currentDraft.editingNoteId
          ? currentCareNotes.map((note) =>
              note.id === currentDraft.editingNoteId
                ? {
                    ...note,
                    content,
                    tags: currentDraft.tag.trim() ? [currentDraft.tag.trim()] : [],
                    updatedAt: new Date().toISOString(),
                  }
                : note,
            )
          : [
              {
                id: `note_${Date.now()}`,
                createdAt: new Date().toISOString(),
                author: 'Admin DreamHome',
                content,
                tags: currentDraft.tag.trim() ? [currentDraft.tag.trim()] : [],
              },
              ...currentCareNotes,
            ]

        return {
          ...student,
          careNotes: nextCareNotes,
          latestCareNote: getLatestCareNoteContent(nextCareNotes),
          updatedAt: new Date().toISOString(),
        }
      })
      saveStoredStudents(students)
      careNoteDrafts = {
        ...careNoteDrafts,
        [studentId]: { ...emptyCareNoteDraft },
      }
      render()
    })
  })

  document.querySelector('[data-student-action="use-default-avatar"]')?.addEventListener('click', () => {
    studentFormState = {
      ...studentFormState,
      values: {
        ...studentFormState.values,
        avatarUrl: '',
      },
    }
    render()
  })

  document.querySelector('[data-student-action="cancel-form"]')?.addEventListener('click', () => {
    studentFormState = null
    render()
  })

  document.querySelector('[data-student-action="save-form"]')?.addEventListener('click', () => {
    if (!isStudentFormReady(studentFormState.values)) {
      studentFormState = {
        ...studentFormState,
        errors: validateStudentForm(studentFormState.values),
      }
      render()
      return
    }

    const errors = validateStudentForm(studentFormState.values)

    if (Object.keys(errors).length) {
      studentFormState = {
        ...studentFormState,
        errors,
      }
      render()
      return
    }

    if (studentFormState.mode === 'edit') {
      const existingStudent = students.find((student) => student.id === studentFormState.studentId)
      const updatedStudent = buildStudentFromForm(studentFormState.values, existingStudent)
      students = students.map((student) =>
        student.id === updatedStudent.id ? updatedStudent : student,
      )
      studentFilters = {
        ...studentFilters,
        selectedStudentId: updatedStudent.id,
      }
    } else {
      const newStudent = buildStudentFromForm(studentFormState.values)
      students = [newStudent, ...students]
      studentFilters = {
        ...studentFilters,
        selectedStudentId: newStudent.id,
      }
    }

    saveStoredStudents(students)
    studentFormState = null
    render()
  })

  document.querySelectorAll('[data-student-id]').forEach((row) => {
    row.addEventListener('click', () => {
      studentFilters = {
        ...studentFilters,
        selectedStudentId: row.dataset.studentId,
      }
      openStudentDetailWindow(row.dataset.studentId)
    })

    row.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return
      }

      event.preventDefault()
      studentFilters = {
        ...studentFilters,
        selectedStudentId: row.dataset.studentId,
      }
      openStudentDetailWindow(row.dataset.studentId)
    })
  })

  bindWindowDragging()
  bindShortcutDragging()
}

function openTuitionPackageForm(studentId) {
  const student = students.find((item) => item.id === studentId)

  if (!student) {
    return
  }

  const tuitionRecord = tuitionRecords.find((record) => record.studentId === student.id)
  tuitionFormState = tuitionRecord
    ? createEditTuitionFormState(student, tuitionRecord)
    : createEmptyTuitionFormState(student)
  tuitionPaymentFormState = null
  tuitionDetailState = null
  render()
}

function createRenewedTuitionRecord(currentRecord, normalizedValues) {
  const renewedAt = new Date().toISOString()
  const currentTermNumber = currentRecord.currentTermNumber || 1
  const nextTermNumber = currentTermNumber + 1
  const currentDebtAmount = Math.max(0, currentRecord.totalAmount - currentRecord.paidAmount)
  const archivedStatus =
    currentRecord.usedSessions >= currentRecord.totalSessions && currentDebtAmount === 0
      ? 'completed'
      : 'archived'
  const currentTermSnapshot = {
    id: currentRecord.currentTermId || `term-${currentRecord.id}-${currentTermNumber}`,
    termNumber: currentTermNumber,
    packageName: currentRecord.packageName,
    totalSessions: currentRecord.totalSessions,
    usedSessions: currentRecord.usedSessions,
    totalAmount: currentRecord.totalAmount,
    paidAmount: currentRecord.paidAmount,
    dueDate: currentRecord.dueDate,
    note: currentRecord.note,
    status: archivedStatus,
    startedAt: currentRecord.startedAt || '',
    endedAt: renewedAt,
    payments: currentRecord.payments ?? [],
  }
  const nextTermId = `term-${currentRecord.id}-${nextTermNumber}-${Date.now()}`
  const initialPayment = normalizedValues.paidAmount > 0
    ? {
        id: `payment-${nextTermId}-initial`,
        amount: normalizedValues.paidAmount,
        paidAt: renewedAt.slice(0, 10),
        method: 'cash',
        collectorName: 'Admin DreamHome',
        note: 'Đóng ban đầu khi tạo kỳ mới.',
        createdAt: renewedAt,
      }
    : null

  return {
    ...currentRecord,
    ...normalizedValues,
    currentTermNumber: nextTermNumber,
    currentTermId: nextTermId,
    startedAt: renewedAt,
    payments: initialPayment ? [initialPayment] : [],
    termHistory: [...(currentRecord.termHistory ?? []), currentTermSnapshot],
  }
}

function bindNotificationOutsidePointer() {
  if (notificationOutsidePointerBound) {
    return
  }

  document.addEventListener('pointerdown', (event) => {
    if (!isNotificationCenterOpen) {
      return
    }

    const target = event.target

    if (
      target.closest?.('.notification-center') ||
      target.closest?.('[data-action="toggle-notifications"]')
    ) {
      return
    }

    isNotificationCenterOpen = false
    render()
  })
  notificationOutsidePointerBound = true
}

function getNotificationPanelPosition(bellButton) {
  const bellRect = bellButton.getBoundingClientRect()
  const panelWidth = Math.min(420, Math.max(320, window.innerWidth - 24))
  const right = Math.max(12, window.innerWidth - bellRect.right)
  const maxRight = Math.max(12, window.innerWidth - panelWidth - 12)
  const bottom = Math.max(56, window.innerHeight - bellRect.top + 8)

  return {
    right: Math.min(right, maxRight),
    bottom,
  }
}

function getUnreadNotificationCount() {
  return notifications.filter((notification) => !notification.read).length
}

function syncTuitionNotifications(currentNotifications) {
  const deletedIds = new Set(deletedNotificationIds)
  const candidateTuitionNotifications = buildTuitionRows(students, tuitionRecords)
    .map((row) => createTuitionWarningNotification(row))
    .filter(Boolean)
  const currentTuitionWarningIds = new Set(candidateTuitionNotifications.map((notification) => notification.id))
  const retainedNotifications = currentNotifications.filter(
    (notification) =>
      !String(notification.id).startsWith('tuition-warning-') ||
      currentTuitionWarningIds.has(notification.id),
  )
  const existingNotificationIds = new Set(retainedNotifications.map((notification) => notification.id))
  const tuitionNotifications = candidateTuitionNotifications
    .filter(
      (notification) =>
        notification &&
        !existingNotificationIds.has(notification.id) &&
        !deletedIds.has(notification.id),
    )

  if (!tuitionNotifications.length && retainedNotifications.length === currentNotifications.length) {
    return currentNotifications
  }

  const nextNotifications = [...tuitionNotifications, ...retainedNotifications]
  saveStoredNotifications(nextNotifications)
  return nextNotifications
}

function markNotificationRead(notificationId) {
  const targetNotification = notifications.find((notification) => notification.id === notificationId)

  if (!targetNotification || targetNotification.read) {
    return
  }

  notifications = notifications.map((notification) =>
    notification.id === notificationId ? { ...notification, read: true } : notification,
  )
  saveStoredNotifications(notifications)
  render()
}

function getNotificationSourceLabel(sourceModule) {
  const sourceLabels = {
    system: 'Hệ thống',
    'hoc-phi': 'Học phí',
    'hoc-vien': 'Học viên demo',
    schedule: 'Lịch học demo',
    inventory: 'Kho demo',
    report: 'Báo cáo demo',
  }

  return sourceLabels[sourceModule] ?? sourceModule
}

function formatNotificationTime(createdAt) {
  const createdDate = new Date(createdAt)
  const elapsedMs = Date.now() - createdDate.getTime()
  const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000))

  if (elapsedMinutes < 1) {
    return 'Vừa xong'
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} phút trước`
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60)

  if (elapsedHours < 24) {
    return `${elapsedHours} giờ trước`
  }

  return createdDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function bindShortcutDragging() {
  document.querySelectorAll('[data-shortcut-id]').forEach((shortcut) => {
    shortcut.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return
      }

      shortcutDragState = {
        id: shortcut.dataset.shortcutId,
        startX: event.clientX,
        startY: event.clientY,
        isDragging: false,
        dropTargetId: null,
      }
    })
  })

  if (!shortcutDocumentDragBound) {
    document.addEventListener('pointermove', handleShortcutPointerMove)
    document.addEventListener('pointerup', handleShortcutPointerUp)
    shortcutDocumentDragBound = true
  }
}

function handleShortcutPointerMove(event) {
  if (!shortcutDragState) {
    return
  }

  const distanceX = Math.abs(event.clientX - shortcutDragState.startX)
  const distanceY = Math.abs(event.clientY - shortcutDragState.startY)

  if (!shortcutDragState.isDragging && distanceX + distanceY < 8) {
    return
  }

  shortcutDragState.isDragging = true
  suppressNextModuleClick = true

  const draggedShortcut = document.querySelector(
    `[data-shortcut-id="${shortcutDragState.id}"]`,
  )
  draggedShortcut?.classList.add('dragging')

  document.querySelector('.module-list')?.classList.add('drag-active')
  document.querySelectorAll('[data-shortcut-id]').forEach((shortcut) => {
    shortcut.classList.remove('drop-target')
  })

  const elementUnderPointer = document.elementFromPoint(event.clientX, event.clientY)
  const targetShortcut = elementUnderPointer?.closest('[data-shortcut-id]')
  const targetId = targetShortcut?.dataset.shortcutId

  shortcutDragState.dropTargetId =
    targetId && targetId !== shortcutDragState.id ? targetId : null

  if (shortcutDragState.dropTargetId) {
    targetShortcut.classList.add('drop-target')
  }
}

function handleShortcutPointerUp() {
  if (!shortcutDragState) {
    return
  }

  const { id, isDragging, dropTargetId } = shortcutDragState

  document.querySelector('.module-list')?.classList.remove('drag-active')
  document.querySelectorAll('[data-shortcut-id]').forEach((shortcut) => {
    shortcut.classList.remove('dragging', 'drop-target')
  })

  shortcutDragState = null

  if (!isDragging) {
    return
  }

  suppressModuleClickOnce()

  if (dropTargetId) {
    moveShortcutBefore(id, dropTargetId)
  }
}

function suppressModuleClickOnce() {
  suppressNextModuleClick = true

  setTimeout(() => {
    suppressNextModuleClick = false
  }, 0)
}

function moveShortcutBefore(draggedId, targetId) {
  const orderWithoutDragged = desktopModuleOrder.filter((moduleId) => moduleId !== draggedId)
  const targetIndex = orderWithoutDragged.indexOf(targetId)

  if (targetIndex === -1) {
    return
  }

  orderWithoutDragged.splice(targetIndex, 0, draggedId)
  desktopModuleOrder = orderWithoutDragged
  saveDesktopModuleOrder(desktopModuleOrder)
  render()
}

function updateStudentFormSaveButton() {
  const saveButton = document.querySelector('[data-student-action="save-form"]')

  if (!saveButton || !studentFormState) {
    return
  }

  saveButton.disabled = !isStudentFormReady(studentFormState.values)
}

function bindWindowDragging() {
  document.querySelectorAll('[data-drag-window-id]').forEach((titlebar) => {
    titlebar.addEventListener('pointerdown', (event) => {
      const windowId = titlebar.dataset.dragWindowId
      const windowItem = openWindows.find((item) => item.id === windowId)

      if (!windowItem || windowItem.maximized || event.target.closest('button')) {
        return
      }

      event.preventDefault()
      focusWindow(windowId)
      const focusedWindow = openWindows.find((item) => item.id === windowId)
      const draggedWindow = document.querySelector(`[data-window-id="${windowId}"]`)

      if (focusedWindow && draggedWindow) {
        draggedWindow.style.zIndex = focusedWindow.zIndex
      }

      const startX = event.clientX
      const startY = event.clientY
      const startWindowX = windowItem.x
      const startWindowY = windowItem.y

      function handlePointerMove(moveEvent) {
        const desktopBounds = document.querySelector('.desktop-area').getBoundingClientRect()
        const nextX = startWindowX + moveEvent.clientX - startX
        const nextY = startWindowY + moveEvent.clientY - startY
        const maxX = Math.max(8, desktopBounds.width - windowItem.width - 8)
        const maxY = Math.max(8, desktopBounds.height - windowItem.height - 8)
        const clampedX = Math.min(Math.max(8, nextX), maxX)
        const clampedY = Math.min(Math.max(8, nextY), maxY)
        const windowElement = document.querySelector(`[data-window-id="${windowId}"]`)

        if (windowElement) {
          windowElement.style.left = `${clampedX}px`
          windowElement.style.top = `${clampedY}px`
        }

        openWindows = openWindows.map((item) =>
          item.id === windowId ? { ...item, x: clampedX, y: clampedY } : item,
        )
      }

      function handlePointerUp() {
        document.removeEventListener('pointermove', handlePointerMove)
        document.removeEventListener('pointerup', handlePointerUp)
      }

      document.addEventListener('pointermove', handlePointerMove)
      document.addEventListener('pointerup', handlePointerUp)
    })
  })
}

function updateClock() {
  const clock = document.querySelector('#taskbar-clock')

  if (!clock) {
    return
  }

  const now = new Date()
  const date = now.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const time = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  clock.dateTime = now.toISOString()
  clock.textContent = `${date} ${time}`
}

render()

if (window.__ichessClockTimer) {
  clearInterval(window.__ichessClockTimer)
}

window.__ichessClockTimer = setInterval(updateClock, 1000)
