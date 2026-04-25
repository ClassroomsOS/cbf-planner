// ── ExamReviewPage.jsx ────────────────────────────────────────────────────────
// /exams/review — Panel de revisión humana para evaluaciones IA con confianza < 0.65
//
// Flujo de datos:
//   assessments (teacher) → questions → ai_evaluations (requires_review=true)
//   → submissions (answer) → student_exam_sessions (student_name)
//
// Flujo de escritura:
//   1. human_overrides INSERT (best-effort — tabla puede no existir)
//   2. ai_evaluations UPDATE (requires_review=false, score_awarded si cambió)
//   3. Recalcular assessment_results (mirrors edge fn exam-ai-corrector)

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function confidenceColor(v) {
  if (v >= 0.80) return '#22C55E'
  if (v >= 0.65) return '#F59E0B'
  return '#EF4444'
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100)
  const color = confidenceColor(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', background: color,
          borderRadius: 3, transition: 'width .4s cubic-bezier(.16,1,.3,1)',
        }} />
      </div>
      <span style={{
        fontSize: 12, fontWeight: 700, color, minWidth: 34, textAlign: 'right',
        fontFamily: 'var(--font-mono)',
      }}>{pct}%</span>
    </div>
  )
}

function ConceptPills({ items, color, bg }) {
  if (!items?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
      {items.map((c, i) => (
        <span key={i} style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: bg, color, fontWeight: 600,
        }}>{c}</span>
      ))}
    </div>
  )
}

// ── Recalculate grade after a human override ──────────────────────────────────
// Mirrors the recalculateSessionResult() logic from exam-ai-corrector edge fn.
async function recalculateGrade(sessionId, schoolId) {
  try {
    const { data: subs } = await supabase
      .from('submissions')
      .select(`
        id, auto_score,
        question:questions!question_id ( points, question_type ),
        ai_eval:ai_evaluations ( score_awarded, is_active )
      `)
      .eq('session_id', sessionId)

    if (!subs?.length) return

    let total = 0, maxScore = 0, autoScore = 0, aiScore = 0, allResolved = true

    for (const s of subs) {
      const pts = s.question?.points || 0
      maxScore += pts
      const isAuto = !['open_development', 'short_answer'].includes(s.question?.question_type)
      if (isAuto) {
        const sc = s.auto_score || 0; total += sc; autoScore += sc
      } else {
        const active = (s.ai_eval || []).find(e => e.is_active)
        if (active) { total += active.score_awarded; aiScore += active.score_awarded }
        else allResolved = false
      }
    }

    const pct        = maxScore > 0 ? Math.round((total / maxScore) * 10000) / 100 : 0
    const finalGrade = maxScore > 0 ? Math.round((1 + (pct / 100) * 4) * 10) / 10 : 1.0

    await supabase.from('assessment_results').upsert({
      session_id:            sessionId,
      school_id:             schoolId,
      total_score:           Math.round(total     * 100) / 100,
      max_score:             Math.round(maxScore  * 100) / 100,
      percentage:            pct,
      final_grade:           finalGrade,
      ai_corrected_score:    Math.round(aiScore   * 100) / 100,
      auto_corrected_score:  Math.round(autoScore * 100) / 100,
      status:                allResolved ? 'complete' : 'partial',
      updated_at:            new Date().toISOString(),
    }, { onConflict: 'session_id' })
  } catch {
    // Best-effort — silent failure, grade will recalculate on next corrector run
  }
}

// ── ReviewCard ────────────────────────────────────────────────────────────────
function ReviewCard({ item, onDone }) {
  const { showToast } = useToast()
  const [overrideScore, setOverrideScore] = useState('')
  const [reason,        setReason]        = useState('')
  const [showOverride,  setShowOverride]  = useState(false)
  const [saving,        setSaving]        = useState(false)

  const risk = item.confidence < 0.5 ? 'high' : 'medium'

  async function saveToHumanOverrides(adjustedScore, reasonText, status) {
    // best-effort — human_overrides table may not exist yet
    try {
      await supabase.from('human_overrides').insert({
        ai_evaluation_id: item.eval_id,
        submission_id:    item.submission_id,
        school_id:        item.school_id,
        overridden_by:    item.reviewer_id,
        original_score:   item.ai_score,
        adjusted_score:   adjustedScore,
        reason:           reasonText,
        status,
      })
    } catch { /* continue even if table does not exist */ }
  }

  async function confirm() {
    setSaving(true)
    await saveToHumanOverrides(item.ai_score, 'Confirmado por docente sin cambios.', 'confirmed')

    const { error } = await supabase
      .from('ai_evaluations')
      .update({ requires_review: false })
      .eq('id', item.eval_id)

    if (error) {
      showToast('Error al confirmar: ' + error.message, 'error')
      setSaving(false)
      return
    }

    await recalculateGrade(item.session_id, item.school_id)
    showToast('Evaluación confirmada ✓', 'success')
    onDone(item.eval_id)
    setSaving(false)
  }

  async function override() {
    const score = parseFloat(overrideScore)
    if (isNaN(score) || score < 0 || score > item.max_score) {
      showToast(`El puntaje debe estar entre 0 y ${item.max_score}`, 'warning')
      return
    }
    if (!reason.trim()) {
      showToast('Escribe la razón de la corrección.', 'warning')
      return
    }
    setSaving(true)

    await saveToHumanOverrides(score, reason.trim(), 'adjusted')

    const { error } = await supabase
      .from('ai_evaluations')
      .update({ score_awarded: score, requires_review: false })
      .eq('id', item.eval_id)

    if (error) {
      showToast('Error al guardar corrección: ' + error.message, 'error')
      setSaving(false)
      return
    }

    await recalculateGrade(item.session_id, item.school_id)
    showToast('Puntaje corregido y nota recalculada ✓', 'success')
    onDone(item.eval_id)
    setSaving(false)
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${risk === 'high' ? '#FECACA' : '#FDE68A'}`,
      borderLeft: `4px solid ${risk === 'high' ? '#EF4444' : '#F59E0B'}`,
      borderRadius: 12,
      padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,.05)',
      transition: 'box-shadow .2s',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1F3864', marginBottom: 2 }}>
            {item.student_name || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Estudiante sin nombre</span>}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{item.exam_title}</span>
            <span style={{ color: '#D0D5DD' }}>·</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(item.evaluated_at)}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>
            Confianza IA
          </div>
          <div style={{ minWidth: 160 }}>
            <ConfidenceBar value={item.confidence} />
          </div>
        </div>
      </div>

      {/* ── Pregunta ── */}
      <div style={{
        background: '#F8FAFC', borderRadius: 8,
        padding: '10px 14px', marginBottom: 12,
        border: '1px solid #E2E8F0',
      }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .3 }}>Pregunta</p>
        <p style={{ margin: 0, fontSize: 13.5, color: '#1F3864', lineHeight: 1.6 }}>{item.question_stem}</p>
      </div>

      {/* ── Respuesta del estudiante ── */}
      <div style={{
        background: '#EFF6FF', borderRadius: 8,
        padding: '10px 14px', marginBottom: 12,
        border: '1px solid #BFDBFE',
      }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: .3 }}>Respuesta del estudiante</p>
        <p style={{ margin: 0, fontSize: 13.5, color: '#1F3864', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {item.student_answer || <em style={{ color: '#9CA3AF' }}>Sin respuesta</em>}
        </p>
      </div>

      {/* ── Evaluación IA ── */}
      <div style={{
        background: '#F0FDF4', borderRadius: 8,
        padding: '12px 14px', marginBottom: 14,
        border: '1px solid #A7F3D0',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: .3 }}>Evaluación IA</p>
          <span style={{
            fontSize: 15, fontWeight: 800, color: '#15803D',
            fontFamily: 'var(--font-mono)',
          }}>
            {item.ai_score}/{item.max_score} pts
          </span>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{item.ai_feedback}</p>
        <ConceptPills items={item.detected_concepts} color="#15803D" bg="#DCFCE7" />
        {item.missing_concepts?.length > 0 && (
          <>
            <p style={{ margin: '8px 0 4px', fontSize: 11, color: '#DC2626', fontWeight: 600 }}>Faltó mencionar:</p>
            <ConceptPills items={item.missing_concepts} color="#DC2626" bg="#FEE2E2" />
          </>
        )}
        {item.ai_reasoning && (
          <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', lineHeight: 1.5 }}>
            Razonamiento IA: {item.ai_reasoning}
          </p>
        )}
      </div>

      {/* ── Formulario de corrección ── */}
      {showOverride && (
        <div style={{
          background: '#FFFBEB', borderRadius: 8,
          padding: '14px', border: '1px solid #FDE68A',
          marginBottom: 14,
        }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#92400E' }}>
            ✏️ Corrección manual
          </p>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: '0 0 140px' }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>
                Nuevo puntaje (0 – {item.max_score})
              </label>
              <input
                type="number" min="0" max={item.max_score} step="0.5"
                value={overrideScore}
                onChange={e => setOverrideScore(e.target.value)}
                placeholder={String(item.ai_score)}
                style={{
                  width: '100%', padding: '8px 10px',
                  borderRadius: 7, border: '1.5px solid #FCD34D',
                  fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  color: '#1F3864', outline: 'none',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>
                Razón de la corrección *
              </label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                placeholder="Ej. 'La IA no reconoció la paráfrasis correcta del concepto principal.'"
                style={{
                  width: '100%', padding: '8px 10px',
                  borderRadius: 7, border: '1.5px solid #FCD34D',
                  fontSize: 13, resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Acciones ── */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        {!showOverride ? (
          <button type="button" onClick={() => setShowOverride(true)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
            background: '#FFFBEB', color: '#92400E',
            border: '1px solid #FDE68A', cursor: 'pointer',
            transition: 'background .12s',
          }}>
            ✏️ Corregir puntaje
          </button>
        ) : (
          <>
            <button type="button" onClick={() => { setShowOverride(false); setOverrideScore(''); setReason('') }} style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12.5,
              background: '#F1F5F9', color: '#374151',
              border: 'none', cursor: 'pointer',
            }}>
              Cancelar
            </button>
            <button type="button" onClick={override} disabled={saving} style={{
              padding: '8px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              background: saving ? '#9CA3AF' : '#F59E0B', color: '#fff',
              border: 'none', cursor: saving ? 'default' : 'pointer',
              opacity: saving ? .7 : 1,
              transition: 'background .12s',
            }}>
              {saving ? '⏳ Guardando…' : '💾 Guardar corrección'}
            </button>
          </>
        )}
        {!showOverride && (
          <button type="button" onClick={confirm} disabled={saving} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
            background: saving ? '#9CA3AF' : '#15803D', color: '#fff',
            border: 'none', cursor: saving ? 'default' : 'pointer',
            opacity: saving ? .7 : 1,
            transition: 'background .12s, transform .12s',
          }}>
            {saving ? '⏳ Confirmando…' : '✓ Confirmar IA'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
function StatPill({ value, label, color, bg }) {
  return (
    <div style={{
      background: bg || '#F8FAFC',
      border: `1px solid ${color}30`,
      borderRadius: 10, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'var(--font-mono)' }}>{value}</span>
      <span style={{ fontSize: 11.5, color: '#64748B', textTransform: 'uppercase', letterSpacing: .4 }}>{label}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExamReviewPage({ teacher }) {
  const { showToast } = useToast()
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    // 1. Exámenes del docente
    const { data: aRows } = await supabase
      .from('assessments')
      .select('id, title')
      .eq('school_id', teacher.school_id)
      .eq('created_by', teacher.id)

    if (!aRows?.length) { setItems([]); setLoading(false); return }

    const assessmentIds = aRows.map(a => a.id)
    const examTitles    = Object.fromEntries(aRows.map(a => [a.id, a.title]))

    // 2. Preguntas de esos exámenes
    const { data: qRows } = await supabase
      .from('questions')
      .select('id, stem, assessment_id')
      .in('assessment_id', assessmentIds)

    if (!qRows?.length) { setItems([]); setLoading(false); return }

    const questionIds = qRows.map(q => q.id)
    const qMap        = Object.fromEntries(qRows.map(q => [q.id, q]))

    // 3. Evaluaciones IA pendientes de revisión (menor confianza primero)
    const { data: evalRows } = await supabase
      .from('ai_evaluations')
      .select('id, submission_id, question_id, school_id, score_awarded, max_score, feedback, reasoning, confidence, detected_concepts, missing_concepts, created_at')
      .eq('requires_review', true)
      .eq('is_active', true)
      .in('question_id', questionIds)
      .order('confidence', { ascending: true })
      .limit(60)

    if (!evalRows?.length) { setItems([]); setLoading(false); return }

    // 4. Respuestas de los estudiantes (tabla submissions)
    const submissionIds = [...new Set(evalRows.map(e => e.submission_id))]
    const { data: subRows } = await supabase
      .from('submissions')
      .select('id, answer, session_id')
      .in('id', submissionIds)

    const subMap = Object.fromEntries((subRows || []).map(s => [s.id, s]))

    // 5. Sesiones de examen → nombre del estudiante
    const sessionIds = [...new Set((subRows || []).map(s => s.session_id).filter(Boolean))]
    let sesMap = {}
    if (sessionIds.length) {
      const { data: sesRows } = await supabase
        .from('student_exam_sessions')
        .select('id, student_name, assessment_id')
        .in('id', sessionIds)
      sesMap = Object.fromEntries((sesRows || []).map(s => [s.id, s]))
    }

    // 6. Filtrar las que ya tienen override humano
    const evalIds = evalRows.map(e => e.id)
    let overriddenIds = new Set()
    try {
      const { data: overrideRows } = await supabase
        .from('human_overrides')
        .select('ai_evaluation_id')
        .in('ai_evaluation_id', evalIds)
      overriddenIds = new Set((overrideRows || []).map(o => o.ai_evaluation_id))
    } catch { /* human_overrides table may not exist */ }

    // 7. Construir lista final
    const result = evalRows
      .filter(e => !overriddenIds.has(e.id))
      .map(e => {
        const sub = subMap[e.submission_id] || {}
        const ses = sesMap[sub.session_id]  || {}
        const q   = qMap[e.question_id]     || {}
        return {
          eval_id:          e.id,
          submission_id:    e.submission_id,
          session_id:       sub.session_id || null,
          school_id:        e.school_id,
          reviewer_id:      teacher.id,
          ai_score:         e.score_awarded,
          max_score:        e.max_score,
          ai_feedback:      e.feedback,
          ai_reasoning:     e.reasoning,
          confidence:       e.confidence,
          detected_concepts: e.detected_concepts || [],
          missing_concepts:  e.missing_concepts  || [],
          evaluated_at:     e.created_at,
          student_answer:   typeof sub.answer?.text === 'string'
                              ? sub.answer.text
                              : (sub.answer ? JSON.stringify(sub.answer) : ''),
          student_name:     ses.student_name  || null,
          question_stem:    q.stem            || '—',
          exam_title:       examTitles[q.assessment_id] || '—',
          assessment_id:    q.assessment_id,
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

  const examOptions = [...new Set(items.map(i => i.exam_title))].sort()

  // Stats
  const highRisk  = items.filter(i => i.confidence < 0.50)
  const medRisk   = items.filter(i => i.confidence >= 0.50 && i.confidence < 0.65)

  return (
    <div style={{ padding: '28px 32px', maxWidth: 820, animation: 'fade-up .25s var(--ease) both' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 800, letterSpacing: '-.3px' }}>
            👁 Revisión Humana
          </h2>
          {!loading && items.length > 0 && (
            <span style={{
              background: '#FEF3C7', color: '#92400E',
              borderRadius: 20, padding: '3px 12px',
              fontSize: 12, fontWeight: 700,
              border: '1px solid #FDE68A',
              fontFamily: 'var(--font-mono)',
            }}>
              {items.length} pendiente{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p style={{ margin: 0, color: '#64748B', fontSize: 13.5, lineHeight: 1.5 }}>
          Evaluaciones IA con confianza &lt; 65% que requieren tu criterio.
          {items.length > 0 && ' Ordenadas de menor a mayor confianza.'}
        </p>
      </div>

      {/* ── Stats ── */}
      {!loading && items.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap' }}>
          <StatPill value={items.length}    label="Total pendientes" color="#1F3864" />
          <StatPill value={highRisk.length} label="Riesgo alto (<50%)"  color="#DC2626" bg="#FEF2F2" />
          <StatPill value={medRisk.length}  label="Riesgo medio (50–65%)" color="#D97706" bg="#FFFBEB" />
        </div>
      )}

      {/* ── Filtro por examen ── */}
      {examOptions.length > 1 && (
        <div style={{ marginBottom: 18 }}>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              padding: '9px 12px', borderRadius: 8,
              border: '1.5px solid var(--border)',
              fontSize: 13, background: '#fff',
              color: 'var(--text)',
              minWidth: 240,
            }}
          >
            <option value="">Todos los exámenes ({items.length})</option>
            {examOptions.map(e => {
              const n = items.filter(i => i.exam_title === e).length
              return <option key={e} value={e}>{e} ({n})</option>
            })}
          </select>
        </div>
      )}

      {/* ── Estados ── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 180, borderRadius: 12 }} />
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #A7F3D0',
          borderRadius: 14, padding: '52px 24px', textAlign: 'center',
          animation: 'scale-in .25s var(--ease) both',
        }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
          <h3 style={{ margin: '0 0 8px', color: '#15803D', fontSize: 18, fontWeight: 700 }}>
            ¡Todo al día!
          </h3>
          <p style={{ color: '#6B7280', margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {filter
              ? `No hay evaluaciones pendientes para "${filter}".`
              : 'No hay evaluaciones pendientes de revisión humana.'}
          </p>
        </div>
      )}

      {/* ── Lista de tarjetas ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map(item => (
            <ReviewCard key={item.eval_id} item={item} onDone={removeItem} />
          ))}
        </div>
      )}

      {/* ── Nota de pie ── */}
      {!loading && filtered.length > 0 && (
        <p style={{ marginTop: 20, fontSize: 11.5, color: '#9CA3AF', fontStyle: 'italic', lineHeight: 1.6 }}>
          💡 Al confirmar, la nota del estudiante se recalcula automáticamente.
          Las correcciones quedan registradas para trazabilidad.
        </p>
      )}
    </div>
  )
}
