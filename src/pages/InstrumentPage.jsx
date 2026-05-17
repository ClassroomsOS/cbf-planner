import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { generateTeacherInstrument } from '../utils/guideAI'
import { logError, logActivity } from '../utils/logger'
import { MODELO_B_SUBJECTS } from '../utils/constants'

// ── Constants ──────────────────────────────────────────────────────────────────
const GROUP_STATES = [
  { id: 'present',   emoji: '●', label: 'Presentes',   sub: 'Atentos, llegaron bien',            color: '#4CAF50' },
  { id: 'scattered', emoji: '◌', label: 'Dispersos',   sub: 'Inquietos, distraídos',             color: '#C9A84C' },
  { id: 'down',      emoji: '○', label: 'Caídos',      sub: 'Cabezas bajas, monosílabos',        color: '#7B9CC9' },
  { id: 'electric',  emoji: '◎', label: 'Eléctricos',  sub: 'Sobreexcitados, algo pasó',         color: '#E07B4F' },
  { id: 'anxious',   emoji: '◑', label: 'Ansiosos',    sub: 'Tensión visible, evaluación cerca', color: '#B87BC8' },
]

const IMS_OPTIONS = [
  { tag: 'S 1–2', desc: 'Exposición · Muy guiado · Individual' },
  { tag: 'S 3–5', desc: 'Conexión · Guiado · Parejas' },
  { tag: 'S 6–8', desc: 'Aplicación · Semi-autónomo · Equipos' },
  { tag: 'S 9–10', desc: 'Producción · Autónomo · Comunidad' },
]

function parseSteps(arr) {
  if (!arr) return []
  if (Array.isArray(arr)) return arr.map(s => String(s).replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean)
  return String(arr).split('\n').map(l => l.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean)
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function InstrumentPage({ teacher }) {
  const { planId } = useParams()
  const navigate = useNavigate()

  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  // Config state
  const [groupState, setGroupState] = useState(null)
  const [imsIndex, setImsIndex] = useState(null)
  const [dayKey, setDayKey] = useState('')

  // Result
  const [instrument, setInstrument] = useState(null)
  const [savedId, setSavedId] = useState(null)

  // Load plan data
  useEffect(() => {
    if (!planId) { setLoading(false); return }
    ;(async () => {
      const { data, error: err } = await supabase
        .from('lesson_plans')
        .select('id, grade, subject, section, period, week_number, content, indicator_id, news_project_id')
        .eq('id', planId)
        .single()
      if (err) { logError(err, { page: 'InstrumentPage', action: 'loadPlan' }); setError('No se pudo cargar la guía.'); setLoading(false); return }
      setPlan(data)

      // Check for existing instrument
      const { data: existing } = await supabase
        .from('teacher_instruments')
        .select('id, group_state, ims_index, day_key, generated_json')
        .eq('plan_id', planId)
        .eq('teacher_id', teacher.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing) {
        setGroupState(existing.group_state)
        setImsIndex(existing.ims_index)
        setDayKey(existing.day_key || '')
        setInstrument(existing.generated_json)
        setSavedId(existing.id)
      }

      setLoading(false)
    })()
  }, [planId, teacher.id])

  // Get active days from plan content
  const activeDays = plan?.content?.days
    ? Object.entries(plan.content.days)
      .filter(([, d]) => d.active !== false)
      .map(([key]) => key)
      .sort()
    : []

  // Extract context from the selected day in the guide
  function buildGuideContext() {
    if (!plan?.content?.days || !dayKey) return ''
    const day = plan.content.days[dayKey]
    if (!day) return ''
    const parts = []
    if (day.unit) parts.push(`Unit/Topic: ${day.unit}`)
    const sections = day.sections || {}
    Object.entries(sections).forEach(([key, sec]) => {
      if (sec.content) parts.push(`[${key}]: ${sec.content.replace(/<[^>]+>/g, '').slice(0, 200)}`)
    })
    return parts.join('\n')
  }

  // Get verse from plan content
  const planVerse = plan?.content?.verse?.text?.replace(/<[^>]+>/g, '') || ''
  const planVerseRef = plan?.content?.verse?.ref || ''
  const planObjective = plan?.content?.objetivo?.general || ''

  async function handleGenerate() {
    if (groupState === null || imsIndex === null) return
    setGenerating(true)
    setError(null)

    try {
      const result = await generateTeacherInstrument({
        subject: plan.subject,
        skill: dayKey && plan.content?.days?.[dayKey]?.unit ? plan.content.days[dayKey].unit : plan.subject,
        verse: planVerse,
        verseRef: planVerseRef,
        objective: planObjective,
        evidence: '',
        groupState,
        imsIndex,
        guideContext: buildGuideContext(),
      })

      setInstrument(result)

      // Save to DB
      const payload = {
        plan_id: planId,
        teacher_id: teacher.id,
        school_id: teacher.school_id,
        group_state: groupState,
        ims_index: imsIndex,
        day_key: dayKey || null,
        subject: plan.subject,
        skill: dayKey && plan.content?.days?.[dayKey]?.unit ? plan.content.days[dayKey].unit : plan.subject,
        verse: planVerse,
        verse_ref: planVerseRef,
        objective: planObjective,
        generated_json: result,
      }

      if (savedId) {
        await supabase.from('teacher_instruments').update(payload).eq('id', savedId)
      } else {
        const { data: ins } = await supabase.from('teacher_instruments').insert(payload).select('id').single()
        if (ins) setSavedId(ins.id)
      }

      logActivity('create', 'teacher_instruments', savedId || 'new', `Generó instrumento: ${plan.subject} · ${plan.grade}`)
    } catch (e) {
      setError(e.message || 'Error al generar el instrumento.')
      logError(e, { page: 'InstrumentPage', action: 'generateInstrument' })
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <div className="ins-loading"><div className="loading-spinner" /> Cargando...</div>
  if (!plan) return <div className="ins-error">No se encontró la guía.</div>

  return (
    <div className="ins-wrap">
      {/* Header */}
      <div className="ins-header">
        <button className="ins-back" onClick={() => navigate(`/editor/${planId}`)}>← Volver a la guía</button>
        <div className="ins-header-content">
          <div className="ins-header-icon">🎯</div>
          <div>
            <div className="ins-header-title">Instrumento Docente</div>
            <div className="ins-header-sub">{plan.grade} · {plan.subject} · Semana {plan.week_number}</div>
          </div>
        </div>
      </div>

      <div className="ins-body">
        {/* Config Panel */}
        <div className="ins-config">
          {/* Day selector */}
          {activeDays.length > 0 && (
            <div className="ins-field">
              <label className="ins-label">Jornada</label>
              <select value={dayKey} onChange={e => setDayKey(e.target.value)} className="ins-select">
                <option value="">— Toda la semana —</option>
                {activeDays.map(dk => (
                  <option key={dk} value={dk}>
                    {new Date(dk + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group state */}
          <div className="ins-field">
            <label className="ins-label">Estado del grupo hoy</label>
            <div className="ins-states-grid">
              {GROUP_STATES.map(s => (
                <button key={s.id}
                  className={`ins-state-btn ${groupState === s.id ? 'active' : ''}`}
                  style={{ '--state-color': s.color }}
                  onClick={() => setGroupState(s.id)}>
                  <span className="ins-state-emoji">{s.emoji}</span>
                  <span className="ins-state-label">{s.label}</span>
                  <span className="ins-state-sub">{s.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* IMS */}
          <div className="ins-field">
            <label className="ins-label">Semana del periodo (IMS)</label>
            <div className="ins-ims-grid">
              {IMS_OPTIONS.map((w, i) => (
                <button key={i}
                  className={`ins-ims-btn ${imsIndex === i ? 'active' : ''}`}
                  onClick={() => setImsIndex(i)}>
                  <span className="ins-ims-tag">{w.tag}</span>
                  <span className="ins-ims-desc">{w.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            className="ins-generate-btn"
            onClick={handleGenerate}
            disabled={groupState === null || imsIndex === null || generating}>
            {generating ? <><span className="cbf-spin-inline"/>Generando instrumento...</> : instrument ? '🔄 Regenerar instrumento' : '🎯 Generar instrumento'}
          </button>

          {error && <div className="ins-error-msg">{error}</div>}
        </div>

        {/* Result */}
        {instrument && !generating && (
          <InstrumentViewer
            data={instrument}
            groupState={GROUP_STATES.find(s => s.id === groupState)}
            imsIndex={imsIndex}
            verse={planVerse}
            verseRef={planVerseRef}
          />
        )}

        {generating && (
          <div className="ins-generating">
            <div className="loading-spinner" />
            <span>Diseñando el instrumento de sesión...</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── InstrumentViewer ──────────────────────────────────────────────────────────
function InstrumentViewer({ data, groupState, imsIndex, verse, verseRef }) {
  return (
    <div className="ins-result">
      {/* Title */}
      <div className="ins-result-header">
        <h2 className="ins-result-title">{data.session_title}</h2>
        <div className="ins-result-badges">
          {groupState && (
            <span className="ins-badge" style={{ borderColor: groupState.color, color: groupState.color }}>
              {groupState.emoji} {groupState.label}
            </span>
          )}
          <span className="ins-badge ins-badge-ims">{IMS_OPTIONS[imsIndex]?.tag}</span>
        </div>
      </div>

      {/* Guide connection */}
      {data.guide_connection && (
        <div className="ins-connection">{data.guide_connection}</div>
      )}

      {/* Anchor */}
      <div className="ins-anchor">
        <div className="ins-anchor-label">ANCLA — si solo haces esto, la clase tiene valor</div>
        <div className="ins-anchor-text">{data.anchor}</div>
        {data.anchor_note && <div className="ins-anchor-note">{data.anchor_note}</div>}
      </div>

      {/* Opening */}
      {data.opening && (
        <div className="ins-section ins-opening">
          <div className="ins-section-head">
            <span className="ins-section-icon">✦</span>
            <span>Apertura institucional</span>
            <span className="ins-section-badge">Fijo · No omitir</span>
          </div>
          {verse && (
            <div className="ins-verse-block">
              <div className="ins-verse-ref">{verseRef}</div>
              <div className="ins-verse-text">"{verse}"</div>
            </div>
          )}
          <div className="ins-opening-items">
            {[
              { roman: 'I', title: 'Oración', text: data.opening.prayer_prompt },
              { roman: 'II', title: 'Versículo del indicador', text: data.opening.verse_instruction },
              { roman: 'III', title: 'Reglas de la clase', text: data.opening.rules_focus },
              { roman: 'IV', title: 'Objetivo e indicador', text: data.opening.objective_statement },
            ].map((item, i) => (
              <div key={i} className="ins-opening-item">
                <span className="ins-opening-roman">{item.roman}</span>
                <div>
                  <div className="ins-opening-title">{item.title}</div>
                  <div className="ins-opening-text">{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recalling open */}
      <RecallingSection title="Recalling inicial" icon="↺" data={data.recalling_open} />

      {/* Phases */}
      <PhaseSection title="Pre-desarrollo" limit="≤ 17 min" data={data.pre} />
      <PhaseSection title="Desarrollo de la habilidad" limit="≤ 20 min" data={data.dev} />
      <PhaseSection title="Cierre" limit="≤ 10 min" data={data.close} />

      {/* Recalling close */}
      <RecallingSection title="Recalling de cierre" icon="↻" data={data.recalling_close} />

      {/* Preacher close */}
      {data.preacher_close && (
        <div className="ins-section ins-preacher">
          <div className="ins-section-head ins-preacher-head">
            <span className="ins-section-icon">✦</span>
            <span>Cierre tipo predicador</span>
            <span className="ins-section-badge">No omitir</span>
          </div>
          {data.preacher_close.bridge && (
            <div className="ins-preacher-bridge">
              <div className="ins-preacher-bridge-label">El puente</div>
              <div className="ins-preacher-bridge-text">{data.preacher_close.bridge}</div>
            </div>
          )}
          <StepsList steps={data.preacher_close.steps} className="ins-preacher-steps" />
          {data.preacher_close.declaration && (
            <div className="ins-declaration">
              <div className="ins-declaration-label">Declaración final — dila en voz alta</div>
              <div className="ins-declaration-text">"{data.preacher_close.declaration}"</div>
            </div>
          )}
        </div>
      )}

      {/* Minimal route */}
      {data.minimal_route && (
        <div className="ins-section ins-minimal">
          <div className="ins-minimal-label">Ruta mínima — si el día colapsa (≤ 15 min)</div>
          <div className="ins-minimal-list">
            {data.minimal_route.map((s, i) => (
              <div key={i} className="ins-minimal-step">
                <span className="ins-minimal-num">{i + 1}.</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StepsList({ steps, className = '' }) {
  const list = parseSteps(steps)
  return (
    <div className={`ins-steps ${className}`}>
      {list.map((s, i) => (
        <div key={i} className="ins-step">
          <span className="ins-step-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="ins-step-text">{s}</span>
        </div>
      ))}
    </div>
  )
}

function PhaseSection({ title, limit, data }) {
  const [tab, setTab] = useState('A')
  if (!data?.options) return null
  return (
    <div className="ins-section ins-phase">
      <div className="ins-phase-header">
        <span className="ins-phase-title">{title}</span>
        <span className="ins-phase-limit">{limit}</span>
      </div>
      <div className="ins-phase-tabs">
        {Object.entries(data.options).map(([k, v]) => (
          <button key={k}
            className={`ins-phase-tab ${tab === k ? 'active' : ''}`}
            onClick={() => setTab(k)}>
            {k} — {v.label}
          </button>
        ))}
      </div>
      <StepsList steps={data.options[tab]?.steps} key={tab} />
    </div>
  )
}

function RecallingSection({ title, icon, data }) {
  if (!data) return null
  return (
    <div className="ins-section ins-recalling">
      <div className="ins-section-head">
        <span className="ins-section-icon">{icon}</span>
        <span>{title}</span>
        <span className="ins-section-duration">{data.duration}</span>
      </div>
      <StepsList steps={data.steps} />
    </div>
  )
}
