// ── ObservationLoggerPage.jsx ─────────────────────────────────────────────────
// Form to record real Cognia / eleot® classroom observations.
// Stores in eleot_observations table (migration: 20260407_eleot_observations.sql).
// Admin: can observe any teacher. Teacher: only self-record allowed.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { canManage } from '../utils/roles'
import { useToast } from '../context/ToastContext'

const DOMAINS = {
  A: { label: 'Learning Environment',   color: '#2E5598', items: ['A1','A2','A3','A4'] },
  B: { label: 'Student Engagement',     color: '#9BBB59', items: ['B1','B2','B3','B4','B5'] },
  C: { label: 'Collaborative Learning', color: '#F79646', items: ['C1','C2','C3','C4'] },
  D: { label: 'Cognitive Complexity',   color: '#8064A2', items: ['D1','D2','D3','D4'] },
  E: { label: 'Assessment',             color: '#C0504D', items: ['E1','E2','E3','E4'] },
  F: { label: 'Communication',          color: '#4BACC6', items: ['F1','F2','F3','F4'] },
  G: { label: 'Technology Integration', color: '#1A6B3A', items: ['G1','G2','G3','G4'] },
}

const ITEM_LABELS = {
  A1: 'Safe & orderly environment',     A2: 'Welcoming, inclusive climate',
  A3: 'High expectations communicated', A4: 'Resources & materials accessible',
  B1: 'On-task behavior',               B2: 'Intellectual engagement',
  B3: 'Student voice & choice',         B4: 'Higher-order thinking prompted',
  B5: 'Self-monitoring & metacognition',
  C1: 'Structured collaboration',       C2: 'Peer-to-peer interaction',
  C3: 'Cooperative roles & norms',      C4: 'Product of collaboration',
  D1: 'Analysis & evaluation tasks',    D2: 'Real-world connections',
  D3: 'Rigor & depth of knowledge',    D4: 'Creative / innovative thinking',
  E1: 'Formative assessment used',      E2: 'Feedback provided',
  E3: 'Student self-assessment',        E4: 'Data-driven instructional adjustments',
  F1: 'Academic language modeled',      F2: 'Written communication',
  F3: 'Oral communication',             F4: 'Non-verbal / multimodal',
  G1: 'Technology for learning',        G2: 'Digital collaboration',
  G3: 'Student tech use',               G4: 'Digital resources leveraged',
}

const LEVELS = [
  { val: 1, label: '1 — Inicial',    color: '#EF4444' },
  { val: 2, label: '2 — En proceso', color: '#F97316' },
  { val: 3, label: '3 — Logrado',    color: '#22C55E' },
  { val: 4, label: '4 — Ejemplar',   color: '#2E5598' },
]

function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const BLANK = {
  observed_teacher_id: '',
  date: new Date().toISOString().slice(0, 10),
  grade: '', subject: '',
  domain: 'A', item: 'A1', level: 3, notes: '',
}

export default function ObservationLoggerPage({ teacher }) {
  const { showToast } = useToast()
  const isAdmin = canManage(teacher.role)

  const [teachers,  setTeachers]  = useState([])
  const [obs,       setObs]       = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [form,      setForm]      = useState({ ...BLANK, observed_teacher_id: teacher.id })
  const [showForm,  setShowForm]  = useState(false)
  const [filterDom, setFilterDom] = useState('')
  const [filterT,   setFilterT]   = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    setLoading(true)
    try {
      const [{ data: trows }, { data: orows }] = await Promise.all([
        supabase.from('teachers').select('id, full_name').eq('school_id', teacher.school_id),
        supabase.from('eleot_observations')
          .select('*')
          .eq('school_id', teacher.school_id)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100),
      ])
      setTeachers(trows || [])
      setObs(orows || [])
    } catch (err) {
      showToast('Error al cargar observaciones', 'error')
    } finally {
      setLoading(false)
    }
  }

  function setField(key, val) {
    setForm(f => {
      const next = { ...f, [key]: val }
      // When domain changes, reset item to first of that domain
      if (key === 'domain') {
        next.item = DOMAINS[val]?.items[0] || val + '1'
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.date || !form.domain || !form.item || !form.level) {
      showToast('Completa fecha, dominio, ítem y nivel.', 'error')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('eleot_observations').insert({
      school_id:           teacher.school_id,
      observer_id:         teacher.id,
      observed_teacher_id: form.observed_teacher_id || teacher.id,
      date:                form.date,
      grade:               form.grade || null,
      subject:             form.subject || null,
      domain:              form.domain,
      item:                form.item,
      level:               Number(form.level),
      notes:               form.notes || null,
    })
    setSaving(false)
    if (error) {
      showToast('Error al guardar observación: ' + error.message, 'error')
      return
    }
    showToast('Observación registrada', 'success')
    setShowForm(false)
    setForm({ ...BLANK, observed_teacher_id: teacher.id })
    init()
  }

  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.full_name]))

  const filteredObs = obs.filter(o => {
    if (filterDom && o.domain !== filterDom) return false
    if (filterT   && o.observed_teacher_id !== filterT) return false
    return true
  })

  const domainItems = DOMAINS[form.domain]?.items || []

  return (
    <div style={{ padding: '24px 28px', maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 700 }}>
            🔎 Observaciones eleot®
          </h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
            Registro de observaciones Cognia® en aula
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(f => !f)}
          style={{
            padding: '9px 18px', borderRadius: 8,
            background: '#1F3864', color: '#fff',
            border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}
        >
          {showForm ? '✕ Cancelar' : '+ Nueva observación'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: '20px', marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#1F3864' }}>
            Registrar observación
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            {/* Date */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Fecha *</span>
              <input type="date" value={form.date} onChange={e => setField('date', e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }} />
            </label>

            {/* Teacher observed */}
            {isAdmin ? (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Docente observado *</span>
                <select value={form.observed_teacher_id} onChange={e => setField('observed_teacher_id', e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, background: '#fff' }}>
                  <option value="">Seleccionar…</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </label>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Docente</span>
                <input value={teacher.full_name} readOnly
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #E2E8F0',
                    fontSize: 13, background: '#F8FAFC', color: '#666' }} />
              </label>
            )}

            {/* Grade */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Grado</span>
              <input value={form.grade} onChange={e => setField('grade', e.target.value)}
                placeholder="Ej. 9.° B"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }} />
            </label>

            {/* Subject */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Materia</span>
              <input value={form.subject} onChange={e => setField('subject', e.target.value)}
                placeholder="Ej. Language Arts"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13 }} />
            </label>

            {/* Domain */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Dominio eleot® *</span>
              <select value={form.domain} onChange={e => setField('domain', e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, background: '#fff' }}>
                {Object.entries(DOMAINS).map(([k, d]) => (
                  <option key={k} value={k}>{k} — {d.label}</option>
                ))}
              </select>
            </label>

            {/* Item */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Ítem *</span>
              <select value={form.item} onChange={e => setField('item', e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, background: '#fff' }}>
                {domainItems.map(i => (
                  <option key={i} value={i}>{i} — {ITEM_LABELS[i] || i}</option>
                ))}
              </select>
            </label>

          </div>

          {/* Level picker */}
          <div style={{ marginTop: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>
              Nivel observado *
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {LEVELS.map(lv => (
                <button
                  key={lv.val}
                  type="button"
                  onClick={() => setField('level', lv.val)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    border: `2px solid ${form.level === lv.val ? lv.color : '#E2E8F0'}`,
                    background: form.level === lv.val ? lv.color : '#fff',
                    color: form.level === lv.val ? '#fff' : '#374151',
                    fontWeight: form.level === lv.val ? 700 : 400,
                    transition: 'all .12s',
                  }}
                >{lv.label}</button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 14 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Notas / evidencias</span>
            <textarea
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              rows={3}
              placeholder="Describe lo observado en el aula…"
              style={{
                padding: '8px 10px', borderRadius: 8, border: '1px solid #D0D5DD',
                fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </label>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: saving ? '#93C5FD' : '#1F3864', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Guardando…' : '✓ Guardar observación'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{
                padding: '9px 16px', borderRadius: 8, border: '1px solid #E2E8F0',
                background: '#fff', color: '#666', fontSize: 13, cursor: 'pointer',
              }}
            >Cancelar</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={filterDom} onChange={e => setFilterDom(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, background: '#fff' }}>
          <option value="">Dominio: todos</option>
          {Object.entries(DOMAINS).map(([k, d]) => (
            <option key={k} value={k}>{k} — {d.label}</option>
          ))}
        </select>
        {isAdmin && (
          <select value={filterT} onChange={e => setFilterT(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #D0D5DD', fontSize: 13, background: '#fff' }}>
            <option value="">Docente: todos</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        )}
        <span style={{ padding: '7px 0', fontSize: 12, color: '#94A3B8' }}>
          {filteredObs.length} observación{filteredObs.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Observation list */}
      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Cargando…</p>}

      {!loading && filteredObs.length === 0 && (
        <div style={{
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          padding: '32px', textAlign: 'center', color: '#94A3B8',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔎</div>
          No hay observaciones registradas. Usa el botón "+ Nueva observación" para comenzar.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredObs.map(o => {
          const dom = DOMAINS[o.domain]
          const lv  = LEVELS.find(l => l.val === o.level) || LEVELS[0]
          return (
            <div key={o.id} style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
              padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 14,
            }}>
              {/* Domain badge */}
              <div style={{
                background: dom?.color || '#999', color: '#fff',
                borderRadius: 8, padding: '6px 12px', fontWeight: 700, fontSize: 14,
                flexShrink: 0, minWidth: 40, textAlign: 'center',
              }}>
                {o.item}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1F3864' }}>
                    {o.domain} · {dom?.label}
                  </span>
                  <span style={{
                    background: lv.color + '22', color: lv.color,
                    borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                  }}>{lv.label}</span>
                  {o.grade && (
                    <span style={{ background: '#EEF2FF', color: '#2E5598', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>
                      {o.grade}
                    </span>
                  )}
                  {o.subject && (
                    <span style={{ color: '#64748B', fontSize: 12 }}>{o.subject}</span>
                  )}
                </div>
                {ITEM_LABELS[o.item] && (
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    {ITEM_LABELS[o.item]}
                  </div>
                )}
                {o.notes && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#374151' }}>{o.notes}</p>
                )}
              </div>

              {/* Meta */}
              <div style={{ textAlign: 'right', flexShrink: 0, fontSize: 12, color: '#94A3B8' }}>
                <div>{formatDate(o.date)}</div>
                {isAdmin && o.observed_teacher_id && (
                  <div style={{ marginTop: 2, color: '#64748B' }}>
                    {teacherMap[o.observed_teacher_id]?.split(' ')[0] || '?'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
