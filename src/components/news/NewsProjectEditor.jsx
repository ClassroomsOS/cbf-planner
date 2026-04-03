import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { supabase } from '../../supabase'
import { useToast } from '../../context/ToastContext'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { generateRubric } from '../../utils/AIAssistant'

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

const EMPTY_TEXTBOOK = { book: '', units: [], grammar: [], vocabulary: [], pages: { student: '', workbook: '' } }

const NewsProjectEditor = memo(function NewsProjectEditor({ teacher, project, templates, cloneForProject, onSave, onClose, principles }) {
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
    target_indicador: ''
  })

  const [saving, setSaving] = useState(false)
  const [generatingRubric, setGeneratingRubric] = useState(false)
  const [rubricGenerationStep, setRubricGenerationStep] = useState(0)
  const [activeTab, setActiveTab] = useState('details')
  const [principlesExpanded, setPrinciplesExpanded] = useState(false)
  const [tagInput, setTagInput] = useState({ grammar: '', vocabulary: '', units: '' })
  const [showTargetSelector, setShowTargetSelector] = useState(false)

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
        // Filter for matching grade (flexible match like LearningTargetSelector)
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

    const steps = [0, 1, 2] // 3 steps total
    let currentIndex = 0

    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % steps.length
      setRubricGenerationStep(steps[currentIndex])
    }, 2000) // Change step every 2 seconds

    return () => clearInterval(interval)
  }, [generatingRubric])

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
        target_indicador: project.target_indicador || ''
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

  // Tag handling for grammar, vocabulary, units
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

  // Rubric template loading
  const loadTemplate = (templateId) => {
    if (!templateId) return
    const rubric = cloneForProject(templateId)
    if (rubric.length > 0) {
      updateForm('rubric', rubric)
      updateForm('rubric_template_id', templateId)
    }
  }

  // Rubric criterion management
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

  // AI Generate Rubric
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

  // Get matching templates for selected skill
  const matchingTemplates = templates.filter(t =>
    !form.skill || t.skill === form.skill || t.skill === 'general'
  )

  // Handle submit
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
      target_indicador: form.target_indicador.trim() || null
    }

    const result = await onSave(payload)
    setSaving(false)

    if (!result.error) {
      showToast(isEditing ? 'Proyecto actualizado' : 'Proyecto creado', 'success')
    } else {
      showToast(result.error, 'error')
    }
  }, [form, isEditing, onSave, saving, showToast])

  // Validation
  const isValid = form.title && form.subject && form.grade && form.section && form.due_date && form.description

  return (
    <>
      {/* Apple-style micro-interactions */}
      <style>{`
        /* Input focus states */
        input:focus, textarea:focus, select:focus {
          border-color: #1A3A8F !important;
          box-shadow: 0 0 0 3px rgba(26, 58, 143, 0.1) !important;
        }

        /* Button hover states — only primary CTAs, not utility/inline buttons */
        .news-btn-primary:not(:disabled):hover {
          transform: scale(1.02);
          box-shadow: 0 4px 12px rgba(26, 58, 143, 0.2);
        }

        .news-btn-primary:not(:disabled):active {
          transform: scale(0.98);
        }

        /* Close button hover */
        .news-close-btn:hover {
          background: #eee !important;
          transform: scale(1.05);
        }

        /* Tab hover */
        .news-tab:hover {
          background: rgba(26, 58, 143, 0.05);
        }

        /* Remove default focus rings, we use custom shadows */
        *:focus {
          outline: none;
        }

        /* Smooth transitions for all interactive elements */
        button, input, textarea, select {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Style select dropdowns */
        select {
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23888888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          padding-right: 40px !important;
          cursor: pointer;
        }

        select:hover {
          border-color: #ccc !important;
        }

        /* Style date inputs to look more rounded */
        input[type="date"] {
          position: relative;
          cursor: pointer;
        }

        input[type="date"]::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.6;
          padding: 4px;
          border-radius: 4px;
        }

        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
          background: rgba(0, 0, 0, 0.05);
        }

        /* Fix text overflow in green box */
        .indicator-card-text {
          word-break: break-word;
          overflow-wrap: break-word;
          max-width: 100%;
        }
      `}</style>

      {/* ── FIX 2A: overlay NO cierra al clic — solo X y Cancelar cierran ── */}
      <div style={styles.overlay}>
        <div ref={modalRef} style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>
              {isEditing ? '✏️ Editar Proyecto NEWS' : '📋 Nuevo Proyecto NEWS'}
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#888' }}>
              Define el proyecto, la rúbrica y el contenido del textbook
            </p>
          </div>
          <button onClick={onClose} className="news-close-btn news-btn-primary" style={styles.closeBtn} aria-label="Cerrar editor de proyecto NEWS">✕</button>
        </div>

        {/* ── PRINCIPIOS RECTORES (COLLAPSIBLE STRIP) ── */}
        {principles && (principles.yearVerse || principles.monthVerse) && (
          <div style={{
            background: 'linear-gradient(135deg, #1A3A8F 0%, #2E5598 100%)',
            borderBottom: '2px solid #F5C300'
          }}>
            {/* Compact strip — always visible */}
            <button
              onClick={() => setPrinciplesExpanded(p => !p)}
              style={{
                width: '100%', padding: '8px 24px', background: 'transparent',
                border: 'none', display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', textAlign: 'left'
              }}
            >
              <span style={{ fontSize: 13 }}>📖</span>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#F5C300', textTransform: 'uppercase', letterSpacing: '0.8px', flexShrink: 0 }}>
                PRINCIPIOS RECTORES
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {principles.yearVerseRef && `Año: ${principles.yearVerseRef}`}
                {principles.yearVerseRef && principles.monthVerseRef && ' · '}
                {principles.monthVerseRef && `Mes: ${principles.monthVerseRef}`}
              </span>
              <span style={{
                color: '#F5C300', fontSize: 10, flexShrink: 0,
                transition: 'transform 0.2s', display: 'inline-block',
                transform: principlesExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>▾</span>
            </button>

            {/* Expanded — full verses */}
            {principlesExpanded && (
              <div style={{ padding: '0 24px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {principles.yearVerse && (
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #F5C300' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#F5C300', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      ✨ VERSÍCULO DEL AÑO
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.5, color: '#FFFFFF' }}>"{principles.yearVerse}"</div>
                    {principles.yearVerseRef && (
                      <div style={{ fontSize: 10, fontStyle: 'italic', color: '#C5D5F0', marginTop: 4, textAlign: 'right' }}>— {principles.yearVerseRef}</div>
                    )}
                  </div>
                )}
                {principles.monthVerse && (
                  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid #F5C300' }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#F5C300', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                      📅 VERSÍCULO DEL MES
                    </div>
                    <div style={{ fontSize: 11, lineHeight: 1.5, color: '#FFFFFF' }}>"{principles.monthVerse}"</div>
                    {principles.monthVerseRef && (
                      <div style={{ fontSize: 10, fontStyle: 'italic', color: '#C5D5F0', marginTop: 4, textAlign: 'right' }}>— {principles.monthVerseRef}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={styles.tabs}>
          {[
            { key: 'details', label: '📝 Proyecto', },
            { key: 'textbook', label: '📘 Textbook' },
            { key: 'rubric', label: '📊 Rúbrica' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="news-tab"
              style={{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.tabActive : {})
              }}
            >
              {tab.label}
              {tab.key === 'rubric' && form.rubric.length > 0 && (
                <span style={styles.badge}>{form.rubric.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={styles.body}>

          {/* ──── DETAILS TAB ──── */}
          {activeTab === 'details' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Classification row */}
              <div style={styles.row3}>
                <div style={styles.field}>
                  <label style={styles.label}>Materia *</label>
                  <select
                    value={form.subject}
                    onChange={e => {
                      updateForm('subject', e.target.value)
                      updateForm('grade', '')
                      updateForm('section', '')
                    }}
                    style={styles.input}
                  >
                    <option value="">— Seleccionar —</option>
                    {subjectOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Grado *</label>
                  <select
                    value={form.grade}
                    onChange={e => {
                      updateForm('grade', e.target.value)
                      updateForm('section', '')
                    }}
                    disabled={!form.subject}
                    style={{ ...styles.input, opacity: form.subject ? 1 : 0.5 }}
                  >
                    <option value="">— Seleccionar —</option>
                    {gradeOptions.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
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
                    {sectionOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.row3}>
                <div style={styles.field}>
                  <label style={styles.label}>Skill</label>
                  <select
                    value={form.skill}
                    onChange={e => updateForm('skill', e.target.value)}
                    style={styles.input}
                  >
                    {SKILLS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Período *</label>
                  <select
                    value={form.period}
                    onChange={e => updateForm('period', parseInt(e.target.value))}
                    style={styles.input}
                  >
                    {[1, 2, 3, 4].map(p => (
                      <option key={p} value={p}>Período {p}</option>
                    ))}
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

              {/* ── LOGRO DE DESEMPEÑO ── */}
              <div style={{
                background: '#F0F7F0', borderRadius: 12, padding: 16,
                border: '1px solid #E8F0E8',
                boxShadow: '0 1px 3px rgba(155, 187, 89, 0.1)',
                overflow: 'hidden'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: '#1A5C1A', margin: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    🎯 Logro de Desempeño Vinculado
                  </h4>
                  {form.target_id && (
                    <button
                      onClick={() => setShowTargetSelector(true)}
                      style={{
                        fontSize: 10, padding: '8px', borderRadius: 4,
                        border: '1px solid #9BBB59', background: 'transparent',
                        color: '#5a8a00', cursor: 'pointer', fontWeight: 600
                      }}
                    >
                      Cambiar
                    </button>
                  )}
                </div>

                {/* Selected target display */}
                {form.target_id && (() => {
                  const selectedTarget = learningTargets.find(t => t.id === form.target_id)
                  if (!selectedTarget) return null
                  const TAXONOMY_EMOJI = { recognize: '👁️', apply: '🛠️', produce: '✨' }
                  const TAXONOMY_LABELS = { recognize: 'Reconocer', apply: 'Aplicar', produce: 'Producir' }

                  return (
                    <div style={{
                      background: '#fff', borderRadius: 6, padding: '8px 10px',
                      border: '1px solid #E8F0E8',
                      boxShadow: '0 2px 4px rgba(155, 187, 89, 0.08)',
                      marginBottom: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 15 }}>{TAXONOMY_EMOJI[selectedTarget.taxonomy]}</span>
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: '#5a8a00',
                          textTransform: 'uppercase', letterSpacing: '0.3px',
                          background: '#f6fff0', padding: '4px 8px', borderRadius: 3
                        }}>
                          {TAXONOMY_LABELS[selectedTarget.taxonomy]}
                        </span>
                        {selectedTarget.group_name && (
                          <span style={{
                            fontSize: 9, color: '#888',
                            background: '#f5f5f5', padding: '4px 8px', borderRadius: 3
                          }}>
                            {selectedTarget.group_name}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: '#1a1a2e',
                        lineHeight: 1.4,
                        fontWeight: 400,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {selectedTarget.description}
                      </div>
                    </div>
                  )
                })()}

                {/* Target selector (when no target or changing) */}
                {(!form.target_id || showTargetSelector) && (
                  <div style={{ marginBottom: 8 }}>
                    {learningTargets.length === 0 && form.subject && form.grade ? (
                      <div style={{
                        padding: '8px', borderRadius: 6, background: '#FFF9E6',
                        border: '1px dashed #F5C300', textAlign: 'center'
                      }}>
                        <div style={{ fontSize: 10, color: '#8B6914', lineHeight: 1.3 }}>
                          No hay logros activos para <strong>{form.subject} · {form.grade}</strong>.<br />
                          Crea uno primero en "Logros de Desempeño".
                        </div>
                      </div>
                    ) : learningTargets.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', overflowX: 'hidden' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#5a8a00', marginBottom: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                          Selecciona el logro que este proyecto evalúa:
                        </div>
                        {learningTargets.map(t => {
                          const TAXONOMY_EMOJI = { recognize: '👁️', apply: '🛠️', produce: '✨' }
                          return (
                            <button
                              key={t.id}
                              onClick={() => {
                                updateForm('target_id', t.id)
                                updateForm('target_indicador', '')
                                setShowTargetSelector(false)
                              }}
                              style={{
                                padding: '8px', borderRadius: 5, textAlign: 'left',
                                border: form.target_id === t.id ? '2px solid #9BBB59' : '1px solid #ddd',
                                background: form.target_id === t.id ? '#f6fff0' : '#fff',
                                cursor: 'pointer', transition: 'all 0.15s',
                                display: 'flex', alignItems: 'flex-start', gap: 8
                              }}
                            >
                              <span style={{ fontSize: 15, flexShrink: 0 }}>{TAXONOMY_EMOJI[t.taxonomy]}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: 11,
                                  color: '#1a1a2e',
                                  lineHeight: 1.3,
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden'
                                }}>
                                  {t.description}
                                </div>
                                {t.group_name && (
                                  <div style={{ fontSize: 9, color: '#888', marginTop: 8 }}>
                                    Grupo: {t.group_name}
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: 10, color: '#999', fontStyle: 'italic' }}>
                        Selecciona primero Materia y Grado para ver los logros disponibles.
                      </div>
                    )}
                    {showTargetSelector && (
                      <button
                        onClick={() => setShowTargetSelector(false)}
                        style={{
                          fontSize: 10, padding: '8px', borderRadius: 4,
                          border: '1px solid #ddd', background: '#fff',
                          color: '#666', cursor: 'pointer', marginTop: 8
                        }}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                )}

                {/* Indicadores selector - only show when target is selected */}
                {form.target_id && !showTargetSelector && (() => {
                  const selectedTarget = learningTargets.find(t => t.id === form.target_id)
                  const indicadores = selectedTarget?.indicadores || []

                  if (indicadores.length === 0) {
                    return (
                      <div style={{
                        padding: '8px', borderRadius: 5, background: '#FFF9E6',
                        border: '1px dashed #F5C300', fontSize: 10, color: '#8B6914',
                        fontStyle: 'italic', textAlign: 'center'
                      }}>
                        Este logro aún no tiene indicadores configurados.
                      </div>
                    )
                  }

                  return (
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: '#1A5C1A', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        📌 Selecciona el indicador que este proyecto demuestra:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto', overflowX: 'hidden' }}>
                        {indicadores.map((ind, idx) => (
                          <button
                            key={idx}
                            onClick={() => updateForm('target_indicador', ind)}
                            style={{
                              padding: '8px', borderRadius: 5, textAlign: 'left',
                              border: form.target_indicador === ind ? '2px solid #9BBB59' : '1px solid #ddd',
                              background: form.target_indicador === ind ? '#fff' : '#fafafa',
                              cursor: 'pointer', transition: 'all 0.15s',
                              display: 'flex', alignItems: 'flex-start', gap: 8,
                              boxShadow: form.target_indicador === ind ? '0 2px 4px rgba(155,187,89,0.2)' : 'none'
                            }}
                          >
                            <div style={{
                              width: 15, height: 15, borderRadius: '50%',
                              border: form.target_indicador === ind ? '2px solid #9BBB59' : '2px solid #ddd',
                              background: form.target_indicador === ind ? '#9BBB59' : '#fff',
                              flexShrink: 0, marginTop: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {form.target_indicador === ind && (
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 9, fontWeight: 700, color: '#5a8a00',
                                marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.2px'
                              }}>
                                Indicador {idx + 1}
                              </div>
                              <div style={{
                                fontSize: 11,
                                color: '#1a1a2e',
                                lineHeight: 1.3,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {ind}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <div style={{
                        fontSize: 9, color: '#666', marginTop: 8, fontStyle: 'italic',
                        padding: '4px 6px', background: '#f8f8f8', borderRadius: 4, lineHeight: 1.3
                      }}>
                        💡 El estudiante demuestra el logro al cumplir este indicador.
                      </div>
                    </div>
                  )
                })()}
              </div>

              {/* Title */}
              <div style={styles.field}>
                <label style={styles.label}>Título del proyecto *</label>
                <input
                  value={form.title}
                  onChange={e => updateForm('title', e.target.value)}
                  placeholder="Vision Board"
                  style={{ ...styles.input, fontSize: 16, fontWeight: 700 }}
                />
              </div>

              {/* Description */}
              <div style={styles.field}>
                <label style={styles.label}>Descripción del proyecto *</label>
                <textarea
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                  placeholder="Los alumnos realizarán una presentación..."
                  rows={3}
                  style={styles.textarea}
                />
              </div>

              {/* Conditions */}
              <div style={styles.field}>
                <label style={styles.label}>Condiciones de entrega</label>
                <textarea
                  value={form.conditions}
                  onChange={e => updateForm('conditions', e.target.value)}
                  placeholder="Mínimo 5 minutos, presentación dinámica..."
                  rows={2}
                  style={styles.textarea}
                />
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={styles.field}>
                  <label style={styles.label}>Fecha de inicio (preparación)</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => updateForm('start_date', e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Fecha de entrega *</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={e => updateForm('due_date', e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Biblical integration */}
              <div style={{
                background: '#F0F4FF', borderRadius: 12, padding: '12px 16px',
                border: '1px solid #D0DCFF'
              }}>
                <h4 style={{ fontSize: 11, fontWeight: 800, color: '#1A3A8F', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  ✝️ Integración Bíblica
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={styles.field}>
                    <label style={styles.label}>Principio / Versículo</label>
                    <input
                      value={form.biblical_principle}
                      onChange={e => updateForm('biblical_principle', e.target.value)}
                      placeholder="1 John 2:17"
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.field}>
                    <label style={styles.label}>Reflexión requerida</label>
                    <input
                      value={form.biblical_reflection}
                      onChange={e => updateForm('biblical_reflection', e.target.value)}
                      placeholder="Explicar cómo enfrentar el cambio..."
                      style={styles.input}
                    />
                  </div>
                </div>
                {principles?.indicatorPrinciple && (
                  <div style={{
                    background: '#E8EEFF', borderRadius: 6,
                    padding: '6px 12px', border: '1px solid #C5D5F0', marginTop: 8
                  }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#1A3A8F', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      📖 Principio del indicador (mes):
                    </span>
                    <span style={{ fontSize: 11, color: '#1A3A8F', lineHeight: 1.4, fontStyle: 'italic', marginLeft: 6 }}>
                      "{principles.indicatorPrinciple}"
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──── TEXTBOOK TAB ──── */}
          {activeTab === 'textbook' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={styles.row3}>
                <div style={{ ...styles.field, flex: 2 }}>
                  <label style={styles.label}>Libro</label>
                  <input
                    value={form.textbook_reference.book || ''}
                    onChange={e => updateTextbook('book', e.target.value)}
                    placeholder="Evolve 4 / Uncover 4"
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Páginas (Student Book)</label>
                  <input
                    value={form.textbook_reference.pages?.student || ''}
                    onChange={e => updateTextbookPages('student', e.target.value)}
                    placeholder="6-22"
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Páginas (Workbook)</label>
                  <input
                    value={form.textbook_reference.pages?.workbook || ''}
                    onChange={e => updateTextbookPages('workbook', e.target.value)}
                    placeholder="5-14"
                    style={styles.input}
                  />
                </div>
              </div>

              {/* Units tags */}
              <TagField
                label="Unidades"
                tags={form.textbook_reference.units || []}
                value={tagInput.units}
                onChange={v => setTagInput(p => ({ ...p, units: v }))}
                onAdd={() => addTag('units')}
                onRemove={(i) => removeTag('units', i)}
                placeholder="1"
              />

              {/* Grammar tags */}
              <TagField
                label="Gramática"
                tags={form.textbook_reference.grammar || []}
                value={tagInput.grammar}
                onChange={v => setTagInput(p => ({ ...p, grammar: v }))}
                onAdd={() => addTag('grammar')}
                onRemove={(i) => removeTag('grammar', i)}
                placeholder="past simple"
              />

              {/* Vocabulary tags */}
              <TagField
                label="Vocabulario"
                tags={form.textbook_reference.vocabulary || []}
                value={tagInput.vocabulary}
                onChange={v => setTagInput(p => ({ ...p, vocabulary: v }))}
                onAdd={() => addTag('vocabulary')}
                onRemove={(i) => removeTag('vocabulary', i)}
                placeholder="music"
              />
            </div>
          )}

          {/* ──── RUBRIC TAB ──── */}
          {activeTab === 'rubric' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* AI + Template — una sola fila */}
              <div style={{
                background: '#F8F8FC', borderRadius: 10,
                border: '1px solid #E0E0F0', padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
              }}>
                <button
                  className="news-btn-primary"
                  onClick={handleGenerateRubric}
                  disabled={generatingRubric || !form.title || !form.description || !form.target_indicador}
                  title={!form.title || !form.description ? 'Completa título y descripción en la pestaña Proyecto' : !form.target_indicador ? 'Selecciona un indicador de logro en la pestaña Proyecto' : ''}
                  style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none', flexShrink: 0,
                    background: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)',
                    color: 'white', fontSize: 12, fontWeight: 700,
                    cursor: generatingRubric || !form.title || !form.description || !form.target_indicador ? 'not-allowed' : 'pointer',
                    opacity: generatingRubric || !form.title || !form.description || !form.target_indicador ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
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
                <select
                  style={{ ...styles.input, flex: 1, minWidth: 180 }}
                  defaultValue=""
                  onChange={e => e.target.value && loadTemplate(e.target.value)}
                >
                  <option value="">Cargar plantilla institucional...</option>
                  {matchingTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.criteria?.length ?? 0} criterios)</option>
                  ))}
                </select>
              </div>

              <style>{`
                @keyframes apple-spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                @keyframes fade-in-step {
                  0% { opacity: 0; transform: translateY(-3px); }
                  100% { opacity: 1; transform: translateY(0); }
                }
              `}</style>

              {/* Criteria list */}
              {form.rubric.length === 0 && (
                <div style={{ textAlign: 'center', padding: 32, color: '#888' }}>
                  <p style={{ fontSize: 13 }}>
                    Sin criterios. Carga una plantilla o agrega criterios manualmente.
                  </p>
                </div>
              )}

              {form.rubric.map((criterion, ci) => (
                <div key={ci} style={{
                  background: 'white', borderRadius: 12,
                  border: '1px solid #eee', overflow: 'hidden'
                }}>
                  {/* Criterion header */}
                  <div style={{
                    padding: 16, background: '#F8F9FC',
                    borderBottom: '1px solid #eee',
                    display: 'flex', gap: 16, alignItems: 'center'
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: '#1A3A8F', color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, flexShrink: 0
                    }}>
                      {ci + 1}
                    </span>
                    <input
                      value={criterion.name}
                      onChange={e => updateCriterion(ci, 'name', e.target.value)}
                      placeholder="Nombre del criterio"
                      style={{
                        ...styles.input, flex: 1, fontWeight: 700,
                        margin: 0, padding: '6px 10px'
                      }}
                    />
                    <input
                      value={criterion.desc}
                      onChange={e => updateCriterion(ci, 'desc', e.target.value)}
                      placeholder="Descripción breve"
                      style={{
                        ...styles.input, flex: 1.5, fontSize: 11,
                        margin: 0, padding: '6px 10px', fontStyle: 'italic'
                      }}
                    />
                    <button
                      onClick={() => removeCriterion(ci)}
                      aria-label={`Eliminar criterio ${criterion.name || (ci + 1)}`}
                      style={{
                        border: 'none', background: 'rgba(204,31,39,0.08)',
                        color: '#CC1F27', borderRadius: 6,
                        padding: '8px', cursor: 'pointer',
                        fontSize: 12, fontWeight: 700
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* 5 level descriptors */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
                    gap: 0
                  }}>
                    {LEVEL_LABELS.map((level, li) => (
                      <div key={li} style={{
                        borderRight: li < 4 ? '1px solid #f0f0f0' : 'none',
                        padding: 8
                      }}>
                        <div style={{
                          textAlign: 'center', marginBottom: 8
                        }}>
                          <span style={{
                            display: 'inline-block', width: 22, height: 22,
                            borderRadius: '50%', background: level.color,
                            color: 'white', fontSize: 12, fontWeight: 800,
                            lineHeight: '22px'
                          }}>
                            {level.score}
                          </span>
                          <div style={{
                            fontSize: 9, fontWeight: 700, color: level.color,
                            marginTop: 8
                          }}>
                            {level.label}
                          </div>
                        </div>
                        <textarea
                          value={criterion.levels[li] || ''}
                          onChange={e => updateLevel(ci, li, e.target.value)}
                          placeholder={`Describe nivel ${level.score}...`}
                          rows={3}
                          style={{
                            width: '100%', border: '1px solid #eee',
                            borderRadius: 6, padding: '8px',
                            fontSize: 10, lineHeight: 1.4,
                            resize: 'vertical', fontFamily: 'inherit',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <button onClick={addCriterion} style={{
                ...styles.input, textAlign: 'center', cursor: 'pointer',
                color: '#1A3A8F', fontWeight: 700, fontSize: 13,
                border: '2px dashed #ccc', background: '#fafafa',
                padding: 12
              }}>
                + Agregar criterio
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
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
              style={{
                ...styles.btnSave,
                opacity: !isValid || saving ? 0.5 : 1,
                cursor: !isValid || saving ? 'not-allowed' : 'pointer'
              }}
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
          <span key={i} style={{
            padding: '4px 8px', borderRadius: 20,
            background: '#EEF2FB', color: '#1A3A8F',
            fontSize: 12, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 8
          }}>
            {tag}
            <button
              onClick={() => onRemove(i)}
              aria-label={`Eliminar etiqueta ${tag}`}
              style={{
                border: 'none', background: 'none', color: '#1A3A8F',
                cursor: 'pointer', padding: 0, fontSize: 14, fontWeight: 800,
                lineHeight: 1
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          style={{ ...styles.input, flex: 1 }}
        />
        <button onClick={onAdd} style={{
          padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8,
          background: 'white', color: '#1A3A8F', fontWeight: 700,
          fontSize: 12, cursor: 'pointer'
        }}>
          + Agregar
        </button>
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
    width: '100%', maxWidth: 900,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    overflow: 'hidden'
  },
  header: {
    padding: 24, borderBottom: '1px solid #eee',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
  },
  closeBtn: {
    border: 'none', background: '#f5f5f5', borderRadius: 8,
    width: 32, height: 32, fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#888',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  tabs: {
    display: 'flex', gap: 8, padding: '0 24px',
    borderBottom: '1px solid #eee', background: '#fafafa'
  },
  tab: {
    padding: '8px 16px', border: 'none', background: 'transparent',
    fontSize: 12, fontWeight: 700, color: '#888', cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex', alignItems: 'center', gap: 8
  },
  tabActive: {
    color: '#1A3A8F', borderBottomColor: '#1A3A8F'
  },
  badge: {
    background: '#1A3A8F', color: 'white',
    fontSize: 10, fontWeight: 800, borderRadius: 10,
    padding: '2px 8px', lineHeight: '16px'
  },
  body: {
    padding: 24, overflowY: 'auto', flex: 1
  },
  footer: {
    padding: 24, borderTop: '1px solid #eee',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: 8, flex: 1
  },
  label: {
    fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  input: {
    padding: '8px 16px', border: '1px solid #E5E5E5', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1a1a2e',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', outline: 'none',
    boxSizing: 'border-box',
    background: 'white'
  },
  textarea: {
    padding: '8px 16px', border: '1px solid #E5E5E5', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1a1a2e',
    resize: 'vertical', outline: 'none', lineHeight: 1.5,
    boxSizing: 'border-box',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    background: 'white'
  },
  row3: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16
  },
  btnCancel: {
    padding: '8px 16px', border: '1px solid #ddd', borderRadius: 8,
    background: 'white', color: '#555', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  btnSave: {
    padding: '8px 24px', border: 'none', borderRadius: 8,
    background: '#1A3A8F', color: 'white', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }
}
