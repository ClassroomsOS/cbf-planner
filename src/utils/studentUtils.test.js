import { describe, it, expect } from 'vitest'
import {
  composeName, displayName, normalizeGrade, normalizeEmail, parseCSV,
  DOMAIN, VALID_SECTIONS, VALID_GRADES,
} from './studentUtils'

// ── composeName ──────────────────────────────────────────────────────────────

describe('composeName', () => {
  it('joins all four parts when all are present', () => {
    expect(composeName('Juan', 'Carlos', 'Pérez', 'Gómez')).toBe('Juan Carlos Pérez Gómez')
  })

  it('skips empty optional parts', () => {
    expect(composeName('Juan', '', 'Pérez', '')).toBe('Juan Pérez')
  })

  it('handles null/undefined optional parts', () => {
    expect(composeName('Ana', null, 'Rodríguez', undefined)).toBe('Ana Rodríguez')
  })

  it('trims whitespace from each part', () => {
    expect(composeName('  Juan ', '  ', ' Pérez ', '')).toBe('Juan Pérez')
  })
})

// ── displayName ──────────────────────────────────────────────────────────────

describe('displayName', () => {
  it('returns LASTNAME1 LASTNAME2 FIRSTNAME1 FIRSTNAME2', () => {
    const s = { first_name: 'Juan', second_name: 'Carlos', first_lastname: 'Pérez', second_lastname: 'Gómez' }
    expect(displayName(s)).toBe('Pérez Gómez Juan Carlos')
  })

  it('skips empty second parts', () => {
    const s = { first_name: 'Ana', second_name: '', first_lastname: 'Rodríguez', second_lastname: '' }
    expect(displayName(s)).toBe('Rodríguez Ana')
  })

  it('handles null/undefined parts', () => {
    const s = { first_name: 'Luis', second_name: null, first_lastname: 'Torres', second_lastname: undefined }
    expect(displayName(s)).toBe('Torres Luis')
  })
})

// ── normalizeGrade ───────────────────────────────────────────────────────────

describe('normalizeGrade', () => {
  it('normalizes bare number', () => {
    expect(normalizeGrade('8')).toBe('8.°')
  })

  it('normalizes with degree sign only', () => {
    expect(normalizeGrade('8°')).toBe('8.°')
  })

  it('passes through already-normalized grade', () => {
    expect(normalizeGrade('8.°')).toBe('8.°')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeGrade('  10  ')).toBe('10.°')
  })

  it('handles multi-digit grades', () => {
    expect(normalizeGrade('11')).toBe('11.°')
    expect(normalizeGrade('11°')).toBe('11.°')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeGrade('')).toBe('')
    expect(normalizeGrade('   ')).toBe('')
  })

  it('all VALID_GRADES survive a round-trip', () => {
    for (const g of VALID_GRADES) {
      expect(normalizeGrade(g)).toBe(g)
    }
  })
})

// ── normalizeEmail ───────────────────────────────────────────────────────────

describe('normalizeEmail', () => {
  it('appends school domain when no @ is present', () => {
    expect(normalizeEmail('juan.perez')).toBe(`juan.perez${DOMAIN}`)
  })

  it('returns email as-is when it already has @', () => {
    expect(normalizeEmail('juan@gmail.com')).toBe('juan@gmail.com')
  })

  it('lowercases the email', () => {
    expect(normalizeEmail('Juan.Perez')).toBe(`juan.perez${DOMAIN}`)
  })

  it('trims whitespace', () => {
    expect(normalizeEmail('  juan.perez  ')).toBe(`juan.perez${DOMAIN}`)
  })

  it('returns empty string for empty input', () => {
    expect(normalizeEmail('')).toBe('')
    expect(normalizeEmail('   ')).toBe('')
  })

  it('with autoCompleteDomain=false, does not append domain', () => {
    expect(normalizeEmail('juan.perez', false)).toBe('juan.perez')
  })
})

// ── parseCSV ─────────────────────────────────────────────────────────────────

describe('parseCSV', () => {
  const validRow = 'Pérez\tGómez\tJuan\tCarlos\t8\tBlue\tjuan.perez@redboston.edu.co\t'

  it('parses a single valid row', () => {
    const { students, errors, warnings } = parseCSV(validRow)
    expect(errors).toHaveLength(0)
    expect(students).toHaveLength(1)
    const s = students[0]
    expect(s.first_lastname).toBe('Pérez')
    expect(s.first_name).toBe('Juan')
    expect(s.grade).toBe('8.°')
    expect(s.section).toBe('Blue')
  })

  it('skips header row when column 5 is not a grade number', () => {
    const csv = 'Apellido1\tApellido2\tNombre1\tNombre2\tGrado\tSección\tEmail\tRep\n' + validRow
    const { students, errors } = parseCSV(csv)
    expect(errors).toHaveLength(0)
    expect(students).toHaveLength(1)
  })

  it('auto-completes email without domain', () => {
    const row = 'Torres\t\tLuis\t\t9\tRed\tluist\t'
    const { students } = parseCSV(row)
    expect(students[0].email).toBe(`luist${DOMAIN}`)
  })

  it('auto-generates email when domain is wrong and emits warning', () => {
    const row = 'Torres\t\tLuis\t\t9\tRed\tluist@gmail.com\t'
    const { students, warnings } = parseCSV(row)
    expect(students[0].email).toBe(`luis.torres${DOMAIN}`)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('reports error for missing first lastname', () => {
    // Use comma separator so trim() doesn't strip the leading empty field
    const row = ',Gómez,Juan,Carlos,8,Blue,,'
    const { errors, students } = parseCSV(row)
    expect(students).toHaveLength(0)
    expect(errors[0]).toMatch(/Primer Apellido/)
  })

  it('reports error for invalid section', () => {
    const row = 'Pérez\t\tJuan\t\t8\tGreen\t\t'
    const { errors, students } = parseCSV(row)
    expect(students).toHaveLength(0)
    expect(errors[0]).toMatch(/Sección/)
  })

  it('reports error for missing grade', () => {
    const row = 'Pérez\t\tJuan\t\t\tBlue\t\t'
    const { errors, students } = parseCSV(row)
    expect(students).toHaveLength(0)
    expect(errors[0]).toMatch(/Grado/)
  })

  it('normalizes grade in various formats', () => {
    const formats = ['8', '8°', '8.°']
    for (const fmt of formats) {
      const row = `Pérez\t\tJuan\t\t${fmt}\tBlue\t\t`
      const { students, errors } = parseCSV(row)
      expect(errors).toHaveLength(0)
      expect(students[0].grade).toBe('8.°')
    }
  })

  it('ignores completely blank rows', () => {
    const csv = validRow + '\n\t\t\t\t\t\t\t\n' + validRow
    const { students, errors } = parseCSV(csv)
    expect(errors).toHaveLength(0)
    expect(students).toHaveLength(2)
  })

  it('accepts both Blue and Red sections (case-insensitive)', () => {
    for (const sec of ['Blue', 'blue', 'BLUE', 'Red', 'red', 'RED']) {
      const row = `Pérez\t\tJuan\t\t8\t${sec}\t\t`
      const { students, errors } = parseCSV(row)
      expect(errors).toHaveLength(0)
      expect(students[0].section).toMatch(/^(Blue|Red)$/)
    }
  })

  it('uses comma separator', () => {
    const row = 'Pérez,Gómez,Juan,Carlos,8,Blue,,\n'
    const { students, errors } = parseCSV(row)
    expect(errors).toHaveLength(0)
    expect(students).toHaveLength(1)
  })

  it('builds composite name field', () => {
    const row = 'Pérez\tGómez\tJuan\tCarlos\t8\tBlue\t\t'
    const { students } = parseCSV(row)
    expect(students[0].name).toBe('Juan Carlos Pérez Gómez')
  })

  it('stores representative_email when provided', () => {
    const row = 'Pérez\t\tJuan\t\t8\tBlue\t\trep@gmail.com'
    const { students } = parseCSV(row)
    expect(students[0].representative_email).toBe('rep@gmail.com')
  })
})

// ── constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('DOMAIN includes the @ sign', () => {
    expect(DOMAIN).toMatch(/^@/)
  })

  it('VALID_SECTIONS contains Blue and Red', () => {
    expect(VALID_SECTIONS).toContain('Blue')
    expect(VALID_SECTIONS).toContain('Red')
  })

  it('VALID_GRADES covers 6th through 11th', () => {
    expect(VALID_GRADES).toContain('6.°')
    expect(VALID_GRADES).toContain('11.°')
    expect(VALID_GRADES).toHaveLength(6)
  })
})
