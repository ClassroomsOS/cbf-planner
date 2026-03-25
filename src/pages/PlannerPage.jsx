import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

// ── Date helpers (same as before) ────────────────────────────────────────────
function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(monday) {
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })
}

function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getSchoolWeek(monday) {
  const firstMonday = getMondayOf(new Date(monday.getFullYear(), 1, 2))
  const diff = Math.floor((monday - firstMonday) / (7 * 24 * 3600 * 1000))
  return Math.max(1, diff + 1)
}

const MONTHS_ES = ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.']
const DAYS_ES   = ['Lun','Mar','Mié','Jue','Vie']

function formatRange(days) {
  if (!days.length) return ''
  const first = days[0], last = days[days.length - 1]
  const m1 = MONTHS_ES[first.getMonth()], m2 = MONTHS_ES[last.getMonth()]
  if (m1 === m2) return `${m1} ${first.getDate()}–${last.getDate()}, ${first.getFullYear()}`
  return `${m1} ${first.getDate()} – ${m2} ${last.getDate()}, ${last.getFullYear()}`
}

function toWeekInputValue(monday) {
  const d = new Date(monday)
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function fromWeekInputValue(val) {
  if (!val) return getMondayOf(new Date())
  const [year, week] = val.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  const startOfWeek1 = getMondayOf(jan4)
  const monday = new Date(startOfWeek1)
  monday.setDate(startOfWeek1.getDate() + (week - 1) * 7)
  return monday
}

// ─────────────────────────────────────────────────────────────────────────────

export default function PlannerPage({ teacher }) {
  const school        = teacher.schools || {}
  const classSubjects = teacher.class_subjects || []
  const allSubjects   = teacher.subjects || []
  const classLabels   = classSubjects.map(cs => `${cs.grade} ${cs.section}`)
  const navigate      = useNavigate()

  const [grade,   setGrade]   = useState(teacher.default_class   || '')
  const [subject, setSubject] = useState(teacher.default_subject || '')
  const [period,  setPeriod]  = useState(teacher.default_period  || '1.er Período 2026')
  const [monday,  setMonday]  = useState(() => getMondayOf(new Date()))
  const [calData, setCalData] = useState({})
  const [calLoading, setCalLoading] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [error,    setError]        = useState(null)

  const weekDays   = getWeekDays(monday)
  const weekNumber = getSchoolWeek(monday)
  const dateRange  = formatRange(weekDays)

  const selectedEntry     = classSubjects.find(cs => `${cs.grade} ${cs.section}` === grade)
  const availableSubjects = selectedEntry?.subjects?.length ? selectedEntry.subjects : allSubjects

  useEffect(() => {
    if (subject && !availableSubjects.includes(subject)) setSubject('')
  }, [grade])

  useEffect(() => {
    async function fetchCalendar() {
      setCalLoading(true)
      const dates = weekDays.map(toISO)
      const { data } = await supabase
        .from('school_calendar')
        .select('date, name, type, is_school_day')
        .eq('school_id', teacher.school_id)
        .in('date', dates)
      const map = {}
      if (data) data.forEach(row => { map[row.date] = row })
      setCalData(map)
      setCalLoading(false)
    }
    fetchCalendar()
  }, [monday])

  const activeDays = weekDays.filter(d => {
    const cal = calData[toISO(d)]
    return !cal || cal.is_school_day !== false
  })

  async function handleCreateGuide() {
    if (!grade || !subject) return
    setCreating(true)
    setError(null)

    // Check if a plan already exists for this teacher/grade/subject/week
    const { data: existing } = await supabase
      .from('lesson_plans')
      .select('id')
      .eq('teacher_id', teacher.id)
      .eq('grade',       grade)
      .eq('subject',     subject)
      .eq('week_number', weekNumber)
      .maybeSingle()

    if (existing) {
      // Open existing plan
      navigate(`/editor/${existing.id}`)
      return
    }

    // Create new plan
    const { data: newPlan, error: insertError } = await supabase
      .from('lesson_plans')
      .insert({
        teacher_id:  teacher.id,
        school_id:   teacher.school_id,
        grade,
        subject,
        period,
        week_number: weekNumber,
        date_range:  dateRange,
        status:      'draft',
        content:     {},
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setCreating(false); return }
    navigate(`/editor/${newPlan.id}`)
  }

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">📋</div>
          Nueva Guía de Aprendizaje
        </div>

        {/* Clase + Asignatura + Período + Semana */}
        <div className="g4">
          <div className="field">
            <label>Grado / Clase</label>
            <select value={grade} onChange={e => setGrade(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {classLabels.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Asignatura</label>
            <select value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {availableSubjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Período</label>
            <select value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="1.er Período 2026">1.er Período 2026</option>
              <option value="2.do Período 2026">2.do Período 2026</option>
              <option value="3.er Período 2026">3.er Período 2026</option>
              <option value="4.to Período 2026">4.to Período 2026</option>
            </select>
          </div>
          <div className="field">
            <label>Semana N°</label>
            <input type="text" readOnly value={`Semana ${weekNumber}`}
              style={{ background: '#f0f4ff', fontWeight: 700, color: '#2E5598', cursor: 'default' }} />
          </div>
        </div>

        {/* Week picker */}
        <div className="week-picker-section">
          <div className="week-nav">
            <button className="btn-week-nav"
              onClick={() => { const d = new Date(monday); d.setDate(d.getDate()-7); setMonday(d) }}>‹</button>
            <div className="week-input-wrap">
              <label>Semana del</label>
              <input type="week" value={toWeekInputValue(monday)}
                onChange={e => setMonday(fromWeekInputValue(e.target.value))} />
            </div>
            <button className="btn-week-nav"
              onClick={() => { const d = new Date(monday); d.setDate(d.getDate()+7); setMonday(d) }}>›</button>
          </div>

          {/* Mini calendar */}
          <div className="week-calendar">
            {weekDays.map((d, i) => {
              const iso = toISO(d)
              const cal = calData[iso]
              const isHoliday = cal && cal.is_school_day === false
              return (
                <div key={iso} className={`wc-day ${isHoliday ? 'wc-holiday' : 'wc-active'}`}>
                  <div className="wc-day-name">{DAYS_ES[i]}</div>
                  <div className="wc-day-num">{d.getDate()}</div>
                  <div className="wc-day-month">{MONTHS_ES[d.getMonth()]}</div>
                  {calLoading ? (
                    <div className="wc-tag wc-loading">…</div>
                  ) : isHoliday ? (
                    <div className="wc-tag wc-tag-holiday" title={cal.name}>
                      🚫 {cal.name.length > 13 ? cal.name.slice(0, 12) + '…' : cal.name}
                    </div>
                  ) : (
                    <div className="wc-tag wc-tag-active">✓ Clase</div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="week-summary">
            <span className="week-range">📅 {dateRange}</span>
            <span className="week-active-count">
              {activeDays.length} día{activeDays.length !== 1 ? 's' : ''} de clase
              {weekDays.length - activeDays.length > 0 &&
                ` · ${weekDays.length - activeDays.length} festivo${weekDays.length - activeDays.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </div>

        {/* Versículo */}
        <div className="verse-box">
          {school.year_verse}
          <span className="verse-ref">— {school.year_verse_ref}</span>
        </div>

        {error && <div className="alert alert-error">⚠️ {error}</div>}

        <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
          <button
            className="btn-primary btn-save"
            onClick={handleCreateGuide}
            disabled={creating || !grade || !subject}>
            {creating ? '⏳ Creando…' : '✏️ Crear / Abrir guía →'}
          </button>
        </div>
      </div>
    </div>
  )
}
