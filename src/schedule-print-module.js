import {
  CENTER_CALENDAR_ITEM_TYPE_LABELS,
  CENTER_CALENDAR_ITEM_TYPES,
  getCenterCalendarItemsForRange,
  getCenterCalendarPresetByColorKey,
  getCenterCalendarPresetForType,
  getCenterCalendarTagById,
} from './center-calendar-data.js'
import {
  expandWeeklyCenterCalendarOccurrences,
  isWeeklyRecurringCenterCalendarItem,
} from './center-calendar-recurrence.js'
import { getVisibleScheduleSessions } from './schedule-module.js'

export const SCHEDULE_PRINT_FILTER_ALL = 'all'
export const SCHEDULE_PRINT_FILTER_CURRENT = 'current'

const WEEK_DAYS = [
  ['monday', 'Thứ Hai'],
  ['tuesday', 'Thứ Ba'],
  ['wednesday', 'Thứ Tư'],
  ['thursday', 'Thứ Năm'],
  ['friday', 'Thứ Sáu'],
  ['saturday', 'Thứ Bảy'],
  ['sunday', 'Chủ nhật'],
]

const ACTIVITY_ALL_FILTER = 'all'
const ACTIVITY_NO_TAG_FILTER = '__none__'

export function createSchedulePrintSnapshot({
  centerId = '',
  centerName = '',
  weekStartDate = '',
  sessions = [],
  classSessions = [],
  centerCalendarItems = [],
  centerCalendarTags = [],
  teachers = [],
  activityFilters = {},
  createdAt = new Date().toISOString(),
} = {}) {
  const normalizedWeekStart = normalizeDateString(weekStartDate) || getCurrentWeekStartDate()
  const days = getWeekDays(normalizedWeekStart)
  const weekEndDate = addDays(normalizedWeekStart, 6)
  const rangeStartAt = `${normalizedWeekStart}T00:00:00.000Z`
  const rangeEndAt = `${addDays(normalizedWeekStart, 7)}T00:00:00.000Z`
  const visibleSessions = getVisibleScheduleSessions(sessions, normalizedWeekStart, classSessions)
  const activities = getCenterCalendarItemsForPrintRange(centerCalendarItems, rangeStartAt, rangeEndAt)
  const teacherLookup = new Map((Array.isArray(teachers) ? teachers : []).map((teacher) => [String(teacher.id), teacher]))
  const tagLookup = new Map((Array.isArray(centerCalendarTags) ? centerCalendarTags : []).map((tag) => [String(tag.id), tag]))
  const sessionEntries = visibleSessions.map((session) => createPrintSessionEntry(session, teacherLookup))
  const activityEntries = activities.map((item) => createPrintActivityEntry(item, tagLookup))
  const entries = [...sessionEntries, ...activityEntries].sort(comparePrintEntries)
  const groupedDays = days.map((day) => ({
    ...day,
    entries: entries.filter((entry) => entry.date === day.date),
  }))

  return deepFreeze({
    kind: 'schedule-week-print-snapshot',
    centerId: String(centerId || '').trim(),
    centerName: repairSchedulePrintDisplayText(centerName || centerId || 'Cơ sở'),
    weekStartDate: normalizedWeekStart,
    weekEndDate,
    weekRangeLabel: `${formatDisplayDate(normalizedWeekStart)} - ${formatDisplayDate(weekEndDate)}`,
    createdAt,
    createdAtLabel: formatDateTime(createdAt),
    timezone: 'Asia/Ho_Chi_Minh',
    activityFilters: normalizeActivityFilters(activityFilters),
    days: groupedDays,
    entries,
    legend: createSchedulePrintLegend(entries),
  })
}

export function getSchedulePrintFilteredSnapshot(snapshot, filterMode = SCHEDULE_PRINT_FILTER_ALL) {
  const mode = filterMode === SCHEDULE_PRINT_FILTER_CURRENT ? SCHEDULE_PRINT_FILTER_CURRENT : SCHEDULE_PRINT_FILTER_ALL
  const filters = snapshot?.activityFilters || normalizeActivityFilters()
  const entries = (Array.isArray(snapshot?.entries) ? snapshot.entries : []).filter((entry) => {
    if (entry.sourceKind !== 'activity' || mode === SCHEDULE_PRINT_FILTER_ALL) {
      return true
    }

    const typeMatches = filters.itemType === ACTIVITY_ALL_FILTER || entry.itemType === filters.itemType
    const tagMatches = filters.tagId === ACTIVITY_ALL_FILTER ||
      (filters.tagId === ACTIVITY_NO_TAG_FILTER ? !entry.tagId : entry.tagId === filters.tagId)

    return typeMatches && tagMatches
  })

  return {
    ...snapshot,
    filterMode: mode,
    filterModeLabel: getSchedulePrintFilterLabel(mode),
    days: (Array.isArray(snapshot?.days) ? snapshot.days : []).map((day) => ({
      ...day,
      entries: entries.filter((entry) => entry.date === day.date),
    })),
    entries,
    legend: createSchedulePrintLegend(entries),
  }
}

export function renderSchedulePrintDocument(snapshot = null) {
  if (!snapshot) {
    return ''
  }

  const dayCount = snapshot.days?.length || 0
  const totalCount = snapshot.entries?.length || 0

  return `
    <section class="schedule-print-document" data-schedule-print-document aria-label="Thời khóa biểu tuần">
      <header class="schedule-print-document-header">
        <div>
          <p class="schedule-print-kicker">Thời khóa biểu tuần</p>
          <h1>${escapeHtml(snapshot.centerName)}</h1>
          <p>${escapeHtml(snapshot.weekRangeLabel)} · ${escapeHtml(snapshot.timezone)}</p>
        </div>
        <div class="schedule-print-meta">
          <span>Thời điểm tạo: ${escapeHtml(snapshot.createdAtLabel)}</span>
          <span>${escapeHtml(snapshot.filterModeLabel || getSchedulePrintFilterLabel(snapshot.filterMode))}</span>
        </div>
      </header>
      ${renderSchedulePrintLegend(snapshot.legend)}
      ${
        totalCount
          ? `
            <div class="schedule-print-week-grid" style="--schedule-print-day-count: ${dayCount};">
              ${snapshot.days.map(renderSchedulePrintDay).join('')}
            </div>
          `
          : '<p class="schedule-print-empty">Không có nội dung trong tuần này</p>'
      }
    </section>
  `
}

export function getSchedulePrintDocumentTitle(snapshot = null) {
  if (!snapshot) {
    return 'TKB'
  }

  const centerSlug = slugify(snapshot.centerName || snapshot.centerId || 'center')
  return `TKB-${centerSlug}-${snapshot.weekStartDate}_${snapshot.weekEndDate}`
}

function getCenterCalendarItemsForPrintRange(centerCalendarItems = [], rangeStartAt, rangeEndAt) {
  const sourceItems = Array.isArray(centerCalendarItems) ? centerCalendarItems : []
  const singleItems = getCenterCalendarItemsForRange(
    sourceItems.filter((item) => !isWeeklyRecurringCenterCalendarItem(item)),
    rangeStartAt,
    rangeEndAt,
  )
  const recurringOccurrences = expandWeeklyCenterCalendarOccurrences(
    sourceItems.filter((item) => isWeeklyRecurringCenterCalendarItem(item)),
    {
      rangeStart: rangeStartAt,
      rangeEnd: rangeEndAt,
    },
  )

  return [...singleItems, ...recurringOccurrences].sort(compareCalendarItems)
}

function createPrintSessionEntry(session, teacherLookup) {
  const isClassSlot = Boolean(session.isEmptyClassSessionSlot || session.classSessionId || session.scheduleType === 'recurring')
  const teacher = session.teacherId ? teacherLookup.get(String(session.teacherId)) : null
  const title = repairSchedulePrintDisplayText(session.title || session.groupName || session.classSessionLabel || session.displayLabel || session.name || 'Chưa gán thông tin')
  const teacherName = repairSchedulePrintDisplayText(teacher?.displayName || teacher?.fullName || session.teacherName || '')
  const room = repairSchedulePrintDisplayText(session.room || session.location || '')
  const date = normalizeDateString(session.occurrenceDate || session.date) || ''
  const startAt = date && session.startTime ? `${date}T${session.startTime}:00.000Z` : ''
  const endDate = date && session.endTime && session.startTime && session.endTime <= session.startTime ? addDays(date, 1) : date
  const endAt = endDate && session.endTime ? `${endDate}T${session.endTime}:00.000Z` : ''

  return {
    id: `session-${session.id || title}-${date}`,
    sourceKind: isClassSlot ? 'class' : 'session',
    label: isClassSlot ? 'Lớp học' : 'Buổi học',
    itemType: isClassSlot ? 'class' : 'session',
    title,
    date,
    startAt,
    endAt,
    timeLabel: formatTimeRange(session.startTime, session.endTime),
    room,
    teacherName,
    isAllDay: false,
    isCrossMidnight: Boolean(session.startTime && session.endTime && session.endTime <= session.startTime),
    isCancelled: Boolean(session.isCancelled || session.status === 'cancelled'),
    isRecurring: session.scheduleType === 'recurring',
    color: isClassSlot ? '#2563eb' : '#0f766e',
    sortKey: `${date}-${session.startTime || '99:99'}-${title}`,
  }
}

function createPrintActivityEntry(item, tagLookup) {
  const preset = getCenterCalendarPresetByColorKey(item.colorKey, item.itemType)
  const tag = item.tagId ? getCenterCalendarTagById(Array.from(tagLookup.values()), item.tagId) : null
  const tagPreset = tag ? getCenterCalendarPresetByColorKey(tag.colorKey, tag.defaultItemType || item.itemType) : null
  const startDate = getDateFromIso(item.startAt)
  const endDate = getDateFromIso(item.endAt)
  const startTime = getTimeFromIso(item.startAt)
  const endTime = getTimeFromIso(item.endAt)
  const isCrossMidnight = Boolean(!item.allDay && startDate && endDate && startDate !== endDate)
  const typeLabel = CENTER_CALENDAR_ITEM_TYPE_LABELS[item.itemType] || CENTER_CALENDAR_ITEM_TYPE_LABELS.other

  return {
    id: item.id,
    sourceKind: 'activity',
    label: typeLabel,
    itemType: item.itemType || 'other',
    title: repairSchedulePrintDisplayText(item.title || typeLabel),
    date: startDate,
    startAt: item.startAt,
    endAt: item.endAt,
    timeLabel: item.allDay ? 'Cả ngày' : `${startTime || ''}-${endTime || ''}${isCrossMidnight ? ' hôm sau' : ''}`,
    room: repairSchedulePrintDisplayText(item.location || item.roomId || ''),
    teacherName: '',
    tagId: item.tagId || '',
    tagLabel: repairSchedulePrintDisplayText(tag?.label || item.tagLabel || ''),
    tagColor: tagPreset?.color || '',
    isAllDay: Boolean(item.allDay),
    isCrossMidnight,
    isCancelled: Boolean(item.isCancelled),
    isRecurring: Boolean(item.isVirtualOccurrence),
    color: item.customColor || preset.color,
    sortKey: `${startDate}-${item.allDay ? '00:00' : startTime || '99:99'}-${repairSchedulePrintDisplayText(item.title || '')}`,
  }
}

function renderSchedulePrintDay(day) {
  const allDayEntries = day.entries.filter((entry) => entry.isAllDay)
  const timedEntries = day.entries.filter((entry) => !entry.isAllDay)

  return `
    <article class="schedule-print-day">
      <header>
        <strong>${escapeHtml(day.label)}</strong>
        <span>${escapeHtml(formatDisplayDate(day.date))}</span>
      </header>
      ${
        allDayEntries.length
          ? `
            <div class="schedule-print-all-day">
              <span>Cả ngày</span>
              ${allDayEntries.map(renderSchedulePrintCard).join('')}
            </div>
          `
          : ''
      }
      <div class="schedule-print-day-items">
        ${timedEntries.length ? timedEntries.map(renderSchedulePrintCard).join('') : '<p class="schedule-print-day-empty">Không có lịch theo giờ</p>'}
      </div>
    </article>
  `
}

function renderSchedulePrintCard(entry) {
  return `
    <section class="schedule-print-card is-${escapeAttribute(entry.sourceKind)} ${entry.isCancelled ? 'is-cancelled' : ''}" style="--schedule-print-entry-color: ${escapeAttribute(entry.color || '#64748b')};">
      <div class="schedule-print-card-top">
        <span class="schedule-print-card-time">${escapeHtml(entry.timeLabel || 'Chưa có giờ')}</span>
        <span class="schedule-print-card-type">${escapeHtml(entry.label)}</span>
      </div>
      <strong>${escapeHtml(entry.title)}</strong>
      <p>${escapeHtml([entry.room, entry.teacherName].filter(Boolean).join(' · '))}</p>
      <div class="schedule-print-card-badges">
        ${entry.tagLabel ? `<span class="schedule-print-tag" style="--schedule-print-tag-color: ${escapeAttribute(entry.tagColor || entry.color || '#64748b')};">${escapeHtml(entry.tagLabel)}</span>` : ''}
        ${entry.isRecurring ? '<span>Lặp hàng tuần</span>' : ''}
        ${entry.isCancelled ? '<span>Đã hủy</span>' : ''}
      </div>
    </section>
  `
}

function renderSchedulePrintLegend(legend = {}) {
  const typeItems = Array.isArray(legend.types) ? legend.types : []
  const tagItems = Array.isArray(legend.tags) ? legend.tags : []

  return `
    <aside class="schedule-print-legend" aria-label="Chú giải">
      <div>
        <strong>Loại nội dung</strong>
        ${typeItems.map((item) => `<span style="--schedule-print-entry-color: ${escapeAttribute(item.color)};"><i></i>${escapeHtml(item.label)}</span>`).join('')}
      </div>
      <div>
        <strong>Nhãn</strong>
        ${tagItems.length ? tagItems.map((item) => `<span class="schedule-print-tag" style="--schedule-print-tag-color: ${escapeAttribute(item.color)};">${escapeHtml(item.label)}</span>`).join('') : '<em>Không có nhãn</em>'}
      </div>
      <div>
        <strong>Marker</strong>
        ${legend.hasRecurring ? '<span>Lặp hàng tuần</span>' : ''}
        ${legend.hasCancelled ? '<span>Đã hủy</span>' : ''}
      </div>
    </aside>
  `
}

function createSchedulePrintLegend(entries = []) {
  const typeMap = new Map()
  const tagMap = new Map()
  entries.forEach((entry) => {
    if (!typeMap.has(entry.itemType)) {
      const fallbackPreset = CENTER_CALENDAR_ITEM_TYPES.includes(entry.itemType)
        ? getCenterCalendarPresetForType(entry.itemType)
        : null
      typeMap.set(entry.itemType, {
        key: entry.itemType,
        label: entry.label,
        color: entry.color || fallbackPreset?.color || '#64748b',
      })
    }

    if (entry.tagLabel && !tagMap.has(entry.tagId || entry.tagLabel)) {
      tagMap.set(entry.tagId || entry.tagLabel, {
        label: entry.tagLabel,
        color: entry.tagColor || entry.color || '#64748b',
      })
    }
  })

  return {
    types: Array.from(typeMap.values()),
    tags: Array.from(tagMap.values()).slice(0, 12),
    hiddenTagCount: Math.max(0, tagMap.size - 12),
    hasRecurring: entries.some((entry) => entry.isRecurring),
    hasCancelled: entries.some((entry) => entry.isCancelled),
  }
}

function getSchedulePrintFilterLabel(filterMode) {
  return filterMode === SCHEDULE_PRINT_FILTER_CURRENT ? 'Theo bộ lọc hiện tại' : 'Toàn bộ thời khóa biểu tuần'
}

function normalizeActivityFilters(filters = {}) {
  const itemType = CENTER_CALENDAR_ITEM_TYPES.includes(filters.itemType) ? filters.itemType : ACTIVITY_ALL_FILTER
  const tagId = String(filters.tagId || ACTIVITY_ALL_FILTER).trim() || ACTIVITY_ALL_FILTER

  return { itemType, tagId }
}

function getWeekDays(weekStartDate) {
  return WEEK_DAYS.map(([id, label], index) => ({
    id,
    label,
    date: addDays(weekStartDate, index),
  }))
}

function comparePrintEntries(first, second) {
  return String(first.sortKey || '').localeCompare(String(second.sortKey || ''), 'vi', { sensitivity: 'base' }) ||
    String(first.id || '').localeCompare(String(second.id || ''))
}

function compareCalendarItems(first, second) {
  return String(first.startAt || '').localeCompare(String(second.startAt || '')) ||
    String(first.title || '').localeCompare(String(second.title || ''), 'vi', { sensitivity: 'base' }) ||
    String(first.id || '').localeCompare(String(second.id || ''))
}

function formatTimeRange(startTime, endTime) {
  if (!startTime && !endTime) {
    return 'Chưa có giờ'
  }

  return `${startTime || ''}-${endTime || ''}${startTime && endTime && endTime <= startTime ? ' hôm sau' : ''}`
}

function formatDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatDisplayDate(value) {
  const date = parseLocalDate(value)
  if (!date) {
    return ''
  }

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getDateFromIso(value) {
  return String(value || '').slice(0, 10)
}

function getTimeFromIso(value) {
  return String(value || '').slice(11, 16)
}

function normalizeDateString(value) {
  const text = String(value || '').trim().slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function getCurrentWeekStartDate() {
  const date = new Date()
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return formatDate(date)
}

function addDays(value, amount) {
  const date = parseLocalDate(value)
  if (!date) {
    return ''
  }
  date.setDate(date.getDate() + amount)
  return formatDate(date)
}

function parseLocalDate(value) {
  const normalized = normalizeDateString(value)
  if (!normalized) {
    return null
  }
  const [year, month, day] = normalized.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function slugify(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'center'
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') {
    return value
  }

  Object.freeze(value)
  Object.values(value).forEach((child) => {
    if (child && typeof child === 'object' && !Object.isFrozen(child)) {
      deepFreeze(child)
    }
  })
  return value
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

function repairSchedulePrintDisplayText(value) {
  const text = String(value ?? '').trim().normalize('NFC')

  if (!text) {
    return ''
  }

  if (isMojibakeNewLessonTitle(text)) {
    return 'Buổi học mới'
  }

  return text
}

function isMojibakeNewLessonTitle(text) {
  const lowerText = text.toLowerCase()
  const hasMojibakeMarker = [
    '\u00c3',
    '\u00c2',
    '\u0102',
    '\u00a1\u00c2',
    '\u00c2\u00bb',
    '\u00e2\u20ac',
    '\u00bb',
    '\u2022',
    '\u009d',
    '\u203a',
  ].some((marker) => text.includes(marker))

  return hasMojibakeMarker && lowerText.includes('bu') && lowerText.includes('h') && lowerText.includes('m')
}
