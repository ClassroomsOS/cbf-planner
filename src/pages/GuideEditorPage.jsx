import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import RichEditor from '../components/RichEditor'
import { exportGuideDocx } from '../utils/exportDocx'
import { exportHtml, exportPdf } from '../utils/exportHtml'
import ImageUploader from '../components/ImageUploader'
import { SmartBlocksList } from '../components/SmartBlocks'
import { AISuggestButton, AIAnalyzerModal, AIGeneratorModal } from '../components/AIComponents'
import CommentsPanel from '../components/CommentsPanel'
import SectionPreview from '../components/SectionPreview'
import { useFeatures } from '../context/FeaturesContext'
import CorrectionRequestModal from '../components/CorrectionRequestModal'
import LayoutSelectorModal, { LAYOUT_ELIGIBLE } from '../components/LayoutSelectorModal'
import LearningTargetSelector from '../components/LearningTargetSelector'
import { useToast } from '../context/ToastContext'
import { logError } from '../utils/logger'
import { SECTIONS, RICH_SECTIONS } from '../utils/constants'
import { canManage } from '../utils/roles'
import { toISO, formatDateEN, getDayName, MONTHS_EN, DAYS_EN, MONTHS_ES } from '../utils/dateUtils'
import { useToggle } from '../hooks'
import { importGuideFromDocx } from '../utils/AIAssistant'

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

// ── Helpers ──────────────────────────────────────────────────────────────────

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
      general:     '',
      indicadores: [''],
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

  // Core state (complex, keep as useState)
  const [plan,          setPlan]          = useState(null)
  const [content,       setContent]       = useState(null)
  const [activePanel,   setActivePanel]   = useState('objetivo')
  const [openSections,  setOpenSections]  = useState({})
  const [saveStatus,    setSaveStatus]    = useState('saved')
  const [loading,       setLoading]       = useState(true)
  const [draftRestore,  setDraftRestore]  = useState(null) // { content, savedAt } | null
  const [linkedTarget,    setLinkedTarget]    = useState(null)
  const [monthPrinciples, setMonthPrinciples] = useState(null)

  // ── Modal/UI toggles (migrated to useToggle) ──
  const [exportOpen,      toggleExport,      openExport,      closeExport]      = useToggle(false)
  const [showAnalyzer,    toggleAnalyzer,    openAnalyzer,    closeAnalyzer]    = useToggle(false)
  const [showGenerator,   toggleGenerator,   openGenerator,   closeGenerator]   = useToggle(false)
  const [showComments,    toggleComments,    openComments,    closeComments]    = useToggle(false)
  const [showCorrections, toggleCorrections, openCorrections, closeCorrections] = useToggle(false)
  const [showPreview,     togglePreview]                                        = useToggle(true)

  const dirtyRef      = useRef(false)
  const contentRef    = useRef(null)
  const docxInputRef  = useRef(null)
  const [importingDocx, setImportingDocx] = useState(false)

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
      // Migrate old indicador (string) → indicadores (array)
      if (c.objetivo) {
        if (!c.objetivo.indicadores) {
          c.objetivo.indicadores = c.objetivo.indicador ? [c.objetivo.indicador] : ['']
        }
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
    let calQuery = supabase
      .from('school_calendar').select('date, is_school_day, name')
      .eq('school_id', teacher.school_id).in('date', isos)
    if (teacher.level) {
      calQuery = calQuery.or(`level.is.null,level.eq.${teacher.level}`)
    }
    const { data: calData } = await calQuery
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

  // ── Import .docx handler ───────────────────────────────────
  async function handleDocxImport(e) {
    const file = e.target.files?.[0]
    if (!docxInputRef.current) return
    docxInputRef.current.value = ''
    if (!file) return
    if (!confirm('⚠️ Importar este documento reemplazará el contenido actual de la guía. ¿Continuar?')) return
    setImportingDocx(true)
    closeExport()
    try {
      const mammoth = await import('mammoth')
      const arrayBuffer = await file.arrayBuffer()
      const { value: docxText } = await mammoth.extractRawText({ arrayBuffer })
      const parsed = await importGuideFromDocx({
        docxText,
        grade:      contentRef.current?.info?.grado,
        subject:    contentRef.current?.info?.asignatura,
        principles: monthPrinciples,
      })
      // Merge: preserve header/info, replace days/objetivo/verse/summary from AI
      const merged = {
        ...contentRef.current,
        objetivo: parsed.objetivo || contentRef.current.objetivo,
        verse:    parsed.verse    || contentRef.current.verse,
        days:     parsed.days     || contentRef.current.days,
        summary:  parsed.summary  || contentRef.current.summary,
      }
      // Re-map days from named keys (lunes/martes) to date keys if needed
      if (parsed.days && Object.keys(parsed.days).some(k => k === 'lunes' || k === 'martes')) {
        const dateKeys = Object.keys(contentRef.current?.days || {})
        const dayNames = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']
        const remapped = {}
        dateKeys.forEach((dateKey, i) => {
          const namedKey = dayNames[i]
          if (parsed.days[namedKey]) remapped[dateKey] = { ...contentRef.current.days[dateKey], sections: parsed.days[namedKey].sections }
        })
        if (Object.keys(remapped).length > 0) merged.days = { ...contentRef.current.days, ...remapped }
      }
      contentRef.current = merged
      setContent({ ...merged })
      dirtyRef.current = true
      showToast('✅ Documento importado correctamente. Revisa y ajusta el contenido.', 'success')
    } catch (err) {
      showToast('Error al importar: ' + err.message, 'error')
    } finally {
      setImportingDocx(false)
    }
  }

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
        .map(([iso, day]) => {
          const filled = SECTIONS.filter(s => {
            const sec = day.sections?.[s.key]
            return !!(sec?.content || (sec?.images||[]).length || (sec?.smartBlocks||[]).length)
          }).length
          return { key: `day-${iso}`, iso, label: getDayName(iso), filled, total: SECTIONS.length }
        })
    : []

  const panels = [
    { key: 'objetivo', label: '1 · Logro',       dot: '#9BBB59' },
    { key: 'verse',    label: '2 · Versículo',   dot: '#C9A84C' },
    ...dayPanels.map(d => ({
      key: d.key, label: d.label,
      sub: `${MONTHS_ES[parseInt(d.iso.slice(5,7))-1]} ${parseInt(d.iso.slice(8,10))}`,
      dot: '#4BACC6',
      filled: d.filled, total: d.total,
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

  // ── Cargar principios del mes de la guía ──
  useEffect(() => {
    if (!content || !teacher.school_id) return
    const iso = activeDays[0] || new Date().toISOString().slice(0, 10)
    const year  = parseInt(iso.slice(0, 4))
    const month = parseInt(iso.slice(5, 7))
    supabase
      .from('school_monthly_principles')
      .select('*')
      .eq('school_id', teacher.school_id)
      .eq('year', year)
      .eq('month', month)
      .maybeSingle()
      .then(({ data }) => setMonthPrinciples(data || null))
  }, [teacher.school_id, content?.days])

  // ── Objeto de principios unificado para la IA ──
  const principles = content ? {
    yearVerse:          { text: content.verse?.text || school.year_verse || '', ref: content.verse?.ref || school.year_verse_ref || '' },
    monthVerse:         { text: monthPrinciples?.month_verse || '', ref: monthPrinciples?.month_verse_ref || '' },
    indicatorPrinciple: monthPrinciples?.indicator_principle || school.indicator_principle || '',
  } : null

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
            {saveStatus === 'saving'  && <><span className="ge-save-pulse" />Guardando…</>}
            {saveStatus === 'saved'   && '✓ Guardado'}
            {saveStatus === 'unsaved' && '● Cambios sin guardar'}
            {saveStatus === 'error'   && '⚠ Error al guardar'}
          </span>
          <button className="btn-primary" onClick={doSave} disabled={saveStatus === 'saving'}>
            💾 Guardar
          </button>
          {features.comments !== false && (
            <button
              className="btn-secondary"
              onClick={toggleComments}
              style={{ fontSize: '12px' }}>
              💬 Comentarios
            </button>
          )}
          {features.corrections !== false && (
            <button
              className="btn-secondary"
              onClick={openCorrections}
              style={{ fontSize: '12px' }}>
              🔧 Correcciones
            </button>
          )}
          {/* Botón principal: Imprimir / PDF */}
          <button className="ge-print-btn"
            onClick={() => { doSave(); exportPdf(contentRef.current) }}
            title="Guardar e imprimir como PDF">
            🖨️ Imprimir / PDF
          </button>

          <div className="ge-export-wrap">
            <button className="btn-secondary"
              style={{ fontSize: '12px' }}
              onClick={toggleExport}>
              ⋯ Más opciones ▾
            </button>
            {exportOpen && (
              <div className="ge-export-menu" onMouseLeave={closeExport}>
                <div style={{ padding: '4px 12px 6px', fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Exportar como
                </div>
                <button onClick={async () => { closeExport(); await doSave(); exportGuideDocx(contentRef.current) }}>
                  📄 Word (.docx) — para correcciones
                </button>
                <button onClick={() => { closeExport(); exportHtml(contentRef.current) }}>
                  🌐 HTML — archivo web
                </button>
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #e0e6f0' }} />
                <div style={{ padding: '4px 12px 6px', fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Inteligencia Artificial
                </div>
                {features.ai_analyze !== false && (
                  <button onClick={() => { closeExport(); openAnalyzer() }}>
                    🔍 Analizar con IA
                  </button>
                )}
                {features.ai_generate !== false && (
                  <button onClick={() => { closeExport(); openGenerator() }}>
                    🤖 Generar guía con IA
                  </button>
                )}
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #e0e6f0' }} />
                <div style={{ padding: '4px 12px 6px', fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Importar
                </div>
                <button onClick={() => { docxInputRef.current?.click() }} disabled={importingDocx}>
                  {importingDocx ? '⏳ Importando…' : '📂 Importar desde .docx'}
                </button>
              </div>
            )}
          </div>
          {/* Hidden file input for .docx import */}
          <input ref={docxInputRef} type="file" accept=".docx"
            style={{ display: 'none' }} onChange={handleDocxImport} />
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
                {p.total != null && (
                  <span className="ge-nav-day-progress">
                    <span className="ge-nav-day-bar">
                      <span style={{ width: `${(p.filled / p.total) * 100}%` }} />
                    </span>
                    <span className="ge-nav-day-count">{p.filled}/{p.total}</span>
                  </span>
                )}
              </span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="ge-content">

          {/* ── Context Banner (read-only, always visible) ── */}
          {activePanel !== 'header' && activePanel !== 'info' && (
            <div className="ge-context-banner">
              {content.header.logo_url && (
                <img src={content.header.logo_url} alt="Logo" className="ge-context-logo" />
              )}
              <div className="ge-context-info">
                <div className="ge-context-school">{content.header.school}</div>
                <div className="ge-context-meta">
                  <span>{content.info.grado}</span>
                  <span className="ge-context-sep">·</span>
                  <span>{content.info.asignatura}</span>
                  <span className="ge-context-sep">·</span>
                  <span>Semana {content.info.semana}</span>
                  <span className="ge-context-sep">·</span>
                  <span>{content.info.fechas}</span>
                </div>
                <div className="ge-context-teacher">{content.info.docente}</div>
              </div>
              {canManage(teacher.role) && (
                <div className="ge-context-admin-links">
                  <button className="ge-context-edit-btn" onClick={() => setActivePanel('header')}>
                    ⚙ Encabezado
                  </button>
                  <button className="ge-context-edit-btn" onClick={() => setActivePanel('info')}>
                    ✏ Información
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Back to editing button (shown inside admin-only panels) ── */}
          {(activePanel === 'header' || activePanel === 'info') && (
            <div style={{ marginBottom: '12px' }}>
              <button className="ge-context-back-btn" onClick={() => setActivePanel('objetivo')}>
                ← Volver al editor
              </button>
              {activePanel === 'header' && (
                <button className="ge-context-edit-btn" style={{ marginLeft: '8px' }}
                  onClick={() => setActivePanel('info')}>
                  Información del período →
                </button>
              )}
            </div>
          )}

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
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  background: '#f8fbff', border: '1px solid #d5e0f5',
                  borderRadius: '8px', padding: '12px 16px',
                }}>
                  {content.header.logo_url
                    ? <img src={content.header.logo_url} alt="Logo"
                        style={{ height: '48px', width: 'auto', objectFit: 'contain',
                          borderRadius: '4px', border: '1px solid #eee' }} />
                    : <div style={{ fontSize: '24px' }}>🏫</div>
                  }
                  <div>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 500 }}>
                      {content.header.logo_url ? 'Logo institucional activo' : 'Sin logo cargado'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>
                      El logo se administra desde{' '}
                      <a href="/cbf-planner/settings" style={{ color: '#2E5598', fontWeight: 600 }}>
                        Panel de control → Identidad institucional
                      </a>
                      {' '}y se aplica a todas las guías automáticamente.
                    </div>
                  </div>
                </div>
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
              <div className="card-title"><div className="badge">1</div> Logro de Aprendizaje</div>
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
                    setContentField(['objetivo', 'indicadores'],
                      target.indicadores?.length
                        ? target.indicadores
                        : [`El estudiante demuestra este logro cuando: ${target.description}`]
                    )
                  }
                }}
              />
              {plan?.target_id && (
                <div style={{ fontSize: '11px', color: '#888', margin: '-4px 0 8px', fontStyle: 'italic' }}>
                  ↑ Al vincular un logro, los campos de abajo se llenan automáticamente. Puedes editarlos para esta semana.
                </div>
              )}
              {richField('Logro de la semana (va al documento exportado)',
                content.objetivo.general, ['objetivo','general'],
                'Al finalizar la semana, el estudiante estará en capacidad de…', 100)}
              <div className="ge-field">
                <label>Indicadores de Logro</label>
                {(content.objetivo.indicadores || ['']).map((ind, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                    <span style={{ minWidth: '18px', paddingTop: '8px', color: '#9BBB59', fontWeight: 700, fontSize: '13px' }}>{idx + 1}.</span>
                    <textarea
                      value={ind}
                      onChange={e => {
                        const arr = [...(content.objetivo.indicadores || [''])]
                        arr[idx] = e.target.value
                        setContentField(['objetivo', 'indicadores'], arr)
                      }}
                      placeholder="El estudiante demuestra el logro cuando…"
                      rows={2}
                      className="ge-input"
                      style={{ flex: 1, resize: 'vertical' }}
                    />
                    {content.objetivo.indicadores?.length > 1 && (
                      <button
                        onClick={() => {
                          const arr = [...content.objetivo.indicadores]
                          arr.splice(idx, 1)
                          setContentField(['objetivo', 'indicadores'], arr)
                        }}
                        style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: '16px', padding: '6px 2px', lineHeight: 1 }}
                        title="Eliminar indicador"
                      >✕</button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => {
                    const arr = [...(content.objetivo.indicadores || [''])]
                    arr.push('')
                    setContentField(['objetivo', 'indicadores'], arr)
                  }}
                  style={{ fontSize: '12px', color: '#9BBB59', border: '1px solid #9BBB59', background: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', marginTop: '2px' }}
                >
                  + Agregar indicador
                </button>
              </div>
              {inputField('Principio del indicador institucional',
                content.objetivo.principio, ['objetivo','principio'])}
            </div>
          )}

          {/* VERSÍCULO */}
          {activePanel === 'verse' && (
            <div className="card">
              <div className="card-title"><div className="badge">2</div> Versículo del año — AÑO DE LA PUREZA</div>
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
              learningTarget={linkedTarget}
              principles={principles}
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
          principles={principles}
          onClose={closeAnalyzer}
        />
      )}

      {showComments && (
        <CommentsPanel
          planId={id}
          teacher={teacher}
          onClose={closeComments}
        />
      )}

      {showCorrections && (
        <CorrectionRequestModal
          planId={id}
          teacher={teacher}
          onClose={closeCorrections}
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
          onClose={closeGenerator}
          learningTarget={linkedTarget}
          principles={principles}
        />
      )}

    </div>
  )
}

// ── DayPanel ─────────────────────────────────────────────────────────────────

function DayPanel({ iso, day, setContentField, toggleDayActive, openSections, toggleSection, planId, grade, subject, objective, learningTarget, principles }) {
  const { features } = useFeatures()
  const base = ['days', iso]
  const [layoutModal,    setLayoutModal]    = useState(null)
  const [sectionPreviews, setSectionPreviews] = useState({})
  const sectionRefs = useRef({})

  function togglePreview(key) {
    setSectionPreviews(p => ({ ...p, [key]: !p[key] }))
  }

  function jumpToSection(s) {
    const sKey = `${iso}-${s.key}`
    if (!openSections[sKey]) toggleSection(sKey)
    setTimeout(() => {
      sectionRefs.current[s.key]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function getContentPeek(html) {
    if (!html) return ''
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return text.length > 64 ? text.slice(0, 64) + '…' : text
  }

  function wordCount(html) {
    if (!html) return 0
    return html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length
  }

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

          {/* ── Sticky section navigator ── */}
          <div className="ge-section-nav">
            {SECTIONS.map(s => {
              const sKey     = `${iso}-${s.key}`
              const section  = day.sections?.[s.key]
              const hasContent = !!(section?.content || (section?.images||[]).length || (section?.smartBlocks||[]).length)
              return (
                <button
                  key={s.key}
                  className={`ge-section-nav-pill ${openSections[sKey] ? 'active' : ''}`}
                  style={{ '--pill-color': s.hex }}
                  onClick={() => jumpToSection(s)}
                  title={s.label}
                >
                  <span className={`ge-nav-dot ${hasContent ? 'filled' : ''}`} />
                  {s.short}
                </button>
              )
            })}
          </div>

          {SECTIONS.map(s => {
            const sKey    = `${iso}-${s.key}`
            const isOpen  = openSections[sKey]
            const section = day.sections?.[s.key] || buildEmptySection(s.time)
            const peek    = getContentPeek(section.content)
            const sbCount  = (section.smartBlocks || []).length
            const imgCount = (section.images      || []).length
            const vidCount = (section.videos      || []).length
            const hasContent = !!(section.content || imgCount || sbCount)
            const wc = wordCount(section.content)
            const showPreview = sectionPreviews[s.key]

            return (
              <div key={s.key} className="ge-section-block"
                ref={el => sectionRefs.current[s.key] = el}>

                {/* ── Header ── */}
                <div className={`ge-section-hdr ${isOpen ? 'open' : ''}`}
                  style={{ background: s.hex }}
                  onClick={() => toggleSection(sKey)}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isOpen}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(sKey) } }}>

                  {isOpen ? (
                    <>
                      <div className="ge-section-hdr-left">
                        <span className="ge-section-label">{s.label}</span>
                        <span className="ge-section-time">{section.time || s.time}</span>
                      </div>
                      <span className="ge-section-arrow">▲</span>
                    </>
                  ) : (
                    <>
                      <div className="ge-section-hdr-left">
                        <span className={`ge-section-status-dot ${hasContent ? 'done' : ''}`} />
                        <span className="ge-section-label">{s.label}</span>
                        {peek && <span className="ge-section-peek">{peek}</span>}
                      </div>
                      <div className="ge-section-hdr-right">
                        {sbCount  > 0 && <span className="ge-chip">🧩 {sbCount}</span>}
                        {imgCount > 0 && <span className="ge-chip">🖼 {imgCount}</span>}
                        {vidCount > 0 && <span className="ge-chip">🎬 {vidCount}</span>}
                        <span className="ge-section-arrow">▼</span>
                      </div>
                    </>
                  )}
                </div>

                {/* ── Animated body ── */}
                <div className={`ge-section-body-wrap ${isOpen ? 'open' : ''}`}>
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
                          onClick={e => { e.stopPropagation(); togglePreview(s.key) }}
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
                      {wc > 0 && (
                        <div className="ge-word-count">{wc} palabra{wc !== 1 ? 's' : ''}</div>
                      )}
                      {features.wysiwyg !== false && showPreview && (section.content || imgCount > 0) && (
                        <SectionPreview section={section} sectionMeta={s} />
                      )}
                    </div>

                    {/* ── Sugerencia IA, imágenes, SmartBlocks y video — solo en RICH_SECTIONS ── */}
                    {RICH_SECTIONS.includes(s.key) && <>
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
                        principles={principles}
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
                          aiContext={{
                            sectionMeta:     s,
                            grade,
                            subject,
                            objective,
                            unit:            day.unit,
                            dayName:         getDayName(iso),
                            existingContent: section.content,
                            learningTarget,
                            principles,
                          }}
                        />
                      </div>
                      <div className="ge-field">
                        <label>🎬 Videos (YouTube / Vimeo)</label>
                        <VideoList
                          videos={section.videos || []}
                          onChange={vids => setContentField([...base,'sections',s.key,'videos'], vids)}
                        />
                      </div>
                    </>}

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
                </div>

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
