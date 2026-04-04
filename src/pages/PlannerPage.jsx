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
        .select('id, description, taxonomy, grade, group_name, indicadores, news_model')
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

  // Derive active NEWS project and indicator for the selected week
  const plannerActiveNewsProject = useMemo(() => {
    if (!plannerNewsProjects.length) return null
    const firstDay = toISO(allWeekDays[0])
    const dayKeys  = new Set(allWeekDays.map(toISO))

    // Priority 1: activity date in the selected week
    const byActivity = plannerNewsProjects.find(np =>
      (np.actividades_evaluativas || []).some(act => act.fecha && dayKeys.has(act.fecha))
    )
    if (byActivity) return byActivity

    // Priority 2: nearest due_date >= firstDay
    const np = plannerNewsProjects
      .filter(p => p.due_date && p.due_date >= firstDay)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
    if (np) return np

    // Priority 3: any linked project (teacher hasn't set dates yet)
    const withSkill = plannerNewsProjects.filter(p => p.skill)
    return withSkill[0] || plannerNewsProjects[0] || null
  }, [plannerNewsProjects, monday, weekCount])

  const plannerActiveIndicator = useMemo(() => {
    if (!plannerActiveNewsProject || !activeTarget) return null
    return (activeTarget.indicadores || []).find(
      i => typeof i === 'object' &&
           i.habilidad?.toLowerCase() === plannerActiveNewsProject.skill?.toLowerCase()
    ) || null
  }, [plannerActiveNewsProject, activeTarget])

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
        teacher_id:       teacher.id,
        school_id:        teacher.school_id,
        grade, subject, section, period,
        week_number:      weekNumber,
        week_count:       weekCount,
        monday_date:      toISO(monday),
        date_range:       dateRange,
        status:           'draft',
        content:          {},
        target_id:        activeTarget?.id || null,
        news_project_id:  plannerActiveNewsProject?.id || null,
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

      {/* Timeline completo del período — debajo del card principal para no desplazar el calendario */}
      {plannerNewsProjects.length > 0 && (
        <PlannerPeriodTimeline
          projects={plannerNewsProjects}
          currentMonday={monday}
          weekCount={weekCount}
        />
      )}

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
                  teacher_id:       teacher.id,
                  school_id:        teacher.school_id,
                  grade, subject, section, period,
                  week_number:      weekNumber,
                  week_count:       weekCount,
                  monday_date:      toISO(monday),
                  date_range:       dateRange,
                  status:           'draft',
                  content:          {},
                  target_id:        activeTarget?.id || null,
                  news_project_id:  plannerActiveNewsProject?.id || null,
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

// ── PlannerPeriodTimeline ──────────────────────────────────────────────────────
const SKILL_COLOR = {
  Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59'
}

function detectActivityType(nombre) {
  const n = (nombre || '').toLowerCase()
  if (n.includes('dict'))                                    return { icon: '🎤', color: '#4BACC6', label: 'Dictation',    tier: 'routine'    }
  if (n.includes('exam'))                                    return { icon: '📋', color: '#B91C1C', label: 'Exam',         tier: 'high-stakes' }
  if (n.includes('quiz') || n.includes('test'))              return { icon: '📝', color: '#C0504D', label: 'Quiz',         tier: 'assessment'  }
  if (n.includes('present') || n.includes('expo'))           return { icon: '🎙', color: '#7C3AED', label: 'Presentation', tier: 'assessment'  }
  if (n.includes('reading') || n.includes('lectura'))        return { icon: '📖', color: '#F79646', label: 'Reading',      tier: 'routine'     }
  if (n.includes('speaking') || n.includes('oral'))          return { icon: '🗣', color: '#8064A2', label: 'Speaking',     tier: 'assessment'  }
  if (n.includes('listening'))                               return { icon: '🎧', color: '#4BACC6', label: 'Listening',    tier: 'routine'     }
  if (n.includes('writing') || n.includes('escrit'))         return { icon: '✍️', color: '#9BBB59', label: 'Writing',      tier: 'routine'     }
  if (n.includes('vocab'))                                   return { icon: '🔤', color: '#9BBB59', label: 'Vocab',        tier: 'routine'     }
  if (n.includes('exit') || n.includes('ticket'))            return { icon: '🚪', color: '#C55A11', label: 'Exit Ticket',  tier: 'routine'     }
  if (n.includes('workshop'))                                return { icon: '🔧', color: '#F79646', label: 'Workshop',     tier: 'routine'     }
  return                                                            { icon: '📌', color: '#1A3A8F', label: 'Actividad',    tier: 'routine'     }
}

function isoMonday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function formatWeekRange(monStr) {
  const mon = new Date(monStr + 'T12:00:00')
  const fri = new Date(mon)
  fri.setDate(fri.getDate() + 4)
  const opts = { day: 'numeric', month: 'short' }
  return `${mon.toLocaleDateString('es-CO', opts)} – ${fri.toLocaleDateString('es-CO', opts)}`
}

function PlannerPeriodTimeline({ projects, currentMonday, weekCount }) {
  const allEvents = useMemo(() => {
    const events = []
    projects.forEach(p => {
      ;(p.actividades_evaluativas || []).forEach(act => {
        if (!act.fecha) return
        const { icon, color, label, tier } = detectActivityType(act.nombre)
        events.push({
          date: act.fecha, kind: 'activity',
          nombre: act.nombre, descripcion: act.descripcion,
          porcentaje: act.porcentaje, skill: p.skill,
          projectTitle: p.title, icon, color, label, tier,
        })
      })
      if (p.due_date) {
        const sc = SKILL_COLOR[p.skill] || '#1A3A8F'
        events.push({
          date: p.due_date, kind: 'project',
          nombre: p.title, skill: p.skill,
          projectTitle: p.title,
          icon: '🏁', color: sc, label: 'Entrega',
        })
      }
    })
    events.sort((a, b) => a.date.localeCompare(b.date))
    return events
  }, [projects])

  if (allEvents.length === 0) return null

  const currentWeekKey = isoMonday(toISO(currentMonday))
  const mon2 = new Date(currentMonday)
  mon2.setDate(mon2.getDate() + 7)
  const nextWeekKey = weekCount === 2 ? isoMonday(toISO(mon2)) : null

  // Group by week
  const weekMap = {}
  allEvents.forEach(ev => {
    const wk = isoMonday(ev.date)
    if (!weekMap[wk]) weekMap[wk] = []
    weekMap[wk].push(ev)
  })
  const sortedWeeks = Object.keys(weekMap).sort()

  return (
    <div style={{
      background: 'linear-gradient(160deg, #f8faff 0%, #ffffff 100%)',
      border: '1.5px solid #dde6f8',
      borderRadius: 14,
      padding: '18px 20px',
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 800, color: '#1A3A8F',
        textTransform: 'uppercase', letterSpacing: '0.6px',
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6
      }}>
        <span style={{ fontSize: 14 }}>🗓</span> Timeline del Período
        <span style={{
          marginLeft: 'auto', fontSize: 10, color: '#aaa', fontWeight: 600,
          textTransform: 'none', letterSpacing: 0
        }}>
          {allEvents.length} actividad{allEvents.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { icon: '🏁', color: '#1A6B3A', label: 'Entrega', bg: '#e8f5e9', border: '#1A6B3A' },
          { icon: '📋', color: '#B91C1C', label: 'Exam',    bg: '#fef2f2', border: '#B91C1C' },
          { icon: '📝', color: '#C0504D', label: 'Quiz',    bg: '#fff0f0', border: '#C0504D' },
          { icon: '🎙', color: '#7C3AED', label: 'Presentation', bg: '#f5f3ff', border: '#7C3AED' },
          { icon: '🎤', color: '#4BACC6', label: 'Dictation', bg: null, border: null },
          { icon: '📖', color: '#F79646', label: 'Reading',   bg: null, border: null },
          { icon: '✍️', color: '#9BBB59', label: 'Writing',   bg: null, border: null },
        ].map(it => (
          <span key={it.label} style={{
            fontSize: 10, color: it.color, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 3,
            background: it.bg || 'transparent',
            border: it.border ? `1px solid ${it.border}40` : 'none',
            borderRadius: 5, padding: it.bg ? '2px 7px' : '0',
          }}>
            <span>{it.icon}</span>{it.label}
          </span>
        ))}
      </div>

      {/* Week groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sortedWeeks.map((wk, wIdx) => {
          const isCurrent = wk === currentWeekKey || (nextWeekKey && wk === nextWeekKey)
          const weekEvents = weekMap[wk]
          const wkNum = getSchoolWeek(new Date(wk + 'T12:00:00'))

          return (
            <div key={wk} style={{
              borderRadius: 10,
              border: isCurrent ? '2px solid #1A3A8F' : '1.5px solid #eceef5',
              background: isCurrent ? '#eef2fb' : 'white',
              overflow: 'hidden',
              boxShadow: isCurrent ? '0 2px 12px rgba(26,58,143,0.10)' : '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              {/* Week header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 14px',
                background: isCurrent
                  ? 'linear-gradient(90deg, #1A3A8F, #2E5598)'
                  : '#f5f6fa',
                borderBottom: '1px solid ' + (isCurrent ? 'transparent' : '#eee'),
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 800,
                  color: isCurrent ? 'white' : '#1A3A8F',
                }}>Sem. {wkNum}</span>
                <span style={{
                  fontSize: 11,
                  color: isCurrent ? 'rgba(255,255,255,0.75)' : '#999',
                  fontWeight: 600,
                }}>{formatWeekRange(wk)}</span>
                {isCurrent && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 9, fontWeight: 900,
                    background: 'rgba(255,255,255,0.18)', color: 'white',
                    padding: '2px 9px', borderRadius: 6, letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                  }}>★ Esta semana</span>
                )}
                {!isCurrent && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, color: '#bbb', fontWeight: 700,
                  }}>{weekEvents.length} evento{weekEvents.length !== 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Events */}
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                {weekEvents.map((ev, i) => {
                  const isProject      = ev.kind === 'project'
                  const isHighStakes   = ev.tier === 'high-stakes'
                  const isAssessment   = ev.tier === 'assessment'
                  const dateStr = new Date(ev.date + 'T12:00:00').toLocaleDateString('es-CO', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  })

                  // ── Entrega NEWS — card prominente con fondo de color ──
                  if (isProject) return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: ev.color + '14',
                      border: `1.5px solid ${ev.color}50`,
                      borderRadius: 8, padding: '8px 12px',
                    }}>
                      <span style={{ fontSize: 18 }}>🏁</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: ev.color, lineHeight: 1.3 }}>
                          {ev.nombre}
                        </div>
                        {ev.skill && (
                          <div style={{ fontSize: 10, color: ev.color + 'cc', fontWeight: 600, marginTop: 1 }}>
                            {ev.skill}
                          </div>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right' }}>
                        <div style={{
                          fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                          color: '#fff', background: ev.color,
                          padding: '2px 8px', borderRadius: 5, marginBottom: 3,
                        }}>ENTREGA</div>
                        <div style={{ fontSize: 10, color: ev.color, fontWeight: 700 }}>{dateStr}</div>
                      </div>
                    </div>
                  )

                  // ── Exam — card con fondo rojo claro, borde izquierdo grueso ──
                  if (isHighStakes) return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: '#fef2f2',
                      border: `1px solid ${ev.color}30`,
                      borderLeft: `5px solid ${ev.color}`,
                      borderRadius: 8, padding: '7px 12px',
                    }}>
                      <span style={{ fontSize: 16 }}>{ev.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: ev.color }}>{ev.nombre}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 900, color: '#fff',
                            background: ev.color, padding: '1px 6px', borderRadius: 4,
                            textTransform: 'uppercase',
                          }}>{ev.label}</span>
                        </div>
                        {ev.descripcion && <div style={{ fontSize: 10, color: '#b91c1c99', marginTop: 2 }}>{ev.descripcion}</div>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, color: ev.color, fontWeight: 700, whiteSpace: 'nowrap' }}>{dateStr}</span>
                        {ev.porcentaje > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: ev.color, background: ev.color + '18', padding: '1px 6px', borderRadius: 4 }}>{ev.porcentaje}%</span>
                        )}
                      </div>
                    </div>
                  )

                  // ── Quiz / Presentation — card con fondo suave y borde izquierdo ──
                  if (isAssessment) return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: ev.color + '0e',
                      borderLeft: `4px solid ${ev.color}`,
                      borderRadius: '0 7px 7px 0', padding: '6px 12px',
                    }}>
                      <span style={{ fontSize: 15 }}>{ev.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{ev.nombre}</span>
                          <span style={{
                            fontSize: 9, fontWeight: 800, color: ev.color,
                            background: ev.color + '20', border: `1px solid ${ev.color}40`,
                            padding: '1px 6px', borderRadius: 4,
                          }}>{ev.label}</span>
                          {ev.skill && <span style={{ fontSize: 9, color: SKILL_COLOR[ev.skill] || '#888', fontWeight: 700 }}>{ev.skill}</span>}
                        </div>
                        {ev.descripcion && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{ev.descripcion}</div>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, color: '#999', fontWeight: 600, whiteSpace: 'nowrap' }}>{dateStr}</span>
                        {ev.porcentaje > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: ev.color, background: ev.color + '18', padding: '1px 6px', borderRadius: 4 }}>{ev.porcentaje}%</span>
                        )}
                      </div>
                    </div>
                  )

                  // ── Actividad rutinaria (Dictation, Reading, Writing…) — borde fino ──
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      paddingLeft: 10, borderLeft: `3px solid ${ev.color}`,
                    }}>
                      <span style={{ fontSize: 14, lineHeight: 1, marginTop: 1 }}>{ev.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{ev.nombre}</span>
                          {ev.skill && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              color: SKILL_COLOR[ev.skill] || '#1A3A8F',
                              background: (SKILL_COLOR[ev.skill] || '#1A3A8F') + '18',
                              padding: '1px 6px', borderRadius: 4,
                            }}>{ev.skill}</span>
                          )}
                        </div>
                        {ev.descripcion && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{ev.descripcion}</div>}
                      </div>
                      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 10, color: '#999', fontWeight: 600, whiteSpace: 'nowrap' }}>{dateStr}</span>
                        {ev.porcentaje > 0 && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: ev.color, background: ev.color + '18', padding: '1px 6px', borderRadius: 4 }}>{ev.porcentaje}%</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
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
