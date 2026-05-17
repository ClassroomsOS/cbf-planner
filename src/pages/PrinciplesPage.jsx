// ── PrinciplesPage.jsx ────────────────────────────────────────────────────────
// Gestión de los principios rectores institucionales:
//   1. Versículo del Año  (schools.year_verse — anual)
//   2. Versículo del Mes  (school_monthly_principles — mensual)
// NOTA: El Principio del Indicador se ingresa por proyecto en NewsProjectEditor
//       (step "Fechas") → fields biblical_principle + indicator_verse_ref

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { logError, logActivity } from '../utils/logger'
import { Spinner, ProgressBar } from '../components/Spinner'

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function getPublicUrl(path) {
  return supabase.storage.from('principle-docs').getPublicUrl(path).data.publicUrl
}

function fileIcon(mimeType = '') {
  if (mimeType.includes('pdf')) return '📄'
  return '📝'
}

function isPdf(mimeType = '') {
  return mimeType.includes('pdf')
}

// ── Document viewer modal ────────────────────────────────────────────────────

function DocViewerModal({ doc, onClose }) {
  const publicUrl = getPublicUrl(doc.file_path)
  const pdf = isPdf(doc.mime_type)

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: '14px', width: '100%',
          maxWidth: '860px', maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 18px', borderBottom: '1px solid #e5e7eb',
          background: '#f8faff',
        }}>
          <span style={{ fontSize: '20px' }}>{fileIcon(doc.mime_type)}</span>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '14px', color: '#1F3864', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.file_name}
          </span>
          {doc.file_size && (
            <span style={{ fontSize: '12px', color: '#aaa', flexShrink: 0 }}>
              {(doc.file_size / 1024).toFixed(0)} KB
            </span>
          )}
          <a
            href={publicUrl}
            download={doc.file_name}
            style={{
              flexShrink: 0, padding: '6px 14px', borderRadius: '8px',
              background: '#2E5598', color: '#fff', textDecoration: 'none',
              fontSize: '12px', fontWeight: 700,
            }}
            onClick={e => e.stopPropagation()}
          >
            ⬇ Descargar
          </a>
          <button
            onClick={onClose}
            style={{
              flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
              border: 'none', background: '#eee', fontSize: '18px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#555',
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {pdf ? (
            <iframe
              src={publicUrl}
              title={doc.file_name}
              style={{ width: '100%', height: '100%', border: 'none', minHeight: '60vh' }}
            />
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '48px 24px', gap: '16px',
              color: '#555',
            }}>
              <span style={{ fontSize: '52px' }}>📝</span>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#333', textAlign: 'center' }}>
                {doc.file_name}
              </p>
              <p style={{ fontSize: '13px', color: '#888', textAlign: 'center' }}>
                Los archivos Word no pueden previsualizarse en el navegador.<br />
                Usa el botón de descarga para abrirlo en tu computador.
              </p>
              <a
                href={publicUrl}
                download={doc.file_name}
                style={{
                  padding: '10px 24px', borderRadius: '10px',
                  background: '#2E5598', color: '#fff', textDecoration: 'none',
                  fontSize: '14px', fontWeight: 700,
                }}
              >
                ⬇ Descargar archivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PrinciplesPage({ teacher }) {
  const school      = teacher.schools || {}
  const { showToast } = useToast()

  const now       = new Date()
  const thisYear  = now.getFullYear()
  const thisMonth = now.getMonth() + 1

  // ── State ──
  const [yearVerse,    setYearVerse]    = useState(school.year_verse     || '')
  const [yearVerseRef, setYearVerseRef] = useState(school.year_verse_ref || '')
  const [savingYear,   setSavingYear]   = useState(false)

  const [monthly,      setMonthly]      = useState({})
  const [editing,      setEditing]      = useState(null)
  const [editForm,     setEditForm]     = useState({})
  const [savingMonth,  setSavingMonth]  = useState(false)
  const [docs,         setDocs]         = useState({})
  const [uploading,    setUploading]    = useState(false)
  const [fileProgresses, setFileProgresses] = useState({})
  const [viewingDoc,   setViewingDoc]   = useState(null)
  const fileRef = useRef()

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

  async function saveMonth() {
    if (!editing) return
    const [y, m] = editing.split('-').map(Number)
    const existing = monthly[editing] || {}

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
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { showToast('No hay sesión activa.', 'error'); setUploading(false); return }

    const uploaded = []
    for (const file of files) {
      const path = `${teacher.school_id}/${y}/${m}/${Date.now()}_${file.name}`
      const url = `https://vouxrqsiyoyllxgcriic.supabase.co/storage/v1/object/principle-docs/${path}`

      const result = await new Promise((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((ev.loaded / ev.total) * 100)
            setFileProgresses(prev => ({ ...prev, [file.name]: pct }))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true })
          else { console.error('Upload failed:', xhr.status, xhr.responseText); resolve({ ok: false, error: xhr.responseText }) }
        }
        xhr.onerror = () => resolve({ ok: false, error: 'Error de red' })
        xhr.open('POST', url)
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.setRequestHeader('cache-control', 'max-age=3600')
        xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
        xhr.setRequestHeader('x-upsert', 'false')
        xhr.send(file)
      })

      if (!result.ok) {
        showToast(`Error subiendo ${file.name}`, 'error')
        setFileProgresses(prev => { const n = {...prev}; delete n[file.name]; return n })
        continue
      }

      const { data: docData, error: docErr } = await supabase
        .from('principle_documents')
        .insert({
          school_id: teacher.school_id, year: y, month: m,
          file_name: file.name, file_path: path,
          file_size: file.size, mime_type: file.type,
          uploaded_by: teacher.id,
        })
        .select().single()

      setFileProgresses(prev => { const n = {...prev}; delete n[file.name]; return n })
      if (docErr) {
        console.error('Error registrando documento:', docErr)
        showToast(`Error al registrar ${file.name}`, 'error')
      } else {
        uploaded.push(docData)
      }
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
            className={`btn-primary${savingYear ? ' cbf-loading' : ''}`}
            onClick={saveYearVerse}
            disabled={savingYear}
            style={{ marginTop: '4px' }}
          >
            {savingYear ? <><Spinner /> Guardando…</> : '💾 Guardar versículo del año'}
          </button>
        </div>

        {/* ── 2. Principios Mensuales ── */}
        <div className="card">
          <div className="card-title" style={{ color: '#2E5598' }}>
            🗓 Versículo del Mes — {thisYear}
          </div>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
            Lo establece el Capellán cada mes. Selecciona un mes para editar su versículo y documentos.
          </p>

          {/* Month grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px',
            marginBottom: '20px',
          }}>
            {MONTHS.map((name, idx) => {
              const month     = idx + 1
              const key       = monthKey(month)
              const isCurrent = month === thisMonth
              const done      = hasData(month)
              const monthDocs = docs[key] || []
              const isEditing = editing === key

              return (
                <div
                  key={month}
                  style={{
                    borderRadius: '10px', border: isEditing ? '2px solid #2E5598' : '1px solid #e5e7eb',
                    background: isEditing ? '#eef3fb' : isCurrent ? '#f0f6ff' : '#fafafa',
                    overflow: 'hidden',
                  }}
                >
                  {/* Month header — clickable to open editor */}
                  <button
                    onClick={() => openMonth(thisYear, month)}
                    style={{
                      width: '100%', padding: '11px 12px', border: 'none',
                      background: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px', color: isEditing ? '#2E5598' : isCurrent ? '#2E5598' : '#333', marginBottom: '2px' }}>
                      {name}
                      {isCurrent && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: .7, color: '#2E5598' }}>← actual</span>}
                    </div>
                    {done && monthly[key]?.principle_name && (
                      <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#2E5598', marginBottom: '2px' }}>
                        {monthly[key].principle_name}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: done ? '#16a34a' : '#aaa' }}>
                      {done ? '✅ Configurado' : '— Sin configurar'}
                    </div>
                  </button>

                  {/* Document chips — always visible */}
                  {monthDocs.length > 0 && (
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: '4px',
                      padding: '0 10px 10px',
                    }}>
                      {monthDocs.map(doc => (
                        <button
                          key={doc.id}
                          onClick={() => setViewingDoc(doc)}
                          title={doc.file_name}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '3px 8px', borderRadius: '20px',
                            border: '1px solid #c5d5f0', background: '#fff',
                            cursor: 'pointer', fontSize: '11px', color: '#2E5598',
                            fontWeight: 600, maxWidth: '100%',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                        >
                          <span>{fileIcon(doc.mime_type)}</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                            {doc.file_name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                        <span style={{ fontSize: '16px' }}>{fileIcon(doc.mime_type)}</span>
                        {/* Open modal instead of new tab */}
                        <button
                          onClick={() => setViewingDoc(doc)}
                          style={{
                            flex: 1, textAlign: 'left', background: 'none', border: 'none',
                            fontSize: '12px', color: '#2E5598', cursor: 'pointer',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            fontWeight: 600,
                          }}
                        >
                          {doc.file_name}
                        </button>
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

                {Object.entries(fileProgresses).map(([name, pct]) => (
                  <div key={name} className="cbf-upload-file-row" style={{ marginBottom: '6px' }}>
                    <div className="cbf-upload-file-name">
                      <Spinner size={12} /> {name}
                    </div>
                    <ProgressBar pct={pct} color="#2E5598" />
                  </div>
                ))}

                <button
                  className={`prin-upload-btn${uploading ? ' cbf-loading' : ''}`}
                  onClick={() => fileRef.current.click()}
                  disabled={uploading}
                  style={{
                    fontSize: '12px', padding: '7px 14px',
                    border: '1px dashed #2E5598', borderRadius: '8px',
                    background: 'none', color: '#2E5598', cursor: 'pointer',
                    opacity: uploading ? .5 : 1,
                  }}
                >
                  {uploading ? <><Spinner size={12} /> Subiendo…</> : '+ Subir documento'}
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
                  className={`btn-primary${savingMonth ? ' cbf-loading' : ''}`}
                  onClick={saveMonth}
                  disabled={savingMonth}
                >
                  {savingMonth ? <><Spinner /> Guardando…</> : '💾 Guardar principio'}
                </button>
                <button className="btn-secondary" onClick={() => setEditing(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Document viewer modal ── */}
      {viewingDoc && (
        <DocViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}

    </div>
  )
}
