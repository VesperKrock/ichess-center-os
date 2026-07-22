export const CENTER_CALENDAR_CONFLICT_SEVERITIES = ['hard', 'soft', 'informational']

import {
  expandWeeklyCenterCalendarOccurrences,
  isWeeklyRecurringCenterCalendarItem,
} from './center-calendar-recurrence.js'

const SEVERITY_RANK = {
  hard: 0,
  soft: 1,
  informational: 2,
}

const DAY_ALIASES = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 0,
  sun: 0,
}

const SOURCE_LABELS = {
  'class-session': 'Lớp học',
  'schedule-session': 'Buổi học',
  'center-calendar-item': 'Hoạt động',
}

export function detectCenterCalendarConflicts({
  candidate,
  centerId = '',
  classSessions = [],
  scheduleSessions = [],
  centerCalendarItems = [],
  currentItemId = '',
} = {}) {
  const normalizedCenterId = normalizeText(centerId || candidate?.centerId)
  const candidateEntry = normalizeCenterCalendarConflictEntry(candidate, {
    sourceKind: 'center-calendar-item',
    centerId: normalizedCenterId,
  })

  if (!candidateEntry || candidateEntry.isCancelled) {
    return createConflictResult([])
  }

  const sourceEntries = [
    ...buildClassSessionConflictEntries({
      classSessions,
      scheduleSessions,
      rangeStartAt: candidateEntry.startAt,
      rangeEndAt: candidateEntry.endAt,
      centerId: normalizedCenterId,
    }),
    ...buildScheduleSessionConflictEntries({
      scheduleSessions,
      classSessions,
      rangeStartAt: candidateEntry.startAt,
      rangeEndAt: candidateEntry.endAt,
      centerId: normalizedCenterId,
    }),
    ...buildCenterCalendarItemConflictEntries(centerCalendarItems, {
      centerId: normalizedCenterId,
      currentItemId: currentItemId || candidateEntry.sourceId,
      rangeStartAt: candidateEntry.startAt,
      rangeEndAt: candidateEntry.endAt,
    }),
  ]

  const conflicts = sourceEntries
    .map((entry) => classifyCenterCalendarConflict(candidateEntry, entry))
    .filter(Boolean)
    .sort(compareConflicts)

  return createConflictResult(conflicts)
}

export function detectCenterCalendarSeriesConflicts({
  candidate,
  occurrences = [],
  centerId = '',
  classSessions = [],
  scheduleSessions = [],
  centerCalendarItems = [],
  currentItemId = '',
} = {}) {
  const normalizedCenterId = normalizeText(centerId || candidate?.centerId)
  const candidateMasterId = normalizeText(currentItemId || candidate?.id)
  const candidateOccurrences = Array.isArray(occurrences) && occurrences.length ? occurrences : [candidate].filter(Boolean)

  const conflicts = candidateOccurrences
    .flatMap((occurrence) => {
      const result = detectCenterCalendarConflicts({
        candidate: occurrence,
        centerId: normalizedCenterId,
        classSessions,
        scheduleSessions,
        centerCalendarItems,
        currentItemId: candidateMasterId || normalizeText(occurrence?.masterId || occurrence?.id),
      })

      return result.conflicts.map((conflict) => ({
        ...conflict,
        occurrenceDate: occurrence.occurrenceDate || getLocalDateString(occurrence.startAt),
        occurrenceId: occurrence.occurrenceId || occurrence.id,
        candidateMasterId: candidateMasterId || occurrence.masterId || occurrence.id,
      }))
    })
    .sort(compareConflicts)

  return {
    ...createConflictResult(conflicts),
    conflictedOccurrenceCount: new Set(
      conflicts
        .filter((conflict) => conflict.severity === 'hard' || conflict.severity === 'soft')
        .map((conflict) => conflict.occurrenceId || conflict.occurrenceDate),
    ).size,
  }
}

export function normalizeCenterCalendarConflictEntry(record, options = {}) {
  if (!record || typeof record !== 'object') {
    return null
  }

  const sourceKind = normalizeText(options.sourceKind || record.sourceKind || 'center-calendar-item')
  const sourceId = normalizeText(options.sourceId || record.sourceId || record.id)
  const centerId = normalizeText(record.centerId || options.centerId)
  const startAt = normalizeIsoDateTime(options.startAt || record.startAt)
  const endAt = normalizeIsoDateTime(options.endAt || record.endAt)

  if (!sourceKind || !sourceId || !startAt || !endAt || new Date(endAt).getTime() <= new Date(startAt).getTime()) {
    return null
  }

  const roomId = normalizeText(record.roomId || options.roomId)
  const location = normalizeText(record.location || record.room || options.location)
  const roomIdentity = normalizeCenterCalendarRoomIdentity({ roomId, location })
  const isCancelled = Boolean(record.isCancelled || record.isDeleted || record.status === 'cancelled')

  return {
    sourceKind,
    sourceId,
    centerId,
    title: normalizeText(options.title || record.title || record.name || record.displayLabel || record.groupName) ||
      SOURCE_LABELS[sourceKind] ||
      'Lịch',
    startAt,
    endAt,
    allDay: Boolean(record.allDay || options.allDay),
    isCancelled,
    roomId,
    location,
    roomIdentity,
    occupiesRoom: Boolean(roomIdentity.value),
    itemType: normalizeText(record.itemType || record.scheduleType || options.itemType),
    originalRecord: record,
  }
}

export function buildClassSessionConflictEntries({
  classSessions = [],
  scheduleSessions = [],
  rangeStartAt,
  rangeEndAt,
  centerId = '',
} = {}) {
  const dates = getLocalDateRange(rangeStartAt, rangeEndAt)
  const assignmentByClassSessionId = new Map(
    (Array.isArray(scheduleSessions) ? scheduleSessions : [])
      .filter((session) => !isCancelledRecord(session))
      .filter((session) => normalizeText(session.scheduleType) === 'recurring')
      .filter((session) => normalizeText(session.classSessionId))
      .map((session) => [normalizeText(session.classSessionId), session]),
  )

  return (Array.isArray(classSessions) ? classSessions : [])
    .filter((classSession) => classSession && typeof classSession === 'object')
    .filter((classSession) => classSession.status !== 'inactive' && !isCancelledRecord(classSession))
    .flatMap((classSession) => {
      const dayIndexes = normalizeDayIndexes(classSession.daysOfWeek || classSession.dayOfWeek || classSession.dayLabel)
      const assignment = assignmentByClassSessionId.get(normalizeText(classSession.id)) || null
      const startTime = normalizeTime(classSession.startTime || assignment?.startTime)
      const endTime = normalizeTime(classSession.endTime || assignment?.endTime)

      if (!dayIndexes.length || !startTime || !endTime) {
        return []
      }

      return dates
        .filter((date) => dayIndexes.includes(getLocalDateWeekdayIndex(date)))
        .map((date) => {
          const interval = buildDateTimeInterval(date, startTime, endTime)
          return normalizeCenterCalendarConflictEntry(
            {
              ...classSession,
              title: assignment?.title || assignment?.groupName || classSession.displayLabel || classSession.name,
              location: classSession.room || assignment?.room || '',
              roomId: classSession.roomId || assignment?.roomId || '',
              itemType: 'class-session',
            },
            {
              sourceKind: 'class-session',
              sourceId: `class-session-${normalizeText(classSession.id)}@${date}`,
              centerId,
              startAt: interval.startAt,
              endAt: interval.endAt,
            },
          )
        })
        .filter(Boolean)
    })
    .filter((entry) => hasTimeOverlap(entry, { startAt: rangeStartAt, endAt: rangeEndAt }))
    .sort(compareEntries)
}

export function buildScheduleSessionConflictEntries({
  scheduleSessions = [],
  classSessions = [],
  rangeStartAt,
  rangeEndAt,
  centerId = '',
} = {}) {
  const dates = getLocalDateRange(rangeStartAt, rangeEndAt)
  const activeClassSessionIds = new Set(
    (Array.isArray(classSessions) ? classSessions : [])
      .filter((classSession) => classSession?.status !== 'inactive')
      .map((classSession) => normalizeText(classSession?.id))
      .filter(Boolean),
  )

  return (Array.isArray(scheduleSessions) ? scheduleSessions : [])
    .filter((session) => session && typeof session === 'object')
    .filter((session) => !isCancelledRecord(session))
    .flatMap((session) => {
      const scheduleType = normalizeText(session.scheduleType || 'recurring')
      const startTime = normalizeTime(session.startTime)
      const endTime = normalizeTime(session.endTime)

      if (!startTime || !endTime) {
        return []
      }

      if (scheduleType === 'oneOff') {
        const date = normalizeDateString(session.date)
        if (!date) {
          return []
        }

        const interval = buildDateTimeInterval(date, startTime, endTime)
        return [
          normalizeCenterCalendarConflictEntry(
            {
              ...session,
              location: session.room || session.location || '',
              roomId: session.roomId || '',
              itemType: 'schedule-session',
            },
            {
              sourceKind: 'schedule-session',
              sourceId: `schedule-session-${normalizeText(session.id)}@${date}`,
              centerId,
              startAt: interval.startAt,
              endAt: interval.endAt,
            },
          ),
        ].filter(Boolean)
      }

      const classSessionId = normalizeText(session.classSessionId)
      if (classSessionId && activeClassSessionIds.has(classSessionId)) {
        return []
      }

      const dayIndexes = normalizeDayIndexes(session.dayOfWeek)
      if (!dayIndexes.length) {
        return []
      }

      const startDate = normalizeDateString(session.startDate)
      const endDate = normalizeDateString(session.endDate)

      return dates
        .filter((date) => dayIndexes.includes(getLocalDateWeekdayIndex(date)))
        .filter((date) => !startDate || date >= startDate)
        .filter((date) => !endDate || date <= endDate)
        .map((date) => {
          const interval = buildDateTimeInterval(date, startTime, endTime)
          return normalizeCenterCalendarConflictEntry(
            {
              ...session,
              location: session.room || session.location || '',
              roomId: session.roomId || '',
              itemType: 'schedule-session',
            },
            {
              sourceKind: 'schedule-session',
              sourceId: `schedule-session-${normalizeText(session.id)}@${date}`,
              centerId,
              startAt: interval.startAt,
              endAt: interval.endAt,
            },
          )
        })
        .filter(Boolean)
    })
    .filter((entry) => hasTimeOverlap(entry, { startAt: rangeStartAt, endAt: rangeEndAt }))
    .sort(compareEntries)
}

export function buildCenterCalendarItemConflictEntries(items = [], options = {}) {
  const centerId = normalizeText(options.centerId)
  const currentItemId = normalizeText(options.currentItemId)
  const rangeStartAt = normalizeIsoDateTime(options.rangeStartAt)
  const rangeEndAt = normalizeIsoDateTime(options.rangeEndAt)

  return (Array.isArray(items) ? items : [])
    .filter((item) => item && typeof item === 'object')
    .filter((item) => !centerId || !normalizeText(item.centerId) || normalizeText(item.centerId) === centerId)
    .filter((item) => !currentItemId || normalizeText(item.id) !== currentItemId)
    .filter((item) => !isCancelledRecord(item))
    .flatMap((item) => {
      const sourceItems = isWeeklyRecurringCenterCalendarItem(item) && rangeStartAt && rangeEndAt
        ? expandWeeklyCenterCalendarOccurrences([item], {
            rangeStart: rangeStartAt,
            rangeEnd: rangeEndAt,
            excludeMasterId: currentItemId,
          })
        : [item]

      return sourceItems.map((sourceItem) =>
        normalizeCenterCalendarConflictEntry(sourceItem, {
          sourceKind: 'center-calendar-item',
          sourceId: sourceItem.occurrenceId || sourceItem.id,
          centerId: normalizeText(item.centerId) || centerId,
        }),
      )
    })
    .filter(Boolean)
    .sort(compareEntries)
}

export function classifyCenterCalendarConflict(candidateEntry, targetEntry) {
  if (!candidateEntry || !targetEntry || candidateEntry.isCancelled || targetEntry.isCancelled) {
    return null
  }

  if (candidateEntry.sourceKind === targetEntry.sourceKind && candidateEntry.sourceId === targetEntry.sourceId) {
    return null
  }

  if (candidateEntry.centerId && targetEntry.centerId && candidateEntry.centerId !== targetEntry.centerId) {
    return null
  }

  if (!hasTimeOverlap(candidateEntry, targetEntry)) {
    return null
  }

  const roomMatch = getRoomMatch(candidateEntry.roomIdentity, targetEntry.roomIdentity)
  const isLessonSource = targetEntry.sourceKind === 'class-session' || targetEntry.sourceKind === 'schedule-session'

  if (isLessonSource && roomMatch.matches) {
    return createConflict('hard', 'room', candidateEntry, targetEntry, roomMatch)
  }

  if (targetEntry.sourceKind === 'center-calendar-item' && roomMatch.matches) {
    return createConflict('soft', 'room', candidateEntry, targetEntry, roomMatch)
  }

  return createConflict('informational', 'time', candidateEntry, targetEntry, roomMatch)
}

export function hasTimeOverlap(firstEntry, secondEntry) {
  const firstStart = getTimestamp(firstEntry?.startAt)
  const firstEnd = getTimestamp(firstEntry?.endAt)
  const secondStart = getTimestamp(secondEntry?.startAt)
  const secondEnd = getTimestamp(secondEntry?.endAt)

  if ([firstStart, firstEnd, secondStart, secondEnd].some((value) => value === null)) {
    return false
  }

  if (firstEnd <= firstStart || secondEnd <= secondStart) {
    return false
  }

  return firstStart < secondEnd && secondStart < firstEnd
}

export function normalizeCenterCalendarRoomIdentity({ roomId = '', location = '' } = {}) {
  const normalizedRoomId = normalizeText(roomId)
  if (normalizedRoomId) {
    return {
      kind: 'roomId',
      value: normalizedRoomId.toLowerCase(),
      label: normalizedRoomId,
    }
  }

  const normalizedLocation = normalizeLocationText(location)
  if (normalizedLocation) {
    return {
      kind: 'location',
      value: normalizedLocation,
      label: normalizeText(location),
    }
  }

  return {
    kind: 'none',
    value: '',
    label: '',
  }
}

export function normalizeLocationText(value) {
  return normalizeText(value).toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ')
}

export function summarizeCenterCalendarConflicts(conflicts = []) {
  const list = (Array.isArray(conflicts) ? conflicts : []).slice().sort(compareConflicts)
  const hard = list.filter((conflict) => conflict.severity === 'hard')
  const soft = list.filter((conflict) => conflict.severity === 'soft')
  const informational = list.filter((conflict) => conflict.severity === 'informational')

  return {
    conflicts: list,
    hard,
    soft,
    informational,
    hasHard: hard.length > 0,
    hasSoft: soft.length > 0,
    hasBlockingConflict: hard.length > 0,
    requiresDecision: hard.length > 0 || soft.length > 0,
    highestSeverity: hard.length ? 'hard' : soft.length ? 'soft' : informational.length ? 'informational' : '',
    total: list.length,
  }
}

function createConflictResult(conflicts) {
  return summarizeCenterCalendarConflicts(conflicts)
}

function createConflict(severity, conflictType, candidate, target, roomMatch) {
  return {
    severity,
    conflictType,
    sourceKind: target.sourceKind,
    sourceId: target.sourceId,
    title: target.title,
    startAt: target.startAt,
    endAt: target.endAt,
    allDay: target.allDay,
    roomId: target.roomId,
    location: target.location,
    roomLabel: target.roomIdentity.label,
    roomMatchKind: roomMatch.kind,
    sourceLabel: SOURCE_LABELS[target.sourceKind] || 'Lịch',
    message: createConflictMessage(severity, conflictType, target),
    target,
    candidate: {
      sourceId: candidate.sourceId,
      startAt: candidate.startAt,
      endAt: candidate.endAt,
      title: candidate.title,
    },
  }
}

function createConflictMessage(severity, conflictType, target) {
  const typeLabel = conflictType === 'room' ? 'Trùng phòng' : 'Xung đột thời gian'
  const sourceLabel = SOURCE_LABELS[target.sourceKind] || 'Lịch'
  const roomLabel = target.roomIdentity.label ? ` tại ${target.roomIdentity.label}` : ''
  return `${typeLabel} với ${sourceLabel.toLowerCase()} "${target.title}"${roomLabel}.`
}

function getRoomMatch(firstIdentity, secondIdentity) {
  if (!firstIdentity?.value || !secondIdentity?.value) {
    return { matches: false, kind: 'none' }
  }

  if (firstIdentity.kind === 'roomId' && secondIdentity.kind === 'roomId') {
    return {
      matches: firstIdentity.value === secondIdentity.value,
      kind: 'roomId',
    }
  }

  if (firstIdentity.kind === 'location' && secondIdentity.kind === 'location') {
    return {
      matches: firstIdentity.value === secondIdentity.value,
      kind: 'location',
    }
  }

  return { matches: false, kind: 'mixed' }
}

function getLocalDateRange(startAt, endAt) {
  const startDate = getLocalDateString(startAt)
  const endDate = getLocalDateString(endAt)

  if (!startDate || !endDate) {
    return []
  }

  const dates = []
  let cursor = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)

  if (!cursor || !end) {
    return []
  }

  while (cursor.getTime() <= end.getTime() && dates.length < 370) {
    dates.push(formatDateOnly(cursor))
    cursor = addDays(cursor, 1)
  }

  return dates
}

function buildDateTimeInterval(date, startTime, endTime) {
  const start = new Date(`${date}T${startTime}:00`)
  let end = new Date(`${date}T${endTime}:00`)

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
  }

  return {
    startAt: Number.isNaN(start.getTime()) ? '' : start.toISOString(),
    endAt: Number.isNaN(end.getTime()) ? '' : end.toISOString(),
  }
}

function normalizeDayIndexes(value) {
  const values = Array.isArray(value) ? value : [value]
  return Array.from(
    new Set(
      values
        .flatMap((item) => String(item || '').split(/[,\s/]+/))
        .map((item) => DAY_ALIASES[normalizeText(item).toLowerCase()])
        .filter((item) => Number.isInteger(item)),
    ),
  )
}

function getLocalDateWeekdayIndex(date) {
  const parsedDate = parseDateOnly(date)
  return parsedDate ? parsedDate.getDay() : -1
}

function getLocalDateString(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return formatDateOnly(date)
}

function normalizeIsoDateTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toISOString()
}

function normalizeDateString(value) {
  const text = normalizeText(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : ''
}

function normalizeTime(value) {
  const text = normalizeText(value)
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? text : ''
}

function parseDateOnly(value) {
  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date, days) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function formatDateOnly(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function getTimestamp(value) {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function isCancelledRecord(record) {
  return Boolean(record?.isCancelled || record?.isDeleted || record?.status === 'cancelled')
}

function compareEntries(firstEntry, secondEntry) {
  return (
    firstEntry.startAt.localeCompare(secondEntry.startAt) ||
    firstEntry.title.localeCompare(secondEntry.title, 'vi', { sensitivity: 'base' }) ||
    firstEntry.sourceKind.localeCompare(secondEntry.sourceKind) ||
    firstEntry.sourceId.localeCompare(secondEntry.sourceId)
  )
}

function compareConflicts(firstConflict, secondConflict) {
  return (
    (SEVERITY_RANK[firstConflict.severity] ?? 9) - (SEVERITY_RANK[secondConflict.severity] ?? 9) ||
    firstConflict.startAt.localeCompare(secondConflict.startAt) ||
    firstConflict.title.localeCompare(secondConflict.title, 'vi', { sensitivity: 'base' }) ||
    firstConflict.sourceKind.localeCompare(secondConflict.sourceKind) ||
    firstConflict.sourceId.localeCompare(secondConflict.sourceId)
  )
}

function normalizeText(value) {
  return String(value ?? '').trim()
}
