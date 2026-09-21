export function parseCanonicalDateParts(value) {
  const normalized = String(value || '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(year, month - 1, day)

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null
  }

  return { year, month, day, canonical: normalized }
}

export function formatOperatorDate(value, fallback = '') {
  const source = String(value || '').trim()
  if (!source) return fallback

  const canonical = parseCanonicalDateParts(source)
  if (canonical) {
    return `${String(canonical.day).padStart(2, '0')}/${String(canonical.month).padStart(2, '0')}/${canonical.year}`
  }

  return source
}

export function formatOperatorDateTime(value, fallback = '') {
  const source = String(value || '').trim()
  if (!source) return fallback

  const canonical = parseCanonicalDateParts(source)
  if (canonical) return formatOperatorDate(canonical.canonical, fallback)

  const date = new Date(source)
  if (Number.isNaN(date.getTime())) return source

  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
