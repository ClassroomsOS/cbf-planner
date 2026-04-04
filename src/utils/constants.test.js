import { describe, it, expect } from 'vitest'
import {
  SECTIONS,
  MODELO_B_SUBJECTS,
  ACADEMIC_PERIODS,
  DAYS,
  PERIODS,
} from './constants'

describe('SECTIONS', () => {
  it('has exactly 6 sections', () => {
    expect(SECTIONS).toHaveLength(6)
  })
  it('has the correct keys in order', () => {
    const keys = SECTIONS.map(s => s.key)
    expect(keys).toEqual(['subject', 'motivation', 'activity', 'skill', 'closing', 'assignment'])
  })
  it('every section has required fields', () => {
    SECTIONS.forEach(s => {
      expect(s).toHaveProperty('key')
      expect(s).toHaveProperty('label')
      expect(s).toHaveProperty('short')
      expect(s).toHaveProperty('hex')
      expect(s).toHaveProperty('time')
    })
  })
})

describe('MODELO_B_SUBJECTS', () => {
  it('includes the 4 English-language subjects', () => {
    expect(MODELO_B_SUBJECTS).toContain('Language Arts')
    expect(MODELO_B_SUBJECTS).toContain('Social Studies')
    expect(MODELO_B_SUBJECTS).toContain('Science')
    expect(MODELO_B_SUBJECTS).toContain('Lingua Skill')
  })
  it('has exactly 4 subjects', () => {
    expect(MODELO_B_SUBJECTS).toHaveLength(4)
  })
})

describe('ACADEMIC_PERIODS', () => {
  it('has exactly 4 periods', () => {
    expect(ACADEMIC_PERIODS).toHaveLength(4)
  })
  it('uses the current year (not hardcoded)', () => {
    const currentYear = new Date().getFullYear()
    ACADEMIC_PERIODS.forEach(p => {
      expect(p.label).toContain(String(currentYear))
    })
  })
  it('has values 1 through 4', () => {
    const values = ACADEMIC_PERIODS.map(p => p.value)
    expect(values).toEqual(['1', '2', '3', '4'])
  })
})

describe('DAYS', () => {
  it('has exactly 5 weekdays', () => {
    expect(DAYS).toHaveLength(5)
  })
  it('starts with Monday and ends with Friday', () => {
    expect(DAYS[0].key).toBe('mon')
    expect(DAYS[4].key).toBe('fri')
  })
})

describe('PERIODS', () => {
  it('has 7 class periods', () => {
    expect(PERIODS).toHaveLength(7)
  })
  it('every period has id, label, and time', () => {
    PERIODS.forEach(p => {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('label')
      expect(p).toHaveProperty('time')
    })
  })
})
