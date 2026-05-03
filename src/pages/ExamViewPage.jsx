// ── ExamViewPage.jsx ──────────────────────────────────────────────────────────
// /exams/:id — Full-page view of a designed exam with edit-in-place per question.

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { seededShuffle } from '../utils/examUtils'
import { printExamHtml, buildExamHtml } from '../utils/exportExamHtml'

const TYPE_LABELS = {
  multiple_choice: 'Opción múltiple', true_false: 'V / F',
  fill_blank: 'Completar', short_answer: 'Respuesta corta', matching: 'Relacionar',
  error_correction: 'Corrección de error', sequencing: 'Ordenar', open_development: 'Desarrollo',
  biblical_reflection: 'Reflexión bíblica', verse_analysis: 'Analizar versículo', principle_application: 'Aplicación del principio',
}
const TYPE_COLORS = {
  multiple_choice: '#1D4ED8', true_false: '#7C3AED',
  fill_blank: '#059669', short_answer: '#D97706', matching: '#DC2626',
  error_correction: '#0891B2', sequencing: '#6D28D9', open_development: '#1F3864',
  biblical_reflection: '#7B3F00', verse_analysis: '#6B3A8C', principle_application: '#92400E',
}
const BIBLICAL_KEYS = ['biblical_reflection', 'verse_analysis', 'principle_application']

export default function ExamViewPage({ teacher }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [exam, setExam]               = useState(null)
  const [questions, setQuestions]      = useState([])
  const [versions, setVersions]        = useState([])
  const [activeVersion, setActiveVersion] = useState(0)
  const [loading, setLoading]          = useState(true)
  const [editingId, setEditingId]      = useState(null)
  const [editForm, setEditForm]        = useState({})
  const [saving, setSaving]            = useState(false)
  const [printing, setPrinting]        = useState(false)
  const [archiving, setArchiving]      = useState(false)
  const [archived, setArchived]        = useState(false)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      const { data: bp, error } = await supabase
        .from('exam_blueprints')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !bp) {
        showToast('Examen no encontrado', 'error')
        navigate('/exams')
        return
      }

      // Get session
      const { data: sessRows } = await supabase
        .from('exam_sessions')
        .select('id, access_code, status, service_worker_payload')
        .eq('blueprint_id', id)
        .limit(1)
      const sess = sessRows?.[0] || null

      const examObj = {
        ...bp,
        _blueprint: bp,
        _session: sess,
        access_code: sess?.access_code || null,
        metadata: sess?.service_worker_payload || bp.metadata || {},
      }
      setExam(examObj)

      // Questions
      const allQs = (bp.sections || []).flatMap(sec => sec.questions || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((q, i) => ({ ...q, id: q.id || `q-${i}` }))
      setQuestions(allQs)

      // Versions
      const payload = sess?.service_worker_payload || bp.metadata || {}
      const vc = payload.version_count || 1
      const VERSION_LABELS = ['A', 'B', 'C', 'D']
      setVersions(Array.from({ length: vc }, (_, i) => ({
        id: `v-${i}`, version_number: i + 1, version_label: `Versión ${VERSION_LABELS[i]}`,
        is_base: i === 0,
        shuffle_questions: i > 0 ? (payload.shuffle_questions ?? true) : false,
      })))

      setLoading(false)
    })()
  }, [id])

  const displayQuestions = useMemo(() => {
    const v = versions[activeVersion]
    if (!v || v.is_base || !v.shuffle_questions) return questions
    return seededShuffle(questions, (activeVersion + 1) * 31337)
  }, [questions, versions, activeVersion])

  function startEdit(q) {
    setEditingId(q.id)
    setEditForm({
      stem: q.stem,
      correct_answer: q.correct_answer || '',
      points: q.points,
      options: q.options ? [...q.options] : [],
    })
  }

  async function saveEdit(q) {
    setSaving(true)
    const updates = {
      stem: editForm.stem.trim(),
      correct_answer: editForm.correct_answer,
      points: parseFloat(editForm.points) || parseFloat(q.points),
      ...(q.question_type === 'multiple_choice' && { options: editForm.options }),
    }
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
    } else { setSaving(false) }
    setQuestions(prev => prev.map(p => (p.id === q.id || p.position === q.position) ? { ...p, ...updates } : p))
    setEditingId(null)
    showToast('Pregunta guardada', 'success')
  }

  async function handlePrint() {
    setPrinting(true)
    try {
      const school = teacher?.schools || teacher?.school || {}
      await printExamHtml({
        assessment: exam,
        questions,
        school,
        teacherName: teacher?.full_name || '',
      })
    } catch (err) {
      showToast('Error al imprimir: ' + err.message, 'error')
    } finally {
      setPrinting(false)
    }
  }

  async function handleArchive() {
    setArchiving(true)
    try {
      const school = teacher?.schools || teacher?.school || {}
      // Inline logo
      let logoBase64 = ''
      if (school?.logo_url) {
        try {
          const res = await fetch(school.logo_url)
          if (res.ok) {
            const blob = await res.blob()
            logoBase64 = await new Promise(r => {
              const reader = new FileReader()
              reader.onloadend = () => r(reader.result)
              reader.onerror = () => r('')
              reader.readAsDataURL(blob)
            })
          }
        } catch { /* keep empty */ }
      }

      const html = buildExamHtml({
        assessment: exam,
        questions,
        logoBase64,
        school,
        teacherName: teacher?.full_name || '',
      })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const safeTitle = (exam.title || 'Examen').replace(/[^\w\s-]/g, '').trim().slice(0, 40).replace(/\s+/g, '_')
      const filePath = `archives/${teacher.school_id}/exams/${exam.id}/${safeTitle}_${timestamp}.html`

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const { error: upErr } = await supabase.storage
        .from('guide-images')
        .upload(filePath, blob, { contentType: 'text/html', upsert: false })

      if (upErr) {
        showToast('Error al archivar: ' + upErr.message, 'error')
      } else {
        setArchived(true)
        showToast('Examen archivado en la biblioteca de documentos', 'success')
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
    } finally {
      setArchiving(false)
    }
  }

  const totalPts = questions.reduce((s, q) => s + parseFloat(q.points || 0), 0)
  const academicQs = questions.filter(q => !BIBLICAL_KEYS.includes(q.question_type))
  const biblicalQs = questions.filter(q => BIBLICAL_KEYS.includes(q.question_type))

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        Cargando examen…
      </div>
    )
  }

  if (!exam) return null

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '20px 16px 40px' }}>

      {/* ── Back + Header ─────────────────────────────────────────────── */}
      <button type="button" onClick={() => navigate('/exams')}
        style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 13, cursor: 'pointer', padding: '4px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        ← Volver a exámenes
      </button>

      <div style={{ background: 'linear-gradient(135deg, #1F3864 0%, #2E5598 100%)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800 }}>{exam.title}</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#93C5FD' }}>
              {exam.subject} · {exam.grade}{exam.period ? ` · Período ${exam.period}` : ''}
              {exam.estimated_minutes ? ` · ${exam.estimated_minutes} min` : ''}
            </p>
          </div>
          {exam.access_code && (
            <div style={{ background: 'rgba(255,255,255,.15)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 1 }}>Código</div>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 3 }}>{exam.access_code}</div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 14, flexWrap: 'wrap' }}>
          <Stat label="Preguntas" value={questions.length} />
          <Stat label="Académicas" value={academicQs.length} />
          <Stat label="Bíblicas" value={biblicalQs.length} />
          <Stat label="Puntos" value={totalPts.toFixed(1)} />
          {exam.metadata?.exam_type && (
            <Stat label="Tipo" value={exam.metadata.exam_type === 'final' ? 'Examen Final' : 'Quiz'} />
          )}
        </div>
      </div>

      {/* ── Version tabs ──────────────────────────────────────────────── */}
      {versions.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginRight: 4 }}>VERSIÓN:</span>
          {versions.map((v, i) => (
            <button key={v.id} type="button" onClick={() => { setActiveVersion(i); setEditingId(null) }}
              style={{ padding: '5px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: activeVersion === i ? '#1F3864' : '#EFF6FF',
                color: activeVersion === i ? '#fff' : '#1F3864',
                border: `1.5px solid ${activeVersion === i ? '#1F3864' : '#BFDBFE'}` }}>
              {v.version_label}
              {!v.is_base && v.shuffle_questions && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3 }}>↕</span>}
            </button>
          ))}
          <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 6 }}>
            {versions[activeVersion]?.is_base ? 'Orden original' : 'Preguntas reordenadas (shuffle)'}
          </span>
        </div>
      )}

      {/* ── Questions ─────────────────────────────────────────────────── */}
      {displayQuestions.length === 0 && (
        <p style={{ color: '#9CA3AF', textAlign: 'center', padding: 40 }}>Este examen no tiene preguntas registradas.</p>
      )}

      {displayQuestions.map((q, idx) => {
        const isBiblical = BIBLICAL_KEYS.includes(q.question_type)
        const accentColor = TYPE_COLORS[q.question_type] || '#6B7280'
        return (
          <div key={q.id} style={{
            marginBottom: 14, border: `1.5px solid ${editingId === q.id ? '#FCD34D' : isBiblical ? '#E8D5B8' : '#E2E8F0'}`,
            borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s',
            background: isBiblical ? '#FFFCF5' : '#fff',
          }}>

            {/* Question header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              background: isBiblical ? '#FDF8F0' : '#F8FAFC', borderBottom: `2px solid ${accentColor}20` }}>
              <span style={{ fontWeight: 800, color: '#1F3864', fontSize: 15, minWidth: 28 }}>{idx + 1}.</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 5,
                background: `${accentColor}15`, color: accentColor }}>
                {isBiblical && '✝️ '}{TYPE_LABELS[q.question_type] || q.question_type}
              </span>
              <span style={{ fontSize: 12, color: '#6B7280', marginLeft: 'auto' }}>
                {q.points} pt{parseFloat(q.points) !== 1 ? 's' : ''}
              </span>
              <button type="button" onClick={() => editingId === q.id ? setEditingId(null) : startEdit(q)}
                style={{ padding: '4px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: editingId === q.id ? '#FEE2E2' : '#EFF6FF',
                  color: editingId === q.id ? '#DC2626' : '#1D4ED8',
                  border: `1px solid ${editingId === q.id ? '#FCA5A5' : '#BFDBFE'}` }}>
                {editingId === q.id ? '✕ Cancelar' : '✏ Editar'}
              </button>
            </div>

            {/* View mode */}
            {editingId !== q.id && (
              <div style={{ padding: '14px 16px' }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, color: '#111827', lineHeight: 1.7 }}>{q.stem}</p>
                {q.options && Array.isArray(q.options) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {q.options.map((opt, oi) => {
                      const letter = String.fromCharCode(65 + oi)
                      const isCorrect = q.question_type === 'true_false'
                        ? opt === q.correct_answer
                        : letter === q.correct_answer || opt === q.correct_answer
                      return (
                        <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8,
                          background: isCorrect ? '#ECFDF5' : '#F8FAFC',
                          border: `1.5px solid ${isCorrect ? '#6EE7B7' : '#E2E8F0'}` }}>
                          <span style={{ fontWeight: 700, fontSize: 12, color: isCorrect ? '#059669' : '#94A3B8', minWidth: 20 }}>
                            {isCorrect ? '✓' : letter + ')'}
                          </span>
                          <span style={{ fontSize: 13, color: isCorrect ? '#065F46' : '#374151', fontWeight: isCorrect ? 600 : 400 }}>{opt}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
                {!q.options && q.correct_answer && (
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8, padding: '6px 14px', display: 'inline-block' }}>
                    <span style={{ fontSize: 12, color: '#065F46', fontWeight: 600 }}>✓ {q.correct_answer}</span>
                  </div>
                )}
                {!q.options && !q.correct_answer && (
                  <span style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' }}>Respuesta abierta — corrección IA/manual</span>
                )}
                {q.evaluation_criteria && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#F0F4FF', borderRadius: 8, border: '1px solid #DBEAFE' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase' }}>Criterios IA</span>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{q.evaluation_criteria}</p>
                  </div>
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
                    style={{ width: '100%', padding: 8, border: '1.5px solid #FCD34D', borderRadius: 7, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
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
                            style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12,
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
                    style={{ marginLeft: 'auto', padding: '8px 22px', borderRadius: 8, background: saving ? '#9CA3AF' : '#059669', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}>
                    {saving ? '⏳ Guardando…' : '💾 Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* ── Footer — acciones ─────────────────────────────────────────── */}
      <div style={{
        marginTop: 24, padding: '20px', background: '#F8FAFC', borderRadius: 12,
        border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#6B7280' }}>
            {totalPts.toFixed(1)} pts totales · {questions.length} preguntas
            ({academicQs.length} académicas + {biblicalQs.length} bíblicas)
          </span>
          <button type="button" onClick={() => navigate('/exams')}
            style={{ padding: '8px 20px', borderRadius: 8, background: '#E2E8F0', color: '#374151', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ← Volver a exámenes
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={handlePrint} disabled={printing}
            style={{
              flex: 1, minWidth: 200, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: printing ? 'default' : 'pointer',
              background: 'linear-gradient(135deg, #DC2626, #991B1B)', color: '#fff', border: 'none', opacity: printing ? 0.7 : 1,
            }}>
            {printing ? '⏳ Preparando…' : '🖨️ Imprimir / Guardar PDF'}
          </button>
          <button type="button" onClick={handleArchive} disabled={archiving || archived}
            style={{
              flex: 1, minWidth: 200, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (archiving || archived) ? 'default' : 'pointer',
              background: archived ? '#ECFDF5' : 'linear-gradient(135deg, #1F3864, #2E5598)', color: archived ? '#065F46' : '#fff',
              border: archived ? '1.5px solid #A7F3D0' : 'none', opacity: archiving ? 0.7 : 1,
            }}>
            {archiving ? '⏳ Archivando…' : archived ? '✓ Archivado en biblioteca' : '📁 Archivar en biblioteca'}
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0, lineHeight: 1.5 }}>
          <strong>Imprimir:</strong> abre el examen en formato institucional CBF-G AC-01 listo para guardar como PDF.
          <br /><strong>Archivar:</strong> guarda una copia inmutable en la biblioteca del colegio como respaldo ante discrepancias.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}
