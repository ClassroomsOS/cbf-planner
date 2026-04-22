// ── ExamReviewPage.jsx ────────────────────────────────────────────────────────
// /exams/review — Human review panel for AI evaluations with confidence < 0.65.
// Docente confirms AI score or overrides with manual score + reason.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'

function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#22C55E' : pct >= 65 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
    </div>
  )
}

function ReviewCard({ item, onAction }) {
  const { showToast } = useToast()
  const [overrideScore, setOverrideScore] = useState('')
  const [reason, setReason] = useState('')
  const [showOverride, setShowOverride] = useState(false)
  const [saving, setSaving] = useState(false)

  async function confirm() {
    setSaving(true)
    const { error } = await supabase
      .from('human_overrides')
      .insert({
        ai_evaluation_id: item.eval_id,
        submission_id: item.submission_id,
        school_id: item.school_id,
        overridden_by: item.overridden_by,
        original_score: item.ai_score,
        adjusted_score: item.ai_score, // same — confirming
        reason: 'Confirmado por docente sin cambios.',
        status: 'adjusted',
      })
    if (error) { showToast('Error al confirmar: ' + error.message, 'error'); setSaving(false); return }

    // Mark eval as no longer requires_review
    await supabase.from('ai_evaluations').update({ requires_review: false }).eq('id', item.eval_id)
    showToast('Evaluación confirmada', 'success')
    onAction(item.eval_id)
    setSaving(false)
  }

  async function override() {
    const score = parseFloat(overrideScore)
    if (isNaN(score) || score < 0 || score > item.max_score) {
      showToast(`Puntaje debe ser entre 0 y ${item.max_score}`, 'warning')
      return
    }
    if (!reason.trim()) {
      showToast('Escribe una razón para la corrección.', 'warning')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('human_overrides')
      .insert({
        ai_evaluation_id: item.eval_id,
        submission_id: item.submission_id,
        school_id: item.school_id,
        overridden_by: item.overridden_by,
        original_score: item.ai_score,
        adjusted_score: score,
        reason: reason.trim(),
        status: 'adjusted',
      })
    if (error) { showToast('Error: ' + error.message, 'error'); setSaving(false); return }

    // Update ai_evaluation with override score + mark reviewed
    await supabase.from('ai_evaluations')
      .update({ score_awarded: score, requires_review: false })
      .eq('id', item.eval_id)

    showToast('Puntaje corregido y guardado', 'success')
    onAction(item.eval_id)
    setSaving(false)
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,.05)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1F3864', marginBottom: 3 }}>
            {item.student_name || 'Estudiante sin nombre'}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {item.exam_title} · {fmt(item.evaluated_at)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Confianza IA</div>
          <div style={{ minWidth: 160 }}>
            <ConfidenceBar value={item.confidence} />
          </div>
        </div>
      </div>

      {/* Question */}
      <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Pregunta:</p>
        <p style={{ margin: 0, fontSize: 13, color: '#1F3864' }}>{item.question_stem}</p>
      </div>

      {/* Student answer */}
      <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: '#1D4ED8' }}>Respuesta del estudiante:</p>
        <p style={{ margin: 0, fontSize: 13, color: '#1F3864', whiteSpace: 'pre-wrap' }}>
          {item.student_answer || <em style={{ color: '#9CA3AF' }}>Sin respuesta</em>}
        </p>
      </div>

      {/* AI evaluation */}
      <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#15803D' }}>Evaluación IA:</p>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#15803D' }}>
            {item.ai_score}/{item.max_score} pts
          </span>
        </div>
        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#374151' }}>{item.ai_feedback}</p>
        {item.detected_concepts?.length > 0 && (
          <div style={{ fontSize: 11, color: '#64748B' }}>
            ✓ Detectados: {item.detected_concepts.join(', ')}
          </div>
        )}
        {item.missing_concepts?.length > 0 && (
          <div style={{ fontSize: 11, color: '#EF4444', marginTop: 2 }}>
            ✗ Faltó: {item.missing_concepts.join(', ')}
          </div>
        )}
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>
          Razonamiento: {item.ai_reasoning}
        </p>
      </div>

      {/* Override form */}
      {showOverride && (
        <div style={{
          background: '#FFFBEB', borderRadius: 8, padding: '12px',
          border: '1px solid #FDE68A', marginBottom: 12,
        }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#92400E' }}>
            Corrección manual
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>
                Nuevo puntaje (0–{item.max_score})
              </label>
              <input type="number" min="0" max={item.max_score} step="0.5"
                value={overrideScore}
                onChange={e => setOverrideScore(e.target.value)}
                placeholder={item.ai_score}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>
              Razón de la corrección *
            </label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              rows={2} placeholder="Explica por qué cambias el puntaje de la IA…"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {!showOverride && (
          <button type="button" onClick={() => setShowOverride(true)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            background: '#FFFBEB', color: '#92400E',
            border: '1px solid #FDE68A', cursor: 'pointer',
          }}>✏️ Corregir</button>
        )}
        {showOverride && (
          <>
            <button type="button" onClick={() => setShowOverride(false)} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12,
              background: '#F1F5F9', color: '#374151', border: 'none', cursor: 'pointer',
            }}>Cancelar</button>
            <button type="button" onClick={override} disabled={saving} style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: '#F59E0B', color: '#fff', border: 'none',
              cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1,
            }}>
              {saving ? '…' : '💾 Guardar corrección'}
            </button>
          </>
        )}
        <button type="button" onClick={confirm} disabled={saving} style={{
          padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: '#15803D', color: '#fff', border: 'none',
          cursor: saving ? 'default' : 'pointer', opacity: saving ? .7 : 1,
        }}>
          {saving ? '…' : '✓ Confirmar IA'}
        </button>
      </div>
    </div>
  )
}

export default function ExamReviewPage({ teacher }) {
  const { showToast } = useToast()
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('')  // exam title filter

  const load = useCallback(async () => {
    setLoading(true)
    const schoolId = teacher.school_id

    // Get teacher's question IDs via assessments
    const { data: aRows } = await supabase
      .from('assessments')
      .select('id, title, created_by')
      .eq('school_id', schoolId)
      .eq('created_by', teacher.id)

    if (!aRows?.length) { setItems([]); setLoading(false); return }
    const assessmentIds = aRows.map(a => a.id)
    const examTitles = Object.fromEntries(aRows.map(a => [a.id, a.title]))

    const { data: qRows } = await supabase
      .from('questions')
      .select('id, stem, assessment_id')
      .in('assessment_id', assessmentIds)

    if (!qRows?.length) { setItems([]); setLoading(false); return }
    const questionIds = qRows.map(q => q.id)
    const qMap = Object.fromEntries(qRows.map(q => [q.id, q]))

    // Get pending AI evaluations
    const { data: evalRows } = await supabase
      .from('ai_evaluations')
      .select('id, submission_id, question_id, school_id, score_awarded, max_score, feedback, reasoning, confidence, detected_concepts, missing_concepts, created_at')
      .eq('requires_review', true)
      .eq('is_active', true)
      .in('question_id', questionIds)
      .order('confidence', { ascending: true }) // lowest confidence first
      .limit(50)

    if (!evalRows?.length) { setItems([]); setLoading(false); return }

    // Get submission answers + student names
    const submissionIds = evalRows.map(e => e.submission_id)
    const { data: subRows } = await supabase
      .from('submissions')
      .select('id, answer, session_id')
      .in('id', submissionIds)
    const subMap = Object.fromEntries((subRows || []).map(s => [s.id, s]))

    const sessionIds = [...new Set((subRows || []).map(s => s.session_id).filter(Boolean))]
    const { data: sesRows } = await supabase
      .from('student_exam_sessions')
      .select('id, student_name, assessment_id')
      .in('id', sessionIds)
    const sesMap = Object.fromEntries((sesRows || []).map(s => [s.id, s]))

    // Check which evals already have human_overrides
    const evalIds = evalRows.map(e => e.id)
    const { data: overrideRows } = await supabase
      .from('human_overrides')
      .select('ai_evaluation_id')
      .in('ai_evaluation_id', evalIds)
    const overriddenIds = new Set((overrideRows || []).map(o => o.ai_evaluation_id))

    // Build items list (exclude already-overridden)
    const result = evalRows
      .filter(e => !overriddenIds.has(e.id))
      .map(e => {
        const sub = subMap[e.submission_id] || {}
        const ses = sesMap[sub.session_id] || {}
        const q   = qMap[e.question_id] || {}
        const assessmentId = q.assessment_id
        return {
          eval_id: e.id,
          submission_id: e.submission_id,
          school_id: e.school_id,
          overridden_by: teacher.id,
          ai_score: e.score_awarded,
          max_score: e.max_score,
          ai_feedback: e.feedback,
          ai_reasoning: e.reasoning,
          confidence: e.confidence,
          detected_concepts: e.detected_concepts || [],
          missing_concepts: e.missing_concepts || [],
          evaluated_at: e.created_at,
          student_answer: sub.answer?.text || JSON.stringify(sub.answer || ''),
          student_name: ses.student_name,
          question_stem: q.stem,
          exam_title: examTitles[assessmentId] || '—',
          assessment_id: assessmentId,
        }
      })

    setItems(result)
    setLoading(false)
  }, [teacher.id, teacher.school_id])

  useEffect(() => { load() }, [load])

  function removeItem(evalId) {
    setItems(prev => prev.filter(i => i.eval_id !== evalId))
  }

  const filtered = filter
    ? items.filter(i => i.exam_title.toLowerCase().includes(filter.toLowerCase()))
    : items

  const exams = [...new Set(items.map(i => i.exam_title))].sort()

  return (
    <div style={{ padding: '24px 28px', maxWidth: 780 }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 700 }}>
          👁 Revisión Humana — Correcciones IA
        </h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
          {loading ? '…' : `${items.length} evaluación${items.length !== 1 ? 'es' : ''} pendiente${items.length !== 1 ? 's' : ''} de revisión`}
          {items.length > 0 && ' · Ordenadas de menor a mayor confianza IA'}
        </p>
      </div>

      {/* Filter */}
      {exams.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, background: '#fff' }}>
            <option value="">Todos los exámenes</option>
            {exams.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      )}

      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Cargando evaluaciones pendientes…</p>}

      {!loading && filtered.length === 0 && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 12,
          padding: '40px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
          <h3 style={{ margin: '0 0 6px', color: '#15803D' }}>¡Todo al día!</h3>
          <p style={{ color: '#6B7280', margin: 0, fontSize: 14 }}>
            No hay evaluaciones pendientes de revisión humana.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filtered.map(item => (
          <ReviewCard key={item.eval_id} item={item} onAction={removeItem} />
        ))}
      </div>
    </div>
  )
}
