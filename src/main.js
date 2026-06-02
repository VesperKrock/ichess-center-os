import './styles.css'
import { modules } from './modules.js'
import {
  getDesktopModuleOrder,
  getStoredStudents,
  getViewMode,
  saveDesktopModuleOrder,
  saveStoredStudents,
  saveViewMode,
} from './storage.js'
import { sampleStudents } from './student-data.js'
import { getStudentDetailWindowTitle, renderStudentDetail } from './student-detail.js'
import {
  buildStudentFromForm,
  createEditStudentFormState,
  createEmptyStudentFormState,
  initialStudentFilters,
  renderStudentModule,
  validateStudentForm,
} from './student-module.js'

const app = document.querySelector('#app')

let currentViewMode = getViewMode()
let isStartMenuOpen = false
let isWindowOverflowOpen = false
let openWindows = []
let nextWindowNumber = 1
let topZIndex = 20
let desktopModuleOrder = getDesktopModuleOrder(modules.map((moduleItem) => moduleItem.id))
let shortcutDragState = null
let suppressNextModuleClick = false
let shortcutDocumentDragBound = false
let studentFilters = { ...initialStudentFilters }
let students = getStoredStudents(sampleStudents)
let studentFormState = null

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
  return openWindows.map((windowItem) => renderModuleWindow(windowItem)).join('')
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

  const moduleItem = modules.find((item) => item.id === windowItem.moduleId)

  if (!moduleItem) {
    return ''
  }

  if (moduleItem.id === 'hoc-vien') {
    return renderStudentModule(students, studentFilters, studentFormState)
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

  const moduleItem = modules.find((item) => item.id === windowItem.moduleId)
  return moduleItem?.name
}

function getStudentById(studentId) {
  return students.find((student) => student.id === studentId)
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
  const windowButtons = visibleWindows
    .map((windowItem) => {
      const title = getWindowTitle(windowItem)

      if (!title) {
        return ''
      }

      return `
        <button
          class="taskbar-window ${windowItem.minimized ? 'minimized' : ''}"
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
      </div>
      ${isStartMenuOpen ? renderStartMenu() : ''}
      ${isWindowOverflowOpen ? renderWindowOverflowMenu(overflowWindows) : ''}
    </footer>
  `
}

function renderWindowOverflowMenu(overflowWindows) {
  const windowItems = overflowWindows
    .map((windowItem) => {
      const title = getWindowTitle(windowItem)

      if (!title) {
        return ''
      }

      return `
        <button
          class="${windowItem.minimized ? 'minimized' : ''}"
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
    maximized: false,
    restoreBounds: null,
  })
  nextWindowNumber += 1
  isStartMenuOpen = false
  isWindowOverflowOpen = false
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
    maximized: false,
    restoreBounds: null,
  })
  nextWindowNumber += 1
  isStartMenuOpen = false
  isWindowOverflowOpen = false
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
      maximized: false,
      restoreBounds: null,
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
  openWindows = openWindows.map((windowItem) =>
    windowItem.id === windowId
      ? { ...windowItem, minimized: false, zIndex: ++topZIndex }
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
  document.querySelectorAll('[data-view-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      currentViewMode = button.dataset.viewMode
      saveViewMode(currentViewMode)
      isStartMenuOpen = false
      isWindowOverflowOpen = false
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
    render()
  })

  document.querySelector('[data-action="toggle-window-overflow"]')?.addEventListener('click', () => {
    isWindowOverflowOpen = !isWindowOverflowOpen
    isStartMenuOpen = false
    render()
  })

  document.querySelector('[data-action="show-desktop"]')?.addEventListener('click', () => {
    showDesktop()
  })

  document.querySelectorAll('[data-window-id]').forEach((windowElement) => {
    windowElement.addEventListener('pointerdown', () => {
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
      render()
    })
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

  document.querySelectorAll('[data-student-form-field]').forEach((control) => {
    control.addEventListener('input', () => {
      studentFormState = {
        ...studentFormState,
        values: {
          ...studentFormState.values,
          [control.dataset.studentFormField]: control.value,
        },
        errors: {
          ...studentFormState.errors,
          [control.dataset.studentFormField]: undefined,
        },
      }
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
