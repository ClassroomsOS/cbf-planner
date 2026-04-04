import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { generateIndicadores } from '../utils/AIAssistant'
import { useToast } from '../context/ToastContext'
import { TAXONOMY_LEVELS, ACADEMIC_PERIODS, MODELO_B_SUBJECTS } from '../utils/constants'
import './LearningTargets.css'

// ── Helpers ──────────────────────────────────────────────────────────────────
// Extracts display text from an indicator — can be a plain string (Modelo A)
// or a Modelo B object {habilidad, texto_en, texto_es, ...}
export function getIndText(ind) {
  if (!ind) return ''
  if (typeof ind === 'string') return ind
  return ind.texto_es || ind.texto_en || ''
}

// Normalizes an existing indicator to a Modelo B object shape.
// Used when switching a target to Modelo B — plain strings map to texto_es.
function toModeloBObj(ind, habilidad = '') {
  if (typeof ind === 'object' && ind !== null && ind.habilidad) {
    return { taxonomy: 'apply', ...ind }
  }
  return {
    habilidad,
    taxonomy: 'apply',
    texto_en: '',
    texto_es: typeof ind === 'string' ? ind : '',
    principio_biblico: { titulo: '', referencia: '', cita: '' },
    es_titulo: '', es_descripcion: '', es_grupo: '',
  }
}

const HABILIDADES_B = ['Speaking', 'Listening', 'Reading', 'Writing']
const HABILIDAD_ICONS = { Speaking: '🎤', Listening: '🎧', Reading: '📖', Writing: '✍️' }

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
  const [openIndicadores, setOpenIndicadores] = useState(new Set())
  const [activeTabB,      setActiveTabB]      = useState(0)
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
    trimestre: null, tematica_names: [],
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

  // Auto-init 4 Modelo B indicators when subject switches to Modelo B
  useEffect(() => {
    if (!showForm || !MODELO_B_SUBJECTS.includes(form.subject)) return
    const already4 = form.indicadores.length === 4 &&
      form.indicadores.every(i => typeof i === 'object' && i?.habilidad)
    if (already4) return
    updateForm('indicadores', HABILIDADES_B.map((h, i) => toModeloBObj(form.indicadores[i] || '', h)))
  }, [form.subject, showForm])

  // ── Form handlers ──
  function toggleIndAccordion(idx) {
    setOpenIndicadores(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  function openNewForm() {
    setForm({
      ...emptyForm,
      subject: subjectOptions[0] || '',
      grade:   gradeOptions[0]   || '',
    })
    setEditingId(null)
    setOpenIndicadores(new Set())
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
      trimestre:        target.trimestre ?? null,
      tematica_names:   target.tematica_names || [],
    })
    setEditingId(target.id)
    setAiIndError(null)
    setOpenIndicadores(new Set(target.indicadores?.map((_, i) => i) || []))
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setAiIndError(null)
    setForm(emptyForm)
    setOpenIndicadores(new Set())
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
      trimestre:        form.trimestre ?? null,
      tematica_names:   form.tematica_names,
      news_model:       MODELO_B_SUBJECTS.includes(form.subject) ? 'language' : 'standard',
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
    if (!window.confirm('¿Eliminar este logro del trimestre?')) return
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
            + Nuevo logro del trimestre
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
                ? 'Aún no tienes logros del trimestre'
                : 'Sin resultados para estos filtros'}
            </h3>
            <p>
              {targets.length === 0
                ? 'El logro del trimestre es la meta macro: verbo cognitivo + contenido + condición + dimensión valorativa. Define qué puede hacer el estudiante, no qué tema "cubre" la semana.'
                : 'Prueba ajustando los filtros o crea un nuevo logro.'}
            </p>
            {targets.length === 0 && (
              <button className="btn-primary" onClick={openNewForm} style={{ marginTop: '12px' }}>
                + Crear mi primer logro del trimestre
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
                      {t.indicadores.map((ind, i) => (
                        <li key={i}>
                          {t.tematica_names?.[i] && (
                            <span style={{ fontWeight: 600, color: '#2E5598', marginRight: 4 }}>
                              {t.tematica_names[i]}:
                            </span>
                          )}
                          {typeof ind === 'object' && ind?.habilidad && (
                            <span style={{ fontWeight: 600, color: '#8064A2', marginRight: 4 }}>
                              {HABILIDAD_ICONS[ind.habilidad]} {ind.habilidad}:
                            </span>
                          )}
                          {getIndText(ind)}
                        </li>
                      ))}
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
              <div>
                <span className="lt-modal-type-tag">🎯 Logro de Desempeño</span>
                <h3>{editingId ? 'Editar logro del trimestre' : 'Nuevo logro del trimestre'}</h3>
              </div>
              <button className="lt-modal-close" onClick={closeForm} aria-label="Cerrar formulario de logro">✕</button>
            </div>

            <div className="lt-modal-body">

              {/* ── LEFT PANEL: Contexto (fijo) ── */}
              <div className="lt-modal-left">

                {/* Asignatura + Grado */}
                <div>
                  <p className="lt-context-label">Contexto</p>
                  <div className="ge-field" style={{ marginBottom: 10 }}>
                    <label>Asignatura</label>
                    <select value={form.subject} onChange={e => updateForm('subject', e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="ge-field" style={{ marginBottom: 10 }}>
                    <label>Grado</label>
                    <select value={form.grade} onChange={e => updateForm('grade', e.target.value)}>
                      <option value="">— Seleccionar —</option>
                      {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <div className="ge-field">
                      <label>Grupo</label>
                      <select value={form.group_name} onChange={e => updateForm('group_name', e.target.value)}>
                        <option value="">Todos</option>
                        {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="ge-field">
                      <label>Período</label>
                      <select value={form.period} onChange={e => updateForm('period', Number(e.target.value))}>
                        {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Completion tracker */}
                <div className="lt-completion-row">
                  <p className="lt-context-label" style={{ marginBottom: 6 }}>Completitud</p>
                  <div className="lt-completion-item">
                    <span className={`lt-completion-dot ${form.subject && form.grade ? 'done' : ''}`} />
                    Contexto
                  </div>
                  <div className="lt-completion-item">
                    <span className={`lt-completion-dot ${form.description.trim() ? 'done' : ''}`} />
                    Logro escrito
                  </div>
                  <div className="lt-completion-item">
                    <span className={`lt-completion-dot ${form.indicadores.length > 0 ? 'done' : ''}`} />
                    {form.indicadores.length > 0
                      ? `${form.indicadores.length} indicador${form.indicadores.length > 1 ? 'es' : ''}`
                      : 'Indicadores'}
                  </div>
                </div>

              </div>

              {/* ── RIGHT PANEL: Contenido (scrollable) ── */}
              <div className="lt-modal-right">

                {/* ── Taxonomy sticky banner (Modelo A only) ── */}
                {!MODELO_B_SUBJECTS.includes(form.subject) && <div className="lt-tax-banner">
                  <div className="lt-tax-banner-label">Nivel Taxonómico</div>
                  <div className="lt-tax-banner-pills">
                    {TAXONOMY_LEVELS.map(t => (
                      <button key={t.value}
                        className={`lt-tax-pill ${form.taxonomy === t.value ? 'active' : ''}`}
                        data-level={t.value}
                        onClick={() => updateForm('taxonomy', t.value)}>
                        <span className="lt-tax-pill-emoji">{t.emoji}</span>
                        <span className="lt-tax-pill-text">
                          <span className="lt-tax-pill-name">{t.label}</span>
                          <span className="lt-tax-pill-desc">{t.desc}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>}

                {/* ── Logro del Período (Modelo A only) ── */}
                {!MODELO_B_SUBJECTS.includes(form.subject) && (
                  <div className="ge-field" style={{ marginTop: 4 }}>
                    <label>Logro del Período</label>
                    <textarea
                      value={form.description}
                      onChange={e => updateForm('description', e.target.value)}
                      placeholder="El estudiante narra una experiencia pasada usando al menos 3 formas verbales correctas en un párrafo de 5 oraciones."
                      rows={4}
                      className="lt-textarea"
                    />
                    <span className="lt-field-hint">
                      Anatomía: <strong>verbo cognitivo</strong> + contenido específico + condición de desempeño + dimensión valorativa.<br />
                      Describe lo que el estudiante debería poder <strong>hacer</strong>, no el tema que "cubre."
                    </span>
                  </div>
                )}

                {/* ── Indicadores ── */}

                {/* MODELO B: pestañas fijas por habilidad */}
                {MODELO_B_SUBJECTS.includes(form.subject) && (
                  <div className="lt-skill-tabs-wrap">
                    <div className="lt-skill-tabs-hdr">
                      {HABILIDADES_B.map((h, i) => {
                        const obj = form.indicadores[i] || {}
                        const hasContent = obj.texto_en || obj.texto_es
                        return (
                          <button key={h}
                            data-skill={h}
                            className={`lt-skill-tab ${activeTabB === i ? 'active' : ''}`}
                            onClick={() => setActiveTabB(i)}>
                            <span>{HABILIDAD_ICONS[h]}</span>
                            <span>{h}</span>
                            {hasContent && <span className="lt-skill-tab-dot" />}
                          </button>
                        )
                      })}
                    </div>

                    {HABILIDADES_B.map((h, i) => {
                      if (activeTabB !== i) return null
                      const obj = form.indicadores[i] || toModeloBObj('', h)
                      const updateObjField = (field, value) => {
                        const arr = [...form.indicadores]
                        arr[i] = { ...obj, [field]: value }
                        updateForm('indicadores', arr)
                      }
                      const updatePrinciple = (field, value) => {
                        const arr = [...form.indicadores]
                        arr[i] = { ...obj, principio_biblico: { ...obj.principio_biblico, [field]: value } }
                        updateForm('indicadores', arr)
                      }
                      return (
                        <div key={h} className="lt-skill-tab-body">

                          {/* Taxonomía por habilidad */}
                          <div className="lt-skill-taxonomy">
                            <div className="lt-skill-taxonomy-label">¿Nivel taxonómico de este indicador?</div>
                            <div className="lt-tax-banner-pills">
                              {TAXONOMY_LEVELS.map(t => (
                                <button key={t.value}
                                  className={`lt-tax-pill ${(obj.taxonomy || 'apply') === t.value ? 'active' : ''}`}
                                  data-level={t.value}
                                  onClick={() => updateObjField('taxonomy', t.value)}>
                                  <span className="lt-tax-pill-emoji">{t.emoji}</span>
                                  <span className="lt-tax-pill-text">
                                    <span className="lt-tax-pill-name">{t.label}</span>
                                    <span className="lt-tax-pill-desc">{t.desc}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Indicador EN */}
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, color: '#888', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>EN — Indicador en inglés</div>
                            <textarea value={obj.texto_en} onChange={e => updateObjField('texto_en', e.target.value)}
                              placeholder="The student presents information clearly using appropriate vocabulary..."
                              rows={3} className="lt-textarea" style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: 13 }} />
                          </div>

                          {/* Indicador ES */}
                          <div style={{ marginBottom: 14 }}>
                            <div style={{ fontSize: 10, color: '#888', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.3px' }}>ES — Traducción al español</div>
                            <textarea value={obj.texto_es} onChange={e => updateObjField('texto_es', e.target.value)}
                              placeholder="El estudiante presenta información claramente usando vocabulario apropiado..."
                              rows={2} className="lt-textarea" style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: 13 }} />
                          </div>

                          {/* Principio bíblico */}
                          <div style={{ padding: '10px 12px', borderRadius: 8, background: '#EEF2FB', border: '1px solid #c5d5f0', marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#1A3A8F', marginBottom: 8 }}>✝️ Principio Bíblico del Indicador</div>
                            <input type="text" value={obj.principio_biblico?.titulo || ''} onChange={e => updatePrinciple('titulo', e.target.value)}
                              placeholder="Título temático (ej: God's plan: A dream worth waiting for!)"
                              className="lt-textarea" style={{ marginBottom: 6, padding: '6px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6 }}>
                              <input type="text" value={obj.principio_biblico?.referencia || ''} onChange={e => updatePrinciple('referencia', e.target.value)}
                                placeholder="Génesis 50:20 (NIV)" className="lt-textarea" style={{ padding: '6px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                              <input type="text" value={obj.principio_biblico?.cita || ''} onChange={e => updatePrinciple('cita', e.target.value)}
                                placeholder="You intended to harm me, but God intended it for good..."
                                className="lt-textarea" style={{ padding: '6px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                            </div>
                          </div>

                          {/* Experiencia Significativa Embebida */}
                          <div style={{ padding: '10px 12px', borderRadius: 8, background: '#FFF9E6', border: '1px solid #F5C300' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#8B6914', marginBottom: 8 }}>📋 Experiencia Significativa Embebida</div>
                            <input type="text" value={obj.es_titulo || ''} onChange={e => updateObjField('es_titulo', e.target.value)}
                              placeholder="Título del proyecto ES (ej: How do my dreams line up with God's plan?)"
                              className="lt-textarea" style={{ marginBottom: 6, padding: '6px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                              <input type="text" value={obj.es_descripcion || ''} onChange={e => updateObjField('es_descripcion', e.target.value)}
                                placeholder="Descripción (ej: Vision Board — hablar de sueños...)"
                                className="lt-textarea" style={{ padding: '6px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                              <input type="text" value={obj.es_grupo || ''} onChange={e => updateObjField('es_grupo', e.target.value)}
                                placeholder="Grupo (ej: 2 estudiantes)"
                                className="lt-textarea" style={{ padding: '6px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box' }} />
                            </div>
                          </div>

                        </div>
                      )
                    })}
                  </div>
                )}

                {/* MODELO A: acordeones */}
                {!MODELO_B_SUBJECTS.includes(form.subject) && <div className="lt-ind-section">
                  <div className="lt-ind-section-hdr">
                    <span className="lt-ind-section-title">
                      Temáticas e Indicadores
                      {form.indicadores.length > 0 && (
                        <span className="lt-ind-count">{form.indicadores.length}</span>
                      )}
                    </span>
                    <button
                      className="lt-ind-ai-btn"
                      onClick={async () => {
                        if (!form.description.trim()) return
                        setGeneratingInd(true)
                        setAiIndError(null)
                        try {
                          const isB = MODELO_B_SUBJECTS.includes(form.subject)
                          const result = await generateIndicadores({
                            description:   form.description,
                            taxonomy:      form.taxonomy,
                            subject:       form.subject,
                            grade:         form.grade,
                            tematicaNames: form.tematica_names,
                            isModeloB:     isB,
                            principles: {
                              yearVerse:          { text: school.year_verse || '', ref: school.year_verse_ref || '' },
                              monthVerse:         { text: monthPrinciple?.month_verse || '', ref: monthPrinciple?.month_verse_ref || '' },
                              indicatorPrinciple: monthPrinciple?.indicator_principle || school.indicator_principle || '',
                            },
                          })
                          updateForm('indicadores', result)
                          if (isB && Array.isArray(result) && result[0]?.habilidad) {
                            updateForm('tematica_names', result.map(r => r.habilidad || ''))
                          }
                          setOpenIndicadores(new Set(result.map((_, i) => i)))
                        } catch (e) {
                          const errorMsg = e.message || 'Error al generar indicadores'
                          setAiIndError(errorMsg)
                          showToast(errorMsg, 'error')
                        } finally {
                          setGeneratingInd(false)
                        }
                      }}
                      disabled={generatingInd || !form.description.trim()}
                    >
                      {generatingInd ? '⏳ Generando…' : '✨ Generar con IA'}
                    </button>
                  </div>

                  {aiIndError && (
                    <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 8 }}>{aiIndError}</div>
                  )}
                  {form.indicadores.length === 0 && !generatingInd && (
                    <div className="lt-ind-empty">
                      Escribe el logro y presiona <strong>✨ Generar con IA</strong><br />o agrega manualmente.
                    </div>
                  )}

                  {form.indicadores.map((ind, idx) => {
                    const isB = MODELO_B_SUBJECTS.includes(form.subject)
                    const obj = isB ? (typeof ind === 'object' && ind?.habilidad ? ind : toModeloBObj(ind, HABILIDADES_B[idx] || '')) : null
                    const isOpen = openIndicadores.has(idx)
                    const titleLabel = isB
                      ? `${HABILIDAD_ICONS[obj?.habilidad || ''] || '📌'} ${obj?.habilidad || `Habilidad ${idx + 1}`}`
                      : `${idx + 1}. ${form.tematica_names[idx] || `Temática ${idx + 1}`}`
                    const previewText = isB
                      ? (obj?.texto_en || obj?.texto_es || '')
                      : (typeof ind === 'string' ? ind : getIndText(ind))

                    const updateObjField = (field, value) => {
                      const arr = [...form.indicadores]
                      arr[idx] = { ...obj, [field]: value }
                      updateForm('indicadores', arr)
                    }
                    const updatePrinciple = (field, value) => {
                      const arr = [...form.indicadores]
                      arr[idx] = { ...obj, principio_biblico: { ...obj.principio_biblico, [field]: value } }
                      updateForm('indicadores', arr)
                    }

                    return (
                      <div key={idx} className={`lt-ind-acc ${isOpen ? 'open' : ''} ${isB ? 'modelo-b' : 'modelo-a'}`}>
                        {/* Accordion header */}
                        <button className="lt-ind-acc-hdr" onClick={() => toggleIndAccordion(idx)}>
                          <span className="lt-ind-acc-arrow">{isOpen ? '▾' : '▸'}</span>
                          <span className="lt-ind-acc-title">{titleLabel}</span>
                          {!isOpen && previewText && (
                            <span className="lt-ind-acc-preview">
                              {previewText.length > 55 ? previewText.slice(0, 53) + '…' : previewText}
                            </span>
                          )}
                          <span
                            role="button"
                            tabIndex={0}
                            className="lt-ind-acc-del"
                            onClick={e => {
                              e.stopPropagation()
                              const inds = [...form.indicadores]
                              const tems = [...form.tematica_names]
                              inds.splice(idx, 1)
                              tems.splice(idx, 1)
                              updateForm('indicadores', inds)
                              updateForm('tematica_names', tems)
                              setOpenIndicadores(prev => {
                                const next = new Set()
                                prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1) })
                                return next
                              })
                            }}
                            onKeyDown={e => e.key === 'Enter' && e.currentTarget.click()}
                            aria-label={`Eliminar indicador ${idx + 1}`}
                          >✕</span>
                        </button>

                        {/* Accordion body */}
                        <div className="lt-ind-acc-body">
                          <div className="lt-ind-acc-inner">

                            {!isB && (
                              <>
                                <input
                                  type="text"
                                  value={form.tematica_names[idx] || ''}
                                  onChange={e => {
                                    const tems = [...form.tematica_names]
                                    tems[idx] = e.target.value
                                    updateForm('tematica_names', tems)
                                  }}
                                  placeholder="Nombre de la Temática (ej: Texto instructivo: receta)"
                                  className="lt-textarea"
                                  style={{ marginBottom: 8, padding: '6px 10px', fontStyle: 'italic', fontSize: 12, color: '#555', width: '100%', boxSizing: 'border-box' }}
                                />
                                <textarea
                                  value={typeof ind === 'string' ? ind : getIndText(ind)}
                                  onChange={e => {
                                    const arr = [...form.indicadores]
                                    arr[idx] = e.target.value
                                    updateForm('indicadores', arr)
                                  }}
                                  placeholder="El estudiante demuestra el logro cuando…"
                                  rows={2}
                                  className="lt-textarea"
                                  style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
                                />
                              </>
                            )}

                            {isB && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {HABILIDADES_B.map(h => (
                                    <button key={h} type="button" onClick={() => updateObjField('habilidad', h)}
                                      style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer', border: obj.habilidad === h ? '2px solid #8064A2' : '1px solid #d6c9f0', background: obj.habilidad === h ? '#8064A2' : '#fff', color: obj.habilidad === h ? '#fff' : '#8064A2', fontWeight: obj.habilidad === h ? 700 : 400 }}>
                                      {HABILIDAD_ICONS[h]} {h}
                                    </button>
                                  ))}
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>EN — Enunciado en inglés</div>
                                  <textarea value={obj.texto_en} onChange={e => updateObjField('texto_en', e.target.value)} placeholder="The student presents information clearly..." rows={2} className="lt-textarea" style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: 12 }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>ES — Traducción al español</div>
                                  <textarea value={obj.texto_es} onChange={e => updateObjField('texto_es', e.target.value)} placeholder="El estudiante presenta información claramente..." rows={2} className="lt-textarea" style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box', fontSize: 12 }} />
                                </div>
                                <div style={{ padding: '8px 10px', borderRadius: 6, background: '#EEF2FB', border: '1px solid #c5d5f0' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#1A3A8F', marginBottom: 6 }}>✝️ PRINCIPIO BÍBLICO DEL INDICADOR</div>
                                  <input type="text" value={obj.principio_biblico?.titulo || ''} onChange={e => updatePrinciple('titulo', e.target.value)} placeholder="Título temático (ej: God's plan: A dream worth waiting for!)" className="lt-textarea" style={{ marginBottom: 5, padding: '5px 8px', fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 6 }}>
                                    <input type="text" value={obj.principio_biblico?.referencia || ''} onChange={e => updatePrinciple('referencia', e.target.value)} placeholder="Génesis 50:20 (NIV)" className="lt-textarea" style={{ padding: '5px 8px', fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                                    <input type="text" value={obj.principio_biblico?.cita || ''} onChange={e => updatePrinciple('cita', e.target.value)} placeholder="You intended to harm me, but God intended it for good..." className="lt-textarea" style={{ padding: '5px 8px', fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                                  </div>
                                </div>
                                <div style={{ padding: '8px 10px', borderRadius: 6, background: '#FFF9E6', border: '1px solid #F5C300' }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: '#8B6914', marginBottom: 6 }}>📋 EXPERIENCIA SIGNIFICATIVA EMBEBIDA</div>
                                  <input type="text" value={obj.es_titulo || ''} onChange={e => updateObjField('es_titulo', e.target.value)} placeholder="Título del proyecto ES (ej: How do my dreams line up with God's plan?)" className="lt-textarea" style={{ marginBottom: 5, padding: '5px 8px', fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 6 }}>
                                    <input type="text" value={obj.es_descripcion || ''} onChange={e => updateObjField('es_descripcion', e.target.value)} placeholder="Descripción (ej: Vision Board — hablar de sueños...)" className="lt-textarea" style={{ padding: '5px 8px', fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                                    <input type="text" value={obj.es_grupo || ''} onChange={e => updateObjField('es_grupo', e.target.value)} placeholder="Grupo (ej: 2 estudiantes)" className="lt-textarea" style={{ padding: '5px 8px', fontSize: 11, width: '100%', boxSizing: 'border-box' }} />
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      </div>
                    )
                  })}

                  <button
                    className="lt-ind-add-btn"
                    onClick={() => {
                      const isB = MODELO_B_SUBJECTS.includes(form.subject)
                      const nextHabilidad = HABILIDADES_B[form.indicadores.length] || ''
                      const newInd = isB ? toModeloBObj('', nextHabilidad) : ''
                      updateForm('indicadores', [...form.indicadores, newInd])
                      updateForm('tematica_names', [...form.tematica_names, ''])
                      setOpenIndicadores(prev => new Set([...prev, form.indicadores.length]))
                    }}
                  >
                    + Agregar {MODELO_B_SUBJECTS.includes(form.subject) ? 'habilidad' : 'temática / indicador'}
                  </button>
                </div>}

                {/* ── Prerequisitos ── */}
                {availablePrereqs.length > 0 && (
                  <>
                    <div style={{ borderTop: '1px dashed #e4eaf4', margin: '4px 0' }} />
                    <div className="ge-field">
                      <label>Prerequisitos <span style={{ color: '#999', fontWeight: 400 }}>(opcional)</span></label>
                      <span className="lt-field-hint" style={{ marginBottom: 8, display: 'block' }}>
                        ¿Qué necesita dominar el estudiante antes de intentar este logro?
                      </span>
                      <div className="lt-prereq-list">
                        {availablePrereqs.map(t => {
                          const isSelected = (form.prerequisite_ids || []).includes(t.id)
                          return (
                            <button key={t.id} className={`lt-prereq-option ${isSelected ? 'selected' : ''}`} onClick={() => togglePrerequisite(t.id)}>
                              <span className="lt-prereq-check">{isSelected ? '☑' : '☐'}</span>
                              <span className="lt-prereq-text">
                                <strong>{t.grade} · {t.subject} · P{t.period}</strong>
                                <br />
                                {t.description.length > 80 ? t.description.slice(0, 80) + '…' : t.description}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}

              </div>{/* end right panel */}
            </div>

            <div className="lt-modal-footer">
              <button className="btn-secondary" onClick={closeForm}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || (!MODELO_B_SUBJECTS.includes(form.subject) && !form.description.trim()) || !form.subject || !form.grade}
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
