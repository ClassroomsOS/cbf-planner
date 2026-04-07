import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import useAchievements from '../hooks/useAchievements'
import { useToast } from '../context/ToastContext'
import { ACADEMIC_PERIODS } from '../utils/constants'

// ── Constants ─────────────────────────────────────────────────────────────────

const DIMENSIONS = [
  { value: 'cognitive',    label: 'Cognitivo',      icon: '🧠', color: '#2E5598', bg: '#eef3ff' },
  { value: 'procedural',   label: 'Procedimental',  icon: '⚒️', color: '#4BACC6', bg: '#e8f7fb' },
  { value: 'attitudinal',  label: 'Actitudinal',    icon: '❤️', color: '#C0504D', bg: '#fff0f0' },
]

const SKILL_AREAS = [
  { value: 'speaking',   label: 'Speaking',   icon: '🗣️', color: '#8064A2' },
  { value: 'listening',  label: 'Listening',  icon: '👂', color: '#4BACC6' },
  { value: 'reading',    label: 'Reading',    icon: '📖', color: '#2E5598' },
  { value: 'writing',    label: 'Writing',    icon: '✍️', color: '#4a7c1f' },
  { value: 'general',    label: 'General',    icon: '📋', color: '#888'    },
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function ProgressBar({ evaluated, total }) {
  const pct = total > 0 ? Math.round((evaluated / total) * 100) : 0
  const color = pct === 100 ? '#4a7c1f' : pct >= 50 ? '#4BACC6' : '#C9A84C'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#888' }}>Indicadores evaluados</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{evaluated}/{total} ({pct}%)</span>
      </div>
      <div style={{ height: 6, background: '#e0e6f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 3, transition: 'width .4s ease',
        }} />
      </div>
    </div>
  )
}

// ── Goal Form Modal ────────────────────────────────────────────────────────────

function GoalFormModal({ goal, assignments, onSave, onClose }) {
  const [form, setForm] = useState(goal || emptyGoal())
  const [saving, setSaving] = useState(false)

  const uniqueSubjects = [...new Set(assignments.map(a => a.subject))].sort()
  const grades = assignments
    .filter(a => !form.subject || a.subject === form.subject)
    .map(a => `${a.grade} ${a.section}`.trim())
  const uniqueGrades = [...new Set(grades)].sort()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.text.trim())    return alert('El logro no puede estar vacío.')
    if (!form.subject.trim()) return alert('Selecciona una asignatura.')
    if (!form.grade.trim())   return alert('Selecciona un grado.')
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(30,40,60,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 560,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #e0e6f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: 17, color: '#1F3864', fontWeight: 700 }}>
            {goal?.id ? 'Editar Logro' : 'Nuevo Logro de Período'}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888',
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Row: Subject + Grade */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
              Asignatura
              <select value={form.subject} onChange={e => set('subject', e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }}>
                <option value="">Seleccionar...</option>
                {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
              Grado
              <input value={form.grade} onChange={e => set('grade', e.target.value)}
                list="grade-options" placeholder="ej. 8.°"
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }} />
              <datalist id="grade-options">
                {uniqueGrades.map(g => <option key={g} value={g} />)}
              </datalist>
            </label>
          </div>

          {/* Row: Period + Bloom */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
              Período
              <select value={form.period} onChange={e => set('period', +e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }}>
                {[1, 2, 3, 4].map(p => <option key={p} value={p}>{p}.° Período</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
              Nivel Bloom
              <select value={form.bloom_level} onChange={e => set('bloom_level', e.target.value)}
                style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }}>
                <option value="">Sin especificar</option>
                {BLOOM_LEVELS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </label>
          </div>

          {/* Verb hint */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Verbo rector (opcional)
            <input value={form.verb} onChange={e => set('verb', e.target.value)}
              placeholder="ej. Produce, Analiza, Demuestra..."
              style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }} />
          </label>

          {/* Goal text */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Enunciado del logro
            <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
              Estructura: verbo Bloom + contenido + condición de desempeño
            </span>
            <textarea value={form.text} onChange={e => set('text', e.target.value)}
              rows={4} placeholder="ej. Produce textos narrativos en pasado simple que evidencien comprensión de eventos reales usando el libro de texto como modelo..."
              style={{
                padding: '10px 12px', border: '1px solid #d0d8e8', borderRadius: 8,
                fontSize: 14, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
              }} />
          </label>

          {/* Year verse (optional) */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Versículo del año (opcional)
            <input value={form.year_verse || ''} onChange={e => set('year_verse', e.target.value)}
              placeholder="ej. Génesis 1:27-28a (TLA)"
              style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14 }} />
          </label>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e0e6f0',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose}
            style={{ padding: '9px 20px', border: '1px solid #d0d8e8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '9px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
              background: saving ? '#aaa' : '#2E5598', color: '#fff', fontWeight: 700,
            }}>
            {saving ? 'Guardando...' : 'Guardar Logro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Indicator Form Modal ──────────────────────────────────────────────────────

function IndicatorFormModal({ indicator, goalId, onSave, onClose }) {
  const [form, setForm] = useState(indicator || emptyIndicator(goalId))
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.text.trim()) return alert('El indicador no puede estar vacío.')
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  const dim = dimInfo(form.dimension)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(30,40,60,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.2)', overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid #e0e6f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: 17, color: '#1F3864', fontWeight: 700 }}>
            {indicator?.id ? 'Editar Indicador' : 'Nuevo Indicador de Logro'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#888' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Dimension selector */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>Dimensión</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {DIMENSIONS.map(d => (
                <button key={d.value} type="button"
                  onClick={() => set('dimension', d.value)}
                  style={{
                    flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                    border: form.dimension === d.value ? `2px solid ${d.color}` : '2px solid #e0e6f0',
                    background: form.dimension === d.value ? d.bg : '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                  <span style={{ fontSize: 20 }}>{d.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: form.dimension === d.value ? d.color : '#888' }}>
                    {d.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Skill area (optional — for language subjects) */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 4 }}>
              Habilidad comunicativa
              <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6 }}>
                (opcional — solo para materias de idioma)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button key="none" type="button"
                onClick={() => set('skill_area', null)}
                style={{
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                  border: !form.skill_area ? '2px solid #888' : '2px solid #e0e6f0',
                  background: !form.skill_area ? '#f5f5f5' : '#fff',
                  color: !form.skill_area ? '#555' : '#aaa', fontWeight: 600,
                }}>
                Sin habilidad
              </button>
              {SKILL_AREAS.map(s => (
                <button key={s.value} type="button"
                  onClick={() => set('skill_area', s.value)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                    border: form.skill_area === s.value ? `2px solid ${s.color}` : '2px solid #e0e6f0',
                    background: form.skill_area === s.value ? s.color + '18' : '#fff',
                    color: form.skill_area === s.value ? s.color : '#888', fontWeight: 600,
                  }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
            {form.skill_area && form.skill_area !== 'general' && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#4a7c1f' }}>
                El NEWS Project vinculado a este indicador pre-seleccionará automáticamente
                la plantilla de rúbrica institucional de {form.skill_area}.
              </p>
            )}
          </div>

          {/* Indicator text */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Texto del indicador (versión docente)
            <textarea value={form.text} onChange={e => set('text', e.target.value)}
              rows={3} placeholder="ej. Reconoce y aplica el pasado simple en contextos narrativos escritos..."
              style={{
                padding: '10px 12px', border: `1px solid ${dim.color}40`,
                borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
              }} />
          </label>

          {/* Student text */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Texto versión estudiante (lenguaje A2)
            <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
              Lenguaje simple que el estudiante entiende desde el primer día
            </span>
            <textarea value={form.student_text || ''} onChange={e => set('student_text', e.target.value)}
              rows={2} placeholder="ej. I can write a short story using past tense verbs correctly..."
              style={{
                padding: '10px 12px', border: '1px solid #d0d8e8',
                borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
              }} />
          </label>

          {/* Weight */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: '#555', fontWeight: 600 }}>
            Peso en la nota del período (%)
            <input type="number" min="0" max="100" step="5"
              value={form.weight || ''} onChange={e => set('weight', e.target.value)}
              placeholder="ej. 30"
              style={{ padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14, width: 100 }} />
          </label>
        </div>

        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e0e6f0',
          display: 'flex', gap: 10, justifyContent: 'flex-end',
        }}>
          <button onClick={onClose}
            style={{ padding: '9px 20px', border: '1px solid #d0d8e8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding: '9px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
              background: saving ? '#aaa' : dim.color, color: '#fff', fontWeight: 700,
            }}>
            {saving ? 'Guardando...' : 'Guardar Indicador'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({ goal, onEdit, onDelete, onPublish, onNewIndicator, onEditIndicator, onDeleteIndicator }) {
  const [expanded, setExpanded] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const indicators = goal.indicators || []
  const evaluated = indicators.filter(i => i._evaluated).length

  const bloom = BLOOM_COLORS[goal.bloom_level] || BLOOM_COLORS.apply
  const isPublished = goal.status === 'published'

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e0e6f0',
      boxShadow: '0 2px 8px rgba(0,0,0,.04)', overflow: 'hidden',
    }}>
      {/* Goal header */}
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'flex-start',
        gap: 12, cursor: 'pointer', borderBottom: expanded ? '1px solid #f0f4fb' : 'none',
      }} onClick={() => setExpanded(e => !e)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Meta row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: '#eef3ff', color: '#2E5598',
            }}>
              {goal.subject}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: '#f5f5f5', color: '#555',
            }}>
              {goal.grade}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: '#fff3e8', color: '#b8690b',
            }}>
              P{goal.period}
            </span>
            {goal.bloom_level && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: bloom.bg, color: bloom.color,
              }}>
                {BLOOM_LEVELS.find(b => b.value === goal.bloom_level)?.label || goal.bloom_level}
              </span>
            )}
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: isPublished ? '#eef7e0' : '#f5f5f5',
              color: isPublished ? '#4a7c1f' : '#888',
            }}>
              {isPublished ? '✅ Publicado' : '✏️ Borrador'}
            </span>
          </div>

          {/* Goal text */}
          <p style={{ margin: 0, fontSize: 14, color: '#1F3864', lineHeight: 1.5, fontWeight: 500 }}>
            {goal.text}
          </p>

          {/* Progress */}
          <ProgressBar evaluated={evaluated} total={indicators.length} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 16, color: '#aaa', userSelect: 'none' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </div>

      {/* Indicators */}
      {expanded && (
        <div style={{ padding: '12px 18px' }}>
          {indicators.length === 0 && (
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#aaa', fontStyle: 'italic' }}>
              Sin indicadores aún. Agrega al menos 3 (cognitivo, procedimental, actitudinal).
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {indicators.map(ind => {
              const d = dimInfo(ind.dimension)
              return (
                <div key={ind.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', background: d.bg + '66',
                  borderRadius: 10, border: `1px solid ${d.color}30`,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{d.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: d.color, textTransform: 'uppercase', letterSpacing: '.4px' }}>
                        {d.label}
                      </span>
                      {ind.weight && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#f5f5f5', color: '#666' }}>
                          {ind.weight}%
                        </span>
                      )}
                      {ind.skill_area && (() => {
                        const sk = SKILL_AREAS.find(s => s.value === ind.skill_area)
                        return sk ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                            background: sk.color + '18', color: sk.color, letterSpacing: '.2px',
                          }}>
                            {sk.icon} {sk.label}
                          </span>
                        ) : null
                      })()}
                      {ind._evaluated && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#eef7e0', color: '#4a7c1f' }}>
                          ✅ Evaluado
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: '#1F3864', lineHeight: 1.4 }}>{ind.text}</p>
                    {ind.student_text && (
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                        👨‍🎓 {ind.student_text}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button type="button" onClick={() => onEditIndicator(ind)} title="Editar"
                      style={{ padding: '4px 8px', border: '1px solid #d0d8e8', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                      ✎
                    </button>
                    <button type="button" onClick={() => onDeleteIndicator(ind.id)} title="Eliminar"
                      style={{ padding: '4px 8px', border: '1px solid #ffcdd2', borderRadius: 6, background: '#fff5f5', cursor: 'pointer', fontSize: 13, color: '#c33' }}>
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onNewIndicator(goal.id)}
              style={{
                padding: '7px 14px', border: '1.5px dashed #4BACC6', borderRadius: 8,
                background: '#f0f9fc', color: '#4BACC6', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
              + Indicador
            </button>
            <button type="button" onClick={() => onEdit(goal)}
              style={{ padding: '7px 14px', border: '1px solid #d0d8e8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
              ✎ Editar logro
            </button>
            {!isPublished && (
              <button type="button" onClick={() => onPublish(goal.id)}
                style={{
                  padding: '7px 14px', border: 'none', borderRadius: 8,
                  background: '#eef7e0', color: '#4a7c1f', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>
                ✅ Publicar
              </button>
            )}
            {!confirmDelete ? (
              <button type="button" onClick={() => setConfirmDelete(true)}
                style={{ padding: '7px 14px', border: '1px solid #ffcdd2', borderRadius: 8, background: '#fff5f5', cursor: 'pointer', fontSize: 13, color: '#c33' }}>
                Eliminar
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: '#c33' }}>¿Confirmar?</span>
                <button type="button" onClick={() => { onDelete(goal.id); setConfirmDelete(false) }}
                  style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: '#c33', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                  Sí, eliminar
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}
                  style={{ padding: '7px 14px', border: '1px solid #d0d8e8', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13 }}>
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

export default function ObjectivesPage({ teacher }) {
  const { showToast } = useToast()

  // Filters
  const [filterPeriod,  setFilterPeriod]  = useState(null)
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterGrade,   setFilterGrade]   = useState('all')

  // Assignments (for subject/grade options)
  const [assignments, setAssignments] = useState([])

  // Modals
  const [goalModal,      setGoalModal]      = useState(null)  // null | 'new' | goalObj
  const [indicatorModal, setIndicatorModal] = useState(null)  // null | { goalId } | indicatorObj

  // Hook
  const {
    goals, loading, error, refetch,
    createGoal, updateGoal, deleteGoal, publishGoal,
    createIndicator, updateIndicator, deleteIndicator,
  } = useAchievements(teacher, {
    period:        filterPeriod || undefined,
    subject:       filterSubject !== 'all' ? filterSubject : undefined,
    grade:         filterGrade !== 'all' ? filterGrade : undefined,
    academic_year: CURRENT_YEAR,
  })

  // Load assignments for filter options
  useEffect(() => {
    if (!teacher?.id) return
    supabase
      .from('teacher_assignments')
      .select('subject, grade, section')
      .eq('teacher_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .then(({ data }) => setAssignments(data || []))
  }, [teacher?.id])

  const uniqueSubjects = useMemo(() =>
    [...new Set(assignments.map(a => a.subject))].sort(), [assignments]
  )
  const uniqueGrades = useMemo(() =>
    [...new Set(assignments.map(a => `${a.grade} ${a.section}`.trim()))].sort(), [assignments]
  )

  // ── Goal handlers ──────────────────────────────────────────────────────────

  const handleSaveGoal = async (form) => {
    const isEdit = !!form.id
    const { error: err } = isEdit
      ? await updateGoal(form.id, form)
      : await createGoal(form)
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
    if (!confirm('¿Eliminar este indicador?')) return
    const { error: err } = await deleteIndicator(id)
    if (err) { showToast(err, 'error'); return }
    showToast('Indicador eliminado', 'success')
  }

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalGoals      = goals.length
  const publishedGoals  = goals.filter(g => g.status === 'published').length
  const totalIndicators = goals.reduce((s, g) => s + (g.indicators?.length || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6fb' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e0e6f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#1F3864', fontWeight: 700 }}>🎯 Objetivos de Período</h2>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#888' }}>
            Logros e indicadores de desempeño — {CURRENT_YEAR}
          </p>
        </div>
        <button onClick={() => setGoalModal('new')}
          style={{
            padding: '10px 20px', background: '#2E5598', color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
          + Nuevo Logro
        </button>
      </div>

      {/* ── Summary strip ── */}
      <div style={{
        padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e0e6f0',
        display: 'flex', gap: 20, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 13, color: '#555' }}>
          <strong style={{ color: '#1F3864' }}>{totalGoals}</strong> logros
        </span>
        <span style={{ fontSize: 13, color: '#555' }}>
          <strong style={{ color: '#4a7c1f' }}>{publishedGoals}</strong> publicados
        </span>
        <span style={{ fontSize: 13, color: '#555' }}>
          <strong style={{ color: '#4BACC6' }}>{totalIndicators}</strong> indicadores totales
        </span>
      </div>

      {/* ── Period selector ── */}
      <div style={{ padding: '14px 24px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterPeriod(null)}
          style={{
            padding: '7px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: filterPeriod === null ? '2px solid #2E5598' : '2px solid #e0e6f0',
            background: filterPeriod === null ? '#2E5598' : '#fff',
            color: filterPeriod === null ? '#fff' : '#555',
          }}>
          Todos
        </button>
        {[1, 2, 3, 4].map(p => (
          <button key={p}
            onClick={() => setFilterPeriod(filterPeriod === p ? null : p)}
            style={{
              padding: '7px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: filterPeriod === p ? '2px solid #2E5598' : '2px solid #e0e6f0',
              background: filterPeriod === p ? '#2E5598' : '#fff',
              color: filterPeriod === p ? '#fff' : '#555',
            }}>
            {p}.° Período
          </button>
        ))}
      </div>

      {/* ── Subject / Grade filter ── */}
      <div style={{ padding: '10px 24px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, background: '#fff' }}>
          <option value="all">Todas las asignaturas</option>
          {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
          style={{ padding: '7px 12px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, background: '#fff' }}>
          <option value="all">Todos los grados</option>
          {uniqueGrades.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 32px' }}>
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
        {!loading && !error && goals.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 20px', color: '#aaa',
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#888', marginBottom: 6 }}>
              Sin logros de período aún
            </div>
            <div style={{ fontSize: 14, color: '#aaa', marginBottom: 20 }}>
              Crea el primer logro para comenzar la cascada pedagógica
            </div>
            <button onClick={() => setGoalModal('new')}
              style={{
                padding: '11px 24px', background: '#2E5598', color: '#fff',
                border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}>
              + Nuevo Logro
            </button>
          </div>
        )}
        {!loading && goals.map(goal => (
          <div key={goal.id} style={{ marginBottom: 14 }}>
            <GoalCard
              goal={goal}
              onEdit={g => setGoalModal(g)}
              onDelete={handleDeleteGoal}
              onPublish={handlePublishGoal}
              onNewIndicator={goalId => setIndicatorModal({ goalId })}
              onEditIndicator={ind => setIndicatorModal(ind)}
              onDeleteIndicator={handleDeleteIndicator}
            />
          </div>
        ))}
      </div>

      {/* ── Goal modal ── */}
      {goalModal && (
        <GoalFormModal
          goal={goalModal === 'new' ? null : goalModal}
          assignments={assignments}
          onSave={handleSaveGoal}
          onClose={() => setGoalModal(null)}
        />
      )}

      {/* ── Indicator modal ── */}
      {indicatorModal && (
        <IndicatorFormModal
          indicator={indicatorModal.goal_id ? null : indicatorModal}
          goalId={indicatorModal.goalId || indicatorModal.goal_id}
          onSave={handleSaveIndicator}
          onClose={() => setIndicatorModal(null)}
        />
      )}
    </div>
  )
}
