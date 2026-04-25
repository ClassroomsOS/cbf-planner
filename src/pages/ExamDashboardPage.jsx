// ── ExamDashboardPage.jsx ─────────────────────────────────────────────────────
// /exams — Teacher view: list assessments, create with AI, share access codes.
// ExamCreatorModal wizard:
//   Paso 1 — Contexto pedagógico (cascada: grado→materia→período→logro→indicador→principio bíblico)
//   Paso 2 — Tipos de pregunta (11 tipos, 3 bíblicas obligatorias mínimo)
//   Paso 3 — Revisar preguntas generadas
//   Paso 4 — Publicar

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { generateExamQuestions } from '../utils/AIAssistant'
import { printExamHtml } from '../utils/exportExamHtml'
import { canManage } from '../utils/roles'

// ── UI helpers ────────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function gradeColor(g) {
  if (g == null) return '#9CA3AF'
  if (g >= 4.5) return '#15803D'
  if (g >= 4.0) return '#1D4ED8'
  if (g >= 3.0) return '#D97706'
  return '#DC2626'
}

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
function ExamInstitutionalHeader({ school, examInfo }) {
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

// ── Question type definitions ─────────────────────────────────────────────────
const ACADEMIC_TYPES = [
  { key: 'multiple_choice',  label: 'Opción múltiple',    pts: 2, icon: '🔵', color: '#4F81BD', bloom: 'Recordar/Aplicar',  hint: '4 opciones A–D' },
  { key: 'true_false',       label: 'Verdadero/Falso',    pts: 1, icon: '⚡', color: '#4BACC6', bloom: 'Recordar',          hint: 'V o F' },
  { key: 'fill_blank',       label: 'Completar espacio',  pts: 2, icon: '✏️', color: '#9BBB59', bloom: 'Aplicar',           hint: 'Completa el ___' },
  { key: 'matching',         label: 'Relacionar',         pts: 3, icon: '🔗', color: '#F79646', bloom: 'Comprender',        hint: 'Columna A ↔ B' },
  { key: 'short_answer',     label: 'Respuesta corta',    pts: 3, icon: '💬', color: '#8064A2', bloom: 'Aplicar',           hint: '2–3 oraciones' },
  { key: 'error_correction', label: 'Corregir el error',  pts: 3, icon: '🔍', color: '#C0504D', bloom: 'Analizar',          hint: 'Encuentra el error' },
  { key: 'sequencing',       label: 'Ordenar pasos',      pts: 3, icon: '🔢', color: '#70AD47', bloom: 'Comprender',        hint: '1 → 2 → 3 → 4' },
  { key: 'open_development', label: 'Desarrollo/Ensayo',  pts: 5, icon: '📝', color: '#1F3864', bloom: 'Evaluar/Crear',     hint: 'Respuesta extensa' },
]

const BIBLICAL_TYPES = [
  { key: 'biblical_reflection',   label: 'Reflexión bíblica',   pts: 4, icon: '✝️', color: '#7B3F00', bloom: 'Aplicar',  hint: '¿Qué significa para ti?' },
  { key: 'verse_analysis',        label: 'Analizar versículo',   pts: 4, icon: '📖', color: '#6B3A8C', bloom: 'Analizar', hint: 'Significado profundo' },
  { key: 'principle_application', label: 'Aplicar principio',    pts: 4, icon: '🙏', color: '#A0522D', bloom: 'Evaluar',  hint: 'Situación de vida real' },
]

const BIBLICAL_MIN = 3

// ── Rigor level metadata ──────────────────────────────────────────────────────
const RIGOR_META = {
  strict:     { label: 'Estricto',   desc: 'El estudiante debe usar los términos exactos de la rúbrica', color: '#92400E', bg: '#FEF3C7', border: '#FCD34D' },
  flexible:   { label: 'Flexible',   desc: 'Se acepta paráfrasis que demuestre comprensión real',        color: '#065F46', bg: '#ECFDF5', border: '#6EE7B7' },
  conceptual: { label: 'Conceptual', desc: 'Se valida que el estudiante llegó a la idea central',         color: '#1E3A8A', bg: '#EFF6FF', border: '#93C5FD' },
}

function TypeCard({ type, count, onChange, locked, lockReason }) {
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

// ── EXAM CREATOR MODAL ────────────────────────────────────────────────────────
function ExamCreatorModal({ teacher, onClose, onCreated }) {
  const { showToast } = useToast()
  const [step, setStep] = useState(1)

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

  // ── Step 2 state — versions + question types ───────────────────────────
  const [versionCount, setVersionCount]   = useState(1)
  const [shuffleQuestions, setShuffleQ]   = useState(true)
  const [shuffleOptions,   setShuffleO]   = useState(true)
  const [questionTypes, setQuestionTypes] = useState({
    multiple_choice: 5, true_false: 0, fill_blank: 0, matching: 0,
    short_answer: 3, error_correction: 0, sequencing: 0, open_development: 2,
    biblical_reflection: 2, verse_analysis: 1, principle_application: 0,
  })

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

    // Biblical context from linked NEWS project
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

    // Syllabus topics for period
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

  // ── Question type helpers ──────────────────────────────────────────────
  const biblicalTotal = BIBLICAL_TYPES.reduce((s, t) => s + (questionTypes[t.key] || 0), 0)
  const academicTotal = ACADEMIC_TYPES.reduce((s, t) => s + (questionTypes[t.key] || 0), 0)
  const total = academicTotal + biblicalTotal

  function setQType(key, val) {
    const isBiblical = BIBLICAL_TYPES.some(t => t.key === key)
    if (isBiblical) {
      const newBiblicalTotal = BIBLICAL_TYPES.reduce((s, t) => s + (t.key === key ? val : (questionTypes[t.key] || 0)), 0)
      if (newBiblicalTotal < BIBLICAL_MIN) return // enforce minimum
    }
    setQuestionTypes(prev => ({ ...prev, [key]: Math.max(0, val) }))
  }

  const totalPts = [
    ...ACADEMIC_TYPES.map(t => (questionTypes[t.key] || 0) * t.pts),
    ...BIBLICAL_TYPES.map(t => (questionTypes[t.key] || 0) * t.pts),
  ].reduce((s, v) => s + v, 0)

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
        questionTypes,
        additionalContext: form.additionalContext.trim() || undefined,
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

      // Create assessment_versions (1 per version configured)
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
      onCreated()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const totalScore = generatedExam?.questions?.reduce((s, q) => s + (q.points || 0), 0) || totalPts
  const school = teacher.schools || {}

  return createPortal(
    <div className="lt-modal-overlay" style={{ zIndex: 9999 }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 800,
        maxHeight: '93vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1F3864 0%, #2E5598 100%)',
          color: '#fff', padding: '16px 24px', borderRadius: '16px 16px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>✨ Crear Examen con IA</h2>
            <p style={{ margin: '2px 0 0', opacity: .75, fontSize: 12 }}>
              Paso {step} de 4 · {['Contexto pedagógico', 'Tipos de pregunta', 'Revisar preguntas', 'Publicar'][step - 1]}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8,
            color: '#fff', fontSize: 18, width: 34, height: 34, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', flexShrink: 0 }}>
          {['Contexto', 'Tipos', 'Revisar', 'Publicar'].map((label, i) => (
            <div key={i} style={{
              flex: 1, padding: '9px 8px', textAlign: 'center', fontSize: 12,
              fontWeight: step === i + 1 ? 700 : 400,
              color: step > i + 1 ? '#15803D' : step === i + 1 ? '#1F3864' : '#9CA3AF',
              borderBottom: step === i + 1 ? '2px solid #1F3864' : '2px solid transparent',
            }}>
              {step > i + 1 ? '✓ ' : ''}{label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── PASO 1 — Contexto pedagógico ────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Header institucional preview */}
              <ExamInstitutionalHeader school={school} />

              {/* Cascade selectors */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Grado *</label>
                  <select value={form.grade} onChange={e => { setF('grade', e.target.value); setF('subject', ''); setF('goalId', '') }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }}>
                    <option value="">Selecciona…</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Materia *</label>
                  <select value={form.subject} onChange={e => { setF('subject', e.target.value); setF('goalId', '') }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }}>
                    <option value="">Selecciona…</option>
                    {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Período *</label>
                  <select value={form.period} onChange={e => { setF('period', e.target.value); setF('goalId', '') }}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }}>
                    <option value="">Selecciona…</option>
                    {['1','2','3','4'].map(p => <option key={p} value={p}>Período {p}</option>)}
                  </select>
                </div>
              </div>

              {/* Achievement goal selector */}
              {form.grade && form.subject && form.period && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>
                    Logro de Desempeño {loadingCascade ? '⏳' : ''}
                  </label>
                  {goals.length === 0 && !loadingCascade ? (
                    <div style={{ fontSize: 12, color: '#9CA3AF', padding: '8px 10px', background: '#F8FAFC', borderRadius: 7, border: '1px solid #E2E8F0' }}>
                      No hay logros para este grado/materia/período. El examen se basará en el contexto adicional.
                    </div>
                  ) : (
                    <select value={form.goalId} onChange={e => setF('goalId', e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }}>
                      <option value="">— Sin logro vinculado —</option>
                      {goals.map(g => <option key={g.id} value={g.id}>{g.text}</option>)}
                    </select>
                  )}
                </div>
              )}

              {/* Indicator selector */}
              {indicators.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>
                    Indicador de Logro evaluado *
                  </label>
                  <select value={form.indicatorId} onChange={e => setF('indicatorId', e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }}>
                    <option value="">— Selecciona el indicador —</option>
                    {indicators.map(i => <option key={i.id} value={i.id}>{i.text}</option>)}
                  </select>
                </div>
              )}

              {/* Biblical context (auto-loaded, editable) */}
              <div style={{
                background: form.biblicalContext.principle ? '#FDF8F0' : '#F8FAFC',
                border: `1px solid ${form.biblicalContext.principle ? '#F5DDB6' : '#E2E8F0'}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#7B3F00' }}>
                  ✝️ Principio Bíblico — {form.biblicalContext.principle ? 'cargado automáticamente' : 'completa si aplica'}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <textarea
                    value={form.biblicalContext.principle}
                    onChange={e => setF('biblicalContext', { ...form.biblicalContext, principle: e.target.value })}
                    rows={2} placeholder="Texto del principio bíblico…"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input value={form.biblicalContext.verse_ref}
                      onChange={e => setF('biblicalContext', { ...form.biblicalContext, verse_ref: e.target.value })}
                      placeholder="Referencia bíblica (ej. Juan 3:16)"
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13 }} />
                    <input value={form.biblicalContext.reflection}
                      onChange={e => setF('biblicalContext', { ...form.biblicalContext, reflection: e.target.value })}
                      placeholder="Reflexión/aplicación esperada"
                      style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13 }} />
                  </div>
                </div>
              </div>

              {/* Syllabus topics preview */}
              {form.syllabusTopics.length > 0 && (
                <div style={{ background: '#EFF6FF', borderRadius: 8, padding: '10px 12px', border: '1px solid #BFDBFE' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#1D4ED8' }}>
                    📚 Temas del syllabus ({form.syllabusTopics.length} semanas)
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
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>
                    Contexto adicional (opcional)
                  </label>
                  <textarea value={form.additionalContext}
                    onChange={e => setF('additionalContext', e.target.value)}
                    rows={2} placeholder="Especifica temas, unidades o conceptos adicionales que debe cubrir el examen…"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Tiempo (min)</label>
                  <input type="number" min="0" max="300" value={form.time_limit}
                    onChange={e => setF('time_limit', parseInt(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 2 — Tipos de pregunta ───────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Version picker */}
              <div style={{ background: '#F0F4FF', borderRadius: 10, padding: '12px 14px', border: '1px solid #C7D7FF' }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#1F3864' }}>
                  🔀 Versiones del examen — anti-copia
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
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#92400E' }}>⚠️ se generará en 2 llamadas</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748B' }}>
                  Bíblicas: <strong style={{ color: biblicalTotal >= BIBLICAL_MIN ? '#15803D' : '#DC2626' }}>{biblicalTotal}</strong>
                  <span style={{ color: '#9CA3AF' }}> / {BIBLICAL_MIN} mínimo</span>
                </div>
              </div>

              {/* Academic types */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
                  📋 Preguntas académicas
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {ACADEMIC_TYPES.map(t => (
                    <TypeCard key={t.key} type={t} count={questionTypes[t.key] || 0}
                      onChange={v => setQType(t.key, v)} />
                  ))}
                </div>
              </div>

              {/* Biblical types */}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#7B3F00', margin: '0 0 4px' }}>
                  ✝️ Preguntas bíblicas — mínimo {BIBLICAL_MIN} (obligatorio CBF)
                </p>
                {!form.biblicalContext.principle && (
                  <div style={{ fontSize: 11, color: '#92400E', background: '#FEF9C3', borderRadius: 6, padding: '5px 8px', marginBottom: 8, border: '1px solid #FDE68A' }}>
                    No hay principio bíblico cargado. Las preguntas bíblicas se generarán con contexto genérico.
                    Vuelve al Paso 1 para completarlo.
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {BIBLICAL_TYPES.map(t => {
                    const count = questionTypes[t.key] || 0
                    const wouldBreakMin = biblicalTotal - count + Math.max(0, count - 1) < BIBLICAL_MIN
                    return (
                      <TypeCard key={t.key} type={t} count={count}
                        onChange={v => setQType(t.key, v)}
                        locked={wouldBreakMin && count > 0}
                        lockReason={wouldBreakMin && count > 0 ? `Mínimo ${BIBLICAL_MIN} bíblicas` : null}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── PASO 3 — Revisar preguntas ───────────────────────────────── */}
          {step === 3 && generatedExam && (
            <div>
              <div style={{
                background: '#ECFDF5', borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                fontSize: 13, color: '#065F46', display: 'flex', gap: 12, flexWrap: 'wrap',
              }}>
                <span>📋 {generatedExam.questions.length} preguntas</span>
                <span>·</span>
                <span>📊 {totalScore} puntos</span>
                <span>·</span>
                <span style={{ color: '#7B3F00' }}>
                  ✝️ {generatedExam.questions.filter(q => ['biblical_reflection','verse_analysis','principle_application'].includes(q.question_type)).length} bíblicas
                </span>
                <span style={{ marginLeft: 'auto', color: '#9CA3AF' }}>Clic en pregunta para editar</span>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Instrucciones generales</label>
                <textarea value={form.instructions} onChange={e => setF('instructions', e.target.value)} rows={2}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {generatedExam.questions.map((q, idx) => {
                  const isBiblical = BIBLICAL_TYPES.some(t => t.key === q.question_type)
                  const typeMeta = [...ACADEMIC_TYPES, ...BIBLICAL_TYPES].find(t => t.key === q.question_type) || ACADEMIC_TYPES[0]
                  const isEditing = editingQ === idx
                  return (
                    <div key={idx} style={{
                      border: `1px solid ${isEditing ? '#1F3864' : isBiblical ? '#D4B896' : '#E2E8F0'}`,
                      borderLeft: `4px solid ${typeMeta.color}`,
                      borderRadius: 10, overflow: 'hidden',
                      background: isEditing ? '#F0F4FF' : isBiblical ? '#FDF8F0' : '#fff',
                    }}>
                      <button type="button" onClick={() => setEditingQ(isEditing ? null : idx)}
                        style={{ width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ background: typeMeta.color, color: '#fff', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {isBiblical ? '✝️' : idx + 1}
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
                          <textarea value={q.stem} rows={3} onChange={e => updateQuestion(idx, 'stem', e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
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
                              {/* Rigor level selector */}
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
                              {/* Model answer */}
                              <textarea value={q.criteria.model_answer || ''} rows={2}
                                onChange={e => updateCriteria(idx, 'model_answer', e.target.value)}
                                placeholder="Respuesta modelo (referencia para el corrector IA)"
                                style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                              {/* Key concepts */}
                              <input value={(q.criteria.key_concepts || []).join(', ')}
                                onChange={e => updateCriteria(idx, 'key_concepts', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                placeholder="Conceptos clave que debe mencionar (separados por coma)"
                                style={{ width: '100%', marginTop: 6, padding: '6px 8px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12 }} />
                            </div>
                          )}
                        </div>
                      )}
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
                'Grado': form.grade, 'Materia': form.subject,
                'Período': form.period ? `Período ${form.period}` : null,
                'Tiempo': form.time_limit > 0 ? `${form.time_limit} min` : null,
              }} />
              <div style={{ background: '#F0F4FF', borderRadius: 10, padding: '14px', border: '1px solid #C7D7FF', fontSize: 13, color: '#374151' }}>
                <div><strong>Preguntas:</strong> {generatedExam?.questions?.length || 0} · {totalScore} puntos</div>
                <div style={{ marginTop: 4, color: '#7B3F00' }}>
                  <strong>✝️ Bíblicas:</strong> {generatedExam?.questions?.filter(q => BIBLICAL_TYPES.some(t => t.key === q.question_type)).length || 0}
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
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 14, boxSizing: 'border-box' }} />
              </div>
              <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '12px 14px', border: '1px solid #FDE68A', fontSize: 13, color: '#92400E' }}>
                <strong>Al publicar:</strong> Se genera un código de acceso único. Los estudiantes acceden en <code>/exam/CODIGO</code>.
                Las respuestas abiertas se corrigen con IA (revisión humana disponible).
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', flexShrink: 0, background: '#FAFAFA',
        }}>
          <button type="button" onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            style={{ padding: '9px 18px', borderRadius: 9, fontSize: 14, cursor: 'pointer', background: '#F1F5F9', color: '#374151', border: 'none', fontWeight: 600 }}>
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 && (
              <button type="button" onClick={handleGenerate} disabled={generating || total < 5 || biblicalTotal < BIBLICAL_MIN}
                style={{
                  padding: '9px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700,
                  background: (generating || total < 5 || biblicalTotal < BIBLICAL_MIN) ? '#9CA3AF' : 'linear-gradient(135deg, #1F3864, #2E5598)',
                  color: '#fff', border: 'none', cursor: (generating || total < 5 || biblicalTotal < BIBLICAL_MIN) ? 'default' : 'pointer',
                  opacity: (total < 5 || biblicalTotal < BIBLICAL_MIN) && !generating ? .6 : 1,
                }}>
                {generating ? '⏳ Generando…' : `✨ Generar ${total} preguntas →`}
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
                {saving ? '⏳ Guardando…' : '📤 Publicar Examen'}
              </button>
            )}
            {step === 1 && (
              <button type="button" onClick={() => setStep(2)}
                disabled={!form.grade || !form.subject}
                style={{ padding: '9px 22px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!form.grade || !form.subject) ? .5 : 1 }}>
                Siguiente →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Seeded shuffle (LCG — mismo algoritmo que ExamPlayerPage) ─────────────────
function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
    const j = Math.abs(s) % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
    async function load() {
      const [{ data: qs }, { data: vs }] = await Promise.all([
        supabase.from('questions')
          .select('id, question_type, stem, options, correct_answer, points, position')
          .eq('assessment_id', exam.id).order('position'),
        supabase.from('assessment_versions')
          .select('id, version_number, version_label, is_base, shuffle_questions')
          .eq('assessment_id', exam.id).order('version_number'),
      ])
      setQuestions(qs || [])
      setVersions(vs?.length ? vs : [{ id: 'base', version_label: 'A', is_base: true, shuffle_questions: false }])
      setLoading(false)
    }
    load()
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
    const { error } = await supabase.from('questions').update(updates).eq('id', q.id)
    setSaving(false)
    if (error) { showToast('Error: ' + error.message, 'error'); return }
    setQuestions(prev => prev.map(p => p.id === q.id ? { ...p, ...updates } : p))
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
      // 1. Cargar preguntas del examen
      const { data: questions, error: qErr } = await supabase
        .from('questions')
        .select('id, question_type, stem, options, correct_answer, points, position, rigor_level')
        .eq('assessment_id', exam.id)
        .order('position')
      if (qErr) throw new Error('Error al cargar preguntas: ' + qErr.message)
      if (!questions?.length) throw new Error('Este examen no tiene preguntas.')

      // 2. Cargar versiones anti-copia
      const { data: versions } = await supabase
        .from('assessment_versions')
        .select('version_number, version_label, shuffle_questions, shuffle_options')
        .eq('assessment_id', exam.id)
        .order('version_number')
      const versionCount = versions?.length || 1

      // 3. Crear exam_session para V2 player
      const v2Code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: session, error: sErr } = await supabase
        .from('exam_sessions')
        .insert({
          school_id:        teacher.school_id,
          teacher_id:       teacher.id,
          title:            exam.title,
          subject:          exam.subject,
          grade:            exam.grade,
          period:           exam.period || null,
          access_code:      v2Code,
          status:           'ready',
          duration_minutes: exam.time_limit_minutes || null,
          total_students:   roster.length,
          service_worker_payload: { assessment_id: exam.id, generated_at: new Date().toISOString() },
        })
        .select('id')
        .single()
      if (sErr || !session?.id) throw new Error('Error al crear sesión V2: ' + (sErr?.message || 'sin ID'))

      // 4. Crear exam_instance por estudiante
      const VERSION_LABELS = ['A', 'B', 'C', 'D']
      let created = 0
      let failed  = 0

      for (let i = 0; i < roster.length; i++) {
        const student  = roster[i]
        const vIdx     = i % versionCount
        const vLabel   = versions?.[vIdx]?.version_label || VERSION_LABELS[vIdx] || 'A'
        const seed     = (vIdx + 1) * 31337

        // Construir preguntas con shuffle según versión
        let qs = questions.map((q, idx) => ({
          id:            q.id,
          stem:          q.stem,
          question_type: q.question_type,
          options:       q.options || null,
          correct_answer: q.correct_answer || null,
          points:        q.points || 1,
          position:      idx + 1,
          section_name:  '',
          biblical:      false,
          rigor_level:   q.rigor_level || 'flexible',
        }))
        if (versions?.[vIdx]?.shuffle_questions && vIdx > 0) {
          qs = seededShuffle(qs, seed)
        }

        const { error: iErr } = await supabase.from('exam_instances').insert({
          session_id:          session.id,
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

      setResult({ created, failed, total: roster.length, v2Code, sessionId: session.id })
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
  const [changing,       setChanging]       = useState(false)
  const [printing,       setPrinting]       = useState(false)
  const [versions,       setVersions]       = useState([])
  const [showGenRoster,  setShowGenRoster]  = useState(false)
  const [showPreview,    setShowPreview]    = useState(false)
  const baseUrl = window.location.origin + window.location.pathname

  useEffect(() => {
    supabase.from('assessment_versions')
      .select('id, version_number, version_label, is_base, shuffle_questions, shuffle_options')
      .eq('assessment_id', exam.id)
      .order('version_number')
      .then(({ data }) => setVersions(data || []))
  }, [exam.id])

  async function handlePrint() {
    setPrinting(true)
    try {
      const { data: questions, error } = await supabase
        .from('questions')
        .select('id, question_type, stem, options, points, position')
        .eq('assessment_id', exam.id)
        .order('position')
      if (error) throw error
      const school = teacher?.schools || teacher?.school || {}
      await printExamHtml({ assessment: exam, questions: questions || [], school, teacherName: teacher?.full_name || '' })
    } catch (err) {
      showToast('Error al imprimir: ' + err.message, 'error')
    } finally {
      setPrinting(false)
    }
  }

  async function toggleStatus() {
    setChanging(true)
    const newStatus = exam.status === 'active' ? 'closed' : 'active'
    const { error } = await supabase.from('assessments').update({ status: newStatus }).eq('id', exam.id)
    if (error) { showToast('Error: ' + error.message, 'error') }
    else { onStatusChange(exam.id, newStatus); showToast(`Examen ${newStatus === 'active' ? 'activado' : 'cerrado'}`, 'success') }
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
  const [exams,    setExams]    = useState([])
  const [results,  setResults]  = useState({})
  const [sessions, setSessions] = useState({})
  const [pending,  setPending]  = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [showCreator, setShowCreator] = useState(false)
  const [detailExam,  setDetailExam]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const schoolId = teacher.school_id

    const { data: aRows } = await supabase
      .from('assessments')
      .select('id, title, subject, grade, period, status, access_code, created_at, time_limit_minutes, created_by')
      .eq('school_id', schoolId)
      .eq('created_by', teacher.id)
      .order('created_at', { ascending: false })
    const examList = aRows || []
    setExams(examList)

    if (examList.length === 0) { setLoading(false); return }
    const ids = examList.map(e => e.id)

    const { data: rRows } = await supabase
      .from('assessment_results')
      .select('session_id, assessment_id, final_grade, percentage, status')
      .in('assessment_id', ids)
    const rMap = {}
    for (const r of rRows || []) { ;(rMap[r.assessment_id] = rMap[r.assessment_id] || []).push(r) }
    setResults(rMap)

    const { data: sRows } = await supabase
      .from('student_exam_sessions')
      .select('assessment_id, student_name, status')
      .in('assessment_id', ids)
    const sMap = {}
    for (const s of sRows || []) { ;(sMap[s.assessment_id] = sMap[s.assessment_id] || []).push(s) }
    setSessions(sMap)

    const { count } = await supabase
      .from('ai_evaluations')
      .select('id', { count: 'exact', head: true })
      .eq('requires_review', true)
      .in('question_id',
        (await supabase.from('questions').select('id').in('assessment_id', ids)).data?.map(q => q.id) || []
      )
    setPending(count || 0)
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
          <button type="button" onClick={() => setShowCreator(true)} style={{ padding: '9px 18px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff', border: 'none', cursor: 'pointer' }}>
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
          <button type="button" onClick={() => setShowCreator(true)} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700, background: 'linear-gradient(135deg, #1F3864, #2E5598)', color: '#fff', border: 'none', cursor: 'pointer' }}>
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
                  <button type="button" onClick={() => setDetailExam(exam)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: '#1F3864', color: '#fff', border: 'none', cursor: 'pointer' }}>Ver →</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreator && (
        <ExamCreatorModal teacher={teacher} onClose={() => setShowCreator(false)} onCreated={() => { setShowCreator(false); load() }} />
      )}
      {detailExam && (
        <ExamDetailModal exam={detailExam} results={results[detailExam.id] || []} onClose={() => setDetailExam(null)} onStatusChange={handleStatusChange} teacher={teacher} />
      )}
    </div>
  )
}
