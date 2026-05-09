import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { useFeatures } from '../context/FeaturesContext'
import { canManage } from '../utils/roles'

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

const MAX_FILE_MB = { pdf: 200, image: 100, video: 1000, audio: 200, midi: 10, other: 100 }

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
// DOCUMENT VIEWER — visor universal
// =============================================================================

function DocumentViewer({ doc, onClose }) {
  const cat  = getMimeCategory(doc.file_mime)
  const type = DOC_TYPES[doc.doc_type] || DOC_TYPES.other

  return createPortal(
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
            {(doc.file_url || doc.external_url) && (
              <a
                href={doc.file_url || doc.external_url}
                download={doc.file_name || undefined}
                target="_blank"
                rel="noreferrer"
                className="lib-viewer-dl"
                onClick={e => e.stopPropagation()}>
                ⬇ Descargar
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
            <iframe
              src={doc.file_url}
              title={doc.title}
              className="lib-viewer-iframe"
            />
          )}

          {doc.file_url && cat === 'image' && (
            <div className="lib-viewer-image-wrap">
              <img
                src={doc.file_url}
                alt={doc.title}
                className="lib-viewer-image"
                draggable={false}
              />
            </div>
          )}

          {doc.file_url && cat === 'video' && (
            <div className="lib-viewer-video-wrap">
              <video src={doc.file_url} controls className="lib-viewer-video">
                Tu navegador no soporta reproducción de video.
              </video>
            </div>
          )}

          {doc.file_url && cat === 'audio' && (
            <div className="lib-viewer-audio-wrap">
              <div className="lib-viewer-audio-art">🎵</div>
              <p className="lib-viewer-audio-title">{doc.title}</p>
              {doc.metadata?.author && (
                <p className="lib-viewer-audio-artist">✍️ {doc.metadata.author}</p>
              )}
              <audio src={doc.file_url} controls className="lib-viewer-audio" />
            </div>
          )}

          {doc.file_url && cat === 'midi' && (
            <div className="lib-viewer-midi-wrap">
              <div className="lib-viewer-midi-icon">🎹</div>
              <p className="lib-viewer-midi-title">{doc.title}</p>
              <p className="lib-viewer-midi-note">
                Archivo MIDI — descárgalo para reproducirlo en tu DAW o software musical.
              </p>
              <p className="lib-viewer-midi-coming">
                🚧 Reproductor MIDI en el navegador disponible próximamente
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

    let file_url  = null
    let file_path = null

    if (file) {
      const docId   = crypto.randomUUID()
      const pathDir = visibility === 'school'
        ? `${teacher.school_id}/inst/${docId}`
        : `${teacher.school_id}/personal/${teacher.id}/${docId}`
      const path = `${pathDir}/${file.name}`

      setProgress(30)

      const { error: upErr } = await supabase.storage
        .from('cbf-library')
        .upload(path, file, { contentType: file.type, upsert: false })

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
      file_name:    file?.name    || null,
      file_size:    file?.size    || null,
      file_mime:    file?.type    || null,
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
      showToast(`Error al guardar: ${dbErr.message}`, 'error')
      setStep('meta')
      return
    }

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
                PDF hasta 200 MB · Video hasta 1 GB · Audio hasta 200 MB
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
      const path = `${pathDir}/${newFile.name}`

      setProgress(30)

      const { error: upErr } = await supabase.storage
        .from('cbf-library')
        .upload(path, newFile, { contentType: newFile.type, upsert: true })

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
      showToast(`Error al guardar: ${error.message}`, 'error')
      setStep('meta')
      return
    }

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
    if (error) showToast(`Error: ${error.message}`, 'error')
    else {
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
    if (error) showToast(`Error: ${error.message}`, 'error')
    else showToast('Acceso revocado', 'success')
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
      showToast(`Error al restaurar: ${error.message}`, 'error')
    } else {
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

    const { data, error } = await q
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
    if (error) { showToast('Error al eliminar', 'error'); return }
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
        <DocumentViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
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
