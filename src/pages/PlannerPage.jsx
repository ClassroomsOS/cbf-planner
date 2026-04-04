import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { AIGeneratorModal } from '../components/AIComponents'
import CheckpointModal from '../components/CheckpointModal'
import { SECTIONS } from '../utils/constants'
import {
  getMondayOf, getWeekDays, toISO, getSchoolWeek, formatRange, formatDateEN,
  MONTHS_ES, DAYS_ES
} from '../utils/dateUtils'
import { useToggle } from '../hooks'

// ── Date helpers imported from dateUtils.js ──────────────────────────────────
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
  const [error,    setError]        = useState(null)

  // ── Boolean toggles (migrated to useToggle) ──
  const [calLoading, , startCalLoading, stopCalLoading] = useToggle(false)
  const [creating,     toggleCreating,     startCreating,     stopCreating]     = useToggle(false)
  const [showGenerator, toggleGenerator, openGenerator, closeGenerator] = useToggle(false)

  // ── Checkpoint state ──
  const [checkpointData, setCheckpointData] = useState(null)
  // checkpointData = { previousPlan, target, pendingAction } | null
  // ── Active learning target for this grade/subject ──
  const [activeTarget, setActiveTarget] = useState(null)
  // ── Whether any NEWS projects exist for this grade+subject ──
  const [hasNews, setHasNews] = useState(null) // null = not checked yet
  const [plannerNewsProjects, setPlannerNewsProjects] = useState([])
  // ── NEWS activity hitos scheduled this week ──
  const [weeklyNewsHitos, setWeeklyNewsHitos] = useState([])
  // ── Existing plan for current selection ──
  const [existingPlan, setExistingPlan] = useState(null)
  // ── Current month's biblical principles ──
  const [monthPrinciple, setMonthPrinciple] = useState(null)

  useEffect(() => {
    const now = new Date()
    supabase
      .from('school_monthly_principles')
      .select('month_verse, month_verse_ref, indicator_principle')
      .eq('school_id', teacher.school_id)
      .eq('year',  now.getFullYear())
      .eq('month', now.getMonth() + 1)
      .maybeSingle()
      .then(({ data }) => { if (data) setMonthPrinciple(data) })
  }, [teacher.school_id])

  // Fetch active target when grade/subject change
  useEffect(() => {
    if (!grade || !subject) { setActiveTarget(null); return }
    async function fetchTarget() {
      const { data } = await supabase
        .from('learning_targets')
        .select('id, description, taxonomy, grade, group_name')
        .eq('school_id', teacher.school_id)
        .eq('subject', subject)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      // Flexible grade match (same logic as LearningTargetSelector)
      const match = (data || []).find(t => {
        if (t.grade === grade) return true
        if (grade.startsWith(t.grade)) {
          if (t.group_name) return grade.includes(t.group_name)
          return true
        }
        return false
      })
      setActiveTarget(match || null)
    }
    fetchTarget()
  }, [grade, subject])

  // Fetch NEWS projects — check existence + hitos for this week
  useEffect(() => {
    if (!grade || !subject) { setWeeklyNewsHitos([]); setHasNews(null); return }
    const w1 = getWeekDays(monday)
    const mon2 = new Date(monday); mon2.setDate(mon2.getDate() + 7)
    const allDays = weekCount === 2 ? [...w1, ...getWeekDays(mon2)] : w1
    const weekDates = new Set(allDays.map(toISO))
    supabase
      .from('news_projects')
      .select('id, title, skill, grade, section, actividades_evaluativas, due_date, target_indicador')
      .eq('school_id', teacher.school_id)
      .eq('subject', subject)
      .then(({ data }) => {
        const all = (data || []).filter(np => grade.startsWith(np.grade || ''))
        setHasNews(all.length > 0)
        setPlannerNewsProjects(all)
        const hitos = []
        all.forEach(np => {
          ;(np.actividades_evaluativas || []).forEach(act => {
            if (act.fecha && weekDates.has(act.fecha)) {
              hitos.push({ date: act.fecha, nombre: act.nombre, descripcion: act.descripcion, skill: np.skill, porcentaje: act.porcentaje })
            }
          })
        })
        hitos.sort((a, b) => a.date.localeCompare(b.date))
        setWeeklyNewsHitos(hitos)
      })
  }, [grade, subject, monday, weekCount])

  const monday2     = (() => { const d = new Date(monday); d.setDate(d.getDate() + 7); return d })()
  const week1Days   = getWeekDays(monday)
  const week2Days   = getWeekDays(monday2)
  const allWeekDays = weekCount === 2 ? [...week1Days, ...week2Days] : week1Days
  const weekNumber  = getSchoolWeek(monday)
  const dateRange   = formatRange(allWeekDays)

  // Derive active indicator from the nearest NEWS project after the selected week
  const plannerActiveIndicator = useMemo(() => {
    if (!plannerNewsProjects.length || !activeTarget) return null
    const firstDay = toISO(allWeekDays[0])
    const dayKeys  = new Set(allWeekDays.map(toISO))

    // Priority 1: activity date in the selected week
    const byActivity = plannerNewsProjects.find(np =>
      (np.actividades_evaluativas || []).some(act => act.fecha && dayKeys.has(act.fecha))
    )
    if (byActivity) {
      const ind = (activeTarget.indicadores || []).find(
        i => typeof i === 'object' && i.habilidad?.toLowerCase() === byActivity.skill?.toLowerCase()
      )
      return ind || null
    }

    // Priority 2: nearest due_date >= firstDay
    const np = plannerNewsProjects
      .filter(p => p.due_date && p.due_date >= firstDay)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
    if (!np) return null

    return (activeTarget.indicadores || []).find(
      i => typeof i === 'object' && i.habilidad?.toLowerCase() === np.skill?.toLowerCase()
    ) || null
  }, [plannerNewsProjects, activeTarget, monday, weekCount])

  // Fetch existing plan for current grade/subject/week selection
  useEffect(() => {
    if (!grade || !subject) { setExistingPlan(null); return }
    supabase
      .from('lesson_plans')
      .select('id, status, date_range, week_count, content')
      .eq('teacher_id', teacher.id)
      .eq('grade', grade)
      .eq('subject', subject)
      .eq('week_number', weekNumber)
      .maybeSingle()
      .then(({ data }) => setExistingPlan(data || null))
  }, [grade, subject, weekNumber])

  // Subjects available for selected class (from assignments)
  const availableSubjects = grade
    ? assignments.filter(a => `${a.grade} ${a.section}` === grade).map(a => a.subject)
    : []

  const selectedAssignment = assignments.find(a => `${a.grade} ${a.section}` === grade && a.subject === subject)
  const section = selectedAssignment?.section || ''
  const DAY_KEY_MAP = ['mon','tue','wed','thu','fri']

  // Compute progress of existing plan: days with at least one section filled
  const existingPlanProgress = (() => {
    if (!existingPlan?.content?.days) return null
    const days = Object.values(existingPlan.content.days)
    if (!days.length) return null
    const withContent = days.filter(day =>
      Object.values(day.sections || {}).some(s => s.content || (s.smartBlocks||[]).length || (s.images||[]).length)
    ).length
    return { total: days.length, withContent }
  })()

  useEffect(() => {
    if (subject && !availableSubjects.includes(subject)) setSubject('')
  }, [grade])

  useEffect(() => {
    async function fetchCalendar() {
      startCalLoading()
      const dates = allWeekDays.map(toISO)
      if (!dates.length) { setCalData({}); stopCalLoading(); return }
      let calQuery = supabase
        .from('school_calendar')
        .select('date, name, type, is_school_day')
        .eq('school_id', teacher.school_id)
        .in('date', dates)
      if (teacher.level) {
        calQuery = calQuery.or(`level.is.null,level.eq.${teacher.level}`)
      }
      const { data } = await calQuery
      const map = {}
      if (data) data.forEach(row => { map[row.date] = row })
      setCalData(map)
      stopCalLoading()
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
    startCreating()
    setError(null)

    const { data: existing } = await supabase
      .from('lesson_plans')
      .select('id, week_count')
      .eq('teacher_id', teacher.id)
      .eq('grade',       grade)
      .eq('subject',     subject)
      .eq('week_number', weekNumber)
      .maybeSingle()

    if (existing) {
      if ((existing.week_count || 1) !== weekCount) {
        await supabase.from('lesson_plans')
          .update({ week_count: weekCount, date_range: dateRange })
          .eq('id', existing.id)
      }
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
        target_id:   activeTarget?.id || null,
      })
      .select()
      .single()

    if (insertError) { setError(insertError.message); stopCreating(); return }
    navigate(`/editor/${newPlan.id}`)
  }

  // ── Entry point: check checkpoint first, then create guide ──
  async function handleCreateGuide() {
    if (!grade || !subject) return
    startCreating()
    setError(null)

    const pending = await checkPendingCheckpoint('create')
    if (pending) {
      setCheckpointData(pending)
      stopCreating()
      return
    }

    await doCreateGuide()
  }

  return (
    <div className="planner-wrap">
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* ── Gradient Header ── */}
        <div className="planner-header">
          <div className="planner-header-left">
            <div className="planner-header-icon">📋</div>
            <div>
              <div className="planner-header-title">Nueva Guía de Aprendizaje</div>
              <div className="planner-header-sub">Selecciona tu clase y semana para comenzar</div>
            </div>
          </div>
          <div className="planner-duration-toggle">
            {[1, 2].map(n => (
              <button key={n}
                className={`planner-dur-btn ${weekCount === n ? 'active' : ''}`}
                onClick={() => setWeekCount(n)}>
                {n} sem.
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="planner-body">

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
              <input type="text" readOnly
                value={weekCount === 2 ? `Sem. ${weekNumber}–${weekNumber + 1}` : `Semana ${weekNumber}`}
                style={{ background: '#f0f4ff', fontWeight: 700, color: '#2E5598', cursor: 'default' }} />
            </div>
          </div>

          {/* Logro vinculado */}
          {activeTarget && grade && subject && (
            <div className="planner-linked-target">
              <span className="plt-icon">🎯</span>
              <div className="plt-content">
                <div className="plt-label">Logro de desempeño vinculado</div>
                <div className="plt-text">{activeTarget.description}</div>
              </div>
              <span className="plt-tax">
                {activeTarget.taxonomy === 'recognize' ? '👁 Reconocer'
                  : activeTarget.taxonomy === 'apply' ? '🛠 Aplicar'
                  : '✨ Producir'}
              </span>
            </div>
          )}

          {/* Hitos NEWS esta semana */}
          {weeklyNewsHitos.length > 0 && (
            <div className="planner-news-hitos">
              <span className="pnh-icon">📋</span>
              <div className="pnh-content">
                <div className="pnh-label">Actividades evaluativas programadas esta semana</div>
                <div className="pnh-list">
                  {weeklyNewsHitos.map((h, i) => {
                    const SKILL_COLOR = { Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59' }
                    const sc = SKILL_COLOR[h.skill]
                    return (
                      <div key={i} className="pnh-item">
                        <span className="pnh-date">
                          {new Date(h.date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <span className="pnh-nombre">{h.nombre}</span>
                        {h.descripcion && <span style={{ color: '#888', fontSize: '11px' }}>{h.descripcion}</span>}
                        {h.skill && <span className="pnh-skill" style={{ background: sc + '22', color: sc, border: `1px solid ${sc}55` }}>{h.skill}</span>}
                        {h.porcentaje > 0 && <span style={{ fontSize: '11px', color: '#888' }}>{h.porcentaje}%</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Guía existente */}
          {existingPlan && (
            <div className="planner-existing-plan">
              <div className="pep-icon">
                {existingPlan.status === 'published' ? '✅' : '📝'}
              </div>
              <div className="pep-content">
                <div className="pep-title">
                  {existingPlan.status === 'published' ? 'Guía publicada' : 'Guía en borrador'}
                  {existingPlan.week_count === 2 && <span className="pep-badge">2 semanas</span>}
                </div>
                <div className="pep-meta">{existingPlan.date_range}</div>
                {existingPlanProgress && (
                  <div className="pep-progress">
                    <div className="pep-progress-bar">
                      <div className="pep-progress-fill"
                        style={{ width: `${(existingPlanProgress.withContent / existingPlanProgress.total) * 100}%` }} />
                    </div>
                    <span className="pep-progress-label">
                      {existingPlanProgress.withContent} de {existingPlanProgress.total} días con contenido
                    </span>
                  </div>
                )}
              </div>
              <div className="pep-hint">El botón abrirá esta guía</div>
            </div>
          )}

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
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#2E5598', padding: '6px 14px 2px', textTransform: 'uppercase', letterSpacing: '0.5px', background: '#f7f9ff' }}>
                    Semana {weekNumber + wIdx}
                  </div>
                )}
                <div className="week-calendar">
                  {wDays.map((d, i) => {
                    const iso = toISO(d)
                    const cal = calData[iso]
                    const isHoliday = cal && cal.is_school_day === false
                    const isScheduled = !selectedAssignment?.schedule || !Object.keys(selectedAssignment.schedule).length || !!selectedAssignment.schedule[DAY_KEY_MAP[i]]
                    const periods = selectedAssignment?.schedule?.[DAY_KEY_MAP[i]] || []
                    return (
                      <div key={iso} className={`wc-day ${isHoliday ? 'wc-holiday' : isScheduled ? 'wc-active' : 'wc-no-class'}`}>
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
                          <>
                            <div className="wc-tag wc-tag-active">✓ Clase</div>
                            {periods.length > 0 && (
                              <div className="wc-periods">{periods.join(' · ')}</div>
                            )}
                          </>
                        ) : (
                          <div className="wc-tag" style={{ background: '#e8e8e8', color: '#aaa' }}>— Sin clase</div>
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

          {/* Bloqueo: no hay NEWS para este grado+materia */}
          {grade && subject && hasNews === false && (
            <div style={{
              background: '#fff8e1', border: '1px solid #f5c842', borderRadius: 10,
              padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: 22 }}>📋</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#7a5c00', marginBottom: 4 }}>
                  Paso previo requerido: Proyectos NEWS
                </div>
                <div style={{ fontSize: 13, color: '#7a5c00', lineHeight: 1.6 }}>
                  Antes de crear guías debes tener al menos un <strong>Proyecto NEWS</strong> para
                  {subject ? ` ${subject}` : ' esta materia'}. El proyecto define el hito y el indicador
                  que guiará la planificación semanal.
                  <br />Ve a <strong>📋 NEWS Projects</strong> en el menú lateral para comenzar.
                </div>
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="planner-actions">
            <button
              className="planner-btn-primary"
              onClick={handleCreateGuide}
              disabled={creating || !grade || !subject || hasNews === false}>
              {creating ? '⏳ Abriendo…'
                : existingPlan ? '📋 Continuar guía →'
                : '✏️ Crear guía →'}
            </button>
            {grade && subject && (
              <button
                className="planner-btn-ai"
                onClick={async () => {
                  const pending = await checkPendingCheckpoint('ai')
                  if (pending) {
                    setCheckpointData({ ...pending, pendingAction: 'ai' })
                  } else {
                    openGenerator()
                  }
                }}
                disabled={creating}>
                🤖 Generar con IA
              </button>
            )}
          </div>
        </div>
      </div>
      {showGenerator && (
        <AIGeneratorModal
          grade={grade}
          subject={subject}
          period={period}
          activeDays={activeDays.map(d => toISO(d))}
          learningTarget={activeTarget}
          activeIndicator={plannerActiveIndicator}
          principles={{
            yearVerse:          { text: school.year_verse || '', ref: school.year_verse_ref || '' },
            monthVerse:         { text: monthPrinciple?.month_verse || '', ref: monthPrinciple?.month_verse_ref || '' },
            indicatorPrinciple: monthPrinciple?.indicator_principle || school.indicator_principle || '',
          }}
          onApply={async (aiResult) => {
            closeGenerator()
            startCreating()
            // Create plan first
            const { data: existing } = await supabase
              .from('lesson_plans')
              .select('id, week_count')
              .eq('teacher_id', teacher.id)
              .eq('grade', grade)
              .eq('subject', subject)
              .eq('week_number', weekNumber)
              .maybeSingle()

            let planId = existing?.id

            if (planId && (existing.week_count || 1) !== weekCount) {
              await supabase.from('lesson_plans')
                .update({ week_count: weekCount, date_range: dateRange })
                .eq('id', planId)
            }

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
                  target_id:   activeTarget?.id || null,
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
                SECTIONS.map(s => s.key).forEach(key => {
                  const genSec = generatedDay.sections?.[key] || {}
                  const exSec  = existingDay.sections?.[key]  || { time: '', content: '', images: [], audios: [], videos: [], smartBlocks: [] }
                  // Append AI-suggested smartBlock (if any) to existing blocks
                  const existingBlocks = exSec.smartBlocks || []
                  const newBlock = genSec.smartBlock
                  const mergedBlocks = newBlock?.type
                    ? [...existingBlocks, { ...newBlock, id: Date.now() + Math.random() }]
                    : existingBlocks
                  mergedSections[key] = {
                    ...exSec,
                    content:     genSec.content || exSec.content || '',
                    smartBlocks: mergedBlocks,
                  }
                })
                mergedDays[iso] = { ...existingDay, unit: generatedDay.unit || existingDay.unit, sections: mergedSections }
              })

              const newContent = {
                ...currentContent,
                days: mergedDays,
                objetivo: aiResult.objetivo ? {
                  ...currentContent.objetivo,
                  general:     aiResult.objetivo.general     || currentContent.objetivo?.general     || '',
                  indicadores: aiResult.objetivo.indicadores || currentContent.objetivo?.indicadores || [''],
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
            stopCreating()
          }}
          onClose={closeGenerator}
        />
      )}
      {checkpointData && (
        <CheckpointModal
          previousPlan={checkpointData.previousPlan}
          target={checkpointData.target}
          teacher={teacher}
          onComplete={() => {
            const action = checkpointData.pendingAction
            setCheckpointData(null)
            if (action === 'ai') openGenerator()
            else doCreateGuide()
          }}
          onSkip={() => {
            const action = checkpointData.pendingAction
            setCheckpointData(null)
            if (action === 'ai') openGenerator()
            else doCreateGuide()
          }}
          onClose={() => setCheckpointData(null)}
        />
      )}
    </div>
  )
}

function buildEmptyDay(isoDate) {
  const dateLabel = formatDateEN(isoDate)
  const sections = {}
  SECTIONS.forEach(s => {
    sections[s.key] = {
      time: s.time,
      content: '',
      images: [],
      audios: [],
      videos: [],
      smartBlocks: []
    }
  })
  return { active: true, date_label: dateLabel, class_periods: '', unit: '', sections }
}
