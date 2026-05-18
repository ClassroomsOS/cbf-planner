/**
 * SyllabusWizard.jsx — v2 (5-phase intelligent wizard)
 *
 * Phase 1 SELECT    — Book + TOC scan + unit selection for period + deep page scan
 * Phase 2 ANALYZE   — Rich page-analysis display (grammar/vocab chips, expandable)
 * Phase 3 CLASSIFY  — AI subunit classification by difficulty (editable session counts)
 * Phase 4 STRATEGIES— Teaching strategies for dense subunits (editable inline)
 * Phase 5 DISTRIBUTE— Weekly distribution + inline resources + publish
 *
 * KEY PRINCIPLE: Only the units selected for the period (startUnit→endUnit) flow
 * through the entire pipeline. Pages outside that range are never scanned, classified,
 * or distributed. The TOC scan detects all units; the user picks which ones to study.
 */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import {
  analyzeTOCPages, deepAnalyzeBookPages, classifySubunitsAI, generateTeachingStrategiesAI,
  distributePagesByWeek, computeWorkingWeeks, advisorCheckSession,
} from '../utils/syllabusAI'
import { ACADEMIC_PERIODS } from '../utils/constants'
import useSyllabusPlan from '../hooks/useSyllabusPlan'

// ── Constants ──────────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'select',     label: '1. Libro y Unidad', icon: '📖' },
  { key: 'analyze',    label: '2. Análisis',        icon: '🔬' },
  { key: 'classify',   label: '3. Clasificación',   icon: '📊' },
  { key: 'strategies', label: '4. Estrategias',     icon: '🧠' },
  { key: 'distribute', label: '5. Distribución',    icon: '📅' },
]

const COMPLEXITY_LABELS = ['', '⚡ Muy fácil', '📗 Fácil', '📘 Normal', '📕 Compleja', '🔥 Muy densa']
const COMPLEXITY_COLORS = ['', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']
const DIFFICULTY_STYLES = {
  easy:     { bg: '#dcfce7', border: '#22c55e', label: 'Fácil',    icon: '🟢' },
  moderate: { bg: '#fef9c3', border: '#eab308', label: 'Moderada', icon: '🟡' },
  dense:    { bg: '#fee2e2', border: '#ef4444', label: 'Densa',    icon: '🔴' },
  review:   { bg: '#ede9fe', border: '#8b5cf6', label: 'Repaso',   icon: '🔄' },
}

const CONTENT_TYPE_COLORS = {
  grammar_new: '#7c3aed', grammar_practice: '#a78bfa', vocabulary: '#0891b2',
  reading: '#2563eb', listening: '#6366f1', speaking: '#8064A2',
  writing: '#16a34a', workbook: '#d97706', review: '#dc2626',
  test: '#be123c', warmup: '#84cc16', project: '#059669',
}
const CONTENT_TYPE_LABELS = {
  grammar_new: 'Grammar (new)', grammar_practice: 'Grammar (practice)',
  vocabulary: 'Vocabulary', reading: 'Reading', listening: 'Listening',
  speaking: 'Speaking', writing: 'Writing', workbook: 'Workbook',
  review: 'Review', test: 'Test', warmup: 'Warm-up', project: 'Project',
}

const DIFFICULTY_CONFIG = {
  easy:     { label: '🟢 Fácil',    bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
  moderate: { label: '🟡 Moderada', bg: '#fefce8', border: '#eab308', text: '#a16207' },
  dense:    { label: '🔴 Densa',    bg: '#fff1f2', border: '#f43f5e', text: '#be123c' },
}

const RESOURCE_TYPES = [
  { value: 'video',     label: 'Video',      icon: '🎬' },
  { value: 'reading',   label: 'Lectura',    icon: '📄' },
  { value: 'webpage',   label: 'Página web', icon: '🌐' },
  { value: 'worksheet', label: 'Taller',     icon: '📝' },
  { value: 'fragment',  label: 'Recorte',    icon: '✂️' },
  { value: 'audio',     label: 'Audio',      icon: '🎵' },
  { value: 'image',     label: 'Imagen',     icon: '🖼️' },
  { value: 'other',     label: 'Otro',       icon: '📎' },
]

const ABC_SECTIONS = [
  { value: 'subject',    label: 'Encuentro (Vocab)', color: '#C0504D' },
  { value: 'motivation', label: 'Motivación',        color: '#F79646' },
  { value: 'activity',   label: 'Tema del día',      color: '#4F81BD' },
  { value: 'skill',      label: 'Desarrollo',        color: '#8064A2' },
  { value: 'closing',    label: 'Cierre',            color: '#9BBB59' },
  { value: 'assignment', label: 'Tarea',             color: '#4BACC6' },
]

const DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri']
const DAY_LABELS = { mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie' }
const DAY_FULL   = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' }

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SyllabusWizard({ teacher, subject, grade, period }) {
  const { showToast } = useToast()
  const [step, setStep] = useState('select')
  const { plan, loading: planLoading, savePlan } = useSyllabusPlan(teacher, { subject, grade, period })

  // ── Phase 1 state ─────────────────────────────────────────────────────────
  const [libraryDocs, setLibraryDocs] = useState([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [tocPages, setTocPages] = useState('')            // comma-separated page numbers for TOC (e.g. "4,5,6,7")
  const [tocUnits, setTocUnits] = useState([])            // [{unit_number, title, start_page, end_page, skills}]
  const [scanningTOC, setScanningTOC] = useState(false)
  const [pageStart, setPageStart] = useState(1)
  const [pageEnd, setPageEnd] = useState(20)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
  const [pageAnalysis, setPageAnalysis] = useState([])   // enriched pages from deepAnalyzeBookPages
  const [unitsConfig, setUnitsConfig] = useState([])     // [{unit_number, title, start_page, end_page, subunits}]
  const [startUnit, setStartUnit] = useState(1)          // unit from which to start the period
  const [endUnit, setEndUnit] = useState(null)            // last unit to cover (inclusive); null = last detected

  // ── Phase 3 state ─────────────────────────────────────────────────────────
  const [subunitClassification, setSubunitClassification] = useState([])
  const [classifying, setClassifying] = useState(false)

  // ── Phase 4 state ─────────────────────────────────────────────────────────
  const [teachingStrategies, setTeachingStrategies] = useState([])
  const [generatingStrategies, setGeneratingStrategies] = useState(false)

  // ── Phase 5 state ─────────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState({})
  const [workingWeeks, setWorkingWeeks] = useState([])
  const [distribution, setDistribution] = useState([])
  const [distributing, setDistributing] = useState(false)
  const [resources, setResources] = useState([])
  const [advisorFeedback, setAdvisorFeedback] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [addingResource, setAddingResource] = useState(false)

  // ── Restore saved plan ────────────────────────────────────────────────────
  useEffect(() => {
    if (!plan) return
    if (plan.page_analysis?.length)         setPageAnalysis(plan.page_analysis)
    if (plan.units_config?.length)          setUnitsConfig(plan.units_config)
    if (plan.toc_units?.length)             setTocUnits(plan.toc_units)
    if (plan.page_distribution?.length)     setDistribution(plan.page_distribution)
    if (plan.page_start)                    setPageStart(plan.page_start)
    if (plan.page_end)                      setPageEnd(plan.page_end)
    if (plan.library_doc_id)                setSelectedDocId(plan.library_doc_id)
    if (plan.start_unit)                    setStartUnit(plan.start_unit)
    if (plan.end_unit)                      setEndUnit(plan.end_unit)
    if (plan.subunit_classification?.length) setSubunitClassification(plan.subunit_classification)
    if (plan.teaching_strategies?.length)   setTeachingStrategies(plan.teaching_strategies)
  }, [plan])

  // ── Load library docs ─────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('school_library')
      .select('id, title, file_url, file_mime')
      .eq('school_id', teacher.school_id)
      .in('file_mime', ['application/pdf'])
      .order('title')
      .then(({ data }) => setLibraryDocs(data || []))
  }, [teacher.school_id])

  // ── Load teacher schedule ─────────────────────────────────────────────────
  useEffect(() => {
    if (!subject || !grade) return
    // grade is combined "8.° Blue" — split into base "8.°" + section "Blue"
    const parts = grade.split(' ')
    const baseGrade = parts[0]
    const section = parts.slice(1).join(' ')
    let q = supabase.from('teacher_assignments')
      .select('schedule')
      .eq('teacher_id', teacher.id)
      .eq('subject', subject)
      .eq('grade', baseGrade)
    if (section) q = q.eq('section', section)
    q.single()
      .then(({ data }) => { if (data?.schedule) setSchedule(data.schedule) })
  }, [teacher.id, subject, grade])

  // ── Load working weeks ────────────────────────────────────────────────────
  useEffect(() => {
    if (!teacher.school_id || !period) return
    supabase.from('academic_period_config')
      .select('start_date, end_date')
      .eq('school_id', teacher.school_id)
      .eq('period', parseInt(period))
      .maybeSingle()
      .then(async ({ data: pc }) => {
        // Fallback to hardcoded ACADEMIC_PERIODS if table/row doesn't exist
        const fallback = ACADEMIC_PERIODS.find(p => parseInt(p.value) === parseInt(period))
        const resolved = pc?.start_date && pc?.end_date
          ? pc
          : fallback ? { start_date: fallback.start, end_date: fallback.end } : null
        if (!resolved) return

        const { data: cal } = await supabase.from('school_calendar')
          .select('date')
          .eq('school_id', teacher.school_id)
          .eq('is_school_day', false)
          .gte('date', resolved.start_date)
          .lte('date', resolved.end_date)
        const noClassDates = (cal || []).map(c => c.date)
        setWorkingWeeks(computeWorkingWeeks(resolved.start_date, resolved.end_date, noClassDates))
      })
  }, [teacher.school_id, period])

  // ── Load resources ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!plan?.id) return
    supabase.from('syllabus_session_resources')
      .select('*')
      .eq('plan_id', plan.id)
      .order('week_number')
      .order('sort_order')
      .then(({ data }) => setResources(data || []))
  }, [plan?.id])

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 1: SCAN PAGES (deepAnalyzeBookPages)
  // ══════════════════════════════════════════════════════════════════════════
  const selectedDoc = useMemo(() => libraryDocs.find(d => d.id === selectedDocId), [libraryDocs, selectedDocId])

  // ── TOC scan ─────────────────────────────────────────────────────────────
  async function handleScanTOC() {
    if (!selectedDoc?.file_url) { showToast('Selecciona un libro primero', 'error'); return }
    const tocNums = tocPages.split(',').map(s => parseInt(s.trim())).filter(n => n > 0)
    if (!tocNums.length) { showToast('Ingresa los números de página del índice (ej: 4,5,6,7)', 'error'); return }

    setScanningTOC(true)
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
      const pdf = await pdfjsLib.getDocument(selectedDoc.file_url).promise

      const renderedPages = []
      for (const pageNum of tocNums) {
        try {
          const page = await pdf.getPage(pageNum)
          const viewport = page.getViewport({ scale: 1.0 })
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          const scale = Math.min(1400 / viewport.width, 1400 / viewport.height, 1.8)
          canvas.width = viewport.width * scale
          canvas.height = viewport.height * scale
          await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }) }).promise
          renderedPages.push({ pageNum, base64: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] })
        } catch (e) { console.warn(`Failed to render TOC page ${pageNum}:`, e) }
      }

      if (!renderedPages.length) { showToast('No se pudieron renderizar las páginas del índice', 'error'); return }

      const { units, error } = await analyzeTOCPages(renderedPages, {
        subject, grade, bookTitle: selectedDoc.title,
      })
      if (error) { showToast(`Error TOC: ${error}`, 'error'); return }
      if (!units.length) { showToast('No se detectaron unidades en el índice', 'error'); return }

      setTocUnits(units)
      // Auto-fill page range from TOC
      const firstPage = Math.min(...units.map(u => u.start_page).filter(Boolean))
      const lastPage = Math.max(...units.map(u => u.end_page).filter(Boolean))
      if (firstPage > 0) setPageStart(firstPage)
      if (lastPage > 0) setPageEnd(lastPage)
      // Auto-set unit range
      setStartUnit(units[0].unit_number)
      setEndUnit(units[units.length - 1].unit_number)

      await savePlan({ toc_units: units })
      showToast(`✅ ${units.length} unidades detectadas en el índice`, 'success')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setScanningTOC(false)
    }
  }

  async function handleScanPages() {
    if (!selectedDoc?.file_url) { showToast('Selecciona un libro primero', 'error'); return }

    // When TOC exists, narrow page range to selected units only
    let effectiveStart = pageStart
    let effectiveEnd   = pageEnd
    if (tocUnits.length && startUnit && endUnit) {
      const selectedTOC = tocUnits.filter(u => u.unit_number >= startUnit && u.unit_number <= endUnit)
      if (selectedTOC.length) {
        effectiveStart = Math.min(...selectedTOC.map(u => u.start_page).filter(Boolean))
        effectiveEnd   = Math.max(...selectedTOC.map(u => u.end_page).filter(Boolean))
      }
    }

    if (effectiveEnd <= effectiveStart) { showToast('El rango de páginas es inválido', 'error'); return }

    setScanning(true)
    const totalPages = effectiveEnd - effectiveStart + 1
    setScanProgress({ current: 0, total: totalPages })
    const allAnalysis = []
    const BATCH_SIZE = 5

    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
      const pdf = await pdfjsLib.getDocument(selectedDoc.file_url).promise

      // Accumulated context passed between batches for continuity
      let previousBatch = null  // { lastPage, lastUnit, lastSubunit }

      for (let batchStart = effectiveStart; batchStart <= effectiveEnd; batchStart += BATCH_SIZE) {
        const batchEnd  = Math.min(batchStart + BATCH_SIZE - 1, effectiveEnd)
        const batchPages = []

        for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
          try {
            const page     = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale: 1.0 })
            const canvas   = document.createElement('canvas')
            const ctx      = canvas.getContext('2d')
            const scale    = Math.min(1200 / viewport.width, 1200 / viewport.height, 1.5)
            canvas.width   = viewport.width  * scale
            canvas.height  = viewport.height * scale
            await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }) }).promise
            batchPages.push({ pageNum, base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1] })
          } catch (e) { console.warn(`Failed to render page ${pageNum}:`, e) }
        }

        if (batchPages.length) {
          // Build known unit boundaries from what we've detected so far
          const knownUnits = allAnalysis.length ? detectUnitsFromAnalysis(allAnalysis) : []

          // Only pass the selected units to AI — it shouldn't see units outside the period
          const selectedTocUnits = tocUnits.filter(u => u.unit_number >= startUnit && u.unit_number <= endUnit)
          const { analysis, error } = await deepAnalyzeBookPages(batchPages, {
            subject, grade, bookTitle: selectedDoc.title,
            tocUnits: selectedTocUnits,
            previousBatch,
            knownUnits,
          })
          if (error) console.warn('Batch analysis error:', error)
          if (analysis?.length) {
            allAnalysis.push(...analysis)
            // Update context for next batch: use last page's detected info
            const last = analysis[analysis.length - 1]
            if (last) {
              previousBatch = {
                lastPage: last.page,
                lastUnit: last.unit_number || previousBatch?.lastUnit,
                lastSubunit: last.subunit || null,
              }
            }
          }
        }

        setScanProgress({ current: Math.min(batchEnd - pageStart + 1, totalPages), total: totalPages })
      }

      setPageAnalysis(allAnalysis)
      const units = detectUnitsFromAnalysis(allAnalysis)
      setUnitsConfig(units)
      // Default start_unit to first detected unit, end_unit to last detected
      if (units.length && startUnit === 1) setStartUnit(units[0].unit_number)
      if (units.length && !endUnit) setEndUnit(units[units.length - 1].unit_number)

      await savePlan({
        library_doc_id: selectedDocId,
        page_start: pageStart,
        page_end: pageEnd,
        page_analysis: allAnalysis,
        units_config: units,
      })

      showToast(`✅ ${allAnalysis.length} páginas analizadas`, 'success')
    } catch (err) {
      showToast(`Error al escanear: ${err.message}`, 'error')
    } finally {
      setScanning(false)
    }
  }

  function detectUnitsFromAnalysis(analysis) {
    const sorted = [...analysis].sort((a, b) => a.page - b.page)

    // ── PRIMARY: If TOC data exists, use it for deterministic unit assignment ─
    // TOC is the authoritative source — no guessing needed.
    if (tocUnits.length) {
      const unitsMap = {}
      // Only include units in the selected period range
      const selectedTOC = tocUnits.filter(u => u.unit_number >= startUnit && u.unit_number <= endUnit)
      for (const tu of selectedTOC) {
        unitsMap[tu.unit_number] = {
          unit_number: tu.unit_number,
          title: tu.title || `Unit ${tu.unit_number}`,
          start_page: tu.start_page,
          end_page: tu.end_page || tu.start_page,
          skills: tu.skills || {},
          subunits: [],
        }
      }

      // Assign each scanned page to its TOC unit by page range
      for (const page of sorted) {
        const tocUnit = selectedTOC.find((u, i) => {
          const start = u.start_page
          const end = u.end_page || (selectedTOC[i + 1]?.start_page ? selectedTOC[i + 1].start_page - 1 : Infinity)
          return page.page >= start && page.page <= end
        })
        if (!tocUnit) continue
        const unitNum = tocUnit.unit_number
        const unit = unitsMap[unitNum]

        // Override the AI's unit_number with the TOC's (authoritative)
        page.unit_number = unitNum

        // Aggregate subunits
        const subunit = page.subunit || ''
        if (subunit && !unit.subunits.find(s => s.label === subunit)) {
          unit.subunits.push({ label: subunit, pages: [page.page] })
        } else if (subunit) {
          unit.subunits.find(s => s.label === subunit)?.pages.push(page.page)
        }
      }

      return Object.values(unitsMap).sort((a, b) => a.unit_number - b.unit_number)
    }

    // ── FALLBACK: No TOC — use anchor-based detection with monotonic validation
    const anchors = []
    for (const p of sorted) {
      let unitNum = p.unit_number || null
      if (!unitNum && p.subunit) {
        const match = p.subunit.match(/^(\d+)/)
        unitNum = match ? parseInt(match[1]) : null
      }
      if (unitNum) anchors.push({ page: p.page, unitNum })
    }

    // Validate monotonicity
    const validAnchors = []
    for (const a of anchors) {
      const prev = validAnchors.length ? validAnchors[validAnchors.length - 1] : null
      if (!prev) { validAnchors.push(a); continue }
      if (a.unitNum < prev.unitNum) continue
      if (a.unitNum > prev.unitNum + 1) {
        const pageGap = a.page - prev.page
        const unitJump = a.unitNum - prev.unitNum
        if (pageGap < unitJump * 5) continue
      }
      validAnchors.push(a)
    }

    // Interpolate
    const pageUnitMap = {}
    for (const p of sorted) {
      let assigned = null
      for (let j = validAnchors.length - 1; j >= 0; j--) {
        if (validAnchors[j].page <= p.page) { assigned = validAnchors[j].unitNum; break }
      }
      if (assigned === null && validAnchors.length) assigned = validAnchors[0].unitNum
      if (assigned !== null) pageUnitMap[p.page] = assigned
    }

    // Build unit config
    const unitsMap = {}
    for (const page of sorted) {
      const unitNum = pageUnitMap[page.page]
      if (!unitNum) continue
      if (!unitsMap[unitNum]) {
        unitsMap[unitNum] = { unit_number: unitNum, title: `Unit ${unitNum}`, start_page: page.page, end_page: page.page, subunits: [] }
      }
      const unit = unitsMap[unitNum]
      if (page.page < unit.start_page) unit.start_page = page.page
      if (page.page > unit.end_page)   unit.end_page = page.page
      const subunit = page.subunit || ''
      if (subunit && !unit.subunits.find(s => s.label === subunit)) {
        unit.subunits.push({ label: subunit, pages: [page.page] })
      } else if (subunit) {
        unit.subunits.find(s => s.label === subunit)?.pages.push(page.page)
      }
    }

    return Object.values(unitsMap).sort((a, b) => a.unit_number - b.unit_number)
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 3: CLASSIFY SUBUNITS
  // ══════════════════════════════════════════════════════════════════════════
  // Helper: filter page analysis and units to the selected period range
  function getSelectedPageAnalysis() {
    return pageAnalysis.filter(p => p.unit_number >= startUnit && p.unit_number <= endUnit)
  }
  function getSelectedUnitsConfig() {
    return unitsConfig.filter(u => u.unit_number >= startUnit && u.unit_number <= endUnit)
  }

  async function handleClassify() {
    const selectedPages = getSelectedPageAnalysis()
    const selectedUnits = getSelectedUnitsConfig()
    if (!selectedPages.length) { showToast('No hay páginas en las unidades seleccionadas', 'error'); return }
    setClassifying(true)
    try {
      const { classification, error } = await classifySubunitsAI({
        page_analysis: selectedPages,
        units_config: selectedUnits,
        subject,
        grade,
      })
      if (error) { showToast(error, 'error'); return }
      const result = classification || []
      setSubunitClassification(result)
      await savePlan({ subunit_classification: result })
      showToast('✅ Clasificación completada', 'success')
    } catch (err) {
      showToast(`Error al clasificar: ${err.message}`, 'error')
    } finally {
      setClassifying(false)
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 4: GENERATE TEACHING STRATEGIES
  // ══════════════════════════════════════════════════════════════════════════
  async function handleGenerateStrategies() {
    const denseUnits = subunitClassification.filter(s => s.difficulty === 'dense')
    if (!denseUnits.length) {
      showToast('No hay subunidades densas — estrategias no necesarias', 'info')
      return
    }
    setGeneratingStrategies(true)
    try {
      const { strategies, error } = await generateTeachingStrategiesAI({
        subunit_classification: subunitClassification,
        page_analysis: getSelectedPageAnalysis(),
        subject,
        grade,
      })
      if (error) { showToast(error, 'error'); return }
      const result = strategies || []
      setTeachingStrategies(result)
      await savePlan({ teaching_strategies: result })
      showToast('✅ Estrategias generadas', 'success')
    } catch (err) {
      showToast(`Error al generar estrategias: ${err.message}`, 'error')
    } finally {
      setGeneratingStrategies(false)
    }
  }

  async function handleSaveStrategies(updated) {
    setTeachingStrategies(updated)
    await savePlan({ teaching_strategies: updated })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 5: DISTRIBUTE PAGES
  // ══════════════════════════════════════════════════════════════════════════
  async function handleDistribute() {
    if (!pageAnalysis.length) { showToast('Primero escanea las páginas', 'error'); return }
    if (!workingWeeks.length) { showToast('No hay semanas hábiles configuradas', 'error'); return }
    const hasClassDays = DAY_KEYS.some(dk => (schedule[dk] || []).length > 0)
    if (!hasClassDays) { showToast('No se encontró el horario de clase. Verifica tus asignaciones.', 'error'); return }
    setDistributing(true)
    try {
      // Filter working weeks: only include weeks from today forward
      const todayISO = new Date().toISOString().split('T')[0]
      const remainingWeeks = workingWeeks
        .filter(w => w.days.some(d => d >= todayISO))
        .map((w, i) => ({ ...w, week: i + 1 }))  // renumber from 1

      if (!remainingWeeks.length) { showToast('No quedan semanas hábiles a partir de hoy', 'error'); setDistributing(false); return }

      const { distribution: dist, error } = await distributePagesByWeek({
        page_analysis: getSelectedPageAnalysis(),
        working_weeks: remainingWeeks,
        schedule,
        minutes_per_period: 50,
        subject,
        grade,
        units_config: getSelectedUnitsConfig(),
        subunit_classification: subunitClassification,
        teaching_strategies: teachingStrategies,
        start_unit: startUnit,
        end_unit: endUnit,
      })
      if (error) { showToast(error, 'error'); return }
      setDistribution(dist)
      await savePlan({ page_distribution: dist })
      showToast('✅ Distribución generada', 'success')
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error')
    } finally {
      setDistributing(false)
    }
  }

  async function handlePublish() {
    if (!distribution.length) { showToast('No hay distribución para publicar', 'error'); return }
    await savePlan({ status: 'active', page_distribution: distribution, start_unit: startUnit, end_unit: endUnit })
    showToast('✅ Syllabus publicado — se usará en la generación de guías', 'success')
  }

  // ── Resources helpers ─────────────────────────────────────────────────────
  function getResourcesForDay(week, dayKey) {
    return resources.filter(r => r.week_number === week && r.day_key === dayKey)
  }

  async function addResource(resource) {
    if (!plan?.id || !selectedDay) return
    const row = {
      plan_id: plan.id,
      school_id: teacher.school_id,
      teacher_id: teacher.id,
      week_number: selectedDay.week,
      day_key: selectedDay.dayKey,
      ...resource,
      sort_order: getResourcesForDay(selectedDay.week, selectedDay.dayKey).length,
    }
    const { data, error } = await supabase.from('syllabus_session_resources')
      .insert(row).select().single()
    if (error) { showToast('Error al guardar recurso', 'error'); return }
    setResources(prev => [...prev, data])
    setAddingResource(false)
  }

  async function removeResource(id) {
    await supabase.from('syllabus_session_resources').delete().eq('id', id)
    setResources(prev => prev.filter(r => r.id !== id))
  }

  async function handleAdvisorCheck(week, dayKey) {
    const dayResources = getResourcesForDay(week, dayKey)
    const dayDist      = distribution.find(w => w.week === week)?.days?.[dayKey]
    const dayPages     = (dayDist?.pages || []).map(pNum => pageAnalysis.find(p => p.page === pNum)).filter(Boolean)
    const available    = (schedule[dayKey] || []).length * 50
    setAdvisorFeedback({ loading: true, week, dayKey })
    const result = await advisorCheckSession({
      resources: dayResources, pages: dayPages, available_minutes: available,
      subject, day_label: `${DAY_FULL[dayKey]} Semana ${week}`,
    })
    setAdvisorFeedback({ ...result, week, dayKey, loading: false })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  const currentStepIdx = STEPS.findIndex(s => s.key === step)

  return (
    <div className="sw-container">
      <div className="sw-steps-bar">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            className={`sw-step-pill ${step === s.key ? 'sw-step-active' : ''} ${i < currentStepIdx ? 'sw-step-done' : ''}`}
            onClick={() => setStep(s.key)}
          >
            <span className="sw-step-icon">{s.icon}</span>
            <span className="sw-step-label">{s.label}</span>
          </button>
        ))}
      </div>

      <div className="sw-body">
        {step === 'select' && (
          <StepSelect
            libraryDocs={libraryDocs}
            selectedDocId={selectedDocId} setSelectedDocId={setSelectedDocId}
            tocPages={tocPages} setTocPages={setTocPages}
            tocUnits={tocUnits} scanningTOC={scanningTOC}
            onScanTOC={handleScanTOC}
            pageStart={pageStart} setPageStart={setPageStart}
            pageEnd={pageEnd} setPageEnd={setPageEnd}
            scanning={scanning} scanProgress={scanProgress}
            pageAnalysis={pageAnalysis}
            unitsConfig={unitsConfig}
            startUnit={startUnit} setStartUnit={setStartUnit}
            endUnit={endUnit} setEndUnit={setEndUnit}
            onScan={handleScanPages}
            onNext={async () => {
              await savePlan({ start_unit: startUnit, end_unit: endUnit })
              setStep('analyze')
            }}
          />
        )}

        {step === 'analyze' && (
          <StepAnalyze
            pageAnalysis={pageAnalysis}
            unitsConfig={unitsConfig}
            startUnit={startUnit}
            endUnit={endUnit}
            onNext={() => setStep('classify')}
            onBack={() => setStep('select')}
          />
        )}

        {step === 'classify' && (
          <StepClassify
            subunitClassification={subunitClassification}
            classifying={classifying}
            pageAnalysis={getSelectedPageAnalysis()}
            workingWeeks={workingWeeks}
            schedule={schedule}
            onClassify={handleClassify}
            onSaveEdits={async (edited) => {
              setSubunitClassification(edited)
              await savePlan({ subunit_classification: edited })
            }}
            onNext={() => setStep('strategies')}
            onBack={() => setStep('analyze')}
          />
        )}

        {step === 'strategies' && (
          <StepStrategies
            subunitClassification={subunitClassification}
            teachingStrategies={teachingStrategies}
            generatingStrategies={generatingStrategies}
            onGenerate={handleGenerateStrategies}
            onSave={handleSaveStrategies}
            onNext={() => setStep('distribute')}
            onBack={() => setStep('classify')}
          />
        )}

        {step === 'distribute' && (
          <StepDistribute
            pageAnalysis={getSelectedPageAnalysis()}
            distribution={distribution}
            workingWeeks={workingWeeks}
            schedule={schedule}
            distributing={distributing}
            unitsConfig={getSelectedUnitsConfig()}
            subunitClassification={subunitClassification}
            teachingStrategies={teachingStrategies}
            resources={resources}
            selectedDay={selectedDay} setSelectedDay={setSelectedDay}
            addingResource={addingResource} setAddingResource={setAddingResource}
            advisorFeedback={advisorFeedback}
            onDistribute={handleDistribute}
            onAddResource={addResource}
            onRemoveResource={removeResource}
            onAdvisorCheck={handleAdvisorCheck}
            getResourcesForDay={getResourcesForDay}
            onPublish={handlePublish}
            onBack={() => setStep('strategies')}
          />
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1: SELECT BOOK + SCAN
// ══════════════════════════════════════════════════════════════════════════════
function StepSelect({
  libraryDocs, selectedDocId, setSelectedDocId,
  tocPages, setTocPages, tocUnits, scanningTOC, onScanTOC,
  pageStart, setPageStart, pageEnd, setPageEnd,
  scanning, scanProgress, pageAnalysis, unitsConfig,
  startUnit, setStartUnit, endUnit, setEndUnit,
  onScan, onNext,
}) {
  return (
    <div className="sw-step-content">
      <h3 className="sw-step-title">📖 Libro y Unidad inicial</h3>
      <p className="sw-step-desc">Selecciona el libro PDF, escanea primero el índice para detectar las unidades, luego escanea las páginas de contenido.</p>

      <div className="sw-field-group">
        <label className="sw-label">Libro (PDF de la Biblioteca)</label>
        <select className="sw-select" value={selectedDocId} onChange={e => setSelectedDocId(e.target.value)}>
          <option value="">— Seleccionar libro —</option>
          {libraryDocs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </div>

      {/* ── STEP A: Scan Table of Contents ──────────────────────────── */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 8, fontSize: 14 }}>
          Paso 1: Escanear Tabla de Contenidos
        </div>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
          Ingresa las páginas del índice del libro (ej: las páginas iv, v, vi, vii del PDF).
          El sistema leerá la estructura de unidades, páginas y habilidades.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div className="sw-field-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="sw-label">Páginas del índice (números del PDF)</label>
            <input
              type="text" className="sw-input" placeholder="Ej: 4, 5, 6, 7"
              value={tocPages} onChange={e => setTocPages(e.target.value)}
            />
          </div>
          <button
            className="sw-btn sw-btn-primary"
            style={{ whiteSpace: 'nowrap' }}
            onClick={onScanTOC}
            disabled={scanningTOC || !selectedDocId || !tocPages.trim()}
          >
            {scanningTOC ? 'Leyendo índice...' : '📋 Leer Índice'}
          </button>
        </div>

        {tocUnits.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#059669', marginBottom: 6 }}>
              ✅ {tocUnits.length} unidades detectadas en el libro
            </div>
          </div>
        )}
      </div>

      {/* ── STEP B: Select units for this period ───────────────────── */}
      {tocUnits.length > 0 && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8, fontSize: 14 }}>
            Paso 2: Seleccionar Unidades del Período
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>
            Solo las unidades seleccionadas se escanearán, analizarán, clasificarán y distribuirán.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>Desde</div>
              <select
                value={startUnit}
                onChange={e => {
                  const val = +e.target.value
                  setStartUnit(val)
                  if (endUnit && val > endUnit) setEndUnit(val)
                }}
                style={{ padding: '8px 12px', borderRadius: 8, border: '2px solid #2563eb', background: '#eff6ff', fontWeight: 700, fontSize: 14, color: '#1d4ed8', cursor: 'pointer' }}
              >
                {tocUnits.map(u => (
                  <option key={u.unit_number} value={u.unit_number}>Unit {u.unit_number}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 18, color: '#9ca3af', paddingTop: 18 }}>→</div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 600 }}>Hasta</div>
              <select
                value={endUnit || tocUnits[tocUnits.length - 1]?.unit_number || ''}
                onChange={e => setEndUnit(+e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '2px solid #16a34a', background: '#f0fdf4', fontWeight: 700, fontSize: 14, color: '#15803d', cursor: 'pointer' }}
              >
                {tocUnits.filter(u => u.unit_number >= startUnit).map(u => (
                  <option key={u.unit_number} value={u.unit_number}>Unit {u.unit_number}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tocUnits.map(u => {
              const effectiveEnd = endUnit || tocUnits[tocUnits.length - 1]?.unit_number
              const isInRange = u.unit_number >= startUnit && u.unit_number <= effectiveEnd
              return (
                <div key={u.unit_number} style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.3,
                  background: isInRange ? '#eff6ff' : '#f9fafb',
                  border: `1.5px solid ${isInRange ? '#2563eb' : '#e5e7eb'}`,
                  color: isInRange ? '#1d4ed8' : '#9ca3af',
                  opacity: isInRange ? 1 : 0.5,
                }}>
                  <strong>{isInRange ? '▶ ' : ''}Unit {u.unit_number}</strong> — pp. {u.start_page}–{u.end_page || '?'}
                  <div style={{ color: isInRange ? '#6b7280' : '#d1d5db', fontSize: 10 }}>{u.title}</div>
                </div>
              )
            })}
          </div>
          {(() => {
            const selected = tocUnits.filter(u => u.unit_number >= startUnit && u.unit_number <= (endUnit || tocUnits[tocUnits.length - 1]?.unit_number))
            const pStart = Math.min(...selected.map(u => u.start_page).filter(Boolean))
            const pEnd   = Math.max(...selected.map(u => u.end_page).filter(Boolean))
            return (
              <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
                Escanear <strong>Unit {startUnit} → Unit {endUnit || tocUnits[tocUnits.length - 1]?.unit_number}</strong> — páginas {pStart}–{pEnd} ({pEnd - pStart + 1} páginas)
              </div>
            )
          })()}
        </div>
      )}

      {/* ── STEP C: Scan Content Pages ──────────────────────────────── */}
      <div style={{ background: tocUnits.length ? '#fff' : '#fef3c7', border: `1px solid ${tocUnits.length ? '#e5e7eb' : '#fcd34d'}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, color: '#374151', marginBottom: 8, fontSize: 14 }}>
          {tocUnits.length ? 'Paso 3' : 'Paso 2'}: Escanear Páginas de Contenido
        </div>
        {!tocUnits.length && (
          <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 10px', fontWeight: 500 }}>
            Recomendado: escanea primero el índice (Paso 1) para que las unidades se asignen correctamente.
          </p>
        )}
        {!tocUnits.length && (
          <div className="sw-range-row">
            <div className="sw-field-group">
              <label className="sw-label">Desde página</label>
              <input type="number" className="sw-input" min={1} value={pageStart} onChange={e => setPageStart(+e.target.value)} />
            </div>
            <div className="sw-range-arrow">→</div>
            <div className="sw-field-group">
              <label className="sw-label">Hasta página</label>
              <input type="number" className="sw-input" min={pageStart + 1} value={pageEnd} onChange={e => setPageEnd(+e.target.value)} />
            </div>
            <div className="sw-range-total">{pageEnd - pageStart + 1} páginas</div>
          </div>
        )}
        {tocUnits.length > 0 && (
          <p style={{ fontSize: 12, color: '#059669', margin: '0 0 10px' }}>
            Se escanearán solo las páginas de las unidades seleccionadas ({startUnit}–{endUnit || tocUnits[tocUnits.length - 1]?.unit_number}).
          </p>
        )}

        <button className="sw-btn sw-btn-primary" onClick={onScan} disabled={scanning || !selectedDocId}>
          {scanning
            ? `🔍 Escaneando... ${scanProgress.current}/${scanProgress.total}`
            : '🔍 Escanear páginas con IA'}
        </button>
      </div>

      {scanning && (
        <div className="sw-progress-bar">
          <div className="sw-progress-fill" style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }} />
        </div>
      )}

      {pageAnalysis.length > 0 && (
        <div className="sw-analysis-section">
          <h4 className="sw-section-title">
            ✅ {pageAnalysis.length} páginas analizadas
            {unitsConfig.length > 0 && ` — Unit ${unitsConfig[0]?.unit_number}–${unitsConfig[unitsConfig.length - 1]?.unit_number}`}
          </h4>

          {/* Page grid preview */}
          <div className="sw-page-grid">
            {pageAnalysis.map(p => (
              <div key={p.page} className="sw-page-card" style={{ borderTopColor: CONTENT_TYPE_COLORS[p.content_type] || '#888' }}>
                <div className="sw-page-num">p. {p.page}</div>
                <div className="sw-page-type" style={{ color: CONTENT_TYPE_COLORS[p.content_type] }}>
                  {CONTENT_TYPE_LABELS[p.content_type] || p.content_type}
                </div>
                <div className="sw-page-complexity">
                  <span style={{ color: COMPLEXITY_COLORS[p.complexity] }}>
                    {COMPLEXITY_LABELS[p.complexity]}
                  </span>
                </div>
                <div className="sw-page-time">~{p.estimated_minutes} min</div>
                {p.subunit && <div className="sw-page-subunit">{p.subunit}</div>}
              </div>
            ))}
          </div>

          <button className="sw-btn sw-btn-primary sw-btn-next" onClick={onNext}>
            Continuar al análisis detallado →
          </button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2: RICH ANALYSIS DISPLAY
// ══════════════════════════════════════════════════════════════════════════════
function StepAnalyze({ pageAnalysis, unitsConfig, startUnit, endUnit, onNext, onBack }) {
  const [expandedPage, setExpandedPage] = useState(null)

  // Filter pages to selected unit range [startUnit, endUnit]
  const startUnitData = unitsConfig.find(u => u.unit_number === startUnit)
  const endUnitData   = endUnit ? unitsConfig.find(u => u.unit_number === endUnit) : null
  const filteredPages = pageAnalysis.filter(p => {
    if (startUnitData && p.page < startUnitData.start_page) return false
    if (endUnitData   && p.page > endUnitData.end_page)     return false
    return true
  })

  return (
    <div className="sw-step-content">
      <div className="sw-step-header-row">
        <button className="sw-btn sw-btn-ghost" onClick={onBack}>← Volver</button>
        <h3 className="sw-step-title">🔬 Análisis Profundo</h3>
      </div>
      <p className="sw-step-desc">
        Revisión detallada de {filteredPages.length} páginas — Units {startUnit}{endUnit ? `–${endUnit}` : '+'}.
        Toca una tarjeta para ver el detalle completo.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filteredPages.map(p => {
          const isExpanded = expandedPage === p.page
          const dc = DIFFICULTY_CONFIG[p.complexity >= 4 ? 'dense' : p.complexity >= 3 ? 'moderate' : 'easy']
          return (
            <div
              key={p.page}
              style={{
                border: `1px solid ${CONTENT_TYPE_COLORS[p.content_type] || '#e5e7eb'}`,
                borderLeft: `4px solid ${CONTENT_TYPE_COLORS[p.content_type] || '#888'}`,
                borderRadius: 10, background: '#fff', overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedPage(isExpanded ? null : p.page)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px' }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: 13,
                    background: CONTENT_TYPE_COLORS[p.content_type] || '#888', color: '#fff',
                  }}>
                    {p.page}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: CONTENT_TYPE_COLORS[p.content_type] || '#555' }}>
                      {CONTENT_TYPE_LABELS[p.content_type] || p.content_type}
                    </span>
                    {p.subunit && (
                      <span style={{ fontSize: 11, background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', color: '#374151' }}>
                        {p.subunit}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: COMPLEXITY_COLORS[p.complexity] }}>
                      {COMPLEXITY_LABELS[p.complexity]}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>
                      ~{p.estimated_minutes} min
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 6 }}>{p.summary}</div>

                  {/* Grammar chips */}
                  {p.grammar_points?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                      {p.grammar_points.map((g, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20,
                          background: '#ede9fe', color: '#7c3aed', fontWeight: 500,
                        }}>Grammar: {g}</span>
                      ))}
                    </div>
                  )}

                  {/* Vocabulary chips */}
                  {p.vocabulary_topics?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {p.vocabulary_topics.map((v, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20,
                          background: '#e0f2fe', color: '#0369a1', fontWeight: 500,
                        }}>Vocab: {v}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 18, color: '#9ca3af', flexShrink: 0 }}>
                  {isExpanded ? '▲' : '▼'}
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 14px 14px', borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                  {/* Exercise types */}
                  {p.exercise_types?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>TIPOS DE EJERCICIOS</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {p.exercise_types.map((e, i) => (
                          <span key={i} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 20,
                            background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
                          }}>{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {p.prerequisite_knowledge && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>CONOCIMIENTO PREVIO REQUERIDO</div>
                      <div style={{ fontSize: 13, color: '#374151', background: '#fefce8', padding: '6px 10px', borderRadius: 6 }}>
                        {p.prerequisite_knowledge}
                      </div>
                    </div>
                  )}
                  {p.teaching_challenges && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>DESAFÍOS PEDAGÓGICOS</div>
                      <div style={{ fontSize: 13, color: '#374151', background: '#fff1f2', padding: '6px 10px', borderRadius: 6 }}>
                        ⚠️ {p.teaching_challenges}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button className="sw-btn sw-btn-primary sw-btn-next" style={{ marginTop: 20 }} onClick={onNext}>
        Continuar a clasificación →
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3: SUBUNIT CLASSIFICATION
// ══════════════════════════════════════════════════════════════════════════════
function StepClassify({
  subunitClassification, classifying, pageAnalysis, workingWeeks, schedule,
  onClassify, onSaveEdits, onNext, onBack,
}) {
  const [localClassification, setLocalClassification] = useState(subunitClassification)
  const [expandedSubunit, setExpandedSubunit] = useState(null)

  useEffect(() => { setLocalClassification(subunitClassification) }, [subunitClassification])

  // Auto-trigger on mount if no classification yet
  useEffect(() => {
    if (!subunitClassification.length && !classifying && pageAnalysis.length) {
      onClassify()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function updateSessions(subunit, delta) {
    setLocalClassification(prev => prev.map(s =>
      s.subunit === subunit
        ? { ...s, estimated_sessions: Math.max(1, (s.estimated_sessions || 1) + delta) }
        : s
    ))
  }

  const totalNeeded    = localClassification.reduce((s, c) => s + (c.estimated_sessions || 1), 0)
  const totalAvailable = workingWeeks.reduce((sum, w) => {
    return sum + DAY_KEYS.filter(dk => (schedule[dk] || []).length > 0).length
  }, 0)

  // Group by unit
  const grouped = localClassification.reduce((acc, s) => {
    const key = s.unit_number || 0
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  return (
    <div className="sw-step-content">
      <div className="sw-step-header-row">
        <button className="sw-btn sw-btn-ghost" onClick={onBack}>← Volver</button>
        <h3 className="sw-step-title">📊 Clasificación de Subunidades</h3>
      </div>

      {classifying && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="cbf-spin-inline" style={{ marginRight: 10 }} />
          <span style={{ color: '#6b7280' }}>Clasificando subunidades con IA...</span>
        </div>
      )}

      {!classifying && !localClassification.length && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#6b7280', marginBottom: 16 }}>
            La IA analizará cada subunidad y la clasificará por dificultad.
          </p>
          <button className="sw-btn sw-btn-primary" onClick={onClassify} disabled={!pageAnalysis.length}>
            📊 Clasificar subunidades con IA
          </button>
        </div>
      )}

      {!classifying && localClassification.length > 0 && (
        <>
          {/* Summary bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
            background: totalNeeded <= totalAvailable ? '#f0fdf4' : '#fff1f2',
            borderRadius: 10, marginBottom: 20, border: '1px solid',
            borderColor: totalNeeded <= totalAvailable ? '#bbf7d0' : '#fecdd3',
          }}>
            <span style={{ fontSize: 20 }}>{totalNeeded <= totalAvailable ? '✅' : '⚠️'}</span>
            <div>
              <strong>{totalNeeded}</strong> sesiones necesarias /
              <strong> {totalAvailable}</strong> disponibles en el período
              {totalNeeded > totalAvailable && (
                <div style={{ fontSize: 12, color: '#be123c' }}>
                  Hay {totalNeeded - totalAvailable} sesiones en exceso — ajusta los contadores.
                </div>
              )}
            </div>
            <button
              className="sw-btn sw-btn-outline"
              style={{ marginLeft: 'auto', fontSize: 12 }}
              onClick={onClassify}
            >
              🔄 Re-clasificar
            </button>
          </div>

          {/* Cards grouped by unit */}
          {Object.entries(grouped).map(([unitNum, subunits]) => (
            <div key={unitNum} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1f2937', marginBottom: 10 }}>
                Unit {unitNum}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {subunits.map(s => {
                  const dc          = DIFFICULTY_CONFIG[s.difficulty] || DIFFICULTY_CONFIG.moderate
                  const isExpanded  = expandedSubunit === s.subunit
                  return (
                    <div key={s.subunit} style={{
                      border: `1px solid ${dc.border}`, borderRadius: 10,
                      background: dc.bg, overflow: 'hidden',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
                        {/* Difficulty badge */}
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: dc.text,
                          background: '#fff', border: `1px solid ${dc.border}`,
                          padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap',
                        }}>
                          {dc.label}
                        </span>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>
                            {s.subunit}
                          </div>
                          <div style={{ fontSize: 12, color: '#6b7280' }}>{s.session_type}</div>
                          {/* Chips */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {s.grammar_points?.map((g, i) => (
                              <span key={i} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#ede9fe', color: '#7c3aed' }}>{g}</span>
                            ))}
                            {s.vocabulary_topics?.map((v, i) => (
                              <span key={i} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 20, background: '#e0f2fe', color: '#0369a1' }}>{v}</span>
                            ))}
                          </div>
                        </div>

                        {/* Session counter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button
                            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}
                            onClick={() => updateSessions(s.subunit, -1)}
                          >−</button>
                          <span style={{ fontWeight: 700, fontSize: 15, minWidth: 24, textAlign: 'center' }}>
                            {s.estimated_sessions || 1}
                          </span>
                          <button
                            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 16 }}
                            onClick={() => updateSessions(s.subunit, 1)}
                          >+</button>
                          <span style={{ fontSize: 11, color: '#6b7280' }}>ses.</span>
                        </div>

                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}
                          onClick={() => setExpandedSubunit(isExpanded ? null : s.subunit)}
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </div>

                      {isExpanded && s.ai_rationale && (
                        <div style={{ padding: '8px 14px 12px', borderTop: `1px solid ${dc.border}` }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>¿POR QUÉ?</div>
                          <div style={{ fontSize: 13, color: '#374151', fontStyle: 'italic' }}>
                            💡 {s.ai_rationale}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <button
              className="sw-btn sw-btn-outline"
              onClick={() => onSaveEdits(localClassification)}
            >
              💾 Guardar ajustes
            </button>
            <button
              className="sw-btn sw-btn-primary sw-btn-next"
              onClick={async () => { await onSaveEdits(localClassification); onNext() }}
            >
              Continuar a estrategias →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4: TEACHING STRATEGIES
// ══════════════════════════════════════════════════════════════════════════════
function StepStrategies({
  subunitClassification, teachingStrategies, generatingStrategies,
  onGenerate, onSave, onNext, onBack,
}) {
  const [localStrategies, setLocalStrategies] = useState(teachingStrategies)

  useEffect(() => { setLocalStrategies(teachingStrategies) }, [teachingStrategies])

  // Auto-trigger on mount if no strategies yet and there are dense subunits
  useEffect(() => {
    const hasDense = subunitClassification.some(s => s.difficulty === 'dense')
    if (!teachingStrategies.length && !generatingStrategies && hasDense) {
      onGenerate()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const denseSubunits = subunitClassification.filter(s => s.difficulty === 'dense')

  function updateStrategyField(subunit, field, value) {
    setLocalStrategies(prev => prev.map(s =>
      s.subunit === subunit
        ? { ...s, strategies: { ...s.strategies, [field]: value } }
        : s
    ))
  }

  return (
    <div className="sw-step-content">
      <div className="sw-step-header-row">
        <button className="sw-btn sw-btn-ghost" onClick={onBack}>← Volver</button>
        <h3 className="sw-step-title">🧠 Estrategias de Enseñanza</h3>
      </div>
      <p className="sw-step-desc">
        Estrategias pedagógicas para el contenido de mayor dificultad. Edita según tu criterio antes de continuar.
      </p>

      {!denseSubunits.length && (
        <div style={{ padding: 24, background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', marginBottom: 20 }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 600, color: '#15803d' }}>Sin contenido denso</div>
          <div style={{ fontSize: 13, color: '#374151' }}>
            Todas las subunidades son fáciles o moderadas. No se requieren estrategias especiales.
          </div>
        </div>
      )}

      {generatingStrategies && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div className="cbf-spin-inline" style={{ marginRight: 10 }} />
          <span style={{ color: '#6b7280' }}>Generando estrategias pedagógicas...</span>
        </div>
      )}

      {!generatingStrategies && denseSubunits.length > 0 && (
        <>
          {!localStrategies.length && (
            <div style={{ marginBottom: 20 }}>
              <button className="sw-btn sw-btn-primary" onClick={onGenerate}>
                🧠 Generar estrategias con IA
              </button>
            </div>
          )}

          {/* Show all subunits — dense have full strategy cards, others show collapsed */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {subunitClassification.map(s => {
              const dc      = DIFFICULTY_CONFIG[s.difficulty] || DIFFICULTY_CONFIG.moderate
              const strategy = localStrategies.find(st => st.subunit === s.subunit)
              const isDense  = s.difficulty === 'dense'

              if (!isDense) {
                return (
                  <div key={s.subunit} style={{
                    padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb',
                    background: '#f9fafb', color: '#9ca3af', fontSize: 13,
                  }}>
                    <span style={{ fontWeight: 600 }}>{s.subunit}</span>
                    {'  '}{dc.label} — Sin estrategia especial requerida
                  </div>
                )
              }

              return (
                <div key={s.subunit} style={{
                  border: '2px solid #fecdd3', borderRadius: 12,
                  background: '#fff', overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '12px 16px', background: '#fff1f2',
                    borderBottom: '1px solid #fecdd3',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 18 }}>🔴</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#be123c' }}>{s.subunit} — Contenido denso</div>
                      {strategy?.content_focus && (
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{strategy.content_focus}</div>
                      )}
                    </div>
                  </div>

                  {strategy ? (
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Introduction */}
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                          INTRODUCCIÓN SUGERIDA
                        </label>
                        <textarea
                          value={strategy.strategies?.introduction || ''}
                          onChange={e => updateStrategyField(s.subunit, 'introduction', e.target.value)}
                          rows={3}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
                        />
                      </div>

                      {/* Scaffolding */}
                      {strategy.strategies?.scaffolding?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>ANDAMIAJE (SCAFFOLDING)</div>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {strategy.strategies.scaffolding.map((item, i) => (
                              <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>
                                ✔ {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Common mistakes */}
                      {strategy.strategies?.common_mistakes?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>ERRORES COMUNES</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {strategy.strategies.common_mistakes.map((m, i) => (
                              <span key={i} style={{
                                fontSize: 12, padding: '4px 10px', borderRadius: 20,
                                background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                              }}>⚠️ {m}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Visual aids */}
                      {strategy.strategies?.visual_aids?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>APOYOS VISUALES</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {strategy.strategies.visual_aids.map((v, i) => (
                              <span key={i} style={{
                                fontSize: 12, padding: '4px 10px', borderRadius: 20,
                                background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                              }}>🗂 {v}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Session flow */}
                      {strategy.strategies?.session_flow && (
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                            FLUJO DE SESIONES
                          </label>
                          <div style={{
                            fontSize: 13, color: '#374151', background: '#f8fafc',
                            padding: '8px 12px', borderRadius: 8, borderLeft: '3px solid #7c3aed',
                          }}>
                            {strategy.strategies.session_flow}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#9ca3af' }}>
                      Estrategia pendiente de generación
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {localStrategies.length > 0 && (
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                className="sw-btn sw-btn-outline"
                onClick={() => onSave(localStrategies)}
              >
                💾 Guardar cambios
              </button>
              <button className="sw-btn sw-btn-outline" onClick={onGenerate}>
                🔄 Re-generar
              </button>
            </div>
          )}
        </>
      )}

      <button
        className="sw-btn sw-btn-primary sw-btn-next"
        style={{ marginTop: 20 }}
        onClick={async () => {
          if (localStrategies.length) await onSave(localStrategies)
          onNext()
        }}
      >
        Continuar a distribución →
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5: DISTRIBUTION + RESOURCES + PUBLISH
// ══════════════════════════════════════════════════════════════════════════════
function StepDistribute({
  pageAnalysis, distribution, workingWeeks, schedule, distributing,
  unitsConfig, subunitClassification, teachingStrategies,
  resources, selectedDay, setSelectedDay, addingResource, setAddingResource,
  advisorFeedback, onDistribute, onAddResource, onRemoveResource,
  onAdvisorCheck, getResourcesForDay, onPublish, onBack,
}) {
  const [distSubStep, setDistSubStep] = useState('plan')

  const hoursPerDay = useMemo(() => {
    const h = {}
    DAY_KEYS.forEach(dk => { h[dk] = (schedule[dk] || []).length })
    return h
  }, [schedule])

  return (
    <div className="sw-step-content">
      <div className="sw-step-header-row">
        <button className="sw-btn sw-btn-ghost" onClick={onBack}>← Volver</button>
        <h3 className="sw-step-title">📅 Distribución y publicación</h3>
      </div>

      {/* Sub-step tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f3f4f6', borderRadius: 10, padding: 4 }}>
        {[
          { key: 'plan',      label: '📋 Distribución' },
          { key: 'resources', label: '🎬 Recursos' },
          { key: 'publish',   label: '🚀 Publicar' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setDistSubStep(tab.key)}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none',
              background: distSubStep === tab.key ? '#fff' : 'transparent',
              boxShadow: distSubStep === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              fontWeight: distSubStep === tab.key ? 600 : 400,
              color: distSubStep === tab.key ? '#1f2937' : '#6b7280',
              cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* DISTRIBUTION TIMELINE */}
      {distSubStep === 'plan' && (
        <div>
          <div className="sw-schedule-info">
            <span className="sw-schedule-label">Tu horario:</span>
            {DAY_KEYS.map(dk => (
              <span key={dk} className={`sw-schedule-chip ${hoursPerDay[dk] ? '' : 'sw-schedule-chip-off'}`}>
                {DAY_LABELS[dk]}: {hoursPerDay[dk]}h
              </span>
            ))}
            <span className="sw-schedule-weeks">{workingWeeks.length} semanas hábiles</span>
          </div>

          <button className="sw-btn sw-btn-primary" onClick={onDistribute} disabled={distributing}>
            {distributing ? <><span className="cbf-spin-inline" />Generando distribución...</> : '🤖 Distribuir con IA'}
          </button>

          {distribution.length > 0 && (
            <div className="sw-timeline">
              {distribution.map(weekData => (
                <div key={weekData.week} className="sw-week-row">
                  <div className="sw-week-label">Sem. {weekData.week}</div>
                  <div className="sw-week-days">
                    {DAY_KEYS.map(dk => {
                      const dayData = weekData.days?.[dk]
                      if (!hoursPerDay[dk]) return <div key={dk} className="sw-day-cell sw-day-off" />
                      if (!dayData)         return <div key={dk} className="sw-day-cell sw-day-empty"><span className="sw-day-label">{DAY_LABELS[dk]}</span></div>

                      const pages        = dayData.pages || []
                      const dayResources  = getResourcesForDay(weekData.week, dk)
                      const strategyHint  = dayData.suggested_approach
                      const diff = DIFFICULTY_STYLES[dayData.difficulty] || DIFFICULTY_STYLES.moderate

                      return (
                        <div
                          key={dk}
                          className="sw-day-cell sw-day-filled"
                          style={{ borderLeftColor: diff.border, background: diff.bg }}
                        >
                          <div className="sw-day-header">
                            <span className="sw-day-label">{DAY_LABELS[dk]}</span>
                            <span style={{ fontSize: 10 }}>{diff.icon} {diff.label}</span>
                            <span className="sw-day-hours">{hoursPerDay[dk]}h</span>
                          </div>
                          <div className="sw-day-pages">
                            {pages.map(pNum => {
                              const pa = pageAnalysis.find(p => p.page === pNum)
                              return (
                                <span key={pNum} className="sw-page-chip" style={{ background: CONTENT_TYPE_COLORS[pa?.content_type] || '#888' }}>
                                  p.{pNum}
                                </span>
                              )
                            })}
                          </div>

                          {/* Key grammar/vocab from distribution */}
                          {dayData.key_grammar?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                              {dayData.key_grammar.map((g, i) => (
                                <span key={i} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 20, background: '#ede9fe', color: '#7c3aed' }}>{g}</span>
                              ))}
                            </div>
                          )}

                          {dayData.key_vocabulary?.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 2 }}>
                              {dayData.key_vocabulary.map((v, i) => (
                                <span key={i} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 20, background: '#e0f2fe', color: '#0369a1' }}>{v}</span>
                              ))}
                            </div>
                          )}

                          {strategyHint && (
                            <div style={{ fontSize: 10, color: '#be123c', marginTop: 4, fontStyle: 'italic' }}>
                              🧠 {strategyHint}
                            </div>
                          )}

                          <div className="sw-day-focus">{dayData.focus}</div>
                          <div className="sw-day-minutes">{dayData.total_minutes} min</div>

                          {dayResources.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              {dayResources.map(r => (
                                <div key={r.id} style={{ fontSize: 10, color: '#6b7280' }}>
                                  {RESOURCE_TYPES.find(t => t.value === r.resource_type)?.icon} {r.title}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              <button
                className="sw-btn sw-btn-outline"
                style={{ marginTop: 12 }}
                onClick={() => setDistSubStep('resources')}
              >
                Agregar recursos →
              </button>
            </div>
          )}
        </div>
      )}

      {/* RESOURCES */}
      {distSubStep === 'resources' && (
        <div>
          <div className="sw-resources-grid">
            {distribution.map(weekData => (
              <div key={weekData.week} className="sw-res-week">
                <div className="sw-res-week-label">Semana {weekData.week}</div>
                <div className="sw-res-days">
                  {DAY_KEYS.map(dk => {
                    if (!hoursPerDay[dk]) return null
                    const dayData = weekData.days?.[dk]
                    if (!dayData) return null

                    const dayResources = getResourcesForDay(weekData.week, dk)
                    const isSelected   = selectedDay?.week === weekData.week && selectedDay?.dayKey === dk
                    const showFeedback = advisorFeedback?.week === weekData.week && advisorFeedback?.dayKey === dk

                    return (
                      <div
                        key={dk}
                        className={`sw-res-day ${isSelected ? 'sw-res-day-selected' : ''}`}
                        onClick={() => setSelectedDay({ week: weekData.week, dayKey: dk })}
                      >
                        <div className="sw-res-day-header">
                          <span>{DAY_FULL[dk]}</span>
                          <span className="sw-res-day-pages">{(dayData.pages || []).length} pág.</span>
                        </div>
                        <div className="sw-res-day-focus">{dayData.focus}</div>
                        {dayResources.length > 0 && (
                          <div className="sw-res-day-resources">
                            {dayResources.map(r => (
                              <div key={r.id} className="sw-resource-chip">
                                <span>{RESOURCE_TYPES.find(t => t.value === r.resource_type)?.icon} {r.title}</span>
                                <button className="sw-resource-remove" onClick={e => { e.stopPropagation(); onRemoveResource(r.id) }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {showFeedback && !advisorFeedback.loading && (
                          <div className={`sw-advisor-badge ${advisorFeedback.feasible ? 'sw-advisor-ok' : 'sw-advisor-warn'}`}>
                            {advisorFeedback.feedback}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {selectedDay && (
            <SelectedDayPanel
              weekData={distribution.find(w => w.week === selectedDay.week)}
              dayKey={selectedDay.dayKey}
              resources={getResourcesForDay(selectedDay.week, selectedDay.dayKey)}
              pageAnalysis={pageAnalysis}
              addingResource={addingResource}
              setAddingResource={setAddingResource}
              onAddResource={onAddResource}
              onRemoveResource={onRemoveResource}
              onAdvisorCheck={() => onAdvisorCheck(selectedDay.week, selectedDay.dayKey)}
              advisorFeedback={advisorFeedback?.week === selectedDay.week && advisorFeedback?.dayKey === selectedDay.dayKey ? advisorFeedback : null}
              classHours={hoursPerDay[selectedDay.dayKey]}
            />
          )}

          <button
            className="sw-btn sw-btn-outline"
            style={{ marginTop: 16 }}
            onClick={() => setDistSubStep('publish')}
          >
            Revisar y publicar →
          </button>
        </div>
      )}

      {/* PUBLISH */}
      {distSubStep === 'publish' && (
        <div>
          <div className="sw-confirm-stats">
            <div className="sw-stat-card">
              <div className="sw-stat-num">{pageAnalysis.length}</div>
              <div className="sw-stat-label">Páginas</div>
            </div>
            <div className="sw-stat-card">
              <div className="sw-stat-num">{unitsConfig.length}</div>
              <div className="sw-stat-label">Unidades</div>
            </div>
            <div className="sw-stat-card">
              <div className="sw-stat-num">{subunitClassification.length}</div>
              <div className="sw-stat-label">Subunidades</div>
            </div>
            <div className="sw-stat-card">
              <div className="sw-stat-num">{distribution.length}</div>
              <div className="sw-stat-label">Semanas</div>
            </div>
            <div className="sw-stat-card">
              <div className="sw-stat-num">{resources.length}</div>
              <div className="sw-stat-label">Recursos</div>
            </div>
            <div className="sw-stat-card">
              <div className="sw-stat-num">{teachingStrategies.length}</div>
              <div className="sw-stat-label">Estrategias</div>
            </div>
          </div>

          <div className="sw-confirm-note">
            <p>
              Al publicar, este syllabus enriquecido estará disponible cuando generes guías semanales.
              La IA sabrá las páginas, la gramática clave, el vocabulario y las estrategias para cada sesión.
            </p>
          </div>

          <button className="sw-btn sw-btn-publish" onClick={onPublish} disabled={!distribution.length}>
            🚀 Publicar Syllabus
          </button>
        </div>
      )}
    </div>
  )
}

// ── Selected Day Panel (resource editor) ──────────────────────────────────────
function SelectedDayPanel({
  weekData, dayKey, resources, pageAnalysis, addingResource, setAddingResource,
  onAddResource, onRemoveResource, onAdvisorCheck, advisorFeedback, classHours,
}) {
  const dayData           = weekData?.days?.[dayKey]
  const dayPages          = (dayData?.pages || []).map(pNum => pageAnalysis.find(p => p.page === pNum)).filter(Boolean)
  const totalPageMinutes  = dayPages.reduce((s, p) => s + (p?.estimated_minutes || 0), 0)
  const totalResourceMins = resources.reduce((s, r) => s + (r.duration_minutes || 0), 0)
  const availableMinutes  = classHours * 50
  const usedMinutes       = totalPageMinutes + totalResourceMins
  const usagePercent      = Math.min((usedMinutes / availableMinutes) * 100, 100)
  const overloaded        = usedMinutes > availableMinutes

  return (
    <div className="sw-day-panel">
      <div className="sw-day-panel-header">
        <h4>{DAY_FULL[dayKey]} — Semana {weekData?.week}</h4>
        <span className="sw-day-panel-time">{classHours}h ({availableMinutes} min)</span>
      </div>

      <div className="sw-time-bar-container">
        <div className="sw-time-bar">
          <div className="sw-time-bar-fill" style={{ width: `${usagePercent}%`, background: overloaded ? '#ef4444' : usagePercent > 80 ? '#f59e0b' : '#22c55e' }} />
        </div>
        <span className={`sw-time-label ${overloaded ? 'sw-time-over' : ''}`}>
          {usedMinutes}/{availableMinutes} min {overloaded ? '⚠️ Exceso' : ''}
        </span>
      </div>

      <div className="sw-day-panel-section">
        <h5>📖 Páginas asignadas ({totalPageMinutes} min)</h5>
        <div className="sw-day-pages-list">
          {dayPages.map(p => (
            <div key={p.page} className="sw-day-page-item">
              <span className="sw-page-badge" style={{ background: CONTENT_TYPE_COLORS[p.content_type] }}>p.{p.page}</span>
              <span>{p.summary}</span>
              <span className="sw-page-mins">~{p.estimated_minutes}min</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sw-day-panel-section">
        <h5>🎬 Recursos ({totalResourceMins} min)</h5>
        {resources.map(r => (
          <div key={r.id} className="sw-resource-item">
            <div className="sw-resource-item-header">
              <span>{RESOURCE_TYPES.find(t => t.value === r.resource_type)?.icon} <strong>{r.title}</strong></span>
              {r.abc_section && (
                <span className="sw-abc-tag" style={{ background: ABC_SECTIONS.find(s => s.value === r.abc_section)?.color }}>
                  {ABC_SECTIONS.find(s => s.value === r.abc_section)?.label}
                </span>
              )}
              <span className="sw-resource-mins">{r.duration_minutes || '?'} min</span>
              <button className="sw-resource-remove" onClick={() => onRemoveResource(r.id)}>🗑️</button>
            </div>
            {r.justification && <div className="sw-resource-justification">💬 {r.justification}</div>}
          </div>
        ))}
        {!addingResource && (
          <button className="sw-btn sw-btn-outline" onClick={() => setAddingResource(true)}>
            + Agregar recurso
          </button>
        )}
        {addingResource && <AddResourceForm onAdd={onAddResource} onCancel={() => setAddingResource(false)} />}
      </div>

      <button className="sw-btn sw-btn-advisor" onClick={onAdvisorCheck}>
        🧠 Consultar Advisor IA
      </button>

      {advisorFeedback && !advisorFeedback.loading && (
        <div className={`sw-advisor-panel ${advisorFeedback.feasible ? 'sw-advisor-panel-ok' : 'sw-advisor-panel-warn'}`}>
          <div className="sw-advisor-feedback">{advisorFeedback.feedback}</div>
          {advisorFeedback.recommendations?.length > 0 && (
            <ul className="sw-advisor-recs">
              {advisorFeedback.recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Add Resource Form ─────────────────────────────────────────────────────────
function AddResourceForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({
    resource_type: 'video', title: '', url: '', justification: '',
    abc_section: 'skill', duration_minutes: 10, emphasis_notes: '',
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd(form)
  }

  return (
    <form className="sw-add-resource-form" onSubmit={handleSubmit}>
      <div className="sw-form-row">
        <select value={form.resource_type} onChange={e => setForm({ ...form, resource_type: e.target.value })}>
          {RESOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
        <input placeholder="Título del recurso" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
      </div>

      <input placeholder="URL (video, página web, etc.)" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />

      <div className="sw-form-row">
        <select value={form.abc_section} onChange={e => setForm({ ...form, abc_section: e.target.value })}>
          {ABC_SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input type="number" placeholder="Min" min={1} max={90} value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} style={{ width: 70 }} />
        <span className="sw-form-suffix">min</span>
      </div>

      <textarea
        placeholder="¿Por qué este recurso aquí? Explica su propósito pedagógico..."
        value={form.justification}
        onChange={e => setForm({ ...form, justification: e.target.value })}
        rows={2}
      />

      <textarea
        placeholder="Notas de énfasis (opcional): ¿qué parte es más importante?"
        value={form.emphasis_notes}
        onChange={e => setForm({ ...form, emphasis_notes: e.target.value })}
        rows={2}
      />

      <div className="sw-form-actions">
        <button type="submit" className="sw-btn sw-btn-primary">Guardar</button>
        <button type="button" className="sw-btn sw-btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
