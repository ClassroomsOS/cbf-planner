import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../supabase'
import { DAYS, ACADEMIC_PERIODS } from '../utils/constants'
import { useToast } from '../context/ToastContext'

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const STATUS_CFG = {
  draft:  { label: 'Borrador', color: '#888',    bg: '#f5f5f5'  },
  ready:  { label: 'Lista',    color: '#2E5598', bg: '#eef2fb'  },
  sent:   { label: 'Enviada',  color: '#9BBB59', bg: '#eef7e0'  },
}

const SKILL_COLOR = {
  Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59',
}

function toMonday(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
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
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_ES[m - 1].slice(0, 3)}.`
}

function formatWeekRange(mondayStr) {
  const dates = getWeekDates(mondayStr)
  const [, ms, md]  = dates[0].split('-').map(Number)
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

// ── Main component ────────────────────────────────────────────────────────────
export default function AgendaPage({ teacher }) {
  const { showToast } = useToast()
  const [view,              setView]             = useState('list')
  const [agendas,           setAgendas]          = useState([])
  const [allPlans,          setAllPlans]         = useState([])
  const [allTeachers,       setAllTeachers]      = useState([])
  const [schoolAssignments, setSchoolAssignments] = useState([])
  const [loading,           setLoading]          = useState(true)
  const [editing,           setEditing]          = useState(null)

  const [filterGrade,   setFilterGrade]   = useState('all')
  const [filterSection, setFilterSection] = useState('all')

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [{ data: ag }, { data: pl }, { data: tc }, { data: asgn }] = await Promise.all([
      supabase.from('weekly_agendas')
        .select('*')
        .eq('school_id', teacher.school_id)
        .order('week_start', { ascending: false }),
      supabase.from('lesson_plans')
        .select('id, grade, subject, teacher_id, content, monday_date, week_count')
        .eq('school_id', teacher.school_id),
      supabase.from('teachers')
        .select('id, full_name')
        .eq('school_id', teacher.school_id)
        .eq('status', 'approved'),
      supabase.from('teacher_assignments')
        .select('grade, section, subject, teacher_id, schedule')
        .eq('school_id', teacher.school_id),
    ])
    setAgendas(ag || [])
    setAllPlans(pl || [])
    setAllTeachers(tc || [])
    setSchoolAssignments(asgn || [])
    setLoading(false)
  }

  // Grade+section pairs that actually exist in teacher_assignments
  const gradePairs = useMemo(() => {
    const pairs = new Map()
    schoolAssignments.forEach(a => {
      if (!a.grade || !a.section) return
      const k = `${a.grade}|${a.section}`
      if (!pairs.has(k)) pairs.set(k, { grade: a.grade, section: a.section })
    })
    return [...pairs.values()].sort((a, b) => {
      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade)
      return a.section.localeCompare(b.section)
    })
  }, [schoolAssignments])

  const filteredAgendas = useMemo(() => agendas.filter(a => {
    if (filterGrade   !== 'all' && a.grade   !== filterGrade)   return false
    if (filterSection !== 'all' && a.section !== filterSection) return false
    return true
  }), [agendas, filterGrade, filterSection])

  function openNew() {
    setEditing({
      id: null, grade: '', section: '', week_start: todayMonday(),
      period: null, devotional: '', notes: '', content: { entries: [] }, status: 'draft',
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
        schoolAssignments={schoolAssignments}
        onSave={async () => { await fetchAll(); setView('list') }}
        onCancel={() => setView('list')}
      />
    )
  }

  // ── List view ─────────────────────────────────────────────────────────────
  const gradeOptions   = [...new Set(agendas.map(a => a.grade))].sort()
  const sectionOptions = [...new Set(
    agendas.filter(a => filterGrade === 'all' || a.grade === filterGrade).map(a => a.section)
  )].sort()

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
            No hay agendas.{' '}
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
                <div key={a.id} onClick={() => openEdit(a)} style={{
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

// ── AgendaEditor ──────────────────────────────────────────────────────────────
function AgendaEditor({ agenda, teacher, allPlans, allTeachers, schoolAssignments, onSave, onCancel }) {
  const { showToast } = useToast()
  const [form,          setForm]          = useState({ ...agenda })
  const [entries,       setEntries]       = useState(agenda.content?.entries || [])
  const [saving,        setSaving]        = useState(false)
  const [contextLoading, setContextLoading] = useState(false)
  const [holidays,      setHolidays]      = useState({})  // { 'YYYY-MM-DD': name }
  const [newsHitos,     setNewsHitos]     = useState([])  // activities/deliveries this week
  const [contextLoaded, setContextLoaded] = useState(false)

  const weekDates  = useMemo(() => form.week_start ? getWeekDates(form.week_start) : [], [form.week_start])
  const teacherMap = useMemo(() => {
    const m = {}; allTeachers.forEach(t => { m[t.id] = t }); return m
  }, [allTeachers])

  // Grade options from real teacher_assignments
  const availableGrades = useMemo(() =>
    [...new Set(schoolAssignments.map(a => a.grade).filter(Boolean))].sort()
  , [schoolAssignments])

  const availableSections = useMemo(() =>
    [...new Set(
      schoolAssignments.filter(a => a.grade === form.grade).map(a => a.section).filter(Boolean)
    )].sort()
  , [schoolAssignments, form.grade])

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

  // ── Load week context automatically ───────────────────────────────────────
  const loadWeekContext = useCallback(async (replaceEntries = false) => {
    if (!form.grade || !form.section || !form.week_start) return
    setContextLoading(true)

    const weekDatesArr = getWeekDates(form.week_start)
    const fullGrade    = `${form.grade} ${form.section}`
    const weekDate     = new Date(form.week_start + 'T12:00:00')

    const [
      { data: principle },
      { data: newsProjects },
      { data: calEntries },
    ] = await Promise.all([
      supabase.from('school_monthly_principles')
        .select('month_verse, month_verse_ref')
        .eq('school_id', teacher.school_id)
        .eq('year', weekDate.getFullYear())
        .eq('month', weekDate.getMonth() + 1)
        .maybeSingle(),
      supabase.from('news_projects')
        .select('title, skill, actividades_evaluativas, due_date, subject, status')
        .eq('school_id', teacher.school_id),
      supabase.from('school_calendar')
        .select('date, name, is_school_day')
        .eq('school_id', teacher.school_id)
        .in('date', weekDatesArr),
    ])

    // ── Holidays ──
    const holidayMap = {}
    if (calEntries) {
      calEntries.filter(c => c.is_school_day === false).forEach(c => {
        holidayMap[c.date] = c.name
      })
    }
    setHolidays(holidayMap)

    // ── Auto-fill devotional from monthly principle ──
    if (!form.devotional && principle?.month_verse) {
      const devText = principle.month_verse +
        (principle.month_verse_ref ? `\n— ${principle.month_verse_ref}` : '')
      updateField('devotional', devText)
    }

    // ── NEWS hitos for this week ──
    const hitos = []
    if (newsProjects) {
      newsProjects.forEach(p => {
        ;(p.actividades_evaluativas || []).forEach(act => {
          if (act.fecha && weekDatesArr.includes(act.fecha)) {
            hitos.push({
              fecha: act.fecha, nombre: act.nombre,
              porcentaje: act.porcentaje, skill: p.skill,
              projectTitle: p.title,
            })
          }
        })
        if (p.due_date && weekDatesArr.includes(p.due_date)) {
          hitos.push({
            fecha: p.due_date, nombre: `🏁 Entrega: ${p.title}`,
            skill: p.skill, isDelivery: true,
          })
        }
      })
    }
    hitos.sort((a, b) => a.fecha.localeCompare(b.fecha))
    setNewsHitos(hitos)

    // ── Build entries from teacher_assignments + lesson_plans ──
    if (!form.id || replaceEntries) {
      const gradeAssignments = schoolAssignments.filter(
        a => a.grade === form.grade && a.section === form.section
      )

      // Plan lookup: find plans for this grade+section covering the week
      const planMap = {}
      allPlans.forEach(p => {
        if (p.grade !== fullGrade) return
        const planDays = Object.keys(p.content?.days || {})
        if (planDays.some(d => weekDatesArr.includes(d))) {
          planMap[p.subject] = p
        }
      })

      const built = gradeAssignments.map(asgn => {
        const t   = teacherMap[asgn.teacher_id]
        const plan = planMap[asgn.subject]
        const days = {}
        weekDatesArr.forEach(date => {
          if (holidayMap[date]) return
          const html = plan?.content?.days?.[date]?.sections?.assignment?.content
          days[date] = htmlToText(html)
        })
        return {
          subject:      asgn.subject,
          teacher_name: t?.full_name?.split(' ').slice(0, 2).join(' ') || '',
          days,
        }
      })

      if (built.length > 0) setEntries(built)
    }

    setContextLoaded(true)
    setContextLoading(false)
  }, [form.grade, form.section, form.week_start, form.devotional, form.id,
      teacher.school_id, schoolAssignments, allPlans, teacherMap])

  // Auto-load when grade+section+week are all set (only for new agendas)
  useEffect(() => {
    if (form.grade && form.section && form.week_start && !contextLoaded) {
      loadWeekContext(false)
    }
  }, [form.grade, form.section, form.week_start])

  // Reset context loaded when week/grade/section changes
  useEffect(() => {
    setContextLoaded(false)
    setNewsHitos([])
    setHolidays({})
  }, [form.grade, form.section, form.week_start])

  // ── Save ──────────────────────────────────────────────────────────────────
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
      updated_at: new Date().toISOString(),
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('weekly_agendas').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('weekly_agendas').insert(payload))
    }
    setSaving(false)
    if (error) { showToast(`Error al guardar: ${error.message}`, 'error'); return }
    showToast('Agenda guardada', 'success')
    onSave()
  }

  // ── PDF export ────────────────────────────────────────────────────────────
  function exportPdf() {
    const gradeLabel = `${form.grade} ${form.section}`
    const weekLabel  = form.week_start ? formatWeekRange(form.week_start) : ''
    const school     = teacher.school_name || ''

    const activeDates = weekDates.filter(d => !holidays[d])

    const dayHeaders = activeDates.map(d => {
      const dayIdx = weekDates.indexOf(d)
      return `<th style="background:#2E5598;color:#fff;padding:8px;font-size:11px;text-align:center">
        ${DAYS[dayIdx]?.label || ''}<br>
        <span style="font-weight:400;font-size:10px">${formatDate(d)}</span>
      </th>`
    }).join('')

    const entryRows = entries.filter(e => e.subject).map(e => {
      const dayCells = activeDates.map(d =>
        `<td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;vertical-align:top;min-width:90px">${e.days?.[d] || ''}</td>`
      ).join('')
      return `<tr>
        <td style="padding:6px 8px;border:1px solid #ddd;font-weight:700;font-size:11px;white-space:nowrap;color:#2E5598">${e.subject}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:10px;color:#666;white-space:nowrap">${e.teacher_name || ''}</td>
        ${dayCells}
      </tr>`
    }).join('')

    const hitosHtml = newsHitos.length ? `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:#1F3864;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📌 Actividades evaluativas de la semana</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${newsHitos.map(h => `
            <span style="font-size:10px;padding:2px 10px;border-radius:12px;
              background:${(SKILL_COLOR[h.skill] || '#1A3A8F') + '20'};
              border:1px solid ${(SKILL_COLOR[h.skill] || '#1A3A8F') + '60'};
              color:${SKILL_COLOR[h.skill] || '#1A3A8F'};font-weight:600">
              ${h.nombre} · ${formatDate(h.fecha)}
            </span>`).join('')}
        </div>
      </div>` : ''

    const holidayHtml = Object.entries(holidays).length ? `
      <div style="background:#fff8f0;border-left:3px solid #f59e0b;padding:6px 12px;margin-bottom:12px;font-size:11px;border-radius:0 6px 6px 0">
        ${Object.entries(holidays).map(([d, n]) => `<strong>${formatDate(d)}</strong> — ${n}`).join(' &nbsp;·&nbsp; ')}
      </div>` : ''

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Agenda Semanal — ${gradeLabel}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; color: #222; }
  h1 { font-size: 16px; color: #1F3864; margin: 0 0 2px; }
  .subtitle { font-size: 12px; color: #555; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  .section-title { font-size: 11px; font-weight: 700; color: #2E5598; margin: 14px 0 5px;
    text-transform: uppercase; letter-spacing: .5px; }
  .devotional-box { background: #f0f4ff; border-left: 4px solid #2E5598;
    padding: 8px 14px; font-size: 12px; margin-bottom: 12px; border-radius: 4px;
    white-space: pre-wrap; }
  .notes-box { background: #f9f9f9; border: 1px solid #ddd;
    padding: 8px 14px; font-size: 12px; border-radius: 4px; margin-top: 14px; }
  @media print { body { margin: 10mm; } }
</style>
</head><body>
  <h1>📋 Agenda Semanal — ${gradeLabel}</h1>
  <div class="subtitle">${school} · Semana del ${weekLabel}${form.period ? ' · Período ' + form.period : ''}</div>
  ${holidayHtml}
  ${form.devotional ? `<div class="section-title">✝ Devoción de la semana</div><div class="devotional-box">${form.devotional}</div>` : ''}
  ${hitosHtml}
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

  // ── Render ────────────────────────────────────────────────────────────────
  const activeDates = weekDates.filter(d => !holidays[d])

  return (
    <div className="planner-wrap">
      <div className="card">

        {/* Header */}
        <div className="card-title">
          <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={onCancel}>← Volver</button>
          <div className="badge" style={{ marginLeft: '8px' }}>📋</div>
          {form.id ? 'Editar agenda' : 'Nueva agenda'}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
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
            <button className="btn-primary btn-save" onClick={handleSave}
              disabled={saving || !form.grade || !form.section || !form.week_start}>
              {saving ? '⏳ Guardando…' : '💾 Guardar'}
            </button>
          </div>
        </div>

        {/* Identity fields */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div className="form-field" style={{ flex: 1, minWidth: 120 }}>
            <label>Grado</label>
            <select value={form.grade} onChange={e => { updateField('grade', e.target.value); updateField('section', '') }}>
              <option value="">— Grado —</option>
              {availableGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: 100 }}>
            <label>Sección</label>
            <select value={form.section} onChange={e => updateField('section', e.target.value)} disabled={!form.grade}>
              <option value="">— Sección —</option>
              {availableSections.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 1, minWidth: 120 }}>
            <label>Período</label>
            <select value={form.period || ''} onChange={e => updateField('period', e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {ACADEMIC_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ flex: 2, minWidth: 160 }}>
            <label>Semana (cualquier día)</label>
            <input type="date" value={form.week_start}
              onChange={e => updateField('week_start', toMonday(e.target.value))} />
            {form.week_start && (
              <span style={{ fontSize: '11px', color: '#2E5598', marginTop: '2px', display: 'block' }}>
                Semana del {formatWeekRange(form.week_start)}
              </span>
            )}
          </div>
        </div>

        {/* Context loading indicator */}
        {contextLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px', background: '#f0f4ff', borderRadius: '8px',
            marginBottom: '14px', fontSize: '12px', color: '#2E5598',
          }}>
            <div className="loading-spinner" style={{ width: 16, height: 16 }} />
            Cargando contexto del sistema (guías, principios, hitos NEWS, calendario)…
          </div>
        )}

        {/* Regenerate button for existing agendas */}
        {form.id && contextLoaded && !contextLoading && (
          <div style={{ marginBottom: '14px' }}>
            <button className="btn-secondary" style={{ fontSize: '11px' }}
              onClick={() => loadWeekContext(true)}>
              🔄 Regenerar desde guías actuales
            </button>
            <span style={{ fontSize: '11px', color: '#aaa', marginLeft: '10px' }}>
              Reemplaza el contenido con lo que está en las guías de esta semana
            </span>
          </div>
        )}

        {/* Holidays banner */}
        {Object.keys(holidays).length > 0 && (
          <div style={{
            background: '#fffbeb', border: '1px solid #f59e0b',
            borderRadius: '8px', padding: '8px 14px',
            marginBottom: '14px', fontSize: '12px', color: '#92400e',
            display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700 }}>🗓 Días no laborables:</span>
            {Object.entries(holidays).map(([d, n]) => (
              <span key={d} style={{
                background: '#fef3c7', border: '1px solid #f59e0b',
                borderRadius: '5px', padding: '1px 8px', fontWeight: 600,
              }}>{formatDate(d)} — {n}</span>
            ))}
          </div>
        )}

        {/* NEWS hitos banner */}
        {newsHitos.length > 0 && (
          <div style={{
            background: '#f0f4ff', border: '1px solid #bfcfff',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '14px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#1F3864',
              textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '7px' }}>
              📌 Actividades evaluativas esta semana
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {newsHitos.map((h, i) => {
                const color = SKILL_COLOR[h.skill] || '#1A3A8F'
                return (
                  <span key={i} style={{
                    fontSize: '11px', padding: '2px 10px', borderRadius: '12px',
                    background: color + '18', border: `1px solid ${color}50`,
                    color, fontWeight: 700,
                  }}>
                    {h.nombre}
                    {h.porcentaje > 0 && ` (${h.porcentaje}%)`}
                    {' · '}{formatDate(h.fecha)}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Devotional */}
        <div className="form-field" style={{ marginBottom: '14px' }}>
          <label>✝ Devoción de la semana
            <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 6, fontSize: 10 }}>
              (auto-cargado desde Principios del mes)
            </span>
          </label>
          <textarea value={form.devotional || ''} rows={2}
            placeholder="Versículo o reflexión bíblica para la semana…"
            onChange={e => updateField('devotional', e.target.value)}
            style={{ resize: 'vertical', fontSize: '12px' }} />
        </div>

        {/* Entries table */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '12px', color: '#2E5598',
            textTransform: 'uppercase', letterSpacing: '.5px' }}>
            📚 Materias y actividades
            {entries.length > 0 && (
              <span style={{ fontWeight: 400, color: '#aaa', marginLeft: 8, fontSize: 10, textTransform: 'none' }}>
                {entries.length} materia{entries.length !== 1 ? 's' : ''} cargada{entries.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button className="btn-primary" style={{ fontSize: '11px' }} onClick={addEntry}>
            + Agregar materia
          </button>
        </div>

        {weekDates.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px' }}>
            Selecciona grado, sección y semana para cargar las materias.
          </div>
        ) : entries.length === 0 && !contextLoading ? (
          <div className="empty-state" style={{ padding: '20px' }}>
            {form.grade && form.section
              ? 'No se encontraron guías para este grado/sección en la semana seleccionada. Agrega materias manualmente.'
              : 'Selecciona grado y sección para auto-cargar las materias.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr>
                  <th style={thS('#1F3864', '130px')}>Materia</th>
                  <th style={thS('#1F3864', '110px')}>Docente</th>
                  {weekDates.map((d, i) => {
                    const isHoliday = !!holidays[d]
                    const dayHito   = newsHitos.filter(h => h.fecha === d)
                    return (
                      <th key={d} style={thS(isHoliday ? '#b0b8c8' : '#2E5598')}>
                        {DAYS[i]?.label || ''}<br />
                        <span style={{ fontWeight: 400, fontSize: '9px' }}>{formatDate(d)}</span>
                        {isHoliday && (
                          <div style={{ fontSize: '9px', fontWeight: 600, marginTop: '2px' }}>
                            🚫 {holidays[d].length > 14 ? holidays[d].slice(0, 14) + '…' : holidays[d]}
                          </div>
                        )}
                        {dayHito.map((h, j) => (
                          <div key={j} style={{
                            fontSize: '9px', fontWeight: 700, marginTop: '2px',
                            color: SKILL_COLOR[h.skill] || '#fff',
                            background: 'rgba(255,255,255,0.2)',
                            borderRadius: '3px', padding: '0 4px',
                          }}>
                            📌 {h.nombre.length > 12 ? h.nombre.slice(0, 12) + '…' : h.nombre}
                          </div>
                        ))}
                      </th>
                    )
                  })}
                  <th style={thS('#888', '36px')}></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '4px' }}>
                      <input type="text" value={entry.subject} placeholder="Materia"
                        onChange={e => updateEntry(idx, 'subject', e.target.value)}
                        style={{ width: '100%', fontSize: '11px', padding: '3px 6px',
                          border: '1px solid #dde5f0', borderRadius: '4px', fontWeight: 700 }} />
                    </td>
                    <td style={{ padding: '4px' }}>
                      <input type="text" value={entry.teacher_name || ''} placeholder="Docente"
                        onChange={e => updateEntry(idx, 'teacher_name', e.target.value)}
                        style={{ width: '100%', fontSize: '10px', padding: '3px 6px',
                          border: '1px solid #dde5f0', borderRadius: '4px' }} />
                    </td>
                    {weekDates.map(d => {
                      const isHoliday = !!holidays[d]
                      return (
                        <td key={d} style={{ padding: '4px', verticalAlign: 'top',
                          background: isHoliday ? '#f5f5f5' : 'transparent' }}>
                          {isHoliday ? (
                            <div style={{ fontSize: '10px', color: '#bbb', textAlign: 'center', padding: '8px 4px' }}>—</div>
                          ) : (
                            <textarea
                              value={entry.days?.[d] || ''}
                              rows={2}
                              onChange={e => updateEntryDay(idx, d, e.target.value)}
                              style={{ width: '100%', fontSize: '10px', padding: '3px 5px',
                                border: '1px solid #dde5f0', borderRadius: '4px',
                                resize: 'none', minWidth: '80px' }}
                            />
                          )}
                        </td>
                      )
                    })}
                    <td style={{ padding: '4px', textAlign: 'center' }}>
                      <button className="btn-icon-danger" onClick={() => removeEntry(idx)} title="Quitar">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
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
