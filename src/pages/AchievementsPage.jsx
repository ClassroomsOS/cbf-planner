import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../supabase'
import useAchievements from '../hooks/useAchievements'
import { useToast } from '../context/ToastContext'
import { combinedGrade } from '../utils/constants'

// ── Constants ─────────────────────────────────────────────────────────────────

const DIMENSIONS = [
  { value: 'cognitive',    label: 'Cognitivo',      icon: '\u{1F9E0}', color: '#2E5598', bg: '#eef3ff' },
  { value: 'procedural',   label: 'Procedimental',  icon: '\u{2692}\uFE0F', color: '#4BACC6', bg: '#e8f7fb' },
  { value: 'attitudinal',  label: 'Actitudinal',    icon: '\u{2764}\uFE0F', color: '#C0504D', bg: '#fff0f0' },
]

const SKILL_AREAS = [
  { value: 'speaking',   label: 'Speaking',   icon: '\u{1F5E3}\uFE0F', color: '#8064A2' },
  { value: 'listening',  label: 'Listening',  icon: '\u{1F442}', color: '#4BACC6' },
  { value: 'reading',    label: 'Reading',    icon: '\u{1F4D6}', color: '#2E5598' },
  { value: 'writing',    label: 'Writing',    icon: '\u{270D}\uFE0F', color: '#4a7c1f' },
  { value: 'general',    label: 'General',    icon: '\u{1F4CB}', color: '#888'    },
]

const BLOOM_LEVELS = [
  { value: 'remember',   label: 'Recordar' },
  { value: 'understand', label: 'Comprender' },
  { value: 'apply',      label: 'Aplicar' },
  { value: 'analyze',    label: 'Analizar' },
  { value: 'evaluate',   label: 'Evaluar' },
  { value: 'create',     label: 'Crear' },
]

const BLOOM_COLORS = {
  remember:   { bg: '#f5f5f5', color: '#666' },
  understand: { bg: '#fff3e8', color: '#b8690b' },
  apply:      { bg: '#eef3ff', color: '#2E5598' },
  analyze:    { bg: '#e8f7fb', color: '#4BACC6' },
  evaluate:   { bg: '#fff0f0', color: '#C0504D' },
  create:     { bg: '#eef7e0', color: '#4a7c1f' },
}

function dimInfo(d) {
  return DIMENSIONS.find(x => x.value === d) || DIMENSIONS[0]
}

const CURRENT_YEAR = new Date().getFullYear()

// ── Empty form factories ──────────────────────────────────────────────────────

function emptyGoal() {
  return {
    subject: '', grade: '', period: 1, academic_year: CURRENT_YEAR,
    text: '', verb: '', bloom_level: 'apply', status: 'draft',
  }
}

function emptyIndicator(goalId) {
  return {
    goal_id: goalId, dimension: 'cognitive', text: '',
    student_text: '', bloom_level: '', weight: '',
  }
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color }) {
  return (
    <div className="ach-stat">
      <span className="ach-stat-icon" style={{ background: color + '22', color }}>{icon}</span>
      <div className="ach-stat-value">{value}</div>
      <div className="ach-stat-label">{label}</div>
    </div>
  )
}

// ── Weight Bar ────────────────────────────────────────────────────────────────

function WeightBar({ indicators }) {
  const total = (indicators || []).reduce((s, i) => s + (parseFloat(i.weight) || 0), 0)
  const color = total === 100 ? '#4a7c1f' : total > 100 ? '#c33' : '#C9A84C'
  const label = total === 100 ? 'Peso total correcto' : total > 100 ? `Excede por ${total - 100}%` : `Faltan ${100 - total}%`
  const pct = Math.min(total, 110)

  return (
    <div className="ach-weight-bar">
      <div className="ach-weight-track">
        <div className="ach-weight-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
      <span className="ach-weight-label" style={{ color }}>{total}% — {label}</span>
    </div>
  )
}

// ── Completeness Checklist ────────────────────────────────────────────────────

function CompletenessChecklist({ goal, connections }) {
  const inds = goal.indicators || []
  const hasCog = inds.some(i => i.dimension === 'cognitive')
  const hasProc = inds.some(i => i.dimension === 'procedural')
  const hasAtt = inds.some(i => i.dimension === 'attitudinal')
  const weightTotal = inds.reduce((s, i) => s + (parseFloat(i.weight) || 0), 0)
  const weightOk = weightTotal === 100
  const hasNews = (connections?.news?.length || 0) > 0

  const items = [
    { ok: hasCog,    label: 'Indicador cognitivo' },
    { ok: hasProc,   label: 'Indicador procedimental' },
    { ok: hasAtt,    label: 'Indicador actitudinal' },
    { ok: weightOk,  label: 'Peso total = 100%' },
    { ok: hasNews,   label: 'NEWS vinculado' },
  ]
  const done = items.filter(i => i.ok).length

  return (
    <div className="ach-completeness">
      <div className="ach-completeness-header">
        <span className="ach-completeness-title">Completitud</span>
        <span className="ach-completeness-count" style={{ color: done === 5 ? '#4a7c1f' : '#C9A84C' }}>
          {done}/5
        </span>
      </div>
      {items.map((item, i) => (
        <div key={i} className="ach-completeness-item">
          <span style={{ color: item.ok ? '#4a7c1f' : '#ccc', fontSize: 13 }}>
            {item.ok ? '\u2705' : '\u2B1C'}
          </span>
          <span style={{ color: item.ok ? '#555' : '#aaa', fontSize: 12 }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Cascade Panel ─────────────────────────────────────────────────────────────

function CascadePanel({ connections, loading: connLoading }) {
  if (connLoading) return <div className="ach-cascade" style={{ color: '#aaa', fontSize: 12 }}>Cargando conexiones...</div>
  if (!connections) return null

  const { news = [], guides = 0, checkpoints = [] } = connections
  const evaluated = new Set(checkpoints.map(c => c.indicator_id)).size

  return (
    <div className="ach-cascade">
      <div className="ach-cascade-title">{'\u{1F4E1}'} Cascada Pedagógica</div>
      <div className="ach-cascade-items">
        <div className="ach-cascade-item">
          <span className="ach-cascade-icon" style={{ background: '#eef7e0' }}>{'\u{1F4F0}'}</span>
          <div>
            <div className="ach-cascade-count">{news.length} NEWS</div>
            {news.length > 0 && (
              <div className="ach-cascade-detail">
                {news.map(n => (
                  <span key={n.id} className="ach-cascade-chip" style={{
                    background: n.status === 'published' ? '#eef7e0' : '#f5f5f5',
                    color: n.status === 'published' ? '#4a7c1f' : '#888',
                  }}>
                    {n.title?.substring(0, 30) || 'Sin título'}
                    {n.skill && <span className="ach-cascade-skill">{n.skill}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="ach-cascade-item">
          <span className="ach-cascade-icon" style={{ background: '#eef3ff' }}>{'\u{1F4DD}'}</span>
          <div>
            <div className="ach-cascade-count">{guides} {guides === 1 ? 'Guía' : 'Guías'}</div>
          </div>
        </div>
        <div className="ach-cascade-item">
          <span className="ach-cascade-icon" style={{ background: evaluated > 0 ? '#eef7e0' : '#fff3e8' }}>
            {evaluated > 0 ? '\u2705' : '\u{23F3}'}
          </span>
          <div>
            <div className="ach-cascade-count">{evaluated} evaluados</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Goal Form Modal ────────────────────────────────────────────────────────────

function GoalFormModal({ goal, assignments, yearVerse, onSave, onClose }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(() => {
    const base = goal || emptyGoal()
    return { ...base, year_verse: base.year_verse || yearVerse || '' }
  })
  const [saving, setSaving] = useState(false)

  const uniqueSubjects = [...new Set(assignments.map(a => a.subject))].sort()
  const grades = assignments
    .filter(a => !form.subject || a.subject === form.subject)
    .map(a => combinedGrade(a))
  const uniqueGrades = [...new Set(grades)].sort()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.text.trim())    { showToast('El logro no puede estar vacío.', 'warning'); return }
    if (!form.subject.trim()) { showToast('Selecciona una asignatura.', 'warning'); return }
    if (!form.grade.trim())   { showToast('Selecciona un grado.', 'warning'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="ach-modal-overlay">
      <div className="ach-modal">
        {/* Header with navy gradient */}
        <div className="ach-modal-header">
          <div>
            <span className="ach-modal-type-tag">Logro de Desempeño</span>
            <h3 className="ach-modal-title">
              {goal?.id ? 'Editar Logro' : 'Nuevo Logro de Período'}
            </h3>
          </div>
          <button onClick={onClose} className="ach-modal-close">{'\u2715'}</button>
        </div>

        {/* Body */}
        <div className="ach-modal-body">
          {/* Row: Subject + Grade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="ach-field">
              Asignatura
              <select value={form.subject} onChange={e => set('subject', e.target.value)}>
                <option value="">Seleccionar...</option>
                {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="ach-field">
              Grado
              <select value={form.grade} onChange={e => set('grade', e.target.value)}>
                <option value="">Seleccionar...</option>
                {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
          </div>

          {/* Row: Period + Bloom */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="ach-field">
              Período
              <select value={form.period} onChange={e => set('period', +e.target.value)}>
                {[1, 2, 3, 4].map(p => <option key={p} value={p}>{p}.° Período</option>)}
              </select>
            </label>
            <label className="ach-field">
              Nivel Bloom
              <select value={form.bloom_level} onChange={e => set('bloom_level', e.target.value)}>
                <option value="">Sin especificar</option>
                {BLOOM_LEVELS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </label>
          </div>

          {/* Verb */}
          <label className="ach-field">
            Verbo rector (opcional)
            <input value={form.verb} onChange={e => set('verb', e.target.value)}
              placeholder="ej. Produce, Analiza, Demuestra..." />
          </label>

          {/* Goal text */}
          <label className="ach-field">
            Enunciado del logro
            <span className="ach-field-hint">
              Estructura: verbo Bloom + contenido + condición de desempeño
            </span>
            <textarea value={form.text} onChange={e => set('text', e.target.value)}
              rows={4} placeholder="ej. Produce textos narrativos en pasado simple que evidencien comprensión de eventos reales usando el libro de texto como modelo..." />
          </label>

          {/* Year verse (auto-loaded) */}
          <label className="ach-field">
            Versículo del año
            <span className="ach-field-hint">Se carga automáticamente de la configuración institucional</span>
            <input value={form.year_verse || ''} onChange={e => set('year_verse', e.target.value)}
              placeholder="ej. Génesis 1:27-28a (TLA)" />
          </label>
        </div>

        {/* Footer */}
        <div className="ach-modal-footer">
          <button onClick={onClose} className="ach-btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="ach-btn-primary"
            style={{ background: saving ? '#aaa' : undefined }}>
            {saving ? 'Guardando...' : 'Guardar Logro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Indicator Form Modal ──────────────────────────────────────────────────────

function IndicatorFormModal({ indicator, goalId, goalContext, onSave, onClose }) {
  const { showToast } = useToast()
  const [form, setForm] = useState(indicator || emptyIndicator(goalId))
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.text.trim()) { showToast('El indicador no puede estar vacío.', 'warning'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const dim = dimInfo(form.dimension)

  return (
    <div className="ach-modal-overlay" style={{ zIndex: 1001 }}>
      <div className="ach-modal" style={{ maxWidth: 520 }}>
        {/* Header with dimension-colored gradient */}
        <div className="ach-modal-header" style={{
          background: `linear-gradient(135deg, ${dim.color}, ${dim.color}cc)`,
        }}>
          <div>
            {goalContext && (
              <span className="ach-modal-type-tag" style={{ background: 'rgba(255,255,255,.25)' }}>
                {goalContext.subject} · {goalContext.grade} · P{goalContext.period}
              </span>
            )}
            <h3 className="ach-modal-title">
              {indicator?.id ? 'Editar Indicador' : 'Nuevo Indicador de Logro'}
            </h3>
          </div>
          <button onClick={onClose} className="ach-modal-close">{'\u2715'}</button>
        </div>

        <div className="ach-modal-body">
          {/* Dimension selector */}
          <div>
            <div className="ach-field-label">Dimensión</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIMENSIONS.map(d => (
                <button key={d.value} type="button"
                  onClick={() => set('dimension', d.value)}
                  className="ach-dim-btn"
                  style={{
                    flex: 1,
                    border: form.dimension === d.value ? `2px solid ${d.color}` : '2px solid #e0e6f0',
                    background: form.dimension === d.value ? d.bg : '#fff',
                  }}>
                  <span style={{ fontSize: 20 }}>{d.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: form.dimension === d.value ? d.color : '#888' }}>
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Skill area */}
          <div>
            <div className="ach-field-label">
              Habilidad comunicativa
              <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6 }}>
                (opcional — solo para materias de idioma)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button key="none" type="button"
                onClick={() => set('skill_area', null)}
                className="ach-skill-btn"
                style={{
                  border: !form.skill_area ? '2px solid #888' : '2px solid #e0e6f0',
                  background: !form.skill_area ? '#f5f5f5' : '#fff',
                  color: !form.skill_area ? '#555' : '#aaa',
                }}>
                Sin habilidad
              </button>
              {SKILL_AREAS.map(s => (
                <button key={s.value} type="button"
                  onClick={() => set('skill_area', s.value)}
                  className="ach-skill-btn"
                  style={{
                    border: form.skill_area === s.value ? `2px solid ${s.color}` : '2px solid #e0e6f0',
                    background: form.skill_area === s.value ? s.color + '18' : '#fff',
                    color: form.skill_area === s.value ? s.color : '#888',
                  }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Indicator text */}
          <label className="ach-field">
            Texto del indicador (versión docente)
            <textarea value={form.text} onChange={e => set('text', e.target.value)}
              rows={3} placeholder="ej. Reconoce y aplica el pasado simple en contextos narrativos escritos..."
              style={{ borderColor: dim.color + '40' }} />
          </label>

          {/* Student text */}
          <label className="ach-field">
            Texto versión estudiante (lenguaje A2)
            <span className="ach-field-hint">Lenguaje simple que el estudiante entiende desde el primer día</span>
            <textarea value={form.student_text || ''} onChange={e => set('student_text', e.target.value)}
              rows={2} placeholder="ej. I can write a short story using past tense verbs correctly..." />
          </label>

          {/* Weight */}
          <label className="ach-field">
            Peso en la nota del período (%)
            <input type="number" min="0" max="100" step="5"
              value={form.weight || ''} onChange={e => set('weight', e.target.value)}
              placeholder="ej. 30" style={{ width: 100 }} />
          </label>
        </div>

        <div className="ach-modal-footer">
          <button onClick={onClose} className="ach-btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="ach-btn-primary"
            style={{ background: saving ? '#aaa' : dim.color }}>
            {saving ? 'Guardando...' : 'Guardar Indicador'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal, availableSections, connections, connectionsLoading,
  onEdit, onDelete, onPublish, onNewIndicator, onEditIndicator, onDeleteIndicator,
  onDuplicate, duplicatingTarget,
}) {
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const indicators = goal.indicators || []
  const bloom = BLOOM_COLORS[goal.bloom_level] || BLOOM_COLORS.apply
  const isPublished = goal.status === 'published'

  // Completeness: has all 3 dimensions + weight=100 + has NEWS
  const hasCog = indicators.some(i => i.dimension === 'cognitive')
  const hasProc = indicators.some(i => i.dimension === 'procedural')
  const hasAtt = indicators.some(i => i.dimension === 'attitudinal')
  const weightTotal = indicators.reduce((s, i) => s + (parseFloat(i.weight) || 0), 0)
  const isComplete = hasCog && hasProc && hasAtt && weightTotal === 100

  // Border color: published=green, complete=blue, draft=gray
  const borderColor = isPublished ? '#4a7c1f' : isComplete ? '#2E5598' : '#d0d8e8'

  // Group indicators by dimension for 3-column layout
  const byDim = {
    cognitive: indicators.filter(i => i.dimension === 'cognitive'),
    procedural: indicators.filter(i => i.dimension === 'procedural'),
    attitudinal: indicators.filter(i => i.dimension === 'attitudinal'),
  }

  return (
    <div className="ach-card" style={{ borderLeftColor: borderColor }}>
      {/* Card header */}
      <div className="ach-card-header" onClick={() => setExpanded(e => !e)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges row */}
          <div className="ach-badges">
            <span className="ach-badge" style={{ background: '#fff3e8', color: '#b8690b' }}>
              P{goal.period}
            </span>
            {goal.bloom_level && (
              <span className="ach-badge" style={{ background: bloom.bg, color: bloom.color }}>
                {BLOOM_LEVELS.find(b => b.value === goal.bloom_level)?.label || goal.bloom_level}
              </span>
            )}
            <span className="ach-badge" style={{
              background: isPublished ? '#eef7e0' : '#f5f5f5',
              color: isPublished ? '#4a7c1f' : '#888',
            }}>
              {isPublished ? '\u2705 Publicado' : '\u270F\uFE0F Borrador'}
            </span>
            <span className="ach-badge" style={{ background: '#f0f4fb', color: '#555' }}>
              {indicators.length} ind.
            </span>
            {connections && connections.news?.length > 0 && (
              <span className="ach-badge" style={{ background: '#eef7e0', color: '#4a7c1f' }}>
                {'\u{1F4F0}'} {connections.news.length}
              </span>
            )}
            {connections && connections.guides > 0 && (
              <span className="ach-badge" style={{ background: '#eef3ff', color: '#2E5598' }}>
                {'\u{1F4DD}'} {connections.guides}
              </span>
            )}
          </div>

          {/* Goal text */}
          <p className="ach-card-text">{goal.text}</p>

          {/* Weight bar (compact in header) */}
          {indicators.length > 0 && <WeightBar indicators={indicators} />}
        </div>

        <span className="ach-expand-icon">{expanded ? '\u25B2' : '\u25BC'}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="ach-card-body">
          {/* 3-column indicators by dimension */}
          {indicators.length === 0 ? (
            <p className="ach-no-indicators">
              Sin indicadores aún. Agrega al menos 3 (cognitivo, procedimental, actitudinal).
            </p>
          ) : (
            <div className="ach-indicators-grid">
              {DIMENSIONS.map(dim => (
                <div key={dim.value} className="ach-dim-col">
                  <div className="ach-dim-header" style={{ background: dim.bg, color: dim.color }}>
                    {dim.icon} {dim.label}
                  </div>
                  {(byDim[dim.value] || []).length === 0 ? (
                    <div className="ach-dim-empty">Sin indicador {dim.label.toLowerCase()}</div>
                  ) : (
                    (byDim[dim.value] || []).map(ind => {
                      const sk = ind.skill_area ? SKILL_AREAS.find(s => s.value === ind.skill_area) : null
                      return (
                        <div key={ind.id} className="ach-ind-item" style={{ borderColor: dim.color + '30' }}>
                          <p className="ach-ind-text">{ind.text}</p>
                          <div className="ach-ind-meta">
                            {ind.weight && (
                              <span className="ach-ind-weight">{ind.weight}%</span>
                            )}
                            {sk && (
                              <span className="ach-ind-skill" style={{ color: sk.color, background: sk.color + '18' }}>
                                {sk.icon} {sk.label}
                              </span>
                            )}
                          </div>
                          {ind.student_text && (
                            <p className="ach-ind-student">{'\u{1F9D1}\u200D\u{1F393}'} {ind.student_text}</p>
                          )}
                          <div className="ach-ind-actions">
                            <button type="button" onClick={() => onEditIndicator(ind)} title="Editar"
                              className="ach-btn-icon">{'\u270E'}</button>
                            <button type="button" onClick={() => onDeleteIndicator(ind.id)} title="Eliminar"
                              className="ach-btn-icon ach-btn-icon-danger">{'\u2715'}</button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Completeness + Cascade side by side */}
          <div className="ach-insights">
            <CompletenessChecklist goal={goal} connections={connections} />
            <CascadePanel connections={connections} loading={connectionsLoading} />
          </div>

          {/* Actions */}
          <div className="ach-card-actions">
            <button type="button" onClick={() => onNewIndicator(goal.id)} className="ach-btn-add">
              + Indicador
            </button>
            <button type="button" onClick={() => onEdit(goal)} className="ach-btn-secondary">
              {'\u270E'} Editar logro
            </button>
            {!isPublished && (
              <button type="button" onClick={() => onPublish(goal.id)} className="ach-btn-publish">
                {'\u2705'} Publicar
              </button>
            )}
            {availableSections?.map(tg => (
              <button key={tg} type="button"
                onClick={() => onDuplicate(tg)}
                disabled={duplicatingTarget === `${goal.id}-${tg}`}
                title={`Duplicar logro e indicadores para ${tg}`}
                className="ach-btn-add"
                style={{ opacity: duplicatingTarget === `${goal.id}-${tg}` ? 0.6 : 1 }}>
                {duplicatingTarget === `${goal.id}-${tg}` ? '\u23F3' : `\u{1F4CB} \u2192 ${tg}`}
              </button>
            ))}
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)} className="ach-btn-danger">
                Eliminar
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#c33' }}>¿Confirmar?</span>
                <button type="button" onClick={() => { onDelete(goal.id); setConfirmDelete(false) }}
                  className="ach-btn-primary" style={{ background: '#c33' }}>
                  Sí, eliminar
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="ach-btn-secondary">
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AchievementsPage({ teacher }) {
  const { showToast } = useToast()

  // Filters
  const [filterPeriod,  setFilterPeriod]  = useState(null)
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterGrade,   setFilterGrade]   = useState('all')

  // Assignments (for subject/grade options)
  const [assignments, setAssignments] = useState([])

  // Year verse from school
  const [yearVerse, setYearVerse] = useState('')

  // Modals
  const [goalModal,       setGoalModal]       = useState(null)
  const [indicatorModal,  setIndicatorModal]  = useState(null)
  const [duplicatingGoal, setDuplicatingGoal] = useState(null)

  // Connections cache: { [goalId]: { news, guides, checkpoints } }
  const [connectionsCache, setConnectionsCache] = useState({})
  const [connectionsLoading, setConnectionsLoading] = useState({})

  // Hook
  const {
    goals, loading, error, refetch,
    createGoal, updateGoal, deleteGoal, publishGoal,
    createIndicator, updateIndicator, deleteIndicator,
    getGoalConnections,
  } = useAchievements(teacher, {
    period:        filterPeriod || undefined,
    subject:       filterSubject !== 'all' ? filterSubject : undefined,
    grade:         filterGrade !== 'all' ? filterGrade : undefined,
    academic_year: CURRENT_YEAR,
  })

  // Load assignments + year verse
  useEffect(() => {
    if (!teacher?.id) return
    supabase
      .from('teacher_assignments')
      .select('subject, grade, section')
      .eq('teacher_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .then(({ data }) => setAssignments(data || []))

    supabase
      .from('schools')
      .select('year_verse')
      .eq('id', teacher.school_id)
      .single()
      .then(({ data }) => setYearVerse(data?.year_verse || ''))
  }, [teacher?.id, teacher?.school_id])

  // Load connections for visible goals
  const loadConnections = useCallback(async (goalIds) => {
    for (const gid of goalIds) {
      if (connectionsCache[gid] || connectionsLoading[gid]) continue
      setConnectionsLoading(prev => ({ ...prev, [gid]: true }))
      const result = await getGoalConnections(gid)
      setConnectionsCache(prev => ({ ...prev, [gid]: result }))
      setConnectionsLoading(prev => ({ ...prev, [gid]: false }))
    }
  }, [getGoalConnections, connectionsCache, connectionsLoading])

  useEffect(() => {
    if (goals.length > 0) {
      loadConnections(goals.map(g => g.id))
    }
  }, [goals]) // eslint-disable-line react-hooks/exhaustive-deps

  const uniqueSubjects = useMemo(() =>
    [...new Set(assignments.map(a => a.subject))].sort(), [assignments]
  )
  const uniqueGrades = useMemo(() =>
    [...new Set(assignments.map(a => combinedGrade(a)))].sort(), [assignments]
  )

  // ── Group goals by subject+grade ──────────────────────────────────────────
  const groupedGoals = useMemo(() => {
    const groups = {}
    goals.forEach(g => {
      const key = `${g.subject}|||${g.grade}`
      if (!groups[key]) groups[key] = { subject: g.subject, grade: g.grade, goals: [] }
      groups[key].goals.push(g)
    })
    return Object.values(groups).sort((a, b) =>
      a.subject.localeCompare(b.subject) || a.grade.localeCompare(b.grade)
    )
  }, [goals])

  // ── Goal handlers ──────────────────────────────────────────────────────────

  const handleSaveGoal = async (form) => {
    const isEdit = !!form.id
    const payload = {
      subject:       form.subject,
      grade:         form.grade,
      period:        form.period,
      academic_year: form.academic_year,
      text:          form.text,
      verb:          form.verb || null,
      bloom_level:   form.bloom_level || null,
      year_verse:    form.year_verse || null,
      status:        form.status,
    }
    const { error: err } = isEdit
      ? await updateGoal(form.id, payload)
      : await createGoal(payload)
    if (err) { showToast(err, 'error'); return }
    showToast(isEdit ? 'Logro actualizado' : 'Logro creado', 'success')
    setGoalModal(null)
    refetch()
  }

  const handleDeleteGoal = async (id) => {
    const { error: err } = await deleteGoal(id)
    if (err) { showToast(err, 'error'); return }
    showToast('Logro eliminado', 'success')
  }

  const handlePublishGoal = async (id) => {
    const { error: err } = await publishGoal(id)
    if (err) { showToast(err, 'error'); return }
    showToast('Logro publicado — visible para compañeros del colegio', 'success')
  }

  // ── Indicator handlers ─────────────────────────────────────────────────────

  const handleSaveIndicator = async (form) => {
    const isEdit = !!form.id
    const payload = {
      dimension:    form.dimension,
      text:         form.text.trim(),
      student_text: form.student_text?.trim() || null,
      bloom_level:  form.bloom_level || null,
      weight:       form.weight ? parseFloat(form.weight) : null,
    }
    const { error: err } = isEdit
      ? await updateIndicator(form.id, payload)
      : await createIndicator(form.goal_id, payload)
    if (err) { showToast(err, 'error'); return }
    showToast(isEdit ? 'Indicador actualizado' : 'Indicador creado', 'success')
    setIndicatorModal(null)
  }

  const handleDeleteIndicator = async (id) => {
    const { error: err } = await deleteIndicator(id)
    if (err) { showToast(err, 'error'); return }
    showToast('Indicador eliminado', 'success')
  }

  // ── Duplicate goal for another section ────────────────────────────────────

  const getAvailableSections = (goal) => {
    const thisAss = assignments.find(a => combinedGrade(a) === goal.grade && a.subject === goal.subject)
    if (!thisAss) return []
    return assignments
      .filter(a => a.grade === thisAss.grade && a.subject === goal.subject && combinedGrade(a) !== goal.grade)
      .map(a => combinedGrade(a))
  }

  const handleDuplicateGoal = async (goal, targetGrade) => {
    const key = `${goal.id}-${targetGrade}`
    setDuplicatingGoal(key)
    const { data: newGoal, error: err } = await createGoal({
      subject:       goal.subject,
      grade:         targetGrade,
      period:        goal.period,
      academic_year: goal.academic_year,
      text:          goal.text,
      verb:          goal.verb || null,
      bloom_level:   goal.bloom_level || null,
      status:        'draft',
    })
    if (err) { showToast(err, 'error'); setDuplicatingGoal(null); return }
    for (const ind of (goal.indicators || [])) {
      await createIndicator(newGoal.id, {
        dimension:    ind.dimension,
        text:         ind.text,
        student_text: ind.student_text || null,
        bloom_level:  ind.bloom_level || null,
        weight:       ind.weight || null,
        skill_area:   ind.skill_area || null,
        order_index:  ind.order_index,
      })
    }
    setDuplicatingGoal(null)
    showToast(`Logro duplicado para ${targetGrade} con ${goal.indicators?.length || 0} indicadores`, 'success')
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalGoals      = goals.length
  const publishedGoals  = goals.filter(g => g.status === 'published').length
  const totalIndicators = goals.reduce((s, g) => s + (g.indicators?.length || 0), 0)
  const evaluatedPct    = useMemo(() => {
    let evaluated = 0, total = 0
    Object.values(connectionsCache).forEach(c => {
      if (c?.checkpoints) evaluated += new Set(c.checkpoints.map(ch => ch.indicator_id)).size
    })
    total = totalIndicators
    return total > 0 ? Math.round((evaluated / total) * 100) : 0
  }, [connectionsCache, totalIndicators])

  return (
    <div className="ach-page">

      {/* ── Gradient Header ── */}
      <div className="ach-header">
        <div className="ach-header-top">
          <div>
            <h2 className="ach-header-title">{'\u{1F3AF}'} Logros de Desempeño</h2>
            <p className="ach-header-subtitle">
              Logros e indicadores del período — {CURRENT_YEAR}
            </p>
          </div>
          <button onClick={() => setGoalModal('new')} className="ach-btn-new">
            + Nuevo Logro
          </button>
        </div>
        <div className="ach-stats">
          <StatCard icon={'\u{1F3AF}'} value={totalGoals} label="Logros" color="#2E5598" />
          <StatCard icon={'\u2705'} value={publishedGoals} label="Publicados" color="#4a7c1f" />
          <StatCard icon={'\u{1F4CA}'} value={totalIndicators} label="Indicadores" color="#4BACC6" />
          <StatCard icon={'\u{1F4C8}'} value={`${evaluatedPct}%`} label="Evaluados" color={evaluatedPct >= 75 ? '#4a7c1f' : '#C9A84C'} />
        </div>
      </div>

      {/* ── Period tabs ── */}
      <div className="ach-filters">
        <div className="ach-tab-group">
          <button
            onClick={() => setFilterPeriod(null)}
            className={`ach-tab ${filterPeriod === null ? 'active' : ''}`}>
            Todos
          </button>
          {[1, 2, 3, 4].map(p => (
            <button key={p}
              onClick={() => setFilterPeriod(filterPeriod === p ? null : p)}
              className={`ach-tab ${filterPeriod === p ? 'active' : ''}`}>
              P{p}
            </button>
          ))}
        </div>
        <div className="ach-selects">
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="ach-select">
            <option value="all">Todas las asignaturas</option>
            {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} className="ach-select">
            <option value="all">Todos los grados</option>
            {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="ach-content">
        {loading && (
          <div style={{ textAlign: 'center', padding: 60, color: '#888', fontSize: 15 }}>
            Cargando logros...
          </div>
        )}
        {error && (
          <div style={{
            padding: 16, background: '#fff0f0', borderRadius: 10,
            border: '1px solid #ffcdd2', color: '#c33', fontSize: 14,
          }}>
            Error: {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && goals.length === 0 && (
          <div className="ach-empty">
            <div className="ach-empty-icon">{'\u{1F3AF}'}</div>
            <h3 className="ach-empty-title">Sin logros de período aún</h3>
            <p className="ach-empty-text">
              Comienza creando tu primer logro para activar la cascada pedagógica
            </p>

            {/* Cascade diagram */}
            <div className="ach-cascade-diagram">
              <div className="ach-cascade-step">
                <span className="ach-cascade-step-num">1</span>
                <span>Crea un <strong>Logro</strong> de período</span>
              </div>
              <div className="ach-cascade-arrow">{'\u2193'}</div>
              <div className="ach-cascade-step">
                <span className="ach-cascade-step-num">2</span>
                <span>Agrega <strong>3 Indicadores</strong> (cognitivo + procedimental + actitudinal)</span>
              </div>
              <div className="ach-cascade-arrow">{'\u2193'}</div>
              <div className="ach-cascade-step">
                <span className="ach-cascade-step-num">3</span>
                <span>Vincula a <strong>NEWS Projects</strong> y crea guías</span>
              </div>
            </div>

            <button onClick={() => setGoalModal('new')} className="ach-btn-primary" style={{ marginTop: 20 }}>
              + Nuevo Logro
            </button>
          </div>
        )}

        {/* Grouped goals */}
        {!loading && groupedGoals.map(group => (
          <div key={`${group.subject}-${group.grade}`} className="ach-group">
            <div className="ach-group-header">
              <span className="ach-group-subject">{group.subject}</span>
              <span className="ach-group-grade">{group.grade}</span>
              <span className="ach-group-count">{group.goals.length} {group.goals.length === 1 ? 'logro' : 'logros'}</span>
            </div>
            {group.goals.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                availableSections={getAvailableSections(goal)}
                connections={connectionsCache[goal.id]}
                connectionsLoading={connectionsLoading[goal.id]}
                onEdit={g => setGoalModal(g)}
                onDelete={handleDeleteGoal}
                onPublish={handlePublishGoal}
                onNewIndicator={goalId => setIndicatorModal({ goalId })}
                onEditIndicator={ind => setIndicatorModal(ind)}
                onDeleteIndicator={handleDeleteIndicator}
                onDuplicate={tg => handleDuplicateGoal(goal, tg)}
                duplicatingTarget={duplicatingGoal}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Goal modal ── */}
      {goalModal && (
        <GoalFormModal
          goal={goalModal === 'new' ? null : goalModal}
          assignments={assignments}
          yearVerse={yearVerse}
          onSave={handleSaveGoal}
          onClose={() => setGoalModal(null)}
        />
      )}

      {/* ── Indicator modal ── */}
      {indicatorModal && (
        <IndicatorFormModal
          indicator={indicatorModal.id ? indicatorModal : null}
          goalId={indicatorModal.goalId || indicatorModal.goal_id}
          goalContext={indicatorModal.id
            ? goals.find(g => g.id === indicatorModal.goal_id)
            : goals.find(g => g.id === indicatorModal.goalId)
          }
          onSave={handleSaveIndicator}
          onClose={() => setIndicatorModal(null)}
        />
      )}
    </div>
  )
}
