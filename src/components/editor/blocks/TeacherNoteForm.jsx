// ── TeacherNoteForm.jsx ───────────────────────────────────────────────────────
// Form for the `teacher-note` block type.
// Private instruction for the teacher — NEVER projected on ClassroomOS.
// In the DOCX, rendered in small gray italic text.

const PRIORITIES = [
  { value: 'normal',    label: 'Normal',     color: '#717A9B' },
  { value: 'important', label: 'Importante', color: '#1B3564' },
  { value: 'warning',   label: 'Atención',   color: '#B45309' },
]

export default function TeacherNoteForm({ data, onChange }) {
  const priority = data.priority || 'normal'

  return (
    <div className="be-form">
      <div className="be-private-banner">
        🔒 Esta nota es solo para ti — nunca aparece en ClassroomOS ni se proyecta en clase.
      </div>

      <div className="be-field">
        <label className="be-label">Nota privada</label>
        <textarea
          className="be-textarea be-textarea--private"
          value={data.text || ''}
          onChange={e => onChange({ ...data, text: e.target.value })}
          placeholder="Recordatorios, timing, adaptaciones PIAR, diferenciación, observaciones de clase anterior…"
          rows={4}
        />
      </div>

      <div className="be-field">
        <label className="be-label">Nivel de prioridad</label>
        <div className="be-priority-row">
          {PRIORITIES.map(p => (
            <button
              key={p.value}
              type="button"
              className={`be-priority-btn ${priority === p.value ? 'active' : ''}`}
              style={{ '--priority-color': p.color }}
              onClick={() => onChange({ ...data, priority: p.value })}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
