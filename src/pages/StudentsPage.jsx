// StudentsPage.jsx — Gestión del roster de estudiantes
// Ruta: /students

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import {
  composeName, displayName, normalizeGrade, normalizeEmail, parseCSV,
  VALID_SECTIONS as SECTIONS, VALID_GRADES as GRADES, DOMAIN,
} from '../utils/studentUtils'

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
  const [showAddForm, setShowAddForm] = useState(true)

  const [csvText,       setCsvText]       = useState('')
  const [csvParsed,     setCsvParsed]     = useState(null)
  const [csvErrors,     setCsvErrors]     = useState([])
  const [csvWarnings,   setCsvWarnings]   = useState([])
  const [showImport,    setShowImport]    = useState(false)
  const [csvEditingIdx, setCsvEditingIdx] = useState(null)

  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [selectedIds,        setSelectedIds]        = useState(new Set())
  const [bulkConfirm,        setBulkConfirm]        = useState(false)
  const [sortCol,            setSortCol]            = useState('name')
  const [sortAsc,            setSortAsc]            = useState(true)
  const [psyProfiles,        setPsyProfiles]        = useState({})
  const [expandedId,         setExpandedId]         = useState(null)

  // ── Edit modal ──
  const [editingStudent, setEditingStudent] = useState(null)
  const [editForm,       setEditForm]       = useState(EMPTY_FORM)
  const [editErr,        setEditErr]        = useState('')
  const [editSaving,     setEditSaving]     = useState(false)

  useEffect(() => {
    loadStudents()
    loadPsyProfiles()
  }, [])

  // Collapse add form once students are loaded
  useEffect(() => {
    if (!loading && students.length > 0) setShowAddForm(false)
  }, [loading])

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

  // ── Editar estudiante ─────────────────────────────────────────

  function openEdit(student) {
    setEditingStudent(student)
    setEditForm({
      first_name:          student.first_name || '',
      second_name:         student.second_name || '',
      first_lastname:      student.first_lastname || '',
      second_lastname:     student.second_lastname || '',
      grade:               student.grade || '',
      section:             student.section || '',
      email:               student.email || '',
      representative_email: student.representative_email || '',
    })
    setEditErr('')
  }

  async function handleEditSave() {
    setEditErr('')
    const firstName     = editForm.first_name.trim()
    const firstLastname = editForm.first_lastname.trim()
    const grade         = editForm.grade
    const section       = editForm.section

    if (!firstName || !firstLastname || !grade || !section) {
      setEditErr('Primer nombre, primer apellido, grado y sección son obligatorios.')
      return
    }

    let email = editForm.email.trim().toLowerCase()
    if (email && !email.includes('@')) email = email + DOMAIN
    if (email && !email.endsWith(DOMAIN)) {
      setEditErr(`El correo del estudiante debe ser ${DOMAIN}`)
      return
    }

    const name = composeName(firstName, editForm.second_name, firstLastname, editForm.second_lastname)

    setEditSaving(true)
    const { error } = await supabase.from('school_students').update({
      name,
      first_name:          firstName,
      second_name:         editForm.second_name.trim() || null,
      first_lastname:      firstLastname,
      second_lastname:     editForm.second_lastname.trim() || null,
      email:               email || `${firstName.toLowerCase()}.${firstLastname.toLowerCase()}${DOMAIN}`,
      representative_email: editForm.representative_email.trim() || null,
      grade,
      section,
    }).eq('id', editingStudent.id)

    if (error) {
      if (error.code === '23505') setEditErr('Este correo ya está registrado en el colegio.')
      else setEditErr('Error al guardar. ' + error.message)
    } else {
      showToast(`${name} actualizado`, 'success')
      setEditingStudent(null)
      loadStudents()
    }
    setEditSaving(false)
  }

  // ── Importar CSV ──────────────────────────────────────────────

  function handleParseCSV() {
    const { students: parsed, errors, warnings } = parseCSV(csvText)
    setCsvParsed(parsed)
    setCsvWarnings(warnings || [])
    setCsvErrors(errors)
    setCsvEditingIdx(null)
  }

  function updateCsvRow(idx, field, value) {
    setCsvParsed(prev => prev.map((row, i) => {
      if (i !== idx) return row
      const updated = { ...row, [field]: value }
      updated.name = composeName(updated.first_name, updated.second_name, updated.first_lastname, updated.second_lastname)
      return updated
    }))
  }

  function removeCsvRow(idx) {
    setCsvParsed(prev => prev.filter((_, i) => i !== idx))
    if (csvEditingIdx === idx) setCsvEditingIdx(null)
    else if (csvEditingIdx > idx) setCsvEditingIdx(csvEditingIdx - 1)
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
    setCsvText(''); setCsvParsed(null); setCsvErrors([]); setCsvWarnings([]); setShowImport(false); setCsvEditingIdx(null)
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

  // ── Filtrado y ordenamiento ───────────────────────────────────

  function handleSort(col) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(true) }
  }

  const filtered = students.filter(s => {
    if (filterGrade   && s.grade !== filterGrade) return false
    if (filterSection && s.section?.toLowerCase() !== filterSection.toLowerCase()) return false
    if (searchText    && !s.name.toLowerCase().includes(searchText.toLowerCase()) &&
        !displayName(s).toLowerCase().includes(searchText.toLowerCase()) &&
        !s.student_code?.toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  }).sort((a, b) => {
    let va, vb
    if (sortCol === 'name')    { va = displayName(a); vb = displayName(b) }
    else if (sortCol === 'grade')   { va = a.grade;   vb = b.grade }
    else if (sortCol === 'section') { va = a.section; vb = b.section }
    else if (sortCol === 'code')    { va = a.student_code || ''; vb = b.student_code || '' }
    else { va = ''; vb = '' }
    return sortAsc ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es')
  })

  const grades = [...new Set(students.map(s => s.grade))].sort()

  // ── Stats ─────────────────────────────────────────────────────

  const gradeStats = {}
  const sectionStats = {}
  students.forEach(s => {
    gradeStats[s.grade] = (gradeStats[s.grade] || 0) + 1
    sectionStats[s.section] = (sectionStats[s.section] || 0) + 1
  })
  const psyStats = { intervention: 0, monitoring: 0, no_intervention: 0 }
  Object.values(psyProfiles).forEach(p => {
    if (psyStats[p.status] !== undefined) psyStats[p.status]++
  })
  const hasPsyData = psyStats.intervention + psyStats.monitoring + psyStats.no_intervention > 0

  // ── Agrupación por grado ──────────────────────────────────────

  const showGroupHeaders = !filterGrade && !searchText
  const grouped = {}
  if (showGroupHeaders) {
    filtered.forEach(s => { (grouped[s.grade] ??= []).push(s) })
  }

  // ─────────────────────────────────────────────────────────────

  function handleRowClick(e, student) {
    if (e.target.closest('input, button')) return
    setExpandedId(prev => prev === student.id ? null : student.id)
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1F3864' }}>
          Roster de Estudiantes
        </h1>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>
          Registra los estudiantes del colegio para exámenes y seguimiento psicosocial.
        </p>
      </div>

      {/* ── Stats bar ── */}
      {students.length > 0 && (
        <div className="stu-stats">
          <span className="stu-stat" style={{ background: '#1F3864', color: '#fff', border: 'none' }}>
            <span className="stu-stat-count" style={{ color: '#fff' }}>{students.length}</span> estudiante{students.length !== 1 ? 's' : ''}
          </span>
          {grades.map(g => (
            <span key={g} className="stu-stat">
              {g} <span className="stu-stat-count">{gradeStats[g]}</span>
            </span>
          ))}
          {Object.keys(sectionStats).length > 1 && (
            <span className="stu-stat" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
              {Object.entries(sectionStats).sort((a,b) => a[0].localeCompare(b[0])).map(([sec, count], i) => (
                <span key={sec}>{i > 0 ? ' · ' : ''}{sec}: <span className="stu-stat-count">{count}</span></span>
              ))}
            </span>
          )}
          {hasPsyData && (
            <span className="stu-stat" style={{ background: '#FEF2F2', borderColor: '#FECACA', gap: 6 }}>
              {psyStats.intervention > 0 && <><span className="stu-stat-dot" style={{ background: '#ef4444' }} /><span className="stu-stat-count">{psyStats.intervention}</span></>}
              {psyStats.monitoring > 0 && <><span className="stu-stat-dot" style={{ background: '#f59e0b' }} /><span className="stu-stat-count">{psyStats.monitoring}</span></>}
              {psyStats.no_intervention > 0 && <><span className="stu-stat-dot" style={{ background: '#22c55e' }} /><span className="stu-stat-count">{psyStats.no_intervention}</span></>}
            </span>
          )}
        </div>
      )}

      {/* ── Agregar uno a uno ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
             onClick={() => setShowAddForm(v => !v)}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>+ Agregar estudiante</h3>
          <span style={{ fontSize: 14, color: '#9CA3AF', transition: 'transform .2s', transform: showAddForm ? 'rotate(180deg)' : 'rotate(0)' }}>&#9660;</span>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddOne} style={{ marginTop: 16 }}>
            {/* Fila 1 — nombres */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
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

            {/* Fila 2 — grado, sección, emails */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
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
        )}
      </div>

      {/* ── Importar CSV ── */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ ...sectionTitle, margin: 0 }}>Importar desde Excel / CSV</h3>
          <button style={{ ...btnSecondary, fontSize: 13 }} onClick={() => setShowImport(v => !v)}>
            {showImport ? 'Ocultar' : 'Importar lista'}
          </button>
        </div>

        {showImport && (
          <div style={{ marginTop: 16 }}>
            {/* Instrucciones formato */}
            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0C4A6E', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                Formato requerido — 8 columnas
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: 4, marginBottom: 8 }}>
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
                · Si dejas Email vacío se genera automáticamente como <em>primernombre.primerapellido@redboston.edu.co</em>
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
              onChange={e => { setCsvText(e.target.value); setCsvParsed(null); setCsvErrors([]); setCsvWarnings([]); setCsvEditingIdx(null) }}
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
                <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#dcfce7' }}>
                        <th style={{ ...th, fontSize: 10, width: 30 }}></th>
                        <th style={{ ...th, fontSize: 10 }}>Nombre completo</th>
                        <th style={{ ...th, fontSize: 10 }}>Grado</th>
                        <th style={{ ...th, fontSize: 10 }}>Sección</th>
                        <th style={{ ...th, fontSize: 10 }}>Email</th>
                        <th style={{ ...th, fontSize: 10 }}>Rep.</th>
                        <th style={{ ...th, fontSize: 10, width: 50 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvParsed.map((s, i) => csvEditingIdx === i ? (
                        <tr key={i} className="stu-csv-row-edit" style={{ borderBottom: '1px solid #bbf7d0', background: '#f0fdf4' }}>
                          <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 14 }}
                              onClick={() => removeCsvRow(i)} title="Eliminar fila">x</button>
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <div style={{ display: 'flex', gap: 3 }}>
                              <input value={s.first_lastname} onChange={e => updateCsvRow(i, 'first_lastname', e.target.value)} placeholder="Apellido" style={{ flex: 1 }} />
                              <input value={s.first_name} onChange={e => updateCsvRow(i, 'first_name', e.target.value)} placeholder="Nombre" style={{ flex: 1 }} />
                            </div>
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <select value={s.grade} onChange={e => updateCsvRow(i, 'grade', e.target.value)}>
                              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <select value={s.section} onChange={e => updateCsvRow(i, 'section', e.target.value)}>
                              {SECTIONS.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <input value={s.email} onChange={e => updateCsvRow(i, 'email', e.target.value)} placeholder="email" />
                          </td>
                          <td style={{ padding: '4px 4px' }}>
                            <input value={s.representative_email} onChange={e => updateCsvRow(i, 'representative_email', e.target.value)} placeholder="rep." />
                          </td>
                          <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                            <button type="button" style={{ background: '#166534', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11 }}
                              onClick={() => setCsvEditingIdx(null)}>OK</button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={i} style={{ borderBottom: '1px solid #bbf7d0' }}>
                          <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 13, lineHeight: 1 }}
                              onClick={() => removeCsvRow(i)} title="Eliminar fila">x</button>
                          </td>
                          <td style={{ padding: '4px 8px', color: '#166534', fontWeight: 600 }}>{displayName(s)}</td>
                          <td style={{ padding: '4px 8px', color: '#166534' }}>{s.grade}</td>
                          <td style={{ padding: '4px 8px', color: '#166534' }}>{s.section}</td>
                          <td style={{ padding: '4px 8px', color: '#166534', fontSize: 11 }}>{s.email}</td>
                          <td style={{ padding: '4px 8px', color: '#166534', fontSize: 11 }}>{s.representative_email || '—'}</td>
                          <td style={{ padding: '4px 4px', textAlign: 'center' }}>
                            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13 }}
                              onClick={() => setCsvEditingIdx(i)} title="Editar fila">&#9998;</button>
                          </td>
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
            Lista ({filtered.length}{filtered.length !== students.length ? ` / ${students.length}` : ''})
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
              <option value="">Todas</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 32 }}>Cargando...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 32 }}>
            {students.length === 0
              ? 'No hay estudiantes registrados. Agrega uno arriba o importa desde Excel.'
              : 'Ningún estudiante coincide con los filtros.'}
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
                  {[
                    { label: 'Nombre', col: 'name' },
                    { label: 'Grado',   col: 'grade' },
                    { label: 'Sección', col: 'section' },
                    { label: 'Código',  col: 'code' },
                  ].map(({ label, col }) => (
                    <th key={col} style={{ ...th, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      onClick={() => handleSort(col)}>
                      {label} {sortCol === col ? (sortAsc ? '▲' : '▼') : <span style={{ opacity: 0.3 }}>▲</span>}
                    </th>
                  ))}
                  <th style={{ ...th, width: 60 }}></th>
                </tr>
              </thead>
              <tbody>
                {showGroupHeaders
                  ? Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([grade, grpStudents]) => (
                    <GroupRows key={grade} grade={grade} students={grpStudents}
                      selectedIds={selectedIds} toggleSelect={toggleSelect}
                      expandedId={expandedId} handleRowClick={handleRowClick}
                      openEdit={openEdit} psyProfiles={psyProfiles}
                      confirmingDeleteId={confirmingDeleteId} setConfirmingDeleteId={setConfirmingDeleteId}
                      handleDelete={handleDelete} />
                  ))
                  : filtered.map(s => (
                    <StudentRows key={s.id} s={s}
                      selectedIds={selectedIds} toggleSelect={toggleSelect}
                      expandedId={expandedId} handleRowClick={handleRowClick}
                      openEdit={openEdit} psyProfiles={psyProfiles}
                      confirmingDeleteId={confirmingDeleteId} setConfirmingDeleteId={setConfirmingDeleteId}
                      handleDelete={handleDelete} />
                  ))
                }
              </tbody>
            </table>
          </div>
        )}

        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: '#991B1B', flex: 1 }}>
              {selectedIds.size} estudiante{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
            </span>
            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13 }}
              onClick={() => { setSelectedIds(new Set()); setBulkConfirm(false) }}>
              Cancelar
            </button>
            {bulkConfirm ? (
              <>
                <span style={{ fontSize: 13, color: '#DC2626', fontWeight: 600 }}>¿Confirmar eliminación?</span>
                <button type="button" style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  onClick={handleBulkDelete} disabled={saving}>
                  {saving ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </>
            ) : (
              <button type="button" style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                onClick={handleBulkDelete} disabled={saving}>
                Eliminar seleccionados
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

      {/* ── Edit Modal ── */}
      {editingStudent && (
        <div className="sb-modal-overlay" key={editingStudent.id}>
          <div className="sb-modal" style={{ maxWidth: 560, width: '95vw' }}>
            <div className="sb-modal-header" style={{ background: '#1F3864' }}>
              <h2>Editar estudiante</h2>
              <button type="button" onClick={() => setEditingStudent(null)}>&times;</button>
            </div>
            <div className="sb-modal-body">
              {/* Nombres */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Primer nombre *</label>
                  <input style={inp} value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Segundo nombre</label>
                  <input style={inp} value={editForm.second_name} onChange={e => setEditForm(f => ({ ...f, second_name: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Primer apellido *</label>
                  <input style={inp} value={editForm.first_lastname} onChange={e => setEditForm(f => ({ ...f, first_lastname: e.target.value }))} />
                </div>
                <div>
                  <label style={lbl}>Segundo apellido</label>
                  <input style={inp} value={editForm.second_lastname} onChange={e => setEditForm(f => ({ ...f, second_lastname: e.target.value }))} />
                </div>
              </div>
              {/* Grado + Sección */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={lbl}>Grado *</label>
                  <select style={inp} value={editForm.grade} onChange={e => setEditForm(f => ({ ...f, grade: e.target.value }))}>
                    <option value="">Grado</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Sección *</label>
                  <select style={inp} value={editForm.section} onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))}>
                    <option value="">Sección</option>
                    {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {/* Emails */}
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Email estudiante</label>
                <input style={inp} value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Email representante</label>
                <input style={inp} type="email" value={editForm.representative_email} onChange={e => setEditForm(f => ({ ...f, representative_email: e.target.value }))} />
              </div>
              {editErr && <p style={{ color: '#DC2626', fontSize: 13, margin: '0 0 8px' }}>{editErr}</p>}
            </div>
            <div className="sb-modal-footer">
              <button type="button" style={btnSecondary} onClick={() => setEditingStudent(null)}>Cancelar</button>
              <button type="button" style={btnPrimary} onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Subcomponentes de tabla ──────────────────────────────────

function GroupRows({ grade, students, ...rowProps }) {
  return (
    <>
      <tr className="stu-group-hdr">
        <td colSpan={6}>
          {grade} — {students.length} estudiante{students.length !== 1 ? 's' : ''}
        </td>
      </tr>
      {students.map(s => (
        <StudentRows key={s.id} s={s} {...rowProps} />
      ))}
    </>
  )
}

function StudentRows({ s, selectedIds, toggleSelect, expandedId, handleRowClick, openEdit, psyProfiles, confirmingDeleteId, setConfirmingDeleteId, handleDelete }) {
  return (
    <>
      <tr style={{ borderBottom: '1px solid #F3F4F6', background: selectedIds.has(s.id) ? '#FEF2F2' : undefined, cursor: 'pointer' }}
          onClick={e => handleRowClick(e, s)}>
        <td style={{ ...td, textAlign: 'center' }}>
          <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
        </td>
        <td style={td}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="stu-name-link" onClick={e => { e.stopPropagation(); openEdit(s) }}>
              {displayName(s)}
            </span>
            {psyProfiles[s.id] && (() => {
              const st = psyProfiles[s.id].status
              const dot = st === 'intervention' ? '#ef4444' : st === 'monitoring' ? '#f59e0b' : st === 'no_intervention' ? '#22c55e' : '#9ca3af'
              return <span title="Perfil psicosocial activo" className="stu-stat-dot" style={{ background: dot }} />
            })()}
          </div>
        </td>
        <td style={td}>{s.grade}</td>
        <td style={td}>{s.section}</td>
        <td style={{ ...td, fontFamily: 'monospace', color: '#1F3864', fontSize: 12 }}>
          {s.student_code}
        </td>
        <td style={td}>
          {confirmingDeleteId === s.id ? (
            <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button type="button" style={{ background: '#EF4444', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
                onClick={() => handleDelete(s.id, displayName(s))}>Confirmar</button>
              <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 12 }}
                onClick={() => setConfirmingDeleteId(null)}>Cancelar</button>
            </span>
          ) : (
            <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 16 }}
              onClick={() => handleDelete(s.id, displayName(s))} title="Eliminar">&#128465;</button>
          )}
        </td>
      </tr>
      {expandedId === s.id && (
        <tr className="stu-expand-row">
          <td colSpan={6}>
            <span style={{ marginRight: 20 }}>
              <strong style={{ color: '#374151', fontSize: 12 }}>Email:</strong>{' '}
              <span style={{ color: '#1F3864' }}>{s.email}</span>
            </span>
            {s.representative_email && (
              <span>
                <strong style={{ color: '#374151', fontSize: 12 }}>Representante:</strong>{' '}
                <span style={{ color: '#6B7280' }}>{s.representative_email}</span>
              </span>
            )}
            {!s.representative_email && (
              <span style={{ color: '#D1D5DB', fontSize: 12 }}>Sin email de representante</span>
            )}
          </td>
        </tr>
      )}
    </>
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
