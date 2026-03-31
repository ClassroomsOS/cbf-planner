import { useState, useEffect } from 'react'

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

export default function NewsProjectEditor({ teacher, project, templates, cloneForProject, onSave, onClose }) {
  const isEditing = !!project

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
    sequence: 1
  })

  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [tagInput, setTagInput] = useState({ grammar: '', vocabulary: '', units: '' })

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
        sequence: project.sequence || 1
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

  // Get matching templates for selected skill
  const matchingTemplates = templates.filter(t =>
    !form.skill || t.skill === form.skill || t.skill === 'general'
  )

  // Validation
  const isValid = form.title && form.subject && form.grade && form.section && form.due_date && form.description

  const handleSubmit = async () => {
    if (!isValid || saving) return
    setSaving(true)
    const result = await onSave(form)
    setSaving(false)
    if (result.error) {
      alert('Error: ' + result.error)
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1a1a2e' }}>
              {isEditing ? '✏️ Editar Proyecto NEWS' : '📋 Nuevo Proyecto NEWS'}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>
              Define el proyecto, la rúbrica y el contenido del textbook
            </p>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

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
                  <input
                    value={form.subject}
                    onChange={e => updateForm('subject', e.target.value)}
                    placeholder="Language Arts"
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Grado *</label>
                  <input
                    value={form.grade}
                    onChange={e => updateForm('grade', e.target.value)}
                    placeholder="8th"
                    style={styles.input}
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Sección *</label>
                  <input
                    value={form.section}
                    onChange={e => updateForm('section', e.target.value)}
                    placeholder="Azul"
                    style={styles.input}
                  />
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
                  rows={4}
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
                  rows={3}
                  style={styles.textarea}
                />
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                background: '#F0F4FF', borderRadius: 12, padding: 16,
                border: '1px solid #D0DCFF'
              }}>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: '#1A3A8F', margin: '0 0 12px', textTransform: 'uppercase' }}>
                  ✝️ Integración Bíblica
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
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
              {/* Template selector */}
              <div style={{
                background: '#FFFDF0', borderRadius: 12, padding: 16,
                border: '1.5px solid #F5C300', display: 'flex', gap: 12,
                alignItems: 'flex-end', flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label style={{ ...styles.label, color: '#B8860B' }}>
                    Cargar plantilla institucional
                  </label>
                  <select
                    style={styles.input}
                    defaultValue=""
                    onChange={e => e.target.value && loadTemplate(e.target.value)}
                  >
                    <option value="">Seleccionar plantilla...</option>
                    {matchingTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.criteria.length} criterios)
                      </option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
                  Carga los criterios base y luego personaliza los descriptores por nivel
                </p>
              </div>

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
                    padding: '12px 16px', background: '#F8F9FC',
                    borderBottom: '1px solid #eee',
                    display: 'flex', gap: 12, alignItems: 'center'
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
                      style={{
                        border: 'none', background: 'rgba(204,31,39,0.08)',
                        color: '#CC1F27', borderRadius: 6,
                        padding: '4px 8px', cursor: 'pointer',
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
                          textAlign: 'center', marginBottom: 6
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
                            marginTop: 2
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
                            borderRadius: 6, padding: '6px 8px',
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
            <button onClick={onClose} style={styles.btnCancel}>Cancelar</button>
            <button
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
  )
}

// ── Tag Input Component ──
function TagField({ label, tags, value, onChange, onAdd, onRemove, placeholder }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); onAdd() }
  }

  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {tags.map((tag, i) => (
          <span key={i} style={{
            padding: '3px 10px', borderRadius: 20,
            background: '#EEF2FB', color: '#1A3A8F',
            fontSize: 12, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 6
          }}>
            {tag}
            <button
              onClick={() => onRemove(i)}
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
          padding: '6px 14px', border: '1px solid #ddd', borderRadius: 8,
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
    zIndex: 1000, padding: 20
  },
  modal: {
    background: 'white', borderRadius: 16,
    width: '100%', maxWidth: 900,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
    overflow: 'hidden'
  },
  header: {
    padding: '20px 24px', borderBottom: '1px solid #eee',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
  },
  closeBtn: {
    border: 'none', background: '#f5f5f5', borderRadius: 8,
    width: 32, height: 32, fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#888'
  },
  tabs: {
    display: 'flex', gap: 2, padding: '0 24px',
    borderBottom: '1px solid #eee', background: '#fafafa'
  },
  tab: {
    padding: '10px 18px', border: 'none', background: 'transparent',
    fontSize: 12, fontWeight: 700, color: '#888', cursor: 'pointer',
    borderBottom: '2px solid transparent', transition: 'all 0.15s',
    display: 'flex', alignItems: 'center', gap: 6
  },
  tabActive: {
    color: '#1A3A8F', borderBottomColor: '#1A3A8F'
  },
  badge: {
    background: '#1A3A8F', color: 'white',
    fontSize: 10, fontWeight: 800, borderRadius: 10,
    padding: '1px 6px', lineHeight: '16px'
  },
  body: {
    padding: 24, overflowY: 'auto', flex: 1
  },
  footer: {
    padding: '16px 24px', borderTop: '1px solid #eee',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: 4, flex: 1
  },
  label: {
    fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  input: {
    padding: '8px 12px', border: '1.5px solid #ddd', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1a1a2e',
    transition: 'border-color 0.15s', outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    padding: '10px 12px', border: '1.5px solid #ddd', borderRadius: 8,
    fontSize: 13, fontFamily: 'inherit', color: '#1a1a2e',
    resize: 'vertical', outline: 'none', lineHeight: 1.5,
    boxSizing: 'border-box'
  },
  row3: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12
  },
  btnCancel: {
    padding: '8px 18px', border: '1px solid #ddd', borderRadius: 8,
    background: 'white', color: '#555', fontSize: 13, fontWeight: 700,
    cursor: 'pointer'
  },
  btnSave: {
    padding: '8px 22px', border: 'none', borderRadius: 8,
    background: '#1A3A8F', color: 'white', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.15s'
  }
}
