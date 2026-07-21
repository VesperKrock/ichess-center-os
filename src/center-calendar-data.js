export const CENTER_CALENDAR_ITEM_TYPES = ['meeting', 'event', 'tournament', 'other']

export const CENTER_CALENDAR_ITEM_TYPE_LABELS = {
  meeting: 'Hội họp',
  event: 'Sự kiện',
  tournament: 'Giải đấu',
  other: 'Hoạt động khác',
}
export const CENTER_CALENDAR_REJECTED_CLASS_ITEM_TYPES = [
  'fixedClass',
  'makeupClass',
  'extraClass',
  'classSession',
  'scheduleSession',
  'teachingSession',
]

export const CENTER_CALENDAR_COLOR_PRESETS = {
  blue: {
    key: 'blue',
    label: 'Xanh dương',
    color: '#2563eb',
  },
  green: {
    key: 'green',
    label: 'Xanh lá',
    color: '#22c55e',
  },
  yellow: {
    key: 'yellow',
    label: 'Vàng',
    color: '#eab308',
  },
  orange: {
    key: 'orange',
    label: 'Cam',
    color: '#f97316',
  },
  red: {
    key: 'red',
    label: 'Đỏ',
    color: '#ef4444',
  },
  purple: {
    key: 'purple',
    label: 'Tím',
    color: '#8b5cf6',
  },
  pink: {
    key: 'pink',
    label: 'Hồng',
    color: '#ec4899',
  },
  gray: {
    key: 'gray',
    label: 'Xám',
    color: '#64748b',
  },
  emerald: {
    key: 'emerald',
    label: 'Xanh ngọc',
    color: '#059669',
  },
}

export const CENTER_CALENDAR_ITEM_TYPE_DEFAULT_COLOR_KEYS = {
  meeting: 'orange',
  event: 'green',
  tournament: 'emerald',
  other: 'yellow',
}

Object.defineProperties(CENTER_CALENDAR_COLOR_PRESETS, {
  meeting: {
    value: CENTER_CALENDAR_COLOR_PRESETS.orange,
  },
  event: {
    value: CENTER_CALENDAR_COLOR_PRESETS.green,
  },
  tournament: {
    value: CENTER_CALENDAR_COLOR_PRESETS.emerald,
  },
  other: {
    value: CENTER_CALENDAR_COLOR_PRESETS.yellow,
  },
})
export function normalizeCenterCalendarStorageCenterId(centerId) {
  const normalized = String(centerId ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized || 'dreamhome'
}

export function getCenterCalendarItemsStorageKey(centerId) {
  return `ichessCenterOS.centerCalendarItems.${normalizeCenterCalendarStorageCenterId(centerId)}`
}

export function getCenterCalendarTagsStorageKey(centerId) {
  return `ichessCenterOS.centerCalendarTags.${normalizeCenterCalendarStorageCenterId(centerId)}`
}

export function loadStoredCenterCalendarItems(centerId, storage = getBrowserLocalStorage()) {
  return loadCenterCalendarCollection({
    storage,
    storageKey: getCenterCalendarItemsStorageKey(centerId),
    normalize: (items) => normalizeCenterCalendarItems(items, {
      centerId: normalizeCenterCalendarStorageCenterId(centerId),
    }),
  })
}

export function saveStoredCenterCalendarItems(centerId, items, storage = getBrowserLocalStorage()) {
  return saveCenterCalendarCollection({
    storage,
    storageKey: getCenterCalendarItemsStorageKey(centerId),
    value: normalizeCenterCalendarItems(items, {
      centerId: normalizeCenterCalendarStorageCenterId(centerId),
    }),
  })
}

export function loadStoredCenterCalendarTags(centerId, storage = getBrowserLocalStorage()) {
  return loadCenterCalendarCollection({
    storage,
    storageKey: getCenterCalendarTagsStorageKey(centerId),
    normalize: (tags) => normalizeCenterCalendarTags(tags, {
      centerId: normalizeCenterCalendarStorageCenterId(centerId),
    }),
  })
}

export function saveStoredCenterCalendarTags(centerId, tags, storage = getBrowserLocalStorage()) {
  return saveCenterCalendarCollection({
    storage,
    storageKey: getCenterCalendarTagsStorageKey(centerId),
    value: normalizeCenterCalendarTags(tags, {
      centerId: normalizeCenterCalendarStorageCenterId(centerId),
    }),
  })
}

export function isCenterCalendarItemType(value) {
  return CENTER_CALENDAR_ITEM_TYPES.includes(normalizeText(value))
}

export function isRejectedClassCalendarItemType(value) {
  return CENTER_CALENDAR_REJECTED_CLASS_ITEM_TYPES.includes(normalizeText(value))
}

export function getCenterCalendarPresetForType(itemType) {
  const normalizedType = normalizeCenterCalendarItemType(itemType)
  const defaultColorKey = CENTER_CALENDAR_ITEM_TYPE_DEFAULT_COLOR_KEYS[normalizedType] || 'yellow'
  return CENTER_CALENDAR_COLOR_PRESETS[defaultColorKey] || CENTER_CALENDAR_COLOR_PRESETS.yellow
}

export function getCenterCalendarPresetByColorKey(colorKey, itemType = 'other') {
  const normalizedColorKey = normalizeText(colorKey)
  return CENTER_CALENDAR_COLOR_PRESETS[normalizedColorKey] || getCenterCalendarPresetForType(itemType)
}

export function normalizeCenterCalendarItemType(value) {
  const itemType = normalizeText(value)
  return CENTER_CALENDAR_ITEM_TYPES.includes(itemType) ? itemType : ''
}

export function normalizeCenterCalendarCustomColor(value) {
  const color = normalizeText(value)
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : ''
}

export function normalizeCenterCalendarItem(item, options = {}) {
  if (!item || typeof item !== 'object') {
    return null
  }

  const itemType = normalizeCenterCalendarItemType(item.itemType || item.type)
  if (!itemType || isRejectedClassCalendarItemType(item.itemType || item.type)) {
    return null
  }

  const title = normalizeText(item.title)
  if (!title) {
    return null
  }

  const startAt = normalizeIsoDateTime(item.startAt)
  const endAt = normalizeIsoDateTime(item.endAt)
  if (!startAt || !endAt || new Date(endAt).getTime() < new Date(startAt).getTime()) {
    return null
  }

  const now = new Date().toISOString()
  const centerId = normalizeText(item.centerId || options.centerId)
  const colorKey = normalizeCenterCalendarColorKey(item.colorKey, itemType)
  const customColor = normalizeCenterCalendarCustomColor(item.customColor)
  const sourceModule = normalizeText(item.sourceModule) || 'center-calendar'

  return {
    ...item,
    id: normalizeText(item.id) || createCenterCalendarItemId(itemType, startAt),
    centerId,
    itemType,
    itemSubtype: normalizeText(item.itemSubtype),
    title,
    description: normalizeText(item.description),
    startAt,
    endAt,
    allDay: Boolean(item.allDay),
    location: normalizeText(item.location),
    roomId: normalizeText(item.roomId),
    colorKey,
    customColor,
    tagId: normalizeText(item.tagId),
    tagLabel: normalizeText(item.tagLabel),
    participantType: normalizeText(item.participantType),
    participantIds: normalizeUniqueTextArray(item.participantIds),
    teacherIds: normalizeUniqueTextArray(item.teacherIds),
    staffIds: normalizeUniqueTextArray(item.staffIds),
    recurrenceRule: normalizeCenterCalendarRecurrenceRule(item.recurrenceRule),
    sourceModule,
    linkedSessionId: normalizeText(item.linkedSessionId),
    linkedClassSessionId: normalizeText(item.linkedClassSessionId),
    isCancelled: Boolean(item.isCancelled),
    createdBy: normalizeText(item.createdBy),
    createdAt: normalizeIsoDateTime(item.createdAt) || now,
    updatedAt: normalizeIsoDateTime(item.updatedAt) || normalizeIsoDateTime(item.createdAt) || now,
  }
}

export function normalizeCenterCalendarItems(items, options = {}) {
  if (!Array.isArray(items)) {
    return []
  }

  return items
    .map((item) => normalizeCenterCalendarItem(item, options))
    .filter(Boolean)
    .sort(compareCenterCalendarItems)
}

export function normalizeCenterCalendarTag(tag, options = {}) {
  if (!tag || typeof tag !== 'object') {
    return null
  }

  const label = normalizeText(tag.label)
  if (!label) {
    return null
  }

  const now = new Date().toISOString()
  const centerId = normalizeText(tag.centerId || options.centerId)
  const defaultItemType = normalizeCenterCalendarItemType(tag.defaultItemType) || 'other'
  const colorKey = normalizeCenterCalendarColorKey(tag.colorKey, defaultItemType)
  const customColor = normalizeCenterCalendarCustomColor(tag.customColor)

  return {
    ...tag,
    id: normalizeText(tag.id) || createCenterCalendarTagId(label),
    centerId,
    label,
    colorKey,
    customColor,
    defaultItemType,
    description: normalizeText(tag.description),
    isActive: tag.isActive === undefined ? true : Boolean(tag.isActive),
    createdAt: normalizeIsoDateTime(tag.createdAt) || now,
    updatedAt: normalizeIsoDateTime(tag.updatedAt) || normalizeIsoDateTime(tag.createdAt) || now,
  }
}

export function normalizeCenterCalendarTags(tags, options = {}) {
  if (!Array.isArray(tags)) {
    return []
  }

  return tags
    .map((tag) => normalizeCenterCalendarTag(tag, options))
    .filter(Boolean)
    .sort((firstTag, secondTag) => {
      const labelCompare = firstTag.label.localeCompare(secondTag.label)
      return labelCompare || firstTag.id.localeCompare(secondTag.id)
    })
}

export function getCenterCalendarItemsForRange(items, startAt, endAt, options = {}) {
  const rangeStart = normalizeIsoDateTime(startAt)
  const rangeEnd = normalizeIsoDateTime(endAt)

  if (!rangeStart || !rangeEnd || new Date(rangeEnd).getTime() < new Date(rangeStart).getTime()) {
    return []
  }

  const includeCancelled = options.includeCancelled !== false

  return normalizeCenterCalendarItems(items, options)
    .filter((item) => includeCancelled || !item.isCancelled)
    .filter((item) => item.startAt < rangeEnd && item.endAt > rangeStart)
    .sort(compareCenterCalendarItems)
}

export function getCenterCalendarItemById(items, id) {
  const normalizedId = normalizeText(id)
  if (!normalizedId) {
    return null
  }

  return normalizeCenterCalendarItems(items).find((item) => item.id === normalizedId) || null
}

export function getCenterCalendarTagById(tags, id) {
  const normalizedId = normalizeText(id)
  if (!normalizedId) {
    return null
  }

  return normalizeCenterCalendarTags(tags).find((tag) => tag.id === normalizedId) || null
}

function normalizeCenterCalendarColorKey(colorKey, itemType) {
  const normalizedColorKey = normalizeText(colorKey)
  const presetKeys = new Set(
    Object.keys(CENTER_CALENDAR_COLOR_PRESETS),
  )

  return presetKeys.has(normalizedColorKey)
    ? normalizedColorKey
    : getCenterCalendarPresetForType(itemType).key
}

function normalizeCenterCalendarRecurrenceRule(recurrenceRule) {
  if (!recurrenceRule || typeof recurrenceRule !== 'object') {
    return null
  }

  return {
    ...recurrenceRule,
    frequency: normalizeText(recurrenceRule.frequency || 'none') || 'none',
  }
}

function compareCenterCalendarItems(firstItem, secondItem) {
  const startCompare = firstItem.startAt.localeCompare(secondItem.startAt)
  if (startCompare) {
    return startCompare
  }

  const titleCompare = firstItem.title.localeCompare(secondItem.title)
  return titleCompare || firstItem.id.localeCompare(secondItem.id)
}

function normalizeUniqueTextArray(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => normalizeText(item)).filter(Boolean)))
    : []
}

function normalizeIsoDateTime(value) {
  const text = normalizeText(value)
  if (!text) {
    return ''
  }

  const dateValue = new Date(text)
  return Number.isNaN(dateValue.getTime()) ? '' : dateValue.toISOString()
}

function normalizeText(value) {
  return String(value ?? '').trim()
}

function createCenterCalendarItemId(itemType, startAt) {
  return `center-calendar-${itemType}-${startAt.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-+$/g, '')}`
}

function createCenterCalendarTagId(label) {
  return `center-calendar-tag-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || Date.now()}`
}

function loadCenterCalendarCollection({ storage, storageKey, normalize }) {
  if (!storage || typeof storage.getItem !== 'function') {
    return []
  }

  try {
    const parsedValue = JSON.parse(storage.getItem(storageKey))
    if (!Array.isArray(parsedValue)) {
      return []
    }

    return normalize(parsedValue)
  } catch {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(storageKey)
    }
    return []
  }
}

function saveCenterCalendarCollection({ storage, storageKey, value }) {
  if (!storage || typeof storage.setItem !== 'function') {
    return []
  }

  storage.setItem(storageKey, JSON.stringify(value))
  return value
}

function getBrowserLocalStorage() {
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}
