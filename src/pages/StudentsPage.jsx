// StudentsPage.jsx — Gestión del roster de estudiantes
// Ruta: /students
// El docente carga su lista de alumnos (uno a uno o CSV/Excel pegado).
// Los estudiantes usan su email @redboston.edu.co para acceder al examen.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'

// ─── Constantes ───────────────────────────────────────────────

const DOMAIN = '@redboston.edu.co'

// ─── CSV Parser: acepta texto copiado de Excel / Google Sheets ─

function parseCSV(text) {
  const rows = text.trim().split(/\r?\n/).filter(r => r.trim())
  const students = []
  const errors   = []

  for (let i = 0; i < rows.length; i++) {
    // Separadores: coma, punto y coma, tabulación
    const cols = rows[i].split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''))
    if (cols.length < 3) {
      errors.push(`Fila ${i + 1}: se esperan 3 columnas (Nombre, Email, Sección)`)
      continue
    }
    const [name, email, section] = cols
    if (!name) { errors.push(`Fila ${i + 1}: nombre vacío`); continue }
    const emailClean = email.toLowerCase().includes(DOMAIN) ? email.toLowerCase() : `${email.toLowerCase()}${DOMAIN}`
    students.push({ name: name.trim(), email: emailClean, section: section.trim() })
  }
  return { students, errors }
}

// ─── Componente principal ─────────────────────────────────────

export default function StudentsPage({ teacher }) {
  const { showToast } = useToast()

  const [students,      setStudents]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [filterGrade,   setFilterGrade]   = useState('')
  const [filterSection, setFilterSection] = useState('')

  // Formulario — agregar uno a uno
  const [form, setForm] = useState({ name: '', email: '', section: '' })
  const [formErr, setFormErr] = useState('')

  // Importación CSV
  const [csvText,    setCsvText]    = useState('')
  const [csvParsed,  setCsvParsed]  = useState(null)
  const [csvErrors,  setCsvErrors]  = useState([])
  const [showImport, setShowImport] = useState(false)

  // Grade de este docente (primera asignación como referencia)
  const [myGrade, setMyGrade] = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  useEffect(() => {
    loadStudents()
    loadMyGrade()
  }, [])

  async function loadMyGrade() {
    const { data } = await supabase
      .from('teacher_assignments')
      .select('grade, section')
      .eq('teacher_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .limit(1)
      .maybeSingle()
    if (data) {
      const combined = data.section ? `${data.grade} ${data.section}` : data.grade
      setMyGrade(combined)
      setFilterGrade(combined)
    }
  }

  async function loadStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('school_students')
      .select('id, name, email, grade, section, student_code, created_at')
      .eq('school_id', teacher.school_id)
      .order('grade')
      .order('section')
      .order('name')

    if (error) {
      showToast('Error cargando el roster', 'error')
    } else {
      setStudents(data || [])
    }
    setLoading(false)
  }

  // ── Agregar un estudiante ─────────────────────────────────────

  async function handleAddOne(e) {
    e.preventDefault()
    setFormErr('')
    const name    = form.name.trim()
    const section = form.section.trim()
    let   email   = form.email.trim().toLowerCase()

    if (!name || !email || !section) {
      setFormErr('Todos los campos son obligatorios.')
      return
    }
    // Auto-completar dominio si solo pusieron el nombre de usuario
    if (!email.includes('@')) email = email + DOMAIN
    if (!email.endsWith(DOMAIN)) {
      setFormErr(`El correo debe ser ${DOMAIN}`)
      return
    }
    if (!myGrade) {
      setFormErr('No tienes grado asignado. Contacta al coordinador.')
      return
    }

    setSaving(true)
    const { error } = await supabase.from('school_students').insert({
      school_id:  teacher.school_id,
      teacher_id: teacher.id,
      name,
      email,
      grade:   myGrade,
      section,
    })

    if (error) {
      if (error.code === '23505') {
        setFormErr('Este correo ya está registrado en el colegio.')
      } else {
        setFormErr('Error al agregar. Intenta de nuevo.')
      }
    } else {
      showToast(`${name} agregado correctamente`, 'success')
      setForm({ name: '', email: '', section: '' })
      loadStudents()
    }
    setSaving(false)
  }

  // ── Importar CSV ──────────────────────────────────────────────

  function handleParseCSV() {
    const { students: parsed, errors } = parseCSV(csvText)
    setCsvParsed(parsed)
    setCsvErrors(errors)
  }

  async function handleImportCSV() {
    if (!csvParsed?.length) return
    if (!myGrade) {
      showToast('No tienes grado asignado.', 'error')
      return
    }
    setSaving(true)
    const rows = csvParsed.map(s => ({
      school_id:  teacher.school_id,
      teacher_id: teacher.id,
      name:       s.name,
      email:      s.email,
      grade:      myGrade,
      section:    s.section,
    }))

    // Insertar en batches de 50 para evitar timeouts
    let imported = 0
    let skipped  = 0
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      const { error } = await supabase
        .from('school_students')
        .insert(batch)
        // ignore_duplicates: si el correo ya existe, saltar silenciosamente
      if (error && error.code !== '23505') {
        showToast(`Error en fila ${i + 1}: ${error.message}`, 'error')
      } else if (error?.code === '23505') {
        skipped++
      } else {
        imported += batch.length
      }
    }

    showToast(`${imported} estudiantes importados. ${skipped} duplicados omitidos.`, 'success')
    setCsvText('')
    setCsvParsed(null)
    setCsvErrors([])
    setShowImport(false)
    loadStudents()
    setSaving(false)
  }

  // ── Eliminar estudiante ───────────────────────────────────────

  async function handleDelete(id, name) {
    if (confirmingDeleteId !== id) {
      setConfirmingDeleteId(id)
      return
    }
    setConfirmingDeleteId(null)
    const { error } = await supabase
      .from('school_students')
      .delete()
      .eq('id', id)
      .eq('school_id', teacher.school_id)

    if (error) {
      showToast('Error al eliminar', 'error')
    } else {
      showToast(`${name} eliminado`, 'success')
      loadStudents()
    }
  }

  // ── Filtrado ──────────────────────────────────────────────────

  const filtered = students.filter(s => {
    const matchGrade   = !filterGrade   || s.grade === filterGrade
    const matchSection = !filterSection || s.section.toLowerCase().includes(filterSection.toLowerCase())
    return matchGrade && matchSection
  })

  const grades = [...new Set(students.map(s => s.grade))].sort()

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1F3864' }}>
          👩‍🎓 Roster de Estudiantes
        </h1>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>
          Los estudiantes usan su correo <strong>@redboston.edu.co</strong> para acceder al examen.
        </p>
      </div>

      {/* Agregar uno a uno */}
      <div style={card}>
        <h3 style={sectionTitle}>Agregar estudiante</h3>
        <form onSubmit={handleAddOne} style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: '2 1 200px' }}>
            <label style={lbl}>Nombre completo</label>
            <input
              style={inp}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="María García López"
            />
          </div>
          <div style={{ flex: '2 1 200px' }}>
            <label style={lbl}>Correo institucional</label>
            <input
              style={inp}
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="mariagarcia (o correo completo)"
            />
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={lbl}>Sección</label>
            <input
              style={inp}
              value={form.section}
              onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
              placeholder="Blue"
            />
          </div>
          <div style={{ flex: '0 0 auto', alignSelf: 'flex-end' }}>
            <button type="submit" style={btnPrimary} disabled={saving}>
              {saving ? '...' : '+ Agregar'}
            </button>
          </div>
          {formErr && <p style={{ color: '#DC2626', fontSize: 13, margin: 0, flex: '1 0 100%' }}>{formErr}</p>}
        </form>
      </div>

      {/* Importar CSV */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Importar desde Excel / CSV</h3>
          <button
            style={{ ...btnSecondary, fontSize: 13 }}
            onClick={() => setShowImport(v => !v)}
          >
            {showImport ? 'Ocultar' : '📋 Importar lista'}
          </button>
        </div>

        {showImport && (
          <div style={{ marginTop: 16 }}>
            <p style={{ color: '#6B7280', fontSize: 13, margin: '0 0 8px' }}>
              Copia y pega desde Excel. Columnas requeridas: <strong>Nombre</strong>, <strong>Correo</strong> (o usuario sin dominio), <strong>Sección</strong>.
            </p>
            <textarea
              style={{ ...inp, minHeight: 120, fontFamily: 'monospace', fontSize: 13 }}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              placeholder={`María García\tmariagarcia\tBlue\nPedro López\tpedrolopez\tRed`}
            />
            {csvErrors.length > 0 && (
              <ul style={{ color: '#DC2626', fontSize: 13, margin: '8px 0' }}>
                {csvErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
            {csvParsed && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: 12, marginTop: 8 }}>
                <strong style={{ color: '#166534' }}>Vista previa ({csvParsed.length} estudiantes):</strong>
                <div style={{ maxHeight: 160, overflowY: 'auto', marginTop: 8 }}>
                  {csvParsed.map((s, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#374151', padding: '2px 0' }}>
                      {s.name} · {s.email} · {s.section}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button style={btnSecondary} onClick={handleParseCSV} disabled={!csvText.trim()}>
                Verificar lista
              </button>
              {csvParsed?.length > 0 && (
                <button style={btnPrimary} onClick={handleImportCSV} disabled={saving}>
                  {saving ? 'Importando...' : `Importar ${csvParsed.length} estudiantes`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de estudiantes */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>
            Lista ({filtered.length} estudiantes)
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              style={{ ...inp, padding: '6px 10px', fontSize: 13 }}
              value={filterGrade}
              onChange={e => setFilterGrade(e.target.value)}
            >
              <option value="">Todos los grados</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input
              style={{ ...inp, padding: '6px 10px', fontSize: 13, width: 100 }}
              value={filterSection}
              onChange={e => setFilterSection(e.target.value)}
              placeholder="Sección"
            />
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
                  <th style={th}>Nombre</th>
                  <th style={th}>Correo</th>
                  <th style={th}>Grado</th>
                  <th style={th}>Sección</th>
                  <th style={th}>Código</th>
                  <th style={{ ...th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={td}>{s.name}</td>
                    <td style={{ ...td, color: '#6B7280', fontSize: 13 }}>{s.email}</td>
                    <td style={td}>{s.grade}</td>
                    <td style={td}>{s.section}</td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#1F3864', fontSize: 13 }}>
                      {s.student_code}
                    </td>
                    <td style={td}>
                      {confirmingDeleteId === s.id ? (
                        <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button
                            style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
                            onClick={() => handleDelete(s.id, s.name)}
                          >Confirmar</button>
                          <button
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 12 }}
                            onClick={() => setConfirmingDeleteId(null)}
                          >Cancelar</button>
                        </span>
                      ) : (
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 16 }}
                          onClick={() => handleDelete(s.id, s.name)}
                          title="Eliminar"
                        >🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
