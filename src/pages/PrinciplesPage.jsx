// ── PrinciplesPage.jsx ────────────────────────────────────────────────────────
// Gestión de los principios rectores institucionales:
//   1. Versículo del Año  (schools.year_verse — anual)
//   2. Versículo del Mes  (school_monthly_principles — mensual)
// NOTA: El Principio del Indicador se ingresa por proyecto en NewsProjectEditor
//       (step "Fechas") → fields biblical_principle + indicator_verse_ref

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

export default function PrinciplesPage({ teacher }) {
  const school      = teacher.schools || {}
  const { showToast } = useToast()

  const now       = new Date()
  const thisYear  = now.getFullYear()
  const thisMonth = now.getMonth() + 1 // 1-12

  // ── State ──
  const [yearVerse,    setYearVerse]    = useState(school.year_verse     || '')
  const [yearVerseRef, setYearVerseRef] = useState(school.year_verse_ref || '')
  const [savingYear,   setSavingYear]   = useState(false)

  const [monthly,      setMonthly]      = useState({}) // { "YYYY-MM": { month_verse, month_verse_ref, indicator_principle } }
  const [editing,      setEditing]      = useState(null) // "YYYY-MM"
  const [editForm,     setEditForm]     = useState({})
  const [savingMonth,  setSavingMonth]  = useState(false)

  // ── Load all monthly principles for this year ──
  useEffect(() => {
    loadMonthly()
  }, [])

  async function loadMonthly() {
    const { data } = await supabase
      .from('school_monthly_principles')
      .select('*')
      .eq('school_id', teacher.school_id)
      .eq('year', thisYear)
    if (data) {
      const map = {}
      data.forEach(row => {
        map[`${row.year}-${String(row.month).padStart(2,'0')}`] = row
      })
      setMonthly(map)
    }
  }

  // ── Save year verse ──
  async function saveYearVerse() {
    const existing = school.year_verse?.trim()
    if (existing && !yearVerse.trim()) {
      showToast('El versículo del año ya está configurado y no puede borrarse.', 'warning')
      return
    }
    setSavingYear(true)
    const { error } = await supabase
      .from('schools')
      .update({ year_verse: yearVerse.trim(), year_verse_ref: yearVerseRef.trim() })
      .eq('id', teacher.school_id)
    setSavingYear(false)
    if (error) showToast('Error al guardar el versículo del año', 'error')
    else showToast('Versículo del año guardado', 'success')
  }

  // ── Open month editor ──
  function openMonth(year, month) {
    const key = `${year}-${String(month).padStart(2,'0')}`
    const row = monthly[key] || {}
    setEditing(key)
    setEditForm({
      month_verse:     row.month_verse     || '',
      month_verse_ref: row.month_verse_ref || '',
    })
  }

  // ── Save monthly principles ──
  async function saveMonth() {
    if (!editing) return
    const [y, m] = editing.split('-').map(Number)
    const existing = monthly[editing] || {}

    // Protect: don't allow clearing a verse that was already set
    if (existing.month_verse?.trim() && !editForm.month_verse.trim()) {
      showToast('El versículo del mes ya configurado no puede borrarse accidentalmente.', 'warning')
      return
    }

    setSavingMonth(true)
    const payload = {
      school_id:       teacher.school_id,
      year:            y,
      month:           m,
      month_verse:     editForm.month_verse.trim(),
      month_verse_ref: editForm.month_verse_ref.trim(),
      updated_by:      teacher.id,
      updated_at:      new Date().toISOString(),
    }
    const { error } = await supabase
      .from('school_monthly_principles')
      .upsert(payload, { onConflict: 'school_id,year,month' })
    setSavingMonth(false)
    if (error) {
      showToast('Error al guardar', 'error')
    } else {
      showToast(`Principios de ${MONTHS[m-1]} guardados`, 'success')
      setMonthly(prev => ({ ...prev, [editing]: payload }))
      setEditing(null)
    }
  }

  function monthKey(month) {
    return `${thisYear}-${String(month).padStart(2,'0')}`
  }

  function hasData(month) {
    const d = monthly[monthKey(month)]
    return d && !!d.month_verse
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#f4f6fb' }}>

      {/* ── Top bar ── */}
      <div className="ge-topbar">
        <div className="ge-topbar-info">
          <span className="ge-guide-title">📖 Principios Rectores</span>
          <span className="ge-guide-dates">{school.name || 'Mi Colegio'}</span>
        </div>
      </div>

      <div style={{ padding: '20px 28px', maxWidth: '860px', margin: '0 auto', width: '100%' }}>

        {/* ── Intro ── */}
        <div style={{
          background: '#fffbf0', border: '1px solid #C9A84C', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: '#5a4000', lineHeight: 1.6,
        }}>
          Estos dos principios son el norte institucional de toda planificación y actividad.
          La IA los usará en cada guía y logro que genere.
          El <strong>Principio del Indicador</strong> se define por proyecto directamente en <em>NEWS → Fechas</em>.
        </div>

        {/* ── 1. Versículo del Año ── */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-title" style={{ color: '#C9A84C' }}>
            📖 Versículo del Año — {thisYear}
          </div>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            El versículo que rige todo el año escolar. Lo establece el Capellán de la institución.
          </p>
          <div className="ge-field">
            <label>Texto del versículo</label>
            <textarea
              value={yearVerse}
              onChange={e => setYearVerse(e.target.value)}
              rows={3}
              className="ge-input"
              placeholder='"Jehová es mi pastor; nada me faltará." — Salmos 23:1'
              style={{ resize: 'vertical' }}
            />
          </div>
          <div className="ge-field">
            <label>Referencia bíblica</label>
            <input
              type="text"
              value={yearVerseRef}
              onChange={e => setYearVerseRef(e.target.value)}
              className="ge-input"
              placeholder="Salmos 23:1 (RVR60)"
            />
          </div>
          <button
            className="btn-primary"
            onClick={saveYearVerse}
            disabled={savingYear}
            style={{ marginTop: '4px' }}
          >
            {savingYear ? '⏳ Guardando…' : '💾 Guardar versículo del año'}
          </button>
        </div>

        {/* ── 2 & 3. Principios Mensuales ── */}
        <div className="card">
          <div className="card-title" style={{ color: '#2E5598' }}>
            🗓 Versículo del Mes — {thisYear}
          </div>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
            Lo establece el Capellán cada mes. Selecciona un mes para editarlo.
          </p>

          {/* Month grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px',
            marginBottom: '20px',
          }}>
            {MONTHS.map((name, idx) => {
              const month   = idx + 1
              const isCurrent = month === thisMonth
              const done    = hasData(month)
              return (
                <button
                  key={month}
                  onClick={() => openMonth(thisYear, month)}
                  style={{
                    padding: '12px 10px', borderRadius: '8px', border: 'none',
                    background: editing === monthKey(month)
                      ? '#2E5598' : isCurrent ? '#e8eef8' : '#f5f7fa',
                    color: editing === monthKey(month) ? '#fff' : isCurrent ? '#2E5598' : '#444',
                    cursor: 'pointer', textAlign: 'left',
                    boxShadow: isCurrent ? '0 0 0 2px #2E5598' : 'none',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>
                    {name}
                    {isCurrent && <span style={{ fontSize: '10px', marginLeft: '6px', opacity: .7 }}>← actual</span>}
                  </div>
                  <div style={{ fontSize: '11px', opacity: .75 }}>
                    {done ? '✅ Configurado' : '— Sin configurar'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Edit panel */}
          {editing && (
            <div style={{
              background: '#f8faff', border: '1px solid #c5d5f0', borderRadius: '10px',
              padding: '16px 18px',
            }}>
              <div style={{ fontWeight: 700, color: '#2E5598', marginBottom: '14px', fontSize: '14px' }}>
                ✏️ {MONTHS[parseInt(editing.split('-')[1]) - 1]} {editing.split('-')[0]}
              </div>

              <div className="ge-field">
                <label>Versículo del Mes — texto</label>
                <textarea
                  value={editForm.month_verse}
                  onChange={e => setEditForm(f => ({ ...f, month_verse: e.target.value }))}
                  rows={3}
                  className="ge-input"
                  placeholder='"Then the Lord God provided a gourd and made it grow up over Jonah…" — Jonah 4:6'
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="ge-field">
                <label>Referencia bíblica</label>
                <input
                  type="text"
                  value={editForm.month_verse_ref}
                  onChange={e => setEditForm(f => ({ ...f, month_verse_ref: e.target.value }))}
                  className="ge-input"
                  placeholder="Jonah 4:6 (NIV)"
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  className="btn-primary"
                  onClick={saveMonth}
                  disabled={savingMonth}
                >
                  {savingMonth ? '⏳ Guardando…' : '💾 Guardar'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setEditing(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
