import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
import { SECTIONS, RICH_SECTIONS, MODELO_B_SUBJECTS } from '../utils/constants'
import { canManage } from '../utils/roles'
import { toISO, formatDateEN, getDayName, MONTHS_EN, DAYS_EN, MONTHS_ES } from '../utils/dateUtils'
import { useToggle } from '../hooks'
import { importGuideFromDocx } from '../utils/AIAssistant'
import DayPanel from '../components/editor/DayPanel'
import { buildEmptySection, buildEmptyDay } from '../utils/guideEditorUtils'

// â”€â”€ Map activity name â†’ SmartBlock stub â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€ Indicator text helper (handles Modelo A strings + Modelo B objects) â”€â”€â”€â”€â”€
function getIndText(ind) {
  if (!ind) return ''
  if (typeof ind === 'string') return ind
  return ind.texto_es || ind.texto_en || ind.habilidad || ''
}

// â”€â”€ localStorage draft helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DRAFT_PREFIX = 'cbf_draft_'

function saveDraftLocal(planId, content) {
  try {
    const key = DRAFT_PREFIX + planId
    const payload = { content, savedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(payload))
  } catch { /* quota exceeded or private mode â€” silent */ }
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


// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// buildEmptySection + buildEmptyDay â†’ src/utils/guideEditorUtils.js
// DayPanel + VideoList + getEmbedUrl â†’ src/components/editor/DayPanel.jsx

function buildInitialContent({ grade, subject, period, week, dateRange }, teacher, school) {
  return {
    header: {
      school:   school?.name     || 'COLEGIO BOSTON FLEXIBLE',
      dane:     `DANE: ${school?.dane || '308001800455'} â€” RESOLUCIÃ“N ${school?.resolution || '09685 DE 2019'}`,
      codigo:   school?.plan_code    || 'CBF-G AC-01',
      version:  school?.plan_version || 'VersiÃ³n 02 Febrero 2022',
      proceso:  'PROCESO: GESTIÃ“N ACADÃ‰MICA Y CURRICULAR',
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
        || 'El mundo y sus malos deseos pasarÃ¡n, pero el que hace la voluntad de Dios vivirÃ¡ para siempre.',
    },
    verse: { text: school?.year_verse || '', ref: school?.year_verse_ref || '' },
    days:    {},
    summary: { done: '', next: '' },
  }
}



// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Modal/UI toggles (migrated to useToggle) â”€â”€
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

  // â”€â”€ Load â”€â”€
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
      // Migrate old indicador (string) â†’ indicadores (array)
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
      c.header.logo_url = schoolData?.logo_url || null

      // â”€â”€ Check for unsaved localStorage draft â”€â”€
      const draft = loadDraftLocal(id)
      if (draft && draft.savedAt) {
        const dbUpdated = data.updated_at ? new Date(data.updated_at).getTime() : 0
        if (draft.savedAt > dbUpdated) {
          // Draft is newer than DB â€” offer to restore
          setDraftRestore(draft)
        } else {
          // DB is newer â€” discard stale draft
          clearDraftLocal(id)
        }
      }

      setContent(c)
      contentRef.current = c
      setLoading(false)
    }
    load()
  }, [id])

  // â”€â”€ Load linked learning target â”€â”€
  useEffect(() => {
    if (!plan?.target_id) { setLinkedTarget(null); return }
    supabase
      .from('learning_targets')
      .select('id, description, taxonomy, group_name, prerequisite_ids, indicadores, news_model, tematica_names')
      .eq('id', plan.target_id)
      .single()
      .then(({ data }) => setLinkedTarget(data || null))
  }, [plan?.target_id])

  // â”€â”€ Load NEWS projects linked to the same target â”€â”€
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

  // â”€â”€ Derive active NEWS project for this guide's date range â”€â”€
  // Priority 0: plan.news_project_id â€” set at guide creation, direct pointer
  // Priority 1: a NEWS activity fecha falls within the guide's days
  // Priority 2: nearest due_date AFTER the guide's first day â€” the next hito
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

  // â”€â”€ Derive the specific indicator for this guide from the active NEWS project â”€â”€
  // Modelo B: indicator object matched by skill (habilidad) from learning_targets.indicadores
  // Modelo A: synthetic indicator object built from news_projects.target_indicador
  const activeIndicator = useMemo(() => {
    if (!activeNewsProject) return null
    const subject = content?.info?.asignatura || ''
    const isModeloB = linkedTarget?.news_model === 'language' || MODELO_B_SUBJECTS.includes(subject)
    if (isModeloB) {
      // Modelo B â€” find the indicator object matching the project's skill
      if (!activeNewsProject.skill || !linkedTarget?.indicadores) return null
      return linkedTarget.indicadores.find(ind =>
        typeof ind === 'object' &&
        ind.habilidad?.toLowerCase() === activeNewsProject.skill.toLowerCase()
      ) || null
    } else {
      // Modelo A â€” use target_indicador from the NEWS project as a synthetic indicator
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
    if (content.objetivo?.principio) return // already has a value â€” don't overwrite
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

    // â”€â”€ Consultar schedule desde teacher_assignments â”€â”€
    let scheduledDayKeys = null
    let scheduleMap = null

    // PlannerPage stores grade as "${baseGrade} ${section}" (e.g. "10.Â° A").
    // teacher_assignments.grade stores only the base part ("10.Â°"), so strip
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

    // â”€â”€ Si no hay schedule, usar los 5 dÃ­as (fallback) â”€â”€
    const activeDayIndices = scheduledDayKeys
      ? scheduledDayKeys.map(k => DAY_KEYS.indexOf(k))
      : [0, 1, 2, 3, 4]

    // â”€â”€ Generar ISOs para 1 o 2 semanas â”€â”€
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

    // â”€â”€ Filtrar festivos del calendario escolar â”€â”€
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

  // â”€â”€ Content updaters â”€â”€
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

  // â”€â”€ IA: aplicar guÃ­a generada â€” recibe contenido ya mezclado â”€â”€
  function handleApplyGenerated(mergedContent) {
    contentRef.current = mergedContent
    dirtyRef.current = true
    setContent(mergedContent)
    setSaveStatus('unsaved')
    saveDraftLocal(id, mergedContent)
  }

  // â”€â”€ Save â”€â”€
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
      showToast('Error al guardar la guÃ­a', 'error')
    } else {
      setSaveStatus('saved')
      dirtyRef.current = false
      clearDraftLocal(id)
      showToast('GuÃ­a guardada âœ“', 'success')
    }
  }, [id, showToast])

  useEffect(() => {
    const interval = setInterval(doSave, 30000)
    return () => clearInterval(interval)
  }, [doSave])

  useEffect(() => { return () => { if (dirtyRef.current) doSave() } }, [doSave])

  // â”€â”€ Import .docx handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleDocxImport(e) {
    const file = e.target.files?.[0]
    if (!docxInputRef.current) return
    docxInputRef.current.value = ''
    if (!file) return
    if (!confirm('âš ï¸ Importar este documento reemplazarÃ¡ el contenido actual de la guÃ­a. Â¿Continuar?')) return
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
      showToast('âœ… Documento importado correctamente. Revisa y ajusta el contenido.', 'success')
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

  // â”€â”€ Panels â”€â”€
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
    { key: 'verse',    label: '1 Â· VersÃ­culo',    dot: '#C9A84C' },
    { key: 'objetivo', label: '2 Â· Indicador',   dot: '#9BBB59' },
    ...dayPanels.map(d => ({
      key: d.key, iso: d.iso, label: d.label,
      sub: `${MONTHS_ES[parseInt(d.iso.slice(5,7))-1]} ${parseInt(d.iso.slice(8,10))}`,
      dot: '#4BACC6',
      filled: d.filled, total: d.total,
    })),
    { key: 'summary', label: 'â˜… Resumen', dot: '#8064A2' },
  ]

  // â”€â”€ DÃ­as activos (para AIGeneratorModal) â”€â”€
  const activeDays = content
    ? Object.entries(content.days || {})
        .filter(([, day]) => day.active !== false)
        .map(([iso]) => iso)
        .sort()
    : []

  // â”€â”€ Cargar principios del mes de la guÃ­a â”€â”€
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

  // â”€â”€ Objeto de principios unificado para la IA â”€â”€
  const principles = content ? {
    yearVerse:          { text: content.verse?.text || school.year_verse || '', ref: content.verse?.ref || school.year_verse_ref || '' },
    monthVerse:         { text: monthPrinciples?.month_verse || '', ref: monthPrinciples?.month_verse_ref || '' },
    indicatorPrinciple: monthPrinciples?.indicator_principle || school.indicator_principle || '',
  } : null

  // â”€â”€ Field helpers â”€â”€
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

  // â”€â”€ Loading â”€â”€
  if (loading || !content) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando guÃ­aâ€¦</p>
    </div>
  )

  const activeDayISO = activePanel.startsWith('day-') ? activePanel.replace('day-', '') : null

  // â”€â”€ Draft restore handler â”€â”€
  function handleRestoreDraft() {
    if (!draftRestore?.content) return
    const restored = draftRestore.content
    setContent(restored)
    contentRef.current = restored
    dirtyRef.current = true
    setSaveStatus('unsaved')
    setDraftRestore(null)
    showToast('Borrador restaurado â€” guÃ¡rdalo cuando estÃ©s listo', 'info')
  }

  function handleDiscardDraft() {
    clearDraftLocal(id)
    setDraftRestore(null)
    showToast('Borrador descartado', 'warning')
  }

  return (
    <div className="ge-wrap">

      {/* â”€â”€ Draft restore banner â”€â”€ */}
      {draftRestore && (
        <div style={{
          background: '#FFFDF0', border: '1.5px solid #F5C300', borderRadius: 10,
          padding: '12px 18px', margin: '0 0 12px',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 18 }}>ðŸ’¾</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#8a4f00' }}>
              Se encontrÃ³ un borrador sin guardar
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
            âœ… Restaurar
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
        <button className="ge-back-btn" onClick={() => navigate('/plans')}>â† Mis GuÃ­as</button>
        <div className="ge-topbar-info">
          <span className="ge-guide-title">
            {content.info.grado} Â· {content.info.asignatura} Â· Semana {content.info.semana}
          </span>
          <span className="ge-guide-dates">{content.info.fechas}</span>
        </div>
        <div className="ge-save-area">
          <span className={`ge-save-status ge-save-${saveStatus}`}>
            {saveStatus === 'saving'  && <><span className="ge-save-pulse" />Guardandoâ€¦</>}
            {saveStatus === 'saved'   && 'âœ“ Guardado'}
            {saveStatus === 'unsaved' && 'â— Cambios sin guardar'}
            {saveStatus === 'error'   && 'âš  Error al guardar'}
          </span>
          <button className="btn-primary" onClick={doSave} disabled={saveStatus === 'saving'}>
            ðŸ’¾ Guardar
          </button>
          {features.comments !== false && (
            <button
              className="btn-secondary"
              onClick={toggleComments}
              style={{ fontSize: '12px' }}>
              ðŸ’¬ Comentarios
            </button>
          )}
          {features.corrections !== false && (
            <button
              className="btn-secondary"
              onClick={openCorrections}
              style={{ fontSize: '12px' }}>
              ðŸ”§ Correcciones
            </button>
          )}
          {/* BotÃ³n principal: Imprimir / PDF */}
          <button className="ge-print-btn"
            onClick={() => { doSave(); exportPdf(contentRef.current, activeNewsProject) }}
            title="Guardar e imprimir como PDF">
            ðŸ–¨ï¸ <span className="ge-print-label">Imprimir / PDF</span>
          </button>

          <div className="ge-export-wrap">
            <button className="btn-secondary"
              style={{ fontSize: '12px' }}
              onClick={toggleExport}>
              â‹¯ MÃ¡s opciones â–¾
            </button>
            {exportOpen && (
              <div className="ge-export-menu" onMouseLeave={closeExport}>
                <div style={{ padding: '4px 12px 6px', fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Exportar como
                </div>
                <button onClick={async () => { closeExport(); await doSave(); exportGuideDocx(contentRef.current) }}>
                  ðŸ“„ Word (.docx) â€” para correcciones
                </button>
                <button onClick={() => { closeExport(); exportHtml(contentRef.current, activeNewsProject) }}>
                  ðŸŒ HTML â€” archivo web
                </button>
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #e0e6f0' }} />
                <div style={{ padding: '4px 12px 6px', fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Inteligencia Artificial
                </div>
                {features.ai_analyze !== false && (
                  <button onClick={() => { closeExport(); openAnalyzer() }}>
                    ðŸ” Analizar con IA
                  </button>
                )}
                {features.ai_generate !== false && (
                  <button onClick={() => { closeExport(); openGenerator() }}>
                    ðŸ¤– Generar guÃ­a con IA
                  </button>
                )}
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #e0e6f0' }} />
                <div style={{ padding: '4px 12px 6px', fontSize: '10px', fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Importar
                </div>
                <button onClick={() => { docxInputRef.current?.click() }} disabled={importingDocx}>
                  {importingDocx ? 'â³ Importandoâ€¦' : 'ðŸ“‚ Importar desde .docx'}
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

          {/* â”€â”€ Context Banner (read-only, always visible) â”€â”€ */}
          {activePanel !== 'header' && activePanel !== 'info' && (
            <div className="ge-context-banner">
              {content.header.logo_url && (
                <img src={content.header.logo_url} alt="Logo" className="ge-context-logo" />
              )}
              <div className="ge-context-info">
                <div className="ge-context-school">{content.header.school}</div>
                <div className="ge-context-meta">
                  <span>{content.info.grado}</span>
                  <span className="ge-context-sep">Â·</span>
                  <span>{content.info.asignatura}</span>
                  <span className="ge-context-sep">Â·</span>
                  <span>Semana {content.info.semana}</span>
                  <span className="ge-context-sep">Â·</span>
                  <span>{content.info.fechas}</span>
                </div>
                <div className="ge-context-teacher">{content.info.docente}</div>
              </div>
              {canManage(teacher.role) && (
                <div className="ge-context-admin-links">
                  <button className="ge-context-edit-btn" onClick={() => setActivePanel('header')}>
                    âš™ Encabezado
                  </button>
                  <button className="ge-context-edit-btn" onClick={() => setActivePanel('info')}>
                    âœ InformaciÃ³n
                  </button>
                </div>
              )}
            </div>
          )}

          {/* â”€â”€ Back to editing button (shown inside admin-only panels) â”€â”€ */}
          {(activePanel === 'header' || activePanel === 'info') && (
            <div style={{ marginBottom: '12px' }}>
              <button className="ge-context-back-btn" onClick={() => setActivePanel('verse')}>
                â† Volver al editor
              </button>
              {activePanel === 'header' && (
                <button className="ge-context-edit-btn" style={{ marginLeft: '8px' }}
                  onClick={() => setActivePanel('info')}>
                  InformaciÃ³n del perÃ­odo â†’
                </button>
              )}
            </div>
          )}

          {/* ENCABEZADO */}
          {activePanel === 'header' && (
            <div className="card">
              <div className="card-title"><div className="badge">1</div> Encabezado institucional</div>
              {inputField('Nombre del colegio', content.header.school,   ['header','school'],  'COLEGIO BOSTON FLEXIBLE')}
              {inputField('DANE / ResoluciÃ³n',  content.header.dane,     ['header','dane'])}
              <div className="ge-grid-2">
                {inputField('CÃ³digo',  content.header.codigo,  ['header','codigo'],  'CBF-G AC-01')}
                {inputField('VersiÃ³n', content.header.version, ['header','version'], 'VersiÃ³n 02 Febrero 2022')}
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
                    : <div style={{ fontSize: '24px' }}>ðŸ«</div>
                  }
                  <div>
                    <div style={{ fontSize: '12px', color: '#555', fontWeight: 500 }}>
                      {content.header.logo_url ? 'Logo institucional activo' : 'Sin logo cargado'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '3px' }}>
                      El logo se administra desde{' '}
                      <a href="/cbf-planner/settings" style={{ color: '#2E5598', fontWeight: 600 }}>
                        Panel de control â†’ Identidad institucional
                      </a>
                      {' '}y se aplica a todas las guÃ­as automÃ¡ticamente.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INFORMACIÃ“N */}
          {activePanel === 'info' && (
            <div className="card">
              <div className="card-title"><div className="badge">2</div> InformaciÃ³n del perÃ­odo</div>
              <div className="ge-grid-4">
                {inputField('Grado',      content.info.grado,      ['info','grado'],      '8.Â° (Azul y Rojo)')}
                {inputField('PerÃ­odo',    content.info.periodo,    ['info','periodo'],    '1.er PerÃ­odo 2026')}
                {inputField('Semana NÂ°',  content.info.semana,     ['info','semana'],     'Ej: 5')}
                {inputField('Asignatura', content.info.asignatura, ['info','asignatura'], 'Language Arts')}
              </div>
              <div className="ge-grid-2">
                {inputField('Docente',         content.info.docente, ['info','docente'], 'Nombre del docente')}
                {inputField('Rango de fechas', content.info.fechas,  ['info','fechas'],  'Ej: Mar. 23â€“27, 2026')}
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
                  â†‘ Al vincular un logro, los campos de abajo se llenan automÃ¡ticamente. Puedes editarlos para esta semana.
                </div>
              )}
              {activeNewsProject && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0 0 12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#666' }}>ðŸ“‹ Proyecto NEWS activo esta semana:</span>
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
                      Vincula un indicador de logro arriba para ver los criterios aquÃ­.
                    </div>
                  )
                })()}
                <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                  Para editar los indicadores ve a{' '}
                  <a href="#" onClick={e => { e.preventDefault(); navigate('/targets') }} style={{ color: '#2E5598' }}>
                    Indicadores de Logro â†’
                  </a>
                </div>
              </div>
              {inputField('Principio del indicador institucional',
                content.objetivo.principio, ['objetivo','principio'])}
            </div>
          )}

          {/* VERSÃCULO */}
          {activePanel === 'verse' && (
            <div className="card">
              <div className="card-title"><div className="badge">1</div> VersÃ­culo del aÃ±o â€” AÃ‘O DE LA PUREZA</div>
              <div className="verse-box">
                {school.year_verse}
                <span className="verse-ref">â€” {school.year_verse_ref}</span>
              </div>
              <p style={{ fontSize: 12, color: '#888', marginTop: 10 }}>
                El versÃ­culo del aÃ±o es declarado por el Pastor y se gestiona desde{' '}
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
              <div className="card-title"><div className="badge">â˜…</div> Resumen y prÃ³xima semana</div>
              {richField('Lo trabajado esta semana',
                content.summary.done, ['summary','done'], 'Actividades completadas esta semanaâ€¦', 120)}
              {richField('PrÃ³xima semana â€“ contenidos',
                content.summary.next, ['summary','next'], 'Temas de la prÃ³xima semanaâ€¦', 100)}
            </div>
          )}

        </div>
      </div>

      {/* â”€â”€ Modales IA â”€â”€ */}
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

