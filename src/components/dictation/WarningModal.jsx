// ── WarningModal.jsx ──────────────────────────────────────────────────────────
// Modal para enviar advertencia al estudiante via Broadcast.

import { useState } from 'react'
import { createPortal } from 'react-dom'

const SEVERITY_OPTIONS = [
  { value: 'info',    label: '💬 Información', color: '#2563EB' },
  { value: 'warning', label: '⚠️ Advertencia',  color: '#D97706' },
  { value: 'danger',  label: '🚨 Alerta grave', color: '#DC2626' },
]

const QUICK_MESSAGES = [
  'Por favor, mantén la vista en tu pantalla.',
  'Tienes cambios de pestaña registrados. Próxima violación puede cerrar tu examen.',
  'Recuerda: No está permitido usar materiales de apoyo.',
  'Quedan pocos minutos. Revisa tus respuestas antes de enviar.',
]

export default function WarningModal({ studentName, onSend, onClose }) {
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState('warning')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!message.trim()) return
    setSending(true)
    await onSend({ message: message.trim(), severity })
    setSending(false)
    onClose()
  }

  return createPortal(
    <div className="dict-modal-overlay" onClick={onClose}>
      <div className="dict-modal-card dict-warning-modal" onClick={e => e.stopPropagation()}>
        <div className="dict-modal-header" style={{ borderTopColor: '#D97706' }}>
          <h3>⚠️ Enviar advertencia</h3>
          {studentName && <p className="dict-modal-subtitle">Para: <strong>{studentName}</strong></p>}
          <button className="dict-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="dict-modal-body">
          <label className="dict-wm-label">Nivel de severidad</label>
          <div className="dict-wm-severity-row">
            {SEVERITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`dict-wm-severity-btn ${severity === opt.value ? 'active' : ''}`}
                style={severity === opt.value ? { background: opt.color, color: 'white' } : {}}
                onClick={() => setSeverity(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="dict-wm-label">Mensajes rápidos</label>
          <div className="dict-wm-quick">
            {QUICK_MESSAGES.map((msg, i) => (
              <button
                key={i}
                className="dict-wm-quick-btn"
                onClick={() => setMessage(msg)}
              >
                {msg}
              </button>
            ))}
          </div>

          <label className="dict-wm-label">Mensaje personalizado</label>
          <textarea
            className="dict-wm-textarea"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Escribe el mensaje que verá el estudiante..."
            rows={3}
            autoFocus
          />
        </div>

        <div className="dict-modal-footer">
          <button className="dict-btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className="dict-btn-primary dict-btn-warn"
            onClick={handleSend}
            disabled={!message.trim() || sending}
          >
            {sending ? 'Enviando...' : '📤 Enviar advertencia'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
