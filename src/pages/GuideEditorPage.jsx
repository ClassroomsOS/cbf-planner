import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import RichEditor from '../components/RichEditor'
import { exportGuideDocx } from '../utils/exportDocx'


// ── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'subject',    label: 'SUBJECT TO BE WORKED', hex: '#4F81BD', time: '~8 min'  },
  { key: 'motivation', label: 'MOTIVATION',            hex: '#4BACC6', time: '~8 min'  },
  { key: 'activity',   label: 'ACTIVITY',              hex: '#F79646', time: '~15 min' },
  { key: 'skill',      label: 'SKILL DEVELOPMENT',     hex: '#8064A2', time: '~40 min' },
  { key: 'closing',    label: 'CLOSING',               hex: '#9BBB59', time: '~8 min'  },
  { key: 'assignment', label: 'ASSIGNMENT',             hex: '#4E84A2', time: '~5 min'  },
]

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_EN   = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const MONTHS_ES = ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.']

// ── Helpers ──────────────────────────────────────────────────────────────────

function toISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function formatDateEN(isoDate) {
  const [y,m,d] = isoDate.split('-').map(Number)
  const suf = [,'st','nd','rd'][d] || 'th'
  return `${MONTHS_EN[m-1]} ${d}${suf}, ${y}`
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
  return { active: true, date_label: formatDateEN(isoDate), class_periods: '', unit: '', sections }
}

function buildInitialContent({ grade, subject, period, week, dateRange }, teacher, school) {
  return {
    header: {
      school:  school?.name     || 'COLEGIO BOSTON FLEXIBLE',
      dane:    `DANE: ${school?.dane || '308001800455'} — RESOLUCIÓN ${school?.resolution || '09685 DE 2019'}`,
      codigo:  school?.plan_code    || 'CBF-G AC-01',
      version: school?.plan_version || 'Versión 02 Febrero 2022',
      proceso: 'PROCESO: GESTIÓN ACADÉMICA Y CURRICULAR',
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
    verse: { text: school?.year_verse || '', ref: school?.year_verse_ref || '' },
    days:    {},
    summary: { done: '', next: '' },
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function GuideEditorPage({ teacher }) {
  const { id }   = useParams()
  const navigate = useNavigate()
  const school   = teacher.schools || {}

  const [plan,         setPlan]         = useState(null)
  const [content,      setContent]      = useState(null)
  const [activePanel,  setActivePanel]  = useState('header')
  const [openSections, setOpenSections] = useState({})
  const [saveStatus,   setSaveStatus]   = useState('saved')
  const [loading,      setLoading]      = useState(true)

  const dirtyRef   = useRef(false)
  const contentRef = useRef(null)

  // ── Load ──
  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('lesson_plans').select('*').eq('id', id).single()
      if (error || !data) { navigate('/'); return }
      setPlan(data)
      let c = data.content || {}
      if (!c.header) {
        c = buildInitialContent(
          { grade: data.grade, subject: data.subject, period: data.period,
            week: data.week_number, dateRange: data.date_range },
          teacher, school
        )
      }
      if (!c.days || Object.keys(c.days).length === 0) {
        c.days = await buildDaysFromDB(data, c)
      }
      setContent(c)
      contentRef.current = c
      setLoading(false)
    }
    load()
  }, [id])

  async function buildDaysFromDB(data, c) {
    const year       = new Date().getFullYear()
    const schoolStart = new Date(year, 1, 2)
    const day0       = schoolStart.getDay()
    const diff0      = day0 === 0 ? -6 : 1 - day0
    const firstMonday = new Date(schoolStart)
    firstMonday.setDate(schoolStart.getDate() + diff0)
    const weekMonday = new Date(firstMonday)
    weekMonday.setDate(firstMonday.getDate() + ((data.week_number || 1) - 1) * 7)
    const weekDays = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekMonday); d.setDate(d.getDate() + i); return d
    })
    const isos = weekDays.map(toISO)
    const { data: calData } = await supabase
      .from('school_calendar').select('date, is_school_day, name')
      .eq('school_id', teacher.school_id).in('date', isos)
    const holMap = {}
    if (calData) calData.forEach(r => { holMap[r.date] = r })
    const days = {}
    isos.forEach(iso => {
      const cal = holMap[iso]
      if (!cal || cal.is_school_day !== false) {
        days[iso] = c.days?.[iso] || buildEmptyDay(iso)
      }
    })
    return days
  }

  // ── Content updaters ──
  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)) }

  function setPath(obj, path, value) {
    const last = path[path.length - 1]
    let cur = obj
    for (let i = 0; i < path.length - 1; i++) {
      if (cur[path[i]] === undefined) cur[path[i]] = {}
      cur = cur[path[i]]
    }
    cur[last] = value
  }

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
    if (error) setSaveStatus('error')
    else { setSaveStatus('saved'); dirtyRef.current = false }
  }, [id])

  useEffect(() => {
    const interval = setInterval(doSave, 30000)
    return () => clearInterval(interval)
  }, [doSave])

  useEffect(() => { return () => { if (dirtyRef.current) doSave() } }, [doSave])

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doSave])

  // ── Panels ──
  const dayPanels = content
    ? Object.entries(content.days || {})
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([iso]) => ({ key: `day-${iso}`, iso, label: getDayName(iso) }))
    : []

  const panels = [
    { key: 'header',   label: '1 · Encabezado',  dot: '#2E5598' },
    { key: 'info',     label: '2 · Información', dot: '#4BACC6' },
    { key: 'objetivo', label: '3 · Objetivo',    dot: '#9BBB59' },
    { key: 'verse',    label: '4 · Versículo',   dot: '#C9A84C' },
    ...dayPanels.map(d => ({
      key: d.key, label: d.label,
      sub: `${MONTHS_ES[parseInt(d.iso.slice(5,7))-1]} ${parseInt(d.iso.slice(8,10))}`,
      dot: '#4BACC6',
    })),
    { key: 'summary', label: '★ Resumen', dot: '#8064A2' },
  ]

  // ── Field helpers ──
  function inputField(label, value, path, placeholder = '') {
    return (
      <div className="ge-field" key={label}>
        <label>{label}</label>
        <input type="text" value={value || ''} placeholder={placeholder}
          onChange={e => setContentField(path, e.target.value)} />
      </div>
    )
  }

  function richField(label, value, path, placeholder = '', minHeight = 100) {
    return (
      <div className="ge-field" key={label}>
        <label>{label}</label>
        <RichEditor
          value={value || ''}
          onChange={val => setContentField(path, val)}
          placeholder={placeholder}
          minHeight={minHeight}
        />
      </div>
    )
  }

  // ── Loading ──
  if (loading || !content) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando guía…</p>
    </div>
  )

  const activeDayISO = activePanel.startsWith('day-') ? activePanel.replace('day-', '') : null

  return (
    <div className="ge-wrap">

      {/* Top bar */}
      <div className="ge-topbar">
        <button className="ge-back-btn" onClick={() => navigate('/plans')}>← Mis Guías</button>
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
            {saveStatus === 'error'   && '⚠️ Error'}
          </span>
          <button className="btn-primary" onClick={doSave} disabled={saveStatus === 'saving'}>
            💾 Guardar
          </button>
          <button className="btn-primary btn-save"
            onClick={async () => { await doSave(); exportGuideDocx(contentRef.current) }}>
            📄 Exportar DOCX
          </button>
        </div>
      </div>

      <div className="ge-body">

        {/* Nav */}
        <nav className="ge-nav">
          {panels.map(p => (
            <button key={p.key}
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

        {/* Content */}
        <div className="ge-content">

          {/* ENCABEZADO */}
          {activePanel === 'header' && (
            <div className="card">
              <div className="card-title"><div className="badge">1</div> Encabezado institucional</div>
              {inputField('Nombre del colegio', content.header.school,   ['header','school'],  'COLEGIO BOSTON FLEXIBLE')}
              {inputField('DANE / Resolución',  content.header.dane,     ['header','dane'])}
              <div className="ge-grid-2">
                {inputField('Código',  content.header.codigo,  ['header','codigo'],  'CBF-G AC-01')}
                {inputField('Versión', content.header.version, ['header','version'], 'Versión 02 Febrero 2022')}
              </div>
              {inputField('Proceso', content.header.proceso, ['header','proceso'])}
              <div className="ge-info-box">💡 El logo se integrará en la exportación DOCX en la Fase 2.</div>
            </div>
          )}

          {/* INFORMACIÓN */}
          {activePanel === 'info' && (
            <div className="card">
              <div className="card-title"><div className="badge">2</div> Información del período</div>
              <div className="ge-grid-4">
                {inputField('Grado',      content.info.grado,      ['info','grado'],      '8.° (Azul y Rojo)')}
                {inputField('Período',    content.info.periodo,    ['info','periodo'],    '1.er Período 2026')}
                {inputField('Semana N°',  content.info.semana,     ['info','semana'],     'Ej: 5')}
                {inputField('Asignatura', content.info.asignatura, ['info','asignatura'], 'Language Arts')}
              </div>
              <div className="ge-grid-2">
                {inputField('Docente',         content.info.docente, ['info','docente'], 'Nombre del docente')}
                {inputField('Rango de fechas', content.info.fechas,  ['info','fechas'],  'Ej: Mar. 23–27, 2026')}
              </div>
            </div>
          )}

          {/* OBJETIVO */}
          {activePanel === 'objetivo' && (
            <div className="card">
              <div className="card-title"><div className="badge">3</div> Objetivo de Aprendizaje</div>
              {richField('Objetivo general de la semana',
                content.objetivo.general, ['objetivo','general'],
                'Al finalizar la semana, el estudiante estará en capacidad de…', 100)}
              {richField('Indicador de logro / Desempeño',
                content.objetivo.indicador, ['objetivo','indicador'],
                'El estudiante demuestra el objetivo cuando…', 80)}
              {inputField('Principio del indicador institucional',
                content.objetivo.principio, ['objetivo','principio'])}
            </div>
          )}

          {/* VERSÍCULO */}
          {activePanel === 'verse' && (
            <div className="card">
              <div className="card-title"><div className="badge">4</div> Versículo del año — AÑO DE LA PUREZA</div>
              <div className="verse-box">
                {content.verse.text || school.year_verse}
                <span className="verse-ref">— {content.verse.ref || school.year_verse_ref}</span>
              </div>
              {richField('Texto del versículo', content.verse.text, ['verse','text'], '', 80)}
              {inputField('Referencia', content.verse.ref, ['verse','ref'], 'Génesis 1:27-28a (TLA)')}
            </div>
          )}

          {/* DAY */}
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

          {/* SUMMARY */}
          {activePanel === 'summary' && (
            <div className="card">
              <div className="card-title"><div className="badge">★</div> Resumen y próxima semana</div>
              {richField('Lo trabajado / logros de la semana',
                content.summary.done, ['summary','done'], 'Actividades completadas esta semana…', 120)}
              {richField('Próxima semana – contenidos',
                content.summary.next, ['summary','next'], 'Temas de la próxima semana…', 100)}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── DayPanel ─────────────────────────────────────────────────────────────────

function DayPanel({ iso, day, setContentField, toggleDayActive, openSections, toggleSection }) {
  const base = ['days', iso]

  return (
    <div className="card">
      <div className="ge-day-header" style={{ background: '#1F3864', color: '#fff' }}>
        📅 {getDayName(iso)} — {formatDateEN(iso)}
      </div>

      <div className="ge-toggle-row">
        <input type="checkbox" id={`active-${iso}`}
          checked={day.active !== false}
          onChange={e => toggleDayActive(iso, e.target.checked)} />
        <label htmlFor={`active-${iso}`}>Hay clase este día</label>
      </div>

      {day.active === false ? (
        <div className="coming-soon-notice">
          ⚠️ Sin clase este día. Activa la casilla para agregar contenido.
        </div>
      ) : (
        <>
          <div className="ge-grid-3" style={{ marginBottom: '14px' }}>
            <div className="ge-field">
              <label>Períodos / Horario</label>
              <input type="text" value={day.class_periods || ''}
                placeholder="Ej: 1st+4th (2 hrs)"
                onChange={e => setContentField([...base,'class_periods'], e.target.value)} />
            </div>
            <div className="ge-field">
              <label>Asignatura / Unidad</label>
              <input type="text" value={day.unit || ''}
                placeholder="Ej: Unit 1 – Tell Me About It!"
                onChange={e => setContentField([...base,'unit'], e.target.value)} />
            </div>
            <div className="ge-field">
              <label>Fecha (etiqueta)</label>
              <input type="text" value={day.date_label || formatDateEN(iso)}
                onChange={e => setContentField([...base,'date_label'], e.target.value)} />
            </div>
          </div>

          {SECTIONS.map(s => {
            const sKey    = `${iso}-${s.key}`
            const isOpen  = openSections[sKey]
            const section = day.sections?.[s.key] || buildEmptySection(s.time)

            return (
              <div key={s.key} className="ge-section-block">
                <div className={`ge-section-hdr ${isOpen ? 'open' : ''}`}
                  style={{ background: s.hex }}
                  onClick={() => toggleSection(sKey)}>
                  <span>{s.label}</span>
                  <span className="ge-section-arrow">{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div className="ge-section-body">
                    <div className="ge-field" style={{ maxWidth: '180px' }}>
                      <label>Tiempo estimado</label>
                      <input type="text" value={section.time || s.time}
                        onChange={e => setContentField([...base,'sections',s.key,'time'], e.target.value)} />
                    </div>
                    <div className="ge-field">
                      <label>Contenido / Actividades</label>
                      <RichEditor
                        value={section.content || ''}
                        onChange={val => setContentField([...base,'sections',s.key,'content'], val)}
                        placeholder="Describe las actividades de esta sección…"
                        minHeight={120}
                      />
                    </div>
                    <div className="ge-phase2-notice">
                      🖼️ Imágenes · 🔊 Audio · 🎬 Video · 🧩 Smart Blocks — Fase 2
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
