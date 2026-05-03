// ── ExamRevisionPage.jsx ──────────────────────────────────────────────────────
// /exams/revision — Supervisor queue for approving/returning submitted exams.
// Parallel to /sala-revision (lesson plans) but for exams.
//
// Access: admin, superadmin, rector (canManage)
// Flow:  submitted → approved | returned
// On approve → status='approved', approved_at, reviewer_id
// On return  → status='returned', feedback with comments
// Archived HTML displayed in iframe for review

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { canManage } from '../utils/roles'

function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_META = {
  submitted: { label: 'Pendiente',  icon: '📨', bg: '#EFF6FF', color: '#1E40AF' },
  approved:  { label: 'Aprobado',   icon: '✅', bg: '#ECFDF5', color: '#065F46' },
  returned:  { label: 'Devuelto',   icon: '🔄', bg: '#FEF3C7', color: '#92400E' },
}

export default function ExamRevisionPage({ teacher }) {
  const { showToast } = useToast()
  const [exams, setExams]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(null)
  const [feedback, setFeedback]         = useState([])
  const [comments, setComments]         = useState('')
  const [processing, setProcessing]     = useState(false)
  const [filter, setFilter]             = useState('submitted') // submitted | all
  const [archiveHtml, setArchiveHtml]   = useState(null)
  const [loadingHtml, setLoadingHtml]   = useState(false)

  // ── Load exams ───────────────────────────────────────────────────────────────
  const loadExams = useCallback(async () => {
    setLoading(true)
    const query = supabase
      .from('exam_blueprints')
      .select('*, teacher:teacher_id(full_name)')
      .eq('school_id', teacher.school_id)
      .order('submitted_at', { ascending: false })

    if (filter === 'submitted') {
      query.eq('status', 'submitted')
    } else {
      query.in('status', ['submitted', 'approved', 'returned'])
    }

    const { data, error } = await query
    if (error) showToast('Error: ' + error.message, 'error')
    setExams(data || [])
    setLoading(false)
  }, [teacher.school_id, filter])

  useEffect(() => { loadExams() }, [loadExams])

  // ── Load feedback for selected exam ──────────────────────────────────────────
  async function loadFeedback(examId) {
    const { data } = await supabase
      .from('exam_feedback')
      .select('*, reviewer:reviewer_id(full_name)')
      .eq('blueprint_id', examId)
      .order('created_at', { ascending: false })
    setFeedback(data || [])
  }

  // ── Load archived HTML ───────────────────────────────────────────────────────
  async function loadArchive(archiveUrl) {
    if (!archiveUrl) { setArchiveHtml(null); return }
    setLoadingHtml(true)
    try {
      const { data, error } = await supabase.storage
        .from('guide-images')
        .download(archiveUrl)
      if (error) throw error
      const text = await data.text()
      setArchiveHtml(text)
    } catch {
      setArchiveHtml(null)
      showToast('No se pudo cargar la vista previa del examen', 'error')
    } finally {
      setLoadingHtml(false)
    }
  }

  // ── Select exam ──────────────────────────────────────────────────────────────
  function handleSelect(exam) {
    setSelected(exam)
    setComments('')
    setArchiveHtml(null)
    loadFeedback(exam.id)
    loadArchive(exam.archive_url)
  }

  // ── Approve ──────────────────────────────────────────────────────────────────
  async function handleApprove() {
    if (!selected) return
    setProcessing(true)
    try {
      // 1. Update blueprint
      const { error: upErr } = await supabase
        .from('exam_blueprints')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          reviewer_id: teacher.id,
        })
        .eq('id', selected.id)
      if (upErr) throw upErr

      // 2. Create feedback record
      const { error: fbErr } = await supabase
        .from('exam_feedback')
        .insert({
          blueprint_id: selected.id,
          school_id: teacher.school_id,
          reviewer_id: teacher.id,
          action: 'approved',
          comments: comments.trim() || 'Examen aprobado.',
        })
      if (fbErr) throw fbErr

      // 3. Notify teacher
      try {
        await supabase.from('notifications').insert({
          school_id: teacher.school_id,
          from_id: teacher.id,
          to_id: selected.teacher_id,
          type: 'exam_approved',
          title: 'Examen aprobado',
          message: `Tu examen "${selected.title}" fue aprobado por ${teacher.full_name}. Ya puedes generar las instancias para los estudiantes.`,
          data: { blueprint_id: selected.id },
        })
      } catch { /* non-blocking */ }

      showToast('Examen aprobado. El docente será notificado.', 'success')
      setSelected(null)
      await loadExams()
    } catch (err) {
      showToast('Error: ' + (err.message || err), 'error')
    } finally {
      setProcessing(false)
    }
  }

  // ── Return ───────────────────────────────────────────────────────────────────
  async function handleReturn() {
    if (!selected || !comments.trim()) {
      showToast('Escribe los comentarios de devolución antes de enviar.', 'warning')
      return
    }
    setProcessing(true)
    try {
      // 1. Update blueprint
      const { error: upErr } = await supabase
        .from('exam_blueprints')
        .update({
          status: 'returned',
          reviewer_id: teacher.id,
        })
        .eq('id', selected.id)
      if (upErr) throw upErr

      // 2. Create feedback record
      const { error: fbErr } = await supabase
        .from('exam_feedback')
        .insert({
          blueprint_id: selected.id,
          school_id: teacher.school_id,
          reviewer_id: teacher.id,
          action: 'returned',
          comments: comments.trim(),
        })
      if (fbErr) throw fbErr

      // 3. Notify teacher
      try {
        await supabase.from('notifications').insert({
          school_id: teacher.school_id,
          from_id: teacher.id,
          to_id: selected.teacher_id,
          type: 'exam_returned',
          title: 'Examen devuelto para ajustes',
          message: `${teacher.full_name} devolvió tu examen "${selected.title}" con comentarios. Revisa y vuelve a enviar.`,
          data: { blueprint_id: selected.id },
        })
      } catch { /* non-blocking */ }

      showToast('Examen devuelto con feedback. El docente será notificado.', 'success')
      setSelected(null)
      await loadExams()
    } catch (err) {
      showToast('Error: ' + (err.message || err), 'error')
    } finally {
      setProcessing(false)
    }
  }

  // ── Group exams by grade ─────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = {}
    for (const e of exams) {
      const g = e.grade || 'Sin grado'
      if (!map[g]) map[g] = []
      map[g].push(e)
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
  }, [exams])

  const pendingCount = useMemo(() => exams.filter(e => e.status === 'submitted').length, [exams])

  // ── Access guard (after hooks) ───────────────────────────────────────────────
  if (!canManage(teacher.role)) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <p>Solo coordinadores, rectores y superadmin pueden acceder a esta página.</p>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px 40px' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #B91C1C 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24, color: '#fff',
      }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
          🏛 Revisión de Exámenes
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: '#FCA5A5' }}>
          Aprueba o devuelve los exámenes enviados por los docentes antes de activar el portal de estudiantes.
        </p>
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'submitted', label: `Pendientes (${pendingCount})` },
          { key: 'all', label: 'Todos' },
        ].map(f => (
          <button key={f.key} type="button" onClick={() => { setFilter(f.key); setSelected(null) }}
            style={{
              padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: filter === f.key ? '#1F3864' : '#F1F5F9',
              color: filter === f.key ? '#fff' : '#475569',
              border: `1.5px solid ${filter === f.key ? '#1F3864' : '#E2E8F0'}`,
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Layout: list + detail ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Left: exam list ──────────────────────────────────────── */}
        <div style={{ flex: '0 0 380px', maxWidth: 380 }}>
          {loading && <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>⏳ Cargando…</div>}

          {!loading && exams.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p>No hay exámenes pendientes de revisión.</p>
            </div>
          )}

          {grouped.map(([grade, items]) => (
            <div key={grade} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, padding: '4px 0', borderBottom: '1px solid #E2E8F0', marginBottom: 6 }}>
                {grade}
              </div>
              {items.map(exam => {
                const sm = STATUS_META[exam.status] || STATUS_META.submitted
                const isSelected = selected?.id === exam.id
                return (
                  <button key={exam.id} type="button" onClick={() => handleSelect(exam)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 6,
                      borderRadius: 10, cursor: 'pointer', transition: 'all .15s',
                      background: isSelected ? '#EFF6FF' : '#fff',
                      border: `1.5px solid ${isSelected ? '#3B82F6' : '#E2E8F0'}`,
                      boxShadow: isSelected ? '0 2px 8px rgba(59,130,246,.15)' : 'none',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{exam.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: sm.bg, color: sm.color }}>
                        {sm.icon} {sm.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>
                      {exam.subject} · {exam.teacher?.full_name || 'Docente'}
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      Enviado: {fmt(exam.submitted_at)}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* ── Right: detail panel ──────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selected && (
            <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p>Selecciona un examen de la lista para revisarlo.</p>
            </div>
          )}

          {selected && (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>

              {/* Detail header */}
              <div style={{
                padding: '16px 20px', background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff',
              }}>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>{selected.title}</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#93C5FD' }}>
                  {selected.subject} · {selected.grade} · Período {selected.period || '—'}
                  {selected.estimated_minutes ? ` · ${selected.estimated_minutes} min` : ''}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#BFDBFE' }}>
                  Docente: {selected.teacher?.full_name || '—'} · Enviado: {fmt(selected.submitted_at)}
                </p>
              </div>

              {/* Exam stats */}
              <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                {(() => {
                  const qs = (selected.sections || []).flatMap(s => s.questions || [])
                  const biblical = qs.filter(q => ['biblical_reflection', 'verse_analysis', 'principle_application'].includes(q.question_type))
                  const pts = qs.reduce((s, q) => s + parseFloat(q.points || 0), 0)
                  return <>
                    <MiniStat label="Preguntas" value={qs.length} />
                    <MiniStat label="Académicas" value={qs.length - biblical.length} />
                    <MiniStat label="Bíblicas" value={biblical.length} />
                    <MiniStat label="Puntos" value={pts.toFixed(1)} />
                    {selected.metadata?.exam_type && (
                      <MiniStat label="Tipo" value={selected.metadata.exam_type === 'final' ? 'Final' : 'Quiz'} />
                    )}
                  </>
                })()}
              </div>

              {/* Archived preview */}
              <div style={{ padding: '16px 20px' }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>Vista previa del examen</h3>
                {loadingHtml && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>⏳ Cargando vista previa…</div>
                )}
                {!loadingHtml && archiveHtml && (
                  <iframe
                    title="Exam preview"
                    srcDoc={archiveHtml}
                    style={{ width: '100%', height: 500, border: '1px solid #E2E8F0', borderRadius: 8 }}
                    sandbox="allow-same-origin"
                  />
                )}
                {!loadingHtml && !archiveHtml && (
                  <div style={{ textAlign: 'center', padding: 30, color: '#9CA3AF', background: '#F8FAFC', borderRadius: 8 }}>
                    No hay vista previa archivada disponible.
                  </div>
                )}
              </div>

              {/* Feedback history */}
              {feedback.length > 0 && (
                <div style={{ padding: '0 20px 16px' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>Historial de revisión</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {feedback.map(fb => {
                      const isApp = fb.action === 'approved'
                      const isRet = fb.action === 'returned'
                      return (
                        <div key={fb.id} style={{
                          padding: '10px 14px', borderRadius: 8,
                          background: isApp ? '#F0FDF4' : isRet ? '#FEF9EE' : '#F8FAFC',
                          border: `1px solid ${isApp ? '#BBF7D0' : isRet ? '#FDE68A' : '#E2E8F0'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                            <span style={{ fontWeight: 700, color: isApp ? '#15803D' : isRet ? '#92400E' : '#475569' }}>
                              {isApp ? '✅ Aprobado' : isRet ? '🔄 Devuelto' : '💬 Comentario'}
                              {fb.reviewer?.full_name && <span style={{ fontWeight: 400 }}> — {fb.reviewer.full_name}</span>}
                            </span>
                            <span style={{ color: '#9CA3AF' }}>{fmt(fb.created_at)}</span>
                          </div>
                          {fb.comments && <p style={{ margin: 0, fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap' }}>{fb.comments}</p>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Action area — only for submitted exams */}
              {selected.status === 'submitted' && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA' }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Comentarios del supervisor
                  </label>
                  <textarea
                    value={comments}
                    onChange={e => setComments(e.target.value)}
                    rows={3}
                    placeholder="Escribe tus observaciones, sugerencias o razones de devolución…"
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
                      border: '1.5px solid #D1D5DB', resize: 'vertical', boxSizing: 'border-box',
                      fontFamily: 'inherit', lineHeight: 1.5,
                    }}
                  />

                  <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                    <button type="button" onClick={handleApprove} disabled={processing}
                      style={{
                        flex: 1, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        cursor: processing ? 'default' : 'pointer',
                        background: processing ? '#9CA3AF' : 'linear-gradient(135deg, #059669, #047857)',
                        color: '#fff', border: 'none',
                        boxShadow: processing ? 'none' : '0 4px 12px rgba(5,150,105,.3)',
                      }}>
                      {processing ? '⏳…' : '✅ Aprobar examen'}
                    </button>
                    <button type="button" onClick={handleReturn} disabled={processing || !comments.trim()}
                      style={{
                        flex: 1, padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        cursor: (processing || !comments.trim()) ? 'default' : 'pointer',
                        background: processing ? '#9CA3AF' : 'linear-gradient(135deg, #D97706, #B45309)',
                        color: '#fff', border: 'none',
                        opacity: !comments.trim() ? 0.5 : 1,
                        boxShadow: (processing || !comments.trim()) ? 'none' : '0 4px 12px rgba(217,119,6,.3)',
                      }}>
                      {processing ? '⏳…' : '🔄 Devolver con feedback'}
                    </button>
                  </div>

                  {!comments.trim() && (
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: '8px 0 0', textAlign: 'center' }}>
                      Para devolver el examen, los comentarios son obligatorios.
                    </p>
                  )}
                </div>
              )}

              {/* Already processed */}
              {selected.status !== 'submitted' && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA', textAlign: 'center' }}>
                  <span style={{ fontSize: 13, color: '#6B7280' }}>
                    Este examen ya fue {selected.status === 'approved' ? 'aprobado' : 'devuelto'}.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#1F3864' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}
