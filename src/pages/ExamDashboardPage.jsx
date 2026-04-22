// ── ExamDashboardPage.jsx ─────────────────────────────────────────────────────
// /exams — Teacher view: list assessments, create with AI, share access codes.
// Includes ExamCreatorModal (wizard 4 steps): Info → Config → AI Review → Publish

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { generateExamQuestions } from '../utils/AIAssistant'
import { canManage } from '../utils/roles'

// ── helpers ──────────────────────────────────────────────────────────────────
function fmt(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function gradeColor(g) {
  if (g === null || g === undefined) return '#9CA3AF'
  if (g >= 4.5) return '#15803D'
  if (g >= 4.0) return '#1D4ED8'
  if (g >= 3.0) return '#D97706'
  return '#DC2626'
}

function StatusBadge({ status }) {
  const meta = {
    draft:     { label: 'Borrador',  bg: '#FFF8E1', color: '#7A6200' },
    active:    { label: 'Activo',    bg: '#ECFDF5', color: '#065F46' },
    closed:    { label: 'Cerrado',   bg: '#F1F5F9', color: '#475569' },
    archived:  { label: 'Archivado', bg: '#F5F5F5', color: '#6B7280' },
  }
  const m = meta[status] || meta.draft
  return (
    <span style={{
      background: m.bg, color: m.color, borderRadius: 5,
      padding: '2px 8px', fontSize: 11, fontWeight: 700,
    }}>{m.label}</span>
  )
}

// ── Copy to clipboard helper ─────────────────────────────────────────────────
function CopyCode({ code }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
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
      <span style={{ fontSize: 11, fontWeight: 400, letterSpacing: 0 }}>
        {copied ? '✓ copiado' : '📋'}
      </span>
    </button>
  )
}

// ── EXAM CREATOR MODAL ────────────────────────────────────────────────────────
const QUESTION_TYPES = [
  { key: 'multiple_choice', label: 'Opción múltiple', pts: 2, color: '#4F81BD' },
  { key: 'short_answer',    label: 'Respuesta corta', pts: 3, color: '#F79646' },
  { key: 'open_development',label: 'Desarrollo',      pts: 5, color: '#8064A2' },
]

function ExamCreatorModal({ teacher, onClose, onCreated }) {
  const { showToast } = useToast()
  const [step, setStep] = useState(1)

  // Step 1 — basic info
  const [form, setForm] = useState({
    title: '', subject: '', grade: '', period: '', topic: '',
    instructions: '', time_limit: 60,
  })
  // Step 2 — config
  const [numQ, setNumQ] = useState(15)
  const [mix, setMix] = useState({ multiple_choice: 0.4, short_answer: 0.3, open_development: 0.3 })
  // Step 3 — AI result
  const [generating, setGenerating] = useState(false)
  const [generatedExam, setGeneratedExam] = useState(null)
  const [editingQ, setEditingQ] = useState(null) // index of question being edited
  // Step 4 — publish
  const [saving, setSaving] = useState(false)

  // Load assignments for subject/grade dropdowns
  const [assignments, setAssignments] = useState([])
  useEffect(() => {
    supabase.from('teacher_assignments')
      .select('grade, section, subject')
      .eq('teacher_id', teacher.id)
      .then(({ data }) => setAssignments(data || []))
  }, [teacher.id])

  const subjects = [...new Set(assignments.map(a => a.subject).filter(Boolean))].sort()
  const grades   = [...new Set(assignments.map(a => a.section ? `${a.grade} ${a.section}` : a.grade).filter(Boolean))].sort()

  // Mix totals
  const mcCount  = Math.round(numQ * mix.multiple_choice)
  const saCount  = Math.round(numQ * mix.short_answer)
  const devCount = numQ - mcCount - saCount
  const totalPts = mcCount * 2 + saCount * 3 + devCount * 5

  function setMixSlider(key, val) {
    const v = parseFloat(val) / 100
    const others = Object.keys(mix).filter(k => k !== key)
    const remaining = Math.max(0, 1 - v)
    const otherSum  = others.reduce((s, k) => s + mix[k], 0)
    const newMix = { ...mix, [key]: v }
    if (otherSum > 0) {
      for (const k of others) newMix[k] = parseFloat((mix[k] / otherSum * remaining).toFixed(2))
    } else {
      newMix[others[0]] = parseFloat((remaining / 2).toFixed(2))
      newMix[others[1]] = parseFloat((remaining / 2).toFixed(2))
    }
    setMix(newMix)
  }

  async function handleGenerate() {
    if (!form.subject || !form.grade || !form.topic.trim()) {
      showToast('Completa materia, grado y tema antes de generar.', 'warning')
      return
    }
    setGenerating(true)
    try {
      const exam = await generateExamQuestions({
        subject: form.subject, grade: form.grade,
        topic: form.topic, period: form.period,
        numQuestions: numQ, questionMix: mix,
      })
      setGeneratedExam(exam)
      if (!form.title && exam.title) setForm(f => ({ ...f, title: exam.title }))
      if (!form.instructions && exam.instructions) setForm(f => ({ ...f, instructions: exam.instructions }))
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

  async function handlePublish() {
    if (!form.title.trim()) { showToast('Escribe un título para el examen.', 'warning'); return }
    if (!generatedExam?.questions?.length) return
    setSaving(true)
    try {
      // Generate 6-char access code
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Insert assessment
      const { data: assessment, error: aErr } = await supabase
        .from('assessments')
        .insert({
          school_id: teacher.school_id, teacher_id: teacher.id,
          subject: form.subject, grade: form.grade, period: form.period,
          title: form.title.trim(), instructions: form.instructions.trim(),
          access_code: accessCode, status: 'active',
          time_limit_minutes: form.time_limit || null,
        })
        .select('id')
        .single()

      if (aErr) throw new Error('Error al crear examen: ' + aErr.message)

      // Insert questions + criteria
      for (const q of generatedExam.questions) {
        const { data: question, error: qErr } = await supabase
          .from('questions')
          .insert({
            assessment_id: assessment.id,
            school_id: teacher.school_id,
            stem: q.stem, question_type: q.question_type,
            points: q.points, position: q.position,
            options: q.options || null,
            correct_answer: q.correct_answer || null,
          })
          .select('id')
          .single()

        if (qErr) throw new Error('Error al guardar preguntas: ' + qErr.message)

        if (q.criteria) {
          const { error: cErr } = await supabase
            .from('question_criteria')
            .insert({
              question_id: question.id, school_id: teacher.school_id,
              model_answer: q.criteria.model_answer || null,
              key_concepts: q.criteria.key_concepts || null,
              rubric: q.criteria.rubric || null,
              rigor_level: q.criteria.rigor_level || 'flexible',
              bloom_level: q.criteria.bloom_level || null,
              ai_correction_context: q.criteria.ai_correction_context || null,
            })
          if (cErr) throw new Error('Error al guardar rúbrica: ' + cErr.message)
        }
      }

      showToast(`Examen publicado — código: ${accessCode}`, 'success')
      onCreated()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const totalScore = generatedExam?.questions?.reduce((s, q) => s + (q.points || 0), 0) || totalPts

  return createPortal(
    <div className="lt-modal-overlay" style={{ zIndex: 9999 }}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 760,
        maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #1F3864 0%, #2E5598 100%)',
          color: '#fff', padding: '18px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderRadius: '16px 16px 0 0', flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>✨ Crear Examen con IA</h2>
            <p style={{ margin: '2px 0 0', opacity: .75, fontSize: 12 }}>
              Paso {step} de 4 · {['Info básica', 'Configuración', 'Revisar preguntas', 'Publicar'][step - 1]}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 8,
            color: '#fff', fontSize: 18, width: 34, height: 34, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Step indicators */}
        <div style={{
          display: 'flex', borderBottom: '1px solid #E2E8F0', flexShrink: 0,
          background: '#F8FAFC',
        }}>
          {['Info', 'Config', 'Revisar', 'Publicar'].map((label, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px 8px', textAlign: 'center', fontSize: 12,
              fontWeight: step === i + 1 ? 700 : 400,
              color: step > i + 1 ? '#15803D' : step === i + 1 ? '#1F3864' : '#9CA3AF',
              borderBottom: step === i + 1 ? '2px solid #1F3864' : '2px solid transparent',
            }}>
              {step > i + 1 ? '✓ ' : ''}{label}
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

          {/* STEP 1 — Info básica */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Materia *</label>
                  <select value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 14 }}>
                    <option value="">Selecciona…</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Grado *</label>
                  <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 14 }}>
                    <option value="">Selecciona…</option>
                    {grades.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Período</label>
                  <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 14 }}>
                    <option value="">— Sin especificar</option>
                    {['1', '2', '3', '4'].map(p => <option key={p} value={p}>Período {p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tiempo límite (min)</label>
                  <input type="number" min="0" max="300" value={form.time_limit}
                    onChange={e => setForm(f => ({ ...f, time_limit: parseInt(e.target.value) || 0 }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 14 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Tema / Descripción del examen *
                </label>
                <textarea value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                  rows={4} placeholder="Describe el tema, unidad y conceptos que cubre este examen. Cuanto más detallado, mejor será el resultado de la IA."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}

          {/* STEP 2 — Configuración */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
                  Número de preguntas: <strong style={{ color: '#1F3864' }}>{numQ}</strong>
                  {numQ > 25 && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#F59E0B', fontWeight: 400 }}>
                      · se generará en 2 llamadas paralelas
                    </span>
                  )}
                </label>
                <input type="range" min="5" max="50" value={numQ}
                  onChange={e => setNumQ(parseInt(e.target.value))}
                  style={{ width: '100%' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                  <span>5</span><span style={{ color: numQ > 25 ? '#F59E0B' : '#9CA3AF' }}>25 →</span><span>50</span>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                  Distribución de tipos de pregunta
                </p>
                {QUESTION_TYPES.map(qt => {
                  const count = qt.key === 'multiple_choice' ? mcCount
                    : qt.key === 'short_answer' ? saCount : devCount
                  const pct = Math.round(mix[qt.key] * 100)
                  return (
                    <div key={qt.key} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: qt.color }}>{qt.label}</span>
                        <span style={{ fontSize: 12, color: '#64748B' }}>
                          {count} preg. · {count * qt.pts} pts · {pct}%
                        </span>
                      </div>
                      <input type="range" min="0" max="100" value={pct}
                        onChange={e => setMixSlider(qt.key, e.target.value)}
                        style={{ width: '100%', accentColor: qt.color }} />
                    </div>
                  )
                })}
                <div style={{
                  background: '#F0F4FF', borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#1F3864', fontWeight: 600, marginTop: 8,
                }}>
                  Total: {numQ} preguntas · {totalPts} puntos
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Revisar preguntas generadas por IA */}
          {step === 3 && generatedExam && (
            <div>
              <div style={{
                background: '#ECFDF5', borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: '#065F46', marginBottom: 16,
                display: 'flex', gap: 12, flexWrap: 'wrap',
              }}>
                <span>📋 {generatedExam.questions.length} preguntas generadas</span>
                <span>·</span>
                <span>📊 {totalScore} puntos en total</span>
                <span>·</span>
                <span>Haz clic en cualquier pregunta para editar</span>
              </div>

              {/* Instructions edit */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Instrucciones generales
                </label>
                <textarea value={form.instructions}
                  onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                  rows={2}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              {/* Questions list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {generatedExam.questions.map((q, idx) => {
                  const typeMeta = QUESTION_TYPES.find(t => t.key === q.question_type) || QUESTION_TYPES[0]
                  const isEditing = editingQ === idx
                  return (
                    <div key={idx} style={{
                      border: `1px solid ${isEditing ? '#1F3864' : '#E2E8F0'}`,
                      borderRadius: 10, overflow: 'hidden',
                      background: isEditing ? '#F0F4FF' : '#fff',
                    }}>
                      <button type="button"
                        onClick={() => setEditingQ(isEditing ? null : idx)}
                        style={{
                          width: '100%', padding: '10px 14px', background: 'none',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                        <span style={{
                          background: typeMeta.color, color: '#fff',
                          borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700,
                          flexShrink: 0, marginTop: 1,
                        }}>{idx + 1}</span>
                        <span style={{ fontSize: 13, color: '#1F3864', flex: 1, textAlign: 'left' }}>
                          {q.stem}
                        </span>
                        <span style={{ fontSize: 11, color: '#64748B', flexShrink: 0 }}>
                          {q.points} pts · {typeMeta.label}
                        </span>
                      </button>

                      {isEditing && (
                        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Pregunta</label>
                            <textarea value={q.stem} rows={3}
                              onChange={e => updateQuestion(idx, 'stem', e.target.value)}
                              style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Puntos</label>
                              <input type="number" min="1" max="50" value={q.points}
                                onChange={e => updateQuestion(idx, 'points', parseInt(e.target.value) || 1)}
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Tipo</label>
                              <select value={q.question_type}
                                onChange={e => updateQuestion(idx, 'question_type', e.target.value)}
                                style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: '1px solid #D0D5DD', fontSize: 13 }}>
                                {QUESTION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                              </select>
                            </div>
                          </div>

                          {q.question_type === 'multiple_choice' && Array.isArray(q.options) && (
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                                Opciones (respuesta correcta: {q.correct_answer})
                              </label>
                              {q.options.map((opt, oi) => (
                                <div key={oi} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, color: '#64748B', minWidth: 18, paddingTop: 8 }}>
                                    {String.fromCharCode(65 + oi)}
                                  </span>
                                  <input value={opt.replace(/^[A-D]\)\s*/, '')} onChange={e => {
                                    const newOpts = [...q.options]
                                    newOpts[oi] = `${String.fromCharCode(65 + oi)}) ${e.target.value}`
                                    updateQuestion(idx, 'options', newOpts)
                                  }}
                                    style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12 }} />
                                  <button type="button"
                                    onClick={() => updateQuestion(idx, 'correct_answer', String.fromCharCode(65 + oi))}
                                    style={{
                                      padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                                      background: q.correct_answer === String.fromCharCode(65 + oi) ? '#ECFDF5' : '#F8FAFC',
                                      color: q.correct_answer === String.fromCharCode(65 + oi) ? '#15803D' : '#94A3B8',
                                      border: `1px solid ${q.correct_answer === String.fromCharCode(65 + oi) ? '#A7F3D0' : '#E2E8F0'}`,
                                    }}>✓</button>
                                </div>
                              ))}
                            </div>
                          )}

                          {q.criteria && (
                            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px' }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>
                                Criterios de evaluación IA
                              </p>
                              <div>
                                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>Respuesta modelo</label>
                                <textarea value={q.criteria.model_answer || ''} rows={2}
                                  onChange={e => updateCriteria(idx, 'model_answer', e.target.value)}
                                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                              </div>
                              <div style={{ marginTop: 6 }}>
                                <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>
                                  Conceptos clave (separados por coma)
                                </label>
                                <input value={(q.criteria.key_concepts || []).join(', ')}
                                  onChange={e => updateCriteria(idx, 'key_concepts', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                  style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12 }} />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                                <div>
                                  <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>Nivel de rigor</label>
                                  <select value={q.criteria.rigor_level || 'flexible'}
                                    onChange={e => updateCriteria(idx, 'rigor_level', e.target.value)}
                                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12 }}>
                                    <option value="strict">Estricto</option>
                                    <option value="flexible">Flexible</option>
                                    <option value="conceptual">Conceptual</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: 11, color: '#64748B', display: 'block', marginBottom: 3 }}>Nivel Bloom</label>
                                  <select value={q.criteria.bloom_level || 'understand'}
                                    onChange={e => updateCriteria(idx, 'bloom_level', e.target.value)}
                                    style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #D0D5DD', fontSize: 12 }}>
                                    {['remember','understand','apply','analyze','evaluate','create'].map(b =>
                                      <option key={b} value={b}>{b}</option>
                                    )}
                                  </select>
                                </div>
                              </div>
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

          {/* STEP 4 — Publicar */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{
                background: '#F0F4FF', borderRadius: 10, padding: '16px',
                border: '1px solid #C7D7FF',
              }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1F3864', marginBottom: 10 }}>
                  Resumen del examen
                </p>
                <div style={{ fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div><strong>Materia:</strong> {form.subject} · {form.grade}</div>
                  <div><strong>Preguntas:</strong> {generatedExam?.questions?.length || 0} preguntas · {totalScore} puntos</div>
                  <div><strong>Distribución:</strong> {mcCount} MC · {saCount} corta · {devCount} desarrollo</div>
                  {form.time_limit > 0 && <div><strong>Tiempo:</strong> {form.time_limit} minutos</div>}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                  Título del examen *
                </label>
                <input value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Examen Parcial Período 1 — Fotosíntesis"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 14, boxSizing: 'border-box' }} />
              </div>

              <div style={{
                background: '#FFFBEB', borderRadius: 8, padding: '12px 14px',
                border: '1px solid #FDE68A', fontSize: 13, color: '#92400E',
              }}>
                <strong>Al publicar:</strong> Se generará un código de acceso único. Compártelo con
                los estudiantes para que ingresen al examen. Las respuestas se corrigen automáticamente
                con IA (revisión humana disponible para casos complejos).
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', flexShrink: 0,
          background: '#FAFAFA',
        }}>
          <button type="button"
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            style={{
              padding: '9px 18px', borderRadius: 9, fontSize: 14, cursor: 'pointer',
              background: '#F1F5F9', color: '#374151', border: 'none', fontWeight: 600,
            }}>
            {step === 1 ? 'Cancelar' : '← Atrás'}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            {step === 2 && (
              <button type="button" onClick={handleGenerate} disabled={generating}
                style={{
                  padding: '9px 22px', borderRadius: 9, fontSize: 14, cursor: generating ? 'default' : 'pointer',
                  background: generating ? '#9CA3AF' : 'linear-gradient(135deg, #1F3864, #2E5598)',
                  color: '#fff', border: 'none', fontWeight: 700,
                  opacity: generating ? .7 : 1,
                }}>
                {generating ? '⏳ Generando…' : '✨ Generar con IA →'}
              </button>
            )}
            {step === 3 && (
              <button type="button" onClick={() => setStep(4)}
                style={{
                  padding: '9px 22px', borderRadius: 9, fontSize: 14, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #1F3864, #2E5598)',
                  color: '#fff', border: 'none', fontWeight: 700,
                }}>
                Continuar →
              </button>
            )}
            {step === 4 && (
              <button type="button" onClick={handlePublish} disabled={saving}
                style={{
                  padding: '9px 22px', borderRadius: 9, fontSize: 14, cursor: saving ? 'default' : 'pointer',
                  background: saving ? '#9CA3AF' : 'linear-gradient(135deg, #15803D, #166534)',
                  color: '#fff', border: 'none', fontWeight: 700,
                }}>
                {saving ? '⏳ Guardando…' : '📤 Publicar Examen'}
              </button>
            )}
            {step < 2 && (
              <button type="button" onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && (!form.subject || !form.grade || !form.topic.trim())}
                style={{
                  padding: '9px 22px', borderRadius: 9, fontSize: 14, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #1F3864, #2E5598)',
                  color: '#fff', border: 'none', fontWeight: 700,
                  opacity: (step === 1 && (!form.subject || !form.grade || !form.topic.trim())) ? .5 : 1,
                }}>
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

// ── EXAM DETAIL MODAL ─────────────────────────────────────────────────────────
function ExamDetailModal({ exam, results, onClose, onStatusChange }) {
  const { showToast } = useToast()
  const [changing, setChanging] = useState(false)
  const baseUrl = window.location.origin + window.location.pathname

  async function toggleStatus() {
    setChanging(true)
    const newStatus = exam.status === 'active' ? 'closed' : 'active'
    const { error } = await supabase.from('assessments').update({ status: newStatus }).eq('id', exam.id)
    if (error) { showToast('Error: ' + error.message, 'error') }
    else { onStatusChange(exam.id, newStatus); showToast(`Examen ${newStatus === 'active' ? 'activado' : 'cerrado'}`, 'success') }
    setChanging(false)
  }

  const examUrl = `${baseUrl}exam/${exam.access_code}`

  return createPortal(
    <div className="lt-modal-overlay" style={{ zIndex: 9998 }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520,
        maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,.2)',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#F8FAFC',
        }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#1F3864' }}>{exam.title}</h3>
          <button type="button" onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9CA3AF',
          }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', margin: '0 0 6px' }}>CÓDIGO DE ACCESO</p>
            <CopyCode code={exam.access_code} />
            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '6px 0 0' }}>
              Comparte este código con los estudiantes para que accedan al examen.
            </p>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', margin: '0 0 6px' }}>LINK DIRECTO</p>
            <div style={{
              background: '#F1F5F9', borderRadius: 7, padding: '8px 10px',
              fontSize: 12, color: '#374151', wordBreak: 'break-all',
              border: '1px solid #E2E8F0', fontFamily: 'monospace',
            }}>{examUrl}</div>
            <button type="button" onClick={() => navigator.clipboard.writeText(examUrl).then(() => showToast('Link copiado', 'success'))}
              style={{
                marginTop: 6, padding: '5px 12px', borderRadius: 6, fontSize: 12,
                background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', cursor: 'pointer',
              }}>
              📋 Copiar link
            </button>
          </div>

          {/* Results summary */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B', margin: '0 0 8px' }}>RESULTADOS</p>
            {results.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' }}>Aún no hay presentaciones.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map(r => (
                  <div key={r.session_id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', background: '#F8FAFC', borderRadius: 7,
                    border: '1px solid #E2E8F0',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{r.student_name || '—'}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {r.status === 'complete' ? '✓ Completado' : r.status === 'partial' ? '⏳ Parcial' : '…'}
                      </div>
                    </div>
                    {r.final_grade != null && (
                      <span style={{
                        fontSize: 16, fontWeight: 800,
                        color: gradeColor(r.final_grade),
                      }}>{r.final_grade?.toFixed(1)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button type="button" onClick={toggleStatus} disabled={changing}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700,
              cursor: changing ? 'default' : 'pointer',
              background: exam.status === 'active' ? '#FEF2F2' : '#ECFDF5',
              color: exam.status === 'active' ? '#DC2626' : '#15803D',
              border: `1px solid ${exam.status === 'active' ? '#FCA5A5' : '#A7F3D0'}`,
            }}>
            {changing ? '…' : exam.status === 'active' ? '🔒 Cerrar examen' : '🔓 Reabrir examen'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ExamDashboardPage({ teacher }) {
  const { showToast } = useToast()
  const [exams,    setExams]    = useState([])
  const [results,  setResults]  = useState({}) // { assessmentId: [result rows] }
  const [sessions, setSessions] = useState({}) // { assessmentId: count }
  const [pending,  setPending]  = useState(0)  // AI reviews pending
  const [loading,  setLoading]  = useState(true)
  const [showCreator, setShowCreator] = useState(false)
  const [detailExam,  setDetailExam]  = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const schoolId = teacher.school_id

    // Load assessments
    const { data: aRows } = await supabase
      .from('assessments')
      .select('id, title, subject, grade, period, status, access_code, created_at, time_limit_minutes, teacher_id')
      .eq('school_id', schoolId)
      .eq('teacher_id', teacher.id)
      .order('created_at', { ascending: false })
    const examList = aRows || []
    setExams(examList)

    if (examList.length === 0) { setLoading(false); return }
    const ids = examList.map(e => e.id)

    // Load results
    const { data: rRows } = await supabase
      .from('assessment_results')
      .select('session_id, assessment_id, final_grade, percentage, status')
      .in('assessment_id', ids)
    const rMap = {}
    for (const r of rRows || []) {
      ;(rMap[r.assessment_id] = rMap[r.assessment_id] || []).push(r)
    }
    setResults(rMap)

    // Session counts (with student names)
    const { data: sRows } = await supabase
      .from('student_exam_sessions')
      .select('assessment_id, student_name, status')
      .in('assessment_id', ids)
    const sMap = {}
    for (const s of sRows || []) {
      ;(sMap[s.assessment_id] = sMap[s.assessment_id] || []).push(s)
    }
    setSessions(sMap)

    // Pending AI reviews
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

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 700 }}>
            📝 Módulo de Evaluación
          </h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            {loading ? '…' : `${exams.length} exámenes · ${totalStudents} presentaciones`}
            {avgGrade && <span style={{ marginLeft: 10, color: gradeColor(parseFloat(avgGrade)), fontWeight: 700 }}>
              Promedio: {avgGrade}/5.0
            </span>}
            {pending > 0 && (
              <span style={{
                marginLeft: 10, background: '#FBBF24', color: '#7A3B03',
                borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700,
              }}>⚠️ {pending} revisiones pendientes</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {pending > 0 && (
            <a href="/cbf-planner/exams/review" style={{
              padding: '9px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700,
              background: '#FEF9C3', color: '#854D0E',
              border: '1px solid #FDE047', textDecoration: 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              👁 Revisar IA ({pending})
            </a>
          )}
          <button type="button" onClick={() => setShowCreator(true)} style={{
            padding: '9px 18px', borderRadius: 9, fontSize: 14, fontWeight: 700,
            background: 'linear-gradient(135deg, #1F3864, #2E5598)',
            color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            ✨ Crear Examen con IA
          </button>
        </div>
      </div>

      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Cargando exámenes…</p>}

      {!loading && exams.length === 0 && (
        <div style={{
          background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 12,
          padding: '48px 24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <h3 style={{ margin: '0 0 8px', color: '#374151' }}>No hay exámenes todavía</h3>
          <p style={{ color: '#9CA3AF', margin: '0 0 20px', fontSize: 14 }}>
            Crea tu primer examen con IA. El tema + grado → examen completo en menos de 2 minutos.
          </p>
          <button type="button" onClick={() => setShowCreator(true)} style={{
            padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700,
            background: 'linear-gradient(135deg, #1F3864, #2E5598)',
            color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            ✨ Crear primer examen
          </button>
        </div>
      )}

      {/* Exam list */}
      {!loading && exams.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {exams.map(exam => {
            const examResults = results[exam.id] || []
            const examSessions = sessions[exam.id] || []
            const submitted = examSessions.filter(s => s.status === 'submitted').length
            const avg = examResults.length
              ? (examResults.reduce((s, r) => s + (r.final_grade || 0), 0) / examResults.length).toFixed(1)
              : null

            return (
              <div key={exam.id} style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,.04)',
              }}>
                {/* Status dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: exam.status === 'active' ? '#22C55E' : exam.status === 'closed' ? '#94A3B8' : '#F59E0B',
                }} />

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1F3864' }}>{exam.title}</span>
                    <StatusBadge status={exam.status} />
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    {exam.subject} · {exam.grade}
                    {exam.period && ` · P${exam.period}`}
                    {exam.time_limit_minutes > 0 && ` · ${exam.time_limit_minutes} min`}
                    <span style={{ margin: '0 6px', color: '#D0D5DD' }}>·</span>
                    {fmt(exam.created_at)}
                  </div>
                </div>

                {/* Stats */}
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

                {/* Code + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <CopyCode code={exam.access_code} />
                  <button type="button" onClick={() => setDetailExam(exam)} style={{
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: '#1F3864', color: '#fff', border: 'none', cursor: 'pointer',
                  }}>Ver →</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreator && (
        <ExamCreatorModal
          teacher={teacher}
          onClose={() => setShowCreator(false)}
          onCreated={() => { setShowCreator(false); load() }}
        />
      )}

      {detailExam && (
        <ExamDetailModal
          exam={detailExam}
          results={results[detailExam.id] || []}
          onClose={() => setDetailExam(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
