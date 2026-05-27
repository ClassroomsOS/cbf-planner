import { useState } from 'react'
import { supabase } from '../../supabase'

export default function ConfigTab({ teacher, showToast }) {
  const [telegramId, setTelegramId] = useState(teacher.telegram_chat_id || '')
  const [saving, setSaving] = useState(false)

  async function saveTelegram() {
    setSaving(true)
    const { error } = await supabase
      .from('teachers')
      .update({ telegram_chat_id: telegramId.trim() || null })
      .eq('id', teacher.id)
    setSaving(false)
    if (error) {
      showToast('Error al guardar', 'error')
    } else {
      showToast('Telegram ID guardado', 'success')
    }
  }

  return (
    <div className="dict-config">
      <h2>Configuración de Dictation</h2>

      <div className="dict-config-section">
        <h3>📱 Telegram</h3>
        <p>Ingresa tu Chat ID de Telegram para recibir notificaciones cuando los estudiantes se conecten y entreguen sus dictados.</p>
        <div className="dict-config-row">
          <input
            value={telegramId}
            onChange={e => setTelegramId(e.target.value)}
            placeholder="Ej: 2041749428"
          />
          <button onClick={saveTelegram} disabled={saving} className="dict-btn-sm">
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      <div className="dict-config-section">
        <h3>📧 Notificaciones por Email (próximamente)</h3>
        <p>Cuando esta función esté activa, los resultados se enviarán automáticamente al correo del alumno y del representante (<code>representative_email</code>).</p>
        <div className="dict-email-fields">
          <label>
            <input type="checkbox" disabled /> Enviar resultado al alumno
          </label>
          <label>
            <input type="checkbox" disabled /> Enviar resultado al representante
          </label>
        </div>
      </div>
    </div>
  )
}
