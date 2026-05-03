// ── ExamDashboardPage.jsx ─────────────────────────────────────────────────────
// /exams — Teacher view: list assessments, create with AI, share access codes.
// ExamCreatorModal wizard:
//   Paso 1 — Contexto pedagógico (cascada: grado→materia→período→logro→indicador→principio bíblico)
//   Paso 2 — Tipos de pregunta (11 tipos, bíblicas según preset: quiz=1, final=3)
//   Paso 3 — Revisar preguntas generadas
//   Paso 4 — Publicar

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { seededShuffle, gradeLevel as _gradeLevel, gradeColor as _gradeColor, GRADE_SCALE } from '../utils/examUtils'
import { printExamHtml } from '../utils/exportExamHtml'
import { canManage } from '../utils/roles'

// ── UI helpers ────────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function gradeColor(g) { return _gradeColor(g) }

function StatusBadge({ status }) {
  const meta = {
    draft:    { label: 'Borrador',  bg: '#FFF8E1', color: '#7A6200' },
    active:   { label: 'Activo',    bg: '#ECFDF5', color: '#065F46' },
    closed:   { label: 'Cerrado',   bg: '#F1F5F9', color: '#475569' },
    archived: { label: 'Archivado', bg: '#F5F5F5', color: '#6B7280' },
  }
  const m = meta[status] || meta.draft
  return (
    <span style={{ background: m.bg, color: m.color, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
      {m.label}
    </span>
  )
}

function CopyCode({ code }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  }
  return (
    <button type="button" onClick={copy} title="Copiar código" style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: copied ? '#ECFDF5' : '#EFF6FF',
      color: copied ? '#15803D' : '#1D4ED8',
      border: `1px solid ${copied ? '#A7F3D0' : '#BFDBFE'}`,
      borderRadius: 7, padding: '4px 10px', fontSize: 13, fontWeight: 800,
      cursor: 'pointer', letterSpacing: 1, fontFamily: 'monospace',
    }}>
      {code}
      <span style={{ fontSize: 11, fontWeight: 400, letterSpacing: 0 }}>{copied ? '✓ copiado' : '📋'}</span>
    </button>
  )
}

// ── Institutional header (same as legacy print) ───────────────────────────────
export function ExamInstitutionalHeader({ school, examInfo }) {
  const s = school || {}
  return (
    <div style={{ marginBottom: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #2E5598' }}>
        <tbody>
          <tr>
            <td style={{ width: 100, border: '1px solid #2E5598', padding: 8, textAlign: 'center' }}>
              {s.logo_url
                ? <img src={s.logo_url} style={{ maxHeight: 64, maxWidth: 84, objectFit: 'contain' }} alt="logo" />
                : <div style={{ color: '#aaa', fontSize: 10 }}>LOGO</div>
              }
            </td>
            <td style={{ border: '1px solid #2E5598', padding: '6px 10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>{s.name || 'Colegio Boston Flexible'}</div>
              {s.dane && <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>DANE: {s.dane}</div>}
              {s.process_name && <div style={{ fontSize: 11, color: '#2E5598', fontWeight: 600, marginTop: 2 }}>{s.process_name}</div>}
            </td>
            <td style={{ width: 130, border: '1px solid #2E5598', padding: 8, textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 11, color: '#1F3864' }}>{s.document_code || s.plan_code || ''}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{s.doc_version || s.plan_version || ''}</div>
            </td>
          </tr>
        </tbody>
      </table>
      {examInfo && (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd', background: '#D6E4F0', marginTop: 0 }}>
          <tbody>
            <tr>
              {Object.entries(examInfo).filter(([,v]) => v).map(([k, v]) => (
                <td key={k} style={{ padding: '5px 10px', fontSize: 11, borderRight: '1px solid #ddd' }}>
                  <strong>{k}:</strong> {v}
                </td>
              ))}
            </tr>
            <tr>
              <td colSpan={Object.keys(examInfo).length} style={{ padding: '5px 10px', fontSize: 11 }}>
                <strong>Nombre del estudiante:</strong> ___________________________________
                &nbsp;&nbsp;&nbsp;<strong>Fecha:</strong> _______________
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Question type definitions (exported for ExamCreatorPage) ─────────────────
export const ACADEMIC_TYPES = [
  { key: 'multiple_choice',  label: 'Opción múltiple',    pts: 2, icon: '🔵', color: '#4F81BD', bloom: 'Recordar/Aplicar',  hint: '4 opciones A–D' },
  { key: 'true_false',       label: 'Verdadero/Falso',    pts: 1, icon: '⚡', color: '#4BACC6', bloom: 'Recordar',          hint: 'V o F' },
  { key: 'fill_blank',       label: 'Completar espacio',  pts: 2, icon: '✏️', color: '#9BBB59', bloom: 'Aplicar',           hint: 'Completa el ___' },
  { key: 'matching',         label: 'Relacionar',         pts: 3, icon: '🔗', color: '#F79646', bloom: 'Comprender',        hint: 'Columna A ↔ B' },
  { key: 'short_answer',     label: 'Respuesta corta',    pts: 3, icon: '💬', color: '#8064A2', bloom: 'Aplicar',           hint: '2–3 oraciones' },
  { key: 'error_correction', label: 'Corregir el error',  pts: 3, icon: '🔍', color: '#C0504D', bloom: 'Analizar',          hint: 'Encuentra el error' },
  { key: 'sequencing',       label: 'Ordenar pasos',      pts: 3, icon: '🔢', color: '#70AD47', bloom: 'Comprender',        hint: '1 → 2 → 3 → 4' },
  { key: 'open_development', label: 'Desarrollo/Ensayo',  pts: 5, icon: '📝', color: '#1F3864', bloom: 'Evaluar/Crear',     hint: 'Respuesta extensa' },
]

export const BIBLICAL_TYPES = [
  { key: 'biblical_reflection',   label: 'Reflexión bíblica',   pts: 4, icon: '✝️', color: '#7B3F00', bloom: 'Aplicar',  hint: '¿Qué significa para ti?' },
  { key: 'verse_analysis',        label: 'Analizar versículo',   pts: 4, icon: '📖', color: '#6B3A8C', bloom: 'Analizar', hint: 'Significado profundo' },
  { key: 'principle_application', label: 'Aplicar principio',    pts: 4, icon: '🙏', color: '#A0522D', bloom: 'Evaluar',  hint: 'Situación de vida real' },
]

// Biblical minimums are defined per preset in examUtils.js EXAM_PRESETS (quiz=1, final=3)

// ── Rigor level metadata ──────────────────────────────────────────────────────
export const RIGOR_META = {
  strict:     { label: 'Estricto',   desc: 'El estudiante debe usar los términos exactos de la rúbrica', color: '#92400E', bg: '#FEF3C7', border: '#FCD34D' },
  flexible:   { label: 'Flexible',   desc: 'Se acepta paráfrasis que demuestre comprensión real',        color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
  conceptual: { label: 'Conceptual', desc: 'Se valida que el estudiante llegó a la idea central',         color: '#1E3A8A', bg: '#EFF6FF', border: '#93C5FD' },
}

export function TypeCard({ type, count, onChange, locked, lockReason }) {
  const active = count > 0
  return (
    <div style={{
      border: `2px solid ${active ? type.color : '#E2E8F0'}`,
      borderRadius: 10, padding: '10px 12px',
      background: active ? `${type.color}12` : '#FAFAFA',
      transition: 'all .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>{type.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: active ? type.color : '#374151' }}>{type.label}</div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{type.pts} pts · {type.bloom} · {type.hint}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button type="button"
            onClick={() => onChange(Math.max(0, count - 1))}
            disabled={locked && count <= 1}
            style={{
              width: 26, height: 26, borderRadius: 6, border: '1px solid #E2E8F0',
              background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 14,
              color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>−</button>
          <span style={{
            fontWeight: 800, fontSize: 15, minWidth: 24, textAlign: 'center',
            color: active ? type.color : '#9CA3AF',
          }}>{count}</span>
          <button type="button"
            onClick={() => onChange(count + 1)}
            style={{
              width: 26, height: 26, borderRadius: 6, border: '1px solid #E2E8F0',
              background: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 14,
              color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
        </div>
      </div>
      {lockReason && (
        <div style={{ fontSize: 10, color: '#A0522D', marginTop: 4, fontStyle: 'italic' }}>{lockReason}</div>
      )}
    </div>
  )
}

// ── ExamCreatorModal — MOVED to src/pages/ExamCreatorPage.jsx (/exams/create)

// ── ExamCreatorModal — MOVED to src/pages/ExamCreatorPage.jsx (/exams/create)

// ── ExamPreviewModal ──────────────────────────────────────────────────────────
const TYPE_LABELS = {
  multiple_choice: 'Opción múltiple', true_false: 'V / F',
  fill_blank: 'Completar', short_answer: 'Respuesta corta', matching: 'Relacionar',
}
const TYPE_COLORS = {
  multiple_choice: '#1D4ED8', true_false: '#7C3AED',
  fill_blank: '#059669', short_answer: '#D97706', matching: '#DC2626',
}

function ExamPreviewModal({ exam, onClose }) {
  const { showToast } = useToast()
  const [questions,      setQuestions]      = useState([])
  const [versions,       setVersions]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [activeVersion,  setActiveVersion]  = useState(0)
  const [editingId,      setEditingId]      = useState(null)
  const [editForm,       setEditForm]       = useState({})
  const [saving,         setSaving]         = useState(false)

  useEffect(() => {
    // Read questions from blueprint sections
    const bp = exam._blueprint
    if (bp?.sections) {
      const allQs = (bp.sections || []).flatMap(sec => sec.questions || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((q, i) => ({ ...q, id: q.id || `q-${i}` }))
      setQuestions(allQs)
    }

    // Versions from session payload
    const payload = exam._session?.service_worker_payload || exam.metadata || {}
    const vc = payload.version_count || 1
    const VERSION_LABELS = ['A', 'B', 'C', 'D']
    const vs = Array.from({ length: vc }, (_, i) => ({
      id: `v-${i}`, version_number: i + 1, version_label: `Versión ${VERSION_LABELS[i]}`,
      is_base: i === 0,
      shuffle_questions: i > 0 ? (payload.shuffle_questions ?? true) : false,
    }))
    setVersions(vs)
    setLoading(false)
  }, [exam.id])

  // Aplica shuffle de la versión seleccionada para mostrar el orden real
  const displayQuestions = useMemo(() => {
    const v = versions[activeVersion]
    if (!v || v.is_base || !v.shuffle_questions) return questions
    return seededShuffle(questions, (activeVersion + 1) * 31337)
  }, [questions, versions, activeVersion])

  function startEdit(q) {
    setEditingId(q.id)
    setEditForm({
      stem:           q.stem,
      correct_answer: q.correct_answer || '',
      points:         q.points,
      options:        q.options ? [...q.options] : [],
    })
  }

  async function saveEdit(q) {
    setSaving(true)
    const updates = {
      stem:           editForm.stem.trim(),
      correct_answer: editForm.correct_answer,
      points:         parseFloat(editForm.points) || parseFloat(q.points),
      ...(q.question_type === 'multiple_choice' && { options: editForm.options }),
    }
    // Update question in blueprint sections JSONB
    const bp = exam._blueprint
    if (bp?.id) {
      const updatedSections = (bp.sections || []).map(sec => ({
        ...sec,
        questions: (sec.questions || []).map(qq =>
          qq.id === q.id || qq.position === q.position ? { ...qq, ...updates } : qq
        ),
      }))
      const { error } = await supabase.from('exam_blueprints').update({ sections: updatedSections }).eq('id', bp.id)
      setSaving(false)
      if (error) { showToast('Error: ' + error.message, 'error'); return }
      bp.sections = updatedSections
    } else {
      setSaving(false)
    }
    setQuestions(prev => prev.map(p => (p.id === q.id || p.position === q.position) ? { ...p, ...updates } : p))
    setEditingId(null)
    showToast('Pregunta guardada', 'success')
  }

  const totalPts = questions.reduce((s, q) => s + parseFloat(q.points || 0), 0)

  return createPortal(
    <div className="lt-modal-overlay" style={{ zIndex: 10001, alignItems: 'flex-start', paddingTop: 20, paddingBottom: 20 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 800, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(0,0,0,.28)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 20px', background: '#1F3864', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 15 }}>📋 Vista previa — {exam.title}</h3>
            <p style={{ margin: '2px 0 0', color: '#93C5FD', fontSize: 12 }}>{exam.grade} · {questions.length} preguntas · {totalPts.toFixed(1)} pts</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#93C5FD', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Version tabs */}
        {versions.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginRight: 4 }}>VERSIÓN:</span>
            {versions.map((v, i) => (
              <button key={v.id} type="button" onClick={() => { setActiveVersion(i); setEditingId(null) }}
                style={{ padding: '4px 14px', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: activeVersion === i ? '#1F3864' : '#EFF6FF',
                  color: activeVersion === i ? '#fff' : '#1F3864',
                  border: `1.5px solid ${activeVersion === i ? '#1F3864' : '#BFDBFE'}` }}>
                {v.version_label}
                {!v.is_base && v.shuffle_questions && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3 }}>↕</span>}
              </button>
            ))}
            <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 4 }}>
              {versions[activeVersion]?.is_base ? 'Orden original' : 'Preguntas reordenadas (shuffle)'}
            </span>
          </div>
        )}

        {/* Questions */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Cargando preguntas…</p>}

          {!loading && displayQuestions.length === 0 && (
            <p style={{ color: '#9CA3AF' }}>Este examen no tiene preguntas registradas.</p>
          )}

          {!loading && displayQuestions.map((q, idx) => (
            <div key={q.id} style={{ marginBottom: 14, border: `1.5px solid ${editingId === q.id ? '#FCD34D' : '#E2E8F0'}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color 0.15s' }}>

              {/* Question header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#F8FAFC' }}>
                <span style={{ fontWeight: 800, color: '#1F3864', fontSize: 14, minWidth: 22 }}>{idx + 1}.</span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                  background: `${TYPE_COLORS[q.question_type] || '#6B7280'}18`,
                  color: TYPE_COLORS[q.question_type] || '#6B7280' }}>
                  {TYPE_LABELS[q.question_type] || q.question_type}
                </span>
                <span style={{ fontSize: 11, color: '#6B7280', marginLeft: 'auto' }}>{q.points} pt{parseFloat(q.points) !== 1 ? 's' : ''}</span>
                <button type="button" onClick={() => editingId === q.id ? setEditingId(null) : startEdit(q)}
                  style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: editingId === q.id ? '#FEE2E2' : '#EFF6FF',
                    color: editingId === q.id ? '#DC2626' : '#1D4ED8',
                    border: `1px solid ${editingId === q.id ? '#FCA5A5' : '#BFDBFE'}` }}>
                  {editingId === q.id ? '✕ Cancelar' : '✏ Editar'}
                </button>
              </div>

              {/* View mode */}
              {editingId !== q.id && (
                <div style={{ padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 14, color: '#111827', lineHeight: 1.6 }}>{q.stem}</p>
                  {q.options && Array.isArray(q.options) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {q.options.map((opt, oi) => {
                        const letter = String.fromCharCode(65 + oi)
                        const isCorrect = q.question_type === 'true_false'
                          ? opt === q.correct_answer
                          : letter === q.correct_answer || opt === q.correct_answer
                        return (
                          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7,
                            background: isCorrect ? '#ECFDF5' : '#F8FAFC',
                            border: `1.5px solid ${isCorrect ? '#6EE7B7' : '#E2E8F0'}` }}>
                            {isCorrect && <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>}
                            <span style={{ fontSize: 13, color: isCorrect ? '#065F46' : '#374151', fontWeight: isCorrect ? 600 : 400 }}>{opt}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {!q.options && q.correct_answer && (
                    <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 7, padding: '5px 12px', display: 'inline-block' }}>
                      <span style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>✓ {q.correct_answer}</span>
                    </div>
                  )}
                  {!q.options && !q.correct_answer && (
                    <span style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Respuesta abierta — corrección IA/manual</span>
                  )}
                </div>
              )}

              {/* Edit mode */}
              {editingId === q.id && (
                <div style={{ padding: '14px 16px', background: '#FFFBEB' }}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Enunciado</label>
                    <textarea value={editForm.stem} rows={3}
                      onChange={e => setEditForm(f => ({ ...f, stem: e.target.value }))}
                      style={{ width: '100%', padding: '8px', border: '1.5px solid #FCD34D', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  </div>

                  {q.question_type === 'multiple_choice' && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Opciones — clic en el círculo para marcar correcta</label>
                      {editForm.options.map((opt, oi) => {
                        const letter = String.fromCharCode(65 + oi)
                        const isCorrect = editForm.correct_answer === letter
                        return (
                          <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <button type="button" onClick={() => setEditForm(f => ({ ...f, correct_answer: letter }))}
                              style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                                border: `2px solid ${isCorrect ? '#059669' : '#D1D5DB'}`,
                                background: isCorrect ? '#ECFDF5' : '#fff',
                                color: isCorrect ? '#059669' : '#9CA3AF' }}>
                              {isCorrect ? '✓' : letter}
                            </button>
                            <input value={opt} onChange={e => setEditForm(f => {
                              const opts = [...f.options]; opts[oi] = e.target.value; return { ...f, options: opts }
                            })} style={{ flex: 1, padding: '6px 10px', border: '1.5px solid #FCD34D', borderRadius: 6, fontSize: 13 }} />
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {q.question_type === 'true_false' && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Respuesta correcta</label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {['Verdadero', 'Falso'].map(opt => (
                          <button key={opt} type="button" onClick={() => setEditForm(f => ({ ...f, correct_answer: opt }))}
                            style={{ padding: '6px 20px', borderRadius: 7, fontSize: 13, cursor: 'pointer',
                              border: `1.5px solid ${editForm.correct_answer === opt ? '#059669' : '#D1D5DB'}`,
                              background: editForm.correct_answer === opt ? '#ECFDF5' : '#fff',
                              color: editForm.correct_answer === opt ? '#065F46' : '#374151',
                              fontWeight: editForm.correct_answer === opt ? 700 : 400 }}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {['fill_blank', 'short_answer', 'matching'].includes(q.question_type) && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Respuesta correcta / clave</label>
                      <input value={editForm.correct_answer}
                        onChange={e => setEditForm(f => ({ ...f, correct_answer: e.target.value }))}
                        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid #FCD34D', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Puntos:</label>
                    <input type="number" min="0.5" step="0.5" value={editForm.points}
                      onChange={e => setEditForm(f => ({ ...f, points: e.target.value }))}
                      style={{ width: 70, padding: '5px 8px', border: '1.5px solid #FCD34D', borderRadius: 6, fontSize: 13 }} />
                    <button type="button" onClick={() => saveEdit(q)} disabled={saving}
                      style={{ marginLeft: 'auto', padding: '7px 20px', borderRadius: 7, background: saving ? '#9CA3AF' : '#059669', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
                      {saving ? '⏳ Guardando…' : '💾 Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>
            {totalPts.toFixed(1)} pts totales · {questions.length} preguntas
          </span>
          <button type="button" onClick={onClose}
            style={{ padding: '8px 24px', borderRadius: 8, background: '#1F3864', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Listo ✓
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── GenerarRosterModal ────────────────────────────────────────────────────────
function GenerarRosterModal({ exam, teacher, onClose, onDone }) {
  const { showToast } = useToast()
  const [roster,    setRoster]    = useState(null)   // null = loading
  const [phase,     setPhase]     = useState('confirm')  // confirm | generating | done | error
  const [progress,  setProgress]  = useState(0)
  const [result,    setResult]    = useState(null)

  useEffect(() => {
    supabase
      .from('school_students')
      .select('id, name, email, student_code, section')
      .eq('school_id', teacher.school_id)
      .eq('grade', exam.grade)
      .order('name')
      .then(({ data, error }) => {
        if (error) { showToast('Error al cargar roster: ' + error.message, 'error'); onClose(); return }
        setRoster(data || [])
      })
  }, [])

  async function handleGenerate() {
    if (!roster?.length) return
    setPhase('generating')
    setProgress(0)

    try {
      // 1. Read questions from blueprint sections
      const bp = exam._blueprint
      const questions = (bp?.sections || []).flatMap(sec => sec.questions || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
      if (!questions.length) throw new Error('Este examen no tiene preguntas.')

      // 2. Version config from session payload
      const payload = exam._session?.service_worker_payload || exam.metadata || {}
      const versionCount = payload.version_count || 1
      const shuffleQ = payload.shuffle_questions ?? true
      const shuffleO = payload.shuffle_options ?? true

      // 3. Get or create exam_session
      let sessionId = exam._session?.id
      let v2Code = exam._session?.access_code
      if (!sessionId) {
        v2Code = Math.random().toString(36).substring(2, 8).toUpperCase()
        const { data: session, error: sErr } = await supabase
          .from('exam_sessions')
          .insert({
            school_id:        teacher.school_id,
            teacher_id:       teacher.id,
            blueprint_id:     exam.id,
            title:            exam.title,
            subject:          exam.subject,
            grade:            exam.grade,
            period:           exam.period || 1,
            access_code:      v2Code,
            status:           'active',
            duration_minutes: exam.time_limit_minutes || 60,
            total_students:   roster.length,
          })
          .select('id')
          .single()
        if (sErr || !session?.id) throw new Error('Error al crear sesión: ' + (sErr?.message || 'sin ID'))
        sessionId = session.id
      } else {
        await supabase.from('exam_sessions').update({ status: 'active', total_students: roster.length }).eq('id', sessionId)
      }

      // 4. Create exam_instance per student
      const VERSION_LABELS = ['A', 'B', 'C', 'D']
      let created = 0
      let failed  = 0

      for (let i = 0; i < roster.length; i++) {
        const student  = roster[i]
        const vIdx     = i % versionCount
        const vLabel   = `Versión ${VERSION_LABELS[vIdx] || 'A'}`
        const seed     = (vIdx + 1) * 31337

        let qs = questions.map((q, idx) => ({
          id:            q.id || `q-${idx}`,
          stem:          q.stem,
          question_type: q.question_type,
          options:       q.options || null,
          correct_answer: q.correct_answer || null,
          points:        q.points || 1,
          position:      idx + 1,
          section_name:  q.section_name || '',
          biblical:      false,
          rigor_level:   q.criteria?.rigor_level || 'flexible',
        }))
        if (shuffleQ && vIdx > 0) {
          qs = seededShuffle(qs, seed)
        }

        const { error: iErr } = await supabase.from('exam_instances').insert({
          session_id:          sessionId,
          school_id:           teacher.school_id,
          student_id:          student.id,
          student_code:        student.student_code,
          student_name:        student.name,
          student_email:       student.email || null,
          student_section:     student.section || null,
          generated_questions: qs,
          version_label:       vLabel,
          instance_status:     'ready',
          delivery_mode:       'digital',
        })

        if (iErr) failed++
        else created++
        setProgress(Math.round(((i + 1) / roster.length) * 100))
      }

      setResult({ created, failed, total: roster.length, v2Code, sessionId })
      setPhase('done')
      onDone?.()
    } catch (err) {
      showToast(err.message, 'error')
      setPhase('error')
    }
  }

  return createPortal(
    <div className="lt-modal-overlay" style={{ zIndex: 10000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 480, boxShadow: '0 12px 40px rgba(0,0,0,.25)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: '#1F3864', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: '#fff', fontSize: 15 }}>👥 Generar exámenes por roster</h3>
            <p style={{ margin: '2px 0 0', color: '#93C5FD', fontSize: 12 }}>{exam.title} · {exam.grade}</p>
          </div>
          {phase !== 'generating' && (
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#93C5FD', fontSize: 20, cursor: 'pointer' }}>✕</button>
          )}
        </div>

        <div style={{ padding: 24 }}>

          {/* Cargando roster */}
          {roster === null && (
            <p style={{ color: '#888', fontStyle: 'italic' }}>Buscando estudiantes en el roster…</p>
          )}

          {/* Sin estudiantes */}
          {roster !== null && roster.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔴</div>
              <p style={{ fontWeight: 700, color: '#DC2626' }}>Sin roster para {exam.grade}</p>
              <p style={{ color: '#6B7280', fontSize: 13 }}>Carga los estudiantes primero en <strong>Mis Estudiantes</strong>.</p>
              <button type="button" onClick={onClose} style={{ marginTop: 16, padding: '8px 20px', borderRadius: 8, background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#374151', fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
            </div>
          )}

          {/* Confirmar */}
          {roster !== null && roster.length > 0 && phase === 'confirm' && (
            <>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 14, color: '#1E3A8A', fontWeight: 700 }}>
                  {roster.length} estudiante{roster.length !== 1 ? 's' : ''} en el roster
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#3B82F6' }}>
                  Se creará un examen personalizado para cada uno en ExamPlayer V2
                </p>
              </div>
              {/* Preview primeros 5 */}
              <div style={{ marginBottom: 16 }}>
                {roster.slice(0, 5).map(s => (
                  <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', fontSize: 12, borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ color: '#374151' }}>{s.name}</span>
                    <span style={{ color: '#9CA3AF' }}>{s.email || '—'}</span>
                  </div>
                ))}
                {roster.length > 5 && (
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0', fontStyle: 'italic' }}>
                    …y {roster.length - 5} más
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#F1F5F9', border: '1px solid #CBD5E1', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleGenerate} style={{ flex: 2, padding: '10px', borderRadius: 8, background: 'linear-gradient(135deg,#1F3864,#2E5598)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  ✨ Generar {roster.length} instancias
                </button>
              </div>
            </>
          )}

          {/* Generando */}
          {phase === 'generating' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <p style={{ fontWeight: 700, color: '#1F3864', marginBottom: 16 }}>Generando instancias…</p>
              <div style={{ height: 10, background: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ height: '100%', background: '#2563EB', borderRadius: 8, width: `${progress}%`, transition: 'width 0.3s' }} />
              </div>
              <p style={{ fontSize: 13, color: '#6B7280' }}>{progress}% completado</p>
            </div>
          )}

          {/* Resultado */}
          {phase === 'done' && result && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 40 }}>{result.failed === 0 ? '✅' : '⚠️'}</div>
                <p style={{ fontWeight: 700, color: result.failed === 0 ? '#1A6B3A' : '#D97706', margin: '6px 0' }}>
                  {result.created} de {result.total} instancias creadas
                </p>
                {result.failed > 0 && <p style={{ fontSize: 12, color: '#DC2626' }}>⚠️ {result.failed} fallaron — intenta de nuevo</p>}
              </div>
              <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#065F46' }}>CÓDIGO DE ACCESO — EXAM PLAYER V2</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <code style={{ fontSize: 22, fontWeight: 800, color: '#1F3864', letterSpacing: 2 }}>{result.v2Code}</code>
                  <button type="button" onClick={() => navigator.clipboard.writeText(result.v2Code).then(() => showToast('Código copiado', 'success'))}
                    style={{ padding: '4px 10px', borderRadius: 6, background: '#D1FAE5', border: '1px solid #6EE7B7', color: '#065F46', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                    📋 Copiar
                  </button>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#047857' }}>
                  Comparte este código con los estudiantes. Ingresan en <strong>/eval</strong> con su correo + este código.
                </p>
              </div>
              <button type="button" onClick={onClose} style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#1F3864', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Listo
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40 }}>❌</div>
              <p style={{ color: '#DC2626', fontWeight: 700 }}>Error al generar</p>
              <button type="button" onClick={onClose} style={{ marginTop: 12, padding: '8px 20px', borderRadius: 8, background: '#F1F5F9', border: '1px solid #CBD5E1', fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── EXAM DETAIL MODAL ─────────────────────────────────────────────────────────
function ExamDetailModal({ exam, results, onClose, onStatusChange, teacher }) {
  const { showToast } = useToast()
  const [changing,        setChanging]        = useState(false)
  const [printing,        setPrinting]        = useState(false)
  const [versions,        setVersions]        = useState([])
  const [showGenRoster,   setShowGenRoster]   = useState(false)
  const [showPreview,     setShowPreview]     = useState(false)
  const [showResults,     setShowResults]     = useState(false)
  const [showLiveMonitor, setShowLiveMonitor] = useState(false)
  const baseUrl = window.location.origin + window.location.pathname

  useEffect(() => {
    // Versions from session payload
    const payload = exam._session?.service_worker_payload || exam.metadata || {}
    const vc = payload.version_count || 1
    const VERSION_LABELS = ['A', 'B', 'C', 'D']
    setVersions(Array.from({ length: vc }, (_, i) => ({
      id: `v-${i}`, version_number: i + 1, version_label: `Versión ${VERSION_LABELS[i]}`,
      is_base: i === 0,
      shuffle_questions: i > 0 ? (payload.shuffle_questions ?? true) : false,
      shuffle_options: i > 0 ? (payload.shuffle_options ?? true) : false,
    })))
  }, [exam.id])

  async function handlePrint() {
    setPrinting(true)
    try {
      const bp = exam._blueprint
      const questions = (bp?.sections || []).flatMap(sec => sec.questions || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
      const school = teacher?.schools || teacher?.school || {}
      await printExamHtml({ assessment: exam, questions, school, teacherName: teacher?.full_name || '' })
    } catch (err) {
      showToast('Error al imprimir: ' + err.message, 'error')
    } finally {
      setPrinting(false)
    }
  }

  async function toggleStatus() {
    setChanging(true)
    const isActive = exam.status === 'active'
    const newBpStatus = isActive ? 'archived' : 'ready'
    const newUiStatus = isActive ? 'closed' : 'active'
    const { error } = await supabase.from('exam_blueprints').update({ status: newBpStatus }).eq('id', exam.id)
    if (exam._session?.id) {
      await supabase.from('exam_sessions').update({ status: isActive ? 'completed' : 'active' }).eq('id', exam._session.id)
    }
    if (error) { showToast('Error: ' + error.message, 'error') }
    else { onStatusChange(exam.id, newUiStatus); showToast(`Examen ${newUiStatus === 'active' ? 'activado' : 'cerrado'}`, 'success') }
    setChanging(false)
  }

  const examUrl = `${baseUrl}exam/${exam.access_code}`

  return <>
    {showGenRoster && (
      <GenerarRosterModal
        exam={exam}
        teacher={teacher}
        onClose={() => setShowGenRoster(false)}
        onDone={() => setShowGenRoster(false)}
      />
    )}
    {showPreview && (
      <ExamPreviewModal
        exam={exam}
        onClose={() => setShowPreview(false)}
      />
    )}
    {showResults && (
      <ExamResultsDashboard
        exam={exam}
        teacher={teacher}
        onClose={() => setShowResults(false)}
      />
    )}
    {showLiveMonitor && (
      <ExamLiveMonitor
        exam={exam}
        teacher={teacher}
        onClose={() => setShowLiveMonitor(false)}
      />
    )}
    {createPortal(
    <div className="lt-modal-overlay" style={{ zIndex: 9998 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#1F3864' }}>{exam.title}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', margin: '0 0 6px' }}>CÓDIGO DE ACCESO</p>
            {exam.access_code && <CopyCode code={exam.access_code} />}
          </div>
          {versions.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', margin: '0 0 8px' }}>VERSIONES — ANTI-COPIA</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {versions.map(v => (
                  <div key={v.id} style={{
                    padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 700,
                    background: v.is_base ? '#F0F4FF' : '#FFF8E1',
                    color: v.is_base ? '#1F3864' : '#92400E',
                    border: `1px solid ${v.is_base ? '#C7D7FF' : '#FDE68A'}`,
                  }}>
                    {v.version_label}
                    {!v.is_base && (
                      <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 5 }}>
                        {[v.shuffle_questions && '↕ preguntas', v.shuffle_options && '↔ opciones'].filter(Boolean).join(' · ')}
                      </span>
                    )}
                    {v.is_base && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 5 }}>original</span>}
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 10, color: '#9CA3AF', margin: '6px 0 0', fontStyle: 'italic' }}>
                El sistema asigna automáticamente una versión a cada estudiante (round-robin).
              </p>
            </div>
          )}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', margin: '0 0 6px' }}>LINK DIRECTO</p>
            <div style={{ background: '#F1F5F9', borderRadius: 7, padding: '8px 10px', fontSize: 12, color: '#374151', wordBreak: 'break-all', border: '1px solid #E2E8F0', fontFamily: 'monospace' }}>{examUrl}</div>
            <button type="button" onClick={() => navigator.clipboard.writeText(examUrl).then(() => showToast('Link copiado', 'success'))}
              style={{ marginTop: 6, padding: '5px 12px', borderRadius: 6, fontSize: 12, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', cursor: 'pointer' }}>
              📋 Copiar link
            </button>
          </div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', margin: '0 0 8px' }}>RESULTADOS</p>
            {results.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Aún no hay presentaciones.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map(r => (
                  <div key={r.session_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#F8FAFC', borderRadius: 7, border: '1px solid #E2E8F0' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{r.student_name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{r.status === 'complete' ? '✓ Completado' : '⏳ Parcial'}</div>
                    </div>
                    {r.final_grade != null && (
                      <span style={{ fontSize: 16, fontWeight: 800, color: gradeColor(r.final_grade) }}>{r.final_grade?.toFixed(1)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exam.status === 'active' && (
              <button type="button" onClick={() => setShowLiveMonitor(true)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: 'linear-gradient(135deg,#7F1D1D,#DC2626)', color: '#fff', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#FCA5A5', boxShadow: '0 0 0 2px rgba(252,165,165,.5)', animation: 'pulse-dot 1.4s infinite', flexShrink: 0 }} />
                Monitor en Vivo
              </button>
            )}
            <button type="button" onClick={() => setShowResults(true)}
              style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg,#1F3864,#2E5598)', color: '#fff', border: 'none' }}>
              📊 Dashboard de resultados
            </button>
            <button type="button" onClick={() => setShowPreview(true)}
              style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg,#059669,#065F46)', color: '#fff', border: 'none' }}>
              🔍 Vista previa / Editar preguntas
            </button>
            <button type="button" onClick={() => setShowGenRoster(true)}
              style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: 'linear-gradient(135deg,#1F3864,#2E5598)', color: '#fff', border: 'none' }}>
              👥 Generar por roster (Exam Player V2)
            </button>
            <button type="button" onClick={handlePrint} disabled={printing}
              style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: printing ? 'default' : 'pointer',
                background: '#FFF8E1', color: '#7A6200', border: '1px solid #FDE68A', opacity: printing ? 0.7 : 1 }}>
              {printing ? '⏳ Preparando…' : '🖨️ Imprimir / Guardar PDF'}
            </button>
            <button type="button" onClick={toggleStatus} disabled={changing}
              style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: changing ? 'default' : 'pointer',
                background: exam.status === 'active' ? '#FEF2F2' : '#ECFDF5',
                color: exam.status === 'active' ? '#DC2626' : '#15803D',
                border: `1px solid ${exam.status === 'active' ? '#FCA5A5' : '#A7F3D0'}` }}>
              {changing ? '…' : exam.status === 'active' ? '🔒 Cerrar examen' : '🔓 Reabrir examen'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )}
  </>
}

// ── EXAM RESULTS DASHBOARD ────────────────────────────────────────────────────
function gradeLevel(g) { return _gradeLevel(g) }

function integrityRisk(flags, tabSwitches) {
  if (!flags && !tabSwitches) return 'ok'
  if (flags?.high_risk) return 'high'
  const count = tabSwitches || flags?.violation_count || 0
  if (count >= 3) return 'high'
  if (count >= 1) return 'medium'
  return 'ok'
}

function IntegrityBadge({ flags, tabSwitches }) {
  const risk = integrityRisk(flags, tabSwitches)
  const count = tabSwitches || flags?.violation_count || 0
  if (risk === 'high') return (
    <span title={`${count} evento(s) sospechoso(s)`} style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      ⚠️ Riesgo alto
    </span>
  )
  if (risk === 'medium') return (
    <span title={`${count} evento(s) sospechoso(s)`} style={{ background: '#FEF9C3', color: '#854D0E', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      🟡 {count} alerta{count > 1 ? 's' : ''}
    </span>
  )
  return <span style={{ color: '#9CA3AF', fontSize: 11 }}>✓</span>
}

function fmtDuration(secs) {
  if (!secs || secs <= 0) return '—'
  const m = Math.floor(secs / 60)
  return `${m} min`
}

function GradeDistBar({ rows }) {
  const total = rows.length
  if (!total) return null
  const counts = { Superior: 0, Alto: 0, Básico: 0, Bajo: 0, Pendiente: 0 }
  rows.forEach(r => {
    const lv = gradeLevel(r.colombian_grade)
    if (lv) counts[lv.label]++
    else counts.Pendiente++
  })
  const palette = {
    Superior:  { color: '#15803D', bg: '#16A34A' },
    Alto:      { color: '#1D4ED8', bg: '#2563EB' },
    Básico:    { color: '#D97706', bg: '#D97706' },
    Bajo:      { color: '#DC2626', bg: '#EF4444' },
    Pendiente: { color: '#9CA3AF', bg: '#D1D5DB' },
  }
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 14, marginBottom: 6 }}>
        {Object.entries(counts).map(([label, n]) => n > 0 && (
          <div key={label} title={`${label}: ${n}`} style={{ flex: n, background: palette[label].bg, transition: 'flex .3s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {Object.entries(counts).map(([label, n]) => n > 0 && (
          <span key={label} style={{ fontSize: 11, color: palette[label].color, fontWeight: 600 }}>
            ● {label} {n} ({Math.round(n / total * 100)}%)
          </span>
        ))}
      </div>
    </div>
  )
}

function StatTile({ value, sub, color }) {
  return (
    <div style={{ flex: 1, minWidth: 100, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || '#1F3864', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, textTransform: 'uppercase', letterSpacing: .3 }}>{sub}</div>
    </div>
  )
}

function ExamResultsDashboard({ exam, teacher, onClose }) {
  const [instances, setInstances] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState('submitted')   // 'submitted' | 'pending'

  useEffect(() => {
    async function load() {
      setLoading(true)

      // 1. Find exam_sessions for this blueprint
      const sessionId = exam._session?.id
      const { data: examSessions } = sessionId
        ? { data: [{ id: sessionId }] }
        : await supabase
          .from('exam_sessions')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('blueprint_id', exam.id)

      let rows = []

      if (examSessions?.length) {
        const sIds = examSessions.map(s => s.id)

        // 2. Get all instances
        const { data: instRows } = await supabase
          .from('exam_instances')
          .select('id, student_name, student_email, student_section, student_code, version_label, instance_status, integrity_flags, tab_switches, submitted_at, time_spent_seconds')
          .in('session_id', sIds)
          .order('student_section', { ascending: true })

        rows = instRows || []

        // 3. Try to get grades from exam_results
        if (rows.length) {
          const iIds = rows.map(r => r.id)
          const { data: gradeRows } = await supabase
            .from('exam_results')
            .select('instance_id, colombian_grade, total_score, max_score')
            .in('instance_id', iIds)

          if (gradeRows?.length) {
            const gMap = {}
            gradeRows.forEach(g => { gMap[g.instance_id] = g })
            rows = rows.map(r => ({ ...r, ...( gMap[r.id] || {}) }))
          }
        }
      }

      // 4. Fallback for V1 (no instances) — show sessions from assessment_results
      if (!rows.length) {
        const { data: resultRows } = await supabase
          .from('assessment_results')
          .select('session_id, final_grade, percentage, status, student_name')
          .eq('assessment_id', exam.id)
        rows = (resultRows || []).map(r => ({
          id: r.session_id,
          student_name: r.student_name,
          instance_status: r.status === 'complete' ? 'submitted' : 'started',
          colombian_grade: r.final_grade,
          integrity_flags: null,
          tab_switches: 0,
        }))
      }

      setInstances(rows)
      setLoading(false)
    }
    load()
  }, [exam.id, teacher.id])

  const submitted = instances.filter(r => r.instance_status === 'submitted')
  const pending   = instances.filter(r => r.instance_status !== 'submitted')

  const avgGrade = (() => {
    const graded = submitted.filter(r => r.colombian_grade != null)
    if (!graded.length) return null
    return (graded.reduce((s, r) => s + r.colombian_grade, 0) / graded.length).toFixed(1)
  })()

  const highRiskCount = submitted.filter(r => integrityRisk(r.integrity_flags, r.tab_switches) === 'high').length

  const displayed = tab === 'submitted' ? submitted : pending

  return createPortal(
    <div className="lt-modal-overlay" style={{ zIndex: 9998 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 760, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 40px rgba(0,0,0,.2)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #1F3864, #2E5598)', borderRadius: '14px 14px 0 0' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, color: '#fff', fontWeight: 700 }}>📊 Dashboard de Resultados</h3>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,.7)' }}>{exam.title} · {exam.subject} · {exam.grade}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 18, cursor: 'pointer', color: '#fff' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: 40 }}>Cargando resultados…</p>
          ) : instances.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9CA3AF' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p>Aún no hay presentaciones registradas.</p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                <StatTile value={`${submitted.length}/${instances.length}`} sub="Presentaron" color="#1F3864" />
                <StatTile value={avgGrade ? `${avgGrade}/5.0` : '—'} sub="Promedio" color={avgGrade ? gradeColor(parseFloat(avgGrade)) : '#9CA3AF'} />
                <StatTile value={highRiskCount || '0'} sub="Riesgo alto" color={highRiskCount > 0 ? '#DC2626' : '#9CA3AF'} />
                <StatTile value={pending.length || '0'} sub="Pendientes" color={pending.length > 0 ? '#D97706' : '#9CA3AF'} />
              </div>

              {/* Grade distribution */}
              {submitted.length > 0 && <GradeDistBar rows={submitted} />}

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[
                  { key: 'submitted', label: `✅ Presentaron (${submitted.length})` },
                  { key: 'pending',   label: `⏳ No presentaron (${pending.length})` },
                ].map(t => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
                    padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                    background: tab === t.key ? '#1F3864' : '#F1F5F9',
                    color: tab === t.key ? '#fff' : '#475569',
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Table */}
              {displayed.length === 0 ? (
                <p style={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: 13 }}>
                  {tab === 'submitted' ? 'Ningún estudiante ha presentado aún.' : '¡Todos presentaron!'}
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC' }}>
                        {['Nombre', 'Sección', 'Versión', 'Nota', 'Nivel', 'Integridad', tab === 'submitted' ? 'Tiempo' : 'Estado'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 11, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayed
                        .slice()
                        .sort((a, b) => {
                          if (tab !== 'submitted') return (a.student_name || '').localeCompare(b.student_name || '')
                          // submitted: sort by grade desc, ungraded last
                          const ga = a.colombian_grade ?? -1
                          const gb = b.colombian_grade ?? -1
                          return gb - ga
                        })
                        .map((r, i) => {
                          const lv = gradeLevel(r.colombian_grade)
                          const risk = integrityRisk(r.integrity_flags, r.tab_switches)
                          return (
                            <tr key={r.id || i} style={{ borderBottom: '1px solid #F1F5F9', background: risk === 'high' ? '#FFF5F5' : 'transparent' }}>
                              <td style={{ padding: '9px 10px', fontWeight: 600, color: '#374151' }}>
                                {r.student_name || '—'}
                                {r.student_code && <span style={{ color: '#9CA3AF', fontWeight: 400, marginLeft: 5 }}>({r.student_code})</span>}
                              </td>
                              <td style={{ padding: '9px 10px', color: '#64748B' }}>{r.student_section || '—'}</td>
                              <td style={{ padding: '9px 10px' }}>
                                {r.version_label
                                  ? <span style={{ background: '#F0F4FF', color: '#1F3864', borderRadius: 5, padding: '2px 7px', fontWeight: 700 }}>{r.version_label}</span>
                                  : <span style={{ color: '#9CA3AF' }}>—</span>
                                }
                              </td>
                              <td style={{ padding: '9px 10px' }}>
                                {r.colombian_grade != null
                                  ? <span style={{ fontSize: 16, fontWeight: 800, color: gradeColor(r.colombian_grade) }}>{r.colombian_grade.toFixed(1)}</span>
                                  : <span style={{ color: '#9CA3AF', fontSize: 11 }}>⏳ pendiente</span>
                                }
                              </td>
                              <td style={{ padding: '9px 10px' }}>
                                {lv
                                  ? <span style={{ background: lv.bg, color: lv.color, borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>{lv.label}</span>
                                  : <span style={{ color: '#9CA3AF' }}>—</span>
                                }
                              </td>
                              <td style={{ padding: '9px 10px' }}>
                                <IntegrityBadge flags={r.integrity_flags} tabSwitches={r.tab_switches} />
                              </td>
                              <td style={{ padding: '9px 10px', color: '#64748B' }}>
                                {tab === 'submitted'
                                  ? fmtDuration(r.time_spent_seconds)
                                  : <span style={{ background: r.instance_status === 'started' ? '#FEF9C3' : '#F1F5F9', color: r.instance_status === 'started' ? '#854D0E' : '#6B7280', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>
                                      {r.instance_status === 'started' ? '⏳ En curso' : '⬜ Sin iniciar'}
                                    </span>
                                }
                              </td>
                            </tr>
                          )
                        })
                      }
                    </tbody>
                  </table>
                </div>
              )}

              {tab === 'submitted' && submitted.some(r => r.colombian_grade == null) && (
                <p style={{ marginTop: 12, fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
                  ⏳ Algunas notas están pendientes de corrección AI. Se actualizarán automáticamente.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── EXAM LIVE MONITOR ─────────────────────────────────────────────────────────
function ExamLiveMonitor({ exam, teacher, onClose }) {
  const [instances,    setInstances]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState(null)
  const sessionIdsRef = useRef([])

  function fmtTime(d) {
    if (!d) return '—'
    return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  async function loadInstances(sIds) {
    const { data } = await supabase
      .from('exam_instances')
      .select('id, session_id, student_name, student_email, student_section, student_code, version_label, instance_status, integrity_flags, tab_switches, submitted_at')
      .in('session_id', sIds)
      .order('student_section')
    setInstances(data || [])
    setLastUpdated(new Date())
  }

  useEffect(() => {
    let channel
    let interval

    async function init() {
      setLoading(true)

      const sessionId = exam._session?.id
      const { data: examSessions } = sessionId
        ? { data: [{ id: sessionId }] }
        : await supabase
          .from('exam_sessions')
          .select('id')
          .eq('teacher_id', teacher.id)
          .eq('blueprint_id', exam.id)

      if (!examSessions?.length) {
        setLoading(false)
        return
      }

      const sIds = examSessions.map(s => s.id)
      sessionIdsRef.current = sIds

      await loadInstances(sIds)
      setLoading(false)

      // Realtime subscription — filter client-side to avoid complex filter syntax
      channel = supabase
        .channel(`live-monitor-${exam.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_instances' }, (payload) => {
          const row = payload.new || payload.old
          if (!row || !sessionIdsRef.current.includes(row.session_id)) return
          setInstances(prev => {
            if (payload.eventType === 'INSERT') return [...prev, payload.new]
            if (payload.eventType === 'UPDATE') return prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i)
            if (payload.eventType === 'DELETE') return prev.filter(i => i.id !== payload.old.id)
            return prev
          })
          setLastUpdated(new Date())
        })
        .subscribe()

      // 30s fallback refresh
      interval = setInterval(() => {
        if (sessionIdsRef.current.length) loadInstances(sessionIdsRef.current)
      }, 30000)
    }

    init()
    return () => {
      channel?.unsubscribe()
      clearInterval(interval)
    }
  }, [exam.id, teacher.id])

  const active    = instances.filter(i => i.instance_status === 'started')
  const submitted = instances.filter(i => i.instance_status === 'submitted')
  const waiting   = instances.filter(i => i.instance_status === 'ready')

  const STATUS_STYLE = {
    started:   { label: '⏳ En curso',    bg: '#FEF9C3', color: '#854D0E' },
    submitted: { label: '✅ Enviado',      bg: '#DCFCE7', color: '#15803D' },
    ready:     { label: '⬜ Sin iniciar',  bg: '#F1F5F9', color: '#6B7280' },
  }

  return createPortal(
    <div className="lt-modal-overlay" style={{ zIndex: 9999 }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 700,
        maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'linear-gradient(135deg,#7F1D1D,#DC2626)', borderRadius: '14px 14px 0 0',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: '#FCA5A5',
                boxShadow: '0 0 0 3px rgba(252,165,165,.4)', animation: 'pulse-dot 1.4s infinite',
                display: 'inline-block', flexShrink: 0,
              }} />
              Monitor en Vivo
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.75)', marginTop: 2 }}>
              {exam.title} · {exam.subject} · {exam.grade}
            </div>
          </div>
          <button type="button" onClick={onClose}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 18, cursor: 'pointer', color: '#fff' }}>
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Counters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            {[
              { value: active.length,    label: 'En curso',     color: '#854D0E', bg: '#FEF9C3', border: '#FDE68A' },
              { value: submitted.length, label: 'Enviaron',     color: '#15803D', bg: '#DCFCE7', border: '#A7F3D0' },
              { value: waiting.length,   label: 'Sin iniciar',  color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' },
              { value: instances.length, label: 'Total',        color: '#1F3864', bg: '#EFF6FF', border: '#BFDBFE' },
            ].map(c => (
              <div key={c.label} style={{
                flex: 1, minWidth: 100, background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 10, padding: '14px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
                <div style={{ fontSize: 11, color: c.color, marginTop: 4, textTransform: 'uppercase', letterSpacing: .3, opacity: .8 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {loading ? (
            <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: 32 }}>Conectando…</p>
          ) : instances.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 24px', color: '#9CA3AF' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
              <p style={{ margin: 0 }}>No hay instancias generadas aún.</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>Usa "Generar por roster" para crear las instancias.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    {['Nombre', 'Código', 'Sección', 'Versión', 'Estado', 'Integridad', 'Enviado'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#64748B', fontSize: 11, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {instances
                    .slice()
                    .sort((a, b) => {
                      const order = { started: 0, submitted: 1, ready: 2 }
                      const oa = order[a.instance_status] ?? 3
                      const ob = order[b.instance_status] ?? 3
                      if (oa !== ob) return oa - ob
                      return (a.student_name || '').localeCompare(b.student_name || '')
                    })
                    .map((r, i) => {
                      const st = STATUS_STYLE[r.instance_status] || STATUS_STYLE.ready
                      const risk = integrityRisk(r.integrity_flags, r.tab_switches)
                      return (
                        <tr key={r.id || i} style={{
                          borderBottom: '1px solid #F1F5F9',
                          background: risk === 'high' ? '#FFF5F5' : r.instance_status === 'started' ? '#FFFEF0' : 'transparent',
                        }}>
                          <td style={{ padding: '9px 10px', fontWeight: 600, color: '#374151' }}>
                            {r.student_name || r.student_email || '—'}
                            {r.student_code && <span style={{ color: '#9CA3AF', fontWeight: 400, marginLeft: 5 }}>({r.student_code})</span>}
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <code style={{ background: '#F1F5F9', color: '#1F3864', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
                              {r.id ? r.id.slice(-6).toUpperCase() : '—'}
                            </code>
                          </td>
                          <td style={{ padding: '9px 10px', color: '#64748B' }}>{r.student_section || '—'}</td>
                          <td style={{ padding: '9px 10px' }}>
                            {r.version_label
                              ? <span style={{ background: '#F0F4FF', color: '#1F3864', borderRadius: 5, padding: '2px 7px', fontWeight: 700 }}>{r.version_label}</span>
                              : <span style={{ color: '#9CA3AF' }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{ background: st.bg, color: st.color, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={{ padding: '9px 10px' }}>
                            <IntegrityBadge flags={r.integrity_flags} tabSwitches={r.tab_switches} />
                          </td>
                          <td style={{ padding: '9px 10px', color: '#64748B', whiteSpace: 'nowrap' }}>
                            {r.submitted_at ? fmtTime(r.submitted_at) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #E2E8F0', padding: '10px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#F8FAFC',
        }}>
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            {lastUpdated
              ? `Actualizado: ${fmtTime(lastUpdated)} · Realtime activo`
              : 'Conectando al monitor…'}
          </span>
          <button type="button" onClick={onClose}
            style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D0D5DD', background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── TelegramConfigPanel ───────────────────────────────────────────────────────
function TelegramConfigPanel({ teacher, showToast }) {
  const [chatId,   setChatId]   = useState(teacher.telegram_chat_id || '')
  const [editing,  setEditing]  = useState(!teacher.telegram_chat_id)
  const [saving,   setSaving]   = useState(false)
  const configured = Boolean(teacher.telegram_chat_id)

  async function handleSave() {
    const trimmed = chatId.trim()
    if (!trimmed) { showToast('Ingresa tu Chat ID de Telegram.', 'warning'); return }
    setSaving(true)
    const { error } = await supabase.from('teachers').update({ telegram_chat_id: trimmed }).eq('id', teacher.id)
    setSaving(false)
    if (error) { showToast('Error al guardar: ' + error.message, 'error'); return }
    teacher.telegram_chat_id = trimmed   // mutate prop for immediate feedback (page re-renders on next load)
    setEditing(false)
    showToast('✅ Telegram configurado — recibirás alertas en tiempo real.', 'success')
  }

  async function handleRemove() {
    setSaving(true)
    await supabase.from('teachers').update({ telegram_chat_id: null }).eq('id', teacher.id)
    setSaving(false)
    teacher.telegram_chat_id = null
    setChatId('')
    setEditing(true)
    showToast('Telegram desvinculado.', 'info')
  }

  if (!editing && configured) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, marginBottom: 18, fontSize: 13 }}>
        <span style={{ color: '#065F46', fontWeight: 700 }}>📬 Alertas Telegram activas</span>
        <span style={{ color: '#047857', fontSize: 12 }}>Chat ID: <code style={{ background: '#D1FAE5', padding: '1px 6px', borderRadius: 4 }}>{teacher.telegram_chat_id}</code></span>
        <button type="button" onClick={() => setEditing(true)} style={{ marginLeft: 'auto', background: 'none', border: '1px solid #6EE7B7', borderRadius: 6, color: '#065F46', fontSize: 11, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>✏ Editar</button>
        <button type="button" onClick={handleRemove} disabled={saving} style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: 6, color: '#991B1B', fontSize: 11, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>Quitar</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '14px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 15 }}>📬</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#92400E' }}>Configura alertas de integridad en Telegram</span>
        {configured && (
          <button type="button" onClick={() => setEditing(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        )}
      </div>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>
        Recibe una alerta inmediata cada vez que un estudiante cambie de pestaña, salga del fullscreen o active cualquier evento sospechoso durante el examen.
      </p>
      <p style={{ margin: '0 0 10px', fontSize: 11, color: '#92400E' }}>
        <strong>¿Cómo obtener tu Chat ID?</strong> Abre Telegram → busca <code style={{ background: '#FEF3C7', padding: '1px 4px', borderRadius: 3 }}>@userinfobot</code> → presiona Start → copia el número que te responde.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="text"
          value={chatId}
          onChange={e => setChatId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder="Ej. 123456789"
          style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: '1px solid #FCD34D', fontSize: 13, outline: 'none' }}
        />
        <button type="button" onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 7, background: '#D97706', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ExamDashboardPage({ teacher }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [exams,    setExams]    = useState([])
  const [results,  setResults]  = useState({})
  const [sessions, setSessions] = useState({})
  const [pending,  setPending]  = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [detailExam,  setDetailExam]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)

    // 1. Read blueprints
    const { data: bpRows } = await supabase
      .from('exam_blueprints')
      .select('id, title, subject, grade, period, status, created_at, estimated_minutes, teacher_id, sections')
      .eq('school_id', teacher.school_id)
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })

    const bpList = bpRows || []
    const bpIds = bpList.map(b => b.id)

    // 2. Get sessions for these blueprints
    let sessionsByBp = {}
    if (bpIds.length) {
      const { data: sesRows } = await supabase
        .from('exam_sessions')
        .select('id, blueprint_id, access_code, status, duration_minutes, service_worker_payload')
        .in('blueprint_id', bpIds)
      for (const s of sesRows || []) {
        if (!sessionsByBp[s.blueprint_id]) sessionsByBp[s.blueprint_id] = []
        sessionsByBp[s.blueprint_id].push(s)
      }
    }

    // 3. Normalize to the format the UI expects
    const examList = bpList.map(bp => {
      const sess = sessionsByBp[bp.id]?.[0]
      return {
        id: bp.id,
        title: bp.title,
        subject: bp.subject,
        grade: bp.grade,
        period: bp.period,
        status: bp.status === 'ready' ? 'active' : bp.status === 'archived' ? 'closed' : bp.status,
        access_code: sess?.access_code || null,
        created_at: bp.created_at,
        time_limit_minutes: bp.estimated_minutes,
        created_by: bp.teacher_id,
        metadata: sess?.service_worker_payload || {},
        _blueprint: bp,
        _session: sess,
      }
    })
    setExams(examList)

    if (examList.length === 0) { setLoading(false); return }

    // 4. Get instance + result stats via exam_sessions
    const allSessionIds = Object.values(sessionsByBp).flat().map(s => s.id)
    const sMap = {}
    const rMap = {}

    if (allSessionIds.length) {
      const { data: instRows } = await supabase
        .from('exam_instances')
        .select('session_id, instance_status')
        .in('session_id', allSessionIds)

      for (const inst of instRows || []) {
        const bpId = Object.keys(sessionsByBp).find(k => sessionsByBp[k].some(s => s.id === inst.session_id))
        if (bpId) (sMap[bpId] = sMap[bpId] || []).push({ status: inst.instance_status === 'submitted' ? 'submitted' : 'active' })
      }

      const { data: resRows } = await supabase
        .from('exam_results')
        .select('session_id, colombian_grade')
        .in('session_id', allSessionIds)

      for (const r of resRows || []) {
        const bpId = Object.keys(sessionsByBp).find(k => sessionsByBp[k].some(s => s.id === r.session_id))
        if (bpId) (rMap[bpId] = rMap[bpId] || []).push({ final_grade: r.colombian_grade })
      }

      // Pending human reviews
      const { count } = await supabase
        .from('exam_responses')
        .select('id', { count: 'exact', head: true })
        .in('session_id', allSessionIds)
        .eq('needs_human_review', true)
      setPending(count || 0)
    }

    setSessions(sMap)
    setResults(rMap)
    setLoading(false)
  }, [teacher.id, teacher.school_id])

  useEffect(() => { load() }, [load])

  function handleStatusChange(id, status) {
    setExams(prev => prev.map(e => e.id === id ? { ...e, status } : e))
    if (detailExam?.id === id) setDetailExam(prev => ({ ...prev, status }))
  }

  const totalStudents = Object.values(sessions).reduce((n, arr) => n + arr.length, 0)
  const avgGrade = (() => {
    const all = Object.values(results).flat().map(r => r.final_grade).filter(g => g != null)
    return all.length ? (all.reduce((s, g) => s + g, 0) / all.length).toFixed(1) : null
  })()

  return (
    <div style={{ padding: '24px 28px', maxWidth: 980 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 700 }}>📝 Módulo de Evaluación</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            {loading ? '…' : `${exams.length} exámenes · ${totalStudents} presentaciones`}
            {avgGrade && <span style={{ marginLeft: 10, color: gradeColor(parseFloat(avgGrade)), fontWeight: 700 }}>Promedio: {avgGrade}/5.0</span>}
            {pending > 0 && (
              <span style={{ marginLeft: 10, background: '#FBBF24', color: '#7A3B03', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                ⚠️ {pending} revisiones pendientes
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {pending > 0 && (
            <a href="/cbf-planner/exams/review" style={{ padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              👁 Revisar IA ({pending})
            </a>
          )}
          <button type="button" onClick={() => navigate('/exams/create')} style={{ padding: '9px 18px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            ✨ Crear Examen con IA
          </button>
        </div>
      </div>

      <TelegramConfigPanel teacher={teacher} showToast={showToast} />

      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Cargando exámenes…</p>}

      {!loading && exams.length === 0 && (
        <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <h3 style={{ margin: '0 0 8px', color: '#374151' }}>No hay exámenes todavía</h3>
          <p style={{ color: '#9CA3AF', margin: '0 0 20px', fontSize: 14 }}>
            Crea tu primer examen con IA. El indicador + principio bíblico → examen completo en menos de 2 minutos.
          </p>
          <button type="button" onClick={() => navigate('/exams/create')} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff', border: 'none', cursor: 'pointer' }}>
            ✨ Crear primer examen
          </button>
        </div>
      )}

      {!loading && exams.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {exams.map(exam => {
            const examResults  = results[exam.id] || []
            const examSessions = sessions[exam.id] || []
            const submitted = examSessions.filter(s => s.status === 'submitted').length
            const avg = examResults.length
              ? (examResults.reduce((s, r) => s + (r.final_grade || 0), 0) / examResults.length).toFixed(1)
              : null
            return (
              <div key={exam.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: exam.status === 'active' ? '#22C55E' : exam.status === 'closed' ? '#94A3B8' : '#F59E0B' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>{exam.title}</span>
                    <StatusBadge status={exam.status} />
                    {exam.metadata?.exam_type && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                        background: exam.metadata.exam_type === 'final' ? '#EFF6FF' : '#FEF3C7',
                        color: exam.metadata.exam_type === 'final' ? '#1E40AF' : '#92400E',
                        border: `1px solid ${exam.metadata.exam_type === 'final' ? '#93C5FD' : '#FDE68A'}`,
                      }}>
                        {exam.metadata.exam_type === 'final' ? '📋 Final' : '📝 Quiz'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    {exam.subject} · {exam.grade}{exam.period ? ` · P${exam.period}` : ''}{exam.time_limit_minutes > 0 ? ` · ${exam.time_limit_minutes} min` : ''}
                    <span style={{ margin: '0 6px', color: '#D0D5DD' }}>·</span>
                    {fmt(exam.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1F3864' }}>{submitted}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>presentaron</div>
                  </div>
                  {avg != null && (
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: gradeColor(parseFloat(avg)) }}>{avg}</div>
                      <div style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>promedio</div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {exam.access_code && <CopyCode code={exam.access_code} />}
                  <button type="button" onClick={() => navigate(`/exams/${exam.id}`)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#1F3864', color: '#fff', border: 'none', cursor: 'pointer' }}>Ver →</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {detailExam && (
        <ExamDetailModal exam={detailExam} results={results[detailExam.id] || []} onClose={() => setDetailExam(null)} onStatusChange={handleStatusChange} teacher={teacher} />
      )}
    </div>
  )
}
