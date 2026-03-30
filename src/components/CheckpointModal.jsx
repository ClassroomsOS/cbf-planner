import { useState } from 'react'
import { supabase } from '../supabase'

// ── CheckpointModal ─────────────────────────────────────────────────────────
// Appears before creating a new guide when the previous week had a
// linked learning target without a checkpoint recorded.
//
// Props:
//   previousPlan    – { id, week_number, grade, subject, target_id }
//   target          – { id, description, taxonomy }
//   teacher         – teacher object
//   onComplete      – callback() after checkpoint is saved
//   onSkip          – callback() if teacher skips
//   onClose         – callback() to close modal

const LEVELS = [
  {
    value: 'most',
    emoji: '🟢',
    label: 'La mayoría',
    desc: 'Más del 70% demostró el desempeño esperado',
    color: '#2d7a2d',
    bg: '#f0f7f0',
    border: '#b5d6b5',
  },
  {
    value: 'some',
    emoji: '🟡',
    label: 'Algunos',
    desc: 'Entre 30% y 70% lo logró',
    color: '#b8860b',
    bg: '#fef9ee',
    border: '#e8d5a0',
  },
  {
    value: 'few',
    emoji: '🔴',
    label: 'Pocos',
    desc: 'Menos del 30% demostró el desempeño',
    color: '#b33',
    bg: '#fef0f0',
    border: '#e8b5b5',
  },
]

const TAXONOMY_LABELS = {
  recognize: '👁️ Reconocer',
  apply: '🛠️ Aplicar',
  produce: '✨ Producir',
}

export default function CheckpointModal({ previousPlan, target, teacher, onComplete, onSkip, onClose }) {
  const [selected, setSelected] = useState(null)
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)

  async function handleSave() {
    if (!selected) return
    setSaving(true)

    await supabase.from('checkpoints').upsert({
      target_id:   target.id,
      plan_id:     previousPlan.id,
      teacher_id:  teacher.id,
      school_id:   teacher.school_id,
      grade:       previousPlan.grade,
      subject:     previousPlan.subject,
      week_number: previousPlan.week_number,
      achievement: selected,
      notes:       notes.trim() || null,
    }, {
      onConflict: 'target_id,teacher_id,week_number',
    })

    setSaving(false)
    onComplete()
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(30, 40, 60, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        padding: '20px',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: '#fff', borderRadius: '16px', width: '100%',
          maxWidth: '540px', maxHeight: '90vh', display: 'flex',
          flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid #e0e6f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: '17px', color: '#1F3864', fontWeight: 700 }}>
            📊 ¿Cómo fue la semana anterior?
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: '20px',
              color: '#888', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px',
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {/* Context */}
          <div style={{
            background: '#f0f4ff', border: '1px solid #c5d5f0', borderRadius: '8px',
            padding: '12px 14px', marginBottom: '16px', fontSize: '12px', color: '#2E5598',
          }}>
            Antes de planear esta semana, tómate 30 segundos para reflexionar sobre la anterior.
            Esta información le permite al sistema ayudarte a planear mejor.
          </div>

          {/* Target being evaluated */}
          <div style={{
            background: '#f8f8f8', border: '1px solid #e5e5e5', borderRadius: '10px',
            padding: '14px 16px', marginBottom: '20px',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, color: '#888', marginBottom: '6px',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              Objetivo de la semana {previousPlan.week_number}
            </div>
            <div style={{ fontSize: '14px', color: '#333', lineHeight: 1.5, fontWeight: 500 }}>
              {target.description}
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
              {previousPlan.grade} · {previousPlan.subject} · {TAXONOMY_LABELS[target.taxonomy] || target.taxonomy}
            </div>
          </div>

          {/* Question */}
          <div style={{
            fontSize: '14px', fontWeight: 600, color: '#333', marginBottom: '14px',
          }}>
            ¿Cuántos estudiantes lograron este desempeño?
          </div>

          {/* Level selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {LEVELS.map(level => (
              <button
                key={level.value}
                onClick={() => setSelected(level.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px', borderRadius: '10px', textAlign: 'left',
                  border: selected === level.value
                    ? `2px solid ${level.color}`
                    : `1.5px solid ${level.border}`,
                  background: selected === level.value ? level.bg : '#fff',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: '24px' }}>{level.emoji}</span>
                <div>
                  <div style={{
                    fontSize: '14px', fontWeight: 700,
                    color: selected === level.value ? level.color : '#333',
                  }}>
                    {level.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                    {level.desc}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Optional notes */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{
              fontSize: '12px', fontWeight: 600, color: '#666',
              display: 'block', marginBottom: '6px',
            }}>
              Observaciones (opcional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Les costó la parte de producción escrita. La mayoría identificó el vocabulario pero no lo usó en contexto."
              rows={2}
              style={{
                width: '100%', fontSize: '13px', padding: '10px 12px', borderRadius: '8px',
                border: '1px solid #c5d5f0', resize: 'vertical', fontFamily: 'inherit',
                lineHeight: 1.5, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderTop: '1px solid #e0e6f0',
        }}>
          <button
            onClick={onSkip}
            style={{
              background: 'none', border: 'none', fontSize: '13px',
              color: '#999', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Omitir por ahora
          </button>
          <button
            onClick={handleSave}
            disabled={!selected || saving}
            style={{
              padding: '10px 24px', fontSize: '14px', fontWeight: 700,
              borderRadius: '10px', border: 'none', cursor: 'pointer',
              background: selected ? '#2E5598' : '#ccc',
              color: '#fff', transition: 'all 0.2s',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '⏳ Guardando…' : '📊 Registrar y continuar'}
          </button>
        </div>
      </div>
    </div>
  )
}
