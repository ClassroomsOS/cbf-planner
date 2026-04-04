import { describe, it, expect } from 'vitest'
import {
  toISO,
  formatDateEN,
  getDayName,
  getMondayOf,
  getWeekDays,
  getSchoolWeek,
  formatRange,
  parseRelativeDate,
  isPastDate,
  isToday,
  getTodayISO,
} from './dateUtils'

describe('toISO', () => {
  it('converts a Date to YYYY-MM-DD', () => {
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('zero-pads month and day', () => {
    expect(toISO(new Date(2026, 8, 3))).toBe('2026-09-03')
  })
})

describe('formatDateEN', () => {
  it('formats 1st correctly', () => {
    expect(formatDateEN('2026-03-01')).toBe('March 1st, 2026')
  })
  it('formats 2nd correctly', () => {
    expect(formatDateEN('2026-03-02')).toBe('March 2nd, 2026')
  })
  it('formats 3rd correctly', () => {
    expect(formatDateEN('2026-03-03')).toBe('March 3rd, 2026')
  })
  it('formats 4th with th', () => {
    expect(formatDateEN('2026-03-04')).toBe('March 4th, 2026')
  })
  it('formats 21st correctly', () => {
    expect(formatDateEN('2026-03-21')).toBe('March 21st, 2026')
  })
  it('formats 22nd correctly', () => {
    expect(formatDateEN('2026-04-22')).toBe('April 22nd, 2026')
  })
  it('formats 11th (exception — not 1st)', () => {
    expect(formatDateEN('2026-03-11')).toBe('March 11th, 2026')
  })
})

describe('getDayName', () => {
  it('returns Monday for a known Monday', () => {
    expect(getDayName('2026-03-30')).toBe('Monday')
  })
  it('returns Friday for a known Friday', () => {
    expect(getDayName('2026-04-03')).toBe('Friday')
  })
  it('returns empty string for Sunday', () => {
    expect(getDayName('2026-04-05')).toBe('')
  })
})

describe('getMondayOf', () => {
  it('returns same day if already Monday', () => {
    const monday = new Date('2026-03-30T12:00:00')
    const result = getMondayOf(monday)
    expect(toISO(result)).toBe('2026-03-30')
  })
  it('returns Monday when given a Wednesday', () => {
    const wed = new Date('2026-04-01T12:00:00')
    expect(toISO(getMondayOf(wed))).toBe('2026-03-30')
  })
  it('returns Monday when given a Sunday', () => {
    const sun = new Date('2026-04-05T12:00:00')
    expect(toISO(getMondayOf(sun))).toBe('2026-03-30')
  })
})

describe('getWeekDays', () => {
  it('returns 5 days starting from Monday', () => {
    const monday = new Date('2026-03-30T12:00:00')
    const days = getWeekDays(monday)
    expect(days).toHaveLength(5)
    expect(toISO(days[0])).toBe('2026-03-30')
    expect(toISO(days[4])).toBe('2026-04-03')
  })
})

describe('formatRange', () => {
  it('returns empty string for empty array', () => {
    expect(formatRange([])).toBe('')
  })
  it('formats same-month range', () => {
    // April 6–10: all within April
    const days = getWeekDays(new Date('2026-04-06T12:00:00'))
    expect(formatRange(days)).toBe('Abr. 6–10, 2026')
  })
  it('formats cross-month range', () => {
    // week from Mar 30 to Apr 3
    const days = getWeekDays(new Date('2026-03-30T12:00:00'))
    // Override: a week that crosses months clearly
    const crossDays = [
      new Date('2026-01-26T12:00:00'),
      new Date('2026-01-27T12:00:00'),
      new Date('2026-01-28T12:00:00'),
      new Date('2026-01-29T12:00:00'),
      new Date('2026-02-01T12:00:00'),
    ]
    const result = formatRange(crossDays)
    expect(result).toContain('Ene.')
    expect(result).toContain('Feb.')
  })
})

describe('parseRelativeDate', () => {
  it('returns null for unknown string', () => {
    expect(parseRelativeDate('next week')).toBeNull()
  })
  it('parses "today"', () => {
    const result = parseRelativeDate('today')
    expect(toISO(result)).toBe(getTodayISO())
  })
  it('parses "2 days ago"', () => {
    const result = parseRelativeDate('2 days ago')
    const expected = new Date()
    expected.setDate(expected.getDate() - 2)
    expected.setHours(0, 0, 0, 0)
    expect(toISO(result)).toBe(toISO(expected))
  })
  it('parses "1 week ago"', () => {
    const result = parseRelativeDate('1 week ago')
    const expected = new Date()
    expected.setDate(expected.getDate() - 7)
    expected.setHours(0, 0, 0, 0)
    expect(toISO(result)).toBe(toISO(expected))
  })
})

describe('isPastDate', () => {
  it('returns true for a past date', () => {
    expect(isPastDate('2020-01-01')).toBe(true)
  })
  it('returns false for a future date', () => {
    expect(isPastDate('2099-12-31')).toBe(false)
  })
})

describe('isToday', () => {
  it('returns true for today', () => {
    expect(isToday(getTodayISO())).toBe(true)
  })
  it('returns false for yesterday', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(isToday(toISO(yesterday))).toBe(false)
  })
})
