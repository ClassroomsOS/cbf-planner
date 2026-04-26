// StudentsPage.jsx — Gestión del roster de estudiantes
// Ruta: /students

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'

// ─── Constantes ───────────────────────────────────────────────

const DOMAIN = '@redboston.edu.co'
const SECTIONS = ['Blue', 'Red']
const GRADES = ['6.°', '7.°', '8.°', '9.°', '10.°', '11.°']

// ─── Helpers ─────────────────────────────────────────────────

function composeName(firstName, secondName, firstLastname, secondLastname) {
  return [firstName, secondName, firstLastname, secondLastname]
    .map(s => s?.trim() || '')
    .filter(Boolean)
    .join(' ')
}

// Apellidos primero: PRIMER APELLIDO [SEGUNDO APELLIDO] PRIMER NOMBRE [SEGUNDO NOMBRE]
function displayName(s) {
  return [s.first_lastname, s.second_lastname, s.first_name, s.second_name]
    .map(v => v?.trim() || '')
    .filter(Boolean)
    .join(' ')
}

function normalizeGrade(raw) {
  const s = raw.trim().replace(/[°.]/g, '').trim()
  if (!s) return ''
  return `${s}.°`
}

function normalizeEmail(raw, autoCompleteDomain = true) {
  const e = raw.trim().toLowerCase()
  if (!e) return ''
  if (e.includes('@')) return e
  return autoCompleteDomain ? e + DOMAIN : e
}

// ─── CSV Parser — 8 columnas ──────────────────────────────────
// Columnas: Primer Apellido | Segundo Apellido | Primer Nombre | Segundo Nombre
//           | Grado | Sección | Email estudiante | Email representante

function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).filter(r => r.trim())
  const students = []
  const errors   = []
  const warnings = []

  // Detectar encabezado: la primera fila es encabezado si alguna de las primeras 6 cols
  // contiene texto alfabético (ej. "Nombre", "Grado", "Columna1"...)
  // Una fila de datos real tiene col 1 y col 3 como nombres (solo letras/tildes) Y col 5 como número
  let startRow = 0
  if (rows.length > 0) {
    const firstCols = rows[0].split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
    const col5 = firstCols[4] || ''
    // Si col 5 no es un número de grado (8, 9, 10, 8°, 8.°, etc.) → es encabezado
    if (col5 && !/^\d+/.test(col5.replace(/\s/g, ''))) startRow = 1
    // Si col 5 está vacía y hay suficientes columnas → asumir que podría ser dato, no saltar
  }

  for (let i = startRow; i < rows.length; i++) {
    const cols = rows[i].split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))

    // Ignorar filas completamente vacías
    if (cols.every(c => !c)) continue

    if (cols.length < 4) {
      errors.push(`Fila ${i + 1}: muy pocas columnas (${cols.length}) — se necesitan al menos Nombre, Apellido, Grado, Sección`)
      continue
    }

    const [firstLastname, secondLastname, firstName, secondName, gradeRaw, sectionRaw, emailRaw, repEmailRaw] = cols

    if (!firstLastname?.trim()) { errors.push(`Fila ${i + 1}: Primer Apellido vacío`); continue }
    if (!firstName?.trim()) { errors.push(`Fila ${i + 1}: Primer Nombre vacío`); continue }
    if (!gradeRaw?.trim()) { errors.push(`Fila ${i + 1}: Grado vacío`); continue }

    const grade   = normalizeGrade(gradeRaw)
    if (!grade) { errors.push(`Fila ${i + 1}: Grado inválido "${gradeRaw}"`); continue }

    const section = sectionRaw?.trim() || ''
    if (!SECTIONS.map(s => s.toLowerCase()).includes(section.toLowerCase())) {
      errors.push(`Fila ${i + 1}: Sección inválida "${section || '(vacía)'}" — debe ser Blue o Red`)
      continue
    }

    // Email: si está vacío o tiene dominio diferente → auto-generar con dominio escolar
    let email = emailRaw?.trim() || ''
    if (email) {
      if (!email.includes('@')) {
        email = email.toLowerCase() + DOMAIN
      } else if (!email.toLowerCase().endsWith(DOMAIN)) {
        // Dominio diferente → auto-generar y avisar
        const autoEmail = `${firstName.trim().toLowerCase()}.${firstLastname.trim().toLowerCase()}${DOMAIN}`
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

// ─── Componente principal ─────────────────────────────────────

const EMPTY_FORM = {
  first_name: '', second_name: '', first_lastname: '', second_lastname: '',
  grade: '', section: '', email: '', representative_email: '',
}

export default function StudentsPage({ teacher }) {
  const { showToast } = useToast()

  const [students,      setStudents]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [filterGrade,   setFilterGrade]   = useState('')
  const [filterSection, setFilterSection] = useState('')
  const [searchText,    setSearchText]    = useState('')

  const [form,    setForm]    = useState(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')

  const [csvText,     setCsvText]     = useState('')
  const [csvParsed,   setCsvParsed]   = useState(null)
  const [csvErrors,   setCsvErrors]   = useState([])
  const [csvWarnings, setCsvWarnings] = useState([])
  const [showImport,  setShowImport]  = useState(false)

  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [selectedIds,        setSelectedIds]        = useState(new Set())
  const [bulkConfirm,        setBulkConfirm]        = useState(false)
  const [psyProfiles,        setPsyProfiles]        = useState({})

  useEffect(() => {
    loadStudents()
    loadPsyProfiles()
  }, [])

  async function loadPsyProfiles() {
    const { data } = await supabase
      .from('student_psychosocial_profiles')
      .select('student_id, status')
      .eq('school_id', teacher.school_id)
    const map = {}
    ;(data || []).forEach(p => { map[p.student_id] = p })
    setPsyProfiles(map)
  }

  async function loadStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('school_students')
      .select('id, name, first_name, second_name, first_lastname, second_lastname, email, representative_email, grade, section, student_code, created_at')
      .eq('school_id', teacher.school_id)
      .order('grade')
      .order('section')
      .order('name')
    if (error) showToast('Error cargando el roster', 'error')
    else setStudents(data || [])
    setLoading(false)
  }

  // ── Agregar uno a uno ─────────────────────────────────────────

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleAddOne(e) {
    e.preventDefault()
    setFormErr('')

    const firstName     = form.first_name.trim()
    const firstLastname = form.first_lastname.trim()
    const grade         = form.grade
    const section       = form.section

    if (!firstName || !firstLastname || !grade || !section) {
      setFormErr('Primer nombre, primer apellido, grado y sección son obligatorios.')
      return
    }

    let email = form.email.trim().toLowerCase()
    if (email && !email.includes('@')) email = email + DOMAIN
    if (email && !email.endsWith(DOMAIN)) {
      setFormErr(`El correo del estudiante debe ser ${DOMAIN}`)
      return
    }

    const name = composeName(firstName, form.second_name, firstLastname, form.second_lastname)

    setSaving(true)
    const { error } = await supabase.from('school_students').insert({
      school_id:           teacher.school_id,
      teacher_id:          teacher.id,
      name,
      first_name:          firstName,
      second_name:         form.second_name.trim() || null,
      first_lastname:      firstLastname,
      second_lastname:     form.second_lastname.trim() || null,
      email:               email || `${firstName.toLowerCase()}.${firstLastname.toLowerCase()}${DOMAIN}`,
      representative_email: form.representative_email.trim() || null,
      grade,
      section,
    })

    if (error) {
      if (error.code === '23505') setFormErr('Este correo ya está registrado en el colegio.')
      else setFormErr('Error al agregar. ' + error.message)
    } else {
      showToast(`${name} agregado correctamente`, 'success')
      setForm(EMPTY_FORM)
      loadStudents()
    }
    setSaving(false)
  }

  // ── Importar CSV ──────────────────────────────────────────────

  function handleParseCSV() {
    const { students: parsed, errors, warnings } = parseCSV(csvText)
    setCsvParsed(parsed)
    setCsvWarnings(warnings || [])
    setCsvErrors(errors)
  }

  async function handleImportCSV() {
    if (!csvParsed?.length) return
    setSaving(true)

    const rows = csvParsed.map(s => ({
      school_id:            teacher.school_id,
      teacher_id:           teacher.id,
      name:                 s.name,
      first_name:           s.first_name,
      second_name:          s.second_name || null,
      first_lastname:       s.first_lastname,
      second_lastname:      s.second_lastname || null,
      email:                s.email || `${s.first_name.toLowerCase()}.${s.first_lastname.toLowerCase()}${DOMAIN}`,
      representative_email: s.representative_email || null,
      grade:                s.grade,
      section:              s.section,
    }))

    let imported = 0, skipped = 0, failed = 0
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error } = await supabase.from('school_students').insert(batch)
      if (!error) {
        imported += batch.length
      } else if (error.code === '23505' && batch.length === 1) {
        skipped += 1
      } else if (error.code === '23505') {
        // Reintentar fila por fila para no penalizar el lote completo
        for (let j = 0; j < batch.length; j++) {
          const { error: rowErr } = await supabase.from('school_students').insert(batch[j])
          if (!rowErr) imported++
          else if (rowErr.code === '23505') skipped++
          else { failed++; showToast(`Fila ${i + j + 1}: ${rowErr.message}`, 'error') }
        }
      } else {
        failed += batch.length
        showToast(`Error: ${error.message}`, 'error')
      }
    }

    showToast(`${imported} importados · ${skipped} duplicados omitidos${failed ? ` · ${failed} fallidos` : ''}`, 'success')
    setCsvText(''); setCsvParsed(null); setCsvErrors([]); setCsvWarnings([]); setShowImport(false)
    loadStudents()
    setSaving(false)
  }

  // ── Eliminar ──────────────────────────────────────────────────

  async function handleDelete(id, name) {
    if (confirmingDeleteId !== id) { setConfirmingDeleteId(id); return }
    setConfirmingDeleteId(null)
    const { error } = await supabase.from('school_students').delete().eq('id', id)
    if (error) showToast('Error al eliminar', 'error')
    else { showToast(`${name} eliminado`, 'success'); loadStudents() }
  }

  async function handleBulkDelete() {
    if (!bulkConfirm) { setBulkConfirm(true); return }
    setBulkConfirm(false)
    setSaving(true)
    const ids = [...selectedIds]
    const { error } = await supabase.from('school_students').delete().in('id', ids)
    if (error) showToast('Error al eliminar: ' + error.message, 'error')
    else {
      showToast(`${ids.length} estudiante${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}`, 'success')
      setSelectedIds(new Set())
    }
    setSaving(false)
    loadStudents()
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setBulkConfirm(false)
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)))
    }
    setBulkConfirm(false)
  }

  // ── Filtrado ──────────────────────────────────────────────────

  const filtered = students.filter(s => {
    if (filterGrade   && s.grade !== filterGrade) return false
    if (filterSection && s.section?.toLowerCase() !== filterSection.toLowerCase()) return false
    if (searchText    && !s.name.toLowerCase().includes(searchText.toLowerCase()) &&
        !s.student_code?.toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  const grades = [...new Set(students.map(s => s.grade))].sort()

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1F3864' }}>
          👩‍🎓 Roster de Estudiantes
        </h1>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>
          Registra los estudiantes del colegio para exámenes y seguimiento psicosocial.
        </p>
      </div>

      {/* ── Agregar uno a uno ── */}
      <div style={card}>
        <h3 style={sectionTitle}>Agregar estudiante</h3>
        <form onSubmit={handleAddOne}>
          {/* Fila 1 — nombres */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={lbl}>Primer nombre *</label>
              <input style={inp} value={form.first_name} onChange={e => setF('first_name', e.target.value)} placeholder="María" />
            </div>
            <div>
              <label style={lbl}>Segundo nombre</label>
              <input style={inp} value={form.second_name} onChange={e => setF('second_name', e.target.value)} placeholder="Alejandra" />
            </div>
            <div>
              <label style={lbl}>Primer apellido *</label>
              <input style={inp} value={form.first_lastname} onChange={e => setF('first_lastname', e.target.value)} placeholder="García" />
            </div>
            <div>
              <label style={lbl}>Segundo apellido</label>
              <input style={inp} value={form.second_lastname} onChange={e => setF('second_lastname', e.target.value)} placeholder="López" />
            </div>
          </div>

          {/* Fila 2 — grado, sección, email, email representante */}
          <div style={{ display: 'grid', gridTemplateColumns: '120px 100px 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={lbl}>Grado *</label>
              <select style={inp} value={form.grade} onChange={e => setF('grade', e.target.value)}>
                <option value="">Grado</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Sección *</label>
              <select style={inp} value={form.section} onChange={e => setF('section', e.target.value)}>
                <option value="">Sección</option>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Email estudiante</label>
              <input style={inp} value={form.email} onChange={e => setF('email', e.target.value)}
                placeholder="mariagarcia (o correo completo)" />
            </div>
            <div>
              <label style={lbl}>Email representante</label>
              <input style={inp} type="email" value={form.representative_email}
                onChange={e => setF('representative_email', e.target.value)}
                placeholder="padre@gmail.com" />
            </div>
          </div>

          {formErr && <p style={{ color: '#DC2626', fontSize: 13, margin: '0 0 10px' }}>{formErr}</p>}
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? '...' : '+ Agregar estudiante'}
          </button>
        </form>
      </div>

      {/* ── Importar CSV ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Importar desde Excel / CSV</h3>
          <button style={{ ...btnSecondary, fontSize: 13 }} onClick={() => setShowImport(v => !v)}>
            {showImport ? 'Ocultar' : '📋 Importar lista'}
          </button>
        </div>

        {showImport && (
          <div style={{ marginTop: 16 }}>
            {/* Instrucciones formato */}
            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0C4A6E', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                Formato requerido — 8 columnas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, marginBottom: 8 }}>
                {[
                  { col: 'Primer Apellido', req: true },
                  { col: 'Segundo Apellido', req: false },
                  { col: 'Primer Nombre', req: true },
                  { col: 'Segundo Nombre', req: false },
                  { col: 'Grado', req: true },
                  { col: 'Sección', req: true },
                  { col: 'Email Estudiante', req: false },
                  { col: 'Email Representante', req: false },
                ].map(({ col, req }) => (
                  <div key={col} style={{ fontSize: 10, fontWeight: 700, color: req ? '#0C4A6E' : '#60a5fa', background: req ? '#BAE6FD' : '#e0f2fe', borderRadius: 4, padding: '3px 5px', textAlign: 'center' }}>
                    {col}{req ? ' *' : ''}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#0C4A6E', lineHeight: 1.7 }}>
                · Separa con <strong>Tab</strong> (copia desde Excel), coma o punto y coma<br />
                · Grado: <strong>8</strong>, <strong>8°</strong> o <strong>8.°</strong> — se normaliza automáticamente<br />
                · Sección: <strong>Blue</strong> o <strong>Red</strong><br />
                · Email: solo el usuario sin dominio (<strong>mariagarcia</strong>) o correo completo<br />
                · Si dejas Email vacío se genera automáticamente como <em>primernombre.primerapellido@redboston.edu.co</em><br />
                · Columnas opcionales pueden quedar vacías pero el separador debe estar
              </div>
            </div>

            {/* Ejemplo copiable */}
            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontFamily: 'monospace', fontSize: 12, color: '#374151', overflowX: 'auto', whiteSpace: 'nowrap' }}>
              García	López	María	Alejandra	8	Blue	mariagarcia	padre@gmail.com<br />
              Rodríguez		Pedro		9	Red	pedrorodriguez	madre@hotmail.com<br />
              López	Martínez	Juan	Carlos	8	Blue		tutor@gmail.com
            </div>

            <textarea
              style={{ ...inp, minHeight: 140, fontFamily: 'monospace', fontSize: 13 }}
              value={csvText}
              onChange={e => { setCsvText(e.target.value); setCsvParsed(null); setCsvErrors([]); setCsvWarnings([]) }}
              placeholder="Pega aquí tu lista desde Excel..."
            />

            {csvErrors.length > 0 && (
              <ul style={{ color: '#DC2626', fontSize: 13, margin: '8px 0', paddingLeft: 18 }}>
                {csvErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            {csvWarnings.length > 0 && (
              <ul style={{ color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 12, margin: '6px 0', padding: '8px 8px 8px 24px' }}>
                {csvWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}

            {csvParsed && csvParsed.length > 0 && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: 12, marginTop: 8 }}>
                <strong style={{ color: '#166534', fontSize: 13 }}>Vista previa — {csvParsed.length} estudiante{csvParsed.length !== 1 ? 's' : ''}</strong>
                <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#dcfce7' }}>
                        <th style={{ ...th, fontSize: 10 }}>Nombre completo</th>
                        <th style={{ ...th, fontSize: 10 }}>Grado</th>
                        <th style={{ ...th, fontSize: 10 }}>Sección</th>
                        <th style={{ ...th, fontSize: 10 }}>Email</th>
                        <th style={{ ...th, fontSize: 10 }}>Rep.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsed.map((s, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #bbf7d0' }}>
                          <td style={{ ...td, padding: '4px 8px', color: '#166534', fontWeight: 600 }}>{displayName(s)}</td>
                          <td style={{ ...td, padding: '4px 8px', color: '#166534' }}>{s.grade}</td>
                          <td style={{ ...td, padding: '4px 8px', color: '#166534' }}>{s.section}</td>
                          <td style={{ ...td, padding: '4px 8px', color: '#166534', fontSize: 11 }}>{s.email}</td>
                          <td style={{ ...td, padding: '4px 8px', color: '#166534', fontSize: 11 }}>{s.representative_email || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button style={btnSecondary} onClick={handleParseCSV} disabled={!csvText.trim()}>
                Verificar lista
              </button>
              {csvParsed?.length > 0 && (
                <button style={btnPrimary} onClick={handleImportCSV} disabled={saving}>
                  {saving ? 'Importando...' : `Importar ${csvParsed.length} estudiante${csvParsed.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Lista de estudiantes ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>
            Lista ({filtered.length} estudiante{filtered.length !== 1 ? 's' : ''})
            {selectedIds.size > 0 && (
              <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: '#6B7280' }}>
                · {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              style={{ ...inp, padding: '6px 10px', fontSize: 13, width: 180 }}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Buscar nombre o código..."
            />
            <select style={{ ...inp, padding: '6px 10px', fontSize: 13, width: 130 }}
              value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
              <option value="">Todos los grados</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <select style={{ ...inp, padding: '6px 10px', fontSize: 13, width: 110 }}
              value={filterSection} onChange={e => setFilterSection(e.target.value)}>
              <option value="">Todas las secciones</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 32 }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 32 }}>
            No hay estudiantes registrados. Agrega uno arriba o importa desde Excel.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#F9FAFB' }}>
                  <th style={{ ...th, width: 36, textAlign: 'center' }}>
                    <input type="checkbox" title="Seleccionar todos"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll} />
                  </th>
                  <th style={th}>Nombre completo</th>
                  <th style={th}>Grado</th>
                  <th style={th}>Sección</th>
                  <th style={th}>Código</th>
                  <th style={th}>Email estudiante</th>
                  <th style={th}>Email representante</th>
                  <th style={{ ...th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6', background: selectedIds.has(s.id) ? '#FEF2F2' : undefined }}>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600 }}>{displayName(s)}</span>
                        {psyProfiles[s.id] && (() => {
                          const st = psyProfiles[s.id].status
                          const dot = st === 'intervention' ? '#ef4444' : st === 'monitoring' ? '#f59e0b' : st === 'no_intervention' ? '#22c55e' : '#9ca3af'
                          return <span title="Perfil psicosocial activo" style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, display: 'inline-block' }} />
                        })()}
                      </div>
                    </td>
                    <td style={td}>{s.grade}</td>
                    <td style={td}>{s.section}</td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#1F3864', fontSize: 12 }}>
                      {s.student_code}
                    </td>
                    <td style={{ ...td, color: '#6B7280', fontSize: 12 }}>{s.email}</td>
                    <td style={{ ...td, color: '#6B7280', fontSize: 12 }}>{s.representative_email || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                    <td style={td}>
                      {confirmingDeleteId === s.id ? (
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
                            onClick={() => handleDelete(s.id, displayName(s))}>Confirmar</button>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 12 }}
                            onClick={() => setConfirmingDeleteId(null)}>Cancelar</button>
                        </span>
                      ) : (
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 16 }}
                          onClick={() => handleDelete(s.id, displayName(s))} title="Eliminar">🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: '#991B1B', flex: 1 }}>
              {selectedIds.size} estudiante{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13 }}
              onClick={() => { setSelectedIds(new Set()); setBulkConfirm(false) }}>
              Cancelar
            </button>
            {bulkConfirm ? (
              <>
                <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>¿Confirmar eliminación?</span>
                <button style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  onClick={handleBulkDelete} disabled={saving}>
                  {saving ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </>
            ) : (
              <button style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                onClick={handleBulkDelete} disabled={saving}>
                🗑 Eliminar seleccionados
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info de acceso */}
      <div style={{ ...card, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <h3 style={{ ...sectionTitle, color: '#1E3A8A' }}>¿Cómo acceden los estudiantes?</h3>
        <ol style={{ color: '#1E3A8A', fontSize: 14, lineHeight: 2, margin: 0, paddingLeft: 20 }}>
          <li>El docente activa el examen y comparte el <strong>Código de examen</strong> (ej. EX-2026-A1)</li>
          <li>El estudiante abre <strong>classroomsos.github.io/cbf-planner/eval</strong></li>
          <li>Ingresa su correo <strong>@redboston.edu.co</strong> y el código del examen</li>
          <li>El sistema lo autentica automáticamente y carga su versión personal del examen</li>
        </ol>
      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────

const card = {
  background: '#fff',
  border: '1px solid #E5E7EB',
  borderRadius: 12,
  padding: 20,
  marginBottom: 16,
}

const sectionTitle = {
  margin: '0 0 16px',
  fontSize: 15,
  fontWeight: 700,
  color: '#1F3864',
}

const lbl = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#6B7280',
  marginBottom: 4,
}

const inp = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  border: '1.5px solid #D1D5DB',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
}

const btnPrimary = {
  background: '#1F3864',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '9px 18px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnSecondary = {
  background: '#F3F4F6',
  color: '#374151',
  border: '1px solid #D1D5DB',
  borderRadius: 8,
  padding: '9px 14px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const th = {
  padding: '8px 10px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 700,
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const td = {
  padding: '10px',
  color: '#111827',
}
