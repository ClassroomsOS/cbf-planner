// ── PrinciplesPage.jsx ────────────────────────────────────────────────────────
// Gestión de los principios rectores institucionales:
//   1. Versículo del Año  (schools.year_verse — anual)
//   2. Versículo del Mes  (school_monthly_principles — mensual)
// NOTA: El Principio del Indicador se ingresa por proyecto en NewsProjectEditor
//       (step "Fechas") → fields biblical_principle + indicator_verse_ref

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { logError, logActivity } from '../utils/logger'

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

export default function PrinciplesPage({ teacher }) {
  const school      = teacher.schools || {}
  const { showToast } = useToast()

  const now       = new Date()
  const thisYear  = now.getFullYear()
  const thisMonth = now.getMonth() + 1 // 1-12

  // ── State ──
  const [yearVerse,    setYearVerse]    = useState(school.year_verse     || '')
  const [yearVerseRef, setYearVerseRef] = useState(school.year_verse_ref || '')
  const [savingYear,   setSavingYear]   = useState(false)

  const [monthly,      setMonthly]      = useState({}) // { "YYYY-MM": { month_verse, month_verse_ref, principle_name } }
  const [editing,      setEditing]      = useState(null) // "YYYY-MM"
  const [editForm,     setEditForm]     = useState({})
  const [savingMonth,  setSavingMonth]  = useState(false)
  const [docs,         setDocs]         = useState({})   // { "YYYY-MM": [doc, ...] }
  const [uploading,    setUploading]    = useState(false)
  const fileRef = useRef()

  // ── Load all monthly principles + documents for this year ──
  useEffect(() => {
    loadMonthly()
    loadDocs()
  }, [])

  async function loadMonthly() {
    const { data } = await supabase
      .from('school_monthly_principles')
      .select('*')
      .eq('school_id', teacher.school_id)
      .eq('year', thisYear)
    if (data) {
      const map = {}
      data.forEach(row => {
        map[`${row.year}-${String(row.month).padStart(2,'0')}`] = row
      })
      setMonthly(map)
    }
  }

  // ── Save year verse ──
  async function saveYearVerse() {
    const existing = school.year_verse?.trim()
    if (existing && !yearVerse.trim()) {
      showToast('El versículo del año ya está configurado y no puede borrarse.', 'warning')
      return
    }
    setSavingYear(true)
    const { error } = await supabase
      .from('schools')
      .update({ year_verse: yearVerse.trim(), year_verse_ref: yearVerseRef.trim() })
      .eq('id', teacher.school_id)
    setSavingYear(false)
    if (error) { showToast('Error al guardar el versículo del año', 'error'); logError(error, { page: 'PrinciplesPage', action: 'saveYearVerse' }) }
    else { showToast('Versículo del año guardado', 'success'); logActivity('update', 'schools', teacher.school_id, 'Guardó versículo del año') }
  }

  async function loadDocs() {
    const { data } = await supabase
      .from('principle_documents')
      .select('*')
      .eq('school_id', teacher.school_id)
      .eq('year', thisYear)
      .order('created_at')
    if (data) {
      const map = {}
      data.forEach(doc => {
        const key = `${doc.year}-${String(doc.month).padStart(2,'0')}`
        if (!map[key]) map[key] = []
        map[key].push(doc)
      })
      setDocs(map)
    }
  }

  // ── Open month editor ──
  function openMonth(year, month) {
    const key = `${year}-${String(month).padStart(2,'0')}`
    const row = monthly[key] || {}
    setEditing(key)
    setEditForm({
      principle_name:  row.principle_name  || '',
      month_verse:     row.month_verse     || '',
      month_verse_ref: row.month_verse_ref || '',
    })
  }

  // ── Save monthly principles ──
  async function saveMonth() {
    if (!editing) return
    const [y, m] = editing.split('-').map(Number)
    const existing = monthly[editing] || {}

    // Protect: don't allow clearing a verse that was already set
    if (existing.month_verse?.trim() && !editForm.month_verse.trim()) {
      showToast('El versículo del mes ya configurado no puede borrarse accidentalmente.', 'warning')
      return
    }

    setSavingMonth(true)
    const payload = {
      school_id:       teacher.school_id,
      year:            y,
      month:           m,
      principle_name:  editForm.principle_name.trim(),
      month_verse:     editForm.month_verse.trim(),
      month_verse_ref: editForm.month_verse_ref.trim(),
      updated_by:      teacher.id,
      updated_at:      new Date().toISOString(),
    }
    const { error } = await supabase
      .from('school_monthly_principles')
      .upsert(payload, { onConflict: 'school_id,year,month' })
    setSavingMonth(false)
    if (error) {
      showToast('Error al guardar', 'error')
      logError(error, { page: 'PrinciplesPage', action: 'saveMonthVerse' })
    } else {
      showToast(`Principios de ${MONTHS[m-1]} guardados`, 'success')
      logActivity('update', 'school_monthly_principles', null, `Guardó principio de ${MONTHS[m-1]} ${y}`)
      setMonthly(prev => ({ ...prev, [editing]: payload }))
      setEditing(null)
    }
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length || !editing) return
    setUploading(true)
    const [y, m] = editing.split('-').map(Number)
    const uploaded = []
    for (const file of files) {
      const path = `${teacher.school_id}/${y}/${m}/${Date.now()}_${file.name}`
      const { error: upErr } = await supabase.storage
        .from('principle-docs')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (upErr) { showToast(`Error subiendo ${file.name}`, 'error'); continue }
      const { data: docData, error: docErr } = await supabase
        .from('principle_documents')
        .insert({
          school_id: teacher.school_id, year: y, month: m,
          file_name: file.name, file_path: path,
          file_size: file.size, mime_type: file.type,
          uploaded_by: teacher.id,
        })
        .select().single()
      if (!docErr) uploaded.push(docData)
    }
    if (uploaded.length) {
      setDocs(prev => ({ ...prev, [editing]: [...(prev[editing] || []), ...uploaded] }))
      showToast(`${uploaded.length} documento(s) subido(s)`, 'success')
    }
    setUploading(false)
    fileRef.current.value = ''
  }

  async function handleDeleteDoc(key, doc) {
    await supabase.storage.from('principle-docs').remove([doc.file_path])
    await supabase.from('principle_documents').delete().eq('id', doc.id)
    setDocs(prev => ({ ...prev, [key]: (prev[key] || []).filter(d => d.id !== doc.id) }))
    showToast('Documento eliminado', 'success')
  }

  function monthKey(month) {
    return `${thisYear}-${String(month).padStart(2,'0')}`
  }

  function hasData(month) {
    const d = monthly[monthKey(month)]
    return d && !!d.month_verse
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#f4f6fb' }}>

      {/* ── Top bar ── */}
      <div className="ge-topbar">
        <div className="ge-topbar-info">
          <span className="ge-guide-title">📖 Principios Rectores</span>
          <span className="ge-guide-dates">{school.name || 'Mi Colegio'}</span>
        </div>
      </div>

      <div style={{ padding: '20px 28px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>

        {/* ── Intro ── */}
        <div style={{
          background: '#fffbf0', border: '1px solid #C9A84C', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: '#5a4000', lineHeight: 1.6,
        }}>
          Estos dos principios son el norte institucional de toda planificación y actividad.
          La IA los usará en cada guía y logro que genere.
          El <strong>Principio del Indicador</strong> se define por proyecto directamente en <em>NEWS → Fechas</em>.
        </div>

        {/* ── 1. Versículo del Año ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ color: '#C9A84C' }}>
            📖 Versículo del Año — {thisYear}
          </div>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            El versículo que rige todo el año escolar. Lo establece el Capellán de la institución.
          </p>
          <div className="ge-field">
            <label>Texto del versículo</label>
            <textarea
              value={yearVerse}
              onChange={e => setYearVerse(e.target.value)}
              rows={3}
              className="ge-input"
              placeholder='"Jehová es mi pastor; nada me faltará." — Salmos 23:1'
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="ge-field">
            <label>Referencia bíblica</label>
            <input
              type="text"
              value={yearVerseRef}
              onChange={e => setYearVerseRef(e.target.value)}
              className="ge-input"
              placeholder="Salmos 23:1 (RVR60)"
            />
          </div>
          <button
            className="btn-primary"
            onClick={saveYearVerse}
            disabled={savingYear}
            style={{ marginTop: '4px' }}
          >
            {savingYear ? '⏳ Guardando…' : '💾 Guardar versículo del año'}
          </button>
        </div>

        {/* ── 2 & 3. Principios Mensuales ── */}
        <div className="card">
          <div className="card-title" style={{ color: '#2E5598' }}>
            🗓 Versículo del Mes — {thisYear}
          </div>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
            Lo establece el Capellán cada mes. Selecciona un mes para editarlo.
          </p>

          {/* Month grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px',
            marginBottom: '20px',
          }}>
            {MONTHS.map((name, idx) => {
              const month   = idx + 1
              const isCurrent = month === thisMonth
              const done    = hasData(month)
              return (
                <button
                  key={month}
                  onClick={() => openMonth(thisYear, month)}
                  style={{
                    padding: '12px 10px', borderRadius: '8px', border: 'none',
                    background: editing === monthKey(month)
                      ? '#2E5598' : isCurrent ? '#e8eef8' : '#f5f7fa',
                    color: editing === monthKey(month) ? '#fff' : isCurrent ? '#2E5598' : '#444',
                    cursor: 'pointer', textAlign: 'left',
                    boxShadow: isCurrent ? '0 0 0 2px #2E5598' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>
                    {name}
                    {isCurrent && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: .7 }}>← actual</span>}
                  </div>
                  {done && monthly[monthKey(month)]?.principle_name && (
                    <div style={{ fontSize: '11px', fontStyle: 'italic', color: editing === monthKey(month) ? 'rgba(255,255,255,.8)' : '#2E5598', marginBottom: '2px' }}>
                      {monthly[monthKey(month)].principle_name}
                    </div>
                  )}
                  <div style={{ fontSize: '11px', opacity: .75 }}>
                    {done ? '✅ Configurado' : '— Sin configurar'}
                    {(docs[monthKey(month)]?.length || 0) > 0 && (
                      <span style={{ marginLeft: 6 }}>📎 {docs[monthKey(month)].length}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Edit panel */}
          {editing && (
            <div style={{
              background: '#f8faff', border: '1px solid #c5d5f0', borderRadius: '10px',
              padding: '16px 18px',
            }}>
              <div style={{ fontWeight: 700, color: '#2E5598', marginBottom: '14px', fontSize: '14px' }}>
                ✏️ {MONTHS[parseInt(editing.split('-')[1]) - 1]} {editing.split('-')[0]}
              </div>

              <div className="ge-field">
                <label>Nombre del principio</label>
                <input
                  type="text"
                  value={editForm.principle_name}
                  onChange={e => setEditForm(f => ({ ...f, principle_name: e.target.value }))}
                  className="ge-input"
                  placeholder="ej. Principio de Pureza"
                />
              </div>

              <div className="ge-field">
                <label>Versículo del Mes — texto</label>
                <textarea
                  value={editForm.month_verse}
                  onChange={e => setEditForm(f => ({ ...f, month_verse: e.target.value }))}
                  rows={3}
                  className="ge-input"
                  placeholder='"Y creó Dios al hombre a su imagen…" — Gén 1:27'
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="ge-field">
                <label>Referencia bíblica</label>
                <input
                  type="text"
                  value={editForm.month_verse_ref}
                  onChange={e => setEditForm(f => ({ ...f, month_verse_ref: e.target.value }))}
                  className="ge-input"
                  placeholder="Génesis 1:27-28a (TLA)"
                />
              </div>

              {/* ── Documents ── */}
              <div style={{ marginTop: '16px', borderTop: '1px solid #dde6f5', paddingTop: '14px' }}>
                <div style={{ fontWeight: 700, fontSize: '12px', color: '#555', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                  📎 Documentos adjuntos (Word / PDF)
                </div>

                {(docs[editing] || []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {(docs[editing] || []).map(doc => (
                      <div key={doc.id} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: '#f0f4fb', borderRadius: '8px', padding: '7px 10px',
                      }}>
                        <span style={{ fontSize: '16px' }}>
                          {doc.mime_type?.includes('pdf') ? '📄' : '📝'}
                        </span>
                        <a
                          href={supabase.storage.from('principle-docs').getPublicUrl(doc.file_path).data.publicUrl}
                          target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, fontSize: '12px', color: '#2E5598', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {doc.file_name}
                        </a>
                        {doc.file_size && (
                          <span style={{ fontSize: '11px', color: '#aaa', flexShrink: 0 }}>
                            {(doc.file_size / 1024).toFixed(0)} KB
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteDoc(editing, doc)}
                          style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: 'none', background: '#eee', fontSize: 14, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title="Eliminar"
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => fileRef.current.click()}
                  disabled={uploading}
                  style={{
                    fontSize: '12px', padding: '7px 14px',
                    border: '1px dashed #2E5598', borderRadius: '8px',
                    background: 'none', color: '#2E5598', cursor: 'pointer',
                    opacity: uploading ? .5 : 1,
                  }}
                >
                  {uploading ? '⏳ Subiendo…' : '+ Subir documento'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <p style={{ fontSize: '11px', color: '#aaa', marginTop: '4px' }}>
                  Acepta PDF y Word (.doc, .docx)
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                <button
                  className="btn-primary"
                  onClick={saveMonth}
                  disabled={savingMonth}
                >
                  {savingMonth ? '⏳ Guardando…' : '💾 Guardar principio'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
