export const CENTER_CALENDAR_RECURRENCE_TIMEZONE = 'Asia/Ho_Chi_Minh'
export const CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES = 52
export const CENTER_CALENDAR_WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const WEEKDAY_INDEX_BY_KEY = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

const WEEKDAY_KEY_BY_INDEX = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
}

const WEEKDAY_LABELS = {
  mon: 'Thứ Hai',
  tue: 'Thứ Ba',
  wed: 'Thứ Tư',
  thu: 'Thứ Năm',
  fri: 'Thứ Sáu',
  sat: 'Thứ Bảy',
  sun: 'Chủ nhật',
}

const WEEKDAY_SHORT_LABELS = {
  mon: 'T2',
  tue: 'T3',
  wed: 'T4',
  thu: 'T5',
  fri: 'T6',
  sat: 'T7',
  sun: 'CN',
}

export function normalizeCenterCalendarRecurrenceRule(rule = null) {
  if (!rule || typeof rule !== 'object') {
    return null
  }

  const frequency = normalizeText(rule.frequency || 'none')
  if (!frequency || frequency === 'none') {
    return null
  }

  const daysOfWeek = normalizeWeekdayKeys(rule.daysOfWeek)
  const endMode = normalizeText(rule.endMode)

  return {
    frequency,
    interval: Number(rule.interval),
    daysOfWeek,
    endMode,
    untilDate: endMode === 'until' ? normalizeDateString(rule.untilDate) : null,
    count: endMode === 'count' ? normalizeCount(rule.count) : null,
    timezone: normalizeText(rule.timezone || CENTER_CALENDAR_RECURRENCE_TIMEZONE),
  }
}

export function validateCenterCalendarRecurrenceRule(rule = null, options = {}) {
  const errors = {}

  if (!rule || typeof rule !== 'object' || normalizeText(rule.frequency || 'none') === 'none') {
    return errors
  }

  const normalized = normalizeCenterCalendarRecurrenceRule(rule)
  const anchorDate = normalizeDateString(options.anchorDate || getLocalDateString(options.anchorStartAt))

  if (!normalized || normalized.frequency !== 'weekly') {
    errors.recurrenceFrequency = 'F23.5E2A chỉ hỗ trợ lặp hàng tuần.'
    return errors
  }

  if (normalized.interval !== 1) {
    errors.recurrenceRule = 'Khoảng lặp hàng tuần phải là 1.'
  }

  if (normalized.timezone !== CENTER_CALENDAR_RECURRENCE_TIMEZONE) {
    errors.recurrenceRule = 'Múi giờ lặp lại phải là Asia/Ho_Chi_Minh.'
  }

  if (getInvalidWeekdayKeys(rule.daysOfWeek).length) {
    errors.recurrenceDays = 'Thứ lặp lại không hợp lệ.'
  }

  if (!normalized.daysOfWeek.length) {
    errors.recurrenceDays = 'Chọn ít nhất một thứ trong tuần.'
  }

  if (!['until', 'count'].includes(normalized.endMode)) {
    errors.recurrenceEndMode = 'Chọn cách kết thúc lặp lại.'
  }

  if (normalized.endMode === 'until') {
    if (!normalized.untilDate) {
      errors.recurrenceUntilDate = 'Ngày kết thúc là bắt buộc.'
    } else if (anchorDate && normalized.untilDate < anchorDate) {
      errors.recurrenceUntilDate = 'Ngày kết thúc không được trước ngày bắt đầu.'
    }
    if (!errors.recurrenceUntilDate && normalized.untilDate && countOccurrencesUntilDate(anchorDate, normalized) > CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES) {
      errors.recurrenceUntilDate = `Chuỗi lặp tối đa ${CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES} lần.`
    }
  }

  if (normalized.endMode === 'count') {
    if (!Number.isInteger(normalized.count) || normalized.count < 1) {
      errors.recurrenceCount = 'Số lần lặp phải từ 1 đến 52.'
    } else if (normalized.count > CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES) {
      errors.recurrenceCount = `Số lần lặp tối đa ${CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES}.`
    }
  }

  return errors
}

export function isWeeklyRecurringCenterCalendarItem(item = null) {
  const rule = normalizeCenterCalendarRecurrenceRule(item?.recurrenceRule)
  return Boolean(rule && rule.frequency === 'weekly' && rule.interval === 1)
}

export function expandWeeklyCenterCalendarOccurrences(items = [], options = {}) {
  const rangeStart = normalizeIsoDateTime(options.rangeStart || options.rangeStartAt)
  const rangeEnd = normalizeIsoDateTime(options.rangeEnd || options.rangeEndAt)
  const excludeMasterId = normalizeText(options.excludeMasterId || options.excludeSourceId)
  const maxOccurrences = normalizeMaxOccurrences(options.maxOccurrences)

  if (!rangeStart || !rangeEnd || new Date(rangeEnd).getTime() <= new Date(rangeStart).getTime()) {
    return []
  }

  return (Array.isArray(items) ? items : [items])
    .filter((item) => item && typeof item === 'object')
    .filter((item) => !excludeMasterId || normalizeText(item.id) !== excludeMasterId)
    .flatMap((item) => expandWeeklyCenterCalendarItemOccurrences(item, { rangeStart, rangeEnd, maxOccurrences }))
    .sort(compareOccurrences)
}

export function expandWeeklyCenterCalendarItemOccurrences(item = null, options = {}) {
  if (!item || typeof item !== 'object') {
    return []
  }

  const rule = normalizeCenterCalendarRecurrenceRule(item.recurrenceRule)
  const errors = validateCenterCalendarRecurrenceRule(rule, { anchorStartAt: item.startAt })
  const startAt = normalizeIsoDateTime(item.startAt)
  const endAt = normalizeIsoDateTime(item.endAt)
  const startDate = getLocalDateString(startAt)
  const duration = getDurationMs(startAt, endAt)
  const rangeStart = normalizeIsoDateTime(options.rangeStart || options.rangeStartAt)
  const rangeEnd = normalizeIsoDateTime(options.rangeEnd || options.rangeEndAt)
  const maxOccurrences = normalizeMaxOccurrences(options.maxOccurrences)

  if (
    !rule ||
    Object.keys(errors).length ||
    !startAt ||
    !endAt ||
    !startDate ||
    !duration ||
    !rangeStart ||
    !rangeEnd ||
    new Date(rangeEnd).getTime() <= new Date(rangeStart).getTime()
  ) {
    return []
  }

  const occurrenceDates = getSeriesOccurrenceDates(startDate, rule, maxOccurrences)
  const startTime = getLocalTimeString(startAt)

  return occurrenceDates
    .map((occurrenceDate) => {
      const occurrenceStart = item.allDay
        ? parseDateTime(occurrenceDate, '00:00')
        : parseDateTime(occurrenceDate, startTime)

      if (!occurrenceStart) {
        return null
      }

      const occurrenceEnd = new Date(occurrenceStart.getTime() + duration)
      const occurrence = {
        ...item,
        id: createCenterCalendarOccurrenceId(item.id, occurrenceDate),
        masterId: item.id,
        occurrenceId: createCenterCalendarOccurrenceId(item.id, occurrenceDate),
        occurrenceDate,
        startAt: occurrenceStart.toISOString(),
        endAt: occurrenceEnd.toISOString(),
        isVirtualOccurrence: true,
        recurrenceRule: rule,
      }

      return occurrence.startAt < rangeEnd && occurrence.endAt > rangeStart ? occurrence : null
    })
    .filter(Boolean)
    .sort(compareOccurrences)
}

export function getCenterCalendarSeriesRange(master = null, options = {}) {
  if (!master || typeof master !== 'object') {
    return null
  }

  const rule = normalizeCenterCalendarRecurrenceRule(master.recurrenceRule)
  const startAt = normalizeIsoDateTime(master.startAt)
  const endAt = normalizeIsoDateTime(master.endAt)
  const anchorDate = getLocalDateString(startAt)
  const duration = getDurationMs(startAt, endAt)

  if (!rule || !anchorDate || !duration || Object.keys(validateCenterCalendarRecurrenceRule(rule, { anchorStartAt: startAt })).length) {
    return null
  }

  const occurrenceDates = getSeriesOccurrenceDates(anchorDate, rule, normalizeMaxOccurrences(options.maxOccurrences))
  if (!occurrenceDates.length) {
    return null
  }

  const firstStart = parseDateTime(occurrenceDates[0], getLocalTimeString(startAt))
  const lastStart = parseDateTime(occurrenceDates[occurrenceDates.length - 1], getLocalTimeString(startAt))

  if (!firstStart || !lastStart) {
    return null
  }

  return {
    startAt: firstStart.toISOString(),
    endAt: new Date(lastStart.getTime() + duration).toISOString(),
    occurrenceCount: occurrenceDates.length,
    firstOccurrenceDate: occurrenceDates[0],
    lastOccurrenceDate: occurrenceDates[occurrenceDates.length - 1],
  }
}

export function createCenterCalendarOccurrenceId(masterId, occurrenceDate) {
  const safeMasterId = normalizeText(masterId).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
  const safeDate = normalizeDateString(occurrenceDate)
  return `${safeMasterId || 'center-calendar'}@${safeDate || 'unknown-date'}`
}

export function createCenterCalendarRecurrenceRuleFromFormValues(values = {}) {
  const frequency = normalizeText(values.recurrenceFrequency || 'none')
  if (frequency !== 'weekly') {
    return null
  }

  const endMode = normalizeText(values.recurrenceEndMode || 'until') || 'until'
  return normalizeCenterCalendarRecurrenceRule({
    frequency: 'weekly',
    interval: 1,
    daysOfWeek: normalizeWeekdayKeys(values.recurrenceDays),
    endMode,
    untilDate: endMode === 'until' ? values.recurrenceUntilDate : null,
    count: endMode === 'count' ? values.recurrenceCount : null,
    timezone: CENTER_CALENDAR_RECURRENCE_TIMEZONE,
  })
}

export function getCenterCalendarRecurrenceFormValues(rule = null, anchorDate = '') {
  const normalized = normalizeCenterCalendarRecurrenceRule(rule)
  const defaultAnchorDate = normalizeDateString(anchorDate) || getTodayDateString()
  const defaultWeekday = getWeekdayKey(defaultAnchorDate) || 'mon'

  if (!normalized || normalized.frequency !== 'weekly') {
    return {
      recurrenceFrequency: 'none',
      recurrenceDays: defaultWeekday,
      recurrenceEndMode: 'until',
      recurrenceUntilDate: addDays(defaultAnchorDate, 56),
      recurrenceCount: '8',
    }
  }

  return {
    recurrenceFrequency: 'weekly',
    recurrenceDays: normalized.daysOfWeek.join(','),
    recurrenceEndMode: normalized.endMode || 'until',
    recurrenceUntilDate: normalized.untilDate || addDays(defaultAnchorDate, 56),
    recurrenceCount: normalized.count ? String(normalized.count) : '8',
  }
}

export function getCenterCalendarWeekdayOptions() {
  return CENTER_CALENDAR_WEEKDAY_KEYS.map((key) => ({
    key,
    label: WEEKDAY_LABELS[key],
    shortLabel: WEEKDAY_SHORT_LABELS[key],
  }))
}

export function formatCenterCalendarRecurrenceSummary(rule = null) {
  const normalized = normalizeCenterCalendarRecurrenceRule(rule)
  if (!normalized || normalized.frequency !== 'weekly') {
    return 'Không lặp'
  }

  const daysLabel = normalized.daysOfWeek.map((day) => WEEKDAY_LABELS[day] || day).join(', ')
  if (normalized.endMode === 'count') {
    return `Lặp vào ${daysLabel}, tổng cộng ${normalized.count} lần`
  }

  return `Lặp vào ${daysLabel} đến ngày ${formatDisplayDate(normalized.untilDate)}`
}

export function getCenterCalendarWeekdayKeyFromDate(value) {
  return getWeekdayKey(value)
}

function getSeriesOccurrenceDates(anchorDate, rule, maxOccurrences) {
  if (!anchorDate || !rule?.daysOfWeek?.length) {
    return []
  }

  const anchor = parseDateOnly(anchorDate)
  if (!anchor) {
    return []
  }

  const dates = []
  let cursor = new Date(anchor)
  const hardStop = rule.endMode === 'until' && rule.untilDate ? parseDateOnly(rule.untilDate) : null

  while (dates.length < maxOccurrences) {
    const date = formatDateOnly(cursor)
    if (date < anchorDate) {
      cursor = addDateDays(cursor, 1)
      continue
    }

    if (hardStop && cursor.getTime() > hardStop.getTime()) {
      break
    }

    if (rule.daysOfWeek.includes(WEEKDAY_KEY_BY_INDEX[cursor.getDay()])) {
      dates.push(date)
      if (rule.endMode === 'count' && dates.length >= rule.count) {
        break
      }
    }

    cursor = addDateDays(cursor, 1)
    if (dates.length >= maxOccurrences) {
      break
    }
  }

  return dates
}

function countOccurrencesUntilDate(anchorDate, rule) {
  if (!anchorDate || !rule?.untilDate) {
    return 0
  }

  return getSeriesOccurrenceDates(anchorDate, rule, CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES + 1).length
}

function normalizeWeekdayKeys(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[,\s/]+/)
  return CENTER_CALENDAR_WEEKDAY_KEYS.filter((key) =>
    values.map((item) => normalizeText(item).toLowerCase()).includes(key),
  )
}

function getInvalidWeekdayKeys(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[,\s/]+/)
  return values
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean)
    .filter((item) => !CENTER_CALENDAR_WEEKDAY_KEYS.includes(item))
}

function normalizeCount(value) {
  const count = Number(value)
  return Number.isInteger(count) ? count : null
}

function normalizeMaxOccurrences(value) {
  const count = Number(value)
  if (Number.isInteger(count) && count > 0) {
    return Math.min(count, CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES + 1)
  }
  return CENTER_CALENDAR_RECURRENCE_MAX_OCCURRENCES
}

function getDurationMs(startAt, endAt) {
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return null
  }
  return end - start
}

function normalizeIsoDateTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function normalizeDateString(value) {
  const text = normalizeText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function getLocalDateString(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : formatDateOnly(date)
}

function getLocalTimeString(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '00:00'
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function parseDateTime(dateValue, timeValue) {
  const date = normalizeDateString(dateValue)
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(normalizeText(timeValue)) ? normalizeText(timeValue) : ''

  if (!date || !time) {
    return null
  }

  const parsed = new Date(`${date}T${time}:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseDateOnly(value) {
  const date = normalizeDateString(value)
  if (!date) {
    return null
  }
  const parsed = new Date(`${date}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function addDateDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function addDays(value, days) {
  const date = parseDateOnly(value)
  return date ? formatDateOnly(addDateDays(date, days)) : ''
}

function formatDateOnly(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getWeekdayKey(value) {
  const date = parseDateOnly(value)
  return date ? WEEKDAY_KEY_BY_INDEX[date.getDay()] : ''
}

function formatDisplayDate(value) {
  const date = parseDateOnly(value)
  if (!date) {
    return ''
  }
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

function compareOccurrences(firstOccurrence, secondOccurrence) {
  return (
    firstOccurrence.startAt.localeCompare(secondOccurrence.startAt) ||
    String(firstOccurrence.title || '').localeCompare(String(secondOccurrence.title || ''), 'vi', { sensitivity: 'base' }) ||
    String(firstOccurrence.id || '').localeCompare(String(secondOccurrence.id || ''))
  )
}

function getTodayDateString() {
  return formatDateOnly(new Date())
}

function normalizeText(value) {
  return String(value ?? '').trim()
}
