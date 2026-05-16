// ── QuestionForm.jsx ──────────────────────────────────────────────────────────
// Form for the `question` block type.
// A guiding question with a defined discussion type.
// ClassroomOS renders prominently — large typography, space for reflection.

const SUBTYPES = [
  { value: 'discussion',      label: { es: 'Discusión grupal',    en: 'Group discussion'    }, hint: 'La clase entera discute en voz alta' },
  { value: 'think-pair-share',label: { es: 'Think-Pair-Share',    en: 'Think-Pair-Share'    }, hint: 'Individual → pareja → clase' },
  { value: 'individual',      label: { es: 'Reflexión individual',en: 'Individual reflection'}, hint: 'Cada estudiante responde en su cuaderno' },
  { value: 'rhetorical',      label: { es: 'Retórica (sin respuesta)', en: 'Rhetorical'     }, hint: 'Para generar pensamiento, no requiere respuesta verbal' },
]

export default function QuestionForm({ data, onChange }) {
  const subtype = data.subtype || 'discussion'
  const current = SUBTYPES.find(s => s.value === subtype)

  return (
    <div className="be-form">
      <div className="be-field">
        <label className="be-label">
          Pregunta guía
          <span className="be-label-hint">Debe generar pensamiento genuino — evita respuestas de sí/no</span>
        </label>
        <textarea
          className="be-textarea"
          value={data.text || ''}
          onChange={e => onChange({ ...data, text: e.target.value })}
          placeholder="Ej: What do you think is the most important invention of the last 50 years, and why?"
          rows={3}
        />
      </div>

      <div className="be-field">
        <label className="be-label">Tipo de interacción</label>
        <div className="be-subtype-grid">
          {SUBTYPES.map(st => (
            <button
              key={st.value}
              type="button"
              className={`be-subtype-btn ${subtype === st.value ? 'active' : ''}`}
              onClick={() => onChange({ ...data, subtype: st.value })}
            >
              <span className="be-subtype-label">{st.label.es}</span>
              <span className="be-subtype-hint">{st.hint}</span>
            </button>
          ))}
        </div>
        {current && (
          <p className="be-field-note">
            En ClassroomOS: la pregunta se proyecta{subtype === 'think-pair-share' ? ' con timer de 3 fases (Think · Pair · Share)' : subtype === 'individual' ? ' con espacio visual de reflexión y timer' : subtype === 'rhetorical' ? ' prominente, sin instrucción adicional' : ' con instrucción de discusión grupal'}.
          </p>
        )}
      </div>

      <div className="be-field">
        <label className="be-label">
          Guía para el docente (privada)
          <span className="be-label-hint">Cómo se ve una buena respuesta — no se proyecta en pantalla</span>
        </label>
        <textarea
          className="be-textarea be-textarea--private"
          value={data.guidance || ''}
          onChange={e => onChange({ ...data, guidance: e.target.value })}
          placeholder="Ej: Una buena respuesta nombraría el internet y justificaría por qué cambió la comunicación humana…"
          rows={2}
        />
      </div>
    </div>
  )
}
