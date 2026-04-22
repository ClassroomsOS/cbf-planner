// ── ExamPlayerPage.jsx ────────────────────────────────────────────────────────
// /exam/:code — Student-facing exam player. No teacher auth required.
// Students enter name + access code → take exam → submit to Supabase.
// Anti-tab-switch detection · Autosave to localStorage every 30s.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const AUTOSAVE_INTERVAL = 30 * 1000 // 30 seconds

function Logo() {
  return (
    <div style={{
      textAlign: 'center', padding: '24px 20px 16px',
      borderBottom: '1px solid #E2E8F0',
    }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: '#1F3864', letterSpacing: -1 }}>CBF</div>
      <div style={{ fontSize: 12, color: '#9CA3AF', letterSpacing: 2, textTransform: 'uppercase' }}>
        Módulo de Evaluación
      </div>
    </div>
  )
}

// ── PHASE 1: Enter name + code ────────────────────────────────────────────────
function EntryPhase({ initialCode, onStart }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState(initialCode || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Escribe tu nombre completo.'); return }
    if (!code.trim()) { setError('Ingresa el código del examen.'); return }
    setLoading(true)
    setError('')

    // Find assessment by access code
    const { data: assessment, error: aErr } = await supabase
      .from('assessments')
      .select('id, title, subject, grade, instructions, status, time_limit_minutes, school_id')
      .eq('access_code', code.trim().toUpperCase())
      .maybeSingle()

    if (aErr || !assessment) {
      setError('Código inválido. Verifica con tu docente.')
      setLoading(false)
      return
    }

    if (assessment.status !== 'active') {
      setError('Este examen está cerrado. Habla con tu docente.')
      setLoading(false)
      return
    }

    // Load questions
    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('id, stem, question_type, points, options, position')
      .eq('assessment_id', assessment.id)
      .eq('school_id', assessment.school_id)
      .order('position', { ascending: true })

    if (qErr || !questions?.length) {
      setError('No se encontraron preguntas en este examen. Habla con tu docente.')
      setLoading(false)
      return
    }

    // Create session
    const { data: session, error: sErr } = await supabase
      .from('student_exam_sessions')
      .insert({
        assessment_id: assessment.id,
        school_id: assessment.school_id,
        student_name: name.trim(),
        access_code_used: code.trim().toUpperCase(),
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (sErr) {
      setError('Error al iniciar el examen. Intenta de nuevo.')
      setLoading(false)
      return
    }

    onStart({ assessment, questions, session })
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.1)', overflow: 'hidden' }}>
        <Logo />
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 20px', fontSize: 18, color: '#1F3864', textAlign: 'center' }}>
            Iniciar Examen
          </h2>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
              Tu nombre completo *
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: María García López"
              autoFocus
              style={{ width: '100%', padding: '11px 12px', borderRadius: 9, border: '1px solid #D0D5DD', fontSize: 15, boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
              Código del examen *
            </label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              style={{
                width: '100%', padding: '11px 12px', borderRadius: 9,
                border: '1px solid #D0D5DD', fontSize: 20, fontWeight: 800,
                letterSpacing: 4, textAlign: 'center', fontFamily: 'monospace',
                boxSizing: 'border-box',
              }} />
          </div>
          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#DC2626' }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px', borderRadius: 10, fontSize: 16, fontWeight: 700,
            background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #1F3864, #2E5598)',
            color: '#fff', border: 'none', cursor: loading ? 'default' : 'pointer',
          }}>
            {loading ? 'Verificando…' : '→ Entrar al examen'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── PHASE 2: Instructions ─────────────────────────────────────────────────────
function InstructionsPhase({ assessment, questions, onBegin }) {
  const totalPts = questions.reduce((s, q) => s + (q.points || 0), 0)
  const types = {
    multiple_choice:  questions.filter(q => q.question_type === 'multiple_choice').length,
    short_answer:     questions.filter(q => q.question_type === 'short_answer').length,
    open_development: questions.filter(q => q.question_type === 'open_development').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, boxShadow: '0 8px 32px rgba(0,0,0,.1)', overflow: 'hidden' }}>
        <Logo />
        <div style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, color: '#1F3864' }}>{assessment.title}</h2>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#64748B' }}>
            {assessment.subject} · {assessment.grade}
          </p>

          <div style={{
            background: '#F0F4FF', borderRadius: 10, padding: '14px 16px', marginBottom: 16,
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1F3864' }}>{questions.length}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' }}>preguntas</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1F3864' }}>{totalPts}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' }}>puntos</div>
            </div>
            {assessment.time_limit_minutes > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#C0504D' }}>{assessment.time_limit_minutes}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase' }}>minutos</div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>Tipos de preguntas:</p>
            {types.multiple_choice > 0  && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 3 }}>• {types.multiple_choice} opción múltiple</div>}
            {types.short_answer > 0     && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 3 }}>• {types.short_answer} respuesta corta</div>}
            {types.open_development > 0 && <div style={{ fontSize: 13, color: '#64748B', marginBottom: 3 }}>• {types.open_development} desarrollo</div>}
          </div>

          {assessment.instructions && (
            <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#374151', border: '1px solid #FDE68A' }}>
              <strong>Instrucciones:</strong><br />{assessment.instructions}
            </div>
          )}

          <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 12px', marginBottom: 20, fontSize: 12, color: '#DC2626' }}>
            ⚠️ No cambies de pestaña ni ventana durante el examen. Cada cambio queda registrado.
          </div>

          <button type="button" onClick={onBegin} style={{
            width: '100%', padding: '13px', borderRadius: 10, fontSize: 16, fontWeight: 700,
            background: 'linear-gradient(135deg, #15803D, #166534)',
            color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            Comenzar examen →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PHASE 3: Questions ────────────────────────────────────────────────────────
function QuestionPhase({ assessment, questions, session, onSubmit }) {
  const STORAGE_KEY = `cbf_exam_${session.id}`
  const [answers, setAnswers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return saved
    } catch { return {} }
  })
  const [current, setCurrent]   = useState(0)
  const [tabSwitches, setTabSwitches] = useState(0)
  const [submitting, setSubmitting]   = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [timeLeft, setTimeLeft]       = useState(
    assessment.time_limit_minutes > 0 ? assessment.time_limit_minutes * 60 : null
  )
  const autosaveRef = useRef(null)
  const timerRef    = useRef(null)

  // Anti-tab-switch
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        setTabSwitches(n => {
          const next = n + 1
          supabase.from('student_exam_sessions')
            .update({ tab_switch_count: next })
            .eq('id', session.id)
            .then(() => {})
          return next
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [session.id])

  // Autosave
  useEffect(() => {
    autosaveRef.current = setInterval(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
    }, AUTOSAVE_INTERVAL)
    return () => clearInterval(autosaveRef.current)
  }, [answers, STORAGE_KEY])

  // Timer
  useEffect(() => {
    if (timeLeft === null) return
    if (timeLeft <= 0) { handleSubmit(); return }
    timerRef.current = setInterval(() => setTimeLeft(t => t - 1), 1000)
    return () => clearInterval(timerRef.current)
  }, [timeLeft]) // eslint-disable-line

  const q = questions[current]
  const answered = Object.keys(answers).length

  function setAnswer(questionId, value) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    clearInterval(autosaveRef.current)
    clearInterval(timerRef.current)
    localStorage.removeItem(STORAGE_KEY)

    try {
      // Save all answers as submissions
      for (const question of questions) {
        const answer = answers[question.id]
        const isAuto = question.question_type === 'multiple_choice'
        const autoScore = isAuto && answer
          ? (answer === question.correct_answer ? question.points : 0)
          : null

        await supabase.from('submissions').insert({
          session_id:    session.id,
          assessment_id: assessment.id,
          question_id:   question.id,
          school_id:     assessment.school_id,
          answer:        { text: answer || '' },
          auto_score:    autoScore,
        })
      }

      // Mark session as submitted
      await supabase.from('student_exam_sessions').update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        tab_switch_count: tabSwitches,
      }).eq('id', session.id)

      onSubmit()
    } catch {
      setSubmitting(false)
    }
  }

  function formatTime(s) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const timeCritical = timeLeft !== null && timeLeft < 120

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC' }}>
      {/* Sticky top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#1F3864', color: '#fff',
        padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{assessment.title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {tabSwitches > 0 && (
            <span style={{ background: '#EF4444', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
              ⚠️ {tabSwitches} cambio{tabSwitches !== 1 ? 's' : ''} de tab
            </span>
          )}
          <span style={{ fontSize: 13 }}>{answered}/{questions.length} respondidas</span>
          {timeLeft !== null && (
            <span style={{
              fontSize: 16, fontWeight: 800,
              color: timeCritical ? '#EF4444' : '#A7F3D0',
              background: timeCritical ? 'rgba(239,68,68,.15)' : 'transparent',
              borderRadius: 6, padding: '2px 8px',
            }}>{formatTime(timeLeft)}</span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
        {/* Progress */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748B', marginBottom: 5 }}>
            <span>Pregunta {current + 1} de {questions.length}</span>
            <span>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ height: 4, background: '#E2E8F0', borderRadius: 2 }}>
            <div style={{
              height: '100%', background: '#1F3864', borderRadius: 2,
              width: `${((current + 1) / questions.length) * 100}%`,
              transition: 'width .3s',
            }} />
          </div>
        </div>

        {/* Question card */}
        <div style={{
          background: '#fff', borderRadius: 14, padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,.07)', marginBottom: 20,
        }}>
          <div style={{
            display: 'inline-block', marginBottom: 12,
            background: q.question_type === 'multiple_choice' ? '#EFF6FF' : q.question_type === 'short_answer' ? '#FFF8EB' : '#F5F0FF',
            color: q.question_type === 'multiple_choice' ? '#1D4ED8' : q.question_type === 'short_answer' ? '#92400E' : '#5B21B6',
            borderRadius: 5, padding: '3px 9px', fontSize: 11, fontWeight: 700,
          }}>
            {q.question_type === 'multiple_choice' ? 'Opción múltiple'
              : q.question_type === 'short_answer' ? 'Respuesta corta'
              : 'Desarrollo'}
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 16, color: '#1F3864', lineHeight: 1.6 }}>{q.stem}</p>

          {/* Multiple choice */}
          {q.question_type === 'multiple_choice' && Array.isArray(q.options) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map((opt, oi) => {
                const letter = String.fromCharCode(65 + oi)
                const selected = answers[q.id] === letter
                return (
                  <button key={oi} type="button"
                    onClick={() => setAnswer(q.id, letter)}
                    style={{
                      padding: '12px 16px', borderRadius: 10, fontSize: 14, cursor: 'pointer',
                      textAlign: 'left', border: '2px solid', fontWeight: selected ? 700 : 400,
                      background: selected ? '#EFF6FF' : '#F8FAFC',
                      borderColor: selected ? '#1D4ED8' : '#E2E8F0',
                      color: selected ? '#1D4ED8' : '#374151',
                      transition: 'all .1s',
                    }}>
                    {opt}
                  </button>
                )
              })}
            </div>
          )}

          {/* Short answer */}
          {q.question_type === 'short_answer' && (
            <textarea value={answers[q.id] || ''}
              onChange={e => setAnswer(q.id, e.target.value)}
              rows={3}
              placeholder="Escribe tu respuesta aquí…"
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                border: '2px solid #E2E8F0', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={e => { e.target.style.borderColor = '#1D4ED8' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0' }} />
          )}

          {/* Open development */}
          {q.question_type === 'open_development' && (
            <textarea value={answers[q.id] || ''}
              onChange={e => setAnswer(q.id, e.target.value)}
              rows={7}
              placeholder="Desarrolla tu respuesta aquí. Sé claro y preciso…"
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                border: '2px solid #E2E8F0', fontSize: 14, resize: 'vertical',
                fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.6,
              }}
              onFocus={e => { e.target.style.borderColor = '#1D4ED8' }}
              onBlur={e => { e.target.style.borderColor = '#E2E8F0' }} />
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button type="button"
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            style={{
              padding: '10px 20px', borderRadius: 9, fontSize: 14, fontWeight: 600,
              background: current === 0 ? '#F1F5F9' : '#fff',
              color: current === 0 ? '#D0D5DD' : '#374151',
              border: '1px solid #E2E8F0', cursor: current === 0 ? 'default' : 'pointer',
            }}>
            ← Anterior
          </button>

          {current < questions.length - 1 ? (
            <button type="button"
              onClick={() => setCurrent(c => Math.min(questions.length - 1, c + 1))}
              style={{
                padding: '10px 24px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, #1F3864, #2E5598)',
                color: '#fff', border: 'none', cursor: 'pointer',
              }}>
              Siguiente →
            </button>
          ) : (
            <button type="button"
              onClick={() => setShowConfirm(true)}
              style={{
                padding: '10px 24px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                background: 'linear-gradient(135deg, #15803D, #166534)',
                color: '#fff', border: 'none', cursor: 'pointer',
              }}>
              Enviar examen ✓
            </button>
          )}
        </div>

        {/* Question dots navigator */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {questions.map((q, i) => (
            <button key={i} type="button" onClick={() => setCurrent(i)} style={{
              width: 30, height: 30, borderRadius: 6, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', border: '2px solid',
              background: i === current ? '#1F3864' : answers[q.id] ? '#ECFDF5' : '#F8FAFC',
              color: i === current ? '#fff' : answers[q.id] ? '#15803D' : '#9CA3AF',
              borderColor: i === current ? '#1F3864' : answers[q.id] ? '#A7F3D0' : '#E2E8F0',
            }}>
              {i + 1}
            </button>
          ))}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#B0B8C9', marginTop: 16 }}>
          Guardado automáticamente cada 30 segundos
        </p>
      </div>

      {/* Submit confirmation modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20,
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '28px', maxWidth: 400, width: '100%',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
            <h3 style={{ margin: '0 0 8px', color: '#1F3864' }}>¿Enviar el examen?</h3>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: '#64748B' }}>
              Respondiste <strong>{answered}</strong> de <strong>{questions.length}</strong> preguntas.
            </p>
            {answered < questions.length && (
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>
                ⚠️ Hay {questions.length - answered} pregunta{questions.length - answered !== 1 ? 's' : ''} sin responder.
              </p>
            )}
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94A3B8' }}>
              Una vez enviado no podrás modificar tus respuestas.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setShowConfirm(false)}
                disabled={submitting}
                style={{
                  flex: 1, padding: '12px', borderRadius: 9, fontSize: 14, fontWeight: 600,
                  background: '#F1F5F9', color: '#374151', border: 'none', cursor: 'pointer',
                }}>
                Revisar
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting}
                style={{
                  flex: 1, padding: '12px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                  background: submitting ? '#9CA3AF' : '#15803D',
                  color: '#fff', border: 'none', cursor: submitting ? 'default' : 'pointer',
                }}>
                {submitting ? '⏳ Enviando…' : '✓ Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PHASE 4: Confirmation ─────────────────────────────────────────────────────
function ConfirmationPhase({ studentName }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,.1)', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, color: '#15803D' }}>¡Examen enviado!</h2>
        <p style={{ margin: '0 0 20px', fontSize: 15, color: '#374151' }}>
          Gracias, <strong>{studentName}</strong>. Tus respuestas fueron recibidas correctamente.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>
          Tu docente revisará los resultados. Puedes cerrar esta ventana.
        </p>
        <div style={{ marginTop: 24, fontSize: 13, color: '#D0D5DD' }}>
          CBF Planner · Colegio Boston Flexible
        </div>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ExamPlayerPage() {
  const { code } = useParams()
  const [phase, setPhase]         = useState('entry')    // entry | instructions | questions | done
  const [examData, setExamData]   = useState(null)       // { assessment, questions, session }
  const [studentName, setStudentName] = useState('')

  function handleStart(data) {
    setExamData(data)
    setStudentName(data.session.student_name || '')
    setPhase('instructions')
  }

  function handleBegin() {
    setPhase('questions')
  }

  function handleSubmit() {
    setPhase('done')
  }

  if (phase === 'entry') {
    return <EntryPhase initialCode={code} onStart={handleStart} />
  }

  if (phase === 'instructions' && examData) {
    return (
      <InstructionsPhase
        assessment={examData.assessment}
        questions={examData.questions}
        onBegin={handleBegin}
      />
    )
  }

  if (phase === 'questions' && examData) {
    return (
      <QuestionPhase
        assessment={examData.assessment}
        questions={examData.questions}
        session={examData.session}
        onSubmit={handleSubmit}
      />
    )
  }

  if (phase === 'done') {
    return <ConfirmationPhase studentName={studentName} />
  }

  return null
}
