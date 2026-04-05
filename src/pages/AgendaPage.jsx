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
function prevWeek(w) {
  const d = new Date(w + 'T12:00:00'); d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}
function nextWeek(w) {
  const d = new Date(w + 'T12:00:00'); d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function canManageAllAgendas(role) {
  return role === 'admin' || role === 'superadmin' || role === 'rector'
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
  const [previewing,        setPreviewing]       = useState(null)  // { grade, section, week_start, agenda|null }
  const [dashWeek,          setDashWeek]         = useState(todayMonday)
  const [dashGenerating,    setDashGenerating]   = useState({})
  const [dashGenAll,        setDashGenAll]        = useState(false)

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

  const teacherMap = useMemo(() => {
    const m = {}; allTeachers.forEach(t => { m[t.id] = t }); return m
  }, [allTeachers])

  const planCoverageMap = useMemo(() => {
    const map    = {}
    const wDates = getWeekDates(dashWeek)
    gradePairs.forEach(({ grade, section }) => {
      const fullGrade = `${grade} ${section}`
      const subjects  = [...new Set(schoolAssignments.filter(a => a.grade === grade && a.section === section).map(a => a.subject))]
      const covered   = new Set(allPlans.filter(p =>
        p.grade === fullGrade && Object.keys(p.content?.days || {}).some(d => wDates.includes(d))
      ).map(p => p.subject))
      map[`${grade}|${section}`] = { total: subjects.length, covered: covered.size }
    })
    return map
  }, [gradePairs, allPlans, schoolAssignments, dashWeek])

  const agendaWeekMap = useMemo(() => {
    const map = {}
    agendas.filter(a => a.week_start === dashWeek).forEach(a => {
      map[`${a.grade}|${a.section}`] = a
    })
    return map
  }, [agendas, dashWeek])

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

  function openPreview(grade, section) {
    const key      = `${grade}|${section}`
    const existing = agendaWeekMap[key] || null
    setPreviewing({ grade, section, week_start: dashWeek, agenda: existing })
    setView('preview')
  }

  async function fetchSharedData(weekStart) {
    const wDates   = getWeekDates(weekStart)
    const weekDate = new Date(weekStart + 'T12:00:00')
    const [{ data: principle }, { data: calEntries }] = await Promise.all([
      supabase.from('school_monthly_principles')
        .select('month_verse, month_verse_ref')
        .eq('school_id', teacher.school_id)
        .eq('year', weekDate.getFullYear())
        .eq('month', weekDate.getMonth() + 1)
        .maybeSingle(),
      supabase.from('school_calendar')
        .select('date, name, is_school_day')
        .eq('school_id', teacher.school_id)
        .in('date', wDates),
    ])
    const holidayMap = {}
    ;(calEntries || []).filter(c => c.is_school_day === false).forEach(c => { holidayMap[c.date] = c.name })
    const devotional = principle?.month_verse
      ? principle.month_verse + (principle.month_verse_ref ? `\n— ${principle.month_verse_ref}` : '')
      : ''
    return { wDates, holidayMap, devotional }
  }

  function buildEntriesForPair(grade, section, wDates, holidayMap) {
    const SCHED_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri']
    const fullGrade  = `${grade} ${section}`
    const gradeAsgns = schoolAssignments.filter(a => a.grade === grade && a.section === section)
    const planMap    = {}
    allPlans.forEach(p => {
      if (p.grade !== fullGrade) return
      if (Object.keys(p.content?.days || {}).some(d => wDates.includes(d))) planMap[p.subject] = p
    })
    return gradeAsgns.map(asgn => {
      const t    = teacherMap[asgn.teacher_id]
      const plan = planMap[asgn.subject]
      const days = {}
      wDates.forEach((date, idx) => {
        if (holidayMap[date]) return
        const schedKey = SCHED_KEYS[idx]
        if (!(asgn.schedule?.[schedKey]?.length > 0)) return
        const dayData    = plan?.content?.days?.[date]
        const parts      = []
        const unit       = dayData?.unit
        const activity   = htmlToText(dayData?.sections?.activity?.content || dayData?.sections?.skill?.content || '').slice(0, 140)
        const assignment = htmlToText(dayData?.sections?.assignment?.content || '').slice(0, 160)
        if (unit)       parts.push(`📌 ${unit}`)
        if (activity)   parts.push(`📝 ${activity}`)
        if (assignment) parts.push(`📚 ${assignment}`)
        days[date] = parts.join('\n') || ''
      })
      return {
        subject:      asgn.subject,
        teacher_name: t?.full_name?.split(' ').slice(0, 2).join(' ') || '',
        schedule:     asgn.schedule || {},
        days,
      }
    })
  }

  async function generateOne(grade, section) {
    const key = `${grade}|${section}`
    setDashGenerating(prev => ({ ...prev, [key]: true }))
    try {
      const shared   = await fetchSharedData(dashWeek)
      const entries  = buildEntriesForPair(grade, section, shared.wDates, shared.holidayMap)
      const existing = agendaWeekMap[key]
      const payload  = {
        school_id:  teacher.school_id,
        grade, section,
        week_start: dashWeek,
        devotional: shared.devotional || null,
        content:    { entries },
        status:     existing?.status || 'draft',
        updated_at: new Date().toISOString(),
      }
      let error
      if (existing) {
        ;({ error } = await supabase.from('weekly_agendas').update(payload).eq('id', existing.id))
      } else {
        ;({ error } = await supabase.from('weekly_agendas').insert(payload))
      }
      if (error) showToast(`Error: ${error.message}`, 'error')
      else { showToast(`Agenda ${grade} ${section} generada`, 'success'); await fetchAll() }
    } finally {
      setDashGenerating(prev => ({ ...prev, [key]: false }))
    }
  }

  async function generateAll() {
    if (gradePairs.length === 0) return
    setDashGenAll(true)
    try {
      const shared = await fetchSharedData(dashWeek)
      let ok = 0, fail = 0
      for (const { grade, section } of gradePairs) {
        const key      = `${grade}|${section}`
        const entries  = buildEntriesForPair(grade, section, shared.wDates, shared.holidayMap)
        const existing = agendaWeekMap[key]
        const payload  = {
          school_id:  teacher.school_id,
          grade, section,
          week_start: dashWeek,
          devotional: shared.devotional || null,
          content:    { entries },
          status:     existing?.status || 'draft',
          updated_at: new Date().toISOString(),
        }
        let error
        if (existing) {
          ;({ error } = await supabase.from('weekly_agendas').update(payload).eq('id', existing.id))
        } else {
          ;({ error } = await supabase.from('weekly_agendas').insert(payload))
        }
        if (error) fail++; else ok++
      }
      if (fail === 0) showToast(`✅ ${ok} agenda${ok !== 1 ? 's' : ''} generada${ok !== 1 ? 's' : ''}`, 'success')
      else showToast(`${ok} generadas, ${fail} con error`, 'warning')
      await fetchAll()
    } finally {
      setDashGenAll(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta agenda?')) return
    const { error } = await supabase.from('weekly_agendas').delete().eq('id', id)
    if (error) { showToast('Error al eliminar la agenda', 'error'); return }
    setAgendas(prev => prev.filter(a => a.id !== id))
  }

  // Director de grupo: entra directo al editor de su sección
  const isHomeroomTeacher = !!teacher.homeroom_grade && !canManageAllAgendas(teacher.role)

  // When homeroom teacher navigates weeks in the editor, reload the correct agenda
  const [homeroomWeek, setHomeroomWeek] = useState(todayMonday)

  useEffect(() => {
    if (!loading && isHomeroomTeacher) {
      const week     = homeroomWeek
      const existing = agendas.find(a =>
        a.grade === teacher.homeroom_grade &&
        a.section === teacher.homeroom_section &&
        a.week_start === week
      )
      if (existing) {
        setEditing({ ...existing, content: { entries: [], ...existing.content } })
      } else {
        setEditing({
          id: null,
          grade:      teacher.homeroom_grade,
          section:    teacher.homeroom_section,
          week_start: week,
          period:     null, devotional: '', notes: '',
          content:    { entries: [] }, status: 'draft',
        })
      }
      if (view === 'list') setView('edit')
    }
  }, [loading, isHomeroomTeacher, homeroomWeek])

  if (loading) return (
    <div className="ge-loading"><div className="loading-spinner" /><p>Cargando agendas…</p></div>
  )

  if (view === 'preview' && previewing) {
    const previewKey = `${previewing.grade}|${previewing.section}`
    const previewAgenda = agendaWeekMap[previewKey] || previewing.agenda
    return (
      <AgendaViewer
        grade={previewing.grade}
        section={previewing.section}
        week_start={previewing.week_start}
        agenda={previewAgenda}
        teacher={teacher}
        schoolAssignments={schoolAssignments}
        allTeachers={allTeachers}
        allPlans={allPlans}
        onEdit={previewAgenda ? () => openEdit(previewAgenda) : null}
        onGenerate={!previewAgenda ? () => {
          generateOne(previewing.grade, previewing.section).then(() => {
            const newKey = `${previewing.grade}|${previewing.section}`
            setPreviewing(p => ({ ...p, agenda: agendaWeekMap[newKey] || null }))
          })
        } : null}
        onBack={() => setView('list')}
      />
    )
  }

  if (view === 'edit' && editing) {
    return (
      <AgendaEditor
        agenda={editing}
        teacher={teacher}
        allPlans={allPlans}
        allTeachers={allTeachers}
        schoolAssignments={schoolAssignments}
        isHomeroomTeacher={isHomeroomTeacher}
        onWeekChange={isHomeroomTeacher ? (w) => setHomeroomWeek(w) : null}
        onSave={async () => { await fetchAll(); if (!isHomeroomTeacher) setView('list') }}
        onCancel={isHomeroomTeacher ? null : () => setView('list')}
      />
    )
  }

  // ── Dashboard / list view ─────────────────────────────────────────────────
  const generatedCount = Object.keys(agendaWeekMap).length

  return (
    <div className="planner-wrap">
      <div className="card">

        {/* Header */}
        <div className="card-title">
          <div className="badge">📋</div>
          Agenda Semanal
        </div>

        {/* Week navigator + generate-all */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          background: '#f0f4ff', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
        }}>
          <button className="btn-secondary" style={{ fontSize: '13px', padding: '4px 12px', lineHeight: 1 }}
            onClick={() => setDashWeek(w => prevWeek(w))}>‹</button>
          <div style={{ fontWeight: 700, fontSize: '13px', color: '#1F3864', minWidth: '210px', textAlign: 'center' }}>
            Semana del {formatWeekRange(dashWeek)}
          </div>
          <button className="btn-secondary" style={{ fontSize: '13px', padding: '4px 12px', lineHeight: 1 }}
            onClick={() => setDashWeek(w => nextWeek(w))}>›</button>
          <button className="btn-secondary" style={{ fontSize: '11px', padding: '3px 10px' }}
            onClick={() => setDashWeek(todayMonday())}>Hoy</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#888' }}>
              {generatedCount}/{gradePairs.length} generadas esta semana
            </span>
            <button className="btn-primary" style={{ fontSize: '11px' }}
              onClick={generateAll}
              disabled={dashGenAll || gradePairs.length === 0}>
              {dashGenAll ? '⏳ Generando…' : '🚀 Generar todas'}
            </button>
          </div>
        </div>

        {/* Grid of grade+section pairs */}
        {gradePairs.length === 0 ? (
          <div className="empty-state">
            No hay grados/secciones configurados.{' '}
            <span style={{ fontSize: '11px', color: '#aaa' }}>
              Configura asignaciones en Panel de Control → Docentes y materias.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {gradePairs.map(({ grade, section }) => {
              const key       = `${grade}|${section}`
              const coverage  = planCoverageMap[key] || { total: 0, covered: 0 }
              const existing  = agendaWeekMap[key]
              const st        = existing ? (STATUS_CFG[existing.status] || STATUS_CFG.draft) : null
              const isGenning = !!dashGenerating[key]
              const pct       = coverage.total > 0 ? Math.round((coverage.covered / coverage.total) * 100) : 0
              const barColor  = pct === 100 ? '#9BBB59' : pct >= 50 ? '#F79646' : '#dde5f0'

              return (
                <div key={key}
                  onClick={() => openPreview(grade, section)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '10px 16px', borderRadius: '10px',
                    border: `1.5px solid ${existing ? '#bfcfff' : '#dde5f0'}`,
                    background: existing ? '#fafbff' : '#fff',
                    cursor: 'pointer', transition: 'box-shadow .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 10px rgba(46,85,152,.12)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >

                  {/* Grade + section */}
                  <div style={{ minWidth: '88px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#1F3864' }}>{grade}</div>
                    <div style={{ fontSize: '11px', color: '#2E5598', fontWeight: 600 }}>{section}</div>
                  </div>

                  {/* Plan coverage */}
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '3px' }}>
                      {coverage.covered}/{coverage.total} materias con guía
                    </div>
                    <div style={{ height: '5px', borderRadius: '3px', background: '#e0e0e0', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '3px', background: barColor,
                        width: `${pct}%`, transition: 'width .3s',
                      }} />
                    </div>
                  </div>

                  {/* Status badge */}
                  {st ? (
                    <span style={{
                      padding: '3px 10px', borderRadius: '10px', fontSize: '11px',
                      fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap',
                    }}>{st.label}</span>
                  ) : (
                    <span style={{
                      padding: '3px 10px', borderRadius: '10px', fontSize: '11px',
                      fontWeight: 500, background: '#f5f5f5', color: '#bbb', whiteSpace: 'nowrap',
                    }}>Sin agenda</span>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}
                    onClick={e => e.stopPropagation()}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => openPreview(grade, section)}
                      title="Ver agenda">
                      👁 Ver
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px' }}
                      onClick={() => generateOne(grade, section)}
                      disabled={isGenning || dashGenAll}
                      title={existing ? 'Actualizar desde guías' : 'Generar desde guías'}
                    >
                      {isGenning ? '⏳' : existing ? '🔄' : '⚡'}
                    </button>
                    {existing && (
                      <>
                        <button className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}
                          onClick={() => openEdit(existing)}>
                          ✏️
                        </button>
                        <button className="btn-icon-danger"
                          onClick={e => { e.stopPropagation(); handleDelete(existing.id) }}
                          title="Eliminar agenda">🗑</button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Manual create */}
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #eee',
          display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={openNew}>
            + Nueva agenda manual
          </button>
          <span style={{ fontSize: '11px', color: '#aaa' }}>
            Para casos especiales fuera de la generación automática
          </span>
        </div>

      </div>
    </div>
  )
}

// ── AgendaEditor ──────────────────────────────────────────────────────────────
function AgendaEditor({ agenda, teacher, allPlans, allTeachers, schoolAssignments, isHomeroomTeacher, onWeekChange, onSave, onCancel }) {
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
    setEntries(prev => [...prev, { subject: '', teacher_name: '', schedule: {}, days: {} }])
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
      const SCHED_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri']
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
        const t    = teacherMap[asgn.teacher_id]
        const plan = planMap[asgn.subject]
        const days = {}

        weekDatesArr.forEach((date, idx) => {
          if (holidayMap[date]) return
          // Only populate days this subject actually meets
          const schedKey = SCHED_KEYS[idx]
          const hasClass = asgn.schedule?.[schedKey]?.length > 0
          if (!hasClass) return

          const dayData = plan?.content?.days?.[date]
          const parts   = []

          const unit       = dayData?.unit
          const activity   = htmlToText(
            dayData?.sections?.activity?.content ||
            dayData?.sections?.skill?.content || ''
          ).slice(0, 140)
          const assignment = htmlToText(
            dayData?.sections?.assignment?.content || ''
          ).slice(0, 160)

          if (unit)       parts.push(`📌 ${unit}`)
          if (activity)   parts.push(`📝 ${activity}`)
          if (assignment) parts.push(`📚 ${assignment}`)

          days[date] = parts.join('\n') || ''
        })

        return {
          subject:      asgn.subject,
          teacher_name: t?.full_name?.split(' ').slice(0, 2).join(' ') || '',
          schedule:     asgn.schedule || {},
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

    const SCHED_KEYS_PDF = ['mon','tue','wed','thu','fri']
    const entryRows = entries.filter(e => e.subject).map(e => {
      const dayCells = activeDates.map(d => {
        const di       = weekDates.indexOf(d)
        const schedKey = SCHED_KEYS_PDF[di]
        const hasClass = e.schedule && Object.keys(e.schedule).length > 0
          ? (e.schedule[schedKey]?.length > 0) : true
        const cellContent = hasClass ? (e.days?.[d] || '').replace(/\n/g, '<br>') : ''
        const cellBg = hasClass ? '' : 'background:#f5f5f5;'
        return `<td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;vertical-align:top;min-width:90px;${cellBg}">${hasClass ? cellContent : '<span style="color:#ccc">—</span>'}</td>`
      }).join('')
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
          {onCancel && (
            <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={onCancel}>← Volver</button>
          )}
          <div className="badge" style={{ marginLeft: onCancel ? '8px' : '0' }}>
            {isHomeroomTeacher ? '🏠' : '📋'}
          </div>
          {isHomeroomTeacher
            ? `Mi Grupo — ${form.grade} ${form.section}`
            : form.id ? 'Editar agenda' : 'Nueva agenda'}
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

        {/* Homeroom banner */}
        {isHomeroomTeacher && (
          <div style={{
            background: '#f0f7ee', border: '1px solid #9BBB59', borderRadius: '8px',
            padding: '8px 14px', marginBottom: '14px', fontSize: '12px', color: '#3a6b1a',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontWeight: 700 }}>🏠 Director de Grupo</span>
            <span>·</span>
            <span>{form.grade} {form.section} · Semana del {form.week_start ? formatWeekRange(form.week_start) : '—'}</span>
          </div>
        )}

        {/* Week navigation for homeroom teachers */}
        {isHomeroomTeacher && onWeekChange && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '14px', background: '#f0f4ff',
            padding: '8px 12px', borderRadius: '8px',
          }}>
            <button className="btn-secondary" style={{ fontSize: '12px', padding: '3px 10px', lineHeight: 1 }}
              onClick={() => onWeekChange(prevWeek(form.week_start))}>‹</button>
            <div style={{ fontWeight: 700, fontSize: '12px', color: '#1F3864', flex: 1, textAlign: 'center' }}>
              Semana del {form.week_start ? formatWeekRange(form.week_start) : '—'}
            </div>
            <button className="btn-secondary" style={{ fontSize: '12px', padding: '3px 10px', lineHeight: 1 }}
              onClick={() => onWeekChange(nextWeek(form.week_start))}>›</button>
            <button className="btn-secondary" style={{ fontSize: '10px', padding: '2px 8px' }}
              onClick={() => onWeekChange(todayMonday())}>Hoy</button>
          </div>
        )}

        {/* Identity fields */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {!isHomeroomTeacher && (
            <>
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
            </>
          )}
          <div className="form-field" style={{ flex: 1, minWidth: 120 }}>
            <label>Período</label>
            <select value={form.period || ''} onChange={e => updateField('period', e.target.value ? Number(e.target.value) : null)}>
              <option value="">—</option>
              {ACADEMIC_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {!isHomeroomTeacher && (
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
          )}
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
                    {weekDates.map((d, di) => {
                      const isHoliday = !!holidays[d]
                      const schedKey  = ['mon','tue','wed','thu','fri'][di]
                      const hasClass  = entry.schedule && Object.keys(entry.schedule).length > 0
                        ? (entry.schedule[schedKey]?.length > 0)
                        : true // manual entries show all days
                      const inactive  = isHoliday || !hasClass
                      return (
                        <td key={d} style={{
                          padding: '4px', verticalAlign: 'top',
                          background: inactive ? '#f5f5f5' : 'transparent',
                        }}>
                          {inactive ? (
                            <div style={{ fontSize: '10px', color: '#ccc', textAlign: 'center', padding: '8px 4px' }}>
                              {isHoliday ? '🚫' : '—'}
                            </div>
                          ) : (
                            <textarea
                              value={entry.days?.[d] || ''}
                              rows={3}
                              onChange={e => updateEntryDay(idx, d, e.target.value)}
                              style={{ width: '100%', fontSize: '10px', padding: '4px 6px',
                                border: '1px solid #dde5f0', borderRadius: '4px',
                                resize: 'vertical', minWidth: '90px', lineHeight: 1.5 }}
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

// ── AgendaViewer ──────────────────────────────────────────────────────────────
// Read-only view of a weekly agenda. Works even when no agenda has been generated yet
// (shows the empty schedule structure so the coordinator can see what subjects are assigned).
function AgendaViewer({ grade, section, week_start, agenda, teacher, schoolAssignments, allTeachers, allPlans, onEdit, onGenerate, onBack }) {
  const { showToast } = useToast()
  const [holidays,  setHolidays]  = useState({})
  const [newsHitos, setNewsHitos] = useState([])
  const [loading,   setLoading]   = useState(true)

  const weekDates  = useMemo(() => getWeekDates(week_start), [week_start])
  const teacherMap = useMemo(() => {
    const m = {}; allTeachers.forEach(t => { m[t.id] = t }); return m
  }, [allTeachers])

  // Build display entries: use agenda entries if available, else build from assignments
  const entries = useMemo(() => {
    if (agenda?.content?.entries?.length > 0) return agenda.content.entries
    // Fallback: build skeleton from teacher_assignments
    return schoolAssignments
      .filter(a => a.grade === grade && a.section === section)
      .map(asgn => ({
        subject:      asgn.subject,
        teacher_name: teacherMap[asgn.teacher_id]?.full_name?.split(' ').slice(0, 2).join(' ') || '',
        schedule:     asgn.schedule || {},
        days:         {},
      }))
  }, [agenda, schoolAssignments, grade, section, teacherMap])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const weekDate = new Date(week_start + 'T12:00:00')
      const [{ data: calEntries }, { data: newsProjects }] = await Promise.all([
        supabase.from('school_calendar')
          .select('date, name, is_school_day')
          .eq('school_id', teacher.school_id)
          .in('date', weekDates),
        supabase.from('news_projects')
          .select('title, skill, actividades_evaluativas, due_date, subject')
          .eq('school_id', teacher.school_id),
      ])
      const hMap = {}
      ;(calEntries || []).filter(c => c.is_school_day === false).forEach(c => { hMap[c.date] = c.name })
      setHolidays(hMap)
      const hitos = []
      ;(newsProjects || []).forEach(p => {
        ;(p.actividades_evaluativas || []).forEach(act => {
          if (act.fecha && weekDates.includes(act.fecha))
            hitos.push({ fecha: act.fecha, nombre: act.nombre, porcentaje: act.porcentaje, skill: p.skill, projectTitle: p.title })
        })
        if (p.due_date && weekDates.includes(p.due_date))
          hitos.push({ fecha: p.due_date, nombre: `🏁 Entrega: ${p.title}`, skill: p.skill, isDelivery: true })
      })
      hitos.sort((a, b) => a.fecha.localeCompare(b.fecha))
      setNewsHitos(hitos)
      setLoading(false)
    }
    load()
  }, [week_start, teacher.school_id])

  // Subject color palette — cycles through a set of distinct colors
  const SUBJECT_COLORS = [
    '#2E5598', '#C0504D', '#9BBB59', '#F79646', '#8064A2',
    '#4BACC6', '#C9A84C', '#1A6B3A', '#B8860B', '#17375E',
  ]
  const subjectColorMap = useMemo(() => {
    const m = {}
    entries.forEach((e, i) => { m[e.subject] = SUBJECT_COLORS[i % SUBJECT_COLORS.length] })
    return m
  }, [entries])

  function exportViewerPdf() {
    const gradeLabel = `${grade} ${section}`
    const weekLabel  = formatWeekRange(week_start)
    const school     = teacher.schools?.name || teacher.school_name || ''
    const activeDates = weekDates.filter(d => !holidays[d])

    const dayHeaders = activeDates.map(d => {
      const idx = weekDates.indexOf(d)
      return `<th style="background:#2E5598;color:#fff;padding:8px 6px;font-size:11px;text-align:center;min-width:90px">
        ${DAYS[idx]?.label || ''}<br><span style="font-weight:400;font-size:10px">${formatDate(d)}</span>
      </th>`
    }).join('')

    const SCHED_KEYS_ALL = ['mon','tue','wed','thu','fri']
    const entryRows = entries.filter(e => e.subject).map((e, i) => {
      const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length]
      const dayCells = activeDates.map(d => {
        const di  = weekDates.indexOf(d)
        const key = SCHED_KEYS_ALL[di]
        const hasClass = e.schedule && Object.keys(e.schedule).length > 0
          ? (e.schedule[key]?.length > 0) : true
        const text = hasClass ? (e.days?.[d] || '').replace(/\n/g,'<br>') : ''
        return `<td style="padding:7px 8px;border:1px solid #e0e0e0;font-size:11px;vertical-align:top;
          background:${!hasClass ? '#f9f9f9' : 'transparent'}">
          ${hasClass ? (text || '<span style="color:#ddd">—</span>') : '<span style="color:#ccc">—</span>'}
        </td>`
      }).join('')
      return `<tr>
        <td style="padding:7px 10px;border:1px solid #e0e0e0;font-weight:700;font-size:11px;
          white-space:nowrap;color:${color};border-left:3px solid ${color}">${e.subject}</td>
        <td style="padding:7px 8px;border:1px solid #e0e0e0;font-size:10px;color:#777;white-space:nowrap">${e.teacher_name || ''}</td>
        ${dayCells}
      </tr>`
    }).join('')

    const devHtml = agenda?.devotional ? `
      <div style="background:#eef2ff;border-left:4px solid #2E5598;padding:10px 14px;
        margin-bottom:14px;border-radius:0 6px 6px 0;font-size:12px;white-space:pre-wrap">
        ✝ <strong>Devoción de la semana</strong><br>${agenda.devotional}
      </div>` : ''

    const hitosHtml = newsHitos.length ? `
      <div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#1F3864;margin-bottom:5px">📌 Actividades evaluativas esta semana</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${newsHitos.map(h => `<span style="font-size:10px;padding:2px 10px;border-radius:12px;
            background:${(SKILL_COLOR[h.skill]||'#1A3A8F')+'20'};border:1px solid ${(SKILL_COLOR[h.skill]||'#1A3A8F')+'50'};
            color:${SKILL_COLOR[h.skill]||'#1A3A8F'};font-weight:600">${h.nombre} · ${formatDate(h.fecha)}</span>`).join('')}
        </div>
      </div>` : ''

    const notesHtml = agenda?.notes ? `
      <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:6px;
        padding:10px 14px;margin-top:14px;font-size:12px">
        📝 <strong>Notas para los padres:</strong><br>${agenda.notes}
      </div>` : ''

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Agenda Semanal — ${gradeLabel}</title>
<style>
  body{font-family:Arial,sans-serif;margin:20px;color:#222}
  h1{font-size:18px;color:#1F3864;margin:0 0 2px}
  .sub{font-size:12px;color:#666;margin-bottom:14px}
  table{width:100%;border-collapse:collapse}
  @media print{body{margin:10mm}.no-print{display:none}}
</style></head><body>
<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
  <div>
    <h1>📋 Agenda Semanal — ${gradeLabel}</h1>
    <div class="sub">${school} · Semana del ${weekLabel}${agenda?.period ? ' · Período ' + agenda.period : ''}</div>
  </div>
</div>
${Object.entries(holidays).length ? `<div style="background:#fff8f0;border-left:3px solid #f59e0b;padding:7px 12px;
  margin-bottom:12px;font-size:11px;border-radius:0 5px 5px 0">
  🗓 <strong>Días no laborables:</strong> ${Object.entries(holidays).map(([d,n])=>`<strong>${formatDate(d)}</strong> — ${n}`).join(' · ')}
</div>` : ''}
${devHtml}${hitosHtml}
<table>
  <thead><tr>
    <th style="background:#1F3864;color:#fff;padding:8px 10px;font-size:11px;text-align:left;width:130px">Materia</th>
    <th style="background:#1F3864;color:#fff;padding:8px;font-size:11px;width:110px">Docente</th>
    ${dayHeaders}
  </tr></thead>
  <tbody>${entryRows}</tbody>
</table>
${notesHtml}
<button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;right:20px;
  background:#C0504D;color:#fff;border:none;border-radius:50px;padding:10px 20px;
  font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.2)">🖨️ Guardar como PDF</button>
</body></html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  const activeDates = weekDates.filter(d => !holidays[d])
  const SCHED_KEYS  = ['mon','tue','wed','thu','fri']
  const hasContent  = entries.some(e => Object.values(e.days || {}).some(v => v))

  return (
    <div className="planner-wrap">
      <div className="card">

        {/* Top bar */}
        <div className="card-title" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={onBack}>← Volver</button>
          <div className="badge">📋</div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#1F3864' }}>
            {grade} <span style={{ color: '#2E5598' }}>{section}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginLeft: 4 }}>
            · Semana del {formatWeekRange(week_start)}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {agenda && (
              <span style={{
                fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '10px',
                background: (STATUS_CFG[agenda.status] || STATUS_CFG.draft).bg,
                color: (STATUS_CFG[agenda.status] || STATUS_CFG.draft).color,
              }}>
                {(STATUS_CFG[agenda.status] || STATUS_CFG.draft).label}
              </span>
            )}
            <button className="btn-secondary" style={{ fontSize: '11px' }}
              onClick={exportViewerPdf}
              disabled={loading || entries.length === 0}>
              🖨️ PDF
            </button>
            {onGenerate && (
              <button className="btn-secondary" style={{ fontSize: '11px' }} onClick={onGenerate}>
                ⚡ Generar
              </button>
            )}
            {onEdit && (
              <button className="btn-primary" style={{ fontSize: '11px' }} onClick={onEdit}>
                ✏️ Editar
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 0',
            fontSize: '13px', color: '#888' }}>
            <div className="loading-spinner" style={{ width: 18, height: 18 }} />
            Cargando contexto de la semana…
          </div>
        ) : (
          <>
            {/* No agenda banner */}
            {!agenda && (
              <div style={{
                background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '8px',
                padding: '10px 16px', marginBottom: '14px', fontSize: '12px', color: '#92400e',
                display: 'flex', alignItems: 'center', gap: '10px',
              }}>
                <span>⚠️ No hay agenda generada para esta semana.</span>
                {onGenerate && (
                  <button className="btn-primary" style={{ fontSize: '11px' }} onClick={onGenerate}>
                    ⚡ Generar desde guías
                  </button>
                )}
                <span style={{ color: '#b45309', fontSize: '11px' }}>
                  Mostrando estructura de materias asignadas.
                </span>
              </div>
            )}

            {/* Holidays */}
            {Object.keys(holidays).length > 0 && (
              <div style={{
                background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '8px',
                padding: '8px 14px', marginBottom: '12px', fontSize: '12px', color: '#92400e',
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

            {/* Devotional */}
            {agenda?.devotional && (
              <div style={{
                background: '#eef2ff', borderLeft: '4px solid #2E5598', borderRadius: '0 8px 8px 0',
                padding: '10px 16px', marginBottom: '14px',
              }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#1F3864',
                  textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '5px' }}>
                  ✝ Devoción de la semana
                </div>
                <div style={{ fontSize: '13px', color: '#2E5598', fontStyle: 'italic',
                  lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {agenda.devotional}
                </div>
              </div>
            )}

            {/* NEWS hitos */}
            {newsHitos.length > 0 && (
              <div style={{
                background: '#f0f4ff', border: '1px solid #bfcfff', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '14px',
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
                        background: color + '18', border: `1px solid ${color}50`, color, fontWeight: 700,
                      }}>
                        {h.nombre}{h.porcentaje > 0 && ` (${h.porcentaje}%)`} · {formatDate(h.fecha)}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Main weekly table */}
            {entries.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px' }}>
                No hay materias asignadas para {grade} {section}.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{
                        background: '#1F3864', color: '#fff', padding: '9px 12px',
                        textAlign: 'left', fontSize: '11px', fontWeight: 700,
                        width: '130px', borderRadius: '6px 0 0 0',
                      }}>Materia</th>
                      <th style={{
                        background: '#1F3864', color: '#fff', padding: '9px 8px',
                        fontSize: '11px', textAlign: 'center', width: '100px',
                      }}>Docente</th>
                      {weekDates.map((d, i) => {
                        const isHol = !!holidays[d]
                        const dayHitos = newsHitos.filter(h => h.fecha === d)
                        return (
                          <th key={d} style={{
                            background: isHol ? '#b0b8c8' : '#2E5598', color: '#fff',
                            padding: '9px 8px', fontSize: '11px', textAlign: 'center',
                            minWidth: '120px',
                            ...(i === 4 ? { borderRadius: '0 6px 0 0' } : {}),
                          }}>
                            <div style={{ fontWeight: 700 }}>{DAYS[i]?.label || ''}</div>
                            <div style={{ fontWeight: 400, fontSize: '10px', opacity: .85 }}>{formatDate(d)}</div>
                            {isHol && (
                              <div style={{ fontSize: '9px', fontWeight: 600, marginTop: '2px',
                                background: 'rgba(0,0,0,.15)', borderRadius: '3px', padding: '1px 4px' }}>
                                🚫 {holidays[d].slice(0, 16)}
                              </div>
                            )}
                            {dayHitos.map((h, j) => (
                              <div key={j} style={{
                                fontSize: '9px', fontWeight: 700, marginTop: '2px',
                                background: 'rgba(255,255,255,.18)', borderRadius: '3px', padding: '1px 4px',
                                color: '#fff',
                              }}>
                                📌 {h.nombre.length > 14 ? h.nombre.slice(0, 14) + '…' : h.nombre}
                              </div>
                            ))}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => {
                      const color = subjectColorMap[entry.subject] || '#2E5598'
                      return (
                        <tr key={idx} style={{ background: idx % 2 === 0 ? '#fafbff' : '#fff' }}>
                          {/* Subject */}
                          <td style={{
                            padding: '8px 10px', borderBottom: '1px solid #eef0f8',
                            borderLeft: `3px solid ${color}`,
                          }}>
                            <div style={{ fontWeight: 700, fontSize: '12px', color }}>{entry.subject}</div>
                          </td>
                          {/* Teacher */}
                          <td style={{
                            padding: '8px', borderBottom: '1px solid #eef0f8',
                            fontSize: '10px', color: '#777', textAlign: 'center', verticalAlign: 'top',
                          }}>
                            {entry.teacher_name || '—'}
                          </td>
                          {/* Day cells */}
                          {weekDates.map((d, di) => {
                            const isHol    = !!holidays[d]
                            const schedKey = SCHED_KEYS[di]
                            const hasClass = entry.schedule && Object.keys(entry.schedule).length > 0
                              ? (entry.schedule[schedKey]?.length > 0) : true
                            const inactive  = isHol || !hasClass
                            const cellText  = entry.days?.[d] || ''
                            return (
                              <td key={d} style={{
                                padding: inactive ? '8px' : '8px 10px',
                                borderBottom: '1px solid #eef0f8',
                                background: inactive ? '#f4f6fb' : 'transparent',
                                verticalAlign: 'top',
                                fontSize: '12px', color: '#333', lineHeight: 1.5,
                              }}>
                                {inactive ? (
                                  <span style={{ color: '#ccc', fontSize: '11px' }}>
                                    {isHol ? '🚫' : '—'}
                                  </span>
                                ) : cellText ? (
                                  <div style={{ whiteSpace: 'pre-wrap' }}>
                                    {cellText.split('\n').map((line, li) => {
                                      const icon = line.startsWith('📌') ? color :
                                                   line.startsWith('📝') ? '#333' :
                                                   line.startsWith('📚') ? '#555' : '#333'
                                      return (
                                        <div key={li} style={{
                                          color: icon,
                                          fontWeight: line.startsWith('📌') ? 600 : 400,
                                          marginBottom: li < cellText.split('\n').length - 1 ? '4px' : 0,
                                        }}>
                                          {line}
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <span style={{ color: '#ddd', fontSize: '11px' }}>—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes */}
            {agenda?.notes && (
              <div style={{
                marginTop: '16px', background: '#f9f9f9', border: '1px solid #e8e8e8',
                borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#555',
                lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, color: '#1F3864', marginBottom: '5px' }}>
                  📝 Notas para los padres
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{agenda.notes}</div>
              </div>
            )}

            {/* Footer metadata */}
            {agenda?.updated_at && (
              <div style={{ marginTop: '12px', fontSize: '10px', color: '#bbb', textAlign: 'right' }}>
                Última actualización: {new Date(agenda.updated_at).toLocaleString('es-CO', {
                  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
