// ── dateUtils.js ──────────────────────────────────────────────────────────────
// Shared date utilities across CBF Planner

// ── Constants ─────────────────────────────────────────────────────────────────
export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export const MONTHS_ES = [
  'Ene.', 'Feb.', 'Mar.', 'Abr.', 'May.', 'Jun.',
  'Jul.', 'Ago.', 'Sep.', 'Oct.', 'Nov.', 'Dic.'
]

export const DAYS_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
export const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']

// ── Date conversion & formatting ──────────────────────────────────────────────

/**
 * Convert Date object to ISO string (YYYY-MM-DD)
 * @param {Date} date
 * @returns {string}
 */
export function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Format ISO date string to English format (e.g., "January 15th, 2026")
 * @param {string} isoDate - ISO date string (YYYY-MM-DD)
 * @returns {string}
 */
export function formatDateEN(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const suffix = d === 1 || d === 21 || d === 31 ? 'st'
    : d === 2 || d === 22 ? 'nd'
    : d === 3 || d === 23 ? 'rd'
    : 'th'
  return `${MONTHS_EN[m - 1]} ${d}${suffix}, ${y}`
}

/**
 * Get day name (English) from ISO date
 * @param {string} isoDate - ISO date string (YYYY-MM-DD)
 * @returns {string}
 */
export function getDayName(isoDate) {
  const date = new Date(isoDate + 'T12:00:00')
  return DAYS_EN[date.getDay() - 1] || ''
}

// ── Week calculations ─────────────────────────────────────────────────────────

/**
 * Get Monday of the week for a given date
 * @param {Date} date
 * @returns {Date}
 */
export function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get array of 5 weekday dates (Mon-Fri) starting from monday
 * @param {Date} monday
 * @returns {Date[]}
 */
export function getWeekDays(monday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

/**
 * Calculate school week number (starting from first Monday of the year)
 * @param {Date} monday
 * @returns {number}
 */
export function getSchoolWeek(monday) {
  const firstMonday = getMondayOf(new Date(monday.getFullYear(), 1, 2))
  const diff = Math.floor((monday - firstMonday) / (7 * 24 * 3600 * 1000))
  return Math.max(1, diff + 1)
}

/**
 * Format date range for display (e.g., "Ene. 13–17, 2026")
 * @param {Date[]} days - Array of Date objects
 * @returns {string}
 */
export function formatRange(days) {
  if (!days.length) return ''
  const first = days[0]
  const last = days[days.length - 1]
  const m1 = MONTHS_ES[first.getMonth()]
  const m2 = MONTHS_ES[last.getMonth()]

  if (m1 === m2) {
    return `${m1} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`
  }
  return `${m1} ${first.getDate()} – ${m2} ${last.getDate()}, ${last.getFullYear()}`
}

/**
 * Parse "relative date" strings (like "today", "yesterday", "2 days ago")
 * @param {string} str
 * @returns {Date|null}
 */
export function parseRelativeDate(str) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (str === 'today') return today
  if (str === 'yesterday') {
    const d = new Date(today)
    d.setDate(d.getDate() - 1)
    return d
  }

  const match = str.match(/^(\d+)\s*(day|week|month)s?\s*ago$/i)
  if (match) {
    const [, num, unit] = match
    const d = new Date(today)
    if (unit === 'day') d.setDate(d.getDate() - Number(num))
    if (unit === 'week') d.setDate(d.getDate() - Number(num) * 7)
    if (unit === 'month') d.setMonth(d.getMonth() - Number(num))
    return d
  }

  return null
}

/**
 * Get ISO date for today
 * @returns {string}
 */
export function getTodayISO() {
  return toISO(new Date())
}

/**
 * Check if ISO date is in the past
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isPastDate(isoDate) {
  const date = new Date(isoDate + 'T12:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

/**
 * Check if ISO date is today
 * @param {string} isoDate
 * @returns {boolean}
 */
export function isToday(isoDate) {
  return isoDate === getTodayISO()
}
