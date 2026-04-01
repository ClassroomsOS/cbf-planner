import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import RichEditor from '../components/RichEditor'
import { exportGuideDocx } from '../utils/exportDocx'
import { exportHtml, exportPdf } from '../utils/exportHtml'
import ImageUploader from '../components/ImageUploader'
import SmartBlocksList from '../components/SmartBlocks'
import { AISuggestButton, AIAnalyzerModal, AIGeneratorModal } from '../components/AIComponents'
import CommentsPanel from '../components/CommentsPanel'
import SectionPreview from '../components/SectionPreview'
import { useFeatures } from '../context/FeaturesContext'
import CorrectionRequestModal from '../components/CorrectionRequestModal'
import LayoutSelectorModal, { LAYOUT_ELIGIBLE } from '../components/LayoutSelectorModal'
import LearningTargetSelector from '../components/LearningTargetSelector'
import { useToast } from '../context/ToastContext'
import { logError } from '../utils/logger'

// ── localStorage draft helpers ──────────────────────────────────────────────
const DRAFT_PREFIX = 'cbf_draft_'

function saveDraftLocal(planId, content) {
  try {
    const key = DRAFT_PREFIX + planId
    const payload = { content, savedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch { /* quota exceeded or private mode — silent */ }
}

function loadDraftLocal(planId) {
  try {
    const key = DRAFT_PREFIX + planId
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function clearDraftLocal(planId) {
  try { localStorage.removeItem(DRAFT_PREFIX + planId) } catch {}
}


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
      school:   school?.name     || 'COLEGIO BOSTON FLEXIBLE',
      dane:     `DANE: ${school?.dane || '308001800455'} — RESOLUCIÓN ${school?.resolution || '09685 DE 2019'}`,
      codigo:   school?.plan_code    || 'CBF-G AC-01',
      version:  school?.plan_version || 'Versión 02 Febrero 2022',
      proceso:  'PROCESO: GESTIÓN ACADÉMICA Y CURRICULAR',
      logo_url: school?.logo_url || null,
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
  const { features } = useFeatures()
  const { showToast } = useToast()

  const [plan,          setPlan]          = useState(null)
  const [content,       setContent]       = useState(null)
  const [activePanel,   setActivePanel]   = useState('header')
  const [openSections,  setOpenSections]  = useState({})
  const [saveStatus,    setSaveStatus]    = useState('saved')
  const [exportOpen,    setExportOpen]    = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [draftRestore,  setDraftRestore]  = useState(null) // { content, savedAt } | null
  // ── IA modals ──
  const [showAnalyzer,  setShowAnalyzer]  = useState(false)
  const [showGenerator,   setShowGenerator]   = useState(false)
  const [showComments,    setShowComments]    = useState(false)
  const [showCorrections, setShowCorrections] = useState(false)
  const [showPreview,     setShowPreview]     = useState(true)
  const [linkedTarget,    setLinkedTarget]    = useState(null)

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
      const savedDays = c.days && Object.keys(c.days).length > 0 ? c.days : null
      if (!c.header) {
        c = buildInitialContent(
          { grade: data.grade, subject: data.subject, period: data.period,
            week: data.week_number, dateRange: data.date_range },
          teacher, school
        )
      }
      // Restore AI-generated days if they existed before buildInitialContent
      if (savedDays) {
        c.days = savedDays
      } else if (!c.days || Object.keys(c.days).length === 0) {
        c.days = await buildDaysFromDB(data, c)
      }
      // Always fetch logo fresh from school (prop may be stale from session start)
      const { data: schoolData } = await supabase
        .from('schools').select('logo_url').eq('id', teacher.school_id).single()
      c.header.logo_url = schoolData?.logo_url || null

      // ── Check for unsaved localStorage draft ──
      const draft = loadDraftLocal(id)
      if (draft && draft.savedAt) {
        const dbUpdated = data.updated_at ? new Date(data.updated_at).getTime() : 0
        if (draft.savedAt > dbUpdated) {
          // Draft is newer than DB — offer to restore
          setDraftRestore(draft)
        } else {
          // DB is newer — discard stale draft
          clearDraftLocal(id)
        }
      }

      setContent(c)
      contentRef.current = c
      setLoading(false)
    }
    load()
  }, [id])

  // ── Load linked learning target ──
  useEffect(() => {
    if (!plan?.target_id) { setLinkedTarget(null); return }
    supabase
      .from('learning_targets')
      .select('id, description, taxonomy, group_name, prerequisite_ids')
      .eq('id', plan.target_id)
      .single()
      .then(({ data }) => setLinkedTarget(data || null))
  }, [plan?.target_id])

  async function buildDaysFromDB(data, c) {
    let weekMonday
    if (data.monday_date) {
      weekMonday = new Date(data.monday_date + 'T12:00:00')
    } else {
      const year        = new Date().getFullYear()
      const schoolStart = new Date(year, 1, 2)
      const day0        = schoolStart.getDay()
      const diff0       = day0 === 0 ? -6 : 1 - day0
      const firstMonday = new Date(schoolStart)
      firstMonday.setDate(schoolStart.getDate() + diff0)
      weekMonday = new Date(firstMonday)
      weekMonday.setDate(firstMonday.getDate() + ((data.week_number || 1) - 1) * 7)
    }

    const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri']

    // ── Consultar schedule desde teacher_assignments ──
    let scheduledDayKeys = null
    let scheduleMap = null

    // PlannerPage stores grade as "${baseGrade} ${section}" (e.g. "10.° A").
    // teacher_assignments.grade stores only the base part ("10.°"), so strip
    // the section suffix before querying.
    const baseGrade = data.section && data.grade?.endsWith(' ' + data.section)
      ? data.grade.slice(0, -data.section.length - 1)
      : data.grade

    const { data: assignment } = await supabase
      .from('teacher_assignments')
      .select('schedule')
      .eq('teacher_id', teacher.id)
      .eq('grade', baseGrade)
      .eq('section', data.section)
      .eq('subject', data.subject)
      .maybeSingle()

    if (assignment?.schedule && Object.keys(assignment.schedule).length > 0) {
      scheduleMap = assignment.schedule
      scheduledDayKeys = DAY_KEYS.filter(k => scheduleMap[k])
    }

    // ── Si no hay schedule, usar los 5 días (fallback) ──
    const activeDayIndices = scheduledDayKeys
      ? scheduledDayKeys.map(k => DAY_KEYS.indexOf(k))
      : [0, 1, 2, 3, 4]

    // ── Generar ISOs para 1 o 2 semanas ──
    const weekCount = data.week_count || 1
    const isos = []
    for (let w = 0; w < weekCount; w++) {
      activeDayIndices.forEach(i => {
        const d = new Date(weekMonday)
        d.setDate(d.getDate() + w * 7 + i)
        isos.push(toISO(d))
      })
    }

    if (!isos.length) return {}

    // ── Filtrar festivos del calendario escolar ──
    const { data: calData } = await supabase
      .from('school_calendar').select('date, is_school_day, name')
      .eq('school_id', teacher.school_id).in('date', isos)
    const holMap = {}
    if (calData) calData.forEach(r => { holMap[r.date] = r })

    const days = {}
    isos.forEach((iso, idx) => {
      const cal = holMap[iso]
      if (!cal || cal.is_school_day !== false) {
        const dayKeyIdx = idx % activeDayIndices.length
        const dayKey  = scheduledDayKeys ? scheduledDayKeys[dayKeyIdx] : DAY_KEYS[activeDayIndices[dayKeyIdx]]
        const periods = scheduleMap?.[dayKey] || []
        const emptyDay = c.days?.[iso] || buildEmptyDay(iso)
        if (periods.length > 0 && !emptyDay.class_periods) {
          emptyDay.class_periods = periods.join(' + ')
        }
        days[iso] = emptyDay
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
      // Save draft to localStorage (survives refresh/crash)
      saveDraftLocal(id, next)
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
      saveDraftLocal(id, next)
      return next
    })
  }

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── IA: aplicar guía generada — recibe contenido ya mezclado ──
  function handleApplyGenerated(mergedContent) {
    contentRef.current = mergedContent
    dirtyRef.current = true
    setContent(mergedContent)
    setSaveStatus('unsaved')
    saveDraftLocal(id, mergedContent)
  }

  // ── Save ──
  const doSave = useCallback(async () => {
    if (!dirtyRef.current) return
    setSaveStatus('saving')
    const { error } = await supabase
      .from('lesson_plans')
      .update({ content: contentRef.current, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      setSaveStatus('error')
      logError(error, { page: 'GuideEditor', action: 'save', entityId: id })
      showToast('Error al guardar la guía', 'error')
    } else {
      setSaveStatus('saved')
      dirtyRef.current = false
      clearDraftLocal(id)
      showToast('Guía guardada ✓', 'success')
    }
  }, [id, showToast])

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

  // ── Días activos (para AIGeneratorModal) ──
  const activeDays = content
    ? Object.entries(content.days || {})
        .filter(([, day]) => day.active !== false)
        .map(([iso]) => iso)
        .sort()
    : []

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

  // ── Draft restore handler ──
  function handleRestoreDraft() {
    if (!draftRestore?.content) return
    const restored = draftRestore.content
    setContent(restored)
    contentRef.current = restored
    dirtyRef.current = true
    setSaveStatus('unsaved')
    setDraftRestore(null)
    showToast('Borrador restaurado — guárdalo cuando estés listo', 'info')
  }

  function handleDiscardDraft() {
    clearDraftLocal(id)
    setDraftRestore(null)
    showToast('Borrador descartado', 'warning')
  }

  return (
    <div className="ge-wrap">

      {/* ── Draft restore banner ── */}
      {draftRestore && (
        <div style={{
          background: '#FFFDF0', border: '1.5px solid #F5C300', borderRadius: 10,
          padding: '12px 18px', margin: '0 0 12px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 18 }}>💾</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#8a4f00' }}>
              Se encontró un borrador sin guardar
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
              Guardado localmente el {new Date(draftRestore.savedAt).toLocaleString('es-CO')}
            </div>
          </div>
          <button onClick={handleRestoreDraft} style={{
            padding: '6px 16px', borderRadius: 8, border: 'none',
            background: '#1A3A8F', color: 'white', fontSize: 12,
            fontWeight: 700, cursor: 'pointer',
          }}>
            ✅ Restaurar
          </button>
          <button onClick={handleDiscardDraft} style={{
            padding: '6px 16px', borderRadius: 8, border: '1px solid #ddd',
            background: 'white', color: '#888', fontSize: 12,
            fontWeight: 700, cursor: 'pointer',
          }}>
            Descartar
          </button>
        </div>
      )}

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
          {features.comments !== false && (
            <button
              className="btn-secondary"
              onClick={() => setShowComments(o => !o)}
              style={{ fontSize: '12px' }}>
              💬 Comentarios
            </button>
          )}
          {features.corrections !== false && (
            <button
              className="btn-secondary"
              onClick={() => setShowCorrections(true)}
              style={{ fontSize: '12px' }}>
              🔧 Correcciones
            </button>
          )}
          <div className="ge-export-wrap">
            <button className="btn-primary btn-save"
              onClick={() => setExportOpen(o => !o)}>
              📄 Exportar ▾
            </button>
            {exportOpen && (
              <div className="ge-export-menu" onMouseLeave={() => setExportOpen(false)}>
                <button onClick={async () => { setExportOpen(false); await doSave(); exportGuideDocx(contentRef.current) }}>
                  📄 Word (.docx)
                </button>
                <button onClick={() => { setExportOpen(false); exportHtml(contentRef.current) }}>
                  🌐 HTML
                </button>
                <button onClick={() => { setExportOpen(false); exportPdf(contentRef.current) }}>
                  🖨️ PDF (imprimir)
                </button>
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #e0e6f0' }} />
                {features.ai_analyze !== false && (
                  <button onClick={() => { setExportOpen(false); setShowAnalyzer(true) }}>
                    🔍 Analizar con IA
                  </button>
                )}
                {features.ai_generate !== false && (
                  <button onClick={() => { setExportOpen(false); setShowGenerator(true) }}>
                    🤖 Generar guía con IA
                  </button>
                )}
              </div>
            )}
          </div>
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
              <div className="ge-field">
                <label>Logo del colegio</label>
                {content.header.logo_url ? (
                  <div className="logo-preview-wrap">
                    <img src={content.header.logo_url} alt="Logo" className="logo-preview-img" />
                    <button className="logo-remove-btn"
                      onClick={async () => {
                        setContentField(['header','logo_url'], null)
                        await supabase.from('schools')
                          .update({ logo_url: null })
                          .eq('id', teacher.school_id)
                      }}>
                      ✕ Quitar logo
                    </button>
                  </div>
                ) : (
                  <label className="logo-upload-area">
                    <input type="file" accept="image/*" style={{ display:'none' }}
                      onChange={async e => {
                        const file = e.target.files[0]
                        if (!file) return
                        const ext  = file.name.split('.').pop()
                        const path = `logos/${teacher.school_id}/${Date.now()}.${ext}`
                        const { error } = await supabase.storage
                          .from('guide-images')
                          .upload(path, file, { upsert: true })
                        if (!error) {
                          const { data: urlData } = supabase.storage
                            .from('guide-images').getPublicUrl(path)
                          const logoUrl = urlData.publicUrl
                          // Save to guide content
                          setContentField(['header','logo_url'], logoUrl)
                          // Also save to school so all future guides use it
                          await supabase.from('schools')
                            .update({ logo_url: logoUrl })
                            .eq('id', teacher.school_id)
                        }
                      }} />
                    🏫 Clic para subir logo del colegio
                  </label>
                )}
              </div>
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
              <LearningTargetSelector
                planId={id}
                subject={content.info.asignatura}
                grade={content.info.grado}
                period={parseInt(content.info.periodo) || 1}
                schoolId={teacher.school_id}
                teacherId={teacher.id}
                currentTargetId={plan?.target_id || null}
                onChange={(targetId, target) => {
                  setPlan(prev => ({ ...prev, target_id: targetId }))
                  if (target) {
                    // Auto-fill objetivo fields from the linked target
                    setContentField(['objetivo', 'general'], target.description)
                    setContentField(['objetivo', 'indicador'],
                      `El estudiante demuestra este desempeño cuando logra: ${target.description}`
                    )
                  }
                }}
              />
              {plan?.target_id && (
                <div style={{ fontSize: '11px', color: '#888', margin: '-4px 0 8px', fontStyle: 'italic' }}>
                  ↑ Al vincular un objetivo, los campos de abajo se llenan automáticamente. Puedes editarlos para esta semana.
                </div>
              )}
              {richField('Objetivo general de la semana (va al documento exportado)',
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
              planId={id}
              grade={content.info.grado}
              subject={content.info.asignatura}
              objective={content.objetivo.general}
              showPreview={showPreview}
              setShowPreview={setShowPreview}
              learningTarget={linkedTarget}
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

      {/* ── Modales IA ── */}
      {showAnalyzer && (
        <AIAnalyzerModal
          content={contentRef.current}
          onClose={() => setShowAnalyzer(false)}
        />
      )}

      {showComments && (
        <CommentsPanel
          planId={id}
          teacher={teacher}
          onClose={() => setShowComments(false)}
        />
      )}

      {showCorrections && (
        <CorrectionRequestModal
          planId={id}
          teacher={teacher}
          onClose={() => setShowCorrections(false)}
        />
      )}

      {showGenerator && (
        <AIGeneratorModal
          grade={content.info.grado}
          subject={content.info.asignatura}
          period={content.info.periodo}
          activeDays={activeDays}
          currentContent={contentRef.current}
          onApply={handleApplyGenerated}
          onClose={() => setShowGenerator(false)}
          learningTarget={linkedTarget}
        />
      )}

    </div>
  )
}

// ── DayPanel ─────────────────────────────────────────────────────────────────

function DayPanel({ iso, day, setContentField, toggleDayActive, openSections, toggleSection, planId, grade, subject, objective, showPreview, setShowPreview, learningTarget }) {
  const { features } = useFeatures()
  const base = ['days', iso]
  const [layoutModal, setLayoutModal] = useState(null)
  // layoutModal = { sectionKey, sectionLabel } | null

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <label style={{ margin: 0 }}>Contenido / Actividades</label>
                        <button
                          onClick={() => setShowPreview(v => !v)}
                          style={{
                            fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                            border: '1px solid #c5d5f0', background: showPreview ? '#f0f4ff' : '#fff',
                            color: '#2E5598', cursor: 'pointer', fontWeight: 600,
                          }}>
                          {showPreview ? '👁 Ocultar preview' : '👁 Ver preview'}
                        </button>
                      </div>
                      <RichEditor
                        value={section.content || ''}
                        onChange={val => setContentField([...base,'sections',s.key,'content'], val)}
                        placeholder="Describe las actividades de esta sección…"
                        minHeight={120}
                      />
                      {features.wysiwyg !== false && showPreview && (section.content || (section.images && section.images.length > 0)) && (
                        <SectionPreview
                          section={section}
                          sectionMeta={s}
                        />
                      )}
                    </div>

                    {/* ── Sugerencia IA por sección ── */}
                    {features.ai_suggest !== false && <AISuggestButton
                      section={s}
                      grade={grade}
                      subject={subject}
                      objective={objective}
                      unit={day.unit}
                      dayName={getDayName(iso)}
                      existingContent={section.content}
                      onInsert={val => setContentField([...base,'sections',s.key,'content'], val)}
                      learningTarget={learningTarget}
                    />}

                    <div className="ge-field">
                      <label>Imágenes</label>
                      <ImageUploader
                        planId={planId}
                        dayIso={iso}
                        sectionKey={s.key}
                        images={section.images || []}
                        onChange={imgs => setContentField([...base,'sections',s.key,'images'], imgs)}
                      />
                    </div>
                    <div className="ge-field">
                      <label>🧩 Bloques Inteligentes</label>
                      <SmartBlocksList
                        blocks={section.smartBlocks || []}
                        onChange={blocks => setContentField([...base,'sections',s.key,'smartBlocks'], blocks)}
                      />
                    </div>
                    <div className="ge-field">
                      <label>🎬 Videos (YouTube / Vimeo)</label>
                      <VideoList
                        videos={section.videos || []}
                        onChange={vids => setContentField([...base,'sections',s.key,'videos'], vids)}
                      />
                    </div>

                    {/* ── Layout visual (solo secciones elegibles) ── */}
                    {LAYOUT_ELIGIBLE.includes(s.key) && (
                      <div style={{ marginTop: '6px', paddingTop: '10px', borderTop: '1px dashed #dde3f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '12px', color: '#888' }}>
                            {(() => {
                              const l = section.image_layout || (section.layout_mode === 'side' ? 'right' : section.layout_mode === 'stack' ? 'below' : null)
                              return l === 'below' ? 'Imágenes abajo' : l === 'right' ? 'Texto | Imágenes' : l === 'left' ? 'Imágenes | Texto' : 'Sin distribución configurada'
                            })()}
                          </span>
                          <button
                            style={{
                              fontSize: '12px', padding: '4px 12px', borderRadius: '7px',
                              border: '1px solid #4BACC6', background: '#f0faff',
                              color: '#2E5598', cursor: 'pointer', fontWeight: 600,
                            }}
                            onClick={() => setLayoutModal({ sectionKey: s.key, sectionLabel: s.label })}>
                            🖼 Distribuir imágenes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ── Layout Selector Modal ── */}
      {layoutModal && (
        <LayoutSelectorModal
          isOpen={!!layoutModal}
          onClose={() => setLayoutModal(null)}
          onConfirm={({ image_layout }) => {
            setContentField([...base, 'sections', layoutModal.sectionKey, 'image_layout'], image_layout)
          }}
          sectionLabel={layoutModal.sectionLabel}
          currentLayout={day.sections?.[layoutModal.sectionKey]?.image_layout ||
            (day.sections?.[layoutModal.sectionKey]?.layout_mode === 'side' ? 'right' : 'below')}
        />
      )}
    </div>
  )
}


// ── VideoList ─────────────────────────────────────────────────────────────────

function getEmbedUrl(url) {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vi = url.match(/vimeo\.com\/(\d+)/)
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`
  return null
}

function VideoList({ videos = [], onChange }) {
  function addVideo() {
    onChange([...videos, { url: '', label: '' }])
  }
  function updateVideo(idx, field, value) {
    onChange(videos.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }
  function removeVideo(idx) {
    onChange(videos.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {videos.map((v, idx) => {
        const embedUrl = getEmbedUrl(v.url)
        return (
          <div key={idx} style={{ border: '1px solid #c5d5f0', borderRadius: '8px', padding: '10px', background: '#f8faff' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <input
                type="url"
                placeholder="URL de YouTube o Vimeo"
                value={v.url || ''}
                onChange={e => updateVideo(idx, 'url', e.target.value)}
                style={{ flex: 1, fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #c5d5f0' }}
              />
              <input
                type="text"
                placeholder="Título (opcional)"
                value={v.label || ''}
                onChange={e => updateVideo(idx, 'label', e.target.value)}
                style={{ width: '140px', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '1px solid #c5d5f0' }}
              />
              <button
                onClick={() => removeVideo(idx)}
                style={{ background: '#fee', border: '1px solid #fcc', borderRadius: '6px', padding: '4px 8px', color: '#c00', cursor: 'pointer', fontWeight: 700 }}>
                ✕
              </button>
            </div>
            {embedUrl ? (
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '6px' }}>
                <iframe
                  src={embedUrl}
                  frameBorder="0"
                  allowFullScreen
                  title={v.label || 'Video'}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                />
              </div>
            ) : v.url ? (
              <div style={{ fontSize: '11px', color: '#e07000', padding: '4px 0' }}>⚠️ URL no reconocida — usa un link de YouTube o Vimeo</div>
            ) : null}
          </div>
        )
      })}
      <button
        onClick={addVideo}
        style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '5px 12px', borderRadius: '7px',
                 border: '1px solid #c5d5f0', background: '#f0f4ff', color: '#2E5598', cursor: 'pointer', fontWeight: 600 }}>
        + Agregar video
      </button>
    </div>
  )
}
