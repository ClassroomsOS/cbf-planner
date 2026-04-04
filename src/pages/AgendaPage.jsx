import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { DAYS, GRADES, SECTIONS_LIST, ACADEMIC_PERIODS } from '../utils/constants'
import { useToast } from '../context/ToastContext'

// ── AgendaPage ────────────────────────────────────────────────
// Agenda Semanal Automática — Sprint 5
// Consolida las tareas/asignaciones de todas las materias de un grado/sección
// en una sola hoja lista para enviar a padres de familia.
// Acceso: admin, superadmin, director
// ─────────────────────────────────────────────────────────────

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const STATUS_CFG = {
  draft:  { label: 'Borrador', color: '#888',    bg: '#f5f5f5'  },
  ready:  { label: 'Lista',    color: '#2E5598', bg: '#eef2fb'  },
  sent:   { label: 'Enviada',  color: '#9BBB59', bg: '#eef7e0'  },
}

function toMonday(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getWeekDates(mondayStr) {
  const monday = new Date(mondayStr + 'T12:00:00')
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_ES[m - 1].slice(0, 3)}.`
}

function formatWeekRange(mondayStr) {
  const dates = getWeekDates(mondayStr)
  const [, ms, md] = dates[0].split('-').map(Number)
  const [, me, mde] = dates[4].split('-').map(Number)
  if (ms === me) return `${md}–${mde} de ${MONTHS_ES[ms - 1]}`
  return `${md} ${MONTHS_ES[ms - 1].slice(0, 3)} – ${mde} ${MONTHS_ES[me - 1].slice(0, 3)}`
}

function htmlToText(html) {
  if (!html) return ''
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent?.trim() || ''
}

function todayMonday() {
  return toMonday(new Date().toISOString().slice(0, 10))
}

// ── Main component ────────────────────────────────────────────
export default function AgendaPage({ teacher }) {
  const { showToast } = useToast()
  const [view,       setView]      = useState('list')   // 'list' | 'edit'
  const [agendas,    setAgendas]   = useState([])
  const [allPlans,   setAllPlans]  = useState([])       // lesson_plans for import
  const [allTeachers,setAllTeachers]= useState([])
  const [loading,    setLoading]   = useState(true)
  const [editing,    setEditing]   = useState(null)     // agenda object or 'new'

  // List filters
  const [filterGrade,   setFilterGrade]   = useState('all')
  const [filterSection, setFilterSection] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: ag }, { data: pl }, { data: tc }] = await Promise.all([
      supabase.from('weekly_agendas')
        .select('*')
        .eq('school_id', teacher.school_id)
        .order('week_start', { ascending: false }),
      supabase.from('lesson_plans')
        .select('id, grade, subject, teacher_id, content')
        .eq('school_id', teacher.school_id),
      supabase.from('teachers')
        .select('id, full_name, initials')
        .eq('school_id', teacher.school_id)
        .eq('status', 'approved'),
    ])
    setAgendas(ag || [])
    setAllPlans(pl || [])
    setAllTeachers(tc || [])
    setLoading(false)
  }

  // Available grade+section pairs from agendas + lesson_plans
  const gradePairs = useMemo(() => {
    const pairs = new Map()
    agendas.forEach(a => { const k = `${a.grade}|${a.section}`; if (!pairs.has(k)) pairs.set(k, { grade: a.grade, section: a.section }) })
    allPlans.forEach(p => {
      if (!p.grade) return
      // grade in lesson_plans is like "7.° A" — split last char as section
      const parts = p.grade.split(' ')
      const section = parts[parts.length - 1]
      const grade = parts.slice(0, -1).join(' ')
      if (grade && section && section.length === 1) {
        const k = `${grade}|${section}`
        if (!pairs.has(k)) pairs.set(k, { grade, section })
      }
    })
    return [...pairs.values()].sort((a, b) => {
      const gi = GRADES.indexOf(a.grade), gj = GRADES.indexOf(b.grade)
      if (gi !== gj) return gi - gj
      return a.section.localeCompare(b.section)
    })
  }, [agendas, allPlans])

  const filteredAgendas = useMemo(() => agendas.filter(a => {
    if (filterGrade !== 'all' && a.grade !== filterGrade) return false
    if (filterSection !== 'all' && a.section !== filterSection) return false
    return true
  }), [agendas, filterGrade, filterSection])

  function openNew() {
    setEditing({
      id: null, grade: '', section: '', week_start: todayMonday(),
      period: null, devotional: '', notes: '',
      content: { entries: [] }, status: 'draft',
    })
    setView('edit')
  }

  function openEdit(agenda) {
    setEditing({ ...agenda, content: { entries: [], ...agenda.content } })
    setView('edit')
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta agenda?')) return
    const { error } = await supabase.from('weekly_agendas').delete().eq('id', id)
    if (error) { showToast('Error al eliminar la agenda', 'error'); return }
    setAgendas(prev => prev.filter(a => a.id !== id))
  }

  if (loading) return (
    <div className="ge-loading"><div className="loading-spinner" /><p>Cargando agendas…</p></div>
  )

  if (view === 'edit' && editing) {
    return (
      <AgendaEditor
        agenda={editing}
        teacher={teacher}
        allPlans={allPlans}
        allTeachers={allTeachers}
        onSave={async () => { await fetchAll(); setView('list') }}
        onCancel={() => setView('list')}
      />
    )
  }

  // ── List view ──────────────────────────────────────────────
  const gradeOptions = [...new Set(agendas.map(a => a.grade))].sort()
  const sectionOptions = [...new Set(agendas.filter(a => filterGrade === 'all' || a.grade === filterGrade).map(a => a.section))].sort()

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">📋</div>
          Agenda Semanal
          <button className="btn-primary" style={{ marginLeft: 'auto', fontSize: '12px' }} onClick={openNew}>
            + Nueva agenda
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setFilterSection('all') }}>
            <option value="all">Todos los grados</option>
            {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)} disabled={filterGrade === 'all'}>
            <option value="all">Todas las secciones</option>
            {sectionOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {filteredAgendas.length === 0 ? (
          <div className="empty-state">
            No hay agendas creadas.{' '}
            <button className="btn-primary" style={{ fontSize: '12px', marginTop: '8px' }} onClick={openNew}>
              Crear la primera
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredAgendas.map(a => {
              const st = STATUS_CFG[a.status] || STATUS_CFG.draft
              const entryCount = a.content?.entries?.length || 0
              return (
                <div key={a.id}
                  onClick={() => openEdit(a)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', borderRadius: '10px',
                    border: '1.5px solid #dde5f0', background: '#fafbff',
                    cursor: 'pointer', transition: 'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fafbff'}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1F3864' }}>
                      {a.grade} {a.section} — Semana del {formatWeekRange(a.week_start)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                      {entryCount} materia{entryCount !== 1 ? 's' : ''}
                      {a.devotional && ' · Con devoción'}
                      {a.period && ` · P${a.period}`}
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: '10px', fontSize: '11px',
                    fontWeight: 700, background: st.bg, color: st.color,
                  }}>{st.label}</span>
                  <button className="btn-icon-danger"
                    onClick={e => { e.stopPropagation(); handleDelete(a.id) }}
                    title="Eliminar">🗑</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── AgendaEditor ──────────────────────────────────────────────
function AgendaEditor({ agenda, teacher, allPlans, allTeachers, onSave, onCancel }) {
  const { showToast } = useToast()
  const [form,      setForm]      = useState({ ...agenda })
  const [entries,   setEntries]   = useState(agenda.content?.entries || [])
  const [saving,    setSaving]    = useState(false)
  const [importing, setImporting] = useState(false)

  const weekDates = useMemo(() => form.week_start ? getWeekDates(form.week_start) : [], [form.week_start])
  const teacherMap = useMemo(() => {
    const m = {}; allTeachers.forEach(t => { m[t.id] = t }); return m
  }, [allTeachers])

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function updateEntry(idx, field, value) {
    setEntries(prev => prev.map((e, i) => i !== idx ? e : { ...e, [field]: value }))
  }

  function updateEntryDay(idx, dateStr, value) {
    setEntries(prev => prev.map((e, i) =>
      i !== idx ? e : { ...e, days: { ...e.days, [dateStr]: value } }
    ))
  }

  function addEntry() {
    setEntries(prev => [...prev, { subject: '', teacher_name: '', days: {} }])
  }

  function removeEntry(idx) {
    setEntries(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Auto-import from lesson plans ────────────────────────
  async function handleAutoImport() {
    if (!form.grade || !form.section || !form.week_start) return
    setImporting(true)

    const fullGrade = `${form.grade} ${form.section}`
    const weekDatesSet = new Set(weekDates)

    const relevantPlans = allPlans.filter(p => {
      if (p.grade !== fullGrade) return false
      const days = p.content?.days || {}
      return Object.keys(days).some(d => weekDatesSet.has(d))
    })

    const imported = relevantPlans.map(p => {
      const t = teacherMap[p.teacher_id]
      const days = {}
      weekDates.forEach(date => {
        const dayData = p.content?.days?.[date]
        const assignmentHtml = dayData?.sections?.assignment?.content || ''
        days[date] = htmlToText(assignmentHtml)
      })
      return {
        subject:      p.subject || '',
        teacher_name: t?.full_name?.split(' ').slice(0, 2).join(' ') || '',
        days,
      }
    })

    if (imported.length === 0) {
      alert('No se encontraron guías para este grado/sección en la semana seleccionada.')
    } else {
      // Merge with existing entries (avoid duplicates by subject)
      const existingSubjects = new Set(entries.map(e => e.subject))
      const newEntries = imported.filter(e => !existingSubjects.has(e.subject))
      setEntries(prev => [...prev, ...newEntries])
    }
    setImporting(false)
  }

  // ── Save ─────────────────────────────────────────────────
  async function handleSave() {
    if (!form.grade || !form.section || !form.week_start) return
    setSaving(true)
    const payload = {
      school_id:  teacher.school_id,
      grade:      form.grade,
      section:    form.section,
      week_start: form.week_start,
      period:     form.period || null,
      devotional: form.devotional || null,
      notes:      form.notes || null,
      content:    { entries },
      status:     form.status,
      created_by: teacher.id,
      updated_at: new Date().toISOString(),
    }
    let error
    if (form.id) {
      ({ error } = await supabase.from('weekly_agendas').update(payload).eq('id', form.id))
    } else {
      ({ error } = await supabase.from('weekly_agendas').insert(payload))
    }
    setSaving(false)
    if (error) { showToast('Error al guardar la agenda', 'error'); return }
    onSave()
  }

  // ── PDF export ────────────────────────────────────────────
  function exportPdf() {
    const school = teacher.school_name || ''
    const gradeLabel = `${form.grade} ${form.section}`
    const weekLabel = form.week_start ? formatWeekRange(form.week_start) : ''
    const periodLabel = form.period ? `Período ${form.period}` : ''

    const dayHeaders = weekDates.map((d, i) =>
      `<th style="background:#2E5598;color:#fff;padding:8px;font-size:11px">${DAYS[i].full}<br><span style="font-weight:400;font-size:10px">${formatDate(d)}</span></th>`
    ).join('')

    const entryRows = entries.filter(e => e.subject).map(e => {
      const dayCells = weekDates.map(d =>
        `<td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;vertical-align:top">${e.days?.[d] || ''}</td>`
      ).join('')
      return `<tr>
        <td style="padding:6px 8px;border:1px solid #ddd;font-weight:700;font-size:11px;white-space:nowrap;color:#2E5598">${e.subject}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px;color:#666;white-space:nowrap">${e.teacher_name || ''}</td>
        ${dayCells}
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Agenda Semanal — ${gradeLabel}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
  h1 { font-size: 16px; color: #1F3864; margin: 0 0 4px; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  .section-title { font-size: 12px; font-weight: 700; color: #2E5598; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: .5px; }
  .devotional-box { background: #f0f4ff; border-left: 4px solid #2E5598; padding: 10px 14px; font-size: 12px; margin-bottom: 12px; border-radius: 4px; }
  .notes-box { background: #f9f9f9; border: 1px solid #ddd; padding: 10px 14px; font-size: 12px; border-radius: 4px; margin-top: 16px; }
  @media print { body { margin: 10mm; } }
</style>
</head><body>
  <h1>📋 Agenda Semanal — ${gradeLabel}</h1>
  <div class="subtitle">${school} · ${weekLabel}${periodLabel ? ' · ' + periodLabel : ''}</div>
  ${form.devotional ? `<div class="section-title">✝ Devoción de la semana</div><div class="devotional-box">${form.devotional}</div>` : ''}
  <div class="section-title">📚 Actividades y tareas</div>
  <table>
    <thead>
      <tr>
        <th style="background:#1F3864;color:#fff;padding:8px;font-size:11px;text-align:left">Materia</th>
        <th style="background:#1F3864;color:#fff;padding:8px;font-size:11px">Docente</th>
        ${dayHeaders}
      </tr>
    </thead>
    <tbody>${entryRows}</tbody>
  </table>
  ${form.notes ? `<div class="notes-box"><strong>📝 Notas:</strong> ${form.notes}</div>` : ''}
</body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  const GRADE_LEVELS = GRADES
  const sections = ['A', 'B', 'C', 'D', 'E']

  return (
    <div className="planner-wrap">
      <div className="card">
        {/* ── Header ── */}
        <div className="card-title">
          <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={onCancel}>← Volver</button>
          <div className="badge" style={{ marginLeft: '8px' }}>📋</div>
          {form.id ? 'Editar agenda' : 'Nueva agenda'}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <select value={form.status} onChange={e => updateField('status', e.target.value)}
              style={{ fontSize: '11px', padding: '4px 8px' }}>
              {Object.entries(STATUS_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={exportPdf}
              disabled={!form.grade || !form.week_start || entries.length === 0}>
              🖨️ PDF
            </button>
            <button className="btn-primary btn-save" onClick={handleSave} disabled={saving || !form.grade || !form.section || !form.week_start}>
              {saving ? '⏳ Guardando…' : '💾 Guardar'}
            </button>
          </div>
        </div>

        {/* ── Identity fields ── */}
        <div className="g2" style={{ marginBottom: '12px' }}>
          <div className="ge-grid-3">
            <div className="form-field">
              <label>Grado</label>
              <select value={form.grade} onChange={e => updateField('grade', e.target.value)}>
                <option value="">— Grado —</option>
                {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Sección</label>
              <select value={form.section} onChange={e => updateField('section', e.target.value)}>
                <option value="">— Sección —</option>
                {sections.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Período</label>
              <select value={form.period || ''} onChange={e => updateField('period', e.target.value ? Number(e.target.value) : null)}>
                <option value="">—</option>
                {ACADEMIC_PERIODS.map(p => <option key={p.value} value={p.value}>{p.short}</option>)}
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Semana (selecciona cualquier día)</label>
            <input type="date" value={form.week_start}
              onChange={e => updateField('week_start', toMonday(e.target.value))} />
            {form.week_start && (
              <span style={{ fontSize: '11px', color: '#2E5598', marginTop: '2px', display: 'block' }}>
                Semana del {formatWeekRange(form.week_start)}
              </span>
            )}
          </div>
        </div>

        {/* ── Devotional ── */}
        <div className="form-field" style={{ marginBottom: '12px' }}>
          <label>✝ Devoción de la semana</label>
          <textarea value={form.devotional || ''} rows={2}
            placeholder="Versículo o reflexión bíblica para la semana…"
            onChange={e => updateField('devotional', e.target.value)}
            style={{ resize: 'vertical', fontSize: '12px' }} />
        </div>

        {/* ── Entries table ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '12px', color: '#2E5598', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            📚 Materias y actividades
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" style={{ fontSize: '11px' }}
              onClick={handleAutoImport} disabled={importing || !form.grade || !form.section || !form.week_start}>
              {importing ? '⏳ Importando…' : '⚡ Importar desde guías'}
            </button>
            <button className="btn-primary" style={{ fontSize: '11px' }} onClick={addEntry}>
              + Agregar materia
            </button>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px' }}>
            Sin materias. Usa "Importar desde guías" o agrega manualmente.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={thS('#1F3864', '130px')}>Materia</th>
                  <th style={thS('#1F3864', '110px')}>Docente</th>
                  {weekDates.map((d, i) => (
                    <th key={d} style={thS('#2E5598')}>
                      {DAYS[i].label}<br />
                      <span style={{ fontWeight: 400, fontSize: '9px' }}>{formatDate(d)}</span>
                    </th>
                  ))}
                  <th style={thS('#888', '36px')}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '4px' }}>
                      <input type="text" value={entry.subject}
                        placeholder="Materia"
                        onChange={e => updateEntry(idx, 'subject', e.target.value)}
                        style={{ width: '100%', fontSize: '11px', padding: '3px 6px',
                          border: '1px solid #dde5f0', borderRadius: '4px', fontWeight: 700 }} />
                    </td>
                    <td style={{ padding: '4px' }}>
                      <input type="text" value={entry.teacher_name || ''}
                        placeholder="Docente"
                        onChange={e => updateEntry(idx, 'teacher_name', e.target.value)}
                        style={{ width: '100%', fontSize: '10px', padding: '3px 6px',
                          border: '1px solid #dde5f0', borderRadius: '4px' }} />
                    </td>
                    {weekDates.map(d => (
                      <td key={d} style={{ padding: '4px', verticalAlign: 'top' }}>
                        <textarea
                          value={entry.days?.[d] || ''}
                          rows={2}
                          onChange={e => updateEntryDay(idx, d, e.target.value)}
                          style={{ width: '100%', fontSize: '10px', padding: '3px 5px',
                            border: '1px solid #dde5f0', borderRadius: '4px',
                            resize: 'none', minWidth: '80px' }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: '4px', textAlign: 'center' }}>
                      <button className="btn-icon-danger" onClick={() => removeEntry(idx)} title="Quitar">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Notes ── */}
        <div className="form-field" style={{ marginTop: '16px' }}>
          <label>📝 Notas para los padres</label>
          <textarea value={form.notes || ''} rows={2}
            placeholder="Recordatorios, eventos próximos, información adicional…"
            onChange={e => updateField('notes', e.target.value)}
            style={{ resize: 'vertical', fontSize: '12px' }} />
        </div>
      </div>
    </div>
  )
}

function thS(bg, width) {
  return {
    background: bg, color: '#fff', padding: '7px 6px',
    textAlign: 'center', fontWeight: 700, fontSize: '11px',
    ...(width ? { width, minWidth: width } : {}),
  }
}
