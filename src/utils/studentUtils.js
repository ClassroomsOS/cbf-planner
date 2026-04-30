// studentUtils.js — Utilidades puras del módulo de estudiantes
// Extraídas de StudentsPage para permitir testing y reutilización.

export const DOMAIN = '@redboston.edu.co'
export const VALID_SECTIONS = ['Blue', 'Red']
export const VALID_GRADES   = ['6.°', '7.°', '8.°', '9.°', '10.°', '11.°']

/**
 * Construye el nombre compuesto para almacenar en DB.
 * Orden: Nombre1 [Nombre2] Apellido1 [Apellido2]
 */
export function composeName(firstName, secondName, firstLastname, secondLastname) {
  return [firstName, secondName, firstLastname, secondLastname]
    .map(s => s?.trim() || '')
    .filter(Boolean)
    .join(' ')
}

/**
 * Nombre para mostrar en UI: Apellidos primero.
 * Orden: APELLIDO1 [APELLIDO2] NOMBRE1 [NOMBRE2]
 *
 * @param {{ first_name, second_name, first_lastname, second_lastname }} student
 */
export function displayName(student) {
  return [student.first_lastname, student.second_lastname, student.first_name, student.second_name]
    .map(v => v?.trim() || '')
    .filter(Boolean)
    .join(' ')
}

/**
 * Normaliza el grado a formato CBF: "8.°"
 * Acepta: "8", "8°", "8.°", "  8  "
 */
export function normalizeGrade(raw) {
  const s = raw.trim().replace(/[°.]/g, '').trim()
  if (!s) return ''
  return `${s}.°`
}

/**
 * Normaliza un email para estudiantes.
 * Si no tiene @, agrega el dominio del colegio.
 * Si tiene dominio diferente y autoCompleteDomain=true, retorna el email tal cual.
 */
export function normalizeEmail(raw, autoCompleteDomain = true) {
  const e = raw.trim().toLowerCase()
  if (!e) return ''
  if (e.includes('@')) return e
  return autoCompleteDomain ? e + DOMAIN : e
}

/**
 * Parsea texto CSV/TSV de 8 columnas al formato de school_students.
 * Columnas: Apellido1 | Apellido2 | Nombre1 | Nombre2 | Grado | Sección | Email | Email Rep.
 *
 * @param {string} text   - Texto pegado del CSV
 * @param {string} domain - Dominio del colegio (default @redboston.edu.co)
 * @returns {{ students: object[], errors: string[], warnings: string[] }}
 */
export function parseCSV(text, domain = DOMAIN) {
  const rows = text.trim().split(/\r?\n/).filter(r => r.trim())
  const students = []
  const errors   = []
  const warnings = []

  let startRow = 0
  if (rows.length > 0) {
    const firstCols = rows[0].split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
    const col5 = firstCols[4] || ''
    if (col5 && !/^\d+/.test(col5.replace(/\s/g, ''))) startRow = 1
  }

  for (let i = startRow; i < rows.length; i++) {
    const cols = rows[i].split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))

    if (cols.every(c => !c)) continue

    if (cols.length < 4) {
      errors.push(`Fila ${i + 1}: muy pocas columnas (${cols.length}) — se necesitan al menos Nombre, Apellido, Grado, Sección`)
      continue
    }

    const [firstLastname, secondLastname, firstName, secondName, gradeRaw, sectionRaw, emailRaw, repEmailRaw] = cols

    if (!firstLastname?.trim()) { errors.push(`Fila ${i + 1}: Primer Apellido vacío`); continue }
    if (!firstName?.trim())     { errors.push(`Fila ${i + 1}: Primer Nombre vacío`);   continue }
    if (!gradeRaw?.trim())      { errors.push(`Fila ${i + 1}: Grado vacío`);            continue }

    const grade = normalizeGrade(gradeRaw)
    if (!grade) { errors.push(`Fila ${i + 1}: Grado inválido "${gradeRaw}"`); continue }

    const section = sectionRaw?.trim() || ''
    if (!VALID_SECTIONS.map(s => s.toLowerCase()).includes(section.toLowerCase())) {
      errors.push(`Fila ${i + 1}: Sección inválida "${section || '(vacía)'}" — debe ser Blue o Red`)
      continue
    }

    let email = emailRaw?.trim() || ''
    if (email) {
      if (!email.includes('@')) {
        email = email.toLowerCase() + domain
      } else if (!email.toLowerCase().endsWith(domain)) {
        const autoEmail = `${firstName.trim().toLowerCase()}.${firstLastname.trim().toLowerCase()}${domain}`
        warnings.push(`Fila ${i + 1}: email "${email}" no es del colegio — se usará ${autoEmail}`)
        email = autoEmail
      }
    }

    const name = composeName(firstName, secondName, firstLastname, secondLastname)

    students.push({
      first_name:           firstName.trim(),
      second_name:          secondName?.trim() || '',
      first_lastname:       firstLastname.trim(),
      second_lastname:      secondLastname?.trim() || '',
      name,
      grade,
      section:              section.charAt(0).toUpperCase() + section.slice(1).toLowerCase(),
      email,
      representative_email: repEmailRaw?.trim() || '',
    })
  }

  return { students, errors, warnings }
}
