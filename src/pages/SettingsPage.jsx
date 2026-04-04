// ── SettingsPage.jsx ──────────────────────────────────────────────────────────
// Panel de control para que el admin active/desactive features del colegio.

import { useState, useEffect } from 'react'
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
        desc: 'Permite que los docentes se envíen mensajes directos entre sí y con el admin.',
      },
      {
        key: 'admin_see_messages',
        label: 'Admin puede ver todos los mensajes',
        desc: 'El admin puede leer conversaciones entre docentes. Por defecto está desactivado (privacidad).',
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
        desc: 'El admin puede publicar anuncios visibles para todos los docentes del colegio.',
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

const LEVEL_LABELS_LOCAL = { elementary: 'Primaria', middle: 'Bachillerato Básico', high: 'Bachillerato Superior' }

const SLOT_COLORS = [
  { value: '#F79646', label: 'Naranja'  },
  { value: '#4BACC6', label: 'Azul'     },
  { value: '#9BBB59', label: 'Verde'    },
  { value: '#C0504D', label: 'Rojo'     },
  { value: '#8064A2', label: 'Morado'   },
  { value: '#1F3864', label: 'Marino'   },
  { value: '#C9A84C', label: 'Dorado'   },
]

export default function SettingsPage({ teacher }) {
  const navigate = useNavigate()
  const { features, loading, updateFeature } = useFeatures()
  const { showToast } = useToast()
  const [saving, setSaving] = useState(null)
  const [saved,  setSaved]  = useState(null)

  // ── Identidad institucional ──
  const [school,        setSchool]        = useState(null)
  const [showIdentity,  setShowIdentity]  = useState(false)
  const [schoolForm,    setSchoolForm]    = useState({})
  const [schoolSaving,  setSchoolSaving]  = useState(false)
  const [schoolSaved,   setSchoolSaved]   = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  // ── Franjas del Horario ──
  const [showSlots,   setShowSlots]   = useState(false)
  const [slots,       setSlots]       = useState([])
  const [slotsLoaded, setSlotsLoaded] = useState(false)
  const [slotForm,    setSlotForm]    = useState({ name: '', start_time: '', end_time: '', level: '', color: '#F79646' })
  const [slotSaving,  setSlotSaving]  = useState(false)

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

  useEffect(() => {
    supabase.from('schools').select('*').eq('id', teacher.school_id).single()
      .then(({ data }) => {
        setSchool(data)
        setSchoolForm({
          name:         data?.name         || '',
          dane:         data?.dane         || '',
          resolution:   data?.resolution   || '',
          plan_code:    data?.plan_code     || '',
          plan_version: data?.plan_version  || '',
        })
      })
  }, [teacher.school_id])

  async function saveSchoolIdentity() {
    setSchoolSaving(true)
    const { error } = await supabase.from('schools').update(schoolForm).eq('id', teacher.school_id)
    if (error) { showToast('Error al guardar la identidad institucional', 'error'); setSchoolSaving(false); return }
    setSchool(prev => ({ ...prev, ...schoolForm }))
    setSchoolSaving(false)
    setSchoolSaved(true)
    setTimeout(() => setSchoolSaved(false), 2500)
  }

  async function handleLogoUpload(file) {
    if (!file) return
    setLogoUploading(true)
    const ext  = file.name.split('.').pop()
    const path = `logos/${teacher.school_id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('guide-images').upload(path, file, { upsert: true })
    if (!error) {
      const { data: urlData } = supabase.storage.from('guide-images').getPublicUrl(path)
      const { error: dbErr } = await supabase.from('schools').update({ logo_url: urlData.publicUrl }).eq('id', teacher.school_id)
      if (!dbErr) setSchool(prev => ({ ...prev, logo_url: urlData.publicUrl }))
      else showToast('Error al guardar el logo', 'error')
    } else {
      showToast('Error al subir el logo', 'error')
    }
    setLogoUploading(false)
  }

  async function removeLogo() {
    const { error } = await supabase.from('schools').update({ logo_url: null }).eq('id', teacher.school_id)
    if (error) { showToast('Error al quitar el logo', 'error'); return }
    setSchool(prev => ({ ...prev, logo_url: null }))
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
      {/* Header */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg, #1F3864 0%, #2E5598 100%)',
          color: '#fff', padding: '20px 24px',
        }}>
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>
            ⚙️ Panel de control
          </div>
          <div style={{ fontSize: '12px', opacity: .8 }}>
            {teacher.schools?.name || 'CBF'} · Activa o desactiva funcionalidades del sistema
          </div>
          <div style={{
            marginTop: '12px', background: 'rgba(255,255,255,0.15)',
            borderRadius: '8px', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', opacity: .8, marginBottom: '4px' }}>
                Features activas
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.2)', borderRadius: '10px',
                height: '6px', overflow: 'hidden',
              }}>
                <div style={{
                  background: '#9BBB59', height: '100%', borderRadius: '10px',
                  width: `${(activeCount / totalCount) * 100}%`,
                  transition: 'width .3s ease',
                }} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>
              {activeCount}<span style={{ fontSize: '13px', opacity: .7 }}>/{totalCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Acceso rápido ── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ marginBottom: '14px' }}>
          <div className="badge" style={{ background: '#2E5598' }}>🔗</div>
          Gestión del colegio
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/teachers')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: '#f0f4ff', border: '1px solid #c0d0f0',
              borderRadius: '10px', padding: '12px 18px', cursor: 'pointer',
              textAlign: 'left', flex: '1', minWidth: '180px',
              transition: 'background .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#e0eaff'}
            onMouseLeave={e => e.currentTarget.style.background = '#f0f4ff'}
          >
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

          <button
            onClick={() => setShowIdentity(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: showIdentity ? '#fff8f0' : '#f0f4ff',
              border: `1px solid ${showIdentity ? '#F79646' : '#c0d0f0'}`,
              borderRadius: '10px', padding: '12px 18px', cursor: 'pointer',
              textAlign: 'left', flex: '1', minWidth: '180px',
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: '24px' }}>🏫</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#1F3864' }}>
                Identidad institucional
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                Logo, encabezado de guías y NEWS
              </div>
            </div>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#aaa' }}>
              {showIdentity ? '▲' : '▼'}
            </span>
          </button>

          <button
            onClick={toggleSlots}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: showSlots ? '#fff8f0' : '#f0f4ff',
              border: `1px solid ${showSlots ? '#F79646' : '#c0d0f0'}`,
              borderRadius: '10px', padding: '12px 18px', cursor: 'pointer',
              textAlign: 'left', flex: '1', minWidth: '180px',
              transition: 'all .15s',
            }}
          >
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

        {/* ── Identidad institucional expandible ── */}
        {showIdentity && (
          <div style={{
            marginTop: '14px', borderTop: '1px solid #ffe0c0',
            paddingTop: '14px',
          }}>
            {/* Logo */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '8px' }}>
                Logo del colegio
              </div>
              {school?.logo_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <img src={school.logo_url} alt="Logo"
                    style={{ height: '60px', width: 'auto', objectFit: 'contain',
                      borderRadius: '6px', border: '1px solid #eee', padding: '4px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{
                      fontSize: '12px', color: '#2E5598', cursor: 'pointer',
                      border: '1px solid #c0d0f0', borderRadius: '6px',
                      padding: '5px 12px', background: '#f0f4ff', display: 'inline-block',
                    }}>
                      {logoUploading ? 'Subiendo…' : '↑ Cambiar logo'}
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => handleLogoUpload(e.target.files[0])} />
                    </label>
                    <button onClick={removeLogo}
                      style={{ fontSize: '11px', color: '#c00', background: 'none',
                        border: '1px solid #fcc', borderRadius: '6px',
                        padding: '4px 10px', cursor: 'pointer' }}>
                      ✕ Quitar logo
                    </button>
                  </div>
                </div>
              ) : (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  border: '2px dashed #c0d0f0', borderRadius: '10px',
                  padding: '16px 20px', cursor: 'pointer',
                  background: logoUploading ? '#f8fbff' : '#fff',
                  color: '#2E5598', fontSize: '13px', fontWeight: 500,
                }}>
                  {logoUploading ? '⏳ Subiendo…' : '🏫 Clic para subir el logo del colegio'}
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => handleLogoUpload(e.target.files[0])} />
                </label>
              )}
            </div>

            {/* Campos del encabezado */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '10px', marginBottom: '14px',
            }}>
              {[
                { key: 'name',         label: 'Nombre del colegio',   placeholder: 'COLEGIO BOSTON FLEXIBLE' },
                { key: 'dane',         label: 'DANE',                 placeholder: '308001800455' },
                { key: 'resolution',   label: 'Resolución',           placeholder: '09685 DE 2019' },
                { key: 'plan_code',    label: 'Código del documento',  placeholder: 'CBF-G AC-01' },
                { key: 'plan_version', label: 'Versión del documento', placeholder: 'Versión 02 Febrero 2022' },
              ].map(field => (
                <div key={field.key}>
                  <label style={{ fontSize: '11px', color: '#888', fontWeight: 600,
                    display: 'block', marginBottom: '4px' }}>
                    {field.label}
                  </label>
                  <input
                    type="text"
                    value={schoolForm[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={e => setSchoolForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid #d0d8e8', borderRadius: '7px',
                      padding: '7px 10px', fontSize: '12px', color: '#333',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={saveSchoolIdentity}
                disabled={schoolSaving}
                style={{
                  background: schoolSaving ? '#ccc' : '#2E5598',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  padding: '8px 20px', fontSize: '13px', fontWeight: 600,
                  cursor: schoolSaving ? 'default' : 'pointer',
                }}>
                {schoolSaving ? 'Guardando…' : 'Guardar datos institucionales'}
              </button>
              {schoolSaved && (
                <span style={{ fontSize: '12px', color: '#3a7d44', fontWeight: 600 }}>
                  ✅ Guardado — se aplica a todas las guías nuevas
                </span>
              )}
            </div>
            <div style={{ fontSize: '10px', color: '#bbb', marginTop: '8px' }}>
              Estos datos aparecen en el encabezado de todas las guías y proyectos NEWS exportados.
            </div>
          </div>
        )}

        {/* ── Franjas del Horario expandible ── */}
        {showSlots && (
          <div style={{ marginTop: '14px', borderTop: '1px solid #ffe0c0', paddingTop: '14px' }}>

            {/* Existing slots */}
            {slots.length === 0 && slotsLoaded && (
              <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '14px', fontStyle: 'italic' }}>
                Sin franjas configuradas aún.
              </div>
            )}
            {slots.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: '8px', marginBottom: '6px',
                background: s.color + '15', border: `1.5px solid ${s.color}44`,
              }}>
                <span style={{
                  width: '12px', height: '12px', borderRadius: '50%',
                  background: s.color, flexShrink: 0, display: 'inline-block',
                }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#1F3864' }}>{s.name}</span>
                  <span style={{ fontSize: '11px', color: '#888', marginLeft: '8px' }}>
                    {s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}
                  </span>
                  {s.level && (
                    <span style={{ fontSize: '10px', color: '#2E5598', marginLeft: '8px',
                      background: '#eef2fb', padding: '1px 7px', borderRadius: '8px' }}>
                      {LEVEL_LABELS_LOCAL[s.level]}
                    </span>
                  )}
                  {!s.level && (
                    <span style={{ fontSize: '10px', color: '#888', marginLeft: '8px',
                      background: '#f5f5f5', padding: '1px 7px', borderRadius: '8px' }}>
                      Todos los niveles
                    </span>
                  )}
                </div>
                <button onClick={() => handleDeleteSlot(s.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer',
                    color: '#C0504D', fontSize: '14px', padding: '2px 6px' }}>
                  🗑
                </button>
              </div>
            ))}

            {/* Add new slot form */}
            <div style={{
              background: '#f8faff', border: '1.5px solid #dde5f0',
              borderRadius: '10px', padding: '14px', marginTop: '10px',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#2E5598',
                textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '10px' }}>
                ➕ Agregar franja
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#888', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nombre</label>
                  <input type="text" value={slotForm.name}
                    placeholder="DEVOCIONAL"
                    onChange={e => setSlotForm(p => ({ ...p, name: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d0d8e8',
                      borderRadius: '7px', padding: '7px 10px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#888', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Inicio</label>
                  <input type="time" value={slotForm.start_time}
                    onChange={e => setSlotForm(p => ({ ...p, start_time: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d0d8e8',
                      borderRadius: '7px', padding: '7px 10px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#888', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Fin</label>
                  <input type="time" value={slotForm.end_time}
                    onChange={e => setSlotForm(p => ({ ...p, end_time: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d0d8e8',
                      borderRadius: '7px', padding: '7px 10px', fontSize: '12px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#888', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nivel</label>
                  <select value={slotForm.level}
                    onChange={e => setSlotForm(p => ({ ...p, level: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #d0d8e8',
                      borderRadius: '7px', padding: '7px 10px', fontSize: '12px' }}>
                    <option value="">Todos los niveles</option>
                    {Object.entries(LEVEL_LABELS_LOCAL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#888', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Color</label>
                  <select value={slotForm.color}
                    onChange={e => setSlotForm(p => ({ ...p, color: e.target.value }))}
                    style={{ width: '100%', border: '1px solid #d0d8e8',
                      borderRadius: '7px', padding: '7px 10px', fontSize: '12px' }}>
                    {SLOT_COLORS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddSlot}
                disabled={slotSaving || !slotForm.name.trim() || !slotForm.start_time || !slotForm.end_time}
                style={{
                  background: slotSaving ? '#ccc' : '#2E5598', color: '#fff',
                  border: 'none', borderRadius: '8px', padding: '8px 20px',
                  fontSize: '13px', fontWeight: 600,
                  cursor: slotSaving ? 'default' : 'pointer',
                }}>
                {slotSaving ? 'Guardando…' : '➕ Agregar franja'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature groups */}
      {FEATURE_GROUPS.map(group => (
        <div key={group.title} className="card" style={{ marginBottom: '16px' }}>
          <div className="card-title" style={{ marginBottom: '14px' }}>
            <div className="badge" style={{ background: group.color }}>{group.title.split(' ')[0]}</div>
            {group.title.split(' ').slice(1).join(' ')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {group.items.map((item, idx) => {
              const isOn     = features[item.key] !== false
              const isSaving = saving === item.key
              const wasSaved = saved === item.key

              return (
                <div key={item.key} style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 14px', borderRadius: '10px',
                  background: isOn ? group.color + '08' : '#fafafa',
                  border: `1px solid ${isOn ? group.color + '30' : '#eee'}`,
                  marginBottom: idx < group.items.length - 1 ? '6px' : 0,
                  transition: 'all .2s',
                }}>
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(item.key, !isOn)}
                    disabled={isSaving}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      border: 'none', cursor: 'pointer', flexShrink: 0,
                      background: isOn ? group.color : '#ddd',
                      position: 'relative', transition: 'background .2s',
                      opacity: isSaving ? 0.6 : 1,
                    }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: '#fff', position: 'absolute',
                      top: '3px', left: isOn ? '23px' : '3px',
                      transition: 'left .2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13px', fontWeight: 600,
                      color: isOn ? '#1a2a4a' : '#888',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      {item.label}
                      {item.warning && (
                        <span style={{
                          fontSize: '10px', background: '#fff3cd',
                          color: '#856404', padding: '1px 6px',
                          borderRadius: '8px', fontWeight: 600,
                        }}>
                          ⚠️ Privacidad
                        </span>
                      )}
                      {wasSaved && (
                        <span style={{
                          fontSize: '10px', background: '#d4edda',
                          color: '#155724', padding: '1px 6px',
                          borderRadius: '8px', fontWeight: 600,
                        }}>
                          ✅ Guardado
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
                      {item.desc}
                    </div>
                  </div>

                  {/* Status badge */}
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

      <div style={{
        textAlign: 'center', fontSize: '11px', color: '#bbb',
        padding: '8px', marginTop: '4px',
      }}>
        Los cambios se aplican inmediatamente para todos los usuarios del colegio.
      </div>
    </div>
  )
}
