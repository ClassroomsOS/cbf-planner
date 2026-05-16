// ── ProcedureForm.jsx ─────────────────────────────────────────────────────────
// Form for the `procedure` block type.
// Used for YOU DO phase: step-by-step instructions the student follows.
// Each step has an action icon + text. ClassroomOS renders as a visual timeline.

import { STEP_ACTIONS } from '../../../utils/blockSchema'

const ACTION_META = {
  listen:  { icon: '🎧', label: { es: 'Escuchar',  en: 'Listen'  } },
  read:    { icon: '📖', label: { es: 'Leer',      en: 'Read'    } },
  write:   { icon: '✏️', label: { es: 'Escribir',  en: 'Write'   } },
  speak:   { icon: '🎤', label: { es: 'Hablar',    en: 'Speak'   } },
  observe: { icon: '👁️', label: { es: 'Observar',  en: 'Observe' } },
  think:   { icon: '💭', label: { es: 'Reflexionar', en: 'Think'  } },
  do:      { icon: '🛠️', label: { es: 'Hacer',     en: 'Do'      } },
  check:   { icon: '✅', label: { es: 'Verificar', en: 'Check'   } },
}

export default function ProcedureForm({ data, onChange }) {
  const steps   = data.steps   || [{ action: 'do', text: '' }]
  const context = data.context || ''

  function addStep() {
    onChange({ ...data, steps: [...steps, { action: 'do', text: '' }] })
  }

  function updateStep(idx, field, value) {
    onChange({ ...data, steps: steps.map((s, i) => i === idx ? { ...s, [field]: value } : s) })
  }

  function removeStep(idx) {
    if (steps.length === 1) return   // Must keep at least one step
    onChange({ ...data, steps: steps.filter((_, i) => i !== idx) })
  }

  function moveStep(idx, dir) {
    const next = [...steps]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange({ ...data, steps: next })
  }

  return (
    <div className="be-form">
      <div className="be-field">
        <label className="be-label">
          Contexto (opcional)
          <span className="be-label-hint">Frase introductoria que se muestra antes de los pasos</span>
        </label>
        <input
          className="be-input"
          type="text"
          value={context}
          onChange={e => onChange({ ...data, context: e.target.value })}
          placeholder="Ej: Follow these steps to complete the writing task."
        />
      </div>

      <div className="be-field">
        <label className="be-label">
          Pasos del procedimiento
          <span className="be-label-hint">El ícono de acción se muestra en ClassroomOS como parte del timeline</span>
        </label>

        <div className="be-step-list">
          {steps.map((step, idx) => (
            <div key={idx} className="be-step-row">

              {/* Step number badge */}
              <span className="be-step-num">{idx + 1}</span>

              {/* Action selector */}
              <select
                className="be-select be-select--action"
                value={step.action || 'do'}
                onChange={e => updateStep(idx, 'action', e.target.value)}
                title="Tipo de acción"
              >
                {STEP_ACTIONS.map(act => (
                  <option key={act} value={act}>
                    {ACTION_META[act]?.icon} {ACTION_META[act]?.label.es}
                  </option>
                ))}
              </select>

              {/* Step text */}
              <input
                className="be-input be-step-text"
                type="text"
                value={step.text || ''}
                onChange={e => updateStep(idx, 'text', e.target.value)}
                placeholder="Instrucción para el estudiante…"
              />

              {/* Reorder + delete */}
              <div className="be-step-actions">
                <button className="be-icon-btn" onClick={() => moveStep(idx, -1)} disabled={idx === 0} title="Subir">↑</button>
                <button className="be-icon-btn" onClick={() => moveStep(idx,  1)} disabled={idx === steps.length - 1} title="Bajar">↓</button>
                <button className="be-icon-btn be-icon-btn--danger" onClick={() => removeStep(idx)} disabled={steps.length === 1} title="Eliminar paso">✕</button>
              </div>
            </div>
          ))}
        </div>

        {steps.length < 12 && (
          <button className="be-add-item-btn" onClick={addStep}>
            + Agregar paso
          </button>
        )}
      </div>
    </div>
  )
}
