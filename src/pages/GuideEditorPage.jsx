import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import RichEditor from '../components/RichEditor'
import { exportGuideDocx } from '../utils/exportDocx'
import { exportHtml, exportPdf, exportDayHtml, getActiveDays } from '../utils/exportHtml'
import ImageUploader from '../components/ImageUploader'
import { SmartBlocksList } from '../components/SmartBlocks'
import { AISuggestButton, AIAnalyzerModal } from '../components/AIComponents'
import ConversationalGuideModal from '../components/ConversationalGuideModal'
import CommentsPanel from '../components/CommentsPanel'
import SectionPreview from '../components/SectionPreview'
import { useFeatures } from '../context/FeaturesContext'
import CorrectionRequestModal from '../components/CorrectionRequestModal'
import LayoutSelectorModal, { LAYOUT_ELIGIBLE } from '../components/LayoutSelectorModal'
import LearningTargetSelector from '../components/LearningTargetSelector'
import { useToast } from '../context/ToastContext'
import { logError } from '../utils/logger'
import { SECTIONS, RICH_SECTIONS, MODELO_B_SUBJECTS } from '../utils/constants'
import { canManage, canEditOthersDocs, canGiveFeedback } from '../utils/roles'
import { toISO, formatDateEN, getDayName, MONTHS_EN, DAYS_EN, MONTHS_ES } from '../utils/dateUtils'
import { useToggle } from '../hooks'
import { importGuideFromDocx } from '../utils/AIAssistant'
import DayPanel from '../components/editor/DayPanel'
import { buildEmptySection, buildEmptyDay } from '../utils/guideEditorUtils'
import EleotCoveragePanel from '../components/EleotCoveragePanel'
import useEleot from '../hooks/useEleot'

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
  if (n.includes('writ') || n.includes('escrit') || n.includes('paragraph') || n.includes('essay')) return {
    type: 'WRITING', model: 'guided', section: 'skill',
    data: { prompt: act.descripcion || act.nombre, sentence_starters: [], checklist: [] }
  }
  if (n.includes('self') || n.includes('autoe')) return {
    type: 'SELF_ASSESSMENT', model: 'checklist', section: 'closing',
    data: { skills: [] }
  }
  if (n.includes('peer') || n.includes('co-eval') || n.includes('coevalua')) return {
    type: 'PEER_REVIEW', model: 'stars', section: 'closing',
    data: {}
  }
  if (n.includes('digital') || n.includes('cambridge') || n.includes('platform') || n.includes('online')) return {
    type: 'DIGITAL_RESOURCE', model: 'platform', section: 'activity',
    data: { platform_name: 'Cambridge One', activity: act.descripcion || act.nombre }
  }
  if (n.includes('collab') || n.includes('group') || n.includes('team') || n.includes('jigsaw') || n.includes('pair')) return {
    type: 'COLLABORATIVE_TASK', model: 'think_pair', section: 'activity',
    data: { prompt: act.descripcion || act.nombre, pair_time: '3 min', share_time: '5 min' }
  }
  if (n.includes('real') || n.includes('life') || n.includes('scenario') || n.includes('connect')) return {
    type: 'REAL_LIFE_CONNECTION', model: 'scenario', section: 'motivation',
    data: { context: act.descripcion || act.nombre, questions: [] }
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
  const [linkedTarget,            setLinkedTarget]            = useState(null)
  const [linkedAchievementIndicator, setLinkedAchievementIndicator] = useState(null)
  const [linkedSyllabusTopics,    setLinkedSyllabusTopics]    = useState([])
  const [linkedNewsProjects, setLinkedNewsProjects] = useState([])
  const [monthPrinciples, setMonthPrinciples] = useState(null)

  // ── Other-teacher editing ──────────────────────────────────────
  // Computed once plan loads. isOtherTeacher = admin editing someone else's guide.
  const [ownerName,        setOwnerName]        = useState(null)
  const [showJustifModal,  setShowJustifModal]  = useState(false)
  const [justifText,       setJustifText]       = useState('')
  const [savingJustif,     setSavingJustif]     = useState(false)

  // ── Modal/UI toggles (migrated to useToggle) ──
  const [exportOpen,      toggleExport,      openExport,      closeExport]      = useToggle(false)
  const [dayPickerOpen,   setDayPickerOpen]  = useState(false)
  const [exportingDay,    setExportingDay]   = useState(false)
  const [showAnalyzer,    toggleAnalyzer,    openAnalyzer,    closeAnalyzer]    = useToggle(false)
  const [showGenerator,   toggleGenerator,   openGenerator,   closeGenerator]   = useToggle(false)
  const [showComments,    toggleComments,    openComments,    closeComments]    = useToggle(false)
  const [showCorrections, toggleCorrections, openCorrections, closeCorrections] = useToggle(false)
  const [showPreview,     togglePreview]                                        = useToggle(true)

  const dirtyRef      = useRef(false)
  const lockedRef     = useRef(false) // mirrors plan.locked — avoids stale closure in doSave
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
      lockedRef.current = !!data.locked
      // If admin/rector is opening another teacher's guide, fetch owner name
      if (data.teacher_id !== teacher.id && canEditOthersDocs(teacher.role)) {
        const { data: ownerRow } = await supabase
          .from('teachers').select('full_name').eq('id', data.teacher_id).single()
        if (ownerRow) setOwnerName(ownerRow.full_name)
      }
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

      // Auto-populate objetivo from linked indicator (new system) when fields are empty
      if (data.indicator_id && c.objetivo) {
        const objetivoIsEmpty = !c.objetivo.general &&
          (!c.objetivo.indicadores || c.objetivo.indicadores.every(i => !getIndText(i)))
        if (objetivoIsEmpty) {
          const { data: ind } = await supabase
            .from('achievement_indicators')
            .select('id, text, dimension, skill_area, goal_id')
            .eq('id', data.indicator_id)
            .single()
          if (ind?.text) {
            c.objetivo.indicadores = [ind.text]
            // Also fetch the parent goal text as the general objective
            if (ind.goal_id) {
              const { data: goal } = await supabase
                .from('achievement_goals')
                .select('text')
                .eq('id', ind.goal_id)
                .single()
              if (goal?.text) c.objetivo.general = goal.text
            }
          }
        }
      }

      // Auto-populate objetivo from linked target (legacy) when fields are still empty
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

  // ── Load linked learning target (legacy) ──
  useEffect(() => {
    if (!plan?.target_id) { setLinkedTarget(null); return }
    supabase
      .from('learning_targets')
      .select('id, description, taxonomy, group_name, prerequisite_ids, indicadores, news_model, tematica_names')
      .eq('id', plan.target_id)
      .single()
      .then(({ data }) => setLinkedTarget(data || null))
  }, [plan?.target_id])

  // ── Load linked achievement_indicator (new system) ──
  useEffect(() => {
    if (!plan?.indicator_id) { setLinkedAchievementIndicator(null); return }
    supabase
      .from('achievement_indicators')
      .select('id, goal_id, dimension, skill_area, text, student_text, weight, order_index')
      .eq('id', plan.indicator_id)
      .single()
      .then(({ data }) => setLinkedAchievementIndicator(data || null))
  }, [plan?.indicator_id])

  // ── Load syllabus topics for current week ──
  useEffect(() => {
    if (!plan?.subject || !plan?.grade || !plan?.period || !plan?.week_number) {
      setLinkedSyllabusTopics([]); return
    }
    supabase
      .from('syllabus_topics')
      .select('id, topic, content_type, description, resources, indicator_id')
      .eq('teacher_id', teacher.id)
      .eq('subject', plan.subject)
      .eq('grade', plan.grade.split(' ')[0]) // strip section ("8.° A" → "8.°")
      .eq('period', plan.period)
      .eq('week_number', plan.week_number)
      .order('created_at')
      .then(({ data }) => setLinkedSyllabusTopics(data || []))
  }, [plan?.subject, plan?.grade, plan?.period, plan?.week_number, teacher.id])

  // ── Load NEWS projects: direct pointer + indicator_id + legacy target_id ──
  useEffect(() => {
    if (!plan) return
    const { target_id, indicator_id, news_project_id } = plan
    if (!target_id && !indicator_id && !news_project_id) {
      setLinkedNewsProjects([]); return
    }
    const SELECT = 'id, title, subject, status, skill, news_model, indicator_id, actividades_evaluativas, biblical_principle, biblical_reflection, due_date, target_indicador, conditions, textbook_reference, competencias, operadores_intelectuales, habilidades'
    ;(async () => {
      const seen = new Set()
      const results = []

      const push = (rows) => {
        ;(rows || []).forEach(r => { if (!seen.has(r.id)) { seen.add(r.id); results.push(r) } })
      }

      // Priority 0: direct project pointer
      if (news_project_id) {
        const { data } = await supabase.from('news_projects').select(SELECT).eq('id', news_project_id).single()
        if (data) push([data])
      }

      // Priority 1: indicator_id (new system)
      if (indicator_id) {
        const { data } = await supabase.from('news_projects').select(SELECT)
          .eq('indicator_id', indicator_id).eq('school_id', teacher.school_id).limit(5)
        push(data)
      }

      // Priority 2: target_id (legacy)
      if (target_id) {
        const { data } = await supabase.from('news_projects').select(SELECT)
          .eq('target_id', target_id).eq('school_id', teacher.school_id).limit(10)
        push(data)
      }

      setLinkedNewsProjects(results)
    })()
  }, [plan?.target_id, plan?.indicator_id, plan?.news_project_id, teacher.school_id])

  // ── Derive active NEWS project for this guide's date range ──
  // Priority 0: plan.news_project_id — set at guide creation, direct pointer
  // Priority 1: a NEWS activity fecha falls within the guide's days
  // Priority 2: nearest due_date AFTER the guide's first day — the next hito
  //   this guide is building toward. A guide never looks at a NEWS whose
  //   due_date is before the guide's own date.
  // Priority 3: any linked project without due_date (teacher hasn't scheduled yet)
  // eleot® coverage — used by ConversationalGuideModal to pre-select weak domains
  const { coverage } = useEleot(content)

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

  // ── Derive the specific indicator for this guide ──
  // Priority 0: direct achievement_indicator (new system — plan.indicator_id)
  // Priority 1: Modelo B — matched from learning_targets.indicadores by skill
  // Priority 2: Modelo A — synthetic from news_projects.target_indicador
  const activeIndicator = useMemo(() => {
    // New system: direct link to achievement_indicators
    if (linkedAchievementIndicator) {
      return {
        texto_en:   linkedAchievementIndicator.text,
        dimension:  linkedAchievementIndicator.dimension,
        skill_area: linkedAchievementIndicator.skill_area,
      }
    }
    // Legacy system via NEWS project + learning target
    if (!activeNewsProject) return null
    const subject = content?.info?.asignatura || ''
    const isModeloB = linkedTarget?.news_model === 'language' || MODELO_B_SUBJECTS.includes(subject)
    if (isModeloB) {
      if (!activeNewsProject.skill || !linkedTarget?.indicadores) return null
      return linkedTarget.indicadores.find(ind =>
        typeof ind === 'object' &&
        ind.habilidad?.toLowerCase() === activeNewsProject.skill.toLowerCase()
      ) || null
    } else {
      if (!activeNewsProject.target_indicador) return null
      return {
        texto_en: activeNewsProject.target_indicador,
        taxonomy: linkedTarget?.taxonomy || null,
      }
    }
  }, [activeNewsProject, linkedTarget, linkedAchievementIndicator])

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
    if (lockedRef.current && !canEditOthersDocs(teacher.role)) return
    setSaveStatus('saving')
    // Build session_agenda from current smart blocks
    const { buildSessionAgenda, flattenAgendaForDb } = await import('../utils/AgendaGenerator')
    const agendaByDay = buildSessionAgenda(contentRef.current)
    const session_agenda = flattenAgendaForDb(agendaByDay)
    const { error } = await supabase
      .from('lesson_plans')
      .update({ content: contentRef.current, session_agenda, updated_at: new Date().toISOString() })
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

  // ── Manual save — guarded for other-teacher edits ──────────────────────────
  const isOtherTeacher = plan && plan.teacher_id !== teacher.id && canEditOthersDocs(teacher.role)

  function handleManualSave() {
    if (isOtherTeacher) {
      setShowJustifModal(true)
    } else {
      doSave()
    }
  }

  async function handleConfirmJustifSave() {
    if (!justifText.trim()) {
      showToast('Escribe una justificación antes de guardar.', 'error')
      return
    }
    setSavingJustif(true)
    await doSave()
    // Record in document_feedback so teacher sees why their guide was changed
    const title = `${content?.info?.grado || ''} · ${content?.info?.asignatura || ''} · Sem. ${content?.info?.semana || ''}`
    await supabase.from('document_feedback').insert({
      school_id:    teacher.school_id,
      entity_type:  'guide',
      entity_id:    id,
      entity_title: title,
      author_id:    teacher.id,
      body:         `[Edición directa] ${justifText.trim()}`,
    })
    // Notify plan owner
    await supabase.from('notifications').insert({
      school_id: teacher.school_id,
      from_id:   teacher.id,
      to_id:     plan.teacher_id,
      to_role:   'teacher',
      type:      'guide_edited',
      plan_id:   id,
      message:   `${teacher.full_name} editó tu guía "${title}". Justificación: ${justifText.trim()}`,
    })
    setSavingJustif(false)
    setShowJustifModal(false)
    setJustifText('')
    showToast('Guía guardada y docente notificado ✓', 'success')
  }

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

      {/* ── Locked banner ──────────────────────────────────── */}
      {plan?.locked && (
        <div style={{
          background: 'linear-gradient(90deg,#064E3B,#065F46)',
          color: '#fff', padding: '8px 20px',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        }}>
          <span style={{ fontSize: 18 }}>📦</span>
          <span style={{ flex: 1 }}>
            Guía <strong>publicada y bloqueada</strong> — versión inmutable.
            {!canEditOthersDocs(teacher.role) && ' Contacta a coordinación para solicitar cambios.'}
          </span>
          {canEditOthersDocs(teacher.role) && (
            <button type="button"
              onClick={async () => {
                const { error } = await supabase.from('lesson_plans')
                  .update({ locked: false, status: 'approved' }).eq('id', id)
                if (!error) {
                  setPlan(p => ({ ...p, locked: false, status: 'approved' }))
                  lockedRef.current = false
                  showToast('Guía desbloqueada — puede editarse', 'info')
                }
              }}
              style={{
                padding: '5px 14px', borderRadius: 7, border: 'none',
                background: 'rgba(255,255,255,.2)', color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}>
              🔓 Desbloquear
            </button>
          )}
        </div>
      )}

      {/* ── Other-teacher banner ─────────────────────────────── */}
      {isOtherTeacher && ownerName && (
        <div style={{
          background: 'linear-gradient(90deg,#7A3A00,#B05A00)',
          color: '#fff', padding: '8px 20px',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <span>
            Estás editando la guía de <strong>{ownerName}</strong>.
            Cada guardado manual requiere justificación y notifica al docente.
          </span>
          <a href="/sala-revision" onClick={e => { e.preventDefault(); navigate('/sala-revision') }}
            style={{ marginLeft: 'auto', color: '#FFD580', fontSize: 12, textDecoration: 'underline' }}>
            ← Volver a Sala de Revisión
          </a>
        </div>
      )}

      {/* Top bar */}
      <div className="ge-topbar">
        <button className="ge-back-btn" onClick={() => navigate(isOtherTeacher ? '/sala-revision' : '/plans')}>
          {isOtherTeacher ? '← Sala de Revisión' : '← Mis Guías'}
        </button>
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
          <button className="btn-primary"
            onClick={handleManualSave}
            disabled={saveStatus === 'saving' || (plan?.locked && !canEditOthersDocs(teacher.role))}
            style={isOtherTeacher ? { background: '#B05A00', borderColor: '#B05A00' } : {}}>
            {isOtherTeacher ? '💾 Guardar (con justificación)' : '💾 Guardar'}
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
            onClick={async () => { doSave(); await exportPdf(contentRef.current, activeNewsProject) }}
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
                <button onClick={async () => { closeExport(); await exportHtml(contentRef.current, activeNewsProject) }}>
                  🌐 HTML — archivo web
                </button>
                <button onClick={() => setDayPickerOpen(v => !v)}>
                  🏫 Campus Virtual — por jornada {dayPickerOpen ? '▴' : '▾'}
                </button>
                {dayPickerOpen && (
                  <>
                    {getActiveDays(contentRef.current).map(({ key, label }) => (
                      <button key={key}
                        style={{ paddingLeft: '24px', color: exportingDay ? '#aaa' : '#2E5598', fontWeight: 600 }}
                        disabled={exportingDay}
                        onClick={() => {
                          setDayPickerOpen(false)
                          closeExport()
                          exportDayHtml(contentRef.current, key, activeNewsProject)
                        }}>
                        {exportingDay ? '⏳ Generando…' : `📅 ${label}`}
                      </button>
                    ))}
                  </>
                )}
                <hr style={{ margin: '4px 0', border: 'none', borderTop: '1px solid #e0e6f0' }} />
                {/* Enviar para revisión — solo docente dueño, no admin editando ajeno */}
                {!isOtherTeacher && plan?.status !== 'approved' && (
                  <button onClick={async () => {
                    closeExport()
                    const nextStatus = plan?.status === 'submitted' ? 'complete' : 'submitted'
                    const { error } = await supabase.from('lesson_plans').update({ status: nextStatus }).eq('id', id)
                    if (!error) {
                      setPlan(p => ({ ...p, status: nextStatus }))
                      if (nextStatus === 'submitted') {
                        await supabase.from('notifications').insert({
                          school_id: teacher.school_id, from_id: teacher.id, to_role: 'admin',
                          type: 'plan_submitted', plan_id: id,
                          message: `${teacher.full_name} envió la guía de ${content?.info?.asignatura} — ${content?.info?.grado}, Sem. ${content?.info?.semana}`,
                        })
                        showToast('Guía enviada para revisión 📤', 'success')
                      } else {
                        showToast('Guía marcada como Completa', 'success')
                      }
                    }
                  }} style={{ color: plan?.status === 'submitted' ? '#374151' : '#1D4ED8', fontWeight: 600 }}>
                    {plan?.status === 'submitted' ? '↩ Marcar como Completa' : '📤 Enviar para revisión'}
                  </button>
                )}
                {plan?.status === 'approved' && !isOtherTeacher && (
                  <button disabled style={{ color: '#9BBB59', fontWeight: 700, cursor: 'default' }}>
                    ✅ Aprobada por coordinación
                  </button>
                )}
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

        {/* Left sidebar: nav + eleot panel */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 180, minWidth: 180, flexShrink: 0, borderRight: '1.5px solid #dde5f0', background: '#f8faff', overflow: 'hidden' }}>

        {/* Nav */}
        <nav className="ge-nav" style={{ flex: 1, width: '100%', borderRight: 'none', minWidth: 'unset' }}>
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

        {/* eleot® Coverage Panel — bottom of left sidebar */}
        <EleotCoveragePanel content={content} />

        </div>{/* end left sidebar */}

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

              {/* ── New system: achievement_indicator card ── */}
              {linkedAchievementIndicator ? (
                <div style={{ background: '#f0fff4', border: '1px solid #b8e8c8', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#1A6B3A', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>
                    🎯 Indicador vinculado
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    {linkedAchievementIndicator.dimension && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#5a8a00', background: '#e8f5e8', padding: '2px 7px', borderRadius: 3, textTransform: 'uppercase' }}>
                        {{ cognitive: '🧠 Cognitivo', procedural: '🛠️ Procedimental', attitudinal: '💫 Actitudinal' }[linkedAchievementIndicator.dimension] || linkedAchievementIndicator.dimension}
                      </span>
                    )}
                    {linkedAchievementIndicator.skill_area && (
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#1A3A8F', background: '#eef2fb', padding: '2px 7px', borderRadius: 3 }}>
                        {{ speaking: '🎤', listening: '🎧', reading: '📖', writing: '✍️', general: '📋' }[linkedAchievementIndicator.skill_area]} {linkedAchievementIndicator.skill_area}
                      </span>
                    )}
                    {linkedAchievementIndicator.weight && (
                      <span style={{ fontSize: 9, color: '#888', background: '#f5f5f5', padding: '2px 7px', borderRadius: 3 }}>
                        {linkedAchievementIndicator.weight}%
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#1a1a2e', lineHeight: 1.5 }}>{linkedAchievementIndicator.text}</div>
                  {linkedAchievementIndicator.student_text && (
                    <div style={{ fontSize: 11, color: '#666', marginTop: 6, fontStyle: 'italic', lineHeight: 1.4 }}>
                      👩‍🎓 {linkedAchievementIndicator.student_text}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: '#888', marginTop: 6 }}>
                    Para cambiar el indicador, ve a{' '}
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/objectives') }} style={{ color: '#1A6B3A' }}>
                      Objetivos →
                    </a>
                  </div>
                </div>
              ) : (
                /* ── Legacy: LearningTargetSelector ── */
                <>
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
                      ↑ Al vincular un logro, los campos de abajo se llenan automáticamente.
                    </div>
                  )}
                </>
              )}

              {/* ── Syllabus topics for this week ── */}
              {linkedSyllabusTopics.length > 0 && (
                <div style={{ background: '#f8f6ff', border: '1px solid #d4c8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#5a3a8a', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 6 }}>
                    📚 Contenidos del Syllabus — Semana {plan?.week_number}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {linkedSyllabusTopics.map(st => (
                      <div key={st.id} style={{ fontSize: 12, color: '#2a1a4a', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: '#8a6aaa', background: '#ece8f8', padding: '1px 6px', borderRadius: 3, flexShrink: 0, marginTop: 1, textTransform: 'uppercase' }}>
                          {st.content_type}
                        </span>
                        <span style={{ lineHeight: 1.4 }}>{st.topic}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeNewsProject && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0 0 12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#666' }}>📋 Proyecto NEWS activo:</span>
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
        <ConversationalGuideModal
          grade={content.info.grado}
          subject={content.info.asignatura}
          period={content.info.periodo}
          activeDays={activeDays}
          indicator={linkedAchievementIndicator}
          learningTarget={linkedTarget}
          activeNewsProject={activeNewsProject}
          currentContent={contentRef.current}
          principles={principles}
          eleotCoverage={coverage}
          onApply={handleApplyGenerated}
          onClose={closeGenerator}
        />
      )}

      {/* ── Justification modal (admin editing other teacher's guide) ──── */}
      {showJustifModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: '28px',
            maxWidth: 480, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,.22)',
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#1F3864' }}>
              Justificación de edición
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B' }}>
              Estás guardando cambios en la guía de <strong>{ownerName}</strong>.
              El docente recibirá una notificación con tu justificación.
            </p>
            <textarea
              value={justifText}
              onChange={e => setJustifText(e.target.value)}
              rows={4}
              placeholder="Ej: Corregí la ortografía en la sección Skill y actualicé el Smart Block de Dictation…"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 12px', borderRadius: 8,
                border: `2px solid ${justifText.trim() ? '#2E5598' : '#E2E8F0'}`,
                fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                outline: 'none', transition: 'border-color .15s',
              }}
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button"
                onClick={() => { setShowJustifModal(false); setJustifText('') }}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  border: '1px solid #E2E8F0', background: '#fff',
                  color: '#374151', fontSize: 13, cursor: 'pointer',
                }}>
                Cancelar
              </button>
              <button type="button"
                onClick={handleConfirmJustifSave}
                disabled={savingJustif || !justifText.trim()}
                style={{
                  padding: '9px 22px', borderRadius: 8, border: 'none',
                  background: savingJustif || !justifText.trim() ? '#93C5FD' : '#B05A00',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: savingJustif || !justifText.trim() ? 'default' : 'pointer',
                }}>
                {savingJustif ? 'Guardando…' : '✓ Guardar y notificar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
