import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

// ── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'subject',    label: 'SUBJECT TO BE WORKED', hex: '#4F81BD', time: '~8 min'  },
  { key: 'motivation', label: 'MOTIVATION',            hex: '#4BACC6', time: '~8 min'  },
  { key: 'activity',   label: 'ACTIVITY',              hex: '#F79646', time: '~15 min' },
  { key: 'skill',      label: 'SKILL DEVELOPMENT',     hex: '#8064A2', time: '~40 min' },
  { key: 'closing',    label: 'CLOSING',               hex: '#9BBB59', time: '~8 min'  },
  { key: 'assignment', label: 'ASSIGNMENT',             hex: '#4E84A2', time: '~5 min'  },
]

const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]
const DAYS_EN = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const MONTHS_ES = ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.']

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateEN(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const suf = [,'st','nd','rd'][d] || 'th'
  return `${MONTHS_EN[m - 1]} ${d}${suf}, ${y}`
}

function getDayName(isoDate) {
  const date = new Date(isoDate + 'T12:00:00')
  return DAYS_EN[date.getDay() - 1] || ''
}

function buildEmptySection(time) {
  return { time, content: '', images: [], audios: [], videos: [], smartBlocks: [] }
}

function buildEmptyDay(isoDate) {
  const sections = {}
  SECTIONS.forEach(s => { sections[s.key] = buildEmptySection(s.time) })
  return {
    active:       true,
    date_label:   formatDateEN(isoDate),
    class_periods: '',
    unit:          '',
    sections,
  }
}

function buildInitialContent({ grade, subject, period, week, dateRange }, teacher, school) {
  return {
    header: {
      school:   school?.name     || 'COLEGIO BOSTON FLEXIBLE',
      dane:     `DANE: ${school?.dane || '308001800455'} — RESOLUCIÓN ${school?.resolution || '09685 DE 2019'}`,
      codigo:   school?.plan_code    || 'CBF-G AC-01',
      version:  school?.plan_version || 'Versión 02 Febrero 2022',
      proceso:  'PROCESO: GESTIÓN ACADÉMICA Y CURRICULAR',
    },
    info: {
      grado:      grade   || '',
      periodo:    period  || '',
      semana:     String(week || ''),
      asignatura: subject || '',
      docente:    teacher?.full_name || '',
      fechas:     dateRange || '',
    },
    objetivo: {
      general:   '',
      indicador: '',
      principio: school?.indicator_principle
        || 'El mundo y sus malos deseos pasarán, pero el que hace la voluntad de Dios vivirá para siempre.',
    },
    verse: {
      text: school?.year_verse     || '',
      ref:  school?.year_verse_ref || '',
    },
    days: {},   // populated after calendar fetch
    summary: { done: '', next: '' },
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GuideEditorPage({ teacher }) {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const school     = teacher.schools || {}

  // ── State ──
  const [plan,        setPlan]        = useState(null)
  const [content,     setContent]     = useState(null)
  const [activePanel, setActivePanel] = useState('header')
  const [openSections, setOpenSections] = useState({})   // { 'day-ISO-sectionKey': true }
  const [saveStatus,  setSaveStatus]  = useState('saved') // 'saved' | 'saving' | 'unsaved' | 'error'
  const [loading,     setLoading]     = useState(true)

  const dirtyRef    = useRef(false)
  const contentRef  = useRef(null)  // mirror of content for auto-save closure

  // ── Load plan ──
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('lesson_plans')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) { navigate('/'); return }

      setPlan(data)

      // If content already exists, use it; otherwise build initial
      let c = data.content || {}
      if (!c.header) {
        c = buildInitialContent(
          {
            grade:     data.grade,
            subject:   data.subject,
            period:    data.period,
            week:      data.week_number,
            dateRange: data.date_range,
          },
          teacher,
          school,
        )
      }

      // Fetch calendar for the week and populate days
      if (data.date_range && (!c.days || Object.keys(c.days).length === 0)) {
        c.days = await buildDaysFromDB(data, c)
      }

      setContent(c)
      contentRef.current = c
      setLoading(false)
    }
    load()
  }, [id])

  async function buildDaysFromDB(data, c) {
    // Reconstruct the 5 weekdays from week_number and year
    // We'll use date_range to figure out the monday
    // Simpler: fetch all days from school_calendar for the week
    // The plan stores date_range like "Mar. 23–27, 2026" — not reliable to parse
    // Better: store monday ISO in the plan. For now, derive from week_number.
    // Actually we'll fetch the plan's date_range week from school_calendar
    // Since we don't have monday stored, we fetch 5 days starting from the first
    // weekday that matches the week. Let's use a different approach:
    // The week_number × 7 + feb 2 start.

    const year = new Date().getFullYear()
    const schoolStart = new Date(year, 1, 2)
    // Get monday of week 1
    const day0 = schoolStart.getDay()
    const diff0 = day0 === 0 ? -6 : 1 - day0
    const firstMonday = new Date(schoolStart)
    firstMonday.setDate(schoolStart.getDate() + diff0)

    const weekMonday = new Date(firstMonday)
    weekMonday.setDate(firstMonday.getDate() + ((data.week_number || 1) - 1) * 7)

    const weekDays = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekMonday)
      d.setDate(d.getDate() + i)
      return d
    })
    const isos = weekDays.map(toISO)

    // Fetch holidays
    const { data: calData } = await supabase
      .from('school_calendar')
      .select('date, is_school_day, name')
      .eq('school_id', teacher.school_id)
      .in('date', isos)

    const holMap = {}
    if (calData) calData.forEach(r => { holMap[r.date] = r })

    const days = {}
    isos.forEach(iso => {
      const cal = holMap[iso]
      const isHoliday = cal && cal.is_school_day === false
      if (!isHoliday) {
        days[iso] = c.days?.[iso] || buildEmptyDay(iso)
      }
    })
    return days
  }

  // ── Content updaters ──
  function setContentField(path, value) {
    setContent(prev => {
      const next = deepClone(prev)
      setPath(next, path, value)
      contentRef.current = next
      dirtyRef.current = true
      setSaveStatus('unsaved')
      return next
    })
  }

  // e.g. path = ['info', 'grado']  or  ['days', '2026-03-23', 'sections', 'subject', 'content']
  function setPath(obj, path, value) {
    const last = path[path.length - 1]
    let cur = obj
    for (let i = 0; i < path.length - 1; i++) {
      if (cur[path[i]] === undefined) cur[path[i]] = {}
      cur = cur[path[i]]
    }
    cur[last] = value
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj))
  }

  function toggleDayActive(iso, active) {
    setContent(prev => {
      const next = deepClone(prev)
      if (!next.days[iso]) next.days[iso] = buildEmptyDay(iso)
      next.days[iso].active = active
      contentRef.current = next
      dirtyRef.current = true
      setSaveStatus('unsaved')
      return next
    })
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── Save ──
  const doSave = useCallback(async () => {
    if (!dirtyRef.current) return
    setSaveStatus('saving')
    const { error } = await supabase
      .from('lesson_plans')
      .update({ content: contentRef.current, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { setSaveStatus('error') }
    else       { setSaveStatus('saved'); dirtyRef.current = false }
  }, [id])

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(doSave, 30000)
    return () => clearInterval(interval)
  }, [doSave])

  // Save on unmount
  useEffect(() => { return () => { if (dirtyRef.current) doSave() } }, [doSave])

  // ── Panel list ──
  const dayPanels = content
    ? Object.entries(content.days || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([iso]) => ({ key: `day-${iso}`, iso, label: getDayName(iso), date: iso }))
    : []

  const panels = [
    { key: 'header',   label: '1 · Encabezado',  dot: '#2E5598' },
    { key: 'info',     label: '2 · Información', dot: '#4BACC6' },
    { key: 'objetivo', label: '3 · Objetivo',    dot: '#9BBB59' },
    { key: 'verse',    label: '4 · Versículo',   dot: '#C9A84C' },
    ...dayPanels.map(d => ({
      key:   d.key,
      label: d.label,
      sub:   `${MONTHS_ES[parseInt(d.iso.slice(5, 7)) - 1]} ${parseInt(d.iso.slice(8, 10))}`,
      dot:   '#4BACC6',
    })),
    { key: 'summary',  label: '★ Resumen',       dot: '#8064A2' },
  ]

  // ── Keyboard shortcut Ctrl+S ──
  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSave])

  // ── Render helpers ──
  function field(label, value, path, type = 'input', placeholder = '') {
    const commonStyle = {}
    if (type === 'textarea') {
      return (
        <div className="ge-field" key={label}>
          <label>{label}</label>
          <textarea
            value={value || ''}
            placeholder={placeholder}
            rows={4}
            onChange={e => setContentField(path, e.target.value)}
          />
        </div>
      )
    }
    return (
      <div className="ge-field" key={label}>
        <label>{label}</label>
        <input
          type="text"
          value={value || ''}
          placeholder={placeholder}
          onChange={e => setContentField(path, e.target.value)}
        />
      </div>
    )
  }

  // ── Loading ──
  if (loading || !content) {
    return (
      <div className="ge-loading">
        <div className="loading-spinner" />
        <p>Cargando guía…</p>
      </div>
    )
  }

  // ── Active day ISO ──
  const activeDayISO = activePanel.startsWith('day-')
    ? activePanel.replace('day-', '')
    : null

  return (
    <div className="ge-wrap">

      {/* ── Top bar ── */}
      <div className="ge-topbar">
        <button className="ge-back-btn" onClick={() => navigate('/')}>← Volver</button>
        <div className="ge-topbar-info">
          <span className="ge-guide-title">
            {content.info.grado} · {content.info.asignatura} · Semana {content.info.semana}
          </span>
          <span className="ge-guide-dates">{content.info.fechas}</span>
        </div>
        <div className="ge-save-area">
          <span className={`ge-save-status ge-save-${saveStatus}`}>
            {saveStatus === 'saving'  && '⏳ Guardando…'}
            {saveStatus === 'saved'   && '✅ Guardado'}
            {saveStatus === 'unsaved' && '● Sin guardar'}
            {saveStatus === 'error'   && '⚠️ Error al guardar'}
          </span>
          <button className="btn-primary" onClick={doSave} disabled={saveStatus === 'saving'}>
            💾 Guardar
          </button>
        </div>
      </div>

      <div className="ge-body">

        {/* ── Panel nav ── */}
        <nav className="ge-nav">
          {panels.map(p => (
            <button
              key={p.key}
              className={`ge-nav-item ${activePanel === p.key ? 'active' : ''}`}
              onClick={() => setActivePanel(p.key)}>
              <span className="ge-nav-dot" style={{ background: p.dot }} />
              <span className="ge-nav-label">
                {p.label}
                {p.sub && <span className="ge-nav-sub">{p.sub}</span>}
              </span>
            </button>
          ))}
        </nav>

        {/* ── Panel content ── */}
        <div className="ge-content">

          {/* ── ENCABEZADO ── */}
          {activePanel === 'header' && (
            <div className="card">
              <div className="card-title"><div className="badge">1</div> Encabezado institucional</div>
              {field('Nombre del colegio', content.header.school,   ['header','school'],  'input', 'COLEGIO BOSTON FLEXIBLE')}
              {field('DANE / Resolución',  content.header.dane,     ['header','dane'],    'input')}
              <div className="ge-grid-2">
                {field('Código',  content.header.codigo,  ['header','codigo'],  'input', 'CBF-G AC-01')}
                {field('Versión', content.header.version, ['header','version'], 'input', 'Versión 02 Febrero 2022')}
              </div>
              {field('Proceso', content.header.proceso, ['header','proceso'], 'input', 'PROCESO: GESTIÓN ACADÉMICA Y CURRICULAR')}
              <div className="ge-info-box">
                💡 El logo se integrará en la exportación DOCX en la Fase 2.
              </div>
            </div>
          )}

          {/* ── INFORMACIÓN ── */}
          {activePanel === 'info' && (
            <div className="card">
              <div className="card-title"><div className="badge">2</div> Información del período</div>
              <div className="ge-grid-4">
                {field('Grado',      content.info.grado,      ['info','grado'],      'input', '8.° (Azul y Rojo)')}
                {field('Período',    content.info.periodo,    ['info','periodo'],    'input', '1.er Período 2026')}
                {field('Semana N°',  content.info.semana,     ['info','semana'],     'input', 'Ej: 5')}
                {field('Asignatura', content.info.asignatura, ['info','asignatura'], 'input', 'Language Arts')}
              </div>
              <div className="ge-grid-2">
                {field('Docente',         content.info.docente, ['info','docente'], 'input', 'Nombre del docente')}
                {field('Rango de fechas', content.info.fechas,  ['info','fechas'],  'input', 'Ej: Mar. 23–27, 2026')}
              </div>
            </div>
          )}

          {/* ── OBJETIVO ── */}
          {activePanel === 'objetivo' && (
            <div className="card">
              <div className="card-title"><div className="badge">3</div> Objetivo de Aprendizaje</div>
              {field('Objetivo general de la semana',
                content.objetivo.general, ['objetivo','general'], 'textarea',
                'Al finalizar la semana, el estudiante estará en capacidad de…')}
              {field('Indicador de logro / Desempeño',
                content.objetivo.indicador, ['objetivo','indicador'], 'textarea',
                'El estudiante demuestra el objetivo cuando…')}
              {field('Principio del indicador institucional',
                content.objetivo.principio, ['objetivo','principio'], 'input')}
            </div>
          )}

          {/* ── VERSÍCULO ── */}
          {activePanel === 'verse' && (
            <div className="card">
              <div className="card-title"><div className="badge">4</div> Versículo del año — AÑO DE LA PUREZA</div>
              <div className="verse-box">
                {content.verse.text || school.year_verse}
                <span className="verse-ref">— {content.verse.ref || school.year_verse_ref}</span>
              </div>
              {field('Texto del versículo', content.verse.text, ['verse','text'], 'textarea')}
              {field('Referencia',           content.verse.ref,  ['verse','ref'],  'input', 'Génesis 1:27-28a (TLA)')}
            </div>
          )}

          {/* ── DAY PANEL ── */}
          {activeDayISO && content.days && (
            <DayPanel
              iso={activeDayISO}
              day={content.days[activeDayISO] || buildEmptyDay(activeDayISO)}
              setContentField={setContentField}
              toggleDayActive={toggleDayActive}
              openSections={openSections}
              toggleSection={toggleSection}
            />
          )}

          {/* ── SUMMARY ── */}
          {activePanel === 'summary' && (
            <div className="card">
              <div className="card-title"><div className="badge">★</div> Resumen y próxima semana</div>
              {field('Lo trabajado / logros de la semana',
                content.summary.done, ['summary','done'], 'textarea',
                'Actividades completadas esta semana…')}
              {field('Próxima semana – contenidos',
                content.summary.next, ['summary','next'], 'textarea',
                'Temas de la próxima semana…')}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── DayPanel ─────────────────────────────────────────────────────────────────

function DayPanel({ iso, day, setContentField, toggleDayActive, openSections, toggleSection }) {
  const dayName  = getDayName(iso)
  const dateEN   = formatDateEN(iso)
  const base     = ['days', iso]

  return (
    <div className="card">
      <div className="ge-day-header" style={{ background: '#1F3864', color: '#fff' }}>
        📅 {dayName} — {dateEN}
      </div>

      {/* Active toggle */}
      <div className="ge-toggle-row">
        <input
          type="checkbox"
          id={`active-${iso}`}
          checked={day.active !== false}
          onChange={e => toggleDayActive(iso, e.target.checked)}
        />
        <label htmlFor={`active-${iso}`}>Hay clase este día</label>
      </div>

      {day.active === false ? (
        <div className="coming-soon-notice">
          ⚠️ Sin clase este día. Activa la casilla de arriba para agregar contenido.
        </div>
      ) : (
        <>
          {/* Day meta */}
          <div className="ge-grid-3" style={{ marginBottom: '14px' }}>
            <div className="ge-field">
              <label>Períodos / Horario</label>
              <input
                type="text"
                value={day.class_periods || ''}
                placeholder="Ej: 1st+4th (2 hrs)"
                onChange={e => setContentField([...base, 'class_periods'], e.target.value)}
              />
            </div>
            <div className="ge-field">
              <label>Asignatura / Unidad</label>
              <input
                type="text"
                value={day.unit || ''}
                placeholder="Ej: Unit 1 – Tell Me About It!"
                onChange={e => setContentField([...base, 'unit'], e.target.value)}
              />
            </div>
            <div className="ge-field">
              <label>Fecha (etiqueta)</label>
              <input
                type="text"
                value={day.date_label || dateEN}
                onChange={e => setContentField([...base, 'date_label'], e.target.value)}
              />
            </div>
          </div>

          {/* Sections */}
          {SECTIONS.map(s => {
            const sKey    = `${iso}-${s.key}`
            const isOpen  = openSections[sKey]
            const section = day.sections?.[s.key] || buildEmptySection(s.time)

            return (
              <div key={s.key} className="ge-section-block">
                {/* Section header */}
                <div
                  className={`ge-section-hdr ${isOpen ? 'open' : ''}`}
                  style={{ background: s.hex }}
                  onClick={() => toggleSection(sKey)}>
                  <span>{s.label}</span>
                  <span className="ge-section-arrow">{isOpen ? '▲' : '▼'}</span>
                </div>

                {/* Section body */}
                {isOpen && (
                  <div className="ge-section-body">
                    <div className="ge-field" style={{ maxWidth: '180px' }}>
                      <label>Tiempo estimado</label>
                      <input
                        type="text"
                        value={section.time || s.time}
                        onChange={e => setContentField([...base, 'sections', s.key, 'time'], e.target.value)}
                      />
                    </div>
                    <div className="ge-field">
                      <label>Contenido / Actividades</label>
                      <textarea
                        rows={5}
                        value={section.content || ''}
                        placeholder="Describe las actividades de esta sección…"
                        onChange={e => setContentField([...base, 'sections', s.key, 'content'], e.target.value)}
                      />
                    </div>
                    <div className="ge-phase2-notice">
                      🖼️ Imágenes · 🔊 Audio · 🎬 Video · 🧩 Bloques Inteligentes — disponibles en Fase 2
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
