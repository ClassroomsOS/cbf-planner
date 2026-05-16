// ── BlockEditor.jsx ───────────────────────────────────────────────────────────
// The core block-based authoring canvas.
//
// Renders the list of blocks for a section, with:
//   • A block card per block (collapsible, with type header + form)
//   • An "Add block" picker showing available blocks for this section/phase
//   • Reorder (up/down) and delete per block
//   • For Momento 4 (skill): renders the I DO / WE DO / YOU DO scaffold structure
//
// Integration: DayPanel mounts BlockEditor when section.blocks is active.
// Backward compat: if section has no blocks, DayPanel still shows RichEditor.

import { useState } from 'react'
import { createPortal }                 from 'react-dom'
import { BLOCK_TYPES, createBlock, createScaffoldBlock } from '../../utils/blockSchema'
import { ACTIVITY_PATTERNS }            from '../../utils/activityPatterns'
import PatternPicker                    from './PatternPicker'
import ExplanationForm                  from './blocks/ExplanationForm'
import ProcedureForm                    from './blocks/ProcedureForm'
import ModelForm                        from './blocks/ModelForm'
import QuestionForm                     from './blocks/QuestionForm'
import TeacherNoteForm                  from './blocks/TeacherNoteForm'
import PatternForm                      from './blocks/PatternForm'
import VocabForm                        from './blocks/VocabForm'
import ExitTicketForm                   from './blocks/ExitTicketForm'
import HomeworkForm                     from './blocks/HomeworkForm'

// ── Block type metadata ───────────────────────────────────────────────────────
const BLOCK_META = {
  [BLOCK_TYPES.EXPLANATION]:  { icon: '💡', label: 'Explicación',         color: '#1B3564' },
  [BLOCK_TYPES.PROCEDURE]:    { icon: '📋', label: 'Procedimiento',        color: '#7c3aed' },
  [BLOCK_TYPES.MODEL]:        { icon: '📄', label: 'Texto Modelo',         color: '#0891B2' },
  [BLOCK_TYPES.QUESTION]:     { icon: '❓', label: 'Pregunta Guía',        color: '#B45309' },
  [BLOCK_TYPES.TEACHER_NOTE]: { icon: '🔒', label: 'Nota del Docente',     color: '#717A9B' },
  [BLOCK_TYPES.PATTERN]:      { icon: '🔄', label: 'Patrón de Actividad',  color: '#16A34A' },
  [BLOCK_TYPES.VOCAB]:        { icon: '🔤', label: 'Vocabulario',           color: '#C0504D' },
  [BLOCK_TYPES.EXIT_TICKET]:  { icon: '✅', label: 'Exit Ticket',          color: '#9BBB59' },
  [BLOCK_TYPES.HOMEWORK]:     { icon: '📚', label: 'Tarea',                color: '#4BACC6' },
  [BLOCK_TYPES.RICH_TEXT]:    { icon: '📝', label: 'Texto Libre',          color: '#9BA3BE' },
}

// Default data for new blocks
const BLOCK_DEFAULTS = {
  [BLOCK_TYPES.EXPLANATION]:  { text: '', grammarTarget: '', highlightTerms: [] },
  [BLOCK_TYPES.PROCEDURE]:    { steps: [{ action: 'do', text: '' }], context: '' },
  [BLOCK_TYPES.MODEL]:        { text: '', label: 'Model', grammarTarget: '', source: '' },
  [BLOCK_TYPES.QUESTION]:     { text: '', subtype: 'discussion', guidance: '' },
  [BLOCK_TYPES.TEACHER_NOTE]: { text: '', priority: 'normal' },
  [BLOCK_TYPES.PATTERN]:      { patternId: null, context: '', inputs: {}, duration: null },
  [BLOCK_TYPES.VOCAB]:        { terms: [{ word: '', definition: '', example: '', pronunciation: '' }], displayMode: 'cards', heading: '' },
  [BLOCK_TYPES.EXIT_TICKET]:  { question: '', responseType: 'written', options: [], collectMethod: 'notebook' },
  [BLOCK_TYPES.HOMEWORK]:     { instruction: '', platform: '', platformUrl: '', timeEstimate: null, dueLabel: '', parentNote: '' },
  [BLOCK_TYPES.RICH_TEXT]:    { html: '' },
}

// ── Momento-aware block catalog ───────────────────────────────────────────────
// Maps section key → available block types for the picker.
// For scaffold phases, the inner PHASE_BLOCKS map is used instead.
const SECTION_BLOCKS = {
  'subject':    [BLOCK_TYPES.VOCAB,  BLOCK_TYPES.QUESTION, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
  'motivation': [BLOCK_TYPES.QUESTION, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
  'activity':   [BLOCK_TYPES.PATTERN, BLOCK_TYPES.QUESTION, BLOCK_TYPES.PROCEDURE, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
  'skill':      [BLOCK_TYPES.EXPLANATION, BLOCK_TYPES.PROCEDURE, BLOCK_TYPES.MODEL, BLOCK_TYPES.QUESTION, BLOCK_TYPES.PATTERN, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
  'closing':    [BLOCK_TYPES.EXIT_TICKET, BLOCK_TYPES.QUESTION, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
  'assignment': [BLOCK_TYPES.HOMEWORK, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
}

// Scaffold phase blocks (nested inside the SKILL scaffold)
const PHASE_BLOCKS = {
  'i-do':   [BLOCK_TYPES.EXPLANATION, BLOCK_TYPES.MODEL, BLOCK_TYPES.QUESTION, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
  'we-do':  [BLOCK_TYPES.PATTERN, BLOCK_TYPES.QUESTION, BLOCK_TYPES.PROCEDURE, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
  'you-do': [BLOCK_TYPES.PROCEDURE, BLOCK_TYPES.QUESTION, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
  null:     [BLOCK_TYPES.EXPLANATION, BLOCK_TYPES.PROCEDURE, BLOCK_TYPES.QUESTION, BLOCK_TYPES.MODEL, BLOCK_TYPES.PATTERN, BLOCK_TYPES.TEACHER_NOTE, BLOCK_TYPES.RICH_TEXT],
}

// ── Momento contextual hints ──────────────────────────────────────────────────
const MOMENTO_HINTS = {
  subject: {
    icon: '🎒',
    label: 'ENCUENTRO · Vocabulary List',
    color: '#C0504D',
    tip: 'Agrega los términos del día. ClassroomOS los proyecta como tarjetas grandes para pronunciación en coro. Recomendado: 6–10 términos.',
    suggestedFirst: BLOCK_TYPES.VOCAB,
  },
  motivation: {
    icon: '📋',
    label: 'TEMA DEL DÍA',
    color: '#4F81BD',
    tip: 'El tablero (fecha, tema, logro, principio) se actualiza automáticamente desde el Syllabus. Agrega notas de transición o instrucciones de organización del aula.',
    suggestedFirst: BLOCK_TYPES.TEACHER_NOTE,
  },
  activity: {
    icon: '🔥',
    label: 'MOTIVACIÓN',
    color: '#F79646',
    tip: 'Activa saberes previos. Los Patrones de Activación (Hook, KWL, brainstorm) funcionan aquí. Conecta con la clase anterior. Tiempo: ~10 min.',
    suggestedFirst: BLOCK_TYPES.PATTERN,
  },
  skill: {
    icon: '🎯',
    label: 'DESARROLLO DE HABILIDADES',
    color: '#8064A2',
    tip: 'Estructura I DO → WE DO → YOU DO. Usa el scaffold para que ClassroomOS muestre las tres fases con claridad. El estudiante produce un producto concreto.',
    suggestedFirst: null,
  },
  closing: {
    icon: '✅',
    label: 'CIERRE Y REFLEXIÓN',
    color: '#9BBB59',
    tip: 'Verifica comprensión. Un Exit Ticket + pregunta de reflexión bíblica es el cierre ideal. Tiempo: ~5 min.',
    suggestedFirst: BLOCK_TYPES.EXIT_TICKET,
  },
  assignment: {
    icon: '📚',
    label: 'TAREA / ASSIGNMENT',
    color: '#4BACC6',
    tip: 'Concreta y alcanzable. Incluye plataforma si aplica. Los padres ven esto en el reporte semanal. Tiempo: ~3 min.',
    suggestedFirst: BLOCK_TYPES.HOMEWORK,
  },
}

// ── RichText inline editor ────────────────────────────────────────────────────
function RichTextForm({ data, onChange }) {
  return (
    <div className="be-form">
      <div className="be-field-note" style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 6, padding: '6px 10px', fontSize: 11.5 }}>
        📝 Texto libre — considera usar un bloque específico para mejor rendering en ClassroomOS.
      </div>
      <div className="be-field">
        <label className="be-label">
          Contenido
          <span className="be-label-hint">Escribe libremente cuando ningún bloque específico describe lo que necesitas</span>
        </label>
        <textarea
          className="be-textarea"
          value={data.html || ''}
          onChange={e => onChange({ ...data, html: e.target.value })}
          placeholder="Escribe aquí libremente…"
          rows={6}
        />
      </div>
    </div>
  )
}

// ── Block form dispatcher ─────────────────────────────────────────────────────
function BlockForm({ block, onChange }) {
  const data = block.data || {}
  const up   = (d) => onChange({ ...block, data: d })

  switch (block.type) {
    case BLOCK_TYPES.EXPLANATION:  return <ExplanationForm  data={data} onChange={up} />
    case BLOCK_TYPES.PROCEDURE:    return <ProcedureForm    data={data} onChange={up} />
    case BLOCK_TYPES.MODEL:        return <ModelForm        data={data} onChange={up} />
    case BLOCK_TYPES.QUESTION:     return <QuestionForm     data={data} onChange={up} />
    case BLOCK_TYPES.TEACHER_NOTE: return <TeacherNoteForm  data={data} onChange={up} />
    case BLOCK_TYPES.PATTERN:      return <PatternForm      data={data} onChange={up} />
    case BLOCK_TYPES.VOCAB:        return <VocabForm        data={data} onChange={up} />
    case BLOCK_TYPES.EXIT_TICKET:  return <ExitTicketForm   data={data} onChange={up} />
    case BLOCK_TYPES.HOMEWORK:     return <HomeworkForm      data={data} onChange={up} />
    case BLOCK_TYPES.RICH_TEXT:    return <RichTextForm     data={data} onChange={up} />
    default:                       return <div className="be-form"><p style={{ color: '#888' }}>Formulario no disponible para tipo "{block.type}".</p></div>
  }
}

// ── BlockCard — a single collapsible block ────────────────────────────────────
function BlockCard({ block, idx, total, onUpdate, onRemove, onMove }) {
  const [open, setOpen] = useState(block.type === BLOCK_TYPES.PATTERN && !block.data?.patternId)
  const meta = BLOCK_META[block.type] || { icon: '📦', label: block.type, color: '#888' }

  return (
    <div className={`be-block-card ${block.type === BLOCK_TYPES.TEACHER_NOTE ? 'be-block-card--private' : ''}`}>
      {/* Card header */}
      <div
        className="be-block-header"
        style={{ '--block-color': meta.color }}
        onClick={() => setOpen(o => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(o => !o) }}
        aria-expanded={open}
      >
        <span
          className="be-block-type-badge"
          style={{ '--block-color': meta.color }}
        >
          <span className="be-block-type-icon">{meta.icon}</span>
          {meta.label}
        </span>

        {/* Inline summary when collapsed */}
        {!open && (
          <span className="be-block-summary">
            {getSummary(block)}
          </span>
        )}

        <div className="be-block-controls" onClick={e => e.stopPropagation()}>
          <button
            className="be-icon-btn"
            onClick={() => onMove(idx, -1)}
            disabled={idx === 0}
            title="Mover arriba"
            aria-label="Mover bloque arriba"
          >↑</button>
          <button
            className="be-icon-btn"
            onClick={() => onMove(idx, 1)}
            disabled={idx === total - 1}
            title="Mover abajo"
            aria-label="Mover bloque abajo"
          >↓</button>
          <button
            className="be-icon-btn be-icon-btn--danger"
            onClick={() => { if (window.confirm(`¿Eliminar este bloque de ${meta.label}?`)) onRemove(idx) }}
            title="Eliminar bloque"
            aria-label="Eliminar bloque"
          >✕</button>
          <span className="be-block-arrow">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Card body */}
      {open && (
        <div className="be-block-body">
          <BlockForm block={block} onChange={onUpdate} />

          {/* Emphasis selector */}
          <div className="be-emphasis-row">
            <span className="be-emphasis-label">Énfasis:</span>
            {['low', 'normal', 'high'].map(e => (
              <button
                key={e}
                type="button"
                className={`be-emphasis-btn ${(block.display?.emphasis || 'normal') === e ? 'active' : ''}`}
                onClick={() => onUpdate({ ...block, display: { ...block.display, emphasis: e } })}
              >
                {e === 'low' ? 'Secundario' : e === 'normal' ? 'Normal' : 'Destacado'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Scaffold (I DO / WE DO / YOU DO) ─────────────────────────────────────────
function ScaffoldBlock({ block, onUpdate }) {
  const phases  = block.data?.phases || []
  const [activePhase, setActivePhase] = useState(0)

  const PHASE_META = [
    { key: 'i-do',   label: 'I DO',   labelEs: 'Yo explico + Modelo', color: '#1B3564', bg: '#EEF3FA' },
    { key: 'we-do',  label: 'WE DO',  labelEs: 'Práctica guiada',    color: '#16A34A', bg: '#F0FDF4' },
    { key: 'you-do', label: 'YOU DO', labelEs: 'Producción propia',   color: '#7c3aed', bg: '#F5F3FF' },
  ]

  function updatePhaseBlocks(phaseIdx, newBlocks) {
    const newPhases = phases.map((p, i) => i === phaseIdx ? { ...p, blocks: newBlocks } : p)
    onUpdate({ ...block, data: { ...block.data, phases: newPhases } })
  }

  return (
    <div className="be-scaffold">
      {/* Phase tabs */}
      <div className="be-scaffold-tabs">
        {PHASE_META.map((meta, idx) => {
          const phase      = phases[idx]
          const blockCount = phase?.blocks?.length || 0
          const isEmpty    = blockCount === 0
          return (
            <button
              key={meta.key}
              className={`be-scaffold-tab ${activePhase === idx ? 'be-scaffold-tab--active' : ''}`}
              style={{ '--phase-color': meta.color, '--phase-bg': meta.bg }}
              onClick={() => setActivePhase(idx)}
            >
              <span className="be-scaffold-tab-phase">{meta.label}</span>
              <span style={{ fontSize: '11px', color: 'inherit', opacity: .75 }}>{meta.labelEs}</span>
              <span
                className={`be-scaffold-dot ${!isEmpty ? 'be-scaffold-dot--filled' : ''}`}
                title={isEmpty ? 'Fase vacía' : `${blockCount} bloque${blockCount !== 1 ? 's' : ''}`}
              />
            </button>
          )
        })}
      </div>

      {/* Active phase content */}
      {PHASE_META.map((meta, idx) => {
        if (activePhase !== idx) return null
        const phase = phases[idx] || { phase: meta.key, blocks: [] }
        return (
          <div key={meta.key} className="be-scaffold-phase" style={{ '--phase-color': meta.color }}>
            <BlockList
              blocks={phase.blocks || []}
              onChange={bl => updatePhaseBlocks(idx, bl)}
              phase={meta.key}
              phaseLabel={`${meta.label} · ${meta.labelEs}`}
            />
          </div>
        )
      })}
    </div>
  )
}

// ── MomentoHint — contextual guidance banner at top of each section ───────────
function MomentoHint({ sectionKey, blockCount }) {
  const [dismissed, setDismissed] = useState(false)
  const hint = MOMENTO_HINTS[sectionKey]
  if (!hint || dismissed || blockCount > 2) return null

  return (
    <div className="be-momento-hint" style={{ '--hint-color': hint.color }}>
      <div className="be-momento-hint-left">
        <span className="be-momento-hint-icon">{hint.icon}</span>
        <div>
          <span className="be-momento-hint-label">{hint.label}</span>
          <p className="be-momento-hint-tip">{hint.tip}</p>
        </div>
      </div>
      <button
        className="be-momento-hint-dismiss"
        onClick={() => setDismissed(true)}
        title="Cerrar sugerencia"
      >✕</button>
    </div>
  )
}

// ── ScaffoldCompleteness — phase status in scaffold tabs (helper) ─────────────
function phaseIsEmpty(phase) {
  return !phase?.blocks?.length
}

// ── BlockList — the actual list + add picker ──────────────────────────────────
function BlockList({ blocks, onChange, phase = null, phaseLabel = null, sectionKey = null }) {
  const [showPicker,   setShowPicker]   = useState(false)
  const [showPatterns, setShowPatterns] = useState(false)

  // Pick catalog: phase takes priority (inside scaffold), then section, then fallback
  const available = phase
    ? (PHASE_BLOCKS[phase] || PHASE_BLOCKS[null])
    : (SECTION_BLOCKS[sectionKey] || PHASE_BLOCKS[null])

  function addBlock(type) {
    if (type === BLOCK_TYPES.PATTERN) {
      // Pattern blocks open the PatternPicker immediately
      const newBlock = createBlock(type, BLOCK_DEFAULTS[type])
      onChange([...blocks, newBlock])
      setShowPicker(false)
      return
    }
    const newBlock = createBlock(type, BLOCK_DEFAULTS[type] || {})
    onChange([...blocks, newBlock])
    setShowPicker(false)
  }

  function updateBlock(idx, updated) {
    onChange(blocks.map((b, i) => i === idx ? updated : b))
  }

  function removeBlock(idx) {
    onChange(blocks.filter((_, i) => i !== idx))
  }

  function moveBlock(idx, dir) {
    const next   = [...blocks]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  return (
    <div className="be-block-list">
      {blocks.length === 0 && (phaseLabel || sectionKey) && (
        <div className="be-phase-empty">
          <p>Esta sección está vacía.</p>
          <p className="be-phase-empty-hint">
            {phase === 'i-do'   && 'Agrega una Explicación, Texto Modelo, o Pregunta Guía.'}
            {phase === 'we-do'  && 'Agrega un Patrón de Actividad para que los estudiantes practiquen juntos.'}
            {phase === 'you-do' && 'Agrega un Procedimiento o tarea de escritura guiada independiente.'}
            {!phase && sectionKey === 'subject'    && 'Comienza con un bloque de Vocabulario — es el corazón del ENCUENTRO.'}
            {!phase && sectionKey === 'motivation' && 'Agrega notas de transición o instrucciones de organización del aula.'}
            {!phase && sectionKey === 'activity'   && 'Un Patrón de Activación conecta con saberes previos y activa la motivación.'}
            {!phase && sectionKey === 'closing'    && 'Un Exit Ticket + reflexión bíblica es el cierre ideal.'}
            {!phase && sectionKey === 'assignment' && 'Define la tarea: instrucción clara, fecha de entrega, y plataforma si aplica.'}
          </p>
        </div>
      )}

      {blocks.map((block, idx) => (
        block.type === BLOCK_TYPES.SCAFFOLD
          ? <ScaffoldBlock key={block.id} block={block} onUpdate={b => updateBlock(idx, b)} />
          : <BlockCard
              key={block.id}
              block={block}
              idx={idx}
              total={blocks.length}
              onUpdate={b => updateBlock(idx, b)}
              onRemove={removeBlock}
              onMove={moveBlock}
            />
      ))}

      {/* Add block button */}
      {!showPicker ? (
        <button className="be-add-block-btn" onClick={() => setShowPicker(true)}>
          + Agregar bloque
          {phaseLabel && <span className="be-add-block-phase">{phaseLabel}</span>}
        </button>
      ) : (
        <div className="be-block-picker">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span className="be-picker-title">¿Qué tipo de bloque?</span>
            <button className="be-icon-btn" onClick={() => setShowPicker(false)}>✕</button>
          </div>
          <div className="be-picker-grid">
            {available.map(type => {
              const meta = BLOCK_META[type]
              if (!meta) return null
              return (
                <button
                  key={type}
                  className="be-picker-card"
                  onClick={() => addBlock(type)}
                >
                  <span className="be-picker-card-icon">{meta.icon}</span>
                  <span className="be-picker-card-label">{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Pattern picker portal */}
      {showPatterns && createPortal(
        <PatternPicker
          onSelect={p => {
            const newBlock = createBlock(BLOCK_TYPES.PATTERN, {
              patternId: p.id, context: '', inputs: {}, duration: p.duration?.typical || null,
            })
            onChange([...blocks, newBlock])
            setShowPatterns(false)
          }}
          onClose={() => setShowPatterns(false)}
          aiContext={{}}
        />,
        document.body
      )}
    </div>
  )
}

// ── Main BlockEditor ──────────────────────────────────────────────────────────
export default function BlockEditor({
  blocks     = [],
  onChange,
  sectionKey,        // 'subject' | 'motivation' | 'activity' | 'skill' | 'closing' | 'assignment'
  aiContext  = {},
}) {
  const isSkillSection = sectionKey === 'skill'
  const hasScaffold    = blocks.some(b => b.type === BLOCK_TYPES.SCAFFOLD)

  function initScaffold() {
    onChange([createScaffoldBlock()])
  }

  return (
    <div className="be-root">
      {/* Contextual momento hint */}
      <MomentoHint sectionKey={sectionKey} blockCount={blocks.length} />

      {/* Skill section: scaffold prompt */}
      {isSkillSection && !hasScaffold && blocks.length === 0 && (
        <div className="be-scaffold-prompt">
          <div className="be-scaffold-prompt-content">
            <span className="be-scaffold-prompt-icon">🎯</span>
            <div>
              <strong>Skill Development: I DO · WE DO · YOU DO</strong>
              <p>La estructura de andamiaje organiza tu clase en tres fases pedagógicas claras. ClassroomOS las muestra como etapas visuales distintas.</p>
            </div>
          </div>
          <div className="be-scaffold-prompt-actions">
            <button
              className="be-scaffold-prompt-btn be-scaffold-prompt-btn--primary"
              onClick={initScaffold}
            >
              Iniciar con estructura I DO · WE DO · YOU DO
            </button>
            <button
              className="be-scaffold-prompt-btn be-scaffold-prompt-btn--secondary"
              onClick={() => onChange([createBlock(BLOCK_TYPES.EXPLANATION, BLOCK_DEFAULTS[BLOCK_TYPES.EXPLANATION])])}
            >
              Empezar con bloques libres
            </button>
          </div>
        </div>
      )}

      {/* Block list */}
      <BlockList
        blocks={blocks}
        onChange={onChange}
        phase={null}
        sectionKey={sectionKey}
      />
    </div>
  )
}

// ── getSummary — one-line summary for collapsed block cards ───────────────────
function getSummary(block) {
  const d = block.data || {}
  switch (block.type) {
    case BLOCK_TYPES.EXPLANATION:  return truncate(d.text)
    case BLOCK_TYPES.PROCEDURE:    return `${d.steps?.length || 0} paso${d.steps?.length !== 1 ? 's' : ''}`
    case BLOCK_TYPES.MODEL:        return truncate(d.text)
    case BLOCK_TYPES.QUESTION:     return truncate(d.text)
    case BLOCK_TYPES.TEACHER_NOTE: return truncate(d.text)
    case BLOCK_TYPES.PATTERN: {
      const p = ACTIVITY_PATTERNS.find(x => x.id === d.patternId)
      return p ? `${p.icon} ${p.name.es}` : 'Sin patrón seleccionado'
    }
    case BLOCK_TYPES.VOCAB: {
      const count = d.terms?.length || 0
      const first = d.terms?.[0]?.word
      return first ? `${first}${count > 1 ? ` + ${count - 1} más` : ''}` : `${count} término${count !== 1 ? 's' : ''}`
    }
    case BLOCK_TYPES.EXIT_TICKET:  return truncate(d.question)
    case BLOCK_TYPES.HOMEWORK:     return truncate(d.instruction)
    case BLOCK_TYPES.RICH_TEXT:    return truncate(d.html?.replace(/<[^>]+>/g, ' '))
    default:                       return ''
  }
}

function truncate(str = '', max = 60) {
  if (!str) return ''
  const clean = str.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max) + '…' : clean
}
