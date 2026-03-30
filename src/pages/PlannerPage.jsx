import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { AIGeneratorModal } from '../components/AIComponents'
import CheckpointModal from '../components/CheckpointModal'

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
/* 
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
*/
// ─────────────────────────────────────────────────────────────────────────────

export default function PlannerPage({ teacher }) {
  const school   = teacher.schools || {}
  const navigate = useNavigate()

  // Fetch assignments from teacher_assignments (admin-controlled)
  const [assignments, setAssignments] = useState([])
  useEffect(() => {
    supabase.from('teacher_assignments')
      .select('*')
      .eq('teacher_id', teacher.id)
      .then(({ data }) => setAssignments(data || []))
  }, [teacher.id])

  // Derive class labels and subjects from assignments
  const classLabels = [...new Set(assignments.map(a => `${a.grade} ${a.section}`))]

  const [grade,     setGrade]     = useState(teacher.default_class   || '')
  const [subject,   setSubject]   = useState(teacher.default_subject || '')
  const [period,    setPeriod]    = useState(teacher.default_period  || '1.er Período 2026')
  const [monday,    setMonday]    = useState(() => getMondayOf(new Date()))
  const [weekCount, setWeekCount] = useState(1)
  const [calData,   setCalData]   = useState({})
  const [calLoading, setCalLoading] = useState(false)
  const [creating, setCreating]     = useState(false)
  const [error,    setError]        = useState(null)
  const [showGenerator, setShowGenerator] = useState(false)
  // ── Checkpoint state ──
  const [checkpointData, setCheckpointData] = useState(null)
  // checkpointData = { previousPlan, target, pendingAction } | null

  const monday2     = (() => { const d = new Date(monday); d.setDate(d.getDate() + 7); return d })()
  const week1Days   = getWeekDays(monday)
  const week2Days   = getWeekDays(monday2)
  const allWeekDays = weekCount === 2 ? [...week1Days, ...week2Days] : week1Days
  const weekNumber  = getSchoolWeek(monday)
  const dateRange   = formatRange(allWeekDays)

  // Subjects available for selected class (from assignments)
  const availableSubjects = grade
    ? assignments.filter(a => `${a.grade} ${a.section}` === grade).map(a => a.subject)
    : []

  const selectedAssignment = assignments.find(a => `${a.grade} ${a.section}` === grade && a.subject === subject)
  const section = selectedAssignment?.section || ''
  const DAY_KEY_MAP = ['mon','tue','wed','thu','fri']

  useEffect(() => {
    if (subject && !availableSubjects.includes(subject)) setSubject('')
  }, [grade])

  useEffect(() => {
    async function fetchCalendar() {
      setCalLoading(true)
      const dates = allWeekDays.map(toISO)
      if (!dates.length) { setCalData({}); setCalLoading(false); return }
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
  }, [monday, weekCount])

  const activeDays = allWeekDays.filter((d, i) => {
    const cal = calData[toISO(d)]
    if (cal && cal.is_school_day === false) return false
    const dayIndexInWeek = i % 5
    if (selectedAssignment?.schedule && Object.keys(selectedAssignment.schedule).length > 0) {
      return !!selectedAssignment.schedule[DAY_KEY_MAP[dayIndexInWeek]]
    }
    return true
  })

  // ── Check for pending checkpoint from previous week ──
  async function checkPendingCheckpoint(action) {
    const prevWeek = weekNumber - 1
    if (prevWeek < 1) return null

    // Find previous week's plan for the same grade/subject
    const { data: prevPlan } = await supabase
      .from('lesson_plans')
      .select('id, week_number, grade, subject, section, target_id')
      .eq('teacher_id', teacher.id)
      .eq('grade', grade)
      .eq('subject', subject)
      .eq('week_number', prevWeek)
      .not('target_id', 'is', null)
      .maybeSingle()

    if (!prevPlan) return null

    // Check if checkpoint already exists
    const { data: existingCheckpoint } = await supabase
      .from('checkpoints')
      .select('id')
      .eq('target_id', prevPlan.target_id)
      .eq('teacher_id', teacher.id)
      .eq('week_number', prevWeek)
      .maybeSingle()

    if (existingCheckpoint) return null

    // Fetch the target details
    const { data: target } = await supabase
      .from('learning_targets')
      .select('id, description, taxonomy')
      .eq('id', prevPlan.target_id)
      .single()

    if (!target) return null

    return { previousPlan: prevPlan, target, pendingAction: action }
  }

  // ── Core guide creation / navigation ──
  async function doCreateGuide() {
    setCreating(true)
    setError(null)

    const { data: existing } = await supabase
      .from('lesson_plans')
      .select('id')
      .eq('teacher_id', teacher.id)
      .eq('grade',       grade)
      .eq('subject',     subject)
      .eq('week_number', weekNumber)
      .maybeSingle()

    if (existing) {
      navigate(`/editor/${existing.id}`)
      return
    }

    const { data: newPlan, error: insertError } = await supabase
      .from('lesson_plans')
      .insert({
        teacher_id:  teacher.id,
        school_id:   teacher.school_id,
        grade, subject, section, period,
        week_number: weekNumber,
        week_count:  weekCount,
        monday_date: toISO(monday),
        date_range:  dateRange,
        status:      'draft',
        content:     {},
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); setCreating(false); return }
    navigate(`/editor/${newPlan.id}`)
  }

  // ── Entry point: check checkpoint first, then create guide ──
  async function handleCreateGuide() {
    if (!grade || !subject) return
    setCreating(true)
    setError(null)

    const pending = await checkPendingCheckpoint('create')
    if (pending) {
      setCheckpointData(pending)
      setCreating(false)
      return
    }

    await doCreateGuide()
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
            <input type="text" readOnly value={weekCount === 2 ? `Sem. ${weekNumber}–${weekNumber + 1}` : `Semana ${weekNumber}`}
              style={{ background: '#f0f4ff', fontWeight: 700, color: '#2E5598', cursor: 'default' }} />
          </div>
          <div className="field">
            <label>Duración</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2].map(n => (
                <button key={n}
                  onClick={() => setWeekCount(n)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: '8px', border: '2px solid',
                    borderColor: weekCount === n ? '#2E5598' : '#c5d5f0',
                    background: weekCount === n ? '#2E5598' : '#f0f4ff',
                    color: weekCount === n ? '#fff' : '#2E5598',
                    fontWeight: 700, cursor: 'pointer', fontSize: '13px',
                  }}>
                  {n} sem.
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Week picker */}
        <div className="week-picker-section">
          <div className="week-nav">
            <button className="btn-week-nav"
              onClick={() => { const d = new Date(monday); d.setDate(d.getDate()-7); setMonday(d) }}>‹</button>
            <div className="week-input-wrap">
              <label>Ir a semana del</label>
              <input
                type="date"
                value={toISO(monday)}
                onChange={e => {
                  if (e.target.value) setMonday(getMondayOf(new Date(e.target.value + 'T12:00:00')))
                }}
              />
            </div>
            <button className="btn-week-nav"
              onClick={() => { const d = new Date(monday); d.setDate(d.getDate()+7); setMonday(d) }}>›</button>
          </div>

          {/* Mini calendar */}
          {[week1Days, ...(weekCount === 2 ? [week2Days] : [])].map((wDays, wIdx) => (
            <div key={wIdx}>
              {weekCount === 2 && (
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#2E5598', margin: '8px 0 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Semana {weekNumber + wIdx}
                </div>
              )}
              <div className="week-calendar">
                {wDays.map((d, i) => {
                  const iso = toISO(d)
                  const cal = calData[iso]
                  const isHoliday = cal && cal.is_school_day === false
                  const isScheduled = !selectedAssignment?.schedule || !Object.keys(selectedAssignment.schedule).length || !!selectedAssignment.schedule[DAY_KEY_MAP[i]]
                  return (
                    <div key={iso} className={`wc-day ${isHoliday ? 'wc-holiday' : isScheduled ? 'wc-active' : 'wc-holiday'}`}>
                      <div className="wc-day-name">{DAYS_ES[i]}</div>
                      <div className="wc-day-num">{d.getDate()}</div>
                      <div className="wc-day-month">{MONTHS_ES[d.getMonth()]}</div>
                      {calLoading ? (
                        <div className="wc-tag wc-loading">…</div>
                      ) : isHoliday ? (
                        <div className="wc-tag wc-tag-holiday" title={cal.name}>
                          🚫 {cal.name.length > 13 ? cal.name.slice(0, 12) + '…' : cal.name}
                        </div>
                      ) : isScheduled ? (
                        <div className="wc-tag wc-tag-active">✓ Clase</div>
                      ) : (
                        <div className="wc-tag" style={{ background: '#e8e8e8', color: '#999' }}>— Sin clase</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="week-summary">
            <span className="week-range">📅 {dateRange}</span>
            <span className="week-active-count">
              {activeDays.length} día{activeDays.length !== 1 ? 's' : ''} de clase
              {allWeekDays.length - activeDays.length > 0 &&
                ` · ${allWeekDays.length - activeDays.length} sin clase`}
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
          {grade && subject && (
            <button
              className="btn-primary"
              style={{ background: '#8064A2' }}
              onClick={() => setShowGenerator(true)}
              disabled={creating}>
              🤖 Generar con IA
            </button>
          )}
        </div>
      </div>
      {showGenerator && (
        <AIGeneratorModal
          grade={grade}
          subject={subject}
          period={period}
          activeDays={activeDays.map(d => toISO(d))}
          onApply={async (aiResult) => {
            setShowGenerator(false)
            setCreating(true)
            // Create plan first
            const { data: existing } = await supabase
              .from('lesson_plans')
              .select('id')
              .eq('teacher_id', teacher.id)
              .eq('grade', grade)
              .eq('subject', subject)
              .eq('week_number', weekNumber)
              .maybeSingle()

            let planId = existing?.id

            if (!planId) {
              const { data: newPlan } = await supabase
                .from('lesson_plans')
                .insert({
                  teacher_id: teacher.id,
                  school_id:  teacher.school_id,
                  grade, subject, section, period,
                  week_number: weekNumber,
                  week_count:  weekCount,
                  monday_date: toISO(monday),
                  date_range:  dateRange,
                  status:      'draft',
                  content:     {},
                })
                .select().single()
              planId = newPlan?.id
            }

            if (planId) {
              // Fetch current content and merge AI generated
              const { data: planData } = await supabase
                .from('lesson_plans')
                .select('content')
                .eq('id', planId)
                .single()

              const currentContent = planData?.content || {}

              // Merge generated days into content
              const mergedDays = {}
              activeDays.forEach(d => {
                const iso = toISO(d)
                const existingDay = currentContent.days?.[iso] || buildEmptyDay(iso)
                const generatedDay = aiResult.days?.[iso] || {}
                // Merge sections
                const mergedSections = {}
                SECTIONS_KEYS.forEach(key => {
                  mergedSections[key] = {
                    ...(existingDay.sections?.[key] || { time: '', content: '', images: [], audios: [], videos: [], smartBlocks: [] }),
                    content: generatedDay.sections?.[key]?.content || existingDay.sections?.[key]?.content || '',
                  }
                })
                mergedDays[iso] = { ...existingDay, unit: generatedDay.unit || existingDay.unit, sections: mergedSections }
              })

              const newContent = {
                ...currentContent,
                days: mergedDays,
                objetivo: aiResult.objetivo ? {
                  ...currentContent.objetivo,
                  general:   aiResult.objetivo.general   || currentContent.objetivo?.general   || '',
                  indicador: aiResult.objetivo.indicador || currentContent.objetivo?.indicador || '',
                  principio: currentContent.objetivo?.principio || '',
                } : currentContent.objetivo,
                summary: aiResult.summary ? {
                  ...currentContent.summary,
                  next: aiResult.summary.next || currentContent.summary?.next || '',
                } : currentContent.summary,
              }

              await supabase.from('lesson_plans')
                .update({ content: newContent })
                .eq('id', planId)

              navigate(`/editor/${planId}`)
            }
            setCreating(false)
          }}
          onClose={() => setShowGenerator(false)}
        />
      )}
      {checkpointData && (
        <CheckpointModal
          previousPlan={checkpointData.previousPlan}
          target={checkpointData.target}
          teacher={teacher}
          onComplete={() => {
            setCheckpointData(null)
            doCreateGuide()
          }}
          onSkip={() => {
            setCheckpointData(null)
            doCreateGuide()
          }}
          onClose={() => setCheckpointData(null)}
        />
      )}
    </div>
  )
}

const SECTIONS_KEYS = ['subject','motivation','activity','skill','closing','assignment']

function buildEmptyDay(isoDate) {
  const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAYS_EN   = ['Monday','Tuesday','Wednesday','Thursday','Friday']
  const [y,m,d]   = isoDate.split('-').map(Number)
  const suf       = [,'st','nd','rd'][d] || 'th'
  const dateLabel = `${MONTHS_EN[m-1]} ${d}${suf}, ${y}`
  const sections  = {}
  const times     = { subject:'~8 min', motivation:'~8 min', activity:'~15 min', skill:'~40 min', closing:'~8 min', assignment:'~5 min' }
  SECTIONS_KEYS.forEach(k => { sections[k] = { time: times[k], content: '', images: [], audios: [], videos: [], smartBlocks: [] } })
  return { active: true, date_label: dateLabel, class_periods: '', unit: '', sections }
}
