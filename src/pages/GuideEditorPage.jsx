import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import RichEditor from '../components/RichEditor'
import { exportGuideDocx } from '../utils/exportDocx'
import { exportHtml, exportPdf, exportDayHtml, getActiveDays } from '../utils/exportHtml'
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
import { SECTIONS, RICH_SECTIONS, MODELO_B_SUBJECTS } from '../utils/constants'
import { canManage } from '../utils/roles'
import { toISO, formatDateEN, getDayName, MONTHS_EN, DAYS_EN, MONTHS_ES } from '../utils/dateUtils'
import { useToggle } from '../hooks'
import { importGuideFromDocx } from '../utils/AIAssistant'
import DayPanel from '../components/editor/DayPanel'
import { buildEmptySection, buildEmptyDay } from '../utils/guideEditorUtils'

// ── Map activity name → SmartBlock stub ──────────────────────────────────────
function guessSmartBlock(act) {
  const n = (act.nombre || '').toLowerCase()
  if (n.includes('dict')) return {
    type: 'DICTATION', model: 'word-grid', section: 'skill',
    data: { words: [], instructions: act.descripcion || act.nombre, time: '10 min' }
  }
  if (n.includes('quiz') || n.includes('test')) return {
    type: 'QUIZ', model: 'topic-card', section: 'skill',
    data: { date: act.fecha || '', unit: act.descripcion || '', topics: act.descripcion || act.nombre }
  }
  if (n.includes('reading') || n.includes('lectura')) return {
    type: 'READING', model: 'comprehension', section: 'skill',
    data: { passage: '', questions: [{ q: act.descripcion || act.nombre, lines: 3 }] }
  }
  if (n.includes('speaking') || n.includes('oral')) return {
    type: 'SPEAKING', model: 'rubric', section: 'skill',
    data: { criteria: [{ name: 'Fluency', pts: 5 }, { name: 'Vocabulary', pts: 5 }, { name: 'Pronunciation', pts: 5 }] }
  }
  if (n.includes('vocab')) return {
    type: 'VOCAB', model: 'matching', section: 'activity',
    data: { words: [] }
  }
  if (n.includes('exit') || n.includes('ticket')) return {
    type: 'EXIT_TICKET', model: 'can-do', section: 'closing',
    data: { skills: [act.descripcion || act.nombre] }
  }
  return null
}

// ── Indicator text helper (handles Modelo A strings + Modelo B objects) ─────
function getIndText(ind) {
  if (!ind) return ''
  if (typeof ind === 'string') return ind
  return ind.texto_es || ind.texto_en || ind.habilidad || ''
}

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


// ── Helpers ──────────────────────────────────────────────────────────────────
// buildEmptySection + buildEmptyDay → src/utils/guideEditorUtils.js

function buildInitialContent({ grade, subject, period, week, dateRange }, teacher, school) {
  return {
    header: {
      school:   school?.name     || 'COLEGIO BOSTON FLEXIBLE',
      dane:     `DANE: ${school?.dane || '308001800455'} — RESOLUCIÓN ${school?.resolution || '09685 DE 2019'}`,
      codigo:   school?.document_code || 'CBF-G AC-01',
      version:  school?.doc_version  || 'Versión 02 Febrero 2022',
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
      principio:   '',   // se auto-puebla desde indicator/NEWS project en el useEffect
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
  const [activePanel,   setActivePanel]   = useState('verse')
  const [openSections,  setOpenSections]  = useState({})
  const [saveStatus,    setSaveStatus]    = useState('saved')
  const [loading,       setLoading]       = useState(true)
  const [draftRestore,  setDraftRestore]  = useState(null) // { content, savedAt } | null
  const [linkedTarget,      setLinkedTarget]      = useState(null)
  const [linkedNewsProjects, setLinkedNewsProjects] = useState([])
  const [monthPrinciples, setMonthPrinciples] = useState(null)

  // ── Modal/UI toggles (migrated to useToggle) ──
  const [exportOpen,      toggleExport,      openExport,      closeExport]      = useToggle(false)
  const [dayPickerOpen,   setDayPickerOpen]  = useState(false)
  const [showAnalyzer,    toggleAnalyzer,    openAnalyzer,    closeAnalyzer]    = useToggle(false)
  const [showGenerator,   toggleGenerator,   openGenerator,   closeGenerator]   = useToggle(false)
  const [showComments,    toggleComments,    openComments,    closeComments]    = useToggle(false)
  const [showCorrections, toggleCorrections, openCorrections, closeCorrections] = useToggle(false)
  const [showPreview,     togglePreview]                                        = useToggle(true)

  const dirtyRef      = useRef(false)
  const contentRef    = useRef(null)
  const docxInputRef  = useRef(null)
  const exportWrapRef = useRef(null)
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
        // If plan expanded to 2 weeks but only has 1 week of days, fill in week 2
        const wc = data.week_count || 1
        if (wc === 2 && Object.keys(savedDays).length <= 5) {
          const allDays = await buildDaysFromDB(data, c)
          c.days = { ...allDays, ...savedDays }
        } else {
          c.days = savedDays
        }
      } else if (!c.days || Object.keys(c.days).length === 0) {
        c.days = await buildDaysFromDB(data, c)
        // First-ever load: inject SmartBlocks from scheduled NEWS activities
        const { data: newsProjects } = await supabase
          .from('news_projects')
          .select('id, skill, grade, actividades_evaluativas')
          .eq('school_id', teacher.school_id)
          .eq('subject', data.subject)
        const dayIsos = new Set(Object.keys(c.days))
        ;(newsProjects || []).forEach(np => {
          if (!data.grade?.startsWith(np.grade || '')) return
          ;(np.actividades_evaluativas || []).forEach(act => {
            if (!act.fecha || !dayIsos.has(act.fecha)) return
            const stub = guessSmartBlock(act)
            if (!stub) return
            const sec = c.days[act.fecha]?.sections?.[stub.section]
            if (!sec) return
            const existing = sec.smartBlocks || []
            if (existing.some(b => b.type === stub.type)) return // already has one
            sec.smartBlocks = [...existing, { id: Date.now() + Math.random(), type: stub.type, model: stub.model, data: stub.data }]
          })
        })
      }
      // Migrate old indicador (string) → indicadores (array)
      if (c.objetivo) {
        if (!c.objetivo.indicadores) {
          c.objetivo.indicadores = c.objetivo.indicador ? [c.objetivo.indicador] : ['']
        }
      }

      // Auto-populate objetivo from linked target when fields are still empty
      if (data.target_id && c.objetivo) {
        const objetivoIsEmpty = !c.objetivo.general &&
          (!c.objetivo.indicadores || c.objetivo.indicadores.every(i => !getIndText(i)))
        if (objetivoIsEmpty) {
          const { data: target } = await supabase
            .from('learning_targets')
            .select('id, description, indicadores, news_model, tematica_names')
            .eq('id', data.target_id)
            .single()
          if (target) {
            if (target.description) c.objetivo.general = target.description
            if (target.indicadores?.length) {
              c.objetivo.indicadores = target.indicadores.map(ind =>
                typeof ind === 'object'
                  ? (ind.texto_en || ind.habilidad || '')
                  : (ind || '')
              ).filter(Boolean)
              if (!c.objetivo.indicadores.length) c.objetivo.indicadores = ['']
            }
          }
        }
      }

      // Always fetch logo fresh from school (prop may be stale from session start)
      const { data: schoolData } = await supabase
        .from('schools').select('logo_url').eq('id', teacher.school_id).single()
      const freshLogo = schoolData?.logo_url || null
      const logoChanged = c.header.logo_url !== freshLogo
      c.header.logo_url = freshLogo
      // If logo differs from what's saved in content, mark dirty so it persists
      if (logoChanged) dirtyRef.current = true

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
      .select('id, description, taxonomy, group_name, prerequisite_ids, indicadores, news_model, tematica_names')
      .eq('id', plan.target_id)
      .single()
      .then(({ data }) => setLinkedTarget(data || null))
  }, [plan?.target_id])

  // ── Load NEWS projects linked to the same target ──
  useEffect(() => {
    if (!plan?.target_id) { setLinkedNewsProjects([]); return }
    supabase
      .from('news_projects')
      .select('id, title, subject, status, skill, news_model, actividades_evaluativas, biblical_principle, biblical_reflection, due_date, target_indicador, conditions, textbook_reference, competencias, operadores_intelectuales, habilidades')
      .eq('target_id', plan.target_id)
      .eq('school_id', teacher.school_id)
      .limit(10)
      .then(({ data }) => setLinkedNewsProjects(data || []))
  }, [plan?.target_id])

  // ── Derive active NEWS project for this guide's date range ──
  // Priority 0: plan.news_project_id — set at guide creation, direct pointer
  // Priority 1: a NEWS activity fecha falls within the guide's days
  // Priority 2: nearest due_date AFTER the guide's first day — the next hito
  //   this guide is building toward. A guide never looks at a NEWS whose
  //   due_date is before the guide's own date.
  // Priority 3: any linked project without due_date (teacher hasn't scheduled yet)
  const activeNewsProject = useMemo(() => {
    if (!linkedNewsProjects.length || !content) return null
    const dayKeys = new Set(Object.keys(content.days || {}))
    if (!dayKeys.size) return null
    const sortedDays = [...dayKeys].sort()
    const firstDay = sortedDays[0]

    // Priority 0: direct pointer saved at guide creation
    if (plan?.news_project_id) {
      const direct = linkedNewsProjects.find(np => np.id === plan.news_project_id)
      if (direct) return direct
    }

    // Priority 1: activity date falls in guide's week
    const byActivity = linkedNewsProjects.find(np =>
      (np.actividades_evaluativas || []).some(act => act.fecha && dayKeys.has(act.fecha))
    )
    if (byActivity) return byActivity

    // Priority 2: nearest due_date on or after the guide's first day
    const future = linkedNewsProjects
      .filter(np => np.due_date && np.due_date >= firstDay)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
    if (future.length) return future[0]

    // Priority 3: projects without due_date (teacher hasn't set dates yet)
    const noDueDate = linkedNewsProjects.filter(np => np.skill && !np.due_date)
    if (noDueDate.length) return noDueDate[0]

    return null
  }, [linkedNewsProjects, content?.days, plan?.news_project_id])

  // ── Derive the specific indicator for this guide from the active NEWS project ──
  // Modelo B: indicator object matched by skill (habilidad) from learning_targets.indicadores
  // Modelo A: synthetic indicator object built from news_projects.target_indicador
  const activeIndicator = useMemo(() => {
    if (!activeNewsProject) return null
    const subject = content?.info?.asignatura || ''
    const isModeloB = linkedTarget?.news_model === 'language' || MODELO_B_SUBJECTS.includes(subject)
    if (isModeloB) {
      // Modelo B — find the indicator object matching the project's skill
      if (!activeNewsProject.skill || !linkedTarget?.indicadores) return null
      return linkedTarget.indicadores.find(ind =>
        typeof ind === 'object' &&
        ind.habilidad?.toLowerCase() === activeNewsProject.skill.toLowerCase()
      ) || null
    } else {
      // Modelo A — use target_indicador from the NEWS project as a synthetic indicator
      if (!activeNewsProject.target_indicador) return null
      return {
        texto_en: activeNewsProject.target_indicador,
        taxonomy: linkedTarget?.taxonomy || null,
      }
    }
  }, [activeNewsProject, linkedTarget])

  // Auto-populate principio from indicator's principio_biblico (once, only if empty)
  // Fallback: use biblical_principle from the active NEWS project
  const principioInitRef = useRef(false)
  useEffect(() => {
    if (principioInitRef.current) return
    if (!content) return
    if (content.objetivo?.principio) return // already has a value — don't overwrite
    let text = ''
    if (activeIndicator?.principio_biblico) {
      const pb = activeIndicator.principio_biblico
      text = pb.cita || pb.titulo || ''
    } else if (activeNewsProject?.biblical_principle) {
      text = activeNewsProject.biblical_principle
    }
    if (!text) return
    principioInitRef.current = true
    setContentField(['objetivo', 'principio'], text)
  }, [activeIndicator, activeNewsProject, content?.objetivo?.principio])

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

  // ── Click-outside closes export dropdown ──────────────────
  useEffect(() => {
    if (!exportOpen) return
    function handleClick(e) {
      if (exportWrapRef.current && !exportWrapRef.current.contains(e.target)) {
        setDayPickerOpen(false)
        closeExport()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [exportOpen, closeExport])

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
    { key: 'verse',    label: '1 · Versículo',    dot: '#C9A84C' },
    { key: 'objetivo', label: '2 · Indicador',   dot: '#9BBB59' },
    ...dayPanels.map(d => ({
      key: d.key, iso: d.iso, label: d.label,
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
  // Prioridad indicatorPrinciple: principio del indicador activo > NEWS project > mes > colegio
  const principles = content ? {
    yearVerse:          { text: content.verse?.text || school.year_verse || '', ref: content.verse?.ref || school.year_verse_ref || '' },
    monthVerse:         { text: monthPrinciples?.month_verse || '', ref: monthPrinciples?.month_verse_ref || '' },
    indicatorPrinciple: activeIndicator?.principio_biblico?.cita
                        || activeIndicator?.principio_biblico?.titulo
                        || activeNewsProject?.biblical_principle
                        || monthPrinciples?.indicator_principle
                        || school.indicator_principle
                        || '',
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
            onClick={() => { doSave(); exportPdf(contentRef.current, activeNewsProject) }}
            title="Guardar e imprimir como PDF">
            🖨️ <span className="ge-print-label">Imprimir / PDF</span>
          </button>

          <div className="ge-export-wrap" ref={exportWrapRef}>
            <button className="btn-secondary"
              style={{ fontSize: '12px' }}
              onClick={toggleExport}>
              ⋯ Más opciones ▾
            </button>
            {exportOpen && (
              <div className="ge-export-menu">
                <div style={{ padding: '4px 12px 6px', fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Exportar como
                </div>
                <button onClick={async () => { closeExport(); await doSave(); exportGuideDocx(contentRef.current) }}>
                  📄 Word (.docx) — para correcciones
                </button>
                <button onClick={() => { closeExport(); exportHtml(contentRef.current, activeNewsProject) }}>
                  🌐 HTML — archivo web
                </button>
                <button onClick={() => setDayPickerOpen(v => !v)}>
                  🏫 Campus Virtual — por jornada {dayPickerOpen ? '▴' : '▾'}
                </button>
                {dayPickerOpen && getActiveDays(contentRef.current).map(({ key, label }) => (
                  <button key={key}
                    style={{ paddingLeft: '24px', color: '#2E5598', fontWeight: 600 }}
                    onClick={() => {
                      setDayPickerOpen(false)
                      closeExport()
                      exportDayHtml(contentRef.current, key, activeNewsProject)
                    }}>
                    📅 {label}
                  </button>
                ))}
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
          {(() => {
            const week2Monday = plan?.week_count === 2 && plan?.monday_date
              ? (() => { const d = new Date(plan.monday_date + 'T12:00:00'); d.setDate(d.getDate() + 7); return toISO(d) })()
              : null
            let week2Inserted = false
            let week1Inserted = false
            return panels.map(p => {
              const items = []
              if (week2Monday && p.iso && !week1Inserted) {
                week1Inserted = true
                items.push(
                  <div key="week1-sep" style={{ padding: '4px 12px 2px', fontSize: '10px', fontWeight: 700, color: '#2E5598', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    Semana 1
                  </div>
                )
              }
              if (week2Monday && p.iso && p.iso >= week2Monday && !week2Inserted) {
                week2Inserted = true
                items.push(
                  <div key="week2-sep" style={{ padding: '4px 12px 2px', fontSize: '10px', fontWeight: 700, color: '#2E5598', textTransform: 'uppercase', letterSpacing: '.5px', borderTop: '1px solid #d0d9ef', marginTop: '4px' }}>
                    Semana 2
                  </div>
                )
              }
              items.push(
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
              )
              return items
            })
          })()}
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
              <button className="ge-context-back-btn" onClick={() => setActivePanel('verse')}>
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
              <div className="card-title"><div className="badge">2</div> Indicador de Logro</div>
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
                    setContentField(['objetivo', 'general'], target.description || '')
                    const inds = target.indicadores?.length
                      ? target.indicadores.map(ind =>
                          typeof ind === 'object'
                            ? (ind.texto_en || ind.habilidad || '')
                            : (ind || '')
                        ).filter(Boolean)
                      : []
                    setContentField(['objetivo', 'indicadores'],
                      inds.length ? inds : [`El estudiante demuestra este logro cuando: ${target.description || ''}`]
                    )
                  }
                }}
              />
              {plan?.target_id && (
                <div style={{ fontSize: '11px', color: '#888', margin: '-4px 0 8px', fontStyle: 'italic' }}>
                  ↑ Al vincular un logro, los campos de abajo se llenan automáticamente. Puedes editarlos para esta semana.
                </div>
              )}
              {activeNewsProject && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0 0 12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#666' }}>📋 Proyecto NEWS activo esta semana:</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '12px',
                    background: '#f0f7ff', border: '1px solid #c5d5f0', color: '#2E5598',
                  }}>
                    {activeNewsProject.title || activeNewsProject.skill || activeNewsProject.subject}
                  </span>
                </div>
              )}
              <div className="ge-field">
                <label>Indicador de Logro</label>
                {(() => {
                  // Show only the active indicator for this week; fall back to all if none found
                  const displayInds = activeIndicator
                    ? [activeIndicator]
                    : (content.objetivo.indicadores || []).filter(i => getIndText(i)).map(i => i)
                  const indTexts = activeIndicator
                    ? [getIndText(activeIndicator)]
                    : displayInds.map(i => getIndText(i)).filter(Boolean)
                  return indTexts.length > 0 ? (
                    <ol style={{ margin: '4px 0 8px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {indTexts.map((txt, idx) => (
                        <li key={idx} style={{ fontSize: '13px', color: '#333', lineHeight: '1.5', padding: '6px 10px', background: '#f6fff0', borderRadius: '6px', border: '1px solid #d4edda' }}>
                          {txt}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div style={{ fontSize: '12px', color: '#aaa', fontStyle: 'italic', padding: '8px 0' }}>
                      Vincula un indicador de logro arriba para ver los criterios aquí.
                    </div>
                  )
                })()}
                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  Para editar los indicadores ve a{' '}
                  <a href="#" onClick={e => { e.preventDefault(); navigate('/targets') }} style={{ color: '#2E5598' }}>
                    Indicadores de Logro →
                  </a>
                </div>
              </div>
              {inputField('Principio del indicador institucional',
                content.objetivo.principio, ['objetivo','principio'])}
            </div>
          )}

          {/* VERSÍCULO */}
          {activePanel === 'verse' && (
            <div className="card">
              <div className="card-title"><div className="badge">1</div> Versículo del año — AÑO DE LA PUREZA</div>
              <div className="verse-box">
                {school.year_verse}
                <span className="verse-ref">— {school.year_verse_ref}</span>
              </div>
              <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>
                El versículo del año es declarado por el Pastor y se gestiona desde{' '}
                <strong>Principios Rectores</strong>.
              </p>
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
              {richField('Lo trabajado esta semana',
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
          activeIndicator={activeIndicator}
          activeNewsProject={activeNewsProject}
          principles={principles}
        />
      )}

    </div>
  )
}
