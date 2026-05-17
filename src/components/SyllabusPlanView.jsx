/**
 * SyllabusPlanView.jsx
 * Vista "Plan Curricular" del Syllabus.
 *
 * Flujo:
 *  1. Seleccionar malla (library) o ingresar unidades manualmente
 *  2. Configurar: units_target + recurring_slots
 *  3. "Distribuir con IA" → genera cronograma semana × día
 *  4. "Publicar" → materializa en syllabus_topics
 */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import useSyllabusPlan from '../hooks/useSyllabusPlan'
import { distributeSyllabusAI, parseCurriculumAI, computeWorkingWeeks } from '../utils/syllabusAI'
import { useToast } from '../context/ToastContext'
import { ACADEMIC_PERIODS } from '../utils/constants'

// ── Constants ──────────────────────────────────────────────────────────────────
const DAY_KEYS   = ['mon', 'tue', 'wed', 'thu', 'fri']
const DAY_LABELS = { mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie' }
const DAY_FULL   = { mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes' }

const SLOT_TYPES = [
  { value: 'reading',      label: 'Reading Day',    icon: '📖', color: '#2563eb' },
  { value: 'skill',        label: 'Skill Day',      icon: '⚒️', color: '#7c3aed' },
  { value: 'vocab_review', label: 'Vocab Review',   icon: '📚', color: '#0891b2' },
  { value: 'project',      label: 'Proyecto',       icon: '🏗️', color: '#16a34a' },
  { value: 'custom',       label: 'Personalizado',  icon: '✏️', color: '#888'    },
]

const CT_COLORS = {
  grammar:    '#2E5598', vocabulary: '#0891b2', skill: '#7c3aed',
  reading:    '#2563eb', value:      '#d97706', concept: '#16a34a',
  review:     '#dc2626', other:      '#888',
}

function ctColor(t) { return CT_COLORS[t] || '#888' }

// ── SyllabusPlanView ──────────────────────────────────────────────────────────
export default function SyllabusPlanView({ teacher, subject, grade, period, pc }) {
  const { showToast } = useToast()

  const { plan, loading: planLoading, savePlan, saveDistribution, publishDistribution }
    = useSyllabusPlan(teacher, { subject, grade, period })

  // ── Local editable state (mirrors plan fields) ─────────────────────────────
  const [libraryDocs,     setLibraryDocs]     = useState([])
  const [selectedDocId,   setSelectedDocId]   = useState('')
  const [unitsTarget,     setUnitsTarget]     = useState(1)
  const [units,           setUnits]           = useState([])        // [{number,title,description,estimated_weeks,topics:[]}]
  const [slots,           setSlots]           = useState({})        // {mon: {type,label}, ...}
  const [distribution,    setDistribution]    = useState([])        // output de IA
  const [workingWeeks,    setWorkingWeeks]     = useState([])        // computed
  const [periodConfig,    setPeriodConfig]     = useState(null)
  const [noClassDates,    setNoClassDates]     = useState([])

  // ── UI state ───────────────────────────────────────────────────────────────
  const [distributing,   setDistributing]   = useState(false)
  const [publishing,     setPublishing]     = useState(false)
  const [parsing,        setParsing]        = useState(false)
  const [saving,         setSaving]         = useState(false)
  const [editingUnit,    setEditingUnit]    = useState(null)        // index | null
  const [slotPickerDay,  setSlotPickerDay]  = useState(null)        // 'mon'|'tue'|... | null

  // ── Sincronizar con plan existente ─────────────────────────────────────────
  useEffect(() => {
    if (!plan) return
    setSelectedDocId(plan.library_doc_id || '')
    setUnitsTarget(plan.units_target || 1)
    setUnits(plan.units || [])
    if (plan.distribution?.length) setDistribution(plan.distribution)
    // recurring_slots: [{day,type,label}] → {mon:{type,label}, ...}
    const slotsMap = {}
    ;(plan.recurring_slots || []).forEach(s => { slotsMap[s.day] = { type: s.type, label: s.label } })
    setSlots(slotsMap)
  }, [plan])

  // ── Cargar documentos de la biblioteca ────────────────────────────────────
  useEffect(() => {
    if (!teacher?.school_id) return
    supabase.from('school_library')
      .select('id, title, doc_type, file_url')
      .eq('school_id', teacher.school_id)
      .in('file_mime', ['application/pdf'])
      .order('title')
      .then(({ data }) => setLibraryDocs(data || []))
  }, [teacher?.school_id])

  // ── Cargar período config + días sin clase ─────────────────────────────────
  useEffect(() => {
    if (!teacher?.school_id || !period) return
    const year = new Date().getFullYear()

    Promise.all([
      supabase.from('academic_period_config')
        .select('start_date, end_date, compound_weeks')
        .eq('school_id', teacher.school_id)
        .eq('period', parseInt(period))
        .eq('year', year)
        .maybeSingle(),
      supabase.from('school_calendar')
        .select('date')
        .eq('school_id', teacher.school_id)
        .eq('period', parseInt(period))
        .eq('no_class', true),
    ]).then(([{ data: cfg }, { data: events }]) => {
      const fallback = ACADEMIC_PERIODS.find(p => parseInt(p.value) === parseInt(period))
      const resolvedCfg = cfg || (fallback ? { start_date: fallback.start, end_date: fallback.end } : null)
      setPeriodConfig(resolvedCfg)
      const noDates = (events || []).map(e => e.date)
      setNoClassDates(noDates)
      if (resolvedCfg?.start_date && resolvedCfg?.end_date) {
        setWorkingWeeks(computeWorkingWeeks(resolvedCfg.start_date, resolvedCfg.end_date, noDates))
      }
    })
  }, [teacher?.school_id, period])

  // ── Slots como array para guardar ─────────────────────────────────────────
  const slotsArray = useMemo(
    () => Object.entries(slots).map(([day, s]) => ({ day, type: s.type, label: s.label || '' })),
    [slots]
  )

  // ── Guardar configuración ─────────────────────────────────────────────────
  async function handleSaveConfig() {
    setSaving(true)
    const { error } = await savePlan({
      library_doc_id:  selectedDocId || null,
      units_target:    unitsTarget,
      units,
      recurring_slots: slotsArray,
      status:          plan?.status === 'active' ? 'active' : 'draft',
    })
    setSaving(false)
    if (error) showToast('Error al guardar: ' + error, 'error')
    else showToast('Configuración guardada ✅', 'success')
  }

  // ── Parsear malla con IA ──────────────────────────────────────────────────
  async function handleParseLibrary() {
    const doc = libraryDocs.find(d => d.id === selectedDocId)
    if (!doc?.file_url) { showToast('Selecciona un documento de la biblioteca', 'error'); return }
    setParsing(true)
    showToast('Analizando malla curricular con IA…', 'info')
    // Fetch text from document (simplificado — en producción usaría extracción PDF)
    const { units: parsed, error } = await parseCurriculumAI({
      text: `Documento: ${doc.title}. Analiza y propone una estructura de unidades.`,
      subject, grade,
    })
    setParsing(false)
    if (error) { showToast('Error al parsear: ' + error, 'error'); return }
    setUnits(parsed)
    showToast(`Malla analizada: ${parsed.length} unidade(s) encontrada(s) ✅`, 'success')
  }

  // ── Distribuir con IA ─────────────────────────────────────────────────────
  async function handleDistribute() {
    if (!units.length) { showToast('Agrega al menos una unidad antes de distribuir', 'error'); return }
    if (!workingWeeks.length) { showToast('No hay semanas hábiles configuradas para este período', 'error'); return }
    setDistributing(true)
    showToast('Generando distribución curricular con IA… puede tomar 30-60 segundos', 'info')
    const { distribution: dist, error } = await distributeSyllabusAI({
      subject, grade, period: parseInt(period),
      units_target: unitsTarget,
      units: units.slice(0, unitsTarget),
      recurring_slots: slotsArray,
      working_weeks: workingWeeks,
    })
    setDistributing(false)
    if (error) { showToast('Error al distribuir: ' + error, 'error'); return }
    setDistribution(dist)
    await saveDistribution(dist)
    showToast(`Distribución generada: ${dist.length} semana(s) ✅`, 'success')
  }

  // ── Publicar en syllabus_topics ───────────────────────────────────────────
  async function handlePublish() {
    if (!distribution.length) { showToast('Genera la distribución primero', 'error'); return }
    if (!confirm(`¿Publicar ${distribution.length} semana(s) en el Syllabus? Los temas generados por IA anteriores serán reemplazados.`)) return
    setPublishing(true)
    const { error, count } = await publishDistribution(distribution)
    setPublishing(false)
    if (error) { showToast('Error al publicar: ' + error, 'error'); return }
    await savePlan({ status: 'active' })
    showToast(`${count} tema(s) publicado(s) en el Syllabus ✅`, 'success')
  }

  // ── Edición de unidades ───────────────────────────────────────────────────
  function addUnit() {
    const next = units.length + 1
    setUnits(prev => [...prev, { number: next, title: '', description: '', estimated_weeks: 2, topics: [] }])
    setEditingUnit(units.length)
  }

  function updateUnit(idx, field, value) {
    setUnits(prev => prev.map((u, i) => i === idx ? { ...u, [field]: value } : u))
  }

  function removeUnit(idx) {
    setUnits(prev => prev.filter((_, i) => i !== idx).map((u, i) => ({ ...u, number: i + 1 })))
    if (editingUnit === idx) setEditingUnit(null)
  }

  function addTopicToUnit(unitIdx) {
    setUnits(prev => prev.map((u, i) => i === unitIdx
      ? { ...u, topics: [...(u.topics || []), { title: '', content_type: 'concept', estimated_classes: 1, description: '' }] }
      : u
    ))
  }

  function updateUnitTopic(unitIdx, topicIdx, field, value) {
    setUnits(prev => prev.map((u, i) => i === unitIdx
      ? { ...u, topics: u.topics.map((t, j) => j === topicIdx ? { ...t, [field]: value } : t) }
      : u
    ))
  }

  function removeUnitTopic(unitIdx, topicIdx) {
    setUnits(prev => prev.map((u, i) => i === unitIdx
      ? { ...u, topics: u.topics.filter((_, j) => j !== topicIdx) }
      : u
    ))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (planLoading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando plan curricular…</div>
  }

  const totalTopics = units.reduce((s, u) => s + (u.topics?.length || 0), 0)
  const totalEstWeeks = units.slice(0, unitsTarget).reduce((s, u) => s + (u.estimated_weeks || 0), 0)

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', minHeight: 0 }}>

      {/* ── Panel izquierdo: configuración ──────────────────────────────────── */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Fuente de la malla */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e6f0', padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', marginBottom: 10 }}>📄 Malla Curricular</div>
          <select
            value={selectedDocId}
            onChange={e => setSelectedDocId(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, marginBottom: 8 }}
          >
            <option value="">— Sin documento —</option>
            {libraryDocs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
          {selectedDocId && (
            <button onClick={handleParseLibrary} disabled={parsing}
              style={{ width: '100%', padding: '8px 0', background: '#f0f4ff', border: '1px solid #c5d5f0', borderRadius: 8, fontSize: 13, color: '#2E5598', fontWeight: 600, cursor: 'pointer' }}>
              {parsing ? '⏳ Analizando…' : '🤖 Parsear malla con IA'}
            </button>
          )}
          {!libraryDocs.length && (
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>Sube la malla curricular a la Biblioteca para seleccionarla aquí.</p>
          )}
        </div>

        {/* Parámetros */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e6f0', padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', marginBottom: 12 }}>⚙️ Parámetros</div>

          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
            Unidades a cubrir este período
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="number" min={1} max={units.length || 10}
              value={unitsTarget}
              onChange={e => setUnitsTarget(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 60, padding: '7px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 14, fontWeight: 700, color: pc.accent, textAlign: 'center' }}
            />
            <span style={{ fontSize: 13, color: '#888' }}>
              de {units.length} unidade{units.length !== 1 ? 's' : ''} — ≈{totalEstWeeks} semanas estimadas
            </span>
          </div>

          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>
            Semanas hábiles del período
          </label>
          <div style={{ fontSize: 13, fontWeight: 700, color: workingWeeks.length ? '#16a34a' : '#aaa' }}>
            {workingWeeks.length
              ? `${workingWeeks.length} semanas disponibles`
              : periodConfig ? 'Calculando…' : '⚠️ Configura las fechas del período en Calendario Académico'}
          </div>
          {workingWeeks.length > 0 && noClassDates.length > 0 && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {noClassDates.length} día(s) sin clase excluido(s)
            </div>
          )}
        </div>

        {/* Slots recurrentes */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e6f0', padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', marginBottom: 10 }}>🔁 Actividades Fijas</div>
          <p style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
            Asigna actividades recurrentes a días específicos de la semana.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DAY_KEYS.map(day => {
              const s = slots[day]
              const st = SLOT_TYPES.find(t => t.value === s?.type)
              return (
                <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: '#555' }}>{DAY_LABELS[day]}</div>
                  {s ? (
                    <div style={{
                      flex: 1, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: st?.color + '20', color: st?.color, border: `1px solid ${st?.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span>{st?.icon} {s.label || st?.label}</span>
                      <button onClick={() => setSlots(prev => { const n = { ...prev }; delete n[day]; return n })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 14, lineHeight: 1 }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setSlotPickerDay(day)}
                      style={{ flex: 1, padding: '5px 10px', borderRadius: 8, fontSize: 12, color: '#aaa', border: '1px dashed #d0d8e8', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      + Agregar actividad
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={handleSaveConfig} disabled={saving}
            style={{ padding: '10px 0', background: pc.accent, color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {saving ? '⏳ Guardando…' : '💾 Guardar configuración'}
          </button>
          <button onClick={handleDistribute} disabled={distributing || !units.length || !workingWeeks.length}
            style={{ padding: '10px 0', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: distributing || !units.length ? 'not-allowed' : 'pointer', opacity: (!units.length || !workingWeeks.length) ? 0.5 : 1 }}>
            {distributing ? '⏳ Distribuyendo…' : '🤖 Distribuir con IA'}
          </button>
          {distribution.length > 0 && (
            <button onClick={handlePublish} disabled={publishing}
              style={{ padding: '10px 0', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              {publishing ? '⏳ Publicando…' : `📤 Publicar en Syllabus (${distribution.length} semanas)`}
            </button>
          )}
        </div>
      </div>

      {/* ── Panel derecho: Unidades + Distribución ──────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Editor de unidades */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e6f0', padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864' }}>
              📐 Unidades ({units.length}) — {totalTopics} tema{totalTopics !== 1 ? 's' : ''} en total
            </div>
            <button onClick={addUnit}
              style={{ padding: '6px 14px', background: pc.light, color: pc.accent, border: `1px solid ${pc.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Unidad
            </button>
          </div>

          {units.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#aaa', fontSize: 13 }}>
              Parsea la malla con IA o agrega unidades manualmente.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {units.map((unit, idx) => (
              <UnitEditor key={idx} unit={unit} idx={idx}
                isEditing={editingUnit === idx}
                onToggleEdit={() => setEditingUnit(editingUnit === idx ? null : idx)}
                onUpdate={(f, v) => updateUnit(idx, f, v)}
                onRemove={() => removeUnit(idx)}
                onAddTopic={() => addTopicToUnit(idx)}
                onUpdateTopic={(ti, f, v) => updateUnitTopic(idx, ti, f, v)}
                onRemoveTopic={(ti) => removeUnitTopic(idx, ti)}
                isTarget={idx < unitsTarget}
                pc={pc}
              />
            ))}
          </div>
        </div>

        {/* Vista de distribución */}
        {distribution.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e6f0', padding: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1F3864', marginBottom: 12 }}>
              📅 Distribución curricular — {distribution.length} semana{distribution.length !== 1 ? 's' : ''}
            </div>
            <DistributionGrid distribution={distribution} slots={slots} />
          </div>
        )}

        {!distribution.length && units.length > 0 && workingWeeks.length > 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa', background: '#fff', borderRadius: 12, border: '1px dashed #d0d8e8' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#888' }}>
              Configura las unidades y los slots fijos, luego presiona "Distribuir con IA"
            </div>
            <div style={{ fontSize: 12, marginTop: 4, color: '#aaa' }}>
              La IA generará un cronograma para {workingWeeks.length} semana{workingWeeks.length !== 1 ? 's' : ''} hábiles del período
            </div>
          </div>
        )}
      </div>

      {/* ── Slot picker modal ─────────────────────────────────────────────────── */}
      {slotPickerDay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setSlotPickerDay(null)}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 24, width: 320, boxShadow: '0 8px 40px rgba(0,0,0,.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1F3864', marginBottom: 4 }}>
              Actividad fija — {DAY_FULL[slotPickerDay]}
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>
              Elige el tipo de actividad para este día cada semana:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SLOT_TYPES.map(st => (
                <button key={st.value}
                  onClick={() => {
                    setSlots(prev => ({ ...prev, [slotPickerDay]: { type: st.value, label: st.label } }))
                    setSlotPickerDay(null)
                  }}
                  style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${st.color}40`, background: st.color + '10', color: st.color, fontWeight: 600, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
                  {st.icon} {st.label}
                </button>
              ))}
            </div>
            <button onClick={() => setSlotPickerDay(null)}
              style={{ width: '100%', marginTop: 12, padding: '9px 0', background: '#f4f6fb', border: 'none', borderRadius: 8, color: '#888', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── UnitEditor ────────────────────────────────────────────────────────────────
const CT_OPTIONS = [
  { v: 'grammar',    l: 'Gramática'   },
  { v: 'vocabulary', l: 'Vocabulario' },
  { v: 'skill',      l: 'Habilidad'   },
  { v: 'reading',    l: 'Reading'     },
  { v: 'value',      l: 'Valor'       },
  { v: 'concept',    l: 'Concepto'    },
]

function UnitEditor({ unit, idx, isEditing, isTarget, onToggleEdit, onUpdate, onRemove, onAddTopic, onUpdateTopic, onRemoveTopic, pc }) {
  return (
    <div style={{ border: `1px solid ${isTarget ? pc.border : '#e8ecf4'}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: isTarget ? pc.light : '#f8f9fc',
        cursor: 'pointer',
      }} onClick={onToggleEdit}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isTarget ? pc.accent : '#aaa', color: '#fff', fontSize: 12, fontWeight: 700,
        }}>
          {unit.number}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: isTarget ? pc.accent : '#666' }}>
            {unit.title || <span style={{ color: '#aaa', fontStyle: 'italic' }}>Sin título</span>}
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            {(unit.topics || []).length} tema{(unit.topics || []).length !== 1 ? 's' : ''} · ≈{unit.estimated_weeks || 0} semanas
            {!isTarget && <span style={{ color: '#dc2626' }}> · no incluida en este período</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 18, color: '#ccc' }}>{isEditing ? '▲' : '▼'}</span>
          <button type="button" onClick={e => { e.stopPropagation(); onRemove() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1 }}>✕</button>
        </div>
      </div>

      {/* Body (editable) */}
      {isEditing && (
        <div style={{ padding: 14, background: '#fff', borderTop: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Título de la unidad</label>
              <input value={unit.title} onChange={e => onUpdate('title', e.target.value)}
                placeholder="Unit 1: Present Simple"
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ width: 90 }}>
              <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 3 }}>Semanas est.</label>
              <input type="number" min={1} max={20} value={unit.estimated_weeks || 1}
                onChange={e => onUpdate('estimated_weeks', parseInt(e.target.value) || 1)}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, textAlign: 'center' }}
              />
            </div>
          </div>
          <textarea value={unit.description || ''} onChange={e => onUpdate('description', e.target.value)}
            placeholder="Descripción general de la unidad (opcional)…"
            rows={2}
            style={{ width: '100%', padding: '7px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', marginBottom: 12 }}
          />

          {/* Temas */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>Temas</div>
          {(unit.topics || []).map((t, ti) => (
            <div key={ti} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
              <input value={t.title} onChange={e => onUpdateTopic(ti, 'title', e.target.value)}
                placeholder="Título del tema"
                style={{ flex: 1, padding: '6px 8px', border: '1px solid #d0d8e8', borderRadius: 7, fontSize: 12 }}
              />
              <select value={t.content_type || 'concept'} onChange={e => onUpdateTopic(ti, 'content_type', e.target.value)}
                style={{ width: 100, padding: '6px 8px', border: '1px solid #d0d8e8', borderRadius: 7, fontSize: 12 }}>
                {CT_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <input type="number" min={1} max={10} value={t.estimated_classes || 1}
                onChange={e => onUpdateTopic(ti, 'estimated_classes', parseInt(e.target.value) || 1)}
                title="Clases estimadas"
                style={{ width: 44, padding: '6px 6px', border: '1px solid #d0d8e8', borderRadius: 7, fontSize: 12, textAlign: 'center' }}
              />
              <button type="button" onClick={() => onRemoveTopic(ti)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, lineHeight: 1, paddingTop: 6 }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={onAddTopic}
            style={{ padding: '6px 12px', background: '#f4f6fb', border: '1px dashed #d0d8e8', borderRadius: 7, fontSize: 12, color: '#666', cursor: 'pointer' }}>
            + Agregar tema
          </button>
        </div>
      )}
    </div>
  )
}

// ── DistributionGrid ──────────────────────────────────────────────────────────
function DistributionGrid({ distribution, slots }) {
  const CT_ICONS = {
    grammar: '📐', vocabulary: '📚', skill: '⚒️', reading: '📖',
    value: '❤️', concept: '💡', review: '🔄', other: '📎',
  }
  const SLOT_ICONS = { reading: '📖', skill: '⚒️', vocab_review: '📚', project: '🏗️', custom: '✏️' }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 600, width: '100%' }}>
        <thead>
          <tr style={{ background: '#f4f6fb' }}>
            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: '#555', width: 70, borderBottom: '2px solid #e0e6f0' }}>
              Semana
            </th>
            {DAY_KEYS.map(d => (
              <th key={d} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: slots[d] ? '#2563eb' : '#555', borderBottom: '2px solid #e0e6f0', minWidth: 140 }}>
                {DAY_LABELS[d]} {slots[d] ? `· ${SLOT_ICONS[slots[d].type] || ''} ${slots[d].label || slots[d].type}` : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {distribution.map((wk, wi) => (
            <tr key={wi} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '8px 12px', fontWeight: 700, color: '#888', fontSize: 11, verticalAlign: 'top' }}>
                Sem. {wk.week}
              </td>
              {DAY_KEYS.map(day => {
                const cell = wk.days?.[day]
                if (!cell) return <td key={day} style={{ padding: '8px 12px', verticalAlign: 'top', color: '#ccc', fontSize: 11 }}>—</td>
                const isSlot = !!slots[day]
                const col = isSlot ? '#2563eb' : ctColor(cell.content_type)
                return (
                  <td key={day} style={{ padding: '6px 12px', verticalAlign: 'top' }}>
                    <div style={{
                      padding: '6px 8px', borderRadius: 7,
                      background: col + '10',
                      border: `1px solid ${col}30`,
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: col, marginBottom: 2 }}>
                        {isSlot ? (SLOT_ICONS[slots[day].type] || '') : (CT_ICONS[cell.content_type] || '📎')}
                        {' '}{cell.content_type || cell.type}
                        {cell.unit ? ` · U${cell.unit}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#333', lineHeight: 1.3 }}>
                        {cell.topic}
                      </div>
                      {cell.description && (
                        <div style={{ fontSize: 11, color: '#888', marginTop: 3, lineHeight: 1.3 }}>
                          {cell.description.slice(0, 80)}{cell.description.length > 80 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
