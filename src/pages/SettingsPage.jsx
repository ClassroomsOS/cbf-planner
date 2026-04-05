// ── SettingsPage.jsx ──────────────────────────────────────────────────────────
// Panel de control del Coordinador Académico (admin).
// Gestión pedagógica diaria: docentes, franjas del horario, feature flags.
//
// Lo que NO está aquí (solo Superadmin):
//   → Logo e identidad institucional → /superadmin
//   → Restricción de dominio de email → /superadmin

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useFeatures } from '../context/FeaturesContext'
import { useToast } from '../context/ToastContext'

const FEATURE_GROUPS = [
  {
    title: '💬 Comunicación',
    color: '#4BACC6',
    items: [
      {
        key: 'messages',
        label: 'Mensajes entre docentes',
        desc: 'Permite que los docentes se envíen mensajes directos entre sí y con el coordinador.',
      },
      {
        key: 'admin_see_messages',
        label: 'Coordinador puede ver todos los mensajes',
        desc: 'El coordinador puede leer conversaciones entre docentes. Por defecto desactivado (privacidad).',
        warning: true,
      },
      {
        key: 'comments',
        label: 'Comentarios en guías',
        desc: 'Panel lateral para comentar guías de aprendizaje entre docentes y coordinadores.',
      },
      {
        key: 'corrections',
        label: 'Solicitudes de corrección',
        desc: 'Permite enviar feedback específico por sección de una guía.',
      },
      {
        key: 'announcements',
        label: 'Anuncios institucionales',
        desc: 'El coordinador puede publicar anuncios visibles para todos los docentes del colegio.',
      },
    ],
  },
  {
    title: '🤖 Inteligencia Artificial',
    color: '#8064A2',
    items: [
      {
        key: 'ai_generate',
        label: 'Generar guía completa con IA',
        desc: 'Genera una guía semanal completa a partir del objetivo del docente.',
      },
      {
        key: 'ai_analyze',
        label: 'Análisis pedagógico con IA',
        desc: 'Analiza la guía y da retroalimentación sobre fortalezas, alertas y balance de tiempos.',
      },
      {
        key: 'ai_suggest',
        label: 'Sugerencias IA por sección',
        desc: 'Botón inline en cada sección para sugerir actividades específicas.',
      },
    ],
  },
  {
    title: '✏️ Editor',
    color: '#F79646',
    items: [
      {
        key: 'wysiwyg',
        label: 'Preview WYSIWYG',
        desc: 'Vista previa en tiempo real de cómo quedará cada sección al exportar.',
      },
    ],
  },
]

const SLOT_COLORS = [
  { value: '#F79646', label: 'Naranja' },
  { value: '#4BACC6', label: 'Azul'    },
  { value: '#9BBB59', label: 'Verde'   },
  { value: '#C0504D', label: 'Rojo'    },
  { value: '#8064A2', label: 'Morado'  },
  { value: '#1F3864', label: 'Marino'  },
  { value: '#C9A84C', label: 'Dorado'  },
]

export default function SettingsPage({ teacher }) {
  const navigate  = useNavigate()
  const { features, loading, updateFeature } = useFeatures()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(null)
  const [saved,  setSaved]  = useState(null)

  // ── Franjas del Horario ──────────────────────────────────────────────────────
  const [showSlots,   setShowSlots]   = useState(false)
  const [slots,       setSlots]       = useState([])
  const [slotsLoaded, setSlotsLoaded] = useState(false)
  const [slotForm,    setSlotForm]    = useState({
    name: '', start_time: '', end_time: '', level: '', color: '#F79646',
  })
  const [slotSaving, setSlotSaving] = useState(false)

  async function fetchSlots() {
    const { data } = await supabase.from('schedule_slots')
      .select('*').eq('school_id', teacher.school_id).order('start_time')
    setSlots(data || [])
    setSlotsLoaded(true)
  }

  function toggleSlots() {
    setShowSlots(v => !v)
    if (!slotsLoaded) fetchSlots()
  }

  async function handleAddSlot() {
    if (!slotForm.name.trim() || !slotForm.start_time || !slotForm.end_time) return
    setSlotSaving(true)
    const { data, error } = await supabase.from('schedule_slots').insert({
      school_id:  teacher.school_id,
      name:       slotForm.name.trim().toUpperCase(),
      start_time: slotForm.start_time,
      end_time:   slotForm.end_time,
      level:      slotForm.level || null,
      color:      slotForm.color,
    }).select().single()
    if (error) { showToast('Error al agregar la franja', 'error'); setSlotSaving(false); return }
    if (data) setSlots(prev => [...prev, data].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    setSlotForm({ name: '', start_time: '', end_time: '', level: '', color: '#F79646' })
    setSlotSaving(false)
  }

  async function handleDeleteSlot(id) {
    if (!confirm('¿Eliminar esta franja?')) return
    const { error } = await supabase.from('schedule_slots').delete().eq('id', id)
    if (error) { showToast('Error al eliminar la franja', 'error'); return }
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  async function handleToggle(key, value) {
    setSaving(key)
    await updateFeature(key, value)
    setSaving(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  if (loading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando configuración…</p>
    </div>
  )

  const activeCount = Object.values(features).filter(Boolean).length
  const totalCount  = Object.keys(features).length

  return (
    <div className="planner-wrap">

      {/* ── Header ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg,#1F3864 0%,#2E5598 100%)',
          color: '#fff', padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, fontSize: '18px' }}>⚙️ Panel de control</span>
            <span style={{
              fontSize: '11px', fontWeight: 700, background: 'rgba(255,255,255,.2)',
              color: '#fff', borderRadius: '6px', padding: '2px 9px',
            }}>Coordinador</span>
          </div>
          <div style={{ fontSize: '12px', opacity: .8 }}>
            {teacher.schools?.name || 'CBF'} · Gestión pedagógica diaria
          </div>
          <div style={{
            marginTop: '12px', background: 'rgba(255,255,255,.15)',
            borderRadius: '8px', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', opacity: .8, marginBottom: '4px' }}>Features activas</div>
              <div style={{
                background: 'rgba(255,255,255,.2)', borderRadius: '10px',
                height: '6px', overflow: 'hidden',
              }}>
                <div style={{
                  background: '#9BBB59', height: '100%', borderRadius: '10px',
                  width: `${(activeCount / totalCount) * 100}%`, transition: 'width .3s ease',
                }} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>
              {activeCount}<span style={{ fontSize: '13px', opacity: .7 }}>/{totalCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gestión del colegio ── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ marginBottom: '14px' }}>
          <div className="badge" style={{ background: '#2E5598' }}>🔗</div>
          Gestión del colegio
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>

          {/* Teachers */}
          <button onClick={() => navigate('/teachers')} style={quickBtnStyle('#f0f4ff','#c0d0f0')}
            onMouseEnter={e => e.currentTarget.style.background = '#e0eaff'}
            onMouseLeave={e => e.currentTarget.style.background = '#f0f4ff'}>
            <span style={{ fontSize: '24px' }}>👥</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#1F3864' }}>
                Docentes y materias
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                Aprobar docentes, asignar cursos y horarios
              </div>
            </div>
          </button>

          {/* Schedule slots */}
          <button onClick={toggleSlots} style={quickBtnStyle(showSlots ? '#fff8f0':'#f0f4ff', showSlots ? '#F79646':'#c0d0f0')}
            onMouseEnter={e => e.currentTarget.style.background = showSlots ? '#fff0e0' : '#e8f0ff'}
            onMouseLeave={e => e.currentTarget.style.background = showSlots ? '#fff8f0' : '#f0f4ff'}>
            <span style={{ fontSize: '24px' }}>🕐</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#1F3864' }}>
                Franjas del Horario
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                Devocional, recesos, almuerzos por nivel
              </div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#aaa' }}>
              {showSlots ? '▲' : '▼'}
            </span>
          </button>
        </div>

        {/* ── Franjas del Horario expandible ── */}
        {showSlots && (
          <div style={{ marginTop: '14px', borderTop: '1px solid #ffe0c0', paddingTop: '14px' }}>
            {slots.length === 0 && slotsLoaded && (
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '14px', fontStyle: 'italic' }}>
                Sin franjas configuradas. Agrega la primera abajo.
              </div>
            )}
            {slots.map(slot => (
              <div key={slot.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '7px 12px', borderRadius: '8px', marginBottom: '6px',
                background: '#fafafa', border: '1px solid #eee',
              }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: slot.color || '#ccc', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '12px', color: '#333' }}>{slot.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>
                    {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                    {slot.level ? ` · ${slot.level}` : ' · todos los niveles'}
                  </div>
                </div>
                <button className="btn-icon-danger"
                  onClick={() => handleDeleteSlot(slot.id)} title="Eliminar">🗑</button>
              </div>
            ))}

            {/* Add slot form */}
            <div style={{
              background: '#f8faff', border: '1.5px dashed #bfcfff',
              borderRadius: '10px', padding: '14px', marginTop: '10px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#2E5598',
                textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
                ➕ Nueva franja
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <input placeholder="Nombre (ej. BREAK)" value={slotForm.name}
                  onChange={e => setSlotForm(p => ({ ...p, name: e.target.value }))}
                  style={{ padding: '6px 8px', border: '1px solid #d0d8e8', borderRadius: '6px', fontSize: '12px' }} />
                <input type="time" value={slotForm.start_time}
                  onChange={e => setSlotForm(p => ({ ...p, start_time: e.target.value }))}
                  style={{ padding: '6px 8px', border: '1px solid #d0d8e8', borderRadius: '6px', fontSize: '12px' }} />
                <input type="time" value={slotForm.end_time}
                  onChange={e => setSlotForm(p => ({ ...p, end_time: e.target.value }))}
                  style={{ padding: '6px 8px', border: '1px solid #d0d8e8', borderRadius: '6px', fontSize: '12px' }} />
                <select value={slotForm.level}
                  onChange={e => setSlotForm(p => ({ ...p, level: e.target.value }))}
                  style={{ padding: '6px 8px', border: '1px solid #d0d8e8', borderRadius: '6px', fontSize: '12px' }}>
                  <option value="">Todos</option>
                  <option value="elementary">Primaria</option>
                  <option value="middle">Bachillerato Básico</option>
                  <option value="high">Bachillerato Superior</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {SLOT_COLORS.map(c => (
                    <button key={c.value} title={c.label} onClick={() => setSlotForm(p => ({ ...p, color: c.value }))}
                      style={{
                        width: '22px', height: '22px', borderRadius: '50%', background: c.value,
                        border: slotForm.color === c.value ? '2px solid #333' : '2px solid transparent',
                        cursor: 'pointer',
                      }} />
                  ))}
                </div>
                <button className="btn-primary"
                  onClick={handleAddSlot} disabled={slotSaving}
                  style={{ fontSize: '12px', background: '#2E5598', color: '#fff', border: 'none',
                    borderRadius: '8px', padding: '8px 20px', cursor: slotSaving ? 'default' : 'pointer' }}>
                  {slotSaving ? 'Guardando…' : '➕ Agregar franja'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Feature groups ── */}
      {FEATURE_GROUPS.map(group => (
        <div key={group.title} className="card" style={{ marginBottom: '16px' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>
            <div className="badge" style={{ background: group.color }}>{group.title.split(' ')[0]}</div>
            {group.title.split(' ').slice(1).join(' ')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {group.items.map(item => {
              const isOn     = features[item.key] !== false
              const isSaving = saving === item.key
              const wasSaved = saved  === item.key
              return (
                <div key={item.key} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: isOn ? group.color + '08' : '#fafafa',
                  border: `1px solid ${isOn ? group.color + '30' : '#eee'}`,
                  transition: 'all .2s',
                }}>
                  <button onClick={() => handleToggle(item.key, !isOn)} disabled={isSaving}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px', border: 'none',
                      cursor: 'pointer', flexShrink: 0,
                      background: isOn ? group.color : '#ddd',
                      position: 'relative', transition: 'background .2s',
                      opacity: isSaving ? 0.6 : 1,
                    }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: '3px', left: isOn ? '23px' : '3px',
                      transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }} />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 600,
                      color: isOn ? '#1a2a4a' : '#888',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      {item.label}
                      {item.warning && (
                        <span style={{ fontSize: '10px', background: '#fff3cd', color: '#856404',
                          padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>
                          ⚠️ Privacidad
                        </span>
                      )}
                      {wasSaved && (
                        <span style={{ fontSize: '10px', background: '#d4edda', color: '#155724',
                          padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>
                          ✅ Guardado
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: 700, flexShrink: 0,
                    padding: '3px 10px', borderRadius: '10px',
                    background: isOn ? group.color + '20' : '#f0f0f0',
                    color: isOn ? group.color : '#aaa',
                  }}>
                    {isSaving ? '…' : isOn ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ textAlign: 'center', fontSize: '11px', color: '#bbb', padding: '8px', marginTop: '4px' }}>
        Los cambios se aplican inmediatamente para todos los usuarios del colegio.
      </div>
    </div>
  )
}

function quickBtnStyle(bg, border) {
  return {
    display: 'flex', alignItems: 'center', gap: '10px',
    background: bg, border: `1px solid ${border}`,
    borderRadius: '10px', padding: '12px 18px', cursor: 'pointer',
    textAlign: 'left', flex: '1', minWidth: '180px', transition: 'all .15s',
  }
}
