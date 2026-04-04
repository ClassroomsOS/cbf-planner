import { describe, it, expect } from 'vitest'
import {
  sanitizeAIInput,
  teacherProfileSchema,
  teacherRoleUpdateSchema,
  learningTargetSchema,
  lessonPlanMetaSchema,
} from './validationSchemas'

describe('sanitizeAIInput', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeAIInput(null)).toBe('')
    expect(sanitizeAIInput(42)).toBe('')
    expect(sanitizeAIInput(undefined)).toBe('')
  })
  it('trims whitespace', () => {
    expect(sanitizeAIInput('  hello  ')).toBe('hello')
  })
  it('replaces code block markers', () => {
    expect(sanitizeAIInput('```code```')).toContain("'''")
  })
  it('removes [INST] markers', () => {
    expect(sanitizeAIInput('[INST]do something[/INST]')).not.toContain('[INST]')
  })
  it('replaces "Human:" with "Usuario:"', () => {
    expect(sanitizeAIInput('Human: hello')).toBe('Usuario: hello')
  })
  it('replaces "Assistant:" with "Asistente:"', () => {
    expect(sanitizeAIInput('Assistant: reply')).toBe('Asistente: reply')
  })
  it('replaces "System:" with "Sistema:"', () => {
    expect(sanitizeAIInput('System: prompt')).toBe('Sistema: prompt')
  })
  it('truncates input exceeding 10000 characters', () => {
    const long = 'a'.repeat(15000)
    expect(sanitizeAIInput(long)).toHaveLength(10000)
  })
  it('preserves normal text unchanged', () => {
    expect(sanitizeAIInput('Hello world')).toBe('Hello world')
  })
})

describe('teacherProfileSchema', () => {
  it('validates a correct profile', () => {
    const result = teacherProfileSchema.safeParse({
      name: 'Juan Pérez',
      school_id: '123e4567-e89b-12d3-a456-426614174000',
    })
    expect(result.success).toBe(true)
  })
  it('rejects name too short', () => {
    const result = teacherProfileSchema.safeParse({
      name: 'A',
      school_id: '123e4567-e89b-12d3-a456-426614174000',
    })
    expect(result.success).toBe(false)
  })
  it('rejects invalid school_id UUID', () => {
    const result = teacherProfileSchema.safeParse({
      name: 'Juan Pérez',
      school_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })
})

describe('teacherRoleUpdateSchema', () => {
  it('accepts all valid roles', () => {
    const validRoles = ['teacher', 'admin', 'superadmin', 'director', 'psicopedagoga']
    validRoles.forEach(role => {
      const result = teacherRoleUpdateSchema.safeParse({
        role,
        teacher_id: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })
  })
  it('rejects unknown role', () => {
    const result = teacherRoleUpdateSchema.safeParse({
      role: 'janitor',
      teacher_id: '123e4567-e89b-12d3-a456-426614174000',
    })
    expect(result.success).toBe(false)
  })
})

describe('learningTargetSchema', () => {
  const valid = {
    subject: 'Language Arts',
    grade: '5.°',
    period: '1',
    description: 'Students will demonstrate reading comprehension skills.',
    taxonomy: 'apply',
  }
  it('validates a correct learning target', () => {
    expect(learningTargetSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects description shorter than 10 chars', () => {
    const result = learningTargetSchema.safeParse({ ...valid, description: 'Short' })
    expect(result.success).toBe(false)
  })
  it('rejects invalid taxonomy', () => {
    const result = learningTargetSchema.safeParse({ ...valid, taxonomy: 'memorize' })
    expect(result.success).toBe(false)
  })
  it('rejects period outside 1-4', () => {
    const result = learningTargetSchema.safeParse({ ...valid, period: '5' })
    expect(result.success).toBe(false)
  })
})

describe('lessonPlanMetaSchema', () => {
  const valid = { grade: '5.°', subject: 'Science', period: '2', week_number: 10 }
  it('validates correct data', () => {
    expect(lessonPlanMetaSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects week_number above 52', () => {
    expect(lessonPlanMetaSchema.safeParse({ ...valid, week_number: 53 }).success).toBe(false)
  })
  it('rejects week_number below 1', () => {
    expect(lessonPlanMetaSchema.safeParse({ ...valid, week_number: 0 }).success).toBe(false)
  })
  it('rejects non-integer week_number', () => {
    expect(lessonPlanMetaSchema.safeParse({ ...valid, week_number: 1.5 }).success).toBe(false)
  })
})
