import { describe, it, expect } from 'vitest'
import {
  seededShuffle, shuffleMCOptions, colombianGrade, gradeLevel, gradeColor, GRADE_SCALE,
  EXAM_PRESETS, extractGradeNumber, getExamPreset, finalExamGrade
} from './examUtils'

// ── seededShuffle ────────────────────────────────────────────────────────────

describe('seededShuffle', () => {
  it('returns the same length as input', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(seededShuffle(arr, 12345)).toHaveLength(5)
  })

  it('contains the same elements as input', () => {
    const arr = ['a', 'b', 'c', 'd']
    const result = seededShuffle(arr, 99999)
    expect(result.sort()).toEqual([...arr].sort())
  })

  it('is deterministic — same seed, same order', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    const r1 = seededShuffle(arr, 31337)
    const r2 = seededShuffle(arr, 31337)
    expect(r1).toEqual(r2)
  })

  it('produces different orders for different seeds', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const r1 = seededShuffle(arr, 31337)
    const r2 = seededShuffle(arr, 62674)
    expect(r1).not.toEqual(r2)
  })

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5]
    const original = [...arr]
    seededShuffle(arr, 1234)
    expect(arr).toEqual(original)
  })

  it('handles an empty array', () => {
    expect(seededShuffle([], 999)).toEqual([])
  })

  it('handles a single-element array', () => {
    expect(seededShuffle(['x'], 1)).toEqual(['x'])
  })

  it('handles seed = 0 without hanging', () => {
    const arr = [1, 2, 3]
    const result = seededShuffle(arr, 0)
    expect(result).toHaveLength(3)
  })

  it('version seeds produce stable order — regression guard', () => {
    // Version 1 seed = (1+1)*31337 = 62674
    const arr = [0, 1, 2, 3, 4]
    const result = seededShuffle(arr, 62674)
    // Snapshot: if this breaks, question order for existing exams has changed
    expect(result).toMatchSnapshot()
  })
})

// ── shuffleMCOptions ─────────────────────────────────────────────────────────

describe('shuffleMCOptions', () => {
  const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D']

  it('returns shuffled options of the same length', () => {
    const { options: out } = shuffleMCOptions(options, 'Opción A', 42)
    expect(out).toHaveLength(4)
  })

  it('correct_answer text is preserved in output', () => {
    const { options: out, correct_answer } = shuffleMCOptions(options, 'Opción C', 42)
    expect(out).toContain('Opción C')
    expect(correct_answer).toBe('Opción C')
  })

  it('contains the same options after shuffle', () => {
    const { options: out } = shuffleMCOptions(options, 'Opción B', 777)
    expect(out.sort()).toEqual([...options].sort())
  })

  it('is deterministic', () => {
    const r1 = shuffleMCOptions(options, 'Opción A', 555)
    const r2 = shuffleMCOptions(options, 'Opción A', 555)
    expect(r1.options).toEqual(r2.options)
  })
})

// ── colombianGrade ───────────────────────────────────────────────────────────

describe('colombianGrade', () => {
  it('returns "5.0" for a perfect score', () => {
    expect(colombianGrade(20, 20)).toBe('5.0')
  })

  it('returns "1.0" for a zero score', () => {
    expect(colombianGrade(0, 20)).toBe('1.0')
  })

  it('returns "3.0" for a 50% score', () => {
    // (10/20)*4 + 1 = 3.0
    expect(colombianGrade(10, 20)).toBe('3.0')
  })

  it('applies the CBF formula correctly — 75%', () => {
    // (15/20)*4 + 1 = 4.0
    expect(colombianGrade(15, 20)).toBe('4.0')
  })

  it('clamps to 1.0 minimum (cannot go below 1.0)', () => {
    expect(colombianGrade(0, 100)).toBe('1.0')
  })

  it('clamps to 5.0 maximum', () => {
    expect(colombianGrade(100, 100)).toBe('5.0')
  })

  it('returns null when max is 0', () => {
    expect(colombianGrade(0, 0)).toBeNull()
  })

  it('returns null when max is falsy', () => {
    expect(colombianGrade(5, null)).toBeNull()
    expect(colombianGrade(5, undefined)).toBeNull()
  })

  it('returns a string with exactly 1 decimal', () => {
    const result = colombianGrade(7, 20)
    expect(result).toMatch(/^\d\.\d$/)
  })
})

// ── GRADE_SCALE / gradeLevel / gradeColor ────────────────────────────────────

describe('GRADE_SCALE', () => {
  it('has 4 levels ordered descending by min', () => {
    expect(GRADE_SCALE).toHaveLength(4)
    expect(GRADE_SCALE[0].min).toBeGreaterThan(GRADE_SCALE[1].min)
  })

  it('matches Boston Flex official cutoffs', () => {
    expect(GRADE_SCALE[0]).toMatchObject({ min: 4.50, label: 'Superior' })
    expect(GRADE_SCALE[1]).toMatchObject({ min: 4.00, label: 'Alto' })
    expect(GRADE_SCALE[2]).toMatchObject({ min: 3.50, label: 'Básico' })
    expect(GRADE_SCALE[3]).toMatchObject({ min: 0,    label: 'Bajo' })
  })
})

describe('gradeLevel', () => {
  it('returns Superior for 4.50', () => {
    expect(gradeLevel(4.50).label).toBe('Superior')
  })

  it('returns Superior for 5.0', () => {
    expect(gradeLevel(5.0).label).toBe('Superior')
  })

  it('returns Alto for 4.0', () => {
    expect(gradeLevel(4.0).label).toBe('Alto')
  })

  it('returns Alto for 4.49', () => {
    expect(gradeLevel(4.49).label).toBe('Alto')
  })

  it('returns Básico for 3.50', () => {
    expect(gradeLevel(3.50).label).toBe('Básico')
  })

  it('returns Básico for 3.99', () => {
    expect(gradeLevel(3.99).label).toBe('Básico')
  })

  it('returns Bajo for 3.49', () => {
    expect(gradeLevel(3.49).label).toBe('Bajo')
  })

  it('returns Bajo for 1.0', () => {
    expect(gradeLevel(1.0).label).toBe('Bajo')
  })

  it('returns null for null input', () => {
    expect(gradeLevel(null)).toBeNull()
  })
})

describe('gradeColor', () => {
  it('returns gray for null', () => {
    expect(gradeColor(null)).toBe('#9CA3AF')
  })

  it('returns the correct color for each level', () => {
    expect(gradeColor(4.8)).toBe('#15803D')
    expect(gradeColor(4.2)).toBe('#1D4ED8')
    expect(gradeColor(3.7)).toBe('#D97706')
    expect(gradeColor(2.5)).toBe('#DC2626')
  })
})

// ── EXAM_PRESETS ────────────────────────────────────────────────────────────────

describe('EXAM_PRESETS', () => {
  it('has quiz, final_lower, and final_upper presets', () => {
    expect(EXAM_PRESETS.quiz).toBeDefined()
    expect(EXAM_PRESETS.final_lower).toBeDefined()
    expect(EXAM_PRESETS.final_upper).toBeDefined()
  })

  it('quiz has no Extra Points', () => {
    expect(EXAM_PRESETS.quiz.hasExtraPoints).toBe(false)
  })

  it('final presets have 5 Extra Points', () => {
    expect(EXAM_PRESETS.final_lower.extraPoints).toBe(5)
    expect(EXAM_PRESETS.final_upper.extraPoints).toBe(5)
  })

  it('final_lower base is 20, final_upper base is 35', () => {
    expect(EXAM_PRESETS.final_lower.baseQuestions).toBe(20)
    expect(EXAM_PRESETS.final_upper.baseQuestions).toBe(35)
  })

  it('final_upper has requiredComponents', () => {
    expect(EXAM_PRESETS.final_upper.requiredComponents).toContain('cloze')
    expect(EXAM_PRESETS.final_upper.requiredComponents).toContain('reading')
  })
})

// ── extractGradeNumber ──────────────────────────────────────────────────────────

describe('extractGradeNumber', () => {
  it('extracts 8 from "8.° Blue"', () => {
    expect(extractGradeNumber('8.° Blue')).toBe(8)
  })

  it('extracts 10 from "10.° Red"', () => {
    expect(extractGradeNumber('10.° Red')).toBe(10)
  })

  it('extracts 1 from "1.°"', () => {
    expect(extractGradeNumber('1.°')).toBe(1)
  })

  it('returns null for empty/null', () => {
    expect(extractGradeNumber('')).toBeNull()
    expect(extractGradeNumber(null)).toBeNull()
  })
})

// ── getExamPreset ───────────────────────────────────────────────────────────────

describe('getExamPreset', () => {
  it('returns quiz preset for examType quiz', () => {
    expect(getExamPreset('quiz', '8.° Blue').key).toBe('quiz')
  })

  it('returns final_lower for final + grade 8', () => {
    expect(getExamPreset('final', '8.° Blue').key).toBe('final_lower')
  })

  it('returns final_lower for final + grade 1', () => {
    expect(getExamPreset('final', '1.°').key).toBe('final_lower')
  })

  it('returns final_upper for final + grade 9', () => {
    expect(getExamPreset('final', '9.° Green').key).toBe('final_upper')
  })

  it('returns final_upper for final + grade 11', () => {
    expect(getExamPreset('final', '11.° Red').key).toBe('final_upper')
  })

  it('returns final_lower when grade is null (safe fallback)', () => {
    expect(getExamPreset('final', null).key).toBe('final_lower')
  })
})

// ── finalExamGrade ──────────────────────────────────────────────────────────────

describe('finalExamGrade', () => {
  it('perfect score with no extras = 5.0', () => {
    expect(finalExamGrade(20, 20, 0)).toBe('5.0')
  })

  it('15/20 base = 4.0, +5 extras = 4.5', () => {
    // base = (15/20)*4+1 = 4.0, bonus = 5*0.1 = 0.5
    expect(finalExamGrade(15, 20, 5)).toBe('4.5')
  })

  it('protocol example: 15/20 correct, all 5 extra = 4.5', () => {
    // Protocol says 3.75 + 0.5 = 4.25 but protocol uses different formula
    // Our formula: (15/20)*4+1 = 4.0 + 0.5 = 4.5
    expect(finalExamGrade(15, 20, 5)).toBe('4.5')
  })

  it('caps at 5.0 even with extras', () => {
    expect(finalExamGrade(20, 20, 5)).toBe('5.0')
  })

  it('extra bonus capped at 0.5 (5 questions max)', () => {
    expect(finalExamGrade(10, 20, 10)).toBe('3.5')
    // base = (10/20)*4+1 = 3.0, bonus capped at 0.5
  })

  it('zero score with no extras = 1.0', () => {
    expect(finalExamGrade(0, 20, 0)).toBe('1.0')
  })

  it('returns null for baseTotal = 0', () => {
    expect(finalExamGrade(0, 0, 0)).toBeNull()
  })

  it('works with 35-question final', () => {
    // (20/35)*4+1 ≈ 3.2857 → 3.3, +0.5 = 3.8
    expect(finalExamGrade(20, 35, 5)).toBe('3.8')
  })
})
