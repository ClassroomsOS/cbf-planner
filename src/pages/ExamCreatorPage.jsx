// ── ExamCreatorPage.jsx ──────────────────────────────────────────────────────
// /exams/create — Full-page wizard for creating exams with AI.
// Extracted from ExamDashboardPage.ExamCreatorModal for better UX.

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { generateExamQuestions } from '../utils/AIAssistant'
import {
  ACADEMIC_TYPES, BIBLICAL_TYPES, BIBLICAL_MIN, RIGOR_META,
  TypeCard, ExamInstitutionalHeader,
} from './ExamDashboardPage'
import { EXAM_PRESETS, getExamPreset, extractGradeNumber } from '../utils/examUtils'

const STEP_LABELS = ['Contexto', 'Tipos de pregunta', 'Revisar preguntas', 'Publicar']

const DEFAULT_TYPES = {
  multiple_choice: 5, true_false: 0, fill_blank: 0, matching: 0,
  short_answer: 3, error_correction: 0, sequencing: 0, open_development: 2,
  biblical_reflection: 2, verse_analysis: 1, principle_application: 0,
}

export default function ExamCreatorPage({ teacher }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [examType, setExamType] = useState('quiz') // 'quiz' | 'final'

  // ── Step 1 state — cascade ──────────────────────────────────────────────
  const [assignments, setAssignments] = useState([])
  const [form, setForm] = useState({
    grade: '', subject: '', period: '',
    goalId: '', indicatorId: '',
    indicator: null,
    biblicalContext: { principle: '', verse_ref: '', reflection: '' },
    syllabusTopics: [],
    additionalContext: '',
    title: '', instructions: '', time_limit: 60,
  })
  const [goals, setGoals]             = useState([])
  const [indicators, setIndicators]   = useState([])
  const [loadingCascade, setLoadingCascade] = useState(false)

  // ── Step 2 state — versions + sections ────────────────────────────────
  const [versionCount, setVersionCount] = useState(1)
  const [shuffleQuestions, setShuffleQ] = useState(true)
  const [shuffleOptions,   setShuffleO] = useState(true)
  const nextSecIdRef = useRef(2)
  const [sections, setSections] = useState([{ id: 1, name: '', types: { ...DEFAULT_TYPES } }])

  // ── Step 3 state — AI result ────────────────────────────────────────────
  const [generating, setGenerating] = useState(false)
  const [generatedExam, setGeneratedExam] = useState(null)
  const [editingQ, setEditingQ] = useState(null)

  // ── Step 4 state — publish ──────────────────────────────────────────────
  const [saving, setSaving] = useState(false)

  // Load assignments on mount
  useEffect(() => {
    supabase.from('teacher_assignments')
      .select('grade, section, subject')
      .eq('teacher_id', teacher.id)
      .then(({ data }) => setAssignments(data || []))
  }, [teacher.id])

  const gradeOptions = [...new Map(
    assignments.map(a => {
      const combined = a.section ? `${a.grade} ${a.section}` : a.grade
      return [combined, combined]
    })
  ).values()].sort()

  const subjectOptions = [...new Set(
    assignments
      .filter(a => !form.grade || (a.section ? `${a.grade} ${a.section}` : a.grade) === form.grade)
      .map(a => a.subject).filter(Boolean)
  )].sort()

  function setF(key, val) { setForm(f => ({ ...f, [key]: val })) }

  // Load achievement goals when grade+subject+period set
  useEffect(() => {
    if (!form.grade || !form.subject || !form.period) { setGoals([]); setIndicators([]); return }
    setLoadingCascade(true)
    supabase.from('achievement_goals')
      .select('id, text')
      .eq('school_id', teacher.school_id)
      .eq('grade', form.grade)
      .eq('subject', form.subject)
      .eq('period', parseInt(form.period))
      .then(({ data }) => { setGoals(data || []); setLoadingCascade(false) })
  }, [form.grade, form.subject, form.period, teacher.school_id])

  // Load indicators when goal selected
  useEffect(() => {
    if (!form.goalId) { setIndicators([]); setF('indicatorId', ''); setF('indicator', null); return }
    supabase.from('achievement_indicators')
      .select('id, text, dimension, skill_area')
      .eq('goal_id', form.goalId)
      .then(({ data }) => setIndicators(data || []))
  }, [form.goalId])

  // Load biblical context + syllabus when indicator selected
  useEffect(() => {
    if (!form.indicatorId) {
      setF('biblicalContext', { principle: '', verse_ref: '', reflection: '' })
      setF('syllabusTopics', [])
      setF('indicator', null)
      return
    }
    const ind = indicators.find(i => i.id === form.indicatorId) || null
    setF('indicator', ind)

    supabase.from('news_projects')
      .select('biblical_principle, indicator_verse_ref, biblical_reflection')
      .eq('indicator_id', form.indicatorId)
      .eq('school_id', teacher.school_id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setF('biblicalContext', {
            principle: data.biblical_principle || '',
            verse_ref: data.indicator_verse_ref || '',
            reflection: data.biblical_reflection || '',
          })
        }
      })

    if (form.grade && form.subject && form.period) {
      supabase.from('syllabus_topics')
        .select('week, content')
        .eq('school_id', teacher.school_id)
        .eq('grade', form.grade)
        .eq('subject', form.subject)
        .eq('period', parseInt(form.period))
        .order('week')
        .then(({ data }) => setF('syllabusTopics', data || []))
    }
  }, [form.indicatorId, indicators])

  // ── Auto-preset when examType or grade changes ──────────────────────────
  const currentPreset = getExamPreset(examType, form.grade)

  function applyPreset(preset) {
    setSections([{ id: 1, name: '', types: { ...preset.defaultTypes } }])
    nextSecIdRef.current = 2
  }

  function handleExamTypeChange(newType) {
    setExamType(newType)
    const preset = getExamPreset(newType, form.grade)
    applyPreset(preset)
  }

  // When grade changes and examType is final, adjust preset (lower vs upper)
  useEffect(() => {
    if (examType !== 'final') return
    const preset = getExamPreset('final', form.grade)
    applyPreset(preset)
  }, [form.grade]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Section helpers ────────────────────────────────────────────────────
  const biblicalTotal = sections.reduce((sum, sec) =>
    sum + BIBLICAL_TYPES.reduce((s, t) => s + (sec.types[t.key] || 0), 0), 0)
  const academicTotal = sections.reduce((sum, sec) =>
    sum + ACADEMIC_TYPES.reduce((s, t) => s + (sec.types[t.key] || 0), 0), 0)
  const total = academicTotal + biblicalTotal

  const totalPts = sections.reduce((sum, sec) => sum + [
    ...ACADEMIC_TYPES.map(t => (sec.types[t.key] || 0) * t.pts),
    ...BIBLICAL_TYPES.map(t => (sec.types[t.key] || 0) * t.pts),
  ].reduce((s, v) => s + v, 0), 0)

  function setSecType(secId, key, val) {
    setSections(prev => prev.map(sec => {
      if (sec.id !== secId) return sec
      const newTypes = { ...sec.types, [key]: Math.max(0, val) }
      const isBiblical = BIBLICAL_TYPES.some(t => t.key === key)
      if (isBiblical) {
        const newGlobalBiblical = prev.reduce((sum, s) =>
          sum + BIBLICAL_TYPES.reduce((ss, t) => ss + (s.id === secId ? (t.key === key ? val : (sec.types[t.key] || 0)) : (s.types[t.key] || 0)), 0), 0)
        if (newGlobalBiblical < BIBLICAL_MIN) return sec
      }
      return { ...sec, types: newTypes }
    }))
  }

  function addSection() {
    const id = nextSecIdRef.current++
    setSections(prev => [...prev, {
      id, name: '',
      types: {
        multiple_choice: 5, true_false: 0, fill_blank: 0, matching: 0,
        short_answer: 3, error_correction: 0, sequencing: 0, open_development: 0,
        biblical_reflection: 0, verse_analysis: 0, principle_application: 0,
      },
    }])
  }

  function removeSection(secId) {
    if (sections.length <= 1) return
    setSections(prev => prev.filter(s => s.id !== secId))
  }

  function updateSectionName(secId, name) {
    setSections(prev => prev.map(s => s.id === secId ? { ...s, name } : s))
  }

  // ── Generate ───────────────────────────────────────────────────────────
  async function handleGenerate() {
    if (!form.grade || !form.subject) {
      showToast('Selecciona grado y materia.', 'warning'); return
    }
    if (total < 5) {
      showToast('Agrega al menos 5 preguntas.', 'warning'); return
    }
    if (biblicalTotal < BIBLICAL_MIN) {
      showToast(`Debes incluir al menos ${BIBLICAL_MIN} preguntas bíblicas.`, 'warning'); return
    }
    setGenerating(true)
    try {
      const exam = await generateExamQuestions({
        subject: form.subject, grade: form.grade,
        indicator: form.indicator,
        biblicalContext: form.biblicalContext,
        syllabusTopics: form.syllabusTopics,
        sections,
        additionalContext: form.additionalContext.trim() || undefined,
        examType,
        examPreset: currentPreset,
      })
      setGeneratedExam(exam)
      if (!form.title && exam.title) setF('title', exam.title)
      if (!form.instructions && exam.instructions) setF('instructions', exam.instructions)
      setStep(3)
    } catch (err) {
      showToast('Error al generar: ' + err.message, 'error')
    } finally {
      setGenerating(false)
    }
  }

  function updateQuestion(idx, field, value) {
    setGeneratedExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) => i === idx ? { ...q, [field]: value } : q),
    }))
  }

  function updateCriteria(idx, field, value) {
    setGeneratedExam(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === idx ? { ...q, criteria: { ...q.criteria, [field]: value } } : q
      ),
    }))
  }

  // ── Publish ────────────────────────────────────────────────────────────
  async function handlePublish() {
    if (!form.title.trim()) { showToast('Escribe un título.', 'warning'); return }
    if (!generatedExam?.questions?.length) return
    setSaving(true)
    try {
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: assessment, error: aErr } = await supabase
        .from('assessments')
        .insert({
          school_id: teacher.school_id, created_by: teacher.id,
          subject: form.subject, grade: form.grade,
          period: form.period ? parseInt(form.period) : null,
          title: form.title.trim(), instructions: form.instructions.trim(),
          access_code: accessCode, status: 'active',
          ai_generated: true,
          time_limit_minutes: form.time_limit || null,
          metadata: {
            exam_type: examType,
            ...(currentPreset.hasExtraPoints ? { extra_points: currentPreset.extraPoints } : {}),
          },
        })
        .select('id').single()

      if (aErr || !assessment?.id) throw new Error('Error al crear examen: ' + (aErr?.message || 'sin ID'))

      for (const q of generatedExam.questions) {
        const { data: question, error: qErr } = await supabase
          .from('questions')
          .insert({
            assessment_id: assessment.id, school_id: teacher.school_id,
            stem: q.stem, question_type: q.question_type,
            points: q.points, position: q.position,
            options: q.options || null, correct_answer: q.correct_answer || null,
            ai_generated: true,
          })
          .select('id').single()

        if (qErr) throw new Error('Error al guardar preguntas: ' + qErr.message)

        if (q.criteria) {
          const { error: cErr } = await supabase.from('question_criteria').insert({
            question_id: question.id, school_id: teacher.school_id,
            model_answer: q.criteria.model_answer || null,
            key_concepts: q.criteria.key_concepts || null,
            rubric: q.criteria.rubric || {},
            rigor_level: ['strict', 'flexible', 'conceptual'].includes(q.criteria.rigor_level) ? q.criteria.rigor_level : 'flexible',
            bloom_level: q.criteria.bloom_level || null,
            ai_correction_context: q.criteria.ai_correction_context || null,
            ai_generated: true,
          })
          if (cErr) throw new Error('Error al guardar criterios: ' + cErr.message)
        }
      }

      const VERSION_LABELS = ['A', 'B', 'C', 'D']
      for (let v = 0; v < versionCount; v++) {
        const { error: vErr } = await supabase.from('assessment_versions').insert({
          assessment_id: assessment.id,
          school_id: teacher.school_id,
          version_number: v + 1,
          version_label: `Versión ${VERSION_LABELS[v]}`,
          is_base: v === 0,
          shuffle_questions: v > 0 ? shuffleQuestions : false,
          shuffle_options:   v > 0 ? shuffleOptions   : false,
        })
        if (vErr) throw new Error('Error al crear versión: ' + vErr.message)
      }

      showToast(`Examen publicado${versionCount > 1 ? ` — ${versionCount} versiones` : ''} · Código: ${accessCode}`, 'success')
      navigate('/exams')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const totalScore = generatedExam?.questions?.reduce((s, q) => s + (q.points || 0), 0) || totalPts
  const school = teacher.schools || {}

  function handleBack() {
    if (step > 1) setStep(s => s - 1)
    else navigate('/exams')
  }

  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="ec-page">
      {/* Header */}
      <div className="ec-header">
        <div>
          <h1>Crear Examen con IA</h1>
          <div className="ec-header-sub">
            Paso {step} de 4 · {STEP_LABELS[step - 1]}
          </div>
        </div>
        <button type="button" onClick={() => navigate('/exams')} style={{
          background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8,
          color: '#fff', fontSize: 13, padding: '7px 14px', cursor: 'pointer',
          fontWeight: 600,
        }}>
          ← Volver a Evaluaciones
        </button>
      </div>

      <div className="ec-body">
        {/* Sidebar */}
        <div className="ec-sidebar">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1
            const done = step > n
            const active = step === n
            const canClick = done || (n === 2 && form.grade && form.subject) || (n === 3 && generatedExam) || (n === 4 && generatedExam)
            return (
              <div key={n}
                className={`ec-step${active ? ' active' : ''}${done ? ' done' : ''}`}
                onClick={() => canClick && setStep(n)}>
                <span className="ec-step-num">{done ? '✓' : n}</span>
                <span>{label}</span>
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="ec-content">

          {/* ── PASO 1 — Contexto pedagógico ────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ExamInstitutionalHeader school={school} />

              {/* Exam type selector */}
              <div style={{
                background: '#F8FAFC', borderRadius: 10, padding: '12px 14px',
                border: '1.5px solid #E2E8F0',
              }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#374151' }}>
                  Tipo de evaluación
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[
                    { key: 'quiz', icon: '📝', label: 'Quiz (Parcial)', desc: '12–15 preguntas' },
                    { key: 'final', icon: '📋', label: 'Examen Final', desc: '20 o 35 preguntas + Extra Points' },
                  ].map(t => (
                    <button key={t.key} type="button" onClick={() => handleExamTypeChange(t.key)}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 8,
                        background: examType === t.key ? '#F0F4FF' : '#fff',
                        border: `2px solid ${examType === t.key ? '#1F3864' : '#E2E8F0'}`,
                        transition: 'all 0.15s',
                      }}>
                      <span style={{ fontSize: 20 }}>{t.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: examType === t.key ? '#1F3864' : '#374151' }}>
                          {t.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          {t.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {examType === 'final' && form.grade && (
                  <div style={{
                    marginTop: 8, fontSize: 11, color: '#1F3864', background: '#EFF6FF',
                    borderRadius: 6, padding: '5px 8px', border: '1px solid #BFDBFE',
                  }}>
                    {currentPreset.icon} {currentPreset.label} — {currentPreset.description}
                  </div>
                )}
              </div>

              {/* Cascade selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Grado *</label>
                  <select value={form.grade} onChange={e => { setF('grade', e.target.value); setF('subject', ''); setF('goalId', '') }}
                    style={sel}>
                    <option value="">Selecciona…</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Materia *</label>
                  <select value={form.subject} onChange={e => { setF('subject', e.target.value); setF('goalId', '') }}
                    style={sel}>
                    <option value="">Selecciona…</option>
                    {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Período *</label>
                  <select value={form.period} onChange={e => { setF('period', e.target.value); setF('goalId', '') }}
                    style={sel}>
                    <option value="">Selecciona…</option>
                    {['1','2','3','4'].map(p => <option key={p} value={p}>Período {p}</option>)}
                  </select>
                </div>
              </div>

              {/* Achievement goal selector */}
              {form.grade && form.subject && form.period && (
                <div>
                  <label style={lbl}>
                    Logro de Desempeño {loadingCascade ? '⏳' : ''}
                  </label>
                  {goals.length === 0 && !loadingCascade ? (
                    <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 10px', background: '#F8FAFC', borderRadius: 7, border: '1px solid #E2E8F0' }}>
                      No hay logros para este grado/materia/período. El examen se basará en el contexto adicional.
                    </div>
                  ) : (
                    <select value={form.goalId} onChange={e => setF('goalId', e.target.value)} style={sel}>
                      <option value="">— Sin logro vinculado —</option>
                      {goals.map(g => <option key={g.id} value={g.id}>{g.text}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Indicator selector */}
              {indicators.length > 0 && (
                <div>
                  <label style={lbl}>Indicador de Logro evaluado *</label>
                  <select value={form.indicatorId} onChange={e => setF('indicatorId', e.target.value)} style={sel}>
                    <option value="">— Selecciona el indicador —</option>
                    {indicators.map(i => <option key={i.id} value={i.id}>{i.text}</option>)}
                  </select>
                </div>
              )}

              {/* Biblical context */}
              <div style={{
                background: form.biblicalContext.principle ? '#FDF8F0' : '#F8FAFC',
                border: `1px solid ${form.biblicalContext.principle ? '#F5DDB6' : '#E2E8F0'}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#7B3F00' }}>
                  Principio Bíblico — {form.biblicalContext.principle ? 'cargado automáticamente' : 'completa si aplica'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={form.biblicalContext.principle}
                    onChange={e => setF('biblicalContext', { ...form.biblicalContext, principle: e.target.value })}
                    rows={2} placeholder="Texto del principio bíblico…"
                    style={ta} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input value={form.biblicalContext.verse_ref}
                      onChange={e => setF('biblicalContext', { ...form.biblicalContext, verse_ref: e.target.value })}
                      placeholder="Referencia bíblica (ej. Juan 3:16)"
                      style={inp} />
                    <input value={form.biblicalContext.reflection}
                      onChange={e => setF('biblicalContext', { ...form.biblicalContext, reflection: e.target.value })}
                      placeholder="Reflexión/aplicación esperada"
                      style={inp} />
                  </div>
                </div>
              </div>

              {/* Syllabus topics preview */}
              {form.syllabusTopics.length > 0 && (
                <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 12px', border: '1px solid #BFDBFE' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>
                    Temas del syllabus ({form.syllabusTopics.length} semanas)
                  </p>
                  <div style={{ fontSize: 12, color: '#374151', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                    {form.syllabusTopics.slice(0, 6).map(t => (
                      <span key={t.week} style={{ whiteSpace: 'nowrap' }}>
                        <strong>Sem {t.week}:</strong> {t.content?.substring(0, 40)}{t.content?.length > 40 ? '…' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contexto adicional / tiempo */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Contexto adicional (opcional)</label>
                  <textarea value={form.additionalContext}
                    onChange={e => setF('additionalContext', e.target.value)}
                    rows={2} placeholder="Especifica temas, unidades o conceptos adicionales que debe cubrir el examen…"
                    style={ta} />
                </div>
                <div>
                  <label style={lbl}>Tiempo (min)</label>
                  <input type="number" min="0" max="300" value={form.time_limit}
                    onChange={e => setF('time_limit', parseInt(e.target.value) || 0)}
                    style={{ ...inp, fontSize: 14 }} />
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 2 — Tipos de pregunta ───────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Protocol banner */}
              {examType === 'final' && (
                <div style={{
                  background: '#EFF6FF', borderRadius: 10, padding: '12px 14px',
                  border: '1.5px solid #93C5FD',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{currentPreset.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#1F3864' }}>
                      {currentPreset.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                    <div><strong>Preguntas base:</strong> {currentPreset.baseQuestions} preguntas</div>
                    <div><strong>Extra Points:</strong> 5 preguntas de listening (+0.1 c/u, max +0.5)</div>
                    <div><strong>Bíblicas:</strong> mínimo 3 (pensamiento crítico y argumentación, no memoria)</div>
                    {currentPreset.requiredComponents && (
                      <div><strong>Componentes:</strong> {currentPreset.requiredComponents.join(', ')}</div>
                    )}
                  </div>
                  {(() => {
                    const expectedBase = currentPreset.baseQuestions
                    if (total !== expectedBase) {
                      return (
                        <div style={{
                          marginTop: 8, fontSize: 11, fontWeight: 700, borderRadius: 6,
                          padding: '5px 8px',
                          background: total < expectedBase ? '#FEF3C7' : '#FEE2E2',
                          color: total < expectedBase ? '#92400E' : '#991B1B',
                          border: `1px solid ${total < expectedBase ? '#FDE68A' : '#FECACA'}`,
                        }}>
                          {total < expectedBase
                            ? `El protocolo requiere ${expectedBase} preguntas base. Tienes ${total}.`
                            : `Tienes ${total} preguntas, el protocolo indica ${expectedBase} base.`
                          }
                        </div>
                      )
                    }
                    return (
                      <div style={{
                        marginTop: 8, fontSize: 11, fontWeight: 700, borderRadius: 6,
                        padding: '5px 8px', background: '#DCFCE7', color: '#15803D',
                        border: '1px solid #A7F3D0',
                      }}>
                        Total correcto: {total} preguntas base + 5 Extra Points
                      </div>
                    )
                  })()}
                </div>
              )}

              {examType === 'quiz' && (
                <div style={{
                  background: '#FFFBEB', borderRadius: 10, padding: '12px 14px',
                  border: '1.5px solid #FDE68A',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>📝</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#92400E' }}>
                      Quiz (Parcial)
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#78350F', lineHeight: 1.5 }}>
                    Evaluación parcial de temas específicos · 12–15 preguntas recomendadas · Sin Extra Points
                  </div>
                  {(total < 12 || total > 15) && total > 0 && (
                    <div style={{
                      marginTop: 6, fontSize: 11, fontWeight: 700, borderRadius: 6,
                      padding: '5px 8px', background: '#FEF3C7', color: '#92400E',
                      border: '1px solid #FDE68A',
                    }}>
                      Rango recomendado: 12–15 preguntas. Tienes {total}.
                    </div>
                  )}
                </div>
              )}

              {/* Version picker */}
              <div style={{ background: '#F0F4FF', borderRadius: 10, padding: '12px 14px', border: '1px solid #C7D7FF' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1F3864' }}>
                  Versiones del examen — anti-copia
                </p>
                <div style={{ display: 'flex', gap: 6, marginBottom: versionCount > 1 ? 10 : 0 }}>
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} type="button" onClick={() => setVersionCount(n)}
                      style={{ flex: 1, padding: '7px 4px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: versionCount === n ? '#1F3864' : '#fff',
                        color: versionCount === n ? '#fff' : '#374151',
                        border: `1.5px solid ${versionCount === n ? '#1F3864' : '#E2E8F0'}` }}>
                      {n === 1 ? '1 versión' : `${n} versiones`}
                    </button>
                  ))}
                </div>
                {versionCount > 1 && (
                  <>
                    <div style={{ display: 'flex', gap: 18, fontSize: 12, marginBottom: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: '#374151' }}>
                        <input type="checkbox" checked={shuffleQuestions} onChange={e => setShuffleQ(e.target.checked)} />
                        Barajar orden de preguntas
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', color: '#374151' }}>
                        <input type="checkbox" checked={shuffleOptions} onChange={e => setShuffleO(e.target.checked)} />
                        Barajar opciones (opción múltiple)
                      </label>
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B', fontStyle: 'italic' }}>
                      Versión A: orden original. Versiones B–{['B','C','D'][versionCount - 2]}: preguntas/opciones barajadas por versión. El sistema asigna automáticamente al entrar.
                    </div>
                  </>
                )}
              </div>

              {/* Total counter */}
              <div style={{
                background: total > 25 ? '#FFFBEB' : '#F0F4FF',
                border: `1px solid ${total > 25 ? '#FDE68A' : '#C7D7FF'}`,
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#1F3864' }}>{total}</span>
                  <span style={{ fontSize: 12, color: '#64748B', marginLeft: 6 }}>preguntas · {totalPts} puntos</span>
                  {total > 25 && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#92400E' }}>⚠ se generará en 2 llamadas</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Bíblicas: <strong style={{ color: biblicalTotal >= BIBLICAL_MIN ? '#15803D' : '#DC2626' }}>{biblicalTotal}</strong>
                  <span style={{ color: '#9CA3AF' }}> / {BIBLICAL_MIN} mínimo</span>
                </div>
              </div>

              {!form.biblicalContext.principle && (
                <div style={{ fontSize: 11, color: '#92400E', background: '#FEF9C3', borderRadius: 6, padding: '5px 8px', border: '1px solid #FDE68A' }}>
                  No hay principio bíblico cargado. Las preguntas bíblicas se generarán con contexto genérico.
                  Vuelve al Paso 1 para completarlo.
                </div>
              )}

              {/* Section cards */}
              {sections.map((sec, secIdx) => (
                <div key={sec.id} style={{
                  border: '1.5px solid #E2E8F0', borderRadius: 12, overflow: 'hidden',
                  background: '#FAFAFA',
                }}>
                  {/* Section header */}
                  <div style={{
                    background: sections.length > 1 ? '#1F3864' : '#F8FAFC',
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '1px solid #E2E8F0',
                  }}>
                    {sections.length > 1 && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#93C5FD', flexShrink: 0 }}>
                        Parte {secIdx + 1}
                      </span>
                    )}
                    <input
                      type="text"
                      value={sec.name}
                      onChange={e => updateSectionName(sec.id, e.target.value)}
                      placeholder={sections.length > 1 ? `Ej. "Comprensión de Lectura", "Gramática"…` : 'Nombre de sección (opcional)'}
                      style={{
                        flex: 1, border: sections.length > 1 ? '1px solid #3B5998' : '1px solid #E2E8F0',
                        borderRadius: 6, padding: '5px 8px', fontSize: 12,
                        background: sections.length > 1 ? '#2A4A7F' : '#fff',
                        color: sections.length > 1 ? '#fff' : '#374151',
                        outline: 'none',
                      }}
                    />
                    {sections.length > 1 && (
                      <button type="button" onClick={() => removeSection(sec.id)}
                        title="Eliminar sección"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16, padding: 2, flexShrink: 0 }}>
                        ×
                      </button>
                    )}
                  </div>

                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Academic types */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 6px' }}>Preguntas académicas</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {ACADEMIC_TYPES.map(t => (
                          <TypeCard key={t.key} type={t} count={sec.types[t.key] || 0}
                            onChange={v => setSecType(sec.id, t.key, v)} />
                        ))}
                      </div>
                    </div>

                    {/* Biblical types */}
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#7B3F00', margin: '0 0 6px' }}>
                        Preguntas bíblicas{secIdx === 0 ? ` — mínimo ${BIBLICAL_MIN} global (CBF)` : ''}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {BIBLICAL_TYPES.map(t => {
                          const count = sec.types[t.key] || 0
                          const globalBiblicalIfRemoved = sections.reduce((sum, s) =>
                            sum + BIBLICAL_TYPES.reduce((ss, bt) =>
                              ss + (s.id === sec.id ? (bt.key === t.key ? Math.max(0, count - 1) : (s.types[bt.key] || 0)) : (s.types[bt.key] || 0)), 0), 0)
                          const wouldBreakMin = globalBiblicalIfRemoved < BIBLICAL_MIN
                          return (
                            <TypeCard key={t.key} type={t} count={count}
                              onChange={v => setSecType(sec.id, t.key, v)}
                              locked={wouldBreakMin && count > 0}
                              lockReason={wouldBreakMin && count > 0 ? `Mínimo ${BIBLICAL_MIN} bíblicas` : null}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add section button */}
              <button type="button" onClick={addSection}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8,
                  border: '1.5px dashed #C7D7FF', background: '#F8FAFF',
                  color: '#4F81BD', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>
                + Agregar sección
              </button>

              {/* Extra Points section — only for final exams */}
              {currentPreset.hasExtraPoints && (
                <div style={{
                  border: '2px solid #93C5FD', borderRadius: 12, overflow: 'hidden',
                  background: '#F0F9FF',
                }}>
                  <div style={{
                    background: 'linear-gradient(135deg, #1E40AF, #3B82F6)',
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{ fontSize: 16 }}>🎧</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                      Extra Points — Listening
                    </span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                      background: 'rgba(255,255,255,.2)', color: '#fff',
                      padding: '2px 8px', borderRadius: 6,
                    }}>
                      5 preguntas · +0.1 c/u
                    </span>
                  </div>
                  <div style={{ padding: '12px 14px', fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
                    <p style={{ margin: '0 0 6px' }}>
                      Se generan automáticamente <strong>5 preguntas de listening</strong> como Extra Points.
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, color: '#64748B', fontSize: 11 }}>
                      <li>No cuentan en la nota base ({currentPreset.baseQuestions} preguntas)</li>
                      <li>Cada una suma <strong>+0.1</strong> a la nota final (máx +0.5)</li>
                      <li>Solo ayudan a subir la nota, nunca a bajarla</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PASO 3 — Revisar preguntas ───────────────────────────────── */}
          {step === 3 && generatedExam && (
            <div>
              <div style={{
                background: '#ECFDF5', borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                fontSize: 13, color: '#065F46', display: 'flex', gap: 12, flexWrap: 'wrap',
              }}>
                <span>{generatedExam.questions.length} preguntas</span>
                <span>·</span>
                <span>{totalScore} puntos</span>
                <span>·</span>
                <span style={{ color: '#7B3F00' }}>
                  {generatedExam.questions.filter(q => ['biblical_reflection','verse_analysis','principle_application'].includes(q.question_type)).length} bíblicas
                </span>
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>Clic en pregunta para editar</span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Instrucciones generales</label>
                <textarea value={form.instructions} onChange={e => setF('instructions', e.target.value)} rows={2} style={ta} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {generatedExam.questions.map((q, idx) => {
                  const isBiblical = BIBLICAL_TYPES.some(t => t.key === q.question_type)
                  const typeMeta = [...ACADEMIC_TYPES, ...BIBLICAL_TYPES].find(t => t.key === q.question_type) || ACADEMIC_TYPES[0]
                  const isEditing = editingQ === idx
                  const prevQ = generatedExam.questions[idx - 1]
                  const showSectionHeader = q.section_name && q.section_name !== (prevQ?.section_name || '')
                  return (
                    <div key={idx}>
                      {showSectionHeader && (
                        <div style={{
                          padding: '6px 12px', marginTop: idx > 0 ? 8 : 0, marginBottom: 4,
                          background: '#1F3864', borderRadius: 7,
                          fontSize: 11, fontWeight: 800, color: '#93C5FD', letterSpacing: '0.05em',
                        }}>
                          {q.section_name}
                        </div>
                      )}
                    <div style={{
                      border: `1px solid ${isEditing ? '#1F3864' : isBiblical ? '#D4B896' : '#E2E8F0'}`,
                      borderLeft: `4px solid ${typeMeta.color}`,
                      borderRadius: 10, overflow: 'hidden',
                      background: isEditing ? '#F0F4FF' : isBiblical ? '#FDF8F0' : '#fff',
                    }}>
                      <button type="button" onClick={() => setEditingQ(isEditing ? null : idx)}
                        style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ background: typeMeta.color, color: '#fff', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {isBiblical ? '✝' : idx + 1}
                        </span>
                        <span style={{ fontSize: 12, color: '#374151', flex: 1, textAlign: 'left' }}>{q.stem}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          {q.criteria?.rigor_level && RIGOR_META[q.criteria.rigor_level] && (
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                              background: RIGOR_META[q.criteria.rigor_level].bg,
                              color: RIGOR_META[q.criteria.rigor_level].color,
                              border: `1px solid ${RIGOR_META[q.criteria.rigor_level].border}`,
                            }}>
                              {RIGOR_META[q.criteria.rigor_level].label}
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: '#64748B' }}>{q.points}pts · {typeMeta.label}</span>
                        </div>
                      </button>
                      {isEditing && (
                        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <textarea value={q.stem} rows={3} onChange={e => updateQuestion(idx, 'stem', e.target.value)} style={ta} />
                          {q.question_type === 'multiple_choice' && Array.isArray(q.options) && (
                            <div>
                              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>Opciones (correcta: {q.correct_answer})</label>
                              {q.options.map((opt, oi) => (
                                <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, color: '#64748B', minWidth: 18, paddingTop: 7 }}>{String.fromCharCode(65 + oi)}</span>
                                  <input value={opt.replace(/^[A-D]\)\s*/, '')} onChange={e => {
                                    const newOpts = [...q.options]; newOpts[oi] = `${String.fromCharCode(65 + oi)}) ${e.target.value}`
                                    updateQuestion(idx, 'options', newOpts)
                                  }} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12 }} />
                                  <button type="button" onClick={() => updateQuestion(idx, 'correct_answer', String.fromCharCode(65 + oi))}
                                    style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                                      background: q.correct_answer === String.fromCharCode(65 + oi) ? '#ECFDF5' : '#F8FAFC',
                                      color: q.correct_answer === String.fromCharCode(65 + oi) ? '#15803D' : '#94A3B8',
                                      border: `1px solid ${q.correct_answer === String.fromCharCode(65 + oi) ? '#A7F3D0' : '#E2E8F0'}` }}>✓</button>
                                </div>
                              ))}
                            </div>
                          )}
                          {q.criteria && (
                            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px', border: '1px solid #E2E8F0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: 0 }}>Criterios de evaluación IA</p>
                                {q.criteria.bloom_level && (
                                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: '#F0F4FF', color: '#3730A3', border: '1px solid #C7D7FF', fontWeight: 600 }}>
                                    Bloom: {q.criteria.bloom_level}
                                  </span>
                                )}
                              </div>
                              <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 5 }}>
                                Rigor de corrección — define cuánta exactitud exige el corrector IA:
                              </label>
                              <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
                                {Object.entries(RIGOR_META).map(([key, meta]) => (
                                  <button key={key} type="button"
                                    onClick={() => updateCriteria(idx, 'rigor_level', key)}
                                    style={{
                                      flex: 1, padding: '6px 4px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                                      cursor: 'pointer', textAlign: 'center',
                                      background: q.criteria.rigor_level === key ? meta.bg : '#fff',
                                      color: q.criteria.rigor_level === key ? meta.color : '#64748B',
                                      border: `1.5px solid ${q.criteria.rigor_level === key ? meta.border : '#E2E8F0'}`,
                                    }}>
                                    {meta.label}
                                  </button>
                                ))}
                              </div>
                              {q.criteria.rigor_level && RIGOR_META[q.criteria.rigor_level] && (
                                <div style={{ fontSize: 10, color: RIGOR_META[q.criteria.rigor_level].color, marginBottom: 8, fontStyle: 'italic' }}>
                                  {RIGOR_META[q.criteria.rigor_level].desc}
                                </div>
                              )}
                              <textarea value={q.criteria.model_answer || ''} rows={2}
                                onChange={e => updateCriteria(idx, 'model_answer', e.target.value)}
                                placeholder="Respuesta modelo (referencia para el corrector IA)"
                                style={ta} />
                              <input value={(q.criteria.key_concepts || []).join(', ')}
                                onChange={e => updateCriteria(idx, 'key_concepts', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                placeholder="Conceptos clave que debe mencionar (separados por coma)"
                                style={{ ...inp, marginTop: 6 }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── PASO 4 — Publicar ────────────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ExamInstitutionalHeader school={school} examInfo={{
                'Tipo': `${currentPreset.icon} ${currentPreset.label}`,
                'Grado': form.grade, 'Materia': form.subject,
                'Período': form.period ? `Período ${form.period}` : null,
                'Tiempo': form.time_limit > 0 ? `${form.time_limit} min` : null,
              }} />
              <div style={{ background: '#F0F4FF', borderRadius: 10, padding: '14px', border: '1px solid #C7D7FF', fontSize: 13, color: '#374151' }}>
                <div><strong>Preguntas:</strong> {generatedExam?.questions?.length || 0} · {totalScore} puntos</div>
                <div style={{ marginTop: 4, color: '#7B3F00' }}>
                  <strong>Bíblicas:</strong> {generatedExam?.questions?.filter(q => BIBLICAL_TYPES.some(t => t.key === q.question_type)).length || 0}
                </div>
                {form.indicator && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#64748B' }}>
                    <strong>Indicador:</strong> {form.indicator.text}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Título del examen *</label>
                <input value={form.title} onChange={e => setF('title', e.target.value)}
                  placeholder="Ej: Examen Parcial P1 — Fotosíntesis y Célula"
                  style={{ ...inp, fontSize: 14, padding: '10px 12px' }} />
              </div>
              <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '12px 14px', border: '1px solid #FDE68A', fontSize: 13, color: '#92400E' }}>
                <strong>Al publicar:</strong> Se genera un código de acceso único. Los estudiantes acceden en <code>/exam/CODIGO</code>.
                Las respuestas abiertas se corrigen con IA (revisión humana disponible).
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="ec-footer">
        <button type="button" onClick={handleBack}
          style={{ padding: '9px 18px', borderRadius: 9, fontSize: 14, cursor: 'pointer', background: '#F1F5F9', color: '#374151', border: 'none', fontWeight: 600 }}>
          {step === 1 ? '← Cancelar' : '← Atrás'}
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {step === 1 && (
            <button type="button" onClick={() => setStep(2)}
              disabled={!form.grade || !form.subject}
              style={{ padding: '9px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!form.grade || !form.subject) ? .5 : 1 }}>
              Siguiente →
            </button>
          )}
          {step === 2 && (
            <button type="button" onClick={handleGenerate} disabled={generating || total < 5 || biblicalTotal < BIBLICAL_MIN}
              style={{
                padding: '9px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                background: (generating || total < 5 || biblicalTotal < BIBLICAL_MIN) ? '#9CA3AF' : 'linear-gradient(135deg, #1F3864, #2E5598)',
                color: '#fff', border: 'none', cursor: (generating || total < 5 || biblicalTotal < BIBLICAL_MIN) ? 'default' : 'pointer',
                opacity: (total < 5 || biblicalTotal < BIBLICAL_MIN) && !generating ? .6 : 1,
              }}>
              {generating ? '⏳ Generando…' : `Generar ${total}${currentPreset.hasExtraPoints ? ' + 5 Extra' : ''} preguntas →`}
            </button>
          )}
          {step === 3 && (
            <button type="button" onClick={() => setStep(4)}
              style={{ padding: '9px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Continuar →
            </button>
          )}
          {step === 4 && (
            <button type="button" onClick={handlePublish} disabled={saving || !form.title.trim()}
              style={{ padding: '9px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #15803D, #166534)', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer' }}>
              {saving ? '⏳ Guardando…' : 'Publicar Examen'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Inline styles ────────────────────────────────────────────────────────────
const lbl = { fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }
const sel = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }
const inp = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13, boxSizing: 'border-box' }
const ta  = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }
