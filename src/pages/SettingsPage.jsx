// ── SettingsPage.jsx ──────────────────────────────────────────────────────────
// Panel de control para que el admin active/desactive features del colegio.

import { useState } from 'react'
import { useFeatures } from '../context/FeaturesContext'

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

export default function SettingsPage({ teacher }) {
  const { features, loading, updateFeature } = useFeatures()
  const [saving, setSaving] = useState(null)
  const [saved,  setSaved]  = useState(null)

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
