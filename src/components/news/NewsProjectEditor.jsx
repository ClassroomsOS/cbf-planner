import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { generateRubric } from '../../utils/AIAssistant'
import { exportRubricHtml } from '../../utils/exportRubricHtml'
import { MODELO_B_SUBJECTS } from '../../utils/constants'
import { getIndText } from '../../pages/LearningTargetsPage'
import ImageUploader from '../ImageUploader'

const MODELO_B_COMPETENCIAS = ['Sociolingüística', 'Lingüística', 'Pragmática', 'Intercultural']
const MODELO_B_OPERADORES   = ['Deducir', 'Generalizar', 'Sintetizar', 'Retener', 'Evaluar']
const MODELO_B_HABILIDADES  = ['Speaking', 'Listening', 'Reading', 'Writing']

const SKILLS = [
  { value: '', label: '— Sin skill específico —' },
  { value: 'speaking', label: '🎤 Speaking' },
  { value: 'listening', label: '🎧 Listening' },
  { value: 'reading', label: '📖 Reading' },
  { value: 'writing', label: '✍️ Writing' }
]

const LEVEL_LABELS = [
  { score: 5, label: 'Excellent', color: '#1A6B3A' },
  { score: 4, label: 'Good', color: '#2B8A45' },
  { score: 3, label: 'Satisfactory', color: '#B8860B' },
  { score: 2, label: 'Developing', color: '#CC4E10' },
  { score: 1, label: 'Beginning', color: '#CC1F27' }
]

const EMPTY_TEXTBOOK = { book: '', units: [], grammar: [], vocabulary: [], pages: { student: '', workbook: '' }, images: [] }

const NewsProjectEditor = memo(function NewsProjectEditor({ teacher, school, project, templates, cloneForProject, onSave, onClose, principles }) {
  const isEditing = !!project
  const { showToast } = useToast()

  const modalRef = useFocusTrap(true, onClose)

  // Form state
  const [form, setForm] = useState({
    subject: '',
    skill: '',
    grade: '',
    section: '',
    period: 1,
    title: '',
    description: '',
    conditions: '',
    textbook_reference: { ...EMPTY_TEXTBOOK },
    rubric: [],
    rubric_template_id: null,
    biblical_principle: '',
    biblical_reflection: '',
    start_date: '',
    due_date: '',
    status: 'draft',
    sequence: 1,
    target_id: null,
    target_indicador: '',
    news_model: 'standard',
    competencias: [],
    operadores_intelectuales: [],
    habilidades: [],
    actividades_evaluativas: [],
  })

  const [hoveredOp,   setHoveredOp]   = useState(null)
  const [hoveredComp, setHoveredComp] = useState(null)
  const [saving, setSaving] = useState(false)
  const [generatingRubric, setGeneratingRubric] = useState(false)
  const [rubricGenerationStep, setRubricGenerationStep] = useState(0)
  const [activeStep, setActiveStep] = useState('identify')
  const [principlesExpanded, setPrinciplesExpanded] = useState(false)
  const [tagInput, setTagInput] = useState({ grammar: '', vocabulary: '', units: '' })
  const [showTargetSelector, setShowTargetSelector] = useState(false)
  const [newActividad, setNewActividad] = useState({ nombre: '', descripcion: '', porcentaje: '', fecha: '' })

  // ── Load teacher assignments for smart dropdowns ──
  const [assignments, setAssignments] = useState([])
  const [learningTargets, setLearningTargets] = useState([])

  useEffect(() => {
    supabase
      .from('teacher_assignments')
      .select('grade, section, subject')
      .eq('teacher_id', teacher.id)
      .order('grade')
      .then(({ data }) => setAssignments(data || []))
  }, [teacher.id])

  // ── Load learning targets when subject/grade/period change ──
  useEffect(() => {
    if (!form.subject || !form.grade || !form.period) {
      setLearningTargets([])
      return
    }
    supabase
      .from('learning_targets')
      .select('id, description, taxonomy, grade, group_name, indicadores')
      .eq('school_id', teacher.school_id)
      .eq('subject', form.subject)
      .eq('is_active', true)
      .then(({ data }) => {
        const filtered = (data || []).filter(t => {
          if (t.grade === form.grade) return true
          if (form.grade.startsWith(t.grade)) {
            if (t.group_name) return form.grade.includes(t.group_name)
            return true
          }
          return false
        })
        setLearningTargets(filtered)
      })
  }, [form.subject, form.grade, form.period, teacher.school_id])

  // AI Rubric generation step progression
  useEffect(() => {
    if (!generatingRubric) {
      setRubricGenerationStep(0)
      return
    }
    const stepsList = [0, 1, 2]
    let currentIndex = 0
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % stepsList.length
      setRubricGenerationStep(stepsList[currentIndex])
    }, 2000)
    return () => clearInterval(interval)
  }, [generatingRubric])

  // Guard: if model switches away from language, leave 'marco' step
  useEffect(() => {
    if (form.news_model === 'standard' && activeStep === 'marco') {
      setActiveStep('identify')
    }
  }, [form.news_model, activeStep])

  // Derive dropdown options from assignments (filtered cascade)
  const subjectOptions = useMemo(() => {
    return [...new Set(assignments.map(a => a.subject))].sort()
  }, [assignments])

  const gradeOptions = useMemo(() => {
    if (!form.subject) return [...new Set(assignments.map(a => a.grade))].sort()
    return [...new Set(
      assignments.filter(a => a.subject === form.subject).map(a => a.grade)
    )].sort()
  }, [assignments, form.subject])

  const sectionOptions = useMemo(() => {
    if (!form.subject || !form.grade) return [...new Set(assignments.map(a => a.section))].sort()
    return [...new Set(
      assignments.filter(a => a.subject === form.subject && a.grade === form.grade).map(a => a.section)
    )].sort()
  }, [assignments, form.subject, form.grade])

  // Load project data for editing
  useEffect(() => {
    if (project) {
      setForm({
        subject: project.subject || '',
        skill: project.skill || '',
        grade: project.grade || '',
        section: project.section || '',
        period: project.period || 1,
        title: project.title || '',
        description: project.description || '',
        conditions: project.conditions || '',
        textbook_reference: project.textbook_reference || { ...EMPTY_TEXTBOOK },
        rubric: project.rubric || [],
        rubric_template_id: project.rubric_template_id || null,
        biblical_principle: project.biblical_principle || '',
        biblical_reflection: project.biblical_reflection || '',
        start_date: project.start_date || '',
        due_date: project.due_date || '',
        status: project.status || 'draft',
        sequence: project.sequence || 1,
        target_id: project.target_id || null,
        target_indicador: project.target_indicador || '',
        news_model: project.news_model || (MODELO_B_SUBJECTS.includes(project.subject) ? 'language' : 'standard'),
        competencias: project.competencias || [],
        operadores_intelectuales: project.operadores_intelectuales || [],
        habilidades: project.habilidades || [],
        actividades_evaluativas: project.actividades_evaluativas || [],
      })
    }
  }, [project])

  const updateForm = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const updateTextbook = (key, value) => {
    setForm(prev => ({
      ...prev,
      textbook_reference: { ...prev.textbook_reference, [key]: value }
    }))
  }

  const updateTextbookPages = (key, value) => {
    setForm(prev => ({
      ...prev,
      textbook_reference: {
        ...prev.textbook_reference,
        pages: { ...prev.textbook_reference.pages, [key]: value }
      }
    }))
  }

  const addTag = (field) => {
    const value = tagInput[field]?.trim()
    if (!value) return
    const current = form.textbook_reference[field] || []
    if (!current.includes(value)) {
      updateTextbook(field, [...current, value])
    }
    setTagInput(prev => ({ ...prev, [field]: '' }))
  }

  const removeTag = (field, index) => {
    const current = [...(form.textbook_reference[field] || [])]
    current.splice(index, 1)
    updateTextbook(field, current)
  }

  const addActividad = () => {
    if (!newActividad.nombre.trim()) return
    updateForm('actividades_evaluativas', [
      ...form.actividades_evaluativas,
      {
        nombre:      newActividad.nombre.trim(),
        descripcion: newActividad.descripcion.trim(),
        porcentaje:  Number(newActividad.porcentaje) || 0,
        fecha:       newActividad.fecha || null,
      }
    ])
    setNewActividad({ nombre: '', descripcion: '', porcentaje: '', fecha: '' })
  }

  const removeActividad = (idx) => {
    updateForm('actividades_evaluativas', form.actividades_evaluativas.filter((_, i) => i !== idx))
  }

  const loadTemplate = (templateId) => {
    if (!templateId) return
    const rubric = cloneForProject(templateId)
    if (rubric.length > 0) {
      updateForm('rubric', rubric)
      updateForm('rubric_template_id', templateId)
    }
  }

  const addCriterion = () => {
    updateForm('rubric', [
      ...form.rubric,
      { name: '', desc: '', levels: ['', '', '', '', ''] }
    ])
  }

  const removeCriterion = (index) => {
    const updated = [...form.rubric]
    updated.splice(index, 1)
    updateForm('rubric', updated)
  }

  const updateCriterion = (index, field, value) => {
    const updated = [...form.rubric]
    updated[index] = { ...updated[index], [field]: value }
    updateForm('rubric', updated)
  }

  const updateLevel = (criterionIndex, levelIndex, value) => {
    const updated = [...form.rubric]
    const levels = [...updated[criterionIndex].levels]
    levels[levelIndex] = value
    updated[criterionIndex] = { ...updated[criterionIndex], levels }
    updateForm('rubric', updated)
  }

  const handleGenerateRubric = async () => {
    if (!form.title || !form.description || !form.target_indicador) {
      showToast('Completa título, descripción y selecciona un indicador de logro antes de generar la rúbrica.', 'warning')
      return
    }
    setGeneratingRubric(true)
    try {
      const selectedTarget = learningTargets.find(t => t.id === form.target_id)
      const indicadores = selectedTarget?.indicadores || []
      const result = await generateRubric({
        projectTitle: form.title,
        projectDescription: form.description,
        subject: form.subject,
        grade: form.grade,
        skill: form.skill,
        indicadores: indicadores,
        principles: principles
      })
      if (result && Array.isArray(result) && result.length > 0) {
        updateForm('rubric', result)
        showToast(`Rúbrica generada con ${result.length} criterios. Revisa y ajusta según necesites.`, 'success')
      } else {
        showToast('La AI no pudo generar la rúbrica. Intenta de nuevo.', 'error')
      }
    } catch (error) {
      console.error('Error generating rubric:', error)
      showToast(error.message || 'Error al generar la rúbrica con IA', 'error')
    } finally {
      setGeneratingRubric(false)
    }
  }

  const matchingTemplates = templates.filter(t =>
    !form.skill || t.skill === form.skill || t.skill === 'general'
  )

  const handleSubmit = useCallback(async () => {
    if (!isValid || saving) return
    setSaving(true)
    const payload = {
      subject: form.subject,
      skill: form.skill || null,
      grade: form.grade,
      section: form.section,
      period: form.period,
      title: form.title.trim(),
      description: form.description.trim(),
      conditions: form.conditions.trim() || null,
      textbook_reference: form.textbook_reference,
      rubric: form.rubric,
      rubric_template_id: form.rubric_template_id,
      biblical_principle: form.biblical_principle.trim() || null,
      biblical_reflection: form.biblical_reflection.trim() || null,
      start_date: form.start_date || null,
      due_date: form.due_date,
      status: form.status,
      sequence: form.sequence,
      target_id: form.target_id,
      target_indicador: form.target_indicador.trim() || null,
      news_model: form.news_model,
      competencias: form.competencias,
      operadores_intelectuales: form.operadores_intelectuales,
      habilidades: form.habilidades,
      actividades_evaluativas: form.actividades_evaluativas,
    }
    const result = await onSave(payload)
    setSaving(false)
    if (!result.error) {
      showToast(isEditing ? 'Proyecto actualizado' : 'Proyecto creado', 'success')
    } else {
      showToast(result.error, 'error')
    }
  }, [form, isEditing, onSave, saving, showToast])

  const isValid = form.title && form.subject && form.grade && form.section && form.due_date && form.description

  // ── Nav steps (sidebar) ──
  const navSteps = useMemo(() => {
    const base = [
      {
        key: 'identify', icon: '📋', label: 'Identificación',
        isDone: !!(form.subject && form.grade && form.section)
      },
      {
        key: 'logro', icon: '🎯', label: 'Indicador',
        isDone: !!form.target_id
      },
      ...(form.news_model === 'language' ? [{
        key: 'marco', icon: '🌐', label: 'Marco',
        isDone: form.habilidades.length > 0
      }] : []),
      {
        key: 'content', icon: '📝', label: 'Contenido',
        isDone: !!(form.title && form.description)
      },
      {
        key: 'dates', icon: '📅', label: 'Fechas',
        isDone: !!form.due_date
      },
      {
        key: 'textbook', icon: '📘', label: 'Textbook',
        isDone: !!(form.textbook_reference?.book)
      },
      {
        key: 'actividades', icon: '📋', label: 'Actividades',
        isDone: form.actividades_evaluativas.length > 0,
        badge: form.actividades_evaluativas.length > 0 ? form.actividades_evaluativas.length : null
      },
      {
        key: 'timeline', icon: '📅', label: 'Línea de Tiempo',
        isDone: form.actividades_evaluativas.some(a => a.fecha) || !!form.due_date,
      },
      {
        key: 'rubric', icon: '📊', label: 'Rúbrica',
        isDone: form.rubric.length > 0,
        badge: form.rubric.length > 0 ? form.rubric.length : null
      },
    ]
    return base
  }, [form.subject, form.grade, form.section, form.target_id, form.news_model,
      form.habilidades.length, form.title, form.description, form.due_date,
      form.textbook_reference?.book, form.actividades_evaluativas.length, form.rubric.length])

  return (
    <>
      <style>{`
        input:focus, textarea:focus, select:focus {
          border-color: #1A6B3A !important;
          box-shadow: 0 0 0 3px rgba(26, 107, 58, 0.12) !important;
        }
        .news-btn-primary:not(:disabled):hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(26, 107, 58, 0.2);
        }
        .news-btn-primary:not(:disabled):active { transform: scale(0.98); }
        .news-close-btn:hover { background: #eee !important; transform: scale(1.05); }
        .news-nav-item:hover:not(.news-nav-active) {
          background: rgba(26,107,58,0.06) !important;
          color: #1A6B3A !important;
        }
        *:focus { outline: none; }
        button, input, textarea, select {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23888888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 40px !important;
          cursor: pointer;
        }
        select:hover { border-color: #ccc !important; }
        input[type="date"] { position: relative; cursor: pointer; }
        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer; opacity: 0.6; padding: 4px; border-radius: 4px;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1; background: rgba(0,0,0,0.05);
        }
        .indicator-card-text {
          word-break: break-word; overflow-wrap: break-word; max-width: 100%;
        }
        @keyframes apple-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fade-in-step {
          0% { opacity: 0; transform: translateY(-3px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={styles.overlay}>
        <div ref={modalRef} style={styles.modal} onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div style={styles.header}>
            <div>
              <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 900, letterSpacing: '1px', textTransform: 'uppercase', color: '#A8E6C0', background: 'rgba(168,230,192,0.15)', border: '1px solid rgba(168,230,192,0.35)', borderRadius: 4, padding: '2px 8px', marginBottom: 6 }}>
                📋 Proyecto NEWS
              </span>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#FFFFFF' }}>
                {isEditing ? 'Editar Proyecto NEWS' : 'Nuevo Proyecto NEWS'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
                {form.subject && form.grade ? `${form.subject} · ${form.grade}${form.section ? ` ${form.section}` : ''}` : 'Define el proyecto, la rúbrica y el contenido del textbook'}
              </p>
            </div>
            <button onClick={onClose} className="news-close-btn news-btn-primary" style={styles.closeBtn} aria-label="Cerrar">✕</button>
          </div>

          {/* ── Principios Rectores strip ── */}
          {principles && (principles.yearVerse || principles.monthVerse) && (
            <div style={{ background: 'linear-gradient(135deg, #1A3A8F 0%, #2E5598 100%)', borderBottom: '2px solid #F5C300' }}>
              <button
                onClick={() => setPrinciplesExpanded(p => !p)}
                style={{ width: '100%', padding: '7px 20px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left' }}
              >
                <span style={{ fontSize: 12 }}>📖</span>
                <span style={{ fontSize: 9, fontWeight: 900, color: '#F5C300', textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0 }}>PRINCIPIOS RECTORES</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {principles.yearVerseRef && `Año: ${principles.yearVerseRef}`}
                  {principles.yearVerseRef && principles.monthVerseRef && ' · '}
                  {principles.monthVerseRef && `Mes: ${principles.monthVerseRef}`}
                </span>
                <span style={{ color: '#F5C300', fontSize: 10, flexShrink: 0, transition: 'transform 0.2s', display: 'inline-block', transform: principlesExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
              </button>
              {principlesExpanded && (
                <div style={{ padding: '0 20px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {principles.yearVerse && (
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #F5C300' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#F5C300', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>✨ VERSÍCULO DEL AÑO</div>
                      <div style={{ fontSize: 11, lineHeight: 1.5, color: '#FFFFFF' }}>"{principles.yearVerse}"</div>
                      {principles.yearVerseRef && <div style={{ fontSize: 10, fontStyle: 'italic', color: '#C5D5F0', marginTop: 4, textAlign: 'right' }}>— {principles.yearVerseRef}</div>}
                    </div>
                  )}
                  {principles.monthVerse && (
                    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #F5C300' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: '#F5C300', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>📅 VERSÍCULO DEL MES</div>
                      <div style={{ fontSize: 11, lineHeight: 1.5, color: '#FFFFFF' }}>"{principles.monthVerse}"</div>
                      {principles.monthVerseRef && <div style={{ fontSize: 10, fontStyle: 'italic', color: '#C5D5F0', marginTop: 4, textAlign: 'right' }}>— {principles.monthVerseRef}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Main area: sidebar + content ── */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* Left sidebar */}
            <div style={styles.sidebar}>
              {navSteps.map((step, idx) => {
                const isActive = activeStep === step.key
                return (
                  <button
                    key={step.key}
                    onClick={() => setActiveStep(step.key)}
                    className={`news-nav-item${isActive ? ' news-nav-active' : ''}`}
                    style={{
                      ...styles.navItem,
                      ...(isActive ? styles.navItemActive : {}),
                    }}
                  >
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{step.icon}</span>
                    <span style={{ flex: 1, fontSize: 11, fontWeight: isActive ? 700 : 500, textAlign: 'left', lineHeight: 1.3, color: isActive ? '#1A6B3A' : '#555' }}>
                      {step.label}
                      {step.badge && (
                        <span style={{ marginLeft: 6, background: '#1A6B3A', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 8, padding: '1px 5px' }}>
                          {step.badge}
                        </span>
                      )}
                    </span>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: step.isDone ? '#9BBB59' : isActive ? '#1A6B3A' : '#E0E0E0',
                      transition: 'background 0.2s',
                    }} />
                  </button>
                )
              })}

              {/* Step counter at bottom */}
              <div style={{ marginTop: 'auto', padding: '12px', borderTop: '1px solid #eee', fontSize: 10, color: '#bbb', textAlign: 'center' }}>
                {navSteps.filter(s => s.isDone).length}/{navSteps.length} completados
              </div>
            </div>

            {/* Content area */}
            <div style={styles.content}>

              {/* ── STEP: Identificación ── */}
              {activeStep === 'identify' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <h3 style={styles.stepTitle}>Identificación del proyecto</h3>
                    <p style={styles.stepDesc}>Define la materia, grado y clasificación del proyecto NEWS.</p>
                  </div>

                  <div style={styles.row3}>
                    <div style={styles.field}>
                      <label style={styles.label}>Materia *</label>
                      <select
                        value={form.subject}
                        onChange={e => {
                          const subj = e.target.value
                          updateForm('subject', subj)
                          updateForm('news_model', MODELO_B_SUBJECTS.includes(subj) ? 'language' : 'standard')
                          updateForm('grade', '')
                          updateForm('section', '')
                        }}
                        style={styles.input}
                      >
                        <option value="">— Seleccionar —</option>
                        {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Grado *</label>
                      <select
                        value={form.grade}
                        onChange={e => { updateForm('grade', e.target.value); updateForm('section', '') }}
                        disabled={!form.subject}
                        style={{ ...styles.input, opacity: form.subject ? 1 : 0.5 }}
                      >
                        <option value="">— Seleccionar —</option>
                        {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Sección *</label>
                      <select
                        value={form.section}
                        onChange={e => updateForm('section', e.target.value)}
                        disabled={!form.grade}
                        style={{ ...styles.input, opacity: form.grade ? 1 : 0.5 }}
                      >
                        <option value="">— Seleccionar —</option>
                        {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={styles.row3}>
                    <div style={styles.field}>
                      <label style={styles.label}>Skill</label>
                      <select value={form.skill} onChange={e => updateForm('skill', e.target.value)} style={styles.input}>
                        {SKILLS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Período *</label>
                      <select value={form.period} onChange={e => updateForm('period', parseInt(e.target.value))} style={styles.input}>
                        {[1,2,3,4].map(p => <option key={p} value={p}>Período {p}</option>)}
                      </select>
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Secuencia</label>
                      <input
                        type="number" min={1} max={10}
                        value={form.sequence}
                        onChange={e => updateForm('sequence', parseInt(e.target.value) || 1)}
                        style={styles.input}
                      />
                    </div>
                  </div>

                  {form.news_model === 'language' && (
                    <div style={{ background: '#EEF2FB', borderRadius: 8, padding: '8px 12px', border: '1px solid #c5d5f0', fontSize: 11, color: '#1A3A8F', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🌐</span>
                      <span><strong>Modelo Lengua</strong> activado — ve al paso <em>Marco</em> para configurar habilidades y operadores.</span>
                    </div>
                  )}

                  <button onClick={() => setActiveStep('logro')} style={styles.btnNext}>
                    Siguiente: Indicador →
                  </button>
                </div>
              )}

              {/* ── STEP: Logro ── */}
              {activeStep === 'logro' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <h3 style={styles.stepTitle}>Indicador de Logro</h3>
                    <p style={styles.stepDesc}>Vincula el proyecto con el Indicador de Logro que el estudiante demostrará al completarlo.</p>
                  </div>

                  <div style={{ background: '#F0F7F0', borderRadius: 12, padding: 16, border: '1px solid #E8F0E8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <h4 style={{ fontSize: 11, fontWeight: 800, color: '#1A5C1A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>🎯 Indicador de Logro Vinculado</h4>
                      {form.target_id && (
                        <button onClick={() => setShowTargetSelector(true)} style={{ fontSize: 10, padding: '4px 8px', borderRadius: 4, border: '1px solid #9BBB59', background: 'transparent', color: '#5a8a00', cursor: 'pointer', fontWeight: 600 }}>
                          Cambiar
                        </button>
                      )}
                    </div>

                    {form.target_id && (() => {
                      const selectedTarget = learningTargets.find(t => t.id === form.target_id)
                      if (!selectedTarget) return null
                      const TAXONOMY_EMOJI = { recognize: '👁️', apply: '🛠️', produce: '✨' }
                      const TAXONOMY_LABELS = { recognize: 'Reconocer', apply: 'Aplicar', produce: 'Producir' }
                      return (
                        <div style={{ background: '#fff', borderRadius: 6, padding: '8px 10px', border: '1px solid #E8F0E8', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 14 }}>{TAXONOMY_EMOJI[selectedTarget.taxonomy]}</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: '#5a8a00', textTransform: 'uppercase', background: '#f6fff0', padding: '3px 7px', borderRadius: 3 }}>
                              {TAXONOMY_LABELS[selectedTarget.taxonomy]}
                            </span>
                            {selectedTarget.group_name && (
                              <span style={{ fontSize: 9, color: '#888', background: '#f5f5f5', padding: '3px 7px', borderRadius: 3 }}>{selectedTarget.group_name}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.4 }}>{selectedTarget.description}</div>
                        </div>
                      )
                    })()}

                    {(!form.target_id || showTargetSelector) && (
                      <div style={{ marginBottom: 10 }}>
                        {learningTargets.length === 0 && form.subject && form.grade ? (
                          <div style={{ padding: '8px', borderRadius: 6, background: '#FFF9E6', border: '1px dashed #F5C300', textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: '#8B6914', lineHeight: 1.3 }}>
                              No hay indicadores de logro activos para <strong>{form.subject} · {form.grade}</strong>.<br />Crea uno primero en "Indicadores de Logro".
                            </div>
                          </div>
                        ) : learningTargets.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#5a8a00', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                              Selecciona el indicador de logro que este proyecto evalúa:
                            </div>
                            {learningTargets.map(t => {
                              const TAXONOMY_EMOJI = { recognize: '👁️', apply: '🛠️', produce: '✨' }
                              return (
                                <button key={t.id} onClick={() => { updateForm('target_id', t.id); updateForm('target_indicador', ''); setShowTargetSelector(false) }}
                                  style={{ padding: '8px', borderRadius: 5, textAlign: 'left', border: form.target_id === t.id ? '2px solid #9BBB59' : '1px solid #ddd', background: form.target_id === t.id ? '#f6fff0' : '#fff', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                  <span style={{ fontSize: 14, flexShrink: 0 }}>{TAXONOMY_EMOJI[t.taxonomy]}</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 11, color: '#1a1a2e', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.description}</div>
                                    {t.group_name && <div style={{ fontSize: 9, color: '#888', marginTop: 4 }}>Grupo: {t.group_name}</div>}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: 10, color: '#999', fontStyle: 'italic' }}>Selecciona primero Materia y Grado (paso Identificación) para ver los logros disponibles.</div>
                        )}
                        {showTargetSelector && (
                          <button onClick={() => setShowTargetSelector(false)} style={{ fontSize: 10, padding: '6px 10px', borderRadius: 4, border: '1px solid #ddd', background: '#fff', color: '#666', cursor: 'pointer', marginTop: 8 }}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    )}

                    {form.target_id && !showTargetSelector && (() => {
                      const selectedTarget = learningTargets.find(t => t.id === form.target_id)
                      const indicadores = selectedTarget?.indicadores || []
                      if (indicadores.length === 0) return (
                        <div style={{ padding: '8px', borderRadius: 5, background: '#FFF9E6', border: '1px dashed #F5C300', fontSize: 10, color: '#8B6914', fontStyle: 'italic', textAlign: 'center' }}>
                          Este logro aún no tiene indicadores configurados.
                        </div>
                      )
                      return (
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#1A5C1A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>📌 Indicador que este proyecto demuestra:</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                            {indicadores.map((ind, idx) => {
                              const indText  = getIndText(ind)
                              const isObj    = typeof ind === 'object' && ind !== null
                              const habilidad = isObj ? ind.habilidad : null
                              const HICONS   = { Speaking: '🎤', Listening: '🎧', Reading: '📖', Writing: '✍️' }
                              const isSelected = form.target_indicador === indText
                              return (
                                <button key={idx} onClick={() => updateForm('target_indicador', indText)}
                                  style={{ padding: '8px', borderRadius: 5, textAlign: 'left', border: isSelected ? '2px solid #9BBB59' : '1px solid #ddd', background: isSelected ? '#fff' : '#fafafa', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8, boxShadow: isSelected ? '0 2px 4px rgba(155,187,89,0.2)' : 'none' }}>
                                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: isSelected ? '2px solid #9BBB59' : '2px solid #ddd', background: isSelected ? '#9BBB59' : '#fff', flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {isSelected && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#5a8a00', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                                      {habilidad ? `${HICONS[habilidad] || ''} ${habilidad}` : `Indicador ${idx + 1}`}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#1a1a2e', lineHeight: 1.3 }}>{indText}</div>
                                    {isObj && ind.texto_en && <div style={{ fontSize: 10, color: '#888', marginTop: 2, fontStyle: 'italic', lineHeight: 1.3 }}>{ind.texto_en.length > 80 ? ind.texto_en.slice(0, 80) + '…' : ind.texto_en}</div>}
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                          <div style={{ fontSize: 9, color: '#666', marginTop: 8, fontStyle: 'italic', padding: '4px 6px', background: '#f8f8f8', borderRadius: 4, lineHeight: 1.3 }}>
                            💡 El estudiante demuestra el logro al cumplir este indicador.
                          </div>
                        </div>
                      )
                    })()}
                  </div>

                  <button onClick={() => setActiveStep(form.news_model === 'language' ? 'marco' : 'content')} style={styles.btnNext}>
                    Siguiente: {form.news_model === 'language' ? 'Marco →' : 'Contenido →'}
                  </button>
                </div>
              )}

              {/* ── STEP: Marco pedagógico (Modelo B) ── */}
              {activeStep === 'marco' && form.news_model === 'language' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <h3 style={styles.stepTitle}>Marco pedagógico — Lengua</h3>
                    <p style={styles.stepDesc}>Define cómo la IA construirá los indicadores de este proyecto.</p>
                  </div>

                  {/* Info strip */}
                  <div style={{ background: '#fff', border: '1px solid #c5d5f0', borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                    <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6 }}>
                      Cada <strong>Habilidad</strong> seleccionada genera un indicador propio — en inglés y español — con su versículo bíblico.
                      Los <strong>Operadores</strong> definen el nivel cognitivo. Las <strong>Competencias</strong> determinan la dimensión del idioma evaluada.
                    </div>
                  </div>

                  {/* 1 · Habilidades */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#8064A2', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>1 · Habilidades de comunicación</div>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 10 }}>¿En qué habilidades trabaja este proyecto? Selecciona todas las que apliquen.</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {[
                        { key: 'Speaking',  icon: '🎤', desc: 'Expresión oral' },
                        { key: 'Listening', icon: '🎧', desc: 'Comprensión auditiva' },
                        { key: 'Reading',   icon: '📖', desc: 'Comprensión lectora' },
                        { key: 'Writing',   icon: '✍️',  desc: 'Producción escrita' },
                      ].map(({ key, icon, desc }) => {
                        const selected = form.habilidades.includes(key)
                        return (
                          <button key={key} type="button"
                            onClick={() => { const next = selected ? form.habilidades.filter(x => x !== key) : [...form.habilidades, key]; updateForm('habilidades', next) }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 16px', borderRadius: 10, cursor: 'pointer', border: selected ? '2px solid #8064A2' : '1.5px solid #d0d8f0', background: selected ? '#8064A2' : '#fff', color: selected ? '#fff' : '#555', minWidth: 72 }}>
                            <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, marginTop: 3 }}>{key}</span>
                            <span style={{ fontSize: 9, opacity: 0.75, marginTop: 1 }}>{desc}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 10, borderRadius: 6, padding: '5px 10px', background: form.habilidades.length > 0 ? '#f0ebf8' : '#fff8e1', color: form.habilidades.length > 0 ? '#6a4a8a' : '#9a7000', border: `1px solid ${form.habilidades.length > 0 ? '#c9b8e8' : '#f0d080'}`, display: 'inline-block' }}>
                      {form.habilidades.length > 0
                        ? `→ La IA generará ${form.habilidades.length} indicador${form.habilidades.length > 1 ? 'es' : ''}: ${form.habilidades.join(', ')}`
                        : '⚠ Selecciona al menos una habilidad para poder generar indicadores con IA'}
                    </div>
                  </div>

                  {/* 2 · Operadores Intelectuales */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#4F81BD', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>2 · Operadores Intelectuales</div>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 10 }}>¿Qué hace el estudiante con el idioma? Definen el nivel de pensamiento que exige el proyecto.</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { key: 'Deducir',     desc: 'Llegar a conclusiones a partir de pistas del texto' },
                        { key: 'Generalizar', desc: 'Aplicar una regla o concepto a nuevos contextos' },
                        { key: 'Sintetizar',  desc: 'Resumir y conectar las ideas principales' },
                        { key: 'Retener',     desc: 'Memorizar y recordar información clave' },
                        { key: 'Evaluar',     desc: 'Juzgar, opinar y justificar con el idioma' },
                      ].map(({ key, desc }) => {
                        const selected = form.operadores_intelectuales.includes(key)
                        const hovered  = hoveredOp === key
                        return (
                          <button key={key} type="button"
                            onMouseEnter={() => setHoveredOp(key)} onMouseLeave={() => setHoveredOp(null)}
                            onClick={() => { const next = selected ? form.operadores_intelectuales.filter(x => x !== key) : [...form.operadores_intelectuales, key]; updateForm('operadores_intelectuales', next) }}
                            style={{ padding: '5px 13px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: selected ? '2px solid #4F81BD' : hovered ? '1.5px solid #4F81BD' : '1px solid #c5d5f0', background: selected ? '#4F81BD' : hovered ? '#eef4fc' : '#fff', color: selected ? '#fff' : '#4F81BD', fontWeight: selected ? 700 : 400, transform: hovered && !selected ? 'translateY(-1px)' : 'none', boxShadow: hovered && !selected ? '0 2px 8px rgba(79,129,189,0.2)' : 'none' }}>
                            {key}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 8, minHeight: 26, fontSize: 11, lineHeight: 1.5, padding: '5px 10px', borderRadius: 6, background: hoveredOp ? '#e8f0fa' : '#f5f7fa', color: hoveredOp ? '#2a4a80' : '#aaa', border: `1px solid ${hoveredOp ? '#b8cef0' : '#e8e8e8'}` }}>
                      {hoveredOp ? (() => {
                        const DESCS = { Deducir: 'Llegar a conclusiones a partir de pistas del texto', Generalizar: 'Aplicar una regla o concepto a nuevos contextos', Sintetizar: 'Resumir y conectar las ideas principales', Retener: 'Memorizar y recordar información clave', Evaluar: 'Juzgar, opinar y justificar con el idioma' }
                        return <><strong>{hoveredOp}:</strong> {DESCS[hoveredOp]}</>
                      })() : <em>Pasa el cursor sobre una opción para ver qué significa</em>}
                    </div>
                  </div>

                  {/* 3 · Competencias */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1A3A8F', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 4 }}>3 · Competencias lingüísticas</div>
                    <div style={{ fontSize: 10, color: '#666', marginBottom: 10 }}>¿Qué dimensión del idioma evalúa este proyecto?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {[
                        { key: 'Sociolingüística', desc: 'Usar el idioma según el contexto social — formal, informal, cultural' },
                        { key: 'Lingüística',      desc: 'Dominar gramática, vocabulario y estructura del idioma' },
                        { key: 'Pragmática',       desc: 'Comunicar con propósito real en situaciones concretas' },
                        { key: 'Intercultural',    desc: 'Comunicar reconociendo diferencias culturales y construyendo puentes de entendimiento — pilar de Byram' },
                      ].map(({ key, desc }) => {
                        const selected = form.competencias.includes(key)
                        const hovered  = hoveredComp === key
                        return (
                          <button key={key} type="button"
                            onMouseEnter={() => setHoveredComp(key)} onMouseLeave={() => setHoveredComp(null)}
                            onClick={() => { const next = selected ? form.competencias.filter(x => x !== key) : [...form.competencias, key]; updateForm('competencias', next) }}
                            style={{ padding: '5px 13px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: selected ? '2px solid #1A3A8F' : hovered ? '1.5px solid #1A3A8F' : '1px solid #c5d5f0', background: selected ? '#1A3A8F' : hovered ? '#eaeefc' : '#fff', color: selected ? '#fff' : '#1A3A8F', fontWeight: selected ? 700 : 400, transform: hovered && !selected ? 'translateY(-1px)' : 'none', boxShadow: hovered && !selected ? '0 2px 8px rgba(26,58,143,0.2)' : 'none' }}>
                            {key}
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ marginTop: 8, minHeight: 26, fontSize: 11, lineHeight: 1.5, padding: '5px 10px', borderRadius: 6, background: hoveredComp ? '#e8ecf8' : '#f5f7fa', color: hoveredComp ? '#1A3A8F' : '#aaa', border: `1px solid ${hoveredComp ? '#b0bef0' : '#e8e8e8'}` }}>
                      {hoveredComp ? (() => {
                        const DESCS = { 'Sociolingüística': 'Usar el idioma según el contexto social — formal, informal, cultural', 'Lingüística': 'Dominar gramática, vocabulario y estructura del idioma', 'Pragmática': 'Comunicar con propósito real en situaciones concretas', 'Intercultural': 'Comunicar reconociendo diferencias culturales y construyendo puentes de entendimiento — pilar de Byram' }
                        return <><strong>{hoveredComp}:</strong> {DESCS[hoveredComp]}</>
                      })() : <em>Pasa el cursor sobre una opción para ver qué significa</em>}
                    </div>
                  </div>

                  <button onClick={() => setActiveStep('content')} style={styles.btnNext}>
                    Siguiente: Contenido →
                  </button>
                </div>
              )}

              {/* ── STEP: Contenido ── */}
              {activeStep === 'content' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <h3 style={styles.stepTitle}>Contenido del proyecto</h3>
                    <p style={styles.stepDesc}>Describe qué harán los estudiantes y cuáles son las condiciones de entrega.</p>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Título del proyecto *</label>
                    <input
                      value={form.title}
                      onChange={e => updateForm('title', e.target.value)}
                      placeholder="Vision Board"
                      style={{ ...styles.input, fontSize: 16, fontWeight: 700 }}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Descripción del proyecto *</label>
                    <textarea
                      value={form.description}
                      onChange={e => updateForm('description', e.target.value)}
                      placeholder="Los alumnos realizarán una presentación..."
                      rows={4}
                      style={styles.textarea}
                    />
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Condiciones de entrega</label>
                    <textarea
                      value={form.conditions}
                      onChange={e => updateForm('conditions', e.target.value)}
                      placeholder="Mínimo 5 minutos, presentación dinámica..."
                      rows={3}
                      style={styles.textarea}
                    />
                  </div>

                  <button onClick={() => setActiveStep('dates')} style={styles.btnNext}>
                    Siguiente: Fechas →
                  </button>
                </div>
              )}

              {/* ── STEP: Fechas ── */}
              {activeStep === 'dates' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <h3 style={styles.stepTitle}>Fechas e Integración Bíblica</h3>
                    <p style={styles.stepDesc}>Define cuándo inicia la preparación y cuándo se entrega el proyecto.</p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div style={styles.field}>
                      <label style={styles.label}>Fecha de inicio (preparación)</label>
                      <input type="date" value={form.start_date} onChange={e => updateForm('start_date', e.target.value)} style={styles.input} />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Fecha de entrega *</label>
                      <input type="date" value={form.due_date} onChange={e => updateForm('due_date', e.target.value)} style={styles.input} />
                    </div>
                  </div>

                  <div style={{ background: '#F0F4FF', borderRadius: 12, padding: '12px 16px', border: '1px solid #D0DCFF' }}>
                    <h4 style={{ fontSize: 11, fontWeight: 800, color: '#1A3A8F', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>✝️ Integración Bíblica</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={styles.field}>
                        <label style={styles.label}>Principio / Versículo</label>
                        <input value={form.biblical_principle} onChange={e => updateForm('biblical_principle', e.target.value)} placeholder="1 John 2:17" style={styles.input} />
                      </div>
                      <div style={styles.field}>
                        <label style={styles.label}>Reflexión requerida</label>
                        <input value={form.biblical_reflection} onChange={e => updateForm('biblical_reflection', e.target.value)} placeholder="Explicar cómo enfrentar el cambio..." style={styles.input} />
                      </div>
                    </div>
                    {principles?.indicatorPrinciple && (
                      <div style={{ background: '#E8EEFF', borderRadius: 6, padding: '6px 12px', border: '1px solid #C5D5F0', marginTop: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#1A3A8F', textTransform: 'uppercase', letterSpacing: '0.3px' }}>📖 Principio del indicador (mes): </span>
                        <span style={{ fontSize: 11, color: '#1A3A8F', lineHeight: 1.4, fontStyle: 'italic' }}>"{principles.indicatorPrinciple}"</span>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setActiveStep('textbook')} style={styles.btnNext}>
                    Siguiente: Textbook →
                  </button>
                </div>
              )}

              {/* ── STEP: Textbook ── */}
              {activeStep === 'textbook' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h3 style={styles.stepTitle}>Referencia del Textbook</h3>
                    <p style={styles.stepDesc}>Registra el libro, unidades y puntos gramaticales que cubre este proyecto.</p>
                  </div>

                  <div style={styles.row3}>
                    <div style={{ ...styles.field, flex: 2 }}>
                      <label style={styles.label}>Libro</label>
                      <input value={form.textbook_reference.book || ''} onChange={e => updateTextbook('book', e.target.value)} placeholder="Evolve 4 / Uncover 4" style={styles.input} />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Páginas (Student Book)</label>
                      <input value={form.textbook_reference.pages?.student || ''} onChange={e => updateTextbookPages('student', e.target.value)} placeholder="6-22" style={styles.input} />
                    </div>
                    <div style={styles.field}>
                      <label style={styles.label}>Páginas (Workbook)</label>
                      <input value={form.textbook_reference.pages?.workbook || ''} onChange={e => updateTextbookPages('workbook', e.target.value)} placeholder="5-14" style={styles.input} />
                    </div>
                  </div>

                  <TagField label="Unidades" tags={form.textbook_reference.units || []} value={tagInput.units} onChange={v => setTagInput(p => ({ ...p, units: v }))} onAdd={() => addTag('units')} onRemove={(i) => removeTag('units', i)} placeholder="1" />
                  <TagField label="Gramática" tags={form.textbook_reference.grammar || []} value={tagInput.grammar} onChange={v => setTagInput(p => ({ ...p, grammar: v }))} onAdd={() => addTag('grammar')} onRemove={(i) => removeTag('grammar', i)} placeholder="past simple" />
                  <TagField label="Vocabulario" tags={form.textbook_reference.vocabulary || []} value={tagInput.vocabulary} onChange={v => setTagInput(p => ({ ...p, vocabulary: v }))} onAdd={() => addTag('vocabulary')} onRemove={(i) => removeTag('vocabulary', i)} placeholder="music" />

                  {/* ── Imágenes del textbook ── */}
                  <div>
                    <label style={styles.label}>Fotos / Scans del Textbook</label>
                    <p style={{ margin: '2px 0 8px', fontSize: 12, color: '#666' }}>
                      Sube fotos del scope &amp; sequence o páginas de referencia. La IA las usará para contextualizar el contenido.
                    </p>
                    {project?.id ? (
                      <ImageUploader
                        pathPrefix={`news/${project.id}/textbook`}
                        images={form.textbook_reference.images || []}
                        onChange={imgs => updateTextbook('images', imgs)}
                        maxImages={8}
                        showLink={false}
                      />
                    ) : (
                      <div style={{
                        fontSize: 12, color: '#8a5c00', background: '#fff8e6',
                        border: '1px solid #f5c300', borderRadius: 8,
                        padding: '10px 14px',
                      }}>
                        📸 Guarda el proyecto primero para subir imágenes de referencia.
                      </div>
                    )}
                  </div>

                  <button onClick={() => setActiveStep(form.news_model === 'language' ? 'actividades' : 'rubric')} style={styles.btnNext}>
                    Siguiente: {form.news_model === 'language' ? 'Actividades →' : 'Rúbrica →'}
                  </button>
                </div>
              )}

              {/* ── STEP: Actividades Evaluativas (Modelo B only) ── */}
              {activeStep === 'actividades' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h3 style={styles.stepTitle}>Actividades Evaluativas</h3>
                    <p style={styles.stepDesc}>Registra las actividades que se evaluarán en el período (Dictados, Quiz, Proyectos, etc.) con su fecha y peso porcentual. La fecha fija el hito en la línea de tiempo.</p>
                  </div>

                  {/* Add activity row */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', background: '#f9f9fb', borderRadius: 10, padding: '12px 14px', border: '1px solid #e8e8f0' }}>
                    <div style={{ ...styles.field, flex: 2, minWidth: 130 }}>
                      <label style={styles.label}>Actividad</label>
                      <input
                        value={newActividad.nombre}
                        onChange={e => setNewActividad(p => ({ ...p, nombre: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addActividad()}
                        placeholder="Dictado / Quiz / Proyecto…"
                        style={styles.input}
                      />
                    </div>
                    <div style={{ ...styles.field, flex: 2, minWidth: 130 }}>
                      <label style={styles.label}>Descripción (opcional)</label>
                      <input
                        value={newActividad.descripcion}
                        onChange={e => setNewActividad(p => ({ ...p, descripcion: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addActividad()}
                        placeholder="Unit 3 vocabulary…"
                        style={styles.input}
                      />
                    </div>
                    <div style={{ ...styles.field, width: 130 }}>
                      <label style={styles.label}>📅 Fecha</label>
                      <input
                        type="date"
                        value={newActividad.fecha}
                        onChange={e => setNewActividad(p => ({ ...p, fecha: e.target.value }))}
                        style={styles.input}
                      />
                    </div>
                    <div style={{ ...styles.field, width: 80 }}>
                      <label style={styles.label}>% Peso</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newActividad.porcentaje}
                        onChange={e => setNewActividad(p => ({ ...p, porcentaje: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addActividad()}
                        placeholder="20"
                        style={{ ...styles.input, textAlign: 'center' }}
                      />
                    </div>
                    <button
                      onClick={addActividad}
                      disabled={!newActividad.nombre.trim()}
                      style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: newActividad.nombre.trim() ? 'linear-gradient(135deg, #1A6B3A 0%, #2D8A50 100%)' : '#e0e0e0', color: newActividad.nombre.trim() ? 'white' : '#aaa', fontSize: 13, fontWeight: 700, cursor: newActividad.nombre.trim() ? 'pointer' : 'not-allowed', flexShrink: 0, alignSelf: 'flex-end', marginBottom: 1 }}
                    >
                      + Agregar
                    </button>
                  </div>

                  {/* Activities list — sorted by date */}
                  {form.actividades_evaluativas.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px 16px', color: '#aaa', background: '#fafafa', borderRadius: 8, border: '1px dashed #ddd' }}>
                      <p style={{ fontSize: 13 }}>Sin actividades aún. Agrega las actividades evaluativas del período.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[...form.actividades_evaluativas]
                        .map((act, idx) => ({ ...act, _idx: idx }))
                        .sort((a, b) => {
                          if (!a.fecha && !b.fecha) return 0
                          if (!a.fecha) return 1
                          if (!b.fecha) return -1
                          return a.fecha.localeCompare(b.fecha)
                        })
                        .map((act) => (
                        <div key={act._idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', borderRadius: 8, border: '1px solid #e8e8f0', padding: '10px 14px' }}>
                          {act.fecha && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#2E5598', background: '#eef3ff', border: '1px solid #c5d5f0', borderRadius: 6, padding: '2px 8px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                              {new Date(act.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {!act.fecha && (
                            <span style={{ fontSize: 11, color: '#bbb', background: '#f5f5f5', borderRadius: 6, padding: '2px 8px', flexShrink: 0, fontStyle: 'italic' }}>sin fecha</span>
                          )}
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{act.nombre}</span>
                            {act.descripcion && (
                              <span style={{ fontSize: 12, color: '#777', marginLeft: 8 }}>{act.descripcion}</span>
                            )}
                          </div>
                          {act.porcentaje > 0 && (
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#1A6B3A', background: '#f0fff5', border: '1px solid #b8e8c8', borderRadius: 20, padding: '2px 10px', flexShrink: 0 }}>
                              {act.porcentaje}%
                            </span>
                          )}
                          <button
                            onClick={() => removeActividad(act._idx)}
                            style={{ background: 'none', border: 'none', color: '#CC1F27', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
                            title="Eliminar"
                          >×</button>
                        </div>
                      ))}
                      {/* Total */}
                      {form.actividades_evaluativas.some(a => a.porcentaje > 0) && (() => {
                        const total = form.actividades_evaluativas.reduce((s, a) => s + (Number(a.porcentaje) || 0), 0)
                        return (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: total === 100 ? '#1A6B3A' : total > 100 ? '#CC1F27' : '#B8860B' }}>
                              Total: {total}% {total === 100 ? '✓' : total > 100 ? '— excede 100%' : '— incompleto'}
                            </span>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  <button onClick={() => setActiveStep('timeline')} style={styles.btnNext}>
                    Siguiente: Línea de Tiempo →
                  </button>
                </div>
              )}

              {/* ── STEP: Línea de Tiempo ── */}
              {activeStep === 'timeline' && (() => {
                const SKILL_COLOR = { Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59' }
                const actColor = SKILL_COLOR[form.skill] || '#1A6B3A'

                const withDate = [...form.actividades_evaluativas]
                  .filter(a => a.fecha)
                  .sort((a, b) => a.fecha.localeCompare(b.fecha))
                const withoutDate = form.actividades_evaluativas.filter(a => !a.fecha)

                // Group by ISO week (Monday)
                function getMonday(dateStr) {
                  const d = new Date(dateStr + 'T12:00:00')
                  const day = d.getDay()
                  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
                  return d.toISOString().slice(0, 10)
                }
                function fmtWeek(mondayStr) {
                  const mon = new Date(mondayStr + 'T12:00:00')
                  const fri = new Date(mon); fri.setDate(fri.getDate() + 4)
                  const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
                  return mon.getMonth() === fri.getMonth()
                    ? `${mon.getDate()} – ${fri.getDate()} ${MES[fri.getMonth()]} ${fri.getFullYear()}`
                    : `${mon.getDate()} ${MES[mon.getMonth()]} – ${fri.getDate()} ${MES[fri.getMonth()]} ${fri.getFullYear()}`
                }
                function fmtDay(dateStr) {
                  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })
                }

                // Build week groups — merge due_date as a milestone
                const weekMap = {}
                withDate.forEach(act => {
                  const mon = getMonday(act.fecha)
                  if (!weekMap[mon]) weekMap[mon] = { activities: [], hasDue: false }
                  weekMap[mon].activities.push(act)
                })
                if (form.due_date) {
                  const mon = getMonday(form.due_date)
                  if (!weekMap[mon]) weekMap[mon] = { activities: [], hasDue: false }
                  weekMap[mon].hasDue = true
                }
                const weekKeys = Object.keys(weekMap).sort()

                const noActivities = withDate.length === 0 && !form.due_date
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <h3 style={styles.stepTitle}>Línea de Tiempo</h3>
                      <p style={styles.stepDesc}>Distribución automática de actividades e hitos a lo largo del período. Las fechas se toman de cada actividad evaluativa.</p>
                    </div>

                    {noActivities ? (
                      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#aaa', background: '#fafafa', borderRadius: 10, border: '1px dashed #ddd' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                        <p style={{ fontSize: 13 }}>Agrega fechas a las actividades evaluativas para ver la línea de tiempo.</p>
                        <button onClick={() => setActiveStep('actividades')} style={{ marginTop: 10, fontSize: 12, padding: '6px 16px', borderRadius: 7, border: '1px solid #1A6B3A', background: 'transparent', color: '#1A6B3A', cursor: 'pointer', fontWeight: 600 }}>
                          ← Ir a Actividades
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', paddingLeft: 28 }}>
                        {/* Vertical line */}
                        <div style={{ position: 'absolute', left: 10, top: 8, bottom: 8, width: 2, background: '#e0e0e0', borderRadius: 2 }} />

                        {weekKeys.map((mon, wi) => (
                          <div key={mon} style={{ marginBottom: 20, position: 'relative' }}>
                            {/* Week dot */}
                            <div style={{ position: 'absolute', left: -22, top: 3, width: 12, height: 12, borderRadius: '50%', background: weekMap[mon].hasDue ? '#CC1F27' : actColor, border: '2px solid white', boxShadow: '0 0 0 2px ' + (weekMap[mon].hasDue ? '#CC1F27' : actColor) }} />

                            {/* Week label */}
                            <div style={{ fontSize: 11, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                              Semana del {fmtWeek(mon)}
                            </div>

                            {/* Activities in this week */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {weekMap[mon].activities.map((act, ai) => (
                                <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', borderRadius: 8, border: `1px solid ${actColor}33`, padding: '8px 12px' }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: actColor, background: actColor + '18', borderRadius: 5, padding: '1px 7px', flexShrink: 0 }}>
                                    {fmtDay(act.fecha)}
                                  </span>
                                  <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>
                                    {act.nombre}
                                    {act.descripcion && <span style={{ fontWeight: 400, color: '#777', marginLeft: 6 }}>{act.descripcion}</span>}
                                  </div>
                                  {act.porcentaje > 0 && (
                                    <span style={{ fontSize: 11, fontWeight: 800, color: actColor, flexShrink: 0 }}>{act.porcentaje}%</span>
                                  )}
                                </div>
                              ))}
                              {/* Due date milestone */}
                              {weekMap[mon].hasDue && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff5f5', borderRadius: 8, border: '2px solid #CC1F27', padding: '8px 12px' }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#CC1F27', background: '#fde8e8', borderRadius: 5, padding: '1px 7px', flexShrink: 0 }}>
                                    {fmtDay(form.due_date)}
                                  </span>
                                  <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#CC1F27' }}>
                                    🏁 Entrega del proyecto{form.title ? `: ${form.title}` : ''}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Activities without date */}
                    {withoutDate.length > 0 && (
                      <div style={{ background: '#fffbf0', borderRadius: 8, border: '1px dashed #f0c040', padding: '10px 14px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#8B6914', marginBottom: 6 }}>⚠️ Sin fecha programada ({withoutDate.length})</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {withoutDate.map((act, i) => (
                            <span key={i} style={{ fontSize: 12, background: 'white', border: '1px solid #f0c040', borderRadius: 20, padding: '2px 10px', color: '#555' }}>
                              {act.nombre}
                            </span>
                          ))}
                        </div>
                        <button onClick={() => setActiveStep('actividades')} style={{ marginTop: 8, fontSize: 11, padding: '4px 12px', borderRadius: 6, border: '1px solid #c8a020', background: 'transparent', color: '#8B6914', cursor: 'pointer', fontWeight: 600 }}>
                          ← Asignar fechas
                        </button>
                      </div>
                    )}

                    <button onClick={() => setActiveStep('rubric')} style={styles.btnNext}>
                      Siguiente: Rúbrica →
                    </button>
                  </div>
                )
              })()}

              {/* ── STEP: Rúbrica ── */}
              {activeStep === 'rubric' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <h3 style={styles.stepTitle}>Rúbrica de evaluación</h3>
                    <p style={styles.stepDesc}>Define los criterios de evaluación. La IA puede generarlos a partir del título, descripción e indicador.</p>
                  </div>

                  {form.rubric.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => exportRubricHtml(form, principles, school)}
                        style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #1A3A8F 0%, #0d2260 100%)', color: 'white', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 2px 8px rgba(26,58,143,0.25)' }}
                      >
                        <span>📊</span> Abrir rúbrica interactiva
                      </button>
                    </div>
                  )}

                  <div style={{ background: '#F8F8FC', borderRadius: 10, border: '1px solid #E0E0F0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      className="news-btn-primary"
                      onClick={handleGenerateRubric}
                      disabled={generatingRubric || !form.title || !form.description || !form.target_indicador}
                      title={!form.title || !form.description ? 'Completa título y descripción en el paso Contenido' : !form.target_indicador ? 'Selecciona un indicador en el paso Indicador' : ''}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', flexShrink: 0, background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)', color: 'white', fontSize: 12, fontWeight: 700, cursor: generatingRubric || !form.title || !form.description || !form.target_indicador ? 'not-allowed' : 'pointer', opacity: generatingRubric || !form.title || !form.description || !form.target_indicador ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(124,58,237,0.25)' }}>
                      {generatingRubric ? (
                        <>
                          <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, animation: 'apple-spin 1s linear infinite', flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" strokeDashoffset="0" opacity="0.3" />
                            <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.4 31.4" strokeDashoffset="8" />
                          </svg>
                          <span key={rubricGenerationStep} style={{ animation: 'fade-in-step 0.4s ease-in-out' }}>
                            {rubricGenerationStep === 0 && 'Analizando...'}
                            {rubricGenerationStep === 1 && 'Diseñando...'}
                            {rubricGenerationStep === 2 && 'Generando...'}
                          </span>
                        </>
                      ) : '✨ Generar con IA'}
                    </button>
                    <span style={{ fontSize: 11, color: '#bbb', flexShrink: 0 }}>o</span>
                    <select style={{ ...styles.input, flex: 1, minWidth: 180 }} defaultValue="" onChange={e => e.target.value && loadTemplate(e.target.value)}>
                      <option value="">Cargar plantilla institucional...</option>
                      {matchingTemplates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.criteria?.length ?? 0} criterios)</option>)}
                    </select>
                  </div>

                  {form.rubric.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
                      <p style={{ fontSize: 13 }}>Sin criterios. Carga una plantilla o agrega criterios manualmente.</p>
                    </div>
                  )}

                  {form.rubric.map((criterion, ci) => (
                    <div key={ci} style={{ background: 'white', borderRadius: 12, border: '1px solid #eee', overflow: 'hidden' }}>
                      <div style={{ padding: 16, background: '#F8F9FC', borderBottom: '1px solid #eee', display: 'flex', gap: 16, alignItems: 'center' }}>
                        <span style={{ width: 28, height: 28, borderRadius: 8, background: '#1A3A8F', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{ci + 1}</span>
                        <input value={criterion.name} onChange={e => updateCriterion(ci, 'name', e.target.value)} placeholder="Nombre del criterio" style={{ ...styles.input, flex: 1, fontWeight: 700, margin: 0, padding: '6px 10px' }} />
                        <input value={criterion.desc} onChange={e => updateCriterion(ci, 'desc', e.target.value)} placeholder="Descripción breve" style={{ ...styles.input, flex: 1.5, fontSize: 11, margin: 0, padding: '6px 10px', fontStyle: 'italic' }} />
                        <button onClick={() => removeCriterion(ci)} aria-label={`Eliminar criterio ${criterion.name || (ci + 1)}`} style={{ border: 'none', background: 'rgba(204,31,39,0.08)', color: '#CC1F27', borderRadius: 6, padding: '8px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
                        {LEVEL_LABELS.map((level, li) => (
                          <div key={li} style={{ borderRight: li < 4 ? '1px solid #f0f0f0' : 'none', padding: 8 }}>
                            <div style={{ textAlign: 'center', marginBottom: 8 }}>
                              <span style={{ display: 'inline-block', width: 22, height: 22, borderRadius: '50%', background: level.color, color: 'white', fontSize: 12, fontWeight: 800, lineHeight: '22px' }}>{level.score}</span>
                              <div style={{ fontSize: 9, fontWeight: 700, color: level.color, marginTop: 8 }}>{level.label}</div>
                            </div>
                            <textarea value={criterion.levels[li] || ''} onChange={e => updateLevel(ci, li, e.target.value)} placeholder={`Describe nivel ${level.score}...`} rows={3} style={{ width: '100%', border: '1px solid #eee', borderRadius: 6, padding: '8px', fontSize: 10, lineHeight: 1.4, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button onClick={addCriterion} style={{ ...styles.input, textAlign: 'center', cursor: 'pointer', color: '#1A3A8F', fontWeight: 700, fontSize: 13, border: '2px dashed #ccc', background: '#fafafa', padding: 12 }}>
                    + Agregar criterio
                  </button>
                </div>
              )}

            </div>{/* end content */}
          </div>{/* end main area */}

          {/* ── Footer ── */}
          <div style={styles.footer}>
            <div style={{ fontSize: 11, color: '#888' }}>
              {form.rubric.length > 0 && `${form.rubric.length} criterios · `}
              {form.status === 'draft' ? 'Borrador' : form.status}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} className="news-btn-primary" style={styles.btnCancel}>Cancelar</button>
              <button
                className="news-btn-primary"
                onClick={handleSubmit}
                disabled={!isValid || saving}
                style={{ ...styles.btnSave, opacity: !isValid || saving ? 0.5 : 1, cursor: !isValid || saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear proyecto'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
})

export default NewsProjectEditor

// ── Tag Input Component ──
function TagField({ label, tags, value, onChange, onAdd, onRemove, placeholder }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onAdd() }
  }
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {tags.map((tag, i) => (
          <span key={i} style={{ padding: '4px 8px', borderRadius: 20, background: '#EEF2FB', color: '#1A3A8F', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {tag}
            <button onClick={() => onRemove(i)} aria-label={`Eliminar etiqueta ${tag}`} style={{ border: 'none', background: 'none', color: '#1A3A8F', cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 800, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={value} onChange={e => onChange(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} style={{ ...styles.input, flex: 1 }} />
        <button onClick={onAdd} style={{ padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8, background: 'white', color: '#1A3A8F', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Agregar</button>
      </div>
    </div>
  )
}

// ── Styles ──
const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 24
  },
  modal: {
    background: 'white', borderRadius: 16,
    width: '100%', maxWidth: 920,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    overflow: 'hidden'
  },
  header: {
    padding: '16px 20px',
    background: 'linear-gradient(135deg, #1A6B3A 0%, #2D8A50 100%)',
    borderBottom: 'none',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexShrink: 0,
    borderRadius: '16px 16px 0 0',
  },
  closeBtn: {
    border: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: 8,
    width: 30, height: 30, fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.9)',
    flexShrink: 0, marginTop: 2,
  },
  sidebar: {
    width: 152, borderRight: '1px solid #eee',
    background: '#fafafa', flexShrink: 0,
    display: 'flex', flexDirection: 'column',
    overflowY: 'auto'
  },
  navItem: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px', border: 'none', background: 'transparent',
    cursor: 'pointer', borderLeft: '3px solid transparent',
    textAlign: 'left', color: '#666'
  },
  navItemActive: {
    background: '#fff', borderLeftColor: '#1A6B3A',
    boxShadow: 'inset 0 0 0 0 transparent'
  },
  content: {
    flex: 1, overflowY: 'auto', padding: 24
  },
  stepTitle: {
    fontSize: 15, fontWeight: 800, color: '#1a1a2e', margin: '0 0 4px'
  },
  stepDesc: {
    fontSize: 12, color: '#888', margin: 0, lineHeight: 1.5
  },
  btnNext: {
    alignSelf: 'flex-end', padding: '8px 16px', border: '1px solid #b0d8bc',
    borderRadius: 8, background: '#fff', color: '#1A6B3A',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    marginTop: 4
  },
  footer: {
    padding: '14px 20px', borderTop: '1px solid #eee',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, flexShrink: 0
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: 8, flex: 1
  },
  label: {
    fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.3px'
  },
  input: {
    padding: '8px 16px', border: '1px solid #E5E5E5', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1a1a2e',
    outline: 'none', boxSizing: 'border-box', background: 'white'
  },
  textarea: {
    padding: '8px 16px', border: '1px solid #E5E5E5', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1a1a2e',
    resize: 'vertical', outline: 'none', lineHeight: 1.5,
    boxSizing: 'border-box', background: 'white'
  },
  row3: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16
  },
  btnCancel: {
    padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8,
    background: 'white', color: '#555', fontSize: 13, fontWeight: 700, cursor: 'pointer'
  },
  btnSave: {
    padding: '8px 24px', border: 'none', borderRadius: 8,
    background: '#1A6B3A', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer'
  }
}
