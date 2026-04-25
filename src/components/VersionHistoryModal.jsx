// ── VersionHistoryModal.jsx ───────────────────────────────────────────────────
// Historial de versiones publicadas de una guía.
// Admin/rector: puede restaurar una versión anterior.
// Todos: pueden ver el historial y exportar como HTML.

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../supabase'
import { canEditOthersDocs } from '../utils/roles'
import { useToast } from '../context/ToastContext'

function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function VersionHistoryModal({ planId, planTitle, teacher, onClose, onRestored }) {
  const { showToast } = useToast()
  const canRestore    = canEditOthersDocs(teacher.role)

  const [versions,    setVersions]    = useState([])
  const [tmap,        setTmap]        = useState({})
  const [loading,     setLoading]     = useState(true)
  const [restoring,   setRestoring]   = useState(null) // version id being restored
  const [expanded,    setExpanded]    = useState(null) // version id with note expanded

  useEffect(() => {
    load()
  }, [planId])

  async function load() {
    setLoading(true)

    const [{ data: vers }, { data: trows }] = await Promise.all([
      supabase
        .from('lesson_plan_versions')
        .select('id, version, status, note, archived_by, archived_at, storage_path')
        .eq('plan_id', planId)
        .order('version', { ascending: false }),
      supabase
        .from('teachers')
        .select('id, full_name, initials')
        .eq('school_id', teacher.school_id),
    ])

    const map = {}
    for (const t of trows || []) map[t.id] = t
    setTmap(map)
    setVersions(vers || [])
    setLoading(false)
  }

  async function handleRestore(ver) {
    if (!canRestore) return
    if (!confirm(`¿Restaurar la versión ${ver.version}? El contenido actual será reemplazado.`)) return

    setRestoring(ver.id)
    // Fetch full content snapshot
    const { data: full } = await supabase
      .from('lesson_plan_versions')
      .select('content')
      .eq('id', ver.id)
      .single()

    if (!full?.content) {
      showToast('Error: no se encontró el contenido de esa versión', 'error')
      setRestoring(null)
      return
    }

    const { error } = await supabase
      .from('lesson_plans')
      .update({
        content:    full.content,
        status:     'complete',  // devuelve a revisión tras restaurar
        locked:     false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)

    setRestoring(null)
    if (error) { showToast('Error al restaurar: ' + error.message, 'error'); return }
    showToast(`Versión ${ver.version} restaurada — guía devuelta a "Completa"`, 'success')
    onRestored?.()
    onClose()
  }

  const STATUS_LABEL = {
    approved:  { label: 'Aprobada',   color: '#15803D', bg: '#F0FDF4' },
    published: { label: 'Publicada',  color: '#065F46', bg: '#ECFDF5' },
    archived:  { label: 'Archivada',  color: '#6B7280', bg: '#F5F5F5' },
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 560, maxWidth: '95vw',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(0,0,0,.25)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg,#1F3864,#2E5598)',
          color: '#fff', padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>📋 Historial de versiones</div>
            <div style={{ fontSize: 12, opacity: .8, marginTop: 2 }}>{planTitle}</div>
          </div>
          <button type="button" onClick={onClose}
            style={{
              background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 18,
            }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {loading && (
            <div style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>
              Cargando versiones…
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div style={{
              textAlign: 'center', color: '#94A3B8', padding: 40,
              background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: 13 }}>Esta guía no tiene versiones publicadas aún.</div>
              <div style={{ fontSize: 11, marginTop: 6, color: '#CBD5E1' }}>
                Las versiones se crean al publicar una guía aprobada.
              </div>
            </div>
          )}

          {versions.map((ver, idx) => {
            const actor = tmap[ver.archived_by]
            const meta  = STATUS_LABEL[ver.status] || STATUS_LABEL.published
            const isLatest = idx === 0

            return (
              <div key={ver.id} style={{
                border: `1.5px solid ${isLatest ? '#2E5598' : '#E2E8F0'}`,
                borderRadius: 10, padding: '14px 16px', marginBottom: 10,
                background: isLatest ? '#F0F4FF' : '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  {/* Version badge */}
                  <div style={{
                    background: isLatest ? '#2E5598' : '#94A3B8', color: '#fff',
                    borderRadius: 6, padding: '4px 10px', fontWeight: 800, fontSize: 13,
                  }}>
                    v{ver.version}
                  </div>

                  {isLatest && (
                    <span style={{
                      background: '#DBEAFE', color: '#1D4ED8',
                      borderRadius: 4, padding: '2px 7px', fontSize: 10, fontWeight: 700,
                    }}>ACTUAL</span>
                  )}

                  {/* Status badge */}
                  <span style={{
                    background: meta.bg, color: meta.color,
                    borderRadius: 4, padding: '2px 7px', fontSize: 11, fontWeight: 600,
                  }}>{meta.label}</span>

                  {/* Date + author */}
                  <span style={{ fontSize: 12, color: '#64748B', marginLeft: 'auto' }}>
                    {formatDateTime(ver.archived_at)}
                  </span>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, color: '#64748B' }}>
                  Publicada por <strong>{actor?.full_name || '—'}</strong>
                </div>

                {ver.note && (
                  <div style={{
                    marginTop: 8, fontSize: 12, color: '#374151',
                    background: '#FFFDF0', borderRadius: 6, padding: '6px 10px',
                    border: '1px solid #FDE68A',
                  }}>
                    💬 {ver.note}
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ver.storage_path && (
                    <a href={ver.storage_path} target="_blank" rel="noreferrer"
                      style={{
                        padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: '#ECFDF5', color: '#065F46',
                        border: '1px solid #A7F3D0', textDecoration: 'none',
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                      }}>
                      📄 Abrir archivado
                    </a>
                  )}
                  {canRestore && !isLatest && (
                    <button type="button"
                      disabled={!!restoring}
                      onClick={() => handleRestore(ver)}
                      style={{
                        padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        background: restoring === ver.id ? '#E2E8F0' : '#1F3864',
                        color: restoring === ver.id ? '#94A3B8' : '#fff',
                        border: 'none', cursor: restoring ? 'default' : 'pointer',
                      }}>
                      {restoring === ver.id ? '⏳ Restaurando…' : '🔄 Restaurar esta versión'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #E2E8F0', padding: '12px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#F8FAFC',
        }}>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>
            {versions.length} versión{versions.length !== 1 ? 'es' : ''} guardada{versions.length !== 1 ? 's' : ''}
          </span>
          <button type="button" onClick={onClose}
            style={{
              padding: '8px 20px', borderRadius: 8, border: '1px solid #D0D5DD',
              background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer',
            }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
