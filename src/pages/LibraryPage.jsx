import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useFeatures } from '../context/FeaturesContext'
import { canManage } from '../utils/roles'
import { analyzeTextbookFragment, analyzeTextbookPages } from '../utils/AIAssistant'
import { logError, logActivity } from '../utils/logger'

// =============================================================================
// CONSTANTS
// =============================================================================

const DOC_TYPES = {
  textbook: { label: 'Libro de texto',  icon: '📖', color: '#2E5598' },
  research: { label: 'Investigación',   icon: '🔬', color: '#8064A2' },
  thesis:   { label: 'Tesis',           icon: '📋', color: '#C0504D' },
  project:  { label: 'Proyecto',        icon: '🏆', color: '#F79646' },
  article:  { label: 'Artículo',        icon: '📄', color: '#4BACC6' },
  audio:    { label: 'Audio',           icon: '🎵', color: '#1A6B3A' },
  video:    { label: 'Video',           icon: '🎬', color: '#991B1B' },
  guide:    { label: 'Guía didáctica',  icon: '📝', color: '#C9A84C' },
  other:    { label: 'Otro',            icon: '📁', color: '#718096' },
}

const SUBJECTS_LIST = [
  'Language Arts', 'Social Studies', 'Science', 'Lingua Skill',
  'Español', 'Matemáticas', 'Cosmovisión Bíblica', 'Física',
  'Química', 'Historia', 'Geografía', 'Educación Física', 'Música', 'Arte',
]

const GRADES_LIST = ['7.°', '8.°', '9.°', '10.°', '11.°']

const ACCEPT = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/webp', 'image/tiff', 'image/gif', 'image/bmp',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska',
  'audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac', 'audio/aac',
  'audio/midi', 'audio/x-midi',
].join(',')

const MAX_FILE_MB = { pdf: 500, image: 100, video: 1000, audio: 200, midi: 10, other: 100 }

const ACTION_BADGE = {
  created:       { label: 'Creado',        color: '#1A6B3A' },
  updated:       { label: 'Editado',       color: '#2E5598' },
  restored:      { label: 'Restaurado',    color: '#8064A2' },
  shared:        { label: 'Compartido',    color: '#F79646' },
  file_replaced: { label: 'Archivo nuevo', color: '#4BACC6' },
}

// =============================================================================
// HELPERS
// =============================================================================

function getMimeCategory(mime) {
  if (!mime) return 'other'
  if (mime === 'application/pdf') return 'pdf'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'audio/midi' || mime === 'audio/x-midi') return 'midi'
  if (mime.startsWith('audio/')) return 'audio'
  return 'other'
}

function getMimeLabel(cat, mime) {
  if (cat === 'pdf')   return 'PDF'
  if (cat === 'image') return (mime?.split('/')[1] || 'Imagen').toUpperCase()
  if (cat === 'video') return 'Video'
  if (cat === 'midi')  return 'MIDI'
  if (cat === 'audio') return 'Audio'
  return 'Archivo'
}

function guessDocType(mime) {
  const cat = getMimeCategory(mime)
  if (cat === 'video') return 'video'
  if (cat === 'audio' || cat === 'midi') return 'audio'
  return 'other'
}

function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function sanitizeTitle(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fmtDate(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// =============================================================================
// QUOTA METER
// =============================================================================

function QuotaMeter({ usedBytes, quotaGB }) {
  const totalBytes = quotaGB * 1024 * 1024 * 1024
  const pct = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0
  const color = pct > 90 ? '#C0504D' : pct > 70 ? '#F59E0B' : '#1A6B3A'

  return (
    <div className="lib-quota">
      <div className="lib-quota-row">
        <span className="lib-quota-label">💾 Almacenamiento personal</span>
        <span className="lib-quota-used" style={{ color }}>
          {fmtBytes(usedBytes)} <span className="lib-quota-sep">/</span> {quotaGB} GB
        </span>
      </div>
      <div className="lib-quota-track">
        <div className="lib-quota-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {pct > 90 && (
        <p className="lib-quota-warn">⚠️ Espacio casi lleno — contacta al Coordinador para ampliar tu cuota.</p>
      )}
    </div>
  )
}

// =============================================================================
// DOCUMENT CARD
// =============================================================================

function DocumentCard({ doc, onView, onDelete, onEdit, onShare, onHistory,
                        canDelete, canEditDoc, canShare, ownerName }) {
  const type = DOC_TYPES[doc.doc_type] || DOC_TYPES.other
  const cat  = getMimeCategory(doc.file_mime)

  const subtitle = [doc.subjects?.join(', '), doc.grades?.join(', ')]
    .filter(Boolean).join(' · ')

  const meta2 = [
    doc.metadata?.author,
    doc.metadata?.year,
    doc.page_count ? `${doc.page_count} págs.` : null,
    doc.file_size ? fmtBytes(doc.file_size) : null,
  ].filter(Boolean).join(' · ')

  const hasActions = canEditDoc || canShare || onHistory

  return (
    <div className="lib-card" onClick={() => onView(doc)}>
      {canDelete && (
        <button className="lib-card-del"
          title="Eliminar documento"
          onClick={e => { e.stopPropagation(); onDelete(doc) }}>
          ✕
        </button>
      )}

      {ownerName && (
        <div className="lib-card-owner-badge">👤 {ownerName}</div>
      )}

      <div className="lib-card-icon-wrap" style={{ background: type.color + '15' }}>
        <span className="lib-card-emoji">{type.icon}</span>
        <span className="lib-card-mime"
          style={{ background: type.color + '25', color: type.color }}>
          {getMimeLabel(cat, doc.file_mime)}
        </span>
      </div>

      <div className="lib-card-body">
        <div className="lib-card-title">{doc.title}</div>
        <span className="lib-card-type-tag"
          style={{ background: type.color + '18', color: type.color }}>
          {type.icon} {type.label}
        </span>
        {subtitle && <div className="lib-card-sub">{subtitle}</div>}
        {meta2    && <div className="lib-card-meta2">{meta2}</div>}
        {doc.description && (
          <div className="lib-card-desc">{doc.description}</div>
        )}
      </div>

      {hasActions && (
        <div className="lib-card-actions" onClick={e => e.stopPropagation()}>
          {canEditDoc && (
            <button className="lib-card-action-btn"
              title="Editar metadatos"
              onClick={e => { e.stopPropagation(); onEdit(doc) }}>
              ✎ Editar
            </button>
          )}
          {canShare && (
            <button className="lib-card-action-btn"
              title="Compartir con otros docentes"
              onClick={e => { e.stopPropagation(); onShare(doc) }}>
              🔗 Compartir
            </button>
          )}
          {onHistory && (
            <button className="lib-card-action-btn"
              title="Ver historial de edición"
              onClick={e => { e.stopPropagation(); onHistory(doc) }}>
              🕐 Historial
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// FRAGMENT SELECTOR — overlay de selección sobre canvas (Fase 3)
// Recibe canvasRef (ref al <canvas> de PDF.js) y pdfPage (objeto PDF.js page).
// Coordenadas relativas al canvas via getBoundingClientRect().
// =============================================================================

function FragmentSelector({ canvasRef, pdfPage, scale, onCapture, onCancel }) {
  const overlayRef = useRef()
  const startRef   = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [rect,     setRect]     = useState(null)   // { x0,y0,x1,y1 } en px del canvas

  function getCanvasPos(e) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const b = canvas.getBoundingClientRect()
    return { x: Math.round(e.clientX - b.left), y: Math.round(e.clientY - b.top) }
  }

  function onMouseDown(e) {
    e.preventDefault()
    const pos = getCanvasPos(e)
    startRef.current = pos
    setRect({ x0: pos.x, y0: pos.y, x1: pos.x, y1: pos.y })
    setDragging(true)
  }

  function onMouseMove(e) {
    if (!dragging || !startRef.current) return
    const pos = getCanvasPos(e)
    setRect({ x0: startRef.current.x, y0: startRef.current.y, x1: pos.x, y1: pos.y })
  }

  async function onMouseUp(e) {
    if (!dragging) return
    setDragging(false)
    const pos = getCanvasPos(e)
    const x0 = Math.min(startRef.current.x, pos.x)
    const y0 = Math.min(startRef.current.y, pos.y)
    const x1 = Math.max(startRef.current.x, pos.x)
    const y1 = Math.max(startRef.current.y, pos.y)
    setRect(null)

    // Ignorar selecciones demasiado pequeñas
    if (x1 - x0 < 10 || y1 - y0 < 10) return

    const canvas = canvasRef.current
    if (!canvas) return

    // Capturar región del canvas a un offscreen canvas
    const cw = x1 - x0
    const ch = y1 - y0
    const off = document.createElement('canvas')
    off.width  = cw
    off.height = ch
    off.getContext('2d').drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch)
    const base64 = off.toDataURL('image/webp', 0.92).split(',')[1]

    // Región como porcentajes 0–1 del canvas completo
    const region = {
      x: x0 / canvas.width,
      y: y0 / canvas.height,
      w: cw  / canvas.width,
      h: ch  / canvas.height,
    }

    // Intentar extraer texto del text layer de PDF.js
    let extractedText = ''
    if (pdfPage) {
      try {
        const viewport = pdfPage.getViewport({ scale })
        const textContent = await pdfPage.getTextContent()
        extractedText = textContent.items
          .filter(item => {
            // transform[4]=x, transform[5]=y en coordenadas PDF (origen abajo-izquierda)
            const nx = item.transform[4] / viewport.width
            const ny = 1 - (item.transform[5] / viewport.height)
            return nx >= region.x && nx <= region.x + region.w &&
                   ny >= region.y && ny <= region.y + region.h
          })
          .map(i => i.str)
          .join(' ')
          .trim()
      } catch { /* PDF escaneado — sin text layer */ }
    }

    onCapture({ base64, region, extractedText, mediaType: 'image/webp' })
  }

  // Rectángulo de selección visual
  const selRect = rect ? {
    position: 'absolute',
    left:     Math.min(rect.x0, rect.x1),
    top:      Math.min(rect.y0, rect.y1),
    width:    Math.abs(rect.x1 - rect.x0),
    height:   Math.abs(rect.y1 - rect.y0),
    border:   '2px solid #2E5598',
    background: 'rgba(46,85,152,0.10)',
    pointerEvents: 'none',
  } : null

  return (
    <div
      ref={overlayRef}
      className="lib-frag-overlay"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={() => { if (dragging) { setDragging(false); setRect(null) } }}
    >
      <div className="lib-frag-hint">
        <span>✂️ Arrastra para seleccionar un fragmento</span>
        <button type="button" className="lib-frag-cancel-btn" onClick={onCancel}>✕ Cancelar</button>
      </div>
      {selRect && <div style={selRect} />}
    </div>
  )
}

// =============================================================================
// FRAGMENT PANEL — preview + análisis IA + guardar (Fase 3)
// =============================================================================

const FRAG_TYPE_LABEL = {
  table:      '📋 Tabla',
  vocabulary: '🔤 Vocabulario',
  grammar:    '✏️ Gramática',
  reading:    '📖 Lectura',
  exercise:   '📝 Ejercicio',
  image:      '🖼 Imagen',
}

function FragmentPanel({ fragment, doc, teacher, pageNumber, onClose, onSaved }) {
  const { showToast } = useToast()
  const [analyzing,      setAnalyzing]      = useState(false)
  const [analysis,       setAnalysis]       = useState(null)
  const [analyzeError,   setAnalyzeError]   = useState('')
  const [saving,         setSaving]         = useState(false)
  const [assignSubject,  setAssignSubject]  = useState(doc.subjects?.[0] || '')
  const [assignGrade,    setAssignGrade]    = useState(doc.grades?.[0] || '')
  const [assignWeek,     setAssignWeek]     = useState('')

  async function handleAnalyze() {
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const result = await analyzeTextbookFragment(
        fragment.base64,
        fragment.mediaType,
        { docTitle: doc.title, subject: doc.subjects?.join(', '), grade: doc.grades?.join(', ') }
      )
      setAnalysis(result)
    } catch (err) {
      setAnalyzeError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Subir imagen al Storage
      const fragId   = crypto.randomUUID()
      const blob     = await fetch(`data:${fragment.mediaType};base64,${fragment.base64}`).then(r => r.blob())
      const storagePath = `${teacher.school_id}/fragments/${doc.id}/${fragId}.webp`
      const { error: upErr } = await supabase.storage
        .from('cbf-library')
        .upload(storagePath, blob, { contentType: 'image/webp', upsert: false })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('cbf-library').getPublicUrl(storagePath)

      // Insertar en library_fragments
      const { error: dbErr } = await supabase.from('library_fragments').insert({
        school_id:        teacher.school_id,
        doc_id:           doc.id,
        created_by:       teacher.id,
        page_number:      pageNumber || null,
        region:           fragment.region,
        image_url:        publicUrl,
        extracted_text:   fragment.extractedText || null,
        ai_analysis:      analysis || null,
        assigned_subject: assignSubject || null,
        assigned_grade:   assignGrade   || null,
        assigned_week:    assignWeek ? parseInt(assignWeek, 10) : null,
      })
      if (dbErr) throw dbErr

      logActivity('create', 'library_fragments', fragId, `Fragmento guardado del doc "${doc.title}"`)
      showToast('Fragmento guardado correctamente', 'success')
      onSaved()
    } catch (err) {
      logError(err, { page: 'LibraryPage', action: 'handleSaveFragment', entityId: doc.id })
      showToast('Error al guardar fragmento: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="lib-fragpanel-overlay">
      <div className="lib-fragpanel">
        <div className="lib-fragpanel-header">
          <span>✂️ Fragmento capturado</span>
          <button type="button" className="lib-viewer-close" onClick={onClose}>✕</button>
        </div>

        <div className="lib-fragpanel-body">
          {/* Preview del recorte */}
          <div className="lib-fragpanel-preview-wrap">
            <img
              src={`data:${fragment.mediaType};base64,${fragment.base64}`}
              alt="Fragmento capturado"
              className="lib-fragpanel-preview-img"
            />
          </div>

          {/* Texto extraído (si PDF con text layer) */}
          {fragment.extractedText && (
            <div className="lib-fragpanel-extracted">
              <span className="lib-fragpanel-label">Texto detectado</span>
              <p className="lib-fragpanel-extracted-text">
                {fragment.extractedText.length > 220
                  ? fragment.extractedText.slice(0, 220) + '…'
                  : fragment.extractedText}
              </p>
            </div>
          )}

          {/* Botón analizar */}
          {!analysis && (
            <button
              type="button"
              className="lib-fragpanel-analyze-btn"
              onClick={handleAnalyze}
              disabled={analyzing}
            >
              {analyzing
                ? <><span className="lib-frag-spinner" /> Analizando…</>
                : '🤖 Analizar con IA'}
            </button>
          )}
          {analyzeError && <p className="lib-fragpanel-error">{analyzeError}</p>}

          {/* Resultado del análisis */}
          {analysis && (
            <div className="lib-fragpanel-analysis">
              <div className="lib-fragpanel-type-badge">
                {FRAG_TYPE_LABEL[analysis.content_type] || analysis.content_type}
                <span className="lib-fragpanel-lang">{analysis.language === 'en' ? '🇬🇧 EN' : '🇨🇴 ES'}</span>
              </div>
              <p className="lib-fragpanel-desc">{analysis.description}</p>
              {analysis.suggested_smartblock && (
                <div className="lib-fragpanel-smartblock">
                  <span className="lib-fragpanel-label">SmartBlock sugerido</span>
                  <code className="lib-fragpanel-code">
                    {analysis.suggested_smartblock.type} · {analysis.suggested_smartblock.model}
                  </code>
                </div>
              )}
              <button
                type="button"
                className="lib-fragpanel-reanalyze"
                onClick={handleAnalyze}
                disabled={analyzing}
              >
                🔄 Reanálizar
              </button>
            </div>
          )}

          {/* Asignación pedagógica */}
          <div className="lib-fragpanel-assign">
            <span className="lib-fragpanel-label">Asignar a guía (opcional)</span>
            <div className="lib-fragpanel-assign-row">
              <select
                value={assignSubject}
                onChange={e => setAssignSubject(e.target.value)}
                className="lib-fragpanel-select"
              >
                <option value="">Materia…</option>
                {SUBJECTS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={assignGrade}
                onChange={e => setAssignGrade(e.target.value)}
                className="lib-fragpanel-select"
              >
                <option value="">Grado…</option>
                {GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input
                type="number"
                min={1} max={53}
                placeholder="Semana"
                value={assignWeek}
                onChange={e => setAssignWeek(e.target.value)}
                className="lib-fragpanel-week-input"
              />
            </div>
          </div>
        </div>

        <div className="lib-fragpanel-footer">
          <button
            type="button"
            className="lib-fragpanel-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando…' : '💾 Guardar fragmento'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// PAGES ANALYSIS PANEL — Fase 4: multi-page analysis result display
// =============================================================================

function PagesAnalysisPanel({ analysis, pageNums, onClose }) {
  const SMARTBLOCK_COLORS = {
    VOCAB: '#9BBB59', GRAMMAR: '#375623', READING: '#17375E',
    QUIZ: '#C0504D', WORKSHOP: '#F79646', EXIT_TICKET: '#C55A11',
  }

  return createPortal(
    <div className="lib-panel-overlay" onClick={onClose}>
      <div className="lib-frag-panel lib-pages-panel" onClick={e => e.stopPropagation()}>
        <div className="lib-frag-panel-header" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>📖 Análisis de páginas</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>
              Págs. {pageNums.join(', ')} · {analysis.language === 'en' ? 'English' : 'Español'}
            </div>
          </div>
          <button type="button" className="lib-frag-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="lib-frag-panel-body">
          {/* Summary */}
          <div className="lib-frag-section-label">Resumen del contenido</div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>
            {analysis.unit_summary}
          </p>

          {/* Key concepts */}
          {analysis.key_concepts?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="lib-frag-section-label">Conceptos clave</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {analysis.key_concepts.map((c, i) => (
                  <span key={i} style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 12,
                    background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
                  }}>{c}</span>
                ))}
              </div>
            </div>
          )}

          {/* Vocabulary */}
          {analysis.vocabulary?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="lib-frag-section-label">Vocabulario ({analysis.vocabulary.length} items)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {analysis.vocabulary.slice(0, 8).map((v, i) => (
                  <span key={i} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 8,
                    background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0',
                  }}>{v.w}</span>
                ))}
              </div>
            </div>
          )}

          {/* Grammar points */}
          {analysis.grammar_points?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="lib-frag-section-label">Puntos gramaticales</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151' }}>
                {analysis.grammar_points.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
          )}

          {/* Suggested week plan */}
          {analysis.suggested_week_plan && (
            <div style={{ marginTop: 12 }}>
              <div className="lib-frag-section-label">Plan sugerido para la semana</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['day1','day2','day3','day4','day5'].map((k, i) => {
                  const txt = analysis.suggested_week_plan[k]
                  if (!txt) return null
                  const DAYS = ['Lun','Mar','Mié','Jue','Vie']
                  const COLORS = ['#1D4ED8','#7C3AED','#059669','#D97706','#DC2626']
                  return (
                    <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{
                        flexShrink: 0, fontSize: 10, fontWeight: 800, padding: '2px 6px',
                        borderRadius: 6, background: COLORS[i] + '18', color: COLORS[i],
                        minWidth: 28, textAlign: 'center',
                      }}>{DAYS[i]}</span>
                      <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{txt}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* SmartBlock suggestions */}
          {analysis.suggested_smartblocks?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="lib-frag-section-label">SmartBlocks sugeridos</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {analysis.suggested_smartblocks.map((sb, i) => {
                  const c = SMARTBLOCK_COLORS[sb.type] || '#6B7280'
                  return (
                    <div key={i} style={{
                      fontSize: 12, padding: '6px 10px', borderRadius: 8,
                      background: c + '15', border: `1px solid ${c}44`,
                    }}>
                      <span style={{ fontWeight: 700, color: c }}>{sb.type} / {sb.model}</span>
                      {sb.rationale && <span style={{ color: '#6B7280', marginLeft: 8 }}>— {sb.rationale}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="lib-frag-panel-footer">
          <button type="button" className="lib-frag-save-btn" onClick={onClose}
            style={{ background: '#1D4ED8' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// SYLLABUS LINK PANEL — Fase 5: vincular páginas completas a syllabus_topics
// =============================================================================

function SyllabusLinkPanel({ doc, teacher, currentPage, onClose, onSaved }) {
  const { showToast } = useToast()
  const [topics,     setTopics]     = useState([])
  const [topicId,    setTopicId]    = useState('')
  const [pagesInput, setPagesInput] = useState(String(currentPage || 1))
  const [saving,     setSaving]     = useState(false)

  useEffect(() => {
    supabase
      .from('syllabus_topics')
      .select('id, topic, subject, grade, week_number, period')
      .eq('teacher_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .order('period').order('week_number')
      .then(({ data }) => setTopics(data || []))
  }, [teacher.id, teacher.school_id])

  async function handleSave() {
    if (!topicId) { showToast('Selecciona un tema del Syllabus', 'error'); return }
    const pages = pagesInput
      .split(/[,\s]+/)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n) && n > 0)
    if (!pages.length) { showToast('Ingresa al menos una página', 'error'); return }
    setSaving(true)
    const { error } = await supabase
      .from('syllabus_topics')
      .update({ library_doc_id: doc.id, library_pages: pages })
      .eq('id', topicId)
    setSaving(false)
    if (error) { logError(error, { page: 'LibraryPage', action: 'syllabusLink', entityId: topicId }); showToast('Error al guardar: ' + error.message, 'error'); return }
    logActivity('update', 'syllabus_topics', topicId, `Páginas ${pages.join(',')} vinculadas al syllabus desde "${doc.title}"`)
    showToast('Páginas vinculadas al Syllabus', 'success')
    onSaved?.()
    onClose()
  }

  // Group topics for display
  const grouped = topics.reduce((acc, t) => {
    const k = `P${t.period} · Sem.${t.week_number ?? '?'}`
    if (!acc[k]) acc[k] = []
    acc[k].push(t)
    return acc
  }, {})

  return createPortal(
    <div className="lib-panel-overlay" onClick={onClose}>
      <div className="lib-frag-panel" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="lib-frag-panel-header" style={{ background: 'linear-gradient(135deg, #1D4ED8, #2563EB)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>📋 Vincular al Syllabus</div>
            <div style={{ fontSize: 11, opacity: 0.85 }}>{doc.title}</div>
          </div>
          <button type="button" className="lib-frag-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="lib-frag-panel-body">
          <div className="lib-frag-section-label">Tema del Syllabus</div>
          <select
            value={topicId}
            onChange={e => setTopicId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #93C5FD', borderRadius: 8, fontSize: 13, background: '#fff', marginBottom: 12 }}
          >
            <option value="">— Seleccionar tema —</option>
            {Object.entries(grouped).map(([group, ts]) => (
              <optgroup key={group} label={group}>
                {ts.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.topic} ({t.subject} · {t.grade})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="lib-frag-section-label">Páginas</div>
          <input
            value={pagesInput}
            onChange={e => setPagesInput(e.target.value)}
            placeholder="ej. 12, 13, 14"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #93C5FD', borderRadius: 8, fontSize: 13, marginBottom: 6 }}
          />
          <p style={{ margin: '0 0 4px', fontSize: 11, color: '#2563EB' }}>
            Página actual: {currentPage}. Separa múltiples páginas con comas.
          </p>
        </div>

        <div className="lib-frag-panel-footer">
          <button type="button" onClick={onClose}
            style={{ padding: '8px 16px', border: '1px solid #d0d8e8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
          <button type="button" className="lib-frag-save-btn" disabled={saving} onClick={handleSave}
            style={{ background: '#1D4ED8', opacity: saving ? .6 : 1 }}>
            {saving ? 'Guardando…' : '💾 Vincular páginas'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// PDF VIEWER — PDF.js page-by-page (Fase 2)
// =============================================================================

// Derive worker URL from installed pdfjs-dist version to avoid silent breakage on upgrade
import { version as PDFJS_VERSION } from 'pdfjs-dist/package.json'
const PDFJS_WORKER_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`

function PDFViewerCanvas({ url, fragmentMode = false, onFragmentCapture, pageSelectionMode = false, onPagesReady, onPageChange }) {
  const canvasRef = useRef()
  const renderRef = useRef(null)
  const [doc,           setDoc]           = useState(null)
  const [numPages,      setNumPages]      = useState(0)
  const [page,          setPage]          = useState(1)
  const [scale,         setScale]         = useState(1.4)
  const [status,        setStatus]        = useState('loading')   // loading | ready | error
  const [rendering,     setRendering]     = useState(false)
  const [pdfPage,       setPdfPage]       = useState(null)        // página actual para text extraction
  const [selectedPages, setSelectedPages] = useState(new Set())   // Fase 4: multi-page selection
  const [capturing,     setCapturing]     = useState(false)       // rendering offscreen pages for analysis

  // Reset selection when mode is deactivated
  useEffect(() => { if (!pageSelectionMode) setSelectedPages(new Set()) }, [pageSelectionMode])

  // Notify parent of current page
  useEffect(() => { onPageChange?.(page) }, [page])

  async function handleAnalyzePages() {
    if (!doc || !selectedPages.size) return
    setCapturing(true)
    const sorted = [...selectedPages].sort((a, b) => a - b)
    const captures = (await Promise.all(sorted.map(async (pageNum) => {
      try {
        const pageObj = await doc.getPage(pageNum)
        const viewport = pageObj.getViewport({ scale: 1.5 })
        const offscreen = document.createElement('canvas')
        offscreen.width  = viewport.width
        offscreen.height = viewport.height
        await pageObj.render({ canvasContext: offscreen.getContext('2d'), viewport }).promise
        return { pageNum, base64: offscreen.toDataURL('image/jpeg', 0.85).split(',')[1] }
      } catch { return null }
    }))).filter(Boolean)
    setCapturing(false)
    if (captures.length) onPagesReady?.(captures)
  }

  // Load PDF document
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL
        const pdfDoc = await pdfjsLib.getDocument(url).promise
        if (!cancelled) { setDoc(pdfDoc); setNumPages(pdfDoc.numPages); setStatus('ready') }
      } catch (_) {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => { cancelled = true }
  }, [url])

  // Render current page onto canvas
  useEffect(() => {
    if (!doc || !canvasRef.current) return
    let cancelled = false
    ;(async () => {
      if (renderRef.current) {
        try { renderRef.current.cancel() } catch(_) {}
        renderRef.current = null
      }
      setRendering(true)
      try {
        const pageObj = await doc.getPage(page)
        if (cancelled) return
        setPdfPage(pageObj)
        const viewport = pageObj.getViewport({ scale })
        const canvas = canvasRef.current
        canvas.width  = viewport.width
        canvas.height = viewport.height
        const task = pageObj.render({ canvasContext: canvas.getContext('2d'), viewport })
        renderRef.current = task
        await task.promise
        if (!cancelled) setRendering(false)
      } catch (_) {
        if (!cancelled) setRendering(false)
      }
    })()
    return () => { cancelled = true }
  }, [doc, page, scale])

  if (status === 'loading') return (
    <div className="lib-pdf-loading">
      <div className="lib-loading-spinner" />
      <span>Cargando PDF…</span>
    </div>
  )
  if (status === 'error') return (
    <div className="lib-pdf-error">⚠️ No se pudo cargar el PDF</div>
  )

  return (
    <div className="lib-pdf-viewer">
      <div className="lib-pdf-toolbar">
        <div className="lib-pdf-nav">
          <button className="lib-pdf-btn" disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}>‹</button>
          <input className="lib-pdf-page-input"
            type="number" min={1} max={numPages} value={page}
            onChange={e => {
              const v = parseInt(e.target.value, 10)
              if (!isNaN(v) && v >= 1 && v <= numPages) setPage(v)
            }} />
          <span className="lib-pdf-of">de {numPages}</span>
          <button className="lib-pdf-btn" disabled={page >= numPages}
            onClick={() => setPage(p => p + 1)}>›</button>
        </div>
        <div className="lib-pdf-zoom">
          <button className="lib-pdf-btn"
            onClick={() => setScale(s => Math.max(0.5, Math.round((s - 0.25) * 100) / 100))}>−</button>
          <span className="lib-pdf-scale">{Math.round(scale * 100)}%</span>
          <button className="lib-pdf-btn"
            onClick={() => setScale(s => Math.min(4, Math.round((s + 0.25) * 100) / 100))}>+</button>
          <button className="lib-pdf-btn lib-pdf-reset"
            title="Restablecer zoom" onClick={() => setScale(1.4)}>↺</button>
        </div>
        {pageSelectionMode && (
          <div className="lib-pdf-page-sel">
            <button
              type="button"
              className={`lib-pdf-btn lib-pdf-sel-btn${selectedPages.has(page) ? ' lib-pdf-sel-btn--active' : ''}`}
              onClick={() => setSelectedPages(s => {
                const n = new Set(s)
                if (n.has(page)) n.delete(page); else n.add(page)
                return n
              })}
            >
              {selectedPages.has(page) ? '✓ Seleccionada' : '➕ Añadir página'}
            </button>
            {selectedPages.size > 0 && (
              <button
                type="button"
                className="lib-pdf-btn lib-pdf-analyze-btn"
                disabled={capturing}
                onClick={handleAnalyzePages}
              >
                {capturing ? '⏳…' : `🔬 Analizar (${selectedPages.size} pág${selectedPages.size !== 1 ? 's' : ''})`}
              </button>
            )}
            {selectedPages.size > 0 && (
              <span className="lib-pdf-sel-count">
                Págs: {[...selectedPages].sort((a,b)=>a-b).join(', ')}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="lib-pdf-canvas-wrap">
        {rendering && (
          <div className="lib-pdf-render-overlay">
            <div className="lib-loading-spinner" />
          </div>
        )}
        <canvas ref={canvasRef} className="lib-pdf-canvas" />
        {fragmentMode && !rendering && (
          <FragmentSelector
            canvasRef={canvasRef}
            pdfPage={pdfPage}
            scale={scale}
            onCapture={data => onFragmentCapture?.({ ...data, page })}
            onCancel={() => onFragmentCapture?.(null)}
          />
        )}
      </div>
    </div>
  )
}

// =============================================================================
// WAVEFORM PLAYER — WaveSurfer.js (Fase 2)
// =============================================================================

function WaveformPlayer({ url, title, author }) {
  const containerRef = useRef()
  const wsRef        = useRef(null)
  const [ready,       setReady]       = useState(false)
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [volume,      setVolume]      = useState(1)

  useEffect(() => {
    let ws
    ;(async () => {
      const WaveSurfer = (await import('wavesurfer.js')).default
      ws = WaveSurfer.create({
        container:     containerRef.current,
        waveColor:     '#4BACC6',
        progressColor: '#1F3864',
        cursorColor:   '#2E5598',
        cursorWidth:   2,
        height:        80,
        normalize:     true,
        barWidth:      2,
        barGap:        1,
        barRadius:     2,
      })
      ws.load(url)
      ws.on('ready',      (dur) => { setReady(true); setDuration(dur); wsRef.current = ws })
      ws.on('timeupdate', (t)   => setCurrentTime(t))
      ws.on('finish',     ()    => setPlaying(false))
    })()
    return () => { ws?.destroy() }
  }, [url])

  function fmtTime(s) {
    const m = Math.floor(s / 60)
    return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  }

  function handlePlayPause() {
    if (!wsRef.current) return
    wsRef.current.playPause()
    setPlaying(p => !p)
  }

  return (
    <div className="lib-wave-wrap">
      <div className="lib-wave-art">🎵</div>
      <p className="lib-wave-title">{title}</p>
      {author && <p className="lib-wave-artist">✍️ {author}</p>}
      {!ready && <p className="lib-wave-loading">Cargando audio…</p>}
      <div ref={containerRef} className="lib-wave-container" />
      <div className="lib-wave-controls">
        <button className="lib-wave-play" disabled={!ready} onClick={handlePlayPause}>
          {playing ? '⏸' : '▶'}
        </button>
        <span className="lib-wave-time">{fmtTime(currentTime)}</span>
        <span className="lib-wave-sep">/</span>
        <span className="lib-wave-dur">{fmtTime(duration)}</span>
        <label className="lib-wave-vol-label" title="Volumen">
          🔊
          <input type="range" min={0} max={1} step={0.05} value={volume}
            className="lib-wave-vol"
            onChange={e => {
              const v = parseFloat(e.target.value)
              setVolume(v)
              wsRef.current?.setVolume(v)
            }} />
        </label>
      </div>
    </div>
  )
}

// =============================================================================
// DEEP ZOOM IMAGE — OpenSeadragon (Fase 2)
// =============================================================================

function DeepZoomImage({ url, title, fragmentMode = false, onFragmentCapture }) {
  const containerRef = useRef()
  const viewerRef    = useRef(null)

  function captureCurrentView() {
    const canvas = viewerRef.current?.drawer?.canvas
    if (!canvas) return
    const base64 = canvas.toDataURL('image/webp', 0.92).split(',')[1]
    onFragmentCapture?.({ base64, region: { x: 0, y: 0, w: 1, h: 1 }, extractedText: '', mediaType: 'image/webp', page: null })
  }

  useEffect(() => {
    let viewer
    ;(async () => {
      const OpenSeadragon = (await import('openseadragon')).default
      viewer = OpenSeadragon({
        element:             containerRef.current,
        tileSources:         { type: 'image', url },
        showNavigationControl: false,
        gestureSettingsMouse:  { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true },
        gestureSettingsTouch:  { pinchToZoom: true },
        defaultZoomLevel:    0,   // fit to container
        visibilityRatio:     0.5,
        minZoomLevel:        0.3,
        maxZoomLevel:        20,
        animationTime:       0.4,
      })
      viewerRef.current = viewer
    })()
    return () => { viewer?.destroy() }
  }, [url])

  return (
    <div className="lib-osd-wrap">
      <div ref={containerRef} className="lib-osd-viewer" />
      <div className="lib-osd-controls">
        <button className="lib-pdf-btn" title="Acercar"
          onClick={() => viewerRef.current?.viewport?.zoomBy(1.5, null, true)}>+</button>
        <button className="lib-pdf-btn" title="Alejar"
          onClick={() => viewerRef.current?.viewport?.zoomBy(0.67, null, true)}>−</button>
        <button className="lib-pdf-btn" title="Ajustar"
          onClick={() => viewerRef.current?.viewport?.goHome(true)}>↺</button>
      </div>
      <p className="lib-osd-hint">
        🖱 Scroll para zoom · Arrastra para mover · Doble clic = zoom in · Pinch en móvil
      </p>
      {fragmentMode && (
        <button type="button" className="lib-frag-capture-view-btn" onClick={captureCurrentView}>
          ✂️ Capturar vista actual
        </button>
      )}
    </div>
  )
}

// =============================================================================
// DOCUMENT VIEWER — visor universal
// =============================================================================

function DocumentViewer({ doc, teacher, onClose }) {
  const { showToast } = useToast()
  const cat  = getMimeCategory(doc.file_mime)
  const type = DOC_TYPES[doc.doc_type] || DOC_TYPES.other
  const [fragmentMode,      setFragmentMode]      = useState(false)
  const [capturedFragment,  setCapturedFragment]  = useState(null)   // { base64, region, extractedText, mediaType, page }
  const [pageSelectionMode, setPageSelectionMode] = useState(false)  // Fase 4
  const [analyzingPages,    setAnalyzingPages]    = useState(false)  // Fase 4
  const [pagesAnalysis,     setPagesAnalysis]     = useState(null)   // Fase 4 — { analysis, pageNums }
  const [currentPdfPage,    setCurrentPdfPage]    = useState(1)      // Fase 5
  const [syllabusLinkOpen,  setSyllabusLinkOpen]  = useState(false)  // Fase 5

  const canFragment = (cat === 'pdf' || cat === 'image') && !!teacher
  const canAnalyzePages = cat === 'pdf' && !!teacher
  const canLinkSyllabus = cat === 'pdf' && !!teacher
  const isImage = cat === 'image'

  async function handleDownloadJpeg() {
    try {
      const img = new window.Image()
      img.crossOrigin = 'anonymous'
      img.src = doc.file_url
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej })
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d').drawImage(img, 0, 0)
      canvas.toBlob(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = (doc.file_name || doc.title || 'imagen').replace(/\.\w+$/, '') + '.jpg'
        a.click()
        URL.revokeObjectURL(a.href)
      }, 'image/jpeg', 0.85)
    } catch {
      showToast('No se pudo convertir la imagen', 'error')
    }
  }

  function handleFragmentCapture(data) {
    if (!data) { setFragmentMode(false); return }
    setCapturedFragment(data)
    setFragmentMode(false)
  }

  async function handlePagesReady(captures) {
    // captures = [{pageNum, base64}]
    setPageSelectionMode(false)
    setAnalyzingPages(true)
    try {
      const analysis = await analyzeTextbookPages(captures, {
        docTitle:  doc.title,
        subject:   doc.subjects?.[0] || '',
        grade:     doc.grades?.[0]   || '',
        pageRange: captures.map(c => c.pageNum).join(', '),
      })
      setPagesAnalysis({ analysis, pageNums: captures.map(c => c.pageNum) })
    } catch (e) {
      showToast('Error al analizar las páginas: ' + (e.message || 'Error desconocido'), 'error')
    }
    setAnalyzingPages(false)
  }

  const viewer = createPortal(
    <div className="lib-viewer-overlay" onClick={onClose}>
      <div className="lib-viewer-modal" onClick={e => e.stopPropagation()}>

        <div className="lib-viewer-header">
          <div className="lib-viewer-header-left">
            <span className="lib-viewer-title">{doc.title}</span>
            <span className="lib-viewer-badge"
              style={{ background: type.color + '22', color: type.color }}>
              {type.icon} {type.label}
            </span>
          </div>
          <div className="lib-viewer-header-actions">
            {canLinkSyllabus && (
              <button
                type="button"
                className="lib-viewer-frag-btn"
                onClick={() => { setSyllabusLinkOpen(true); setFragmentMode(false); setPageSelectionMode(false) }}
                title="Vincular páginas de este PDF a un tema del Syllabus"
              >
                📋 Syllabus
              </button>
            )}
            {canAnalyzePages && (
              <button
                type="button"
                className={`lib-viewer-frag-btn${pageSelectionMode ? ' lib-viewer-frag-btn--active' : ''}`}
                disabled={analyzingPages}
                onClick={() => { setPageSelectionMode(m => !m); setFragmentMode(false) }}
                title="Selecciona páginas y analízalas con IA para obtener un plan semanal"
              >
                {analyzingPages ? '⏳ Analizando…' : pageSelectionMode ? '↩ Cancelar selección' : '📖 Páginas'}
              </button>
            )}
            {canFragment && (
              <button
                type="button"
                className={`lib-viewer-frag-btn${fragmentMode ? ' lib-viewer-frag-btn--active' : ''}`}
                onClick={() => { setFragmentMode(m => !m); setPageSelectionMode(false) }}
                title="Modo fragmento — selecciona y extrae partes del documento"
              >
                ✂️ {fragmentMode ? 'Cancelar' : 'Fragmento'}
              </button>
            )}
            {isImage && doc.file_url && (
              <button
                type="button"
                className="lib-viewer-dl lib-viewer-dl--jpeg"
                onClick={handleDownloadJpeg}
                title="Descargar como JPEG — compatible con Word y todas las apps">
                ⬇ JPEG
              </button>
            )}
            {(doc.file_url || doc.external_url) && (
              <a
                href={doc.file_url || doc.external_url}
                download={doc.file_name || undefined}
                target="_blank"
                rel="noreferrer"
                className="lib-viewer-dl"
                onClick={e => e.stopPropagation()}
                title="Descargar archivo original">
                ⬇ Original
              </a>
            )}
            <button className="lib-viewer-close" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="lib-viewer-body">

          {!doc.file_url && doc.external_url && (
            <div className="lib-viewer-external">
              <div className="lib-viewer-ext-icon">🔗</div>
              <p className="lib-viewer-ext-label">Recurso externo</p>
              <a href={doc.external_url} target="_blank" rel="noreferrer"
                className="lib-viewer-ext-link">
                {doc.external_url}
              </a>
            </div>
          )}

          {doc.file_url && cat === 'pdf' && (
            <PDFViewerCanvas
              url={doc.file_url}
              fragmentMode={fragmentMode}
              onFragmentCapture={handleFragmentCapture}
              pageSelectionMode={pageSelectionMode}
              onPagesReady={handlePagesReady}
              onPageChange={setCurrentPdfPage}
            />
          )}

          {doc.file_url && cat === 'image' && (
            <DeepZoomImage
              url={doc.file_url}
              title={doc.title}
              fragmentMode={fragmentMode}
              onFragmentCapture={handleFragmentCapture}
            />
          )}

          {doc.file_url && cat === 'video' && (
            <div className="lib-viewer-video-wrap">
              <video src={doc.file_url} controls className="lib-viewer-video">
                Tu navegador no soporta reproducción de video.
              </video>
            </div>
          )}

          {doc.file_url && cat === 'audio' && (
            <WaveformPlayer
              url={doc.file_url}
              title={doc.title}
              author={doc.metadata?.author}
            />
          )}

          {doc.file_url && cat === 'midi' && (
            <div className="lib-viewer-midi-wrap">
              <div className="lib-viewer-midi-icon">🎹</div>
              <p className="lib-viewer-midi-title">{doc.title}</p>
              <p className="lib-viewer-midi-note">
                Archivo MIDI — descárgalo para reproducirlo en tu DAW, Sibelius, MuseScore u otro software musical.
              </p>
              <a href={doc.file_url} download={doc.file_name} className="lib-viewer-dl-btn">
                ⬇ Descargar MIDI
              </a>
            </div>
          )}

          {doc.file_url && cat === 'other' && (
            <div className="lib-viewer-generic">
              <div className="lib-viewer-generic-icon">📁</div>
              <p className="lib-viewer-generic-name">{doc.file_name || 'Archivo'}</p>
              <p className="lib-viewer-generic-size">{fmtBytes(doc.file_size)}</p>
              <a href={doc.file_url} download={doc.file_name} className="lib-viewer-dl-btn">
                ⬇ Descargar
              </a>
            </div>
          )}
        </div>

        {(doc.description || doc.metadata?.author || doc.metadata?.year || doc.subjects?.length > 0) && (
          <div className="lib-viewer-footer">
            <div className="lib-viewer-footer-chips">
              {doc.metadata?.author    && <span>✍️ {doc.metadata.author}</span>}
              {doc.metadata?.year      && <span>📅 {doc.metadata.year}</span>}
              {doc.metadata?.publisher && <span>🏢 {doc.metadata.publisher}</span>}
              {doc.page_count          && <span>📄 {doc.page_count} págs.</span>}
              {doc.subjects?.map(s => <span key={s} className="lib-footer-subject">{s}</span>)}
              {doc.grades?.map(g   => <span key={g} className="lib-footer-grade">{g}</span>)}
            </div>
            {doc.description && (
              <p className="lib-viewer-footer-desc">{doc.description}</p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )

  return (
    <>
      {viewer}
      {capturedFragment && teacher && (
        <FragmentPanel
          fragment={capturedFragment}
          doc={doc}
          teacher={teacher}
          pageNumber={capturedFragment.page}
          onClose={() => setCapturedFragment(null)}
          onSaved={() => setCapturedFragment(null)}
        />
      )}
      {pagesAnalysis && (
        <PagesAnalysisPanel
          analysis={pagesAnalysis.analysis}
          pageNums={pagesAnalysis.pageNums}
          onClose={() => setPagesAnalysis(null)}
        />
      )}
      {syllabusLinkOpen && teacher && (
        <SyllabusLinkPanel
          doc={doc}
          teacher={teacher}
          currentPage={currentPdfPage}
          onClose={() => setSyllabusLinkOpen(false)}
          onSaved={() => setSyllabusLinkOpen(false)}
        />
      )}
    </>
  )
}

// =============================================================================
// SHARED FORM FIELDS — reutilizado en Upload y Edit
// =============================================================================

function DocMetaForm({ form, upd, file, fileRef, onFileChange, showFilePill, showReplaceBtn }) {
  function toggleArr(arr, val) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  return (
    <>
      {/* File pill */}
      {showFilePill && file && (
        <div className="lib-file-pill">
          <span>{DOC_TYPES[guessDocType(file.type)]?.icon || '📁'}</span>
          <span className="lib-file-pill-name">{file.name}</span>
          <span className="lib-file-pill-size">{fmtBytes(file.size)}</span>
        </div>
      )}
      {showFilePill && !file && form.external_url && (
        <div className="lib-file-pill lib-file-pill-ext">
          <span>🔗</span>
          <span className="lib-file-pill-name">{form.external_url}</span>
        </div>
      )}
      {showReplaceBtn && (
        <div className="lib-file-pill">
          <span>📎</span>
          <span className="lib-file-pill-name">{form._existingName}</span>
          <span className="lib-file-pill-size">{fmtBytes(form._existingSize)}</span>
          {file && <span className="lib-file-pill-new">→ {file.name}</span>}
          <button type="button" className="lib-btn-ghost"
            style={{ fontSize: 11, padding: '2px 8px', marginLeft: 6 }}
            onClick={() => fileRef.current?.click()}>
            {file ? 'Cambiar' : 'Reemplazar'}
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT}
            style={{ display: 'none' }} onChange={onFileChange} />
        </div>
      )}

      {/* Title */}
      <label className="lib-label">Título *</label>
      <input className="lib-input" value={form.title}
        onChange={e => upd('title', e.target.value)}
        placeholder="Ej. Uncover 4 — Unit 1" />

      {/* Type */}
      <label className="lib-label">Tipo de documento</label>
      <div className="lib-type-grid">
        {Object.entries(DOC_TYPES).map(([k, v]) => (
          <button key={k} type="button"
            className={`lib-type-btn ${form.doc_type === k ? 'active' : ''}`}
            style={form.doc_type === k
              ? { borderColor: v.color, background: v.color + '18', color: v.color }
              : {}}
            onClick={() => upd('doc_type', k)}>
            {v.icon} {v.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <label className="lib-label">Descripción</label>
      <textarea className="lib-textarea" rows={3}
        value={form.description}
        onChange={e => upd('description', e.target.value)}
        placeholder="Contexto, contenido, uso pedagógico esperado…" />

      {/* Subjects & grades */}
      <div className="lib-two-col">
        <div>
          <label className="lib-label">Materias</label>
          <div className="lib-tag-group">
            {SUBJECTS_LIST.map(s => (
              <button key={s} type="button"
                className={`lib-tag ${form.subjects.includes(s) ? 'active' : ''}`}
                onClick={() => upd('subjects', toggleArr(form.subjects, s))}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="lib-label">Grados</label>
          <div className="lib-tag-group">
            {GRADES_LIST.map(g => (
              <button key={g} type="button"
                className={`lib-tag ${form.grades.includes(g) ? 'active' : ''}`}
                onClick={() => upd('grades', toggleArr(form.grades, g))}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <label className="lib-label" style={{ marginTop: 8 }}>Metadata (opcional)</label>
      <div className="lib-meta-grid">
        <input className="lib-input-sm" placeholder="Autor / Autores"
          value={form.author} onChange={e => upd('author', e.target.value)} />
        <input className="lib-input-sm" placeholder="Año de publicación"
          value={form.year} onChange={e => upd('year', e.target.value)} />
        <input className="lib-input-sm" placeholder="Editorial"
          value={form.publisher} onChange={e => upd('publisher', e.target.value)} />
        <input className="lib-input-sm" placeholder="ISBN / Código"
          value={form.isbn} onChange={e => upd('isbn', e.target.value)} />
      </div>
    </>
  )
}

// =============================================================================
// UPLOAD MODAL
// =============================================================================

function UploadModal({ visibility, teacher, onClose, onUploaded }) {
  const { showToast } = useToast()
  const fileRef = useRef()

  const [step, setStep]         = useState('pick')
  const [file, setFile]         = useState(null)
  const [progress, setProgress] = useState(0)
  const [form, setForm]         = useState({
    title: '', description: '', doc_type: 'other',
    subjects: [], grades: [],
    author: '', year: '', publisher: '', isbn: '',
    external_url: '',
  })

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const cat     = getMimeCategory(f.type)
    const limitMB = MAX_FILE_MB[cat] ?? MAX_FILE_MB.other
    if (f.size > limitMB * 1024 * 1024) {
      showToast(`Archivo demasiado grande. Límite para ${cat.toUpperCase()}: ${limitMB} MB`, 'error')
      return
    }
    setFile(f)
    const guessed = guessDocType(f.type)
    if (guessed !== 'other') upd('doc_type', guessed)
    if (!form.title) upd('title', sanitizeTitle(f.name))
    setStep('meta')
  }

  async function handleUpload() {
    if (!form.title.trim()) {
      showToast('El título es obligatorio', 'error')
      return
    }
    if (!file && !form.external_url.trim()) {
      showToast('Selecciona un archivo o ingresa una URL externa', 'error')
      return
    }

    setStep('uploading')
    setProgress(10)

    let file_url   = null
    let file_path  = null
    let uploadFile = file  // may be replaced by WebP-converted version

    if (file) {
      // ── Convert images to WebP for optimal storage & display ──
      uploadFile = file
      let uploadMime = file.type
      let uploadExt  = file.name.split('.').pop().toLowerCase()
      const isConvertible = file.type.startsWith('image/') && file.type !== 'image/webp'
      if (isConvertible) {
        try {
          const bmp = await createImageBitmap(file)
          const canvas = document.createElement('canvas')
          canvas.width  = bmp.width
          canvas.height = bmp.height
          canvas.getContext('2d').drawImage(bmp, 0, 0)
          bmp.close()
          const webpBlob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.85))
          uploadFile = new File([webpBlob], file.name.replace(/\.\w+$/, '.webp'), { type: 'image/webp' })
          uploadMime = 'image/webp'
          uploadExt  = 'webp'
        } catch {
          // conversion failed — upload original silently
        }
      }

      const docId   = crypto.randomUUID()
      const pathDir = visibility === 'school'
        ? `${teacher.school_id}/inst/${docId}`
        : `${teacher.school_id}/personal/${teacher.id}/${docId}`
      // Sanitize filename: remove special chars that cause Storage 400 errors
      const safeName = uploadFile.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/[^a-zA-Z0-9._-]/g, '_') // replace unsafe chars with underscore
        .replace(/_+/g, '_') // collapse multiple underscores
      const path = `${pathDir}/${safeName}`

      setProgress(30)

      // Archivos grandes (>50MB): usar createSignedUploadUrl + XHR para progreso real
      // y evitar timeout del método upload() estándar.
      const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024 // 50 MB
      let upErr = null

      if (uploadFile.size > LARGE_FILE_THRESHOLD) {
        // 1. Obtener URL firmada para upload directo
        const { data: signedData, error: signErr } = await supabase.storage
          .from('cbf-library')
          .createSignedUploadUrl(path)

        if (signErr) {
          upErr = signErr
        } else {
          // 2. Subir con XHR para trackear progreso y evitar timeout
          const uploadResult = await new Promise((resolve) => {
            const xhr = new XMLHttpRequest()
            xhr.open('PUT', signedData.signedUrl, true)
            xhr.setRequestHeader('Content-Type', uploadMime)
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.round(30 + (e.loaded / e.total) * 40)
                setProgress(pct)
              }
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve({ error: null })
              else resolve({ error: { message: `Upload failed: HTTP ${xhr.status}` } })
            }
            xhr.onerror = () => resolve({ error: { message: 'Error de red durante la subida. Verifica tu conexión.' } })
            xhr.ontimeout = () => resolve({ error: { message: 'Tiempo agotado. El archivo es muy grande para tu conexión actual.' } })
            xhr.timeout = 600000 // 10 minutos
            xhr.send(uploadFile)
          })
          upErr = uploadResult.error
        }
      } else {
        // Archivos pequeños: método estándar
        const result = await supabase.storage
          .from('cbf-library')
          .upload(path, uploadFile, { contentType: uploadMime, upsert: false })
        upErr = result.error
      }

      if (upErr) {
        showToast(`Error al subir: ${upErr.message}`, 'error')
        setStep('meta')
        return
      }

      setProgress(70)

      const { data: urlData } = supabase.storage
        .from('cbf-library')
        .getPublicUrl(path)

      file_url  = urlData.publicUrl
      file_path = path
    }

    setProgress(85)

    const row = {
      school_id:    teacher.school_id,
      teacher_id:   teacher.id,
      title:        form.title.trim(),
      description:  form.description.trim() || null,
      doc_type:     form.doc_type,
      subjects:     form.subjects,
      grades:       form.grades,
      visibility,
      file_url,
      file_path,
      file_name:    uploadFile?.name || null,
      file_size:    uploadFile?.size || null,
      file_mime:    uploadFile?.type || null,
      external_url: form.external_url.trim() || null,
      metadata: {
        author:    form.author.trim()    || null,
        year:      form.year.trim()      || null,
        publisher: form.publisher.trim() || null,
        isbn:      form.isbn.trim()      || null,
      },
    }

    const { data: inserted, error: dbErr } = await supabase
      .from('school_library')
      .insert(row)
      .select()
      .single()

    if (dbErr) {
      if (file_path) await supabase.storage.from('cbf-library').remove([file_path])
      logError(dbErr, { page: 'LibraryPage', action: 'handleUpload' })
      showToast(`Error al guardar: ${dbErr.message}`, 'error')
      setStep('meta')
      return
    }

    logActivity('create', 'school_library', inserted?.id || null, `Documento subido: "${form.title}" (${visibility})`)
    setProgress(100)
    showToast('Documento subido exitosamente', 'success')
    onUploaded(inserted)
    onClose()
  }

  const isExternalOnly = !file && !!form.external_url.trim()

  return createPortal(
    <div className="lib-modal-overlay">
      <div className="lib-modal">

        <div className="lib-modal-header"
          style={{ background: visibility === 'school'
            ? 'linear-gradient(135deg,#1F3864,#2E5598)'
            : 'linear-gradient(135deg,#1A6B3A,#2D8A50)' }}>
          <span>
            {visibility === 'school'
              ? '🏫 Subir a Biblioteca Institucional'
              : '👤 Subir a Mi Biblioteca'}
          </span>
          <button className="lib-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {step === 'pick' && (
          <div className="lib-modal-body">
            <div className="lib-upload-zone" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept={ACCEPT}
                style={{ display: 'none' }} onChange={handleFileChange} />
              <div className="lib-upload-icon">📂</div>
              <p className="lib-upload-main">Clic o arrastra un archivo aquí</p>
              <div className="lib-upload-types">
                <span>📄 PDF</span>
                <span>🖼 Imágenes</span>
                <span>🎬 Video</span>
                <span>🎵 Audio</span>
                <span>🎹 MIDI</span>
              </div>
              <div className="lib-upload-limits">
                PDF hasta 500 MB · Video hasta 1 GB · Audio hasta 200 MB
              </div>
            </div>

            <div className="lib-upload-divider">
              <span>o ingresa una URL externa</span>
            </div>

            <input type="url"
              placeholder="https://recurso.externo/documento"
              value={form.external_url}
              onChange={e => upd('external_url', e.target.value)}
              className="lib-input" />

            {isExternalOnly && (
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <button className="lib-btn-primary" onClick={() => {
                  if (!form.title) upd('title', 'Recurso externo')
                  setStep('meta')
                }}>
                  Continuar →
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'meta' && (
          <div className="lib-modal-body lib-meta-form">
            <DocMetaForm form={form} upd={upd} file={file} showFilePill />

            <div className="lib-modal-footer">
              <button type="button" className="lib-btn-ghost"
                onClick={() => setStep('pick')}>
                ← Atrás
              </button>
              <button type="button" className="lib-btn-primary" onClick={handleUpload}>
                ⬆ Subir documento
              </button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
          <div className="lib-modal-body lib-uploading">
            <div className="lib-progress-track">
              <div className="lib-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="lib-uploading-status">
              {progress < 60
                ? '⬆ Subiendo archivo…'
                : progress < 85
                  ? '💾 Guardando en biblioteca…'
                  : '✅ Casi listo…'}
            </p>
            {file && (
              <p className="lib-uploading-size">{file.name} · {fmtBytes(file.size)}</p>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// EDIT MODAL
// =============================================================================

function EditModal({ doc, teacher, onClose, onSaved }) {
  const { showToast } = useToast()
  const fileRef = useRef()

  const [step, setStep]         = useState('meta')
  const [newFile, setNewFile]   = useState(null)
  const [progress, setProgress] = useState(0)
  const [form, setForm]         = useState({
    title:        doc.title || '',
    description:  doc.description || '',
    doc_type:     doc.doc_type || 'other',
    subjects:     doc.subjects || [],
    grades:       doc.grades || [],
    author:       doc.metadata?.author || '',
    year:         doc.metadata?.year || '',
    publisher:    doc.metadata?.publisher || '',
    isbn:         doc.metadata?.isbn || '',
    external_url: doc.external_url || '',
    // Internal — for the file pill display
    _existingName: doc.file_name || '',
    _existingSize: doc.file_size || 0,
  })

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    const cat     = getMimeCategory(f.type)
    const limitMB = MAX_FILE_MB[cat] ?? MAX_FILE_MB.other
    if (f.size > limitMB * 1024 * 1024) {
      showToast(`Archivo demasiado grande. Límite: ${limitMB} MB`, 'error')
      return
    }
    setNewFile(f)
  }

  async function handleSave() {
    if (!form.title.trim()) {
      showToast('El título es obligatorio', 'error')
      return
    }

    setStep('saving')
    setProgress(10)

    let file_url  = doc.file_url
    let file_path = doc.file_path
    let file_name = doc.file_name
    let file_size = doc.file_size
    let file_mime = doc.file_mime

    if (newFile) {
      const pathDir = doc.visibility === 'school'
        ? `${teacher.school_id}/inst/${doc.id}`
        : `${teacher.school_id}/personal/${teacher.id}/${doc.id}`
      const safeName = newFile.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
      const path = `${pathDir}/${safeName}`

      setProgress(30)

      const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024
      let upErr = null

      if (newFile.size > LARGE_FILE_THRESHOLD) {
        const { data: signedData, error: signErr } = await supabase.storage
          .from('cbf-library')
          .createSignedUploadUrl(path)
        if (signErr) {
          upErr = signErr
        } else {
          const uploadResult = await new Promise((resolve) => {
            const xhr = new XMLHttpRequest()
            xhr.open('PUT', signedData.signedUrl, true)
            xhr.setRequestHeader('Content-Type', newFile.type)
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) setProgress(Math.round(30 + (e.loaded / e.total) * 30))
            }
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve({ error: null })
              else resolve({ error: { message: `Upload failed: HTTP ${xhr.status}` } })
            }
            xhr.onerror = () => resolve({ error: { message: 'Error de red durante la subida.' } })
            xhr.timeout = 600000
            xhr.ontimeout = () => resolve({ error: { message: 'Tiempo agotado subiendo el archivo.' } })
            xhr.send(newFile)
          })
          upErr = uploadResult.error
        }
      } else {
        const result = await supabase.storage
          .from('cbf-library')
          .upload(path, newFile, { contentType: newFile.type, upsert: true })
        upErr = result.error
      }

      if (upErr) {
        showToast(`Error al subir: ${upErr.message}`, 'error')
        setStep('meta')
        return
      }

      setProgress(60)

      const { data: urlData } = supabase.storage
        .from('cbf-library')
        .getPublicUrl(path)

      if (doc.file_path && doc.file_path !== path) {
        await supabase.storage.from('cbf-library').remove([doc.file_path])
      }

      file_url  = urlData.publicUrl
      file_path = path
      file_name = newFile.name
      file_size = newFile.size
      file_mime = newFile.type
    }

    setProgress(80)

    const { data: updated, error } = await supabase
      .from('school_library')
      .update({
        title:        form.title.trim(),
        description:  form.description.trim() || null,
        doc_type:     form.doc_type,
        subjects:     form.subjects,
        grades:       form.grades,
        external_url: form.external_url.trim() || null,
        file_url,
        file_path,
        file_name,
        file_size,
        file_mime,
        metadata: {
          author:    form.author.trim()    || null,
          year:      form.year.trim()      || null,
          publisher: form.publisher.trim() || null,
          isbn:      form.isbn.trim()      || null,
        },
      })
      .eq('id', doc.id)
      .select()
      .single()

    if (error) {
      logError(error, { page: 'LibraryPage', action: 'handleEdit', entityId: doc.id })
      showToast(`Error al guardar: ${error.message}`, 'error')
      setStep('meta')
      return
    }

    logActivity('update', 'school_library', doc.id, `Documento editado: "${form.title}"`)
    setProgress(100)
    showToast('Documento actualizado', 'success')
    onSaved(updated)
    onClose()
  }

  return createPortal(
    <div className="lib-modal-overlay">
      <div className="lib-modal">
        <div className="lib-modal-header"
          style={{ background: doc.visibility === 'school'
            ? 'linear-gradient(135deg,#1F3864,#2E5598)'
            : 'linear-gradient(135deg,#1A6B3A,#2D8A50)' }}>
          <span>✎ Editar documento</span>
          <button className="lib-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        {step === 'meta' && (
          <div className="lib-modal-body lib-meta-form">
            {doc.file_name && (
              <div className="lib-file-pill">
                <span>📎</span>
                <span className="lib-file-pill-name">{doc.file_name}</span>
                <span className="lib-file-pill-size">{fmtBytes(doc.file_size)}</span>
                {newFile
                  ? <span className="lib-file-pill-new">→ {newFile.name}</span>
                  : <button type="button"
                      className="lib-btn-ghost"
                      style={{ fontSize: 11, padding: '2px 8px', marginLeft: 6 }}
                      onClick={() => fileRef.current?.click()}>
                      Reemplazar
                    </button>
                }
                <input ref={fileRef} type="file" accept={ACCEPT}
                  style={{ display: 'none' }} onChange={handleFileChange} />
              </div>
            )}

            <DocMetaForm form={form} upd={upd} />

            <div className="lib-modal-footer">
              <button type="button" className="lib-btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="lib-btn-primary" onClick={handleSave}>
                💾 Guardar cambios
              </button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="lib-modal-body lib-uploading">
            <div className="lib-progress-track">
              <div className="lib-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="lib-uploading-status">
              {progress < 60 ? '⬆ Subiendo archivo…' : '💾 Guardando cambios…'}
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// SHARE MODAL
// =============================================================================

function ShareModal({ doc, teacher, teachersMap, onClose }) {
  const { showToast } = useToast()
  const [shares,     setShares]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [addingId,   setAddingId]   = useState('')
  const [addingEdit, setAddingEdit] = useState(false)
  const [saving,     setSaving]     = useState(false)

  const allTeachers = Object.entries(teachersMap)
    .filter(([id]) => id !== teacher.id)
    .sort((a, b) => a[1].localeCompare(b[1]))

  async function fetchShares() {
    setLoading(true)
    const { data } = await supabase
      .from('library_shares')
      .select('*')
      .eq('doc_id', doc.id)
    setShares(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchShares() }, [])

  async function handleAdd() {
    if (!addingId) { showToast('Selecciona un docente', 'warning'); return }
    if (shares.find(s => s.shared_with === addingId)) {
      showToast('Ya se compartió con este docente', 'warning'); return
    }
    setSaving(true)
    const { error } = await supabase.from('library_shares').insert({
      doc_id:      doc.id,
      shared_by:   teacher.id,
      shared_with: addingId,
      can_edit:    addingEdit,
    })
    if (error) { logError(error, { page: 'LibraryPage', action: 'handleShare', entityId: doc.id }); showToast(`Error: ${error.message}`, 'error') }
    else {
      logActivity('create', 'library_shares', doc.id, `Documento compartido con docente ${addingId}`)
      showToast('Compartido exitosamente', 'success')
      setAddingId('')
      setAddingEdit(false)
    }
    setSaving(false)
    fetchShares()
  }

  async function handleToggleEdit(share) {
    await supabase.from('library_shares')
      .update({ can_edit: !share.can_edit })
      .eq('id', share.id)
    fetchShares()
  }

  async function handleRevoke(share) {
    const { error } = await supabase.from('library_shares').delete().eq('id', share.id)
    if (error) { logError(error, { page: 'LibraryPage', action: 'handleRevoke', entityId: share.id }); showToast(`Error: ${error.message}`, 'error') }
    else { logActivity('delete', 'library_shares', share.id, `Acceso revocado del doc ${doc.id}`); showToast('Acceso revocado', 'success') }
    fetchShares()
  }

  const sharedIds         = shares.map(s => s.shared_with)
  const availableTeachers = allTeachers.filter(([id]) => !sharedIds.includes(id))

  return createPortal(
    <div className="lib-modal-overlay">
      <div className="lib-modal lib-share-modal">
        <div className="lib-modal-header"
          style={{ background: 'linear-gradient(135deg,#44537A,#5C6F9E)' }}>
          <span>🔗 Compartir — {doc.title}</span>
          <button className="lib-modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="lib-modal-body">

          <label className="lib-label">Compartir con un docente</label>
          <div className="lib-share-add-row">
            <select className="lib-input lib-share-select"
              value={addingId}
              onChange={e => setAddingId(e.target.value)}>
              <option value="">Seleccionar docente…</option>
              {availableTeachers.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <label className="lib-share-edit-check">
              <input type="checkbox"
                checked={addingEdit}
                onChange={e => setAddingEdit(e.target.checked)} />
              Puede editar
            </label>
            <button className="lib-btn-primary"
              disabled={!addingId || saving}
              onClick={handleAdd}>
              + Compartir
            </button>
          </div>

          {/* Current shares */}
          <div className="lib-share-list">
            <div className="lib-label" style={{ marginBottom: 8 }}>
              {shares.length > 0
                ? `Compartido con ${shares.length} docente${shares.length !== 1 ? 's' : ''}`
                : 'Sin accesos compartidos aún'}
            </div>
            {loading ? (
              <p className="lib-share-empty">Cargando…</p>
            ) : shares.length === 0 ? (
              <p className="lib-share-empty">
                Este documento no se ha compartido con nadie. Usa el formulario de arriba para compartirlo.
              </p>
            ) : (
              shares.map(s => (
                <div key={s.id} className="lib-share-row">
                  <span className="lib-share-name">
                    👤 {teachersMap[s.shared_with] || 'Docente desconocido'}
                  </span>
                  <span className={`lib-share-perm ${s.can_edit ? 'edit' : 'read'}`}>
                    {s.can_edit ? '✏ Edición' : '👁 Lectura'}
                  </span>
                  <div className="lib-share-actions">
                    <button className="lib-card-action-btn"
                      onClick={() => handleToggleEdit(s)}>
                      {s.can_edit ? '→ Solo lectura' : '→ Edición'}
                    </button>
                    <button className="lib-card-action-btn lib-share-revoke"
                      onClick={() => handleRevoke(s)}>
                      ✕ Revocar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="lib-modal-footer">
            <button type="button" className="lib-btn-ghost" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// HISTORY DRAWER
// =============================================================================

function HistoryDrawer({ doc, teachersMap, onClose, onRollback }) {
  const { showToast } = useToast()
  const [log,       setLog]       = useState([])
  const [loading,   setLoading]   = useState(true)
  const [confirmId, setConfirmId] = useState(null)
  const [rolling,   setRolling]   = useState(false)

  useEffect(() => {
    supabase
      .from('library_edit_log')
      .select('*')
      .eq('doc_id', doc.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLog(data || [])
        setLoading(false)
      })
  }, [])

  async function handleRollback(entry) {
    setRolling(true)
    const { error } = await supabase.rpc('library_rollback', { p_log_id: entry.id })
    setRolling(false)
    setConfirmId(null)
    if (error) {
      logError(error, { page: 'LibraryPage', action: 'handleRollback', entityId: doc.id })
      showToast(`Error al restaurar: ${error.message}`, 'error')
    } else {
      logActivity('update', 'school_library', doc.id, `Rollback del documento al estado anterior (log ${entry.id})`)
      showToast('Documento restaurado al estado anterior', 'success')
      onRollback()
      onClose()
    }
  }

  return createPortal(
    <div className="lib-drawer-overlay" onClick={onClose}>
      <div className="lib-drawer" onClick={e => e.stopPropagation()}>

        <div className="lib-drawer-header">
          <div>
            <div className="lib-drawer-title">🕐 Historial de edición</div>
            <div className="lib-drawer-subtitle">{doc.title}</div>
          </div>
          <button className="lib-viewer-close" onClick={onClose}>✕</button>
        </div>

        <div className="lib-drawer-body">
          {loading ? (
            <div className="lib-loading">
              <div className="lib-loading-spinner" />
              Cargando historial…
            </div>
          ) : log.length === 0 ? (
            <p className="lib-share-empty" style={{ padding: '20px 0' }}>
              Sin historial de edición registrado.
            </p>
          ) : (
            log.map((entry, i) => {
              const badge       = ACTION_BADGE[entry.action] || { label: entry.action, color: '#718096' }
              const editorName  = entry.editor_id
                ? (teachersMap[entry.editor_id] || 'Docente')
                : 'Sistema'
              const isConfirm   = confirmId === entry.id
              const canRollback = !!entry.old_snapshot && entry.action !== 'created'

              return (
                <div key={entry.id}
                  className={`lib-history-entry ${i === 0 ? 'lib-history-entry-latest' : ''}`}>

                  <div className="lib-history-entry-top">
                    <span className="lib-action-badge"
                      style={{
                        background:   badge.color + '20',
                        color:        badge.color,
                        borderColor:  badge.color + '40',
                      }}>
                      {badge.label}
                    </span>
                    <span className="lib-history-date">{fmtDate(entry.created_at)}</span>
                  </div>

                  <div className="lib-history-editor">👤 {editorName}</div>

                  {entry.change_summary && (
                    <div className="lib-history-summary">{entry.change_summary}</div>
                  )}

                  {canRollback && !isConfirm && (
                    <button className="lib-history-rollback-btn"
                      onClick={() => setConfirmId(entry.id)}>
                      ↩ Restaurar a este estado
                    </button>
                  )}

                  {isConfirm && (
                    <div className="lib-history-confirm">
                      <span>¿Confirmar restauración?</span>
                      <div className="lib-history-confirm-btns">
                        <button className="lib-btn-ghost"
                          onClick={() => setConfirmId(null)}>
                          Cancelar
                        </button>
                        <button className="lib-btn-primary"
                          style={{ background: 'linear-gradient(135deg,#8064A2,#A08BC4)' }}
                          disabled={rolling}
                          onClick={() => handleRollback(entry)}>
                          {rolling ? 'Restaurando…' : '↩ Sí, restaurar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// DELETE CONFIRM MODAL
// =============================================================================

function DeleteConfirmModal({ doc, onConfirm, onCancel }) {
  return createPortal(
    <div className="lib-modal-overlay" style={{ zIndex: 1100 }}>
      <div className="lib-modal lib-modal-sm">
        <div className="lib-modal-header"
          style={{ background: 'linear-gradient(135deg,#991B1B,#C0504D)' }}>
          <span>🗑 Eliminar documento</span>
          <button className="lib-modal-close-btn" onClick={onCancel}>✕</button>
        </div>
        <div className="lib-modal-body" style={{ padding: '20px 24px' }}>
          <p style={{ marginBottom: 8 }}>
            ¿Eliminar <strong>"{doc.title}"</strong>?
          </p>
          <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
            Esta acción eliminará el archivo de Storage y no se puede deshacer.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="lib-btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button"
              className="lib-btn-primary"
              style={{ background: 'linear-gradient(135deg,#991B1B,#C0504D)' }}
              onClick={onConfirm}>
              Sí, eliminar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function LibraryPage({ teacher }) {
  const { showToast } = useToast()
  const { features }  = useFeatures()
  const isAdmin       = canManage(teacher.role)
  const quotaGB       = features.library_quota_gb || 2

  // 'school' | 'personal' | 'oversight' (admin only)
  const [tab,           setTab]           = useState('school')
  const [docs,          setDocs]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [filterType,    setFilterType]    = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [usedBytes,     setUsedBytes]     = useState(0)
  const [viewingDoc,    setViewingDoc]    = useState(null)
  const [showUpload,    setShowUpload]    = useState(false)
  const [editingDoc,    setEditingDoc]    = useState(null)
  const [sharingDoc,    setSharingDoc]    = useState(null)
  const [historyDoc,    setHistoryDoc]    = useState(null)
  const [confirmDel,    setConfirmDel]    = useState(null)
  // id → full_name map for sharing/history/oversight
  const [teachersMap, setTeachersMap]     = useState({})

  // ── Fetch teacher list (admin only) ───────────────────────────
  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('teachers')
      .select('id,full_name')
      .eq('school_id', teacher.school_id)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(t => { map[t.id] = t.full_name })
        setTeachersMap(map)
      })
  }, [])

  // ── Fetch docs ────────────────────────────────────────────────
  async function fetchDocs() {
    setLoading(true)
    let q = supabase
      .from('school_library')
      .select('*')
      .order('created_at', { ascending: false })

    if (tab === 'school') {
      q = q.eq('visibility', 'school').eq('school_id', teacher.school_id)
    } else if (tab === 'personal') {
      q = q.eq('visibility', 'personal').eq('teacher_id', teacher.id)
    } else {
      // oversight — admin oversight RLS policy handles access
      q = q.eq('visibility', 'personal').eq('school_id', teacher.school_id)
    }

    const { data, error } = await q.limit(200)
    if (error) showToast('Error cargando documentos', 'error')
    setDocs(data || [])
    setLoading(false)
  }

  // ── Quota ─────────────────────────────────────────────────────
  async function fetchQuota() {
    const { data } = await supabase
      .from('school_library')
      .select('file_size')
      .eq('teacher_id', teacher.id)
      .eq('visibility', 'personal')
    const total = (data || []).reduce((acc, r) => acc + (r.file_size || 0), 0)
    setUsedBytes(total)
  }

  useEffect(() => { fetchDocs() }, [tab])
  useEffect(() => { fetchQuota() }, [])

  // ── Delete ────────────────────────────────────────────────────
  async function handleDeleteConfirmed() {
    const doc = confirmDel
    setConfirmDel(null)
    if (doc.file_path) {
      await supabase.storage.from('cbf-library').remove([doc.file_path])
    }
    const { error } = await supabase.from('school_library').delete().eq('id', doc.id)
    if (error) { logError(error, { page: 'LibraryPage', action: 'handleDelete', entityId: doc.id }); showToast('Error al eliminar', 'error'); return }
    logActivity('delete', 'school_library', doc.id, `Documento eliminado: "${doc.title}"`)
    showToast('Documento eliminado', 'success')
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    if (doc.visibility === 'personal') fetchQuota()
  }

  // ── Edit saved ────────────────────────────────────────────────
  function handleDocSaved(updated) {
    setDocs(prev => prev.map(d => d.id === updated.id ? updated : d))
    if (updated.visibility === 'personal') fetchQuota()
  }

  // ── Upload ────────────────────────────────────────────────────
  function handleUploaded(newDoc) {
    if (newDoc.visibility === tab || (tab === 'oversight' && newDoc.visibility === 'personal')) {
      setDocs(prev => [newDoc, ...prev])
    }
    if (newDoc.visibility === 'personal') fetchQuota()
  }

  // ── Permissions ───────────────────────────────────────────────
  function canDeleteDoc(doc) { return doc.teacher_id === teacher.id || isAdmin }
  function canEditDoc(doc)   { return doc.teacher_id === teacher.id || isAdmin }
  function canShareDoc(doc)  { return doc.teacher_id === teacher.id || isAdmin }

  // ── Filter ────────────────────────────────────────────────────
  const filtered = docs.filter(d => {
    const q = search.toLowerCase()
    if (q && !d.title.toLowerCase().includes(q) &&
        !(d.description || '').toLowerCase().includes(q) &&
        !(d.metadata?.author || '').toLowerCase().includes(q)) return false
    if (filterType    && d.doc_type !== filterType) return false
    if (filterSubject && !d.subjects?.includes(filterSubject)) return false
    return true
  })

  const allSubjects = [...new Set(docs.flatMap(d => d.subjects || []))].sort()
  const canUpload   = tab === 'personal' || (tab === 'school' && isAdmin)

  function switchTab(newTab) {
    setTab(newTab)
    setSearch('')
    setFilterType('')
    setFilterSubject('')
  }

  return (
    <div className="lib-page">

      {/* ── PAGE HEADER ── */}
      <div className="lib-page-header">
        <div className="lib-page-header-top">
          <div>
            <h1 className="lib-page-title">📚 Biblioteca CBF</h1>
            <p className="lib-page-subtitle">
              Material pedagógico institucional y espacio personal de cada docente
            </p>
          </div>
          {canUpload && (
            <button className="lib-btn-primary lib-btn-upload"
              onClick={() => setShowUpload(true)}>
              + Subir documento
            </button>
          )}
        </div>

        <div className="lib-tabs">
          <button className={`lib-tab ${tab === 'school' ? 'active' : ''}`}
            onClick={() => switchTab('school')}>
            🏫 Institucional
          </button>
          <button className={`lib-tab ${tab === 'personal' ? 'active' : ''}`}
            onClick={() => switchTab('personal')}>
            👤 Mi Biblioteca
          </button>
          {isAdmin && (
            <button className={`lib-tab lib-tab-oversight ${tab === 'oversight' ? 'active' : ''}`}
              onClick={() => switchTab('oversight')}>
              👁 Supervisión
            </button>
          )}
        </div>
      </div>

      {/* ── QUOTA (personal only) ── */}
      {tab === 'personal' && (
        <QuotaMeter usedBytes={usedBytes} quotaGB={quotaGB} />
      )}

      {/* ── INFO BANNERS ── */}
      {tab === 'school' && !isAdmin && (
        <div className="lib-inst-info">
          📋 Los documentos institucionales son gestionados por el Coordinador o Rector.
          Cualquier docente puede consultarlos y usarlos en sus guías.
        </div>
      )}
      {tab === 'oversight' && (
        <div className="lib-inst-info lib-oversight-info">
          👁 Supervisión institucional — documentos personales de todos los docentes del colegio.
          Esta vista es exclusiva para Coordinadores y Rectores. Los docentes no saben que sus documentos son visibles aquí.
        </div>
      )}

      {/* ── TOOLBAR ── */}
      <div className="lib-toolbar">
        <input className="lib-search"
          placeholder="🔍 Buscar por título, descripción o autor…"
          value={search}
          onChange={e => setSearch(e.target.value)} />
        <select className="lib-select" value={filterType}
          onChange={e => setFilterType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {Object.entries(DOC_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        {allSubjects.length > 0 && (
          <select className="lib-select" value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}>
            <option value="">Todas las materias</option>
            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {(search || filterType || filterSubject) && (
          <button className="lib-btn-ghost" onClick={() => {
            setSearch(''); setFilterType(''); setFilterSubject('')
          }}>✕ Limpiar</button>
        )}
      </div>

      {/* ── RESULTS COUNT ── */}
      {!loading && docs.length > 0 && (
        <div className="lib-results-count">
          {filtered.length === docs.length
            ? `${docs.length} documento${docs.length !== 1 ? 's' : ''}`
            : `${filtered.length} de ${docs.length} documentos`}
        </div>
      )}

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="lib-loading">
          <div className="lib-loading-spinner" />
          Cargando documentos…
        </div>
      ) : filtered.length === 0 && docs.length === 0 ? (
        <div className="lib-empty">
          <div className="lib-empty-icon">
            {tab === 'school' ? '🏫' : tab === 'oversight' ? '👁' : '👤'}
          </div>
          <h3 className="lib-empty-title">
            {tab === 'school'
              ? 'Biblioteca institucional vacía'
              : tab === 'oversight'
                ? 'Ningún docente ha subido documentos personales'
                : 'Tu biblioteca personal está vacía'}
          </h3>
          <p className="lib-empty-desc">
            {tab === 'school'
              ? 'El Coordinador o Rector puede subir libros de texto, investigaciones y material que todos los docentes podrán consultar.'
              : tab === 'oversight'
                ? 'Los docentes podrán subir sus materiales — investigaciones, tesis, recursos y grabaciones propias.'
                : 'Sube tus documentos personales: investigaciones, tesis, recursos propios, grabaciones. Solo tú los verás.'}
          </p>
          {canUpload && (
            <button className="lib-btn-primary" onClick={() => setShowUpload(true)}>
              + Subir primer documento
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="lib-empty">
          <div className="lib-empty-icon">🔍</div>
          <p className="lib-empty-desc">No se encontraron documentos con esos filtros.</p>
          <button className="lib-btn-ghost" onClick={() => {
            setSearch(''); setFilterType(''); setFilterSubject('')
          }}>Limpiar filtros</button>
        </div>
      ) : (
        <div className="lib-grid">
          {filtered.map(doc => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onView={setViewingDoc}
              onDelete={setConfirmDel}
              onEdit={setEditingDoc}
              onShare={setSharingDoc}
              onHistory={setHistoryDoc}
              canDelete={canDeleteDoc(doc)}
              canEditDoc={canEditDoc(doc)}
              canShare={canShareDoc(doc)}
              ownerName={tab === 'oversight' ? teachersMap[doc.teacher_id] : null}
            />
          ))}
        </div>
      )}

      {/* ── MODALS & DRAWER ── */}
      {viewingDoc && (
        <DocumentViewer doc={viewingDoc} teacher={teacher} onClose={() => setViewingDoc(null)} />
      )}

      {showUpload && (
        <UploadModal
          visibility={tab === 'oversight' ? 'personal' : tab}
          teacher={teacher}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {editingDoc && (
        <EditModal
          doc={editingDoc}
          teacher={teacher}
          onClose={() => setEditingDoc(null)}
          onSaved={handleDocSaved}
        />
      )}

      {sharingDoc && (
        <ShareModal
          doc={sharingDoc}
          teacher={teacher}
          teachersMap={teachersMap}
          onClose={() => setSharingDoc(null)}
        />
      )}

      {historyDoc && (
        <HistoryDrawer
          doc={historyDoc}
          teachersMap={teachersMap}
          onClose={() => setHistoryDoc(null)}
          onRollback={fetchDocs}
        />
      )}

      {confirmDel && (
        <DeleteConfirmModal
          doc={confirmDel}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  )
}
