// ── HomeworkForm.jsx ──────────────────────────────────────────────────────────
// Form for the `homework` block type.
// Used in TAREA (Momento 6): concrete, achievable assignment.
// ClassroomOS projects it at the end of class. Parent report includes it.

const KNOWN_PLATFORMS = [
  'Google Classroom', 'Raz-Kids', 'Khan Academy', 'Duolingo', 'Quizlet',
  'Reading A-Z', 'IXL', 'Mathletics', 'Seesaw', 'ClassDojo',
]

export default function HomeworkForm({ data, onChange }) {
  const isUrlValid = !data.platformUrl || /^https?:\/\/.+/.test(data.platformUrl)

  return (
    <div className="be-form">
      {/* Instruction */}
      <div className="be-field">
        <label className="be-label">
          Instrucción de la tarea
          <span className="be-label-hint">Clara y alcanzable — el estudiante debe saber exactamente qué hacer</span>
        </label>
        <textarea
          className="be-textarea"
          value={data.instruction || ''}
          onChange={e => onChange({ ...data, instruction: e.target.value })}
          placeholder="Ej: Completa las páginas 34–35 del workbook. Escribe 5 oraciones usando el pasado simple."
          rows={3}
        />
      </div>

      {/* Due date label */}
      <div className="be-field">
        <label className="be-label">
          Fecha de entrega
          <span className="be-label-hint">Etiqueta libre — ej: "Mañana", "Viernes 23 mayo", "Para la próxima clase"</span>
        </label>
        <input
          className="be-input"
          type="text"
          value={data.dueLabel || ''}
          onChange={e => onChange({ ...data, dueLabel: e.target.value })}
          placeholder="Para mañana"
        />
      </div>

      {/* Time estimate */}
      <div className="be-field">
        <label className="be-label">
          Tiempo estimado (minutos)
          <span className="be-label-hint">Opcional — ayuda a los padres a planificar</span>
        </label>
        <input
          className="be-input"
          type="number"
          value={data.timeEstimate || ''}
          min={5} max={120}
          onChange={e => onChange({ ...data, timeEstimate: parseInt(e.target.value) || null })}
          style={{ maxWidth: 120 }}
          placeholder="20"
        />
      </div>

      {/* Platform */}
      <div className="be-field">
        <label className="be-label">
          Plataforma digital
          <span className="be-label-hint">Opcional — si la tarea requiere una app o sitio web</span>
        </label>
        <input
          className="be-input"
          list="cbf-platforms"
          value={data.platform || ''}
          onChange={e => onChange({ ...data, platform: e.target.value })}
          placeholder="Ej: Google Classroom, Raz-Kids…"
        />
        <datalist id="cbf-platforms">
          {KNOWN_PLATFORMS.map(p => <option key={p} value={p} />)}
        </datalist>
      </div>

      {/* Platform URL */}
      {data.platform && (
        <div className="be-field">
          <label className="be-label">
            Enlace directo a la actividad
            <span className="be-label-hint">Solo ingresa URLs reales — nunca uses links inventados</span>
          </label>
          <input
            className={`be-input ${data.platformUrl && !isUrlValid ? 'be-input--error' : ''}`}
            type="url"
            value={data.platformUrl || ''}
            onChange={e => onChange({ ...data, platformUrl: e.target.value })}
            placeholder="https://classroom.google.com/c/..."
          />
          {data.platformUrl && !isUrlValid && (
            <p className="be-field-warning">⚠️ URL no válida. Debe comenzar con https://</p>
          )}
          {data.platformUrl && isUrlValid && (
            <p className="be-field-ok">✓ URL guardada — verifica que sea accesible antes de la clase</p>
          )}
        </div>
      )}

      {/* Parent note */}
      <div className="be-field">
        <label className="be-label">
          Nota para los padres
          <span className="be-label-hint">Aparece en el reporte semanal — contexto o materiales necesarios</span>
        </label>
        <textarea
          className="be-textarea be-textarea--private"
          value={data.parentNote || ''}
          onChange={e => onChange({ ...data, parentNote: e.target.value })}
          placeholder="Ej: El estudiante necesita el workbook. Si no tiene internet, puede hacerlo en el cuaderno."
          rows={2}
        />
      </div>
    </div>
  )
}
