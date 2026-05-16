// ── ModelForm.jsx ─────────────────────────────────────────────────────────────
// Form for the `model` block type.
// A model text the student observes before producing their own.
// ClassroomOS renders as a prominent blockquote with grammar highlighting.

export default function ModelForm({ data, onChange }) {
  return (
    <div className="be-form">
      <div className="be-field">
        <label className="be-label">
          Texto modelo
          <span className="be-label-hint">El ejemplo que los estudiantes observarán antes de producir el suyo</span>
        </label>
        <textarea
          className="be-textarea"
          value={data.text || ''}
          onChange={e => onChange({ ...data, text: e.target.value })}
          placeholder={`Ej: "Last weekend, I went to the park with my family. We played football and had a picnic. It was a beautiful day."`}
          rows={5}
        />
      </div>

      <div className="be-field">
        <label className="be-label">
          Etiqueta del badge
          <span className="be-label-hint">Texto del badge que ClassroomOS muestra sobre el modelo</span>
        </label>
        <input
          className="be-input"
          type="text"
          value={data.label || ''}
          onChange={e => onChange({ ...data, label: e.target.value })}
          placeholder="Model · Modelo · Example"
        />
      </div>

      <div className="be-field">
        <label className="be-label">
          Estructura gramatical a resaltar
          <span className="be-label-hint">ClassroomOS subrayará esta estructura dentro del texto</span>
        </label>
        <input
          className="be-input"
          type="text"
          value={data.grammarTarget || ''}
          onChange={e => onChange({ ...data, grammarTarget: e.target.value })}
          placeholder="Ej: past tense verbs (went, played, had)"
        />
      </div>

      <div className="be-field">
        <label className="be-label">
          Fuente / atribución
          <span className="be-label-hint">Si el texto viene de un libro, autor, o estudiante anterior</span>
        </label>
        <input
          className="be-input"
          type="text"
          value={data.source || ''}
          onChange={e => onChange({ ...data, source: e.target.value })}
          placeholder="Ej: Adapted from Cambridge Interchange 2, Unit 5"
        />
      </div>
    </div>
  )
}
