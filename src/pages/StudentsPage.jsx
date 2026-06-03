// StudentsPage.jsx — Gestión del roster de estudiantes
// Ruta: /students
// UX: directorio por grado+sección → clic para ver estudiantes → agregar/importar

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import {
  composeName, displayName, normalizeGrade, normalizeEmail, parseCSV,
  VALID_SECTIONS as SECTIONS, VALID_GRADES as GRADES, DOMAIN,
} from '../utils/studentUtils'
import { logError, logActivity } from '../utils/logger'

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

  // Directory view: selected grade+section
  const [selGrade,      setSelGrade]      = useState(null)
  const [selSection,    setSelSection]    = useState(null)

  const [searchText,    setSearchText]    = useState('')

  // Add form
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [formErr, setFormErr] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  // Import CSV
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

  // Email roster view
  const [viewMode,       setViewMode]       = useState('roster')   // 'roster' | 'emails'
  const [editingEmailId, setEditingEmailId] = useState(null)
  const [emailForm,      setEmailForm]      = useState({ email: '', representative_email: '' })
  const [emailSaving,    setEmailSaving]    = useState(false)

  // Edit modal
  const [editingStudent, setEditingStudent] = useState(null)
  const [editForm,       setEditForm]       = useState(EMPTY_FORM)
  const [editErr,        setEditErr]        = useState('')
  const [editSaving,     setEditSaving]     = useState(false)

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
      .limit(500)
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
      logError(error, { page: 'StudentsPage', action: 'addStudent' })
      if (error.code === '23505') setFormErr('Este correo ya está registrado en el colegio.')
      else setFormErr('Error al agregar. ' + error.message)
    } else {
      logActivity('create', 'school_students', null, `Estudiante agregado: ${name} (${grade} ${section})`)
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
      logError(error, { page: 'StudentsPage', action: 'editStudent', entityId: editingStudent.id })
      if (error.code === '23505') setEditErr('Este correo ya está registrado en el colegio.')
      else setEditErr('Error al guardar. ' + error.message)
    } else {
      logActivity('update', 'school_students', editingStudent.id, `Estudiante actualizado: ${name}`)
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

    if (imported > 0) logActivity('create', 'school_students', null, `CSV importado: ${imported} estudiantes agregados, ${skipped} duplicados, ${failed} fallidos`)
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
    if (error) { logError(error, { page: 'StudentsPage', action: 'deleteStudent', entityId: id }); showToast('Error al eliminar', 'error') }
    else { logActivity('delete', 'school_students', id, `Estudiante eliminado: ${name}`); showToast(`${name} eliminado`, 'success'); loadStudents() }
  }

  async function handleBulkDelete() {
    if (!bulkConfirm) { setBulkConfirm(true); return }
    setBulkConfirm(false)
    setSaving(true)
    const ids = [...selectedIds]
    const { error } = await supabase.from('school_students').delete().in('id', ids)
    if (error) { logError(error, { page: 'StudentsPage', action: 'bulkDelete' }); showToast('Error al eliminar: ' + error.message, 'error') }
    else {
      logActivity('delete', 'school_students', null, `Eliminación masiva: ${ids.length} estudiantes`)
      showToast(`${ids.length} estudiante${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}`, 'success')
      setSelectedIds(new Set())
    }
    setSaving(false)
    loadStudents()
  }

  async function handleEmailSave(studentId) {
    setEmailSaving(true)
    let email = emailForm.email.trim().toLowerCase()
    if (email && !email.includes('@')) email = email + DOMAIN

    const { error } = await supabase.from('school_students').update({
      email:               email || null,
      representative_email: emailForm.representative_email.trim() || null,
    }).eq('id', studentId)

    if (error) {
      logError(error, { page: 'StudentsPage', action: 'saveEmail', entityId: studentId })
      if (error.code === '23505') showToast('Este correo ya está registrado.', 'error')
      else showToast('Error al guardar: ' + error.message, 'error')
    } else {
      logActivity('update', 'school_students', studentId, 'Correos actualizados inline')
      showToast('Correos guardados', 'success')
      setEditingEmailId(null)
      loadStudents()
    }
    setEmailSaving(false)
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
    if (selectedIds.size === groupStudents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(groupStudents.map(s => s.id)))
    }
    setBulkConfirm(false)
  }

  // ── Sorting ───────────────────────────────────────────────────

  function handleSort(col) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(true) }
  }

  // ── Computed ──────────────────────────────────────────────────

  // Build directory: unique grade+section groups with counts
  const directory = {}
  students.forEach(s => {
    const key = `${s.grade}|${s.section}`
    if (!directory[key]) directory[key] = { grade: s.grade, section: s.section, count: 0 }
    directory[key].count++
  })
  const groups = Object.values(directory).sort((a, b) =>
    a.grade.localeCompare(b.grade, 'es') || a.section.localeCompare(b.section, 'es')
  )

  // Group grades for directory cards
  const gradeGroups = {}
  groups.forEach(g => {
    if (!gradeGroups[g.grade]) gradeGroups[g.grade] = []
    gradeGroups[g.grade].push(g)
  })

  // Is a group selected?
  const hasSelection = selGrade !== null && selSection !== null

  // Students in selected group, filtered and sorted
  const groupStudents = hasSelection
    ? students
        .filter(s => s.grade === selGrade && s.section === selSection)
        .filter(s => !searchText ||
          displayName(s).toLowerCase().includes(searchText.toLowerCase()) ||
          s.student_code?.toLowerCase().includes(searchText.toLowerCase())
        )
        .sort((a, b) => {
          let va, vb
          if (sortCol === 'name')    { va = displayName(a); vb = displayName(b) }
          else if (sortCol === 'code')    { va = a.student_code || ''; vb = b.student_code || '' }
          else { va = ''; vb = '' }
          return sortAsc ? va.localeCompare(vb, 'es') : vb.localeCompare(va, 'es')
        })
    : []

  const totalInGroup = hasSelection
    ? students.filter(s => s.grade === selGrade && s.section === selSection).length
    : 0

  // Psy stats for selected group
  const psyStats = { intervention: 0, monitoring: 0, no_intervention: 0 }
  if (hasSelection) {
    groupStudents.forEach(s => {
      const p = psyProfiles[s.id]
      if (p && psyStats[p.status] !== undefined) psyStats[p.status]++
    })
  }
  const hasPsyData = psyStats.intervention + psyStats.monitoring + psyStats.no_intervention > 0

  function selectGroup(grade, section) {
    setSelGrade(grade)
    setSelSection(section)
    setSearchText('')
    setSelectedIds(new Set())
    setBulkConfirm(false)
    setExpandedId(null)
    setShowAddForm(false)
    setShowImport(false)
    setViewMode('roster')
    setEditingEmailId(null)
  }

  function goBack() {
    setSelGrade(null)
    setSelSection(null)
    setSelectedIds(new Set())
    setBulkConfirm(false)
    setExpandedId(null)
    setSearchText('')
    setViewMode('roster')
    setEditingEmailId(null)
  }

  function handleRowClick(e, student) {
    if (e.target.closest('input, button')) return
    setExpandedId(prev => prev === student.id ? null : student.id)
  }

  // ─────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#1F3864' }}>
          Roster de Estudiantes
        </h1>
        <p style={{ margin: 0, color: '#6B7280', fontSize: 14 }}>
          {students.length > 0
            ? `${students.length} estudiante${students.length !== 1 ? 's' : ''} registrado${students.length !== 1 ? 's' : ''} en ${groups.length} grupo${groups.length !== 1 ? 's' : ''}`
            : 'Registra los estudiantes del colegio para exámenes y seguimiento.'}
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* DIRECTORY VIEW — no group selected                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      {!hasSelection && (
        <>
          {/* Action buttons — always visible at top */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button style={showAddForm ? { ...btnPrimary, background: '#374151' } : btnPrimary}
              onClick={() => { setShowAddForm(v => !v); setShowImport(false) }}>
              {showAddForm ? 'Cerrar formulario' : '+ Agregar estudiante'}
            </button>
            <button style={showImport ? { ...btnSecondary, background: '#DBEAFE', borderColor: '#93C5FD' } : btnSecondary}
              onClick={() => { setShowImport(v => !v); setShowAddForm(false) }}>
              {showImport ? 'Cerrar importador' : 'Importar desde Excel'}
            </button>
          </div>

          {/* ── Add form (collapsed by default) ── */}
          {showAddForm && (
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <h3 style={{ ...sectionTitle, margin: 0 }}>Agregar estudiante</h3>
                <span className="stu-add-badge">Se agrega al listado existente</span>
              </div>

              <form onSubmit={handleAddOne}>
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
                  {saving ? 'Agregando...' : '+ Agregar al roster'}
                </button>
              </form>
            </div>
          )}

          {/* ── Import CSV (collapsed by default) ── */}
          {showImport && <ImportCSVPanel
            csvText={csvText} setCsvText={setCsvText}
            csvParsed={csvParsed} setCsvParsed={setCsvParsed}
            csvErrors={csvErrors} setCsvErrors={setCsvErrors}
            csvWarnings={csvWarnings} setCsvWarnings={setCsvWarnings}
            csvEditingIdx={csvEditingIdx} setCsvEditingIdx={setCsvEditingIdx}
            handleParseCSV={handleParseCSV}
            updateCsvRow={updateCsvRow} removeCsvRow={removeCsvRow}
            handleImportCSV={handleImportCSV} saving={saving}
          />}

          {/* ── Directory cards ── */}
          {loading ? (
            <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 32 }}>Cargando...</p>
          ) : students.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>&#128218;</div>
              <p style={{ color: '#6B7280', fontSize: 15, margin: '0 0 8px' }}>
                No hay estudiantes registrados
              </p>
              <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>
                Usa los botones de arriba para agregar uno a uno o importar desde Excel.
              </p>
            </div>
          ) : (
            <div className="stu-directory">
              {Object.entries(gradeGroups).sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([grade, secs]) => (
                <div key={grade} className="stu-grade-block">
                  <div className="stu-grade-label">{grade}</div>
                  <div className="stu-section-cards">
                    {secs.map(g => (
                      <button key={g.section} className="stu-section-card"
                        onClick={() => selectGroup(g.grade, g.section)}>
                        <span className="stu-section-name">{g.section}</span>
                        <span className="stu-section-count">{g.count}</span>
                        <span className="stu-section-label">estudiante{g.count !== 1 ? 's' : ''}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info de acceso */}
          {students.length > 0 && (
            <div style={{ ...card, background: '#EFF6FF', border: '1px solid #BFDBFE', marginTop: 8 }}>
              <h3 style={{ ...sectionTitle, color: '#1E3A8A', fontSize: 13 }}>¿Cómo acceden los estudiantes a los exámenes?</h3>
              <ol style={{ color: '#1E3A8A', fontSize: 13, lineHeight: 2, margin: 0, paddingLeft: 20 }}>
                <li>El docente activa el examen y comparte el <strong>Código de examen</strong></li>
                <li>El estudiante abre <strong>classroomsos.github.io/cbf-planner/eval</strong></li>
                <li>Ingresa su correo <strong>@redboston.edu.co</strong> y el código del examen</li>
                <li>El sistema lo autentica automáticamente y carga su versión personal</li>
              </ol>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* GROUP VIEW — grade+section selected                      */}
      {/* ══════════════════════════════════════════════════════════ */}
      {hasSelection && (
        <>
          {/* Back + group header */}
          <div className="stu-group-header">
            <button className="stu-back-btn" onClick={goBack} type="button">
              &#8592; Volver al directorio
            </button>
            <div className="stu-group-title">
              <span className="stu-group-grade">{selGrade}</span>
              <span className="stu-group-section">{selSection}</span>
              <span className="stu-group-count">{totalInGroup} estudiante{totalInGroup !== 1 ? 's' : ''}</span>
              {hasPsyData && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                  {psyStats.intervention > 0 && <><span className="stu-stat-dot" style={{ background: '#ef4444' }} /><span style={{ fontSize: 12, color: '#991b1b' }}>{psyStats.intervention}</span></>}
                  {psyStats.monitoring > 0 && <><span className="stu-stat-dot" style={{ background: '#f59e0b' }} /><span style={{ fontSize: 12, color: '#92400e' }}>{psyStats.monitoring}</span></>}
                </span>
              )}
            </div>
          </div>

          {/* Toolbar: search + view toggle + add/import */}
          <div className="stu-group-toolbar">
            <input
              className="stu-search-input"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Buscar por nombre o código..."
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {/* View toggle */}
              <div style={{ display: 'flex', border: '1px solid #D1D5DB', borderRadius: 8, overflow: 'hidden' }}>
                <button type="button"
                  style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: viewMode === 'roster' ? '#1F3864' : '#F3F4F6',
                    color: viewMode === 'roster' ? '#fff' : '#374151' }}
                  onClick={() => { setViewMode('roster'); setEditingEmailId(null) }}>
                  Roster
                </button>
                <button type="button"
                  style={{ padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: viewMode === 'emails' ? '#1F3864' : '#F3F4F6',
                    color: viewMode === 'emails' ? '#fff' : '#374151' }}
                  onClick={() => { setViewMode('emails'); setExpandedId(null) }}>
                  ✉️ Correos
                </button>
              </div>
              <button style={{ ...btnSecondary, fontSize: 13, padding: '6px 12px' }}
                onClick={() => { setShowAddForm(v => !v); setShowImport(false); setForm(f => ({ ...f, grade: selGrade, section: selSection })) }}>
                {showAddForm ? 'Cerrar' : '+ Agregar'}
              </button>
              <button style={{ ...btnSecondary, fontSize: 13, padding: '6px 12px' }}
                onClick={() => { setShowImport(v => !v); setShowAddForm(false) }}>
                {showImport ? 'Cerrar' : 'Importar'}
              </button>
            </div>
          </div>

          {/* Add form inline */}
          {showAddForm && (
            <div style={{ ...card, borderLeft: '4px solid #22c55e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <h3 style={{ ...sectionTitle, margin: 0, fontSize: 14 }}>Agregar a {selGrade} {selSection}</h3>
                <span className="stu-add-badge">Se agrega al listado existente</span>
              </div>
              <form onSubmit={handleAddOne}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Primer nombre *</label>
                    <input style={inp} value={form.first_name} onChange={e => setF('first_name', e.target.value)} placeholder="María" />
                  </div>
                  <div>
                    <label style={lbl}>Segundo nombre</label>
                    <input style={inp} value={form.second_name} onChange={e => setF('second_name', e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Primer apellido *</label>
                    <input style={inp} value={form.first_lastname} onChange={e => setF('first_lastname', e.target.value)} placeholder="García" />
                  </div>
                  <div>
                    <label style={lbl}>Segundo apellido</label>
                    <input style={inp} value={form.second_lastname} onChange={e => setF('second_lastname', e.target.value)} />
                  </div>
                </div>
                {/* Grade+section hidden — auto from selection */}
                <input type="hidden" value={form.grade} />
                <input type="hidden" value={form.section} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={lbl}>Email estudiante</label>
                    <input style={inp} value={form.email} onChange={e => setF('email', e.target.value)} placeholder="mariagarcia" />
                  </div>
                  <div>
                    <label style={lbl}>Email representante</label>
                    <input style={inp} type="email" value={form.representative_email}
                      onChange={e => setF('representative_email', e.target.value)} placeholder="padre@gmail.com" />
                  </div>
                </div>
                {formErr && <p style={{ color: '#DC2626', fontSize: 13, margin: '0 0 10px' }}>{formErr}</p>}
                <button type="submit" style={btnPrimary} disabled={saving}>
                  {saving ? 'Agregando...' : `+ Agregar a ${selGrade} ${selSection}`}
                </button>
              </form>
            </div>
          )}

          {/* Import inline */}
          {showImport && <ImportCSVPanel
            csvText={csvText} setCsvText={setCsvText}
            csvParsed={csvParsed} setCsvParsed={setCsvParsed}
            csvErrors={csvErrors} setCsvErrors={setCsvErrors}
            csvWarnings={csvWarnings} setCsvWarnings={setCsvWarnings}
            csvEditingIdx={csvEditingIdx} setCsvEditingIdx={setCsvEditingIdx}
            handleParseCSV={handleParseCSV}
            updateCsvRow={updateCsvRow} removeCsvRow={removeCsvRow}
            handleImportCSV={handleImportCSV} saving={saving}
          />}

          {/* ── ROSTER VIEW ─────────────────────────────────── */}
          {viewMode === 'roster' && (
            <div style={card}>
              {groupStudents.length === 0 ? (
                <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
                  {searchText ? 'Ningún estudiante coincide con la búsqueda.' : 'No hay estudiantes en este grupo.'}
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ background: '#F9FAFB' }}>
                        <th style={{ ...th, width: 36, textAlign: 'center' }}>
                          <input type="checkbox" title="Seleccionar todos"
                            checked={groupStudents.length > 0 && selectedIds.size === groupStudents.length}
                            onChange={toggleSelectAll} />
                        </th>
                        <th style={{ ...th, width: 36, textAlign: 'center' }}>#</th>
                        {[
                          { label: 'Nombre', col: 'name' },
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
                      {groupStudents.map((s, idx) => (
                        <StudentRows key={s.id} s={s} idx={idx + 1}
                          selectedIds={selectedIds} toggleSelect={toggleSelect}
                          expandedId={expandedId} handleRowClick={handleRowClick}
                          openEdit={openEdit} psyProfiles={psyProfiles}
                          confirmingDeleteId={confirmingDeleteId} setConfirmingDeleteId={setConfirmingDeleteId}
                          handleDelete={handleDelete} />
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
          )}

          {/* ── EMAIL VIEW ──────────────────────────────────── */}
          {viewMode === 'emails' && (() => {
            const missingStudent = groupStudents.filter(s => !s.email).length
            const missingRep     = groupStudents.filter(s => !s.representative_email).length
            return (
              <div style={card}>
                {/* Summary banner */}
                {(missingStudent > 0 || missingRep > 0) && (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                    {missingStudent > 0 && (
                      <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#9A3412' }}>
                        ⚠ <strong>{missingStudent}</strong> estudiante{missingStudent !== 1 ? 's' : ''} sin correo institucional
                      </div>
                    )}
                    {missingRep > 0 && (
                      <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: '#92400E' }}>
                        ⚠ <strong>{missingRep}</strong> estudiante{missingRep !== 1 ? 's' : ''} sin correo de representante
                      </div>
                    )}
                  </div>
                )}

                {groupStudents.length === 0 ? (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
                    {searchText ? 'Ningún estudiante coincide con la búsqueda.' : 'No hay estudiantes en este grupo.'}
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                          <th style={{ ...th, width: 36, textAlign: 'center' }}>#</th>
                          <th style={th}>Nombre</th>
                          <th style={th}>Correo estudiante</th>
                          <th style={th}>Correo representante</th>
                          <th style={{ ...th, width: 50 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupStudents.map((s, idx) => {
                          const isEditing = editingEmailId === s.id
                          return (
                            <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6', background: isEditing ? '#F0F9FF' : undefined }}>
                              <td style={{ ...td, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>{idx + 1}</td>
                              <td style={{ ...td, fontWeight: 600, color: '#1F3864' }}>{displayName(s)}</td>

                              {isEditing ? (
                                <>
                                  <td style={td}>
                                    <input
                                      style={{ ...inp, fontSize: 13, padding: '5px 8px' }}
                                      value={emailForm.email}
                                      onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))}
                                      placeholder={`usuario${DOMAIN}`}
                                      autoFocus
                                    />
                                  </td>
                                  <td style={td}>
                                    <input
                                      style={{ ...inp, fontSize: 13, padding: '5px 8px' }}
                                      type="email"
                                      value={emailForm.representative_email}
                                      onChange={e => setEmailForm(f => ({ ...f, representative_email: e.target.value }))}
                                      placeholder="padre@gmail.com"
                                    />
                                  </td>
                                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button type="button" disabled={emailSaving}
                                        style={{ background: '#1F3864', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                                        onClick={() => handleEmailSave(s.id)}>
                                        {emailSaving ? '…' : '✓'}
                                      </button>
                                      <button type="button"
                                        style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#6B7280' }}
                                        onClick={() => setEditingEmailId(null)}>
                                        ✕
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td style={td}>
                                    {s.email
                                      ? <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{s.email}</span>
                                      : <span style={{ color: '#F97316', fontSize: 13, fontWeight: 600 }}>⚠ Sin correo</span>
                                    }
                                  </td>
                                  <td style={td}>
                                    {s.representative_email
                                      ? <span style={{ fontSize: 13, color: '#6B7280' }}>{s.representative_email}</span>
                                      : <span style={{ color: '#D97706', fontSize: 12 }}>⚠ Sin correo</span>
                                    }
                                  </td>
                                  <td style={td}>
                                    <button type="button" title="Editar correos"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 16, padding: '2px 4px' }}
                                      onClick={() => {
                                        setEditingEmailId(s.id)
                                        setEmailForm({ email: s.email || '', representative_email: s.representative_email || '' })
                                      }}>
                                      ✏️
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })()}
        </>
      )}

      {/* ── Edit Modal ── */}
      {editingStudent && (
        <div className="sb-modal-overlay" key={editingStudent.id}>
          <div className="sb-modal" style={{ maxWidth: 560, width: '95vw' }}>
            <div className="sb-modal-header" style={{ background: '#1F3864' }}>
              <h2>Editar estudiante</h2>
              <button type="button" onClick={() => setEditingStudent(null)}>&times;</button>
            </div>
            <div className="sb-modal-body">
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

// ── Import CSV Panel ──────────────────────────────────────────

function ImportCSVPanel({
  csvText, setCsvText, csvParsed, setCsvParsed,
  csvErrors, setCsvErrors, csvWarnings, setCsvWarnings,
  csvEditingIdx, setCsvEditingIdx,
  handleParseCSV, updateCsvRow, removeCsvRow,
  handleImportCSV, saving,
}) {
  return (
    <div style={{ ...card, borderLeft: '4px solid #3B82F6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h3 style={{ ...sectionTitle, margin: 0, fontSize: 14 }}>Importar desde Excel / CSV</h3>
        <span className="stu-add-badge">Se agregan al listado — no reemplaza los existentes</span>
      </div>

      {/* Format instructions */}
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
          · Si dejas Email vacío se genera automáticamente
        </div>
      </div>

      {/* Example */}
      <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontFamily: 'monospace', fontSize: 12, color: '#374151', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        García	López	María	Alejandra	8	Blue	mariagarcia	padre@gmail.com<br />
        Rodríguez		Pedro		9	Red	pedrorodriguez	madre@hotmail.com
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
          <strong style={{ color: '#166534', fontSize: 13 }}>Vista previa — {csvParsed.length} estudiante{csvParsed.length !== 1 ? 's' : ''} nuevos a agregar</strong>
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
            {saving ? 'Importando...' : `Agregar ${csvParsed.length} estudiante${csvParsed.length !== 1 ? 's' : ''} al roster`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Student row ──────────────────────────────────────────────

function StudentRows({ s, idx, selectedIds, toggleSelect, expandedId, handleRowClick, openEdit, psyProfiles, confirmingDeleteId, setConfirmingDeleteId, handleDelete }) {
  return (
    <>
      <tr style={{ borderBottom: '1px solid #F3F4F6', background: selectedIds.has(s.id) ? '#FEF2F2' : undefined, cursor: 'pointer' }}
          onClick={e => handleRowClick(e, s)}>
        <td style={{ ...td, textAlign: 'center' }}>
          <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} />
        </td>
        <td style={{ ...td, textAlign: 'center', color: '#9CA3AF', fontSize: 12 }}>{idx}</td>
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
          <td colSpan={5}>
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
