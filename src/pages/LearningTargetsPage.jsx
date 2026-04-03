import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { generateIndicadores } from '../utils/AIAssistant'
import { useToast } from '../context/ToastContext'
import { TAXONOMY_LEVELS, ACADEMIC_PERIODS } from '../utils/constants'
import './LearningTargets.css'

// ── Constants ────────────────────────────────────────────────────────────────
// Map ACADEMIC_PERIODS to legacy format for this component
const PERIODS = ACADEMIC_PERIODS.map((p, i) => ({
  value: i + 1,
  label: p.label.replace(' 2026', '')
}))

// ── Main Component ──────────────────────────────────────────────────────────

export default function LearningTargetsPage({ teacher }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const school   = teacher.schools || {}

  // ── State ──
  const [targets,       setTargets]       = useState([])
  const [assignments,   setAssignments]   = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [editingId,     setEditingId]     = useState(null)
  const [saving,         setSaving]         = useState(false)
  const [generatingInd,  setGeneratingInd]  = useState(false)
  const [aiIndError,     setAiIndError]     = useState(null)
  const [monthPrinciple, setMonthPrinciple] = useState(null)
  const [linkedProjects, setLinkedProjects] = useState({}) // { target_id: [project, ...] }

  // ── Filters ──
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterGrade,   setFilterGrade]   = useState('all')
  const [filterPeriod,  setFilterPeriod]  = useState('all')

  // ── Form state ──
  const emptyForm = {
    subject: '', grade: '', group_name: '', period: 1,
    description: '', taxonomy: 'apply', prerequisite_ids: [], indicadores: [],
  }
  const [form, setForm] = useState(emptyForm)

  // ── Load data ──
  useEffect(() => {
    loadData()
    loadMonthPrinciple()
  }, [])

  // Reload linked projects whenever targets change
  useEffect(() => {
    if (targets.length === 0) return
    const ids = targets.map(t => t.id)
    supabase
      .from('news_projects')
      .select('id, title, subject, grade, section, period, status, target_id, target_indicador')
      .eq('school_id', teacher.school_id)
      .in('target_id', ids)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(p => {
          if (!map[p.target_id]) map[p.target_id] = []
          map[p.target_id].push(p)
        })
        setLinkedProjects(map)
      })
  }, [targets])

  async function loadMonthPrinciple() {
    const now = new Date()
    const { data } = await supabase
      .from('school_monthly_principles')
      .select('month_verse, month_verse_ref, indicator_principle')
      .eq('school_id', teacher.school_id)
      .eq('year',  now.getFullYear())
      .eq('month', now.getMonth() + 1)
      .maybeSingle()
    if (data) setMonthPrinciple(data)
  }

  async function loadData() {
    setLoading(true)

    // Load teacher assignments to get subject/grade options
    const { data: assignData } = await supabase
      .from('teacher_assignments')
      .select('subject, grade, section')
      .eq('teacher_id', teacher.id)
      .eq('school_id', teacher.school_id)

    setAssignments(assignData || [])

    // Load targets
    const { data: targetData } = await supabase
      .from('learning_targets')
      .select('*')
      .eq('school_id', teacher.school_id)
      .order('period', { ascending: true })
      .order('created_at', { ascending: false })

    setTargets(targetData || [])
    setLoading(false)
  }

  // ── Derived: unique subjects and grades from assignments ──
  const subjectOptions = useMemo(() => {
    const set = new Set((assignments || []).map(a => a.subject))
    return [...set].sort()
  }, [assignments])

  const gradeOptions = useMemo(() => {
    const set = new Set((assignments || []).map(a => a.grade))
    return [...set].sort()
  }, [assignments])

  const groupOptions = useMemo(() => {
    if (!form.grade) return []
    const set = new Set(
      (assignments || [])
        .filter(a => a.grade === form.grade)
        .map(a => a.section)
        .filter(Boolean)
    )
    return [...set].sort()
  }, [assignments, form.grade])

  // ── Filtered targets ──
  const filteredTargets = useMemo(() => {
    return targets.filter(t => {
      if (filterSubject !== 'all' && t.subject !== filterSubject) return false
      if (filterGrade   !== 'all' && t.grade   !== filterGrade)   return false
      if (filterPeriod  !== 'all' && t.period  !== Number(filterPeriod)) return false
      return true
    })
  }, [targets, filterSubject, filterGrade, filterPeriod])

  // ── Target counts by period ──
  const periodCounts = useMemo(() => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 }
    targets.forEach(t => { counts[t.period] = (counts[t.period] || 0) + 1 })
    return counts
  }, [targets])

  // ── Form handlers ──
  function openNewForm() {
    setForm({
      ...emptyForm,
      subject: subjectOptions[0] || '',
      grade:   gradeOptions[0]   || '',
    })
    setEditingId(null)
    setShowForm(true)
  }

  function openEditForm(target) {
    setForm({
      subject:          target.subject,
      grade:            target.grade,
      group_name:       target.group_name || '',
      period:           target.period,
      description:      target.description,
      taxonomy:         target.taxonomy,
      prerequisite_ids: target.prerequisite_ids || [],
      indicadores:      target.indicadores || [],
    })
    setEditingId(target.id)
    setAiIndError(null)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setAiIndError(null)
    setForm(emptyForm)
  }

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // ── Save ──
  async function handleSave() {
    if (!form.description.trim()) return
    setSaving(true)

    const payload = {
      school_id:        teacher.school_id,
      teacher_id:       teacher.id,
      subject:          form.subject,
      grade:            form.grade,
      group_name:       form.group_name || null,
      period:           form.period,
      description:      form.description.trim(),
      taxonomy:         form.taxonomy,
      prerequisite_ids: form.prerequisite_ids,
      indicadores:      form.indicadores.filter(Boolean),
    }

    if (editingId) {
      await supabase
        .from('learning_targets')
        .update(payload)
        .eq('id', editingId)
    } else {
      await supabase
        .from('learning_targets')
        .insert(payload)
    }

    closeForm()
    await loadData()
    setSaving(false)
  }

  // ── Delete ──
  async function handleDelete(id) {
    if (!window.confirm('¿Eliminar este logro de desempeño?')) return
    await supabase.from('learning_targets').delete().eq('id', id)
    await loadData()
  }

  // ── Toggle active ──
  async function handleToggleActive(id, currentlyActive) {
    await supabase
      .from('learning_targets')
      .update({ is_active: !currentlyActive })
      .eq('id', id)
    await loadData()
  }

  // ── Prerequisite helpers ──
  const availablePrereqs = useMemo(() => {
    return targets.filter(t => {
      if (editingId && t.id === editingId) return false
      if (form.subject && t.subject !== form.subject) return false
      return true
    })
  }, [targets, editingId, form.subject])

  function togglePrerequisite(targetId) {
    setForm(prev => {
      const ids = prev.prerequisite_ids || []
      if (ids.includes(targetId)) {
        return { ...prev, prerequisite_ids: ids.filter(id => id !== targetId) }
      }
      return { ...prev, prerequisite_ids: [...ids, targetId] }
    })
  }

  // ── Get target name by ID (for prerequisite display) ──
  function getTargetLabel(id) {
    const t = targets.find(x => x.id === id)
    if (!t) return 'Desconocido'
    return t.description.length > 60
      ? t.description.slice(0, 60) + '…'
      : t.description
  }

  // ── Taxonomy badge ──
  function TaxonomyBadge({ level }) {
    const t = TAXONOMY_LEVELS.find(x => x.value === level) || TAXONOMY_LEVELS[1]
    return (
      <span className="lt-taxonomy-badge" data-level={level}>
        {t.emoji} {t.label}
      </span>
    )
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="ge-loading">
        <div className="loading-spinner" />
        <p>Cargando objetivos…</p>
      </div>
    )
  }

  return (
    <div className="lt-page">

      {/* ── Top bar ── */}
      <div className="ge-topbar">
        <button className="ge-back-btn" onClick={() => navigate('/plans')}>
          ← Mis Guías
        </button>
        <div className="ge-topbar-info">
          <span className="ge-guide-title">🎯 Logros de Desempeño</span>
          <span className="ge-guide-dates">{school.name || 'Mi Colegio'}</span>
        </div>
        <div className="ge-save-area">
          <button className="btn-primary" onClick={openNewForm}>
            + Nuevo logro
          </button>
        </div>
      </div>

      <div className="lt-body">

        {/* ── Period overview cards ── */}
        <div className="lt-period-overview">
          {PERIODS.map(p => (
            <button
              key={p.value}
              className={`lt-period-card ${filterPeriod === String(p.value) ? 'active' : ''}`}
              onClick={() => setFilterPeriod(
                filterPeriod === String(p.value) ? 'all' : String(p.value)
              )}
            >
              <span className="lt-period-count">{periodCounts[p.value] || 0}</span>
              <span className="lt-period-label">{p.label}</span>
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="lt-filters">
          <div className="lt-filter-group">
            <label>Asignatura</label>
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
              <option value="all">Todas</option>
              {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="lt-filter-group">
            <label>Grado</label>
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
              <option value="all">Todos</option>
              {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="lt-filter-group">
            <label>Período</label>
            <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
              <option value="all">Todos</option>
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {(filterSubject !== 'all' || filterGrade !== 'all' || filterPeriod !== 'all') && (
            <button
              className="lt-clear-filters"
              onClick={() => { setFilterSubject('all'); setFilterGrade('all'); setFilterPeriod('all') }}
            >
              ✕ Limpiar filtros
            </button>
          )}
        </div>

        {/* ── Empty state ── */}
        {filteredTargets.length === 0 && (
          <div className="lt-empty">
            <div className="lt-empty-icon">🎯</div>
            <h3>
              {targets.length === 0
                ? 'Aún no tienes logros de desempeño'
                : 'Sin resultados para estos filtros'}
            </h3>
            <p>
              {targets.length === 0
                ? 'Los logros son el corazón de la planeación diferenciada. Define qué debería poder hacer el estudiante — no qué tema "cubre" la semana.'
                : 'Prueba ajustando los filtros o crea un nuevo logro.'}
            </p>
            {targets.length === 0 && (
              <button className="btn-primary" onClick={openNewForm} style={{ marginTop: '12px' }}>
                + Crear mi primer logro
              </button>
            )}
          </div>
        )}

        {/* ── Targets list ── */}
        {filteredTargets.length > 0 && (
          <div className="lt-list">
            {filteredTargets.map(t => {
              const prereqs = (t.prerequisite_ids || []).filter(id =>
                targets.some(x => x.id === id)
              )
              return (
                <div key={t.id} className={`lt-card ${!t.is_active ? 'inactive' : ''}`}>
                  <div className="lt-card-header">
                    <div className="lt-card-meta">
                      <span className="lt-meta-pill grade">{t.grade}</span>
                      {t.group_name && (
                        <span className="lt-meta-pill group">{t.group_name}</span>
                      )}
                      <span className="lt-meta-pill subject">{t.subject}</span>
                      <span className="lt-meta-pill period">P{t.period}</span>
                      <TaxonomyBadge level={t.taxonomy} />
                    </div>
                    <div className="lt-card-actions">
                      <button
                        className="lt-action-btn"
                        onClick={() => handleToggleActive(t.id, t.is_active)}
                        title={t.is_active ? 'Desactivar' : 'Activar'}
                        aria-label={t.is_active ? 'Desactivar logro' : 'Activar logro'}
                      >
                        {t.is_active ? '🟢' : '⚪'}
                      </button>
                      <button
                        className="lt-action-btn"
                        onClick={() => openEditForm(t)}
                        title="Editar"
                        aria-label="Editar logro"
                      >
                        ✏️
                      </button>
                      <button
                        className="lt-action-btn delete"
                        onClick={() => handleDelete(t.id)}
                        title="Eliminar"
                        aria-label="Eliminar logro"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <p className="lt-card-description">{t.description}</p>

                  {t.indicadores?.length > 0 && (
                    <ol style={{ margin: '6px 0 8px', paddingLeft: '20px', fontSize: '12px', color: '#555', lineHeight: 1.6 }}>
                      {t.indicadores.map((ind, i) => <li key={i}>{ind}</li>)}
                    </ol>
                  )}

                  {prereqs.length > 0 && (
                    <div className="lt-card-prereqs">
                      <span className="lt-prereq-label">Prerequisitos:</span>
                      {prereqs.map(pid => (
                        <span key={pid} className="lt-prereq-chip">
                          ↩ {getTargetLabel(pid)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Linked NEWS projects */}
                  {linkedProjects[t.id]?.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#2E5598', textTransform: 'uppercase' }}>
                        📋 Proyectos NEWS vinculados
                      </div>
                      {linkedProjects[t.id].map(p => (
                        <div key={p.id} style={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, background: '#EEF2FB', border: '1px solid #c5d5f0' }}>
                          <div style={{ fontWeight: 700, color: '#1A3A8F' }}>
                            {p.title} · {p.grade} {p.section} · P{p.period}
                          </div>
                          {p.target_indicador && (
                            <div style={{ color: '#555', marginTop: 2, lineHeight: 1.4 }}>
                              ↳ {p.target_indicador}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!t.is_active && (
                    <div className="lt-inactive-banner">
                      Logro inactivo — no aparece en el selector de guías
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showForm && (
        <div className="lt-modal-overlay">
          <div className="lt-modal" onClick={e => e.stopPropagation()}>
            <div className="lt-modal-header">
              <h3>{editingId ? '✏️ Editar logro' : '🎯 Nuevo logro de desempeño'}</h3>
              <button className="lt-modal-close" onClick={closeForm} aria-label="Cerrar formulario de logro">✕</button>
            </div>

            <div className="lt-modal-body">

              {/* Subject + Grade */}
              <div className="ge-grid-2">
                <div className="ge-field">
                  <label>Asignatura</label>
                  <select
                    value={form.subject}
                    onChange={e => updateForm('subject', e.target.value)}
                  >
                    <option value="">— Seleccionar —</option>
                    {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="ge-field">
                  <label>Grado</label>
                  <select
                    value={form.grade}
                    onChange={e => updateForm('grade', e.target.value)}
                  >
                    <option value="">— Seleccionar —</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              {/* Group + Period */}
              <div className="ge-grid-2">
                <div className="ge-field">
                  <label>Grupo <span style={{ color: '#999', fontWeight: 400 }}>(opcional — vacío = todos)</span></label>
                  <select
                    value={form.group_name}
                    onChange={e => updateForm('group_name', e.target.value)}
                  >
                    <option value="">Todos los grupos</option>
                    {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="ge-field">
                  <label>Período</label>
                  <select
                    value={form.period}
                    onChange={e => updateForm('period', Number(e.target.value))}
                  >
                    {PERIODS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="ge-field">
                <label>Desempeño observable</label>
                <textarea
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                  placeholder="El estudiante narra una experiencia pasada usando al menos 3 formas verbales correctas en un párrafo de 5 oraciones."
                  rows={3}
                  className="lt-textarea"
                />
                <span className="lt-field-hint">
                  Describe lo que el estudiante debería poder <strong>hacer</strong>, no el tema que "cubre."
                </span>
              </div>

              {/* Taxonomy level */}
              <div className="ge-field">
                <label>Nivel de desempeño</label>
                <div className="lt-taxonomy-selector">
                  {TAXONOMY_LEVELS.map(t => (
                    <button
                      key={t.value}
                      className={`lt-taxonomy-option ${form.taxonomy === t.value ? 'active' : ''}`}
                      onClick={() => updateForm('taxonomy', t.value)}
                    >
                      <span className="lt-taxonomy-emoji">{t.emoji}</span>
                      <span className="lt-taxonomy-name">{t.label}</span>
                      <span className="lt-taxonomy-desc">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Indicadores de Logro */}
              <div className="ge-field">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ margin: 0 }}>Indicadores de Logro</label>
                  <button
                    onClick={async () => {
                      if (!form.description.trim()) return
                      setGeneratingInd(true)
                      setAiIndError(null)
                      try {
                        const result = await generateIndicadores({
                          description: form.description,
                          taxonomy:    form.taxonomy,
                          subject:     form.subject,
                          grade:       form.grade,
                          principles: {
                            yearVerse:          { text: school.year_verse || '', ref: school.year_verse_ref || '' },
                            monthVerse:         { text: monthPrinciple?.month_verse || '', ref: monthPrinciple?.month_verse_ref || '' },
                            indicatorPrinciple: monthPrinciple?.indicator_principle || school.indicator_principle || '',
                          },
                        })
                        updateForm('indicadores', result)
                      } catch (e) {
                        const errorMsg = e.message || 'Error al generar indicadores'
                        setAiIndError(errorMsg)
                        showToast(errorMsg, 'error')
                      } finally {
                        setGeneratingInd(false)
                      }
                    }}
                    disabled={generatingInd || !form.description.trim()}
                    style={{
                      fontSize: '12px', padding: '4px 12px', borderRadius: '6px',
                      border: '1px solid #9BBB59', background: generatingInd ? '#f0f7e0' : '#f6fff0',
                      color: '#5a8a00', cursor: 'pointer', fontWeight: 600,
                      opacity: !form.description.trim() ? 0.5 : 1,
                    }}
                  >
                    {generatingInd ? '⏳ Generando…' : '✨ Generar con IA'}
                  </button>
                </div>
                {aiIndError && (
                  <div style={{ fontSize: '12px', color: '#c0392b', marginBottom: '8px' }}>{aiIndError}</div>
                )}
                {(form.indicadores.length === 0) && !generatingInd && (
                  <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic', marginBottom: '8px' }}>
                    Escribe el logro y el nivel taxonómico, luego haz clic en "✨ Generar con IA" o agrega indicadores manualmente.
                  </div>
                )}
                {form.indicadores.map((ind, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
                    <span style={{ minWidth: '18px', paddingTop: '7px', color: '#9BBB59', fontWeight: 700, fontSize: '13px' }}>{idx + 1}.</span>
                    <textarea
                      value={ind}
                      onChange={e => {
                        const arr = [...form.indicadores]
                        arr[idx] = e.target.value
                        updateForm('indicadores', arr)
                      }}
                      placeholder="El estudiante demuestra el logro cuando…"
                      rows={2}
                      className="lt-textarea"
                      style={{ flex: 1, resize: 'vertical' }}
                    />
                    <button
                      onClick={() => {
                        const arr = [...form.indicadores]
                        arr.splice(idx, 1)
                        updateForm('indicadores', arr)
                      }}
                      style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '16px', padding: '6px 2px' }}
                      title="Eliminar indicador"
                      aria-label={`Eliminar indicador ${idx + 1}`}
                    >✕</button>
                  </div>
                ))}
                <button
                  onClick={() => updateForm('indicadores', [...form.indicadores, ''])}
                  style={{ fontSize: '12px', color: '#9BBB59', border: '1px solid #9BBB59', background: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', marginTop: '2px' }}
                >
                  + Agregar indicador
                </button>
              </div>

              {/* Prerequisites */}
              {availablePrereqs.length > 0 && (
                <div className="ge-field">
                  <label>Prerequisitos <span style={{ color: '#999', fontWeight: 400 }}>(opcional)</span></label>
                  <span className="lt-field-hint" style={{ marginBottom: '8px', display: 'block' }}>
                    ¿Qué necesita dominar el estudiante antes de intentar este logro?
                  </span>
                  <div className="lt-prereq-list">
                    {availablePrereqs.map(t => {
                      const isSelected = (form.prerequisite_ids || []).includes(t.id)
                      return (
                        <button
                          key={t.id}
                          className={`lt-prereq-option ${isSelected ? 'selected' : ''}`}
                          onClick={() => togglePrerequisite(t.id)}
                        >
                          <span className="lt-prereq-check">{isSelected ? '☑' : '☐'}</span>
                          <span className="lt-prereq-text">
                            <strong>{t.grade} · {t.subject} · P{t.period}</strong>
                            <br />
                            {t.description.length > 80
                              ? t.description.slice(0, 80) + '…'
                              : t.description}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="lt-modal-footer">
              <button className="btn-secondary" onClick={closeForm}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || !form.description.trim() || !form.subject || !form.grade}
              >
                {saving ? '⏳ Guardando…' : editingId ? '💾 Actualizar' : '🎯 Crear logro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
