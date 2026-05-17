/**
 * SyllabusWizard.jsx
 * Wizard recursivo y visual para planificación de syllabus página a página.
 *
 * Steps:
 *  1. SELECT  — Seleccionar libro + rango de páginas + escanear con Vision
 *  2. DISTRIBUTE — Ver distribución por semana/día (respeta horario)
 *  3. RESOURCES — Adjuntar recursos por sesión + advisor IA
 *  4. CONFIRM — Revisar y publicar
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { analyzeBookPages, distributePagesByWeek, computeWorkingWeeks, advisorCheckSession } from '../utils/syllabusAI'
import useSyllabusPlan from '../hooks/useSyllabusPlan'

// ── Constants ───────────────────────────────────────────────────────────��──────
const STEPS = [
  { key: 'select',     label: '1. Libro y Páginas', icon: '📖' },
  { key: 'distribute', label: '2. Distribución',    icon: '📅' },
  { key: 'resources',  label: '3. Recursos',        icon: '🎬' },
  { key: 'confirm',    label: '4. Confirmar',       icon: '✅' },
]

const COMPLEXITY_LABELS = ['', '⚡ Muy fácil', '📗 Fácil', '📘 Normal', '📕 Compleja', '🔥 Muy densa']
const COMPLEXITY_COLORS = ['', '#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444']

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

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri']
const DAY_LABELS = { mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie' }
const DAY_FULL = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' }

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function SyllabusWizard({ teacher, subject, grade, period }) {
  const { showToast } = useToast()
  const [step, setStep] = useState('select')
  const { plan, loading: planLoading, savePlan } = useSyllabusPlan(teacher, { subject, grade, period })

  // ── Step 1 state ─────────────────────────────────────────────────────────
  const [libraryDocs, setLibraryDocs] = useState([])
  const [selectedDocId, setSelectedDocId] = useState('')
  const [pageStart, setPageStart] = useState(1)
  const [pageEnd, setPageEnd] = useState(20)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
  const [pageAnalysis, setPageAnalysis] = useState([]) // [{page, content_type, complexity, ...}]
  const [unitsConfig, setUnitsConfig] = useState([])   // [{unit_number, title, start_page, end_page}]

  // ── Step 2 state ─────────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState({})         // teacher schedule for this assignment
  const [workingWeeks, setWorkingWeeks] = useState([])
  const [distribution, setDistribution] = useState([]) // [{week, days:{mon:{pages,focus,...}}}]
  const [distributing, setDistributing] = useState(false)

  // ── Step 3 state ─────────────────────────────────────────────────────────
  const [resources, setResources] = useState([])       // syllabus_session_resources rows
  const [advisorFeedback, setAdvisorFeedback] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null) // {week, dayKey} for resource editing
  const [addingResource, setAddingResource] = useState(false)

  // ── Load saved plan data on mount ────────────────────────────────────────
  useEffect(() => {
    if (!plan) return
    if (plan.page_analysis?.length) setPageAnalysis(plan.page_analysis)
    if (plan.units_config?.length) setUnitsConfig(plan.units_config)
    if (plan.page_distribution?.length) setDistribution(plan.page_distribution)
    if (plan.page_start) setPageStart(plan.page_start)
    if (plan.page_end) setPageEnd(plan.page_end)
    if (plan.library_doc_id) setSelectedDocId(plan.library_doc_id)
  }, [plan])

  // ── Load library docs ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('school_library')
      .select('id, title, file_url, file_mime')
      .eq('school_id', teacher.school_id)
      .in('file_mime', ['application/pdf'])
      .order('title')
      .then(({ data }) => setLibraryDocs(data || []))
  }, [teacher.school_id])

  // ── Load teacher schedule for this subject/grade ─────────────────────────
  useEffect(() => {
    if (!subject || !grade) return
    const baseGrade = grade.split(' ')[0] // "8.° Blue" → "8.°"
    supabase.from('teacher_assignments')
      .select('schedule')
      .eq('teacher_id', teacher.id)
      .eq('subject', subject)
      .eq('grade', baseGrade)
      .single()
      .then(({ data }) => {
        if (data?.schedule) setSchedule(data.schedule)
      })
  }, [teacher.id, subject, grade])

  // ── Load working weeks from calendar ─────────────────────────────────────
  useEffect(() => {
    if (!teacher.school_id || !period) return
    // Get period config
    supabase.from('academic_period_config')
      .select('start_date, end_date')
      .eq('school_id', teacher.school_id)
      .eq('period', parseInt(period))
      .single()
      .then(async ({ data: pc }) => {
        if (!pc?.start_date || !pc?.end_date) return
        // Get no-class dates
        const { data: cal } = await supabase.from('school_calendar')
          .select('date')
          .eq('school_id', teacher.school_id)
          .eq('period', parseInt(period))
          .eq('no_class', true)
        const noClassDates = (cal || []).map(c => c.date)
        const weeks = computeWorkingWeeks(pc.start_date, pc.end_date, noClassDates)
        setWorkingWeeks(weeks)
      })
  }, [teacher.school_id, period])

  // ── Load resources ───────────────────────────────────────────────────────
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
  // STEP 1: SCAN PAGES
  // ══════════════════════════════════════════════════════════════════════════
  const selectedDoc = useMemo(() => libraryDocs.find(d => d.id === selectedDocId), [libraryDocs, selectedDocId])

  async function handleScanPages() {
    if (!selectedDoc?.file_url) { showToast('Selecciona un libro primero', 'error'); return }
    if (pageEnd <= pageStart) { showToast('El rango de páginas es inválido', 'error'); return }

    setScanning(true)
    const totalPages = pageEnd - pageStart + 1
    setScanProgress({ current: 0, total: totalPages })

    const allAnalysis = []
    const BATCH_SIZE = 5

    try {
      // Render pages to canvas using PDF.js
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

      const pdf = await pdfjsLib.getDocument(selectedDoc.file_url).promise

      for (let batchStart = pageStart; batchStart <= pageEnd; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, pageEnd)
        const batchPages = []

        // Render each page in this batch
        for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
          try {
            const page = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale: 1.0 })
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            // Render at moderate resolution for Vision
            const scale = Math.min(1200 / viewport.width, 1200 / viewport.height, 1.5)
            canvas.width = viewport.width * scale
            canvas.height = viewport.height * scale
            await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale }) }).promise
            const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
            batchPages.push({ pageNum, base64 })
          } catch (e) {
            console.warn(`Failed to render page ${pageNum}:`, e)
          }
        }

        if (batchPages.length) {
          const { analysis, error } = await analyzeBookPages(batchPages, {
            subject, grade, bookTitle: selectedDoc.title,
          })
          if (error) console.warn('Batch analysis error:', error)
          if (analysis?.length) allAnalysis.push(...analysis)
        }

        setScanProgress({ current: Math.min(batchEnd - pageStart + 1, totalPages), total: totalPages })
      }

      setPageAnalysis(allAnalysis)

      // Auto-detect units from analysis
      const units = detectUnitsFromAnalysis(allAnalysis)
      setUnitsConfig(units)

      // Save to plan
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

  // ── Auto-detect unit boundaries from page analysis ─────────────────────
  function detectUnitsFromAnalysis(analysis) {
    const units = []
    let currentUnit = null

    for (const page of analysis) {
      const subunit = page.subunit || ''
      // Extract unit number from subunit label (e.g., "3A" → 3, "Unit 5" → 5)
      const unitMatch = subunit.match(/(\d+)/)
      const unitNum = unitMatch ? parseInt(unitMatch[1]) : (currentUnit?.unit_number || 1)

      if (!currentUnit || currentUnit.unit_number !== unitNum) {
        if (currentUnit) units.push(currentUnit)
        currentUnit = { unit_number: unitNum, title: `Unit ${unitNum}`, start_page: page.page, end_page: page.page, subunits: [] }
      }
      currentUnit.end_page = page.page

      // Track subunits
      if (subunit && !currentUnit.subunits.find(s => s.label === subunit)) {
        currentUnit.subunits.push({ label: subunit, pages: [page.page] })
      } else if (subunit) {
        currentUnit.subunits.find(s => s.label === subunit)?.pages.push(page.page)
      }
    }
    if (currentUnit) units.push(currentUnit)
    return units
  }

  // ═════════════════════════════════════════════════════════════════════════���
  // STEP 2: DISTRIBUTE
  // ══════════════════════════════════════════════════════════════════════════
  async function handleDistribute() {
    if (!pageAnalysis.length) { showToast('Primero escanea las páginas', 'error'); return }
    if (!workingWeeks.length) { showToast('No hay semanas hábiles configuradas', 'error'); return }

    setDistributing(true)
    try {
      const { distribution: dist, error } = await distributePagesByWeek({
        page_analysis: pageAnalysis,
        working_weeks: workingWeeks,
        schedule,
        minutes_per_period: 50,
        subject,
        grade,
        units_config: unitsConfig,
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

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: RESOURCES
  // ══════════════════════════════════════════════════════════════════════════
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
    const dayDist = distribution.find(w => w.week === week)?.days?.[dayKey]
    const dayPages = (dayDist?.pages || []).map(pNum => pageAnalysis.find(p => p.page === pNum)).filter(Boolean)
    const classHours = (schedule[dayKey] || []).length
    const available = classHours * 50

    setAdvisorFeedback({ loading: true, week, dayKey })
    const result = await advisorCheckSession({
      resources: dayResources,
      pages: dayPages,
      available_minutes: available,
      subject,
      day_label: `${DAY_FULL[dayKey]} Semana ${week}`,
    })
    setAdvisorFeedback({ ...result, week, dayKey, loading: false })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: CONFIRM — publish to syllabus_topics
  // ══════════════════════════════════════════════════════════════════════════
  async function handlePublish() {
    if (!distribution.length) { showToast('No hay distribución para publicar', 'error'); return }
    await savePlan({ status: 'active', page_distribution: distribution })
    showToast('✅ Syllabus publicado — se usará en la generación de guías', 'success')
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  const currentStepIdx = STEPS.findIndex(s => s.key === step)

  return (
    <div className="sw-container">
      {/* ── Step indicators ── */}
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

      {/* ── Step content ── */}
      <div className="sw-body">
        {step === 'select' && (
          <StepSelect
            libraryDocs={libraryDocs}
            selectedDocId={selectedDocId} setSelectedDocId={setSelectedDocId}
            pageStart={pageStart} setPageStart={setPageStart}
            pageEnd={pageEnd} setPageEnd={setPageEnd}
            scanning={scanning} scanProgress={scanProgress}
            pageAnalysis={pageAnalysis} unitsConfig={unitsConfig}
            onScan={handleScanPages}
            onNext={() => setStep('distribute')}
          />
        )}

        {step === 'distribute' && (
          <StepDistribute
            pageAnalysis={pageAnalysis}
            distribution={distribution}
            workingWeeks={workingWeeks}
            schedule={schedule}
            distributing={distributing}
            unitsConfig={unitsConfig}
            onDistribute={handleDistribute}
            onNext={() => setStep('resources')}
            onBack={() => setStep('select')}
          />
        )}

        {step === 'resources' && (
          <StepResources
            distribution={distribution}
            resources={resources}
            schedule={schedule}
            pageAnalysis={pageAnalysis}
            selectedDay={selectedDay} setSelectedDay={setSelectedDay}
            addingResource={addingResource} setAddingResource={setAddingResource}
            advisorFeedback={advisorFeedback}
            onAddResource={addResource}
            onRemoveResource={removeResource}
            onAdvisorCheck={handleAdvisorCheck}
            getResourcesForDay={getResourcesForDay}
            onNext={() => setStep('confirm')}
            onBack={() => setStep('distribute')}
          />
        )}

        {step === 'confirm' && (
          <StepConfirm
            distribution={distribution}
            resources={resources}
            pageAnalysis={pageAnalysis}
            unitsConfig={unitsConfig}
            schedule={schedule}
            onPublish={handlePublish}
            onBack={() => setStep('resources')}
          />
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1: SELECT BOOK + SCAN PAGES
// ══════════════════════════════════════════════════════════════════════════════
function StepSelect({ libraryDocs, selectedDocId, setSelectedDocId, pageStart, setPageStart, pageEnd, setPageEnd, scanning, scanProgress, pageAnalysis, unitsConfig, onScan, onNext }) {
  return (
    <div className="sw-step-content">
      <h3 className="sw-step-title">📖 Seleccionar libro y escanear páginas</h3>
      <p className="sw-step-desc">Selecciona el libro de la Biblioteca CBF y define el rango de páginas que deseas cubrir este período.</p>

      {/* Book selector */}
      <div className="sw-field-group">
        <label className="sw-label">Libro (PDF de la Biblioteca)</label>
        <select className="sw-select" value={selectedDocId} onChange={e => setSelectedDocId(e.target.value)}>
          <option value="">— Seleccionar libro —</option>
          {libraryDocs.map(d => (
            <option key={d.id} value={d.id}>{d.title}</option>
          ))}
        </select>
      </div>

      {/* Page range */}
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

      {/* Scan button */}
      <button className="sw-btn sw-btn-primary" onClick={onScan} disabled={scanning || !selectedDocId}>
        {scanning
          ? `🔍 Escaneando... ${scanProgress.current}/${scanProgress.total}`
          : '🔍 Escanear páginas con IA'}
      </button>

      {scanning && (
        <div className="sw-progress-bar">
          <div className="sw-progress-fill" style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }} />
        </div>
      )}

      {/* Results: Page grid */}
      {pageAnalysis.length > 0 && (
        <div className="sw-analysis-section">
          <h4 className="sw-section-title">✅ {pageAnalysis.length} páginas analizadas</h4>

          {/* Units detected */}
          {unitsConfig.length > 0 && (
            <div className="sw-units-detected">
              <span className="sw-units-label">Unidades detectadas:</span>
              {unitsConfig.map(u => (
                <span key={u.unit_number} className="sw-unit-chip">
                  Unit {u.unit_number}: pp. {u.start_page}–{u.end_page}
                </span>
              ))}
            </div>
          )}

          {/* Page thumbnails grid */}
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
                <div className="sw-page-summary">{p.summary}</div>
                {p.subunit && <div className="sw-page-subunit">{p.subunit}</div>}
              </div>
            ))}
          </div>

          <button className="sw-btn sw-btn-primary sw-btn-next" onClick={onNext}>
            Continuar a distribución →
          </button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2: DISTRIBUTION TIMELINE
// ══════════════════════════════════════════════════════════════════════════════
function StepDistribute({ pageAnalysis, distribution, workingWeeks, schedule, distributing, unitsConfig, onDistribute, onNext, onBack }) {
  // Calculate hours per day
  const hoursPerDay = useMemo(() => {
    const h = {}
    DAY_KEYS.forEach(dk => { h[dk] = (schedule[dk] || []).length })
    return h
  }, [schedule])

  return (
    <div className="sw-step-content">
      <div className="sw-step-header-row">
        <button className="sw-btn sw-btn-ghost" onClick={onBack}>← Volver</button>
        <h3 className="sw-step-title">📅 Distribución por semana</h3>
      </div>

      {/* Schedule info */}
      <div className="sw-schedule-info">
        <span className="sw-schedule-label">Tu horario:</span>
        {DAY_KEYS.map(dk => (
          <span key={dk} className={`sw-schedule-chip ${hoursPerDay[dk] ? '' : 'sw-schedule-chip-off'}`}>
            {DAY_LABELS[dk]}: {hoursPerDay[dk]}h
          </span>
        ))}
        <span className="sw-schedule-weeks">{workingWeeks.length} semanas hábiles</span>
      </div>

      {/* Generate button */}
      <button className="sw-btn sw-btn-primary" onClick={onDistribute} disabled={distributing}>
        {distributing ? <><span className="cbf-spin-inline"/>Generando distribución...</> : '🤖 Distribuir con IA'}
      </button>

      {/* Distribution timeline */}
      {distribution.length > 0 && (
        <div className="sw-timeline">
          {distribution.map(weekData => (
            <div key={weekData.week} className="sw-week-row">
              <div className="sw-week-label">Sem. {weekData.week}</div>
              <div className="sw-week-days">
                {DAY_KEYS.map(dk => {
                  const dayData = weekData.days?.[dk]
                  if (!hoursPerDay[dk]) return <div key={dk} className="sw-day-cell sw-day-off" />
                  if (!dayData) return <div key={dk} className="sw-day-cell sw-day-empty"><span className="sw-day-label">{DAY_LABELS[dk]}</span></div>

                  const pages = dayData.pages || []
                  const avgComplexity = pages.length
                    ? pages.reduce((sum, pNum) => sum + (pageAnalysis.find(p => p.page === pNum)?.complexity || 3), 0) / pages.length
                    : 0

                  return (
                    <div key={dk} className="sw-day-cell sw-day-filled" style={{ borderLeftColor: COMPLEXITY_COLORS[Math.round(avgComplexity)] }}>
                      <div className="sw-day-header">
                        <span className="sw-day-label">{DAY_LABELS[dk]}</span>
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
                      <div className="sw-day-focus">{dayData.focus}</div>
                      <div className="sw-day-minutes">{dayData.total_minutes} min</div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <button className="sw-btn sw-btn-primary sw-btn-next" onClick={onNext}>
            Continuar a recursos →
          </button>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3: RESOURCES PER SESSION
// ══════════════════════════════════════════════════════════════════════════════
function StepResources({ distribution, resources, schedule, pageAnalysis, selectedDay, setSelectedDay, addingResource, setAddingResource, advisorFeedback, onAddResource, onRemoveResource, onAdvisorCheck, getResourcesForDay, onNext, onBack }) {
  const hoursPerDay = useMemo(() => {
    const h = {}
    DAY_KEYS.forEach(dk => { h[dk] = (schedule[dk] || []).length })
    return h
  }, [schedule])

  return (
    <div className="sw-step-content">
      <div className="sw-step-header-row">
        <button className="sw-btn sw-btn-ghost" onClick={onBack}>← Volver</button>
        <h3 className="sw-step-title">🎬 Recursos por sesión</h3>
      </div>
      <p className="sw-step-desc">Selecciona un día para agregarle recursos educativos. El advisor IA validará que todo quepa en el tiempo disponible.</p>

      {/* Distribution with resource overlay */}
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
                const isSelected = selectedDay?.week === weekData.week && selectedDay?.dayKey === dk
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

                    {/* Resources attached */}
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

                    {/* Advisor feedback */}
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

      {/* Selected day panel */}
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

      <button className="sw-btn sw-btn-primary sw-btn-next" onClick={onNext}>
        Revisar y confirmar →
      </button>
    </div>
  )
}

// ── Selected Day Panel (resource editor) ────────────────────────────────────
function SelectedDayPanel({ weekData, dayKey, resources, pageAnalysis, addingResource, setAddingResource, onAddResource, onRemoveResource, onAdvisorCheck, advisorFeedback, classHours }) {
  const dayData = weekData?.days?.[dayKey]
  const dayPages = (dayData?.pages || []).map(pNum => pageAnalysis.find(p => p.page === pNum)).filter(Boolean)
  const totalPageMinutes = dayPages.reduce((s, p) => s + (p?.estimated_minutes || 0), 0)
  const totalResourceMinutes = resources.reduce((s, r) => s + (r.duration_minutes || 0), 0)
  const availableMinutes = classHours * 50
  const usedMinutes = totalPageMinutes + totalResourceMinutes
  const usagePercent = Math.min((usedMinutes / availableMinutes) * 100, 100)
  const overloaded = usedMinutes > availableMinutes

  return (
    <div className="sw-day-panel">
      <div className="sw-day-panel-header">
        <h4>{DAY_FULL[dayKey]} — Semana {weekData?.week}</h4>
        <span className="sw-day-panel-time">{classHours}h ({availableMinutes} min)</span>
      </div>

      {/* Time usage bar */}
      <div className="sw-time-bar-container">
        <div className="sw-time-bar">
          <div className="sw-time-bar-fill" style={{ width: `${usagePercent}%`, background: overloaded ? '#ef4444' : usagePercent > 80 ? '#f59e0b' : '#22c55e' }} />
        </div>
        <span className={`sw-time-label ${overloaded ? 'sw-time-over' : ''}`}>
          {usedMinutes}/{availableMinutes} min {overloaded ? '⚠️ Exceso' : ''}
        </span>
      </div>

      {/* Pages assigned */}
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

      {/* Resources */}
      <div className="sw-day-panel-section">
        <h5>🎬 Recursos ({totalResourceMinutes} min)</h5>
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

      {/* Advisor button */}
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

// ══════════════════════════════════════════════════════════════════════════════
// STEP 4: CONFIRM
// ══════════════════════════════════════════════════════════════════════════════
function StepConfirm({ distribution, resources, pageAnalysis, unitsConfig, schedule, onPublish, onBack }) {
  const totalPages = pageAnalysis.length
  const totalResources = resources.length
  const totalWeeks = distribution.length
  const totalDays = distribution.reduce((sum, w) => sum + DAY_KEYS.filter(dk => w.days?.[dk]).length, 0)

  return (
    <div className="sw-step-content">
      <div className="sw-step-header-row">
        <button className="sw-btn sw-btn-ghost" onClick={onBack}>← Volver</button>
        <h3 className="sw-step-title">✅ Confirmar y publicar</h3>
      </div>

      <div className="sw-confirm-stats">
        <div className="sw-stat-card">
          <div className="sw-stat-num">{totalPages}</div>
          <div className="sw-stat-label">Páginas</div>
        </div>
        <div className="sw-stat-card">
          <div className="sw-stat-num">{unitsConfig.length}</div>
          <div className="sw-stat-label">Unidades</div>
        </div>
        <div className="sw-stat-card">
          <div className="sw-stat-num">{totalWeeks}</div>
          <div className="sw-stat-label">Semanas</div>
        </div>
        <div className="sw-stat-card">
          <div className="sw-stat-num">{totalDays}</div>
          <div className="sw-stat-label">Sesiones</div>
        </div>
        <div className="sw-stat-card">
          <div className="sw-stat-num">{totalResources}</div>
          <div className="sw-stat-label">Recursos</div>
        </div>
      </div>

      <div className="sw-confirm-note">
        <p>Al publicar, esta distribución se usará automáticamente cuando generes guías semanales. La IA sabrá exactamente qué páginas cubrir cada día y qué recursos utilizar.</p>
      </div>

      <button className="sw-btn sw-btn-publish" onClick={onPublish}>
        🚀 Publicar distribución
      </button>
    </div>
  )
}
