// ── SuperAdminPage.jsx ────────────────────────────────────────────────────────
// Panel exclusivo del Superadmin.
// Gestión institucional: identidad del colegio (logo, datos DANE, resolución)
// y seguridad de acceso (restricción de dominio de email).
//
// Lo que NO está aquí (Coordinador):
//   → Docentes y materias → /settings
//   → Franjas del horario → /settings
//   → Feature flags pedagógicos → /settings

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useFeatures } from '../context/FeaturesContext'
import { useToast } from '../context/ToastContext'

export default function SuperAdminPage({ teacher }) {
  const navigate       = useNavigate()
  const { features, updateFeature } = useFeatures()
  const { showToast }  = useToast()

  // ── School identity ──────────────────────────────────────────────────────────
  const [school, setSchool]       = useState(null)
  const [schoolLoading, setSchoolLoading] = useState(true)
  const [schoolSaving,  setSchoolSaving]  = useState(false)
  const [schoolForm, setSchoolForm] = useState({
    name: '', dane: '', resolution: '', plan_code: '', plan_version: '',
  })

  // ── Logo ─────────────────────────────────────────────────────────────────────
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef(null)

  // ── Security ─────────────────────────────────────────────────────────────────
  const [domainSaving, setDomainSaving] = useState(false)
  const [domainSaved,  setDomainSaved]  = useState(false)
  const [domainInput,  setDomainInput]  = useState('')

  // ── Load school data ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchSchool() {
      const { data } = await supabase
        .from('schools')
        .select('id, name, dane, resolution, plan_code, plan_version, logo_url')
        .eq('id', teacher.school_id)
        .single()
      if (data) {
        setSchool(data)
        setSchoolForm({
          name:         data.name         || '',
          dane:         data.dane         || '',
          resolution:   data.resolution   || '',
          plan_code:    data.plan_code    || '',
          plan_version: data.plan_version || '',
        })
      }
      setSchoolLoading(false)
    }
    fetchSchool()
  }, [teacher.school_id])

  // Sync domain field from features when loaded
  useEffect(() => {
    if (features.email_domain !== undefined) {
      setDomainInput(features.email_domain || '')
    }
  }, [features.email_domain])

  // ── Save school fields ───────────────────────────────────────────────────────
  async function handleSaveSchool() {
    if (!schoolForm.name.trim()) { showToast('El nombre del colegio es obligatorio', 'error'); return }
    setSchoolSaving(true)
    const { error } = await supabase
      .from('schools')
      .update({
        name:         schoolForm.name.trim(),
        dane:         schoolForm.dane.trim()         || null,
        resolution:   schoolForm.resolution.trim()   || null,
        plan_code:    schoolForm.plan_code.trim()    || null,
        plan_version: schoolForm.plan_version.trim() || null,
      })
      .eq('id', teacher.school_id)
    if (error) {
      showToast('Error al guardar datos institucionales: ' + error.message, 'error')
    } else {
      setSchool(s => ({ ...s, ...schoolForm }))
      showToast('Datos institucionales guardados', 'success')
    }
    setSchoolSaving(false)
  }

  // ── Logo upload ──────────────────────────────────────────────────────────────
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowed.includes(file.type)) {
      showToast('Solo se permiten imágenes PNG, JPG, SVG o WebP', 'error'); return
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('El logo no puede superar 2 MB', 'error'); return
    }
    setLogoUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `logos/${teacher.school_id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('guide-images')
        .upload(path, file, { upsert: true })
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage
        .from('guide-images')
        .getPublicUrl(path)
      const publicUrl = urlData?.publicUrl
      if (!publicUrl) throw new Error('No se pudo obtener URL pública')

      const { error: dbErr } = await supabase
        .from('schools')
        .update({ logo_url: publicUrl })
        .eq('id', teacher.school_id)
      if (dbErr) throw dbErr

      setSchool(s => ({ ...s, logo_url: publicUrl }))
      showToast('Logo actualizado correctamente', 'success')
    } catch (err) {
      showToast('Error al subir el logo: ' + (err.message || ''), 'error')
    } finally {
      setLogoUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRemoveLogo() {
    if (!confirm('¿Quitar el logo del colegio? Las guías ya impresas no se verán afectadas.')) return
    const { error } = await supabase
      .from('schools')
      .update({ logo_url: null })
      .eq('id', teacher.school_id)
    if (error) { showToast('Error al quitar el logo', 'error'); return }
    setSchool(s => ({ ...s, logo_url: null }))
    showToast('Logo eliminado', 'success')
  }

  // ── Security toggles ─────────────────────────────────────────────────────────
  async function handleDomainToggle(value) {
    setDomainSaving(true)
    await updateFeature('restrict_email_domain', value)
    setDomainSaving(false)
    setDomainSaved(true)
    setTimeout(() => setDomainSaved(false), 2000)
  }

  async function handleSaveDomain() {
    const val = domainInput.trim().toLowerCase()
    if (!val) { showToast('Escribe el dominio antes de guardar', 'error'); return }
    setDomainSaving(true)
    await updateFeature('email_domain', val)
    setDomainSaving(false)
    setDomainSaved(true)
    setTimeout(() => setDomainSaved(false), 2000)
    showToast('Dominio guardado', 'success')
  }

  if (schoolLoading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando configuración institucional…</p>
    </div>
  )

  const restrictDomain = features.restrict_email_domain !== false

  return (
    <div className="planner-wrap">

      {/* ── Header ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{
          background: 'linear-gradient(135deg,#7B1A1A 0%,#C0504D 100%)',
          color: '#fff', padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, fontSize: '18px' }}>🔑 Panel Superadmin</span>
            <span style={{
              fontSize: '11px', fontWeight: 700, background: 'rgba(255,255,255,.2)',
              color: '#fff', borderRadius: '6px', padding: '2px 9px',
            }}>Solo Superadmin</span>
          </div>
          <div style={{ fontSize: '12px', opacity: .8 }}>
            {school?.name || teacher.schools?.name || 'CBF'} · Identidad institucional y seguridad
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{
              marginTop: '12px', background: 'rgba(255,255,255,.15)',
              border: '1px solid rgba(255,255,255,.3)', color: '#fff',
              borderRadius: '8px', padding: '6px 16px', fontSize: '12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
            ⚙️ Ir al Panel de Control (Coordinador)
          </button>
        </div>
      </div>

      {/* ── Identidad Institucional ── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ marginBottom: '16px' }}>
          <div className="badge" style={{ background: '#C0504D' }}>🏫</div>
          Identidad institucional
        </div>

        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '18px',
          padding: '14px 16px', borderRadius: '10px',
          background: '#fdf8f8', border: '1.5px solid #f0d0d0',
          marginBottom: '16px',
        }}>
          {school?.logo_url ? (
            <img
              src={school.logo_url}
              alt="Logo institucional"
              style={{ height: '64px', maxWidth: '120px', objectFit: 'contain', borderRadius: '6px' }}
            />
          ) : (
            <div style={{
              width: '80px', height: '64px', background: '#f0e8e8',
              borderRadius: '8px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '28px', color: '#c88',
            }}>
              🏫
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '13px', color: '#333', marginBottom: '6px' }}>
              Logo del colegio
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>
              Se muestra en todas las guías impresas. PNG, JPG o SVG · máx. 2 MB.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                style={{ display: 'none' }}
                onChange={handleLogoUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
                style={{
                  background: '#C0504D', color: '#fff', border: 'none',
                  borderRadius: '8px', padding: '7px 16px', fontSize: '12px',
                  fontWeight: 600, cursor: logoUploading ? 'default' : 'pointer',
                  opacity: logoUploading ? 0.7 : 1,
                }}>
                {logoUploading ? 'Subiendo…' : school?.logo_url ? '🔄 Cambiar logo' : '📤 Subir logo'}
              </button>
              {school?.logo_url && (
                <button
                  onClick={handleRemoveLogo}
                  style={{
                    background: '#fff', color: '#C0504D', border: '1px solid #C0504D',
                    borderRadius: '8px', padding: '7px 14px', fontSize: '12px',
                    fontWeight: 600, cursor: 'pointer',
                  }}>
                  🗑 Quitar logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* School data fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700,
              color: '#555', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '5px' }}>
              Nombre del colegio *
            </label>
            <input
              value={schoolForm.name}
              onChange={e => setSchoolForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Ej. Boston Flex — Educación Personalizada"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Código DANE</label>
            <input
              value={schoolForm.dane}
              onChange={e => setSchoolForm(p => ({ ...p, dane: e.target.value }))}
              placeholder="Ej. 11001012345"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Resolución de aprobación</label>
            <input
              value={schoolForm.resolution}
              onChange={e => setSchoolForm(p => ({ ...p, resolution: e.target.value }))}
              placeholder="Ej. Res. 2345 de 2020"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Código del documento (plan de estudios)</label>
            <input
              value={schoolForm.plan_code}
              onChange={e => setSchoolForm(p => ({ ...p, plan_code: e.target.value }))}
              placeholder="Ej. CBF-PE-2025"
              style={fieldStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Versión del documento</label>
            <input
              value={schoolForm.plan_version}
              onChange={e => setSchoolForm(p => ({ ...p, plan_version: e.target.value }))}
              placeholder="Ej. v3.1"
              style={fieldStyle}
            />
          </div>
        </div>

        <button
          onClick={handleSaveSchool}
          disabled={schoolSaving}
          style={{
            background: schoolSaving ? '#aaa' : '#C0504D', color: '#fff',
            border: 'none', borderRadius: '8px', padding: '10px 24px',
            fontSize: '13px', fontWeight: 700, cursor: schoolSaving ? 'default' : 'pointer',
          }}>
          {schoolSaving ? 'Guardando…' : '💾 Guardar datos institucionales'}
        </button>
        <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
          Estos datos se insertan en el encabezado de todas las guías al exportar.
        </div>
      </div>

      {/* ── Seguridad de acceso ── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="card-title" style={{ marginBottom: '16px' }}>
          <div className="badge" style={{ background: '#7B1A1A' }}>🔒</div>
          Seguridad de acceso
        </div>

        {/* Restrict email domain toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '14px 16px', borderRadius: '10px',
          background: restrictDomain ? '#fff0f0' : '#fafafa',
          border: `1px solid ${restrictDomain ? '#f0c0c0' : '#eee'}`,
          marginBottom: '12px', transition: 'all .2s',
        }}>
          <button
            onClick={() => handleDomainToggle(!restrictDomain)}
            disabled={domainSaving}
            style={{
              width: '44px', height: '24px', borderRadius: '12px', border: 'none',
              cursor: 'pointer', flexShrink: 0,
              background: restrictDomain ? '#C0504D' : '#ddd',
              position: 'relative', transition: 'background .2s',
              opacity: domainSaving ? 0.6 : 1,
            }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%', background: '#fff',
              position: 'absolute', top: '3px',
              left: restrictDomain ? '23px' : '3px',
              transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
            }} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '13px', fontWeight: 600,
              color: restrictDomain ? '#7B1A1A' : '#888',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              Restringir registro a dominio institucional
              {domainSaved && (
                <span style={{ fontSize: '10px', background: '#d4edda', color: '#155724',
                  padding: '1px 6px', borderRadius: '8px', fontWeight: 600 }}>
                  ✅ Guardado
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>
              Solo correos del dominio configurado podrán registrarse como docentes.
              {!restrictDomain && (
                <span style={{ color: '#C0504D', fontWeight: 600 }}> Actualmente cualquier email puede registrarse.</span>
              )}
            </div>
          </div>
          <span style={{
            fontSize: '10px', fontWeight: 700, flexShrink: 0,
            padding: '3px 10px', borderRadius: '10px',
            background: restrictDomain ? '#fdd0d0' : '#f0f0f0',
            color: restrictDomain ? '#C0504D' : '#aaa',
          }}>
            {domainSaving ? '…' : restrictDomain ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        {/* Email domain input */}
        <div style={{
          padding: '14px 16px', borderRadius: '10px',
          background: '#fdf8f8', border: '1.5px dashed #f0d0d0',
        }}>
          <label style={{ display: 'block', ...labelStyle, marginBottom: '8px' }}>
            Dominio de email permitido
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>@</span>
            <input
              value={domainInput}
              onChange={e => setDomainInput(e.target.value)}
              placeholder="redboston.edu.co"
              style={{ ...fieldStyle, flex: 1, minWidth: '180px', maxWidth: '320px' }}
            />
            <button
              onClick={handleSaveDomain}
              disabled={domainSaving}
              style={{
                background: '#7B1A1A', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '8px 18px', fontSize: '12px',
                fontWeight: 700, cursor: domainSaving ? 'default' : 'pointer',
                opacity: domainSaving ? 0.7 : 1,
              }}>
              {domainSaving ? '…' : '💾 Guardar dominio'}
            </button>
          </div>
          <div style={{ fontSize: '11px', color: '#aaa', marginTop: '8px' }}>
            Solo la parte después del @. Ej: <code>redboston.edu.co</code> para bloquear gmail, hotmail, etc.
            Para pruebas, desactiva el toggle de arriba.
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '11px', color: '#bbb', padding: '8px', marginTop: '4px' }}>
        Los cambios en identidad institucional se reflejan en guías nuevas. Los datos del colegio se aplican globalmente.
      </div>
    </div>
  )
}

// ── Shared micro-styles ───────────────────────────────────────────────────────
const fieldStyle = {
  width: '100%', padding: '8px 12px',
  border: '1px solid #d0d8e8', borderRadius: '8px',
  fontSize: '13px', background: '#fff', boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 700,
  color: '#555', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '5px',
}
