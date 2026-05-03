// ── ExamViewPage.jsx ──────────────────────────────────────────────────────────
// /exams/:id — Full-page view of a designed exam with edit-in-place per question.
// Approval workflow: draft → submitted → approved/returned → ready (generar roster)
//
// States:
//   draft:     Editable. "Enviar a revisión" visible.
//   submitted: Read-only. Banner azul "En revisión".
//   returned:  Editable. Banner ámbar with feedback.
//   approved:  Read-only. "Generar por roster" enabled. Banner verde.
//   ready:     Active. Students can take the exam.
//   archived:  Archive only.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { seededShuffle } from '../utils/examUtils'
import { printExamHtml, buildExamHtml } from '../utils/exportExamHtml'
import { exportExamDocx } from '../utils/exportExamDocx'
import { displayName } from '../utils/studentUtils'

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

const STATUS_META = {
  draft:     { label: 'Borrador',          icon: '✏️', bg: '#FFF8E1', color: '#7A6200', border: '#FDE68A' },
  submitted: { label: 'En revisión',       icon: '📨', bg: '#EFF6FF', color: '#1E40AF', border: '#BFDBFE' },
  returned:  { label: 'Devuelto',          icon: '🔄', bg: '#FEF3C7', color: '#92400E', border: '#FCD34D' },
  approved:  { label: 'Aprobado',          icon: '✅', bg: '#ECFDF5', color: '#065F46', border: '#A7F3D0' },
  ready:     { label: 'Activo',            icon: '🟢', bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
  active:    { label: 'Activo',            icon: '🟢', bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },
  closed:    { label: 'Cerrado',           icon: '🔒', bg: '#F1F5F9', color: '#475569', border: '#CBD5E1' },
  archived:  { label: 'Archivado',         icon: '📦', bg: '#F5F5F5', color: '#6B7280', border: '#D1D5DB' },
}

function fmt(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ExamViewPage({ teacher }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [exam, setExam]                   = useState(null)
  const [questions, setQuestions]          = useState([])
  const [versions, setVersions]           = useState([])
  const [activeVersion, setActiveVersion] = useState(0)
  const [loading, setLoading]             = useState(true)
  const [editingId, setEditingId]         = useState(null)
  const [editForm, setEditForm]           = useState({})
  const [saving, setSaving]               = useState(false)
  const [printing, setPrinting]           = useState(false)
  const [exportingDocx, setExportingDocx] = useState(false)
  const [archiving, setArchiving]         = useState(false)
  const [archived, setArchived]           = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [feedback, setFeedback]           = useState([])
  const [school, setSchool]               = useState(null)

  // ── Load exam + feedback + school ────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return
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

    // School
    const { data: sch } = await supabase
      .from('schools')
      .select('*')
      .eq('id', teacher.school_id)
      .single()
    setSchool(sch || {})

    // Session
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
    setArchived(!!bp.archive_url)

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

    // Feedback history (table may not exist if migration not yet applied)
    try {
      const { data: fb } = await supabase
        .from('exam_feedback')
        .select('*, reviewer:reviewer_id(full_name)')
        .eq('blueprint_id', id)
        .order('created_at', { ascending: false })
      setFeedback(fb || [])
    } catch { setFeedback([]) }

    setLoading(false)
  }, [id, teacher.school_id])

  useEffect(() => { load() }, [load])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const displayQuestions = useMemo(() => {
    const v = versions[activeVersion]
    if (!v || v.is_base || !v.shuffle_questions) return questions
    return seededShuffle(questions, (activeVersion + 1) * 31337)
  }, [questions, versions, activeVersion])

  const totalPts = questions.reduce((s, q) => s + parseFloat(q.points || 0), 0)
  const academicQs = questions.filter(q => !BIBLICAL_KEYS.includes(q.question_type))
  const biblicalQs = questions.filter(q => BIBLICAL_KEYS.includes(q.question_type))
  const st = STATUS_META[exam?.status] || STATUS_META.draft
  const canEdit = ['draft', 'returned'].includes(exam?.status)
  const canSubmit = ['draft', 'returned'].includes(exam?.status) && questions.length > 0
  const canGenerate = exam?.status === 'approved'

  // ── Edit handlers ────────────────────────────────────────────────────────────
  function startEdit(q) {
    if (!canEdit) return
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
      const { error: err } = await supabase.from('exam_blueprints').update({ sections: updatedSections }).eq('id', bp.id)
      setSaving(false)
      if (err) { showToast('Error: ' + err.message, 'error'); return }
      bp.sections = updatedSections
    } else { setSaving(false) }
    setQuestions(prev => prev.map(p => (p.id === q.id || p.position === q.position) ? { ...p, ...updates } : p))
    setEditingId(null)
    showToast('Pregunta guardada', 'success')
  }

  // ── Print (HTML → PDF) ───────────────────────────────────────────────────────
  async function handlePrint() {
    setPrinting(true)
    try {
      await printExamHtml({ assessment: exam, questions, school: school || {}, teacherName: teacher?.full_name || '' })
    } catch (err) { showToast('Error al imprimir: ' + err.message, 'error') }
    finally { setPrinting(false) }
  }

  // ── Export DOCX ──────────────────────────────────────────────────────────────
  async function handleDocx() {
    setExportingDocx(true)
    try {
      await exportExamDocx({ assessment: exam, questions, school: school || {}, teacherName: teacher?.full_name || '' })
      showToast('DOCX descargado', 'success')
    } catch (err) { showToast('Error DOCX: ' + err.message, 'error') }
    finally { setExportingDocx(false) }
  }

  // ── Archive HTML to Storage ──────────────────────────────────────────────────
  async function archiveHtml() {
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
      assessment: exam, questions, logoBase64,
      school: school || {}, teacherName: teacher?.full_name || '',
    })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const safeTitle = (exam.title || 'Examen').replace(/[^\w\s-]/g, '').trim().slice(0, 40).replace(/\s+/g, '_')
    const filePath = `archives/${teacher.school_id}/exams/${exam.id}/${safeTitle}_${timestamp}.html`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const { error: upErr } = await supabase.storage
      .from('guide-images')
      .upload(filePath, blob, { contentType: 'text/html', upsert: false })
    if (upErr) throw new Error(upErr.message)

    return filePath
  }

  // ── Archive button (manual) ──────────────────────────────────────────────────
  async function handleArchive() {
    setArchiving(true)
    try {
      const path = await archiveHtml()
      await supabase.from('exam_blueprints').update({ archive_url: path }).eq('id', exam.id)
      setArchived(true)
      showToast('Examen archivado en la biblioteca de documentos', 'success')
    } catch (err) { showToast('Error: ' + err.message, 'error') }
    finally { setArchiving(false) }
  }

  // ── Submit for review ────────────────────────────────────────────────────────
  async function handleSubmit() {
    setSubmitting(true)
    try {
      // 1. Archive HTML as evidence
      const archivePath = await archiveHtml()

      // 2. Update blueprint status
      const { error: upErr } = await supabase
        .from('exam_blueprints')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          archive_url: archivePath,
        })
        .eq('id', exam.id)
      if (upErr) throw new Error(upErr.message)

      // 3. Notify supervisor (in-app notification)
      try {
        const { data: admins } = await supabase
          .from('teachers')
          .select('id')
          .eq('school_id', teacher.school_id)
          .in('role', ['admin', 'superadmin', 'rector'])
        if (admins?.length) {
          const notifs = admins.map(a => ({
            school_id: teacher.school_id,
            from_id: teacher.id,
            to_id: a.id,
            type: 'exam_submitted',
            title: 'Examen enviado a revisión',
            message: `${teacher.full_name} envió "${exam.title}" (${exam.grade} · ${exam.subject}) para aprobación.`,
            data: { blueprint_id: exam.id },
          }))
          await supabase.from('notifications').insert(notifs)
        }
      } catch { /* notification failure is non-blocking */ }

      setArchived(true)
      showToast('Examen enviado a revisión. El supervisor será notificado.', 'success')
      await load() // refresh status + feedback
    } catch (err) {
      showToast('Error al enviar: ' + err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
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

      {/* ── Back ─────────────────────────────────────────────────────── */}
      <button type="button" onClick={() => navigate('/exams')}
        style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 13, cursor: 'pointer', padding: '4px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        ← Volver a exámenes
      </button>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #1F3864 0%, #2E5598 100%)', borderRadius: 14, padding: '20px 24px', marginBottom: 20, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{exam.title}</h1>
              <span style={{
                padding: '3px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                background: `${st.bg}CC`, color: st.color, border: `1px solid ${st.border}`,
              }}>
                {st.icon} {st.label}
              </span>
            </div>
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

      {/* ── Status banners ───────────────────────────────────────────── */}
      {exam.status === 'submitted' && (
        <Banner bg="#EFF6FF" border="#BFDBFE" color="#1E40AF" icon="📨"
          title="Examen enviado a revisión"
          text={`Enviado el ${fmt(exam.submitted_at)}. Esperando aprobación del supervisor.`}
        />
      )}

      {exam.status === 'returned' && (
        <Banner bg="#FEF3C7" border="#FCD34D" color="#92400E" icon="🔄"
          title="Examen devuelto por el supervisor"
          text="Revisa los comentarios del supervisor, realiza los ajustes necesarios y vuelve a enviar."
        />
      )}

      {exam.status === 'approved' && (
        <Banner bg="#ECFDF5" border="#A7F3D0" color="#065F46" icon="✅"
          title="Examen aprobado"
          text={`Aprobado el ${fmt(exam.approved_at)}. Ya puedes generar las instancias para los estudiantes.`}
        />
      )}

      {/* ── Feedback history ─────────────────────────────────────────── */}
      {feedback.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            💬 Historial de revisión
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feedback.map(fb => {
              const isApproved = fb.action === 'approved'
              const isReturned = fb.action === 'returned'
              return (
                <div key={fb.id} style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: isApproved ? '#F0FDF4' : isReturned ? '#FEF9EE' : '#F8FAFC',
                  border: `1px solid ${isApproved ? '#BBF7D0' : isReturned ? '#FDE68A' : '#E2E8F0'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isApproved ? '#15803D' : isReturned ? '#92400E' : '#475569' }}>
                      {isApproved ? '✅ Aprobado' : isReturned ? '🔄 Devuelto' : '💬 Comentario'}
                      {fb.reviewer?.full_name && (
                        <span style={{ fontWeight: 400, marginLeft: 6 }}>por {fb.reviewer.full_name}</span>
                      )}
                    </span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{fmt(fb.created_at)}</span>
                  </div>
                  {fb.comments && (
                    <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{fb.comments}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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
              {canEdit && (
                <button type="button" onClick={() => editingId === q.id ? setEditingId(null) : startEdit(q)}
                  style={{ padding: '4px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: editingId === q.id ? '#FEE2E2' : '#EFF6FF',
                    color: editingId === q.id ? '#DC2626' : '#1D4ED8',
                    border: `1px solid ${editingId === q.id ? '#FCA5A5' : '#BFDBFE'}` }}>
                  {editingId === q.id ? '✕ Cancelar' : '✏ Editar'}
                </button>
              )}
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

      {/* ── Footer — actions ─────────────────────────────────────────── */}
      <div style={{
        marginTop: 24, padding: '20px', background: '#F8FAFC', borderRadius: 14,
        border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Summary */}
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

        {/* Export row */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={handlePrint} disabled={printing}
            style={{
              flex: 1, minWidth: 160, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: printing ? 'default' : 'pointer',
              background: 'linear-gradient(135deg, #DC2626, #991B1B)', color: '#fff', border: 'none', opacity: printing ? 0.7 : 1,
            }}>
            {printing ? '⏳ Preparando…' : '🖨️ PDF'}
          </button>
          <button type="button" onClick={handleDocx} disabled={exportingDocx}
            style={{
              flex: 1, minWidth: 160, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: exportingDocx ? 'default' : 'pointer',
              background: 'linear-gradient(135deg, #1D4ED8, #1E3A8A)', color: '#fff', border: 'none', opacity: exportingDocx ? 0.7 : 1,
            }}>
            {exportingDocx ? '⏳ Generando…' : '📄 Word DOCX'}
          </button>
          <button type="button" onClick={handleArchive} disabled={archiving || archived}
            style={{
              flex: 1, minWidth: 160, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: (archiving || archived) ? 'default' : 'pointer',
              background: archived ? '#ECFDF5' : 'linear-gradient(135deg, #475569, #1E293B)', color: archived ? '#065F46' : '#fff',
              border: archived ? '1.5px solid #A7F3D0' : 'none', opacity: archiving ? 0.7 : 1,
            }}>
            {archiving ? '⏳ Archivando…' : archived ? '✓ Archivado' : '📁 Archivar'}
          </button>
        </div>

        {/* ── Workflow action row ─────────────────────────────────────── */}
        {canSubmit && (
          <button type="button" onClick={handleSubmit} disabled={submitting}
            style={{
              width: '100%', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: submitting ? 'default' : 'pointer',
              background: submitting ? '#9CA3AF' : 'linear-gradient(135deg, #059669, #047857)',
              color: '#fff', border: 'none', letterSpacing: 0.5,
              boxShadow: submitting ? 'none' : '0 4px 14px rgba(5,150,105,.35)',
              transition: 'all .2s ease',
            }}>
            {submitting ? '⏳ Enviando a revisión…' : '📨 Enviar a revisión del supervisor'}
          </button>
        )}

        {canGenerate && (
          <GenerarRosterInline exam={exam} teacher={teacher} school={school} onDone={load} />
        )}

        {/* Explanatory text */}
        <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.6 }}>
          {canSubmit && (
            <p style={{ margin: 0 }}>
              Al enviar a revisión, se archiva una copia inmutable del examen y el supervisor recibe una notificación.
              Las preguntas quedan bloqueadas hasta que el supervisor apruebe o devuelva el examen.
            </p>
          )}
          {exam.status === 'submitted' && (
            <p style={{ margin: 0 }}>
              El examen está en manos del supervisor. No se puede editar hasta que sea aprobado o devuelto.
            </p>
          )}
          {canGenerate && (
            <p style={{ margin: 0 }}>
              El supervisor aprobó el examen. Genera las instancias por roster para activar el portal de estudiantes.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}

function Banner({ bg, border, color, icon, title, text }) {
  return (
    <div style={{
      marginBottom: 16, padding: '14px 18px', borderRadius: 12,
      background: bg, border: `1.5px solid ${border}`, color,
    }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{icon} {title}</div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>{text}</p>
    </div>
  )
}

// ── Inline roster generator (replaces modal for approved exams) ─────────────
function GenerarRosterInline({ exam, teacher, school, onDone }) {
  const { showToast } = useToast()
  const [phase, setPhase]       = useState('idle')   // idle | loading | confirm | generating | done
  const [roster, setRoster]     = useState(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult]     = useState(null)
  const [accessCode, setAccessCode] = useState(exam.access_code || null)

  async function loadRoster() {
    setPhase('loading')
    // exam.grade is combined ("8.° Blue") — school_students uses base grade + section separately
    const parts = exam.grade.match(/^(.+?)\s+(\S+)$/)
    const baseGrade = parts ? parts[1] : exam.grade
    const section = parts ? parts[2] : ''

    let query = supabase
      .from('school_students')
      .select('id, first_name, second_name, first_lastname, second_lastname, email, student_code, section')
      .eq('school_id', teacher.school_id)
      .eq('grade', baseGrade)
    if (section) query = query.eq('section', section)
    query = query.order('first_lastname')

    const { data, error } = await query
    if (error) { showToast('Error: ' + error.message, 'error'); setPhase('idle'); return }
    setRoster(data || [])
    setPhase('confirm')
  }

  async function handleGenerate() {
    if (!roster?.length) return
    setPhase('generating')
    setProgress(0)

    try {
      const bp = exam._blueprint
      const questions = (bp?.sections || []).flatMap(sec => sec.questions || [])
        .sort((a, b) => (a.position || 0) - (b.position || 0))
      if (!questions.length) throw new Error('Sin preguntas.')

      const payload = exam._session?.service_worker_payload || exam.metadata || {}
      const versionCount = payload.version_count || 1
      const shuffleQ = payload.shuffle_questions ?? true
      const shuffleO = payload.shuffle_options ?? true

      // Get or create session
      let sessionId = exam._session?.id
      let v2Code = exam._session?.access_code
      if (!sessionId) {
        v2Code = Math.random().toString(36).substring(2, 8).toUpperCase()
        const { data: session, error: sErr } = await supabase
          .from('exam_sessions')
          .insert({
            school_id: teacher.school_id, teacher_id: teacher.id,
            blueprint_id: exam.id, title: exam.title,
            subject: exam.subject, grade: exam.grade,
            period: exam.period || 1, access_code: v2Code,
            status: 'active', duration_minutes: exam.time_limit_minutes || 60,
            total_students: roster.length,
          })
          .select('id')
          .single()
        if (sErr || !session?.id) throw new Error('Error sesión: ' + (sErr?.message || ''))
        sessionId = session.id
      } else {
        await supabase.from('exam_sessions').update({ status: 'active', total_students: roster.length }).eq('id', sessionId)
      }

      // Update blueprint status to ready/active
      await supabase.from('exam_blueprints').update({ status: 'ready' }).eq('id', exam.id)

      const VERSION_LABELS = ['A', 'B', 'C', 'D']
      let created = 0, failed = 0

      for (let i = 0; i < roster.length; i++) {
        const student = roster[i]
        const vIdx = i % versionCount
        const vLabel = `Versión ${VERSION_LABELS[vIdx] || 'A'}`
        const seed = (vIdx + 1) * 31337

        let qs = questions.map((q, idx) => ({
          id: q.id || `q-${idx}`, question_type: q.question_type,
          stem: q.stem, options: q.options, correct_answer: q.correct_answer,
          points: q.points, evaluation_criteria: q.evaluation_criteria || '',
          position: q.position ?? idx, section_name: q.section_name || '',
        }))

        if (shuffleQ && vIdx > 0) qs = seededShuffle(qs, seed)
        if (shuffleO) {
          qs = qs.map(q => {
            if (q.question_type !== 'multiple_choice' || !Array.isArray(q.options) || q.options.length < 2) return q
            const correctText = q.options[q.correct_answer?.charCodeAt(0) - 65] || ''
            const shuffled = seededShuffle([...q.options], seed + (q.position || 0))
            const newIdx = shuffled.findIndex(o => o === correctText)
            return { ...q, options: shuffled, correct_answer: String.fromCharCode(65 + (newIdx >= 0 ? newIdx : 0)) }
          })
        }

        const { error: iErr } = await supabase.from('exam_instances').insert({
          session_id: sessionId, student_name: displayName(student) || student.email,
          student_email: student.email, student_id: student.id,
          student_section: student.section || '', version_number: vIdx + 1,
          version_label: vLabel, generated_questions: qs,
          instance_status: 'pending',
        })
        if (iErr) failed++; else created++
        setProgress(Math.round(((i + 1) / roster.length) * 100))
      }

      setAccessCode(v2Code)
      setResult({ created, failed, code: v2Code, sessionId })
      setPhase('done')
      showToast(`${created} instancias generadas. Código: ${v2Code}`, 'success')
      if (onDone) onDone()
    } catch (err) {
      showToast('Error: ' + err.message, 'error')
      setPhase('confirm')
    }
  }

  if (phase === 'idle') {
    return (
      <button type="button" onClick={loadRoster}
        style={{
          width: '100%', padding: '14px 24px', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer',
          background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff', border: 'none',
          boxShadow: '0 4px 14px rgba(31,56,100,.35)', letterSpacing: 0.5,
        }}>
        👥 Generar instancias por roster (Exam Player V2)
      </button>
    )
  }

  if (phase === 'loading') {
    return <div style={{ textAlign: 'center', padding: 16, color: '#64748B', fontSize: 13 }}>⏳ Cargando roster…</div>
  }

  if (phase === 'confirm') {
    return (
      <div style={{ padding: '16px', background: '#EFF6FF', borderRadius: 12, border: '1px solid #BFDBFE' }}>
        <p style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#1E40AF' }}>
          👥 {roster?.length || 0} estudiantes encontrados en {exam.grade}
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#475569' }}>
          Se generará una instancia única por estudiante con preguntas reordenadas según la configuración de versiones.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={handleGenerate} disabled={!roster?.length}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff', border: 'none' }}>
            Generar {roster?.length} instancias
          </button>
          <button type="button" onClick={() => setPhase('idle')}
            style={{ padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: '#fff', color: '#475569', border: '1px solid #CBD5E1' }}>
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'generating') {
    return (
      <div style={{ padding: '16px', background: '#EFF6FF', borderRadius: 12, border: '1px solid #BFDBFE', textAlign: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1E40AF', marginBottom: 8 }}>
          Generando instancias… {progress}%
        </div>
        <div style={{ height: 6, background: '#DBEAFE', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${progress}%`, height: '100%', background: '#2563EB', borderRadius: 3, transition: 'width .3s' }} />
        </div>
      </div>
    )
  }

  // done
  return (
    <div style={{ padding: '16px', background: '#F0FDF4', borderRadius: 12, border: '1px solid #BBF7D0' }}>
      <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: '#15803D' }}>
        ✅ {result?.created} instancias generadas
        {result?.failed > 0 && <span style={{ color: '#DC2626' }}> · {result.failed} errores</span>}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#065F46' }}>
        Código de acceso: <strong style={{ fontSize: 16, letterSpacing: 2, fontFamily: 'monospace' }}>{result?.code}</strong>
      </p>
      <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>
        Los estudiantes acceden en <code>/eval</code> con su correo institucional y este código.
      </p>
    </div>
  )
}
