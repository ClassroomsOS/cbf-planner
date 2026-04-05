import { describe, it, expect } from 'vitest'
import { canManage, isSuperAdmin, isRector, isPsicopedagoga, ROLES } from './roles'

describe('canManage', () => {
  it('returns true for admin', () => {
    expect(canManage('admin')).toBe(true)
  })
  it('returns true for superadmin', () => {
    expect(canManage('superadmin')).toBe(true)
  })
  it('returns false for teacher', () => {
    expect(canManage('teacher')).toBe(false)
  })
  it('returns false for rector', () => {
    expect(canManage('rector')).toBe(false)
  })
  it('returns false for psicopedagoga', () => {
    expect(canManage('psicopedagoga')).toBe(false)
  })
  it('returns false for undefined', () => {
    expect(canManage(undefined)).toBe(false)
  })
})

describe('isSuperAdmin', () => {
  it('returns true only for superadmin', () => {
    expect(isSuperAdmin('superadmin')).toBe(true)
    expect(isSuperAdmin('admin')).toBe(false)
    expect(isSuperAdmin('teacher')).toBe(false)
  })
})

describe('isRector', () => {
  it('returns true only for rector', () => {
    expect(isRector('rector')).toBe(true)
    expect(isRector('admin')).toBe(false)
    expect(isRector('teacher')).toBe(false)
  })
})

describe('isPsicopedagoga', () => {
  it('returns true only for psicopedagoga', () => {
    expect(isPsicopedagoga('psicopedagoga')).toBe(true)
    expect(isPsicopedagoga('admin')).toBe(false)
    expect(isPsicopedagoga('teacher')).toBe(false)
  })
})

describe('ROLES constants', () => {
  it('defines all expected roles', () => {
    expect(ROLES.TEACHER).toBe('teacher')
    expect(ROLES.ADMIN).toBe('admin')
    expect(ROLES.SUPERADMIN).toBe('superadmin')
    expect(ROLES.RECTOR).toBe('rector')
    expect(ROLES.PSICOPEDAGOGA).toBe('psicopedagoga')
  })
})
