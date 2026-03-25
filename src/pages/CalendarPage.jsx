import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

const TYPE_CONFIG = {
  holiday_national: { label: 'Festivo nacional',   emoji: '🇨🇴', color: '#fff0f0', text: '#cc3333' },
  holiday_regional: { label: 'Festivo regional',   emoji: '🎊',  color: '#fff4e0', text: '#b36200' },
  suspension:       { label: 'Suspensión',          emoji: '🚫',  color: '#ffe0e0', text: '#cc0000' },
  special_event:    { label: 'Evento especial',     emoji: '⭐',  color: '#e8f5d6', text: '#3a6b1a' },
  holiday_local:    { label: 'Festivo local',       emoji: '📍',  color: '#f0e8ff', text: '#6b3aaa' },
}

function toISO(dateStr) {
  // Ensure we use the date as-is (already YYYY-MM-DD from Supabase)
  return dateStr
}

function formatDateES(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${d} de ${MONTHS_ES[m - 1]} de ${y}`
}

const BLANK_FORM = {
  date:          '',
  type:          'suspension',
  name:          '',
  is_school_day: false,
}

export default function CalendarPage({ teacher }) {
  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(BLANK_FORM)
  const [saving,     setSaving]     = useState(false)
  const [deleteId,   setDeleteId]   = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterMonth,setFilterMonth]= useState('all')

  useEffect(() => { fetchEntries() }, [])

  async function fetchEntries() {
    setLoading(true)
    const { data } = await supabase
      .from('school_calendar')
      .select('*')
      .eq('school_id', teacher.school_id)
      .order('date', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }

  function handleFormChange(field, value) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-set is_school_day based on type
      if (field === 'type') {
        next.is_school_day = value === 'special_event'
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.date || !form.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('school_calendar').insert({
      school_id:     teacher.school_id,
      date:          form.date,
      type:          form.type,
      name:          form.name.trim(),
      is_school_day: form.is_school_day,
    })
    setSaving(false)
    if (!error) {
      setShowForm(false)
      setForm(BLANK_FORM)
      fetchEntries()
    }
  }

  async function handleDelete(id) {
    await supabase.from('school_calendar').delete().eq('id', id)
    setDeleteId(null)
    fetchEntries()
  }

  // Filters
  const filtered = entries.filter(e => {
    const monthMatch  = filterMonth === 'all' || e.date.slice(5, 7) === filterMonth
    const typeMatch   = filterType  === 'all' || e.type === filterType
    return monthMatch && typeMatch
  })

  // Group by month
  const grouped = filtered.reduce((acc, e) => {
    const month = e.date.slice(0, 7) // YYYY-MM
    if (!acc[month]) acc[month] = []
    acc[month].push(e)
    return acc
  }, {})

  const isEditable = (type) => type !== 'holiday_national'

  return (
    <div className="planner-wrap">
      <div className="card">
        <div className="card-title">
          <div className="badge">📅</div>
          Calendario Institucional
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#9BBB59', fontWeight: 700 }}>
            🔒 Solo administradores
          </span>
        </div>

        {/* ── Toolbar ── */}
        <div className="cal-toolbar">
          <div className="cal-filters">
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="all">Todos los meses</option>
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1).padStart(2, '0')
                return <option key={m} value={m}>{MONTHS_ES[i]}</option>
              })}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">Todos los tipos</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.emoji} {v.label}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={() => { setShowForm(true); setForm(BLANK_FORM) }}>
            + Agregar día especial
          </button>
        </div>

        {/* ── Add form ── */}
        {showForm && (
          <div className="cal-form-box">
            <div className="cal-form-title">➕ Nuevo día en el calendario</div>
            <div className="g2" style={{ marginBottom: '10px' }}>
              <div className="form-field">
                <label>Fecha</label>
                <input type="date" value={form.date}
                  onChange={e => handleFormChange('date', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Tipo</label>
                <select value={form.type} onChange={e => handleFormChange('type', e.target.value)}>
                  {Object.entries(TYPE_CONFIG)
                    .filter(([k]) => k !== 'holiday_national') // no crear festivos nacionales manualmente
                    .map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="form-field">
              <label>Descripción</label>
              <input type="text" value={form.name}
                placeholder="Ej: Suspensión de clases por lluvia"
                onChange={e => handleFormChange('name', e.target.value)} />
            </div>
            <div className="form-field">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={form.is_school_day}
                  onChange={e => handleFormChange('is_school_day', e.target.checked)}
                  style={{ width: 'auto', accentColor: '#9BBB59' }} />
                <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '12px', fontWeight: 600 }}>
                  Es día de clase (marcar solo para eventos especiales con clases normales)
                </span>
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button className="btn-primary btn-save" onClick={handleSave} disabled={saving || !form.date || !form.name.trim()}>
                {saving ? '⏳ Guardando...' : '💾 Guardar'}
              </button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {/* ── Calendar entries ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '30px', color: '#aaa' }}>Cargando calendario…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">No hay entradas para los filtros seleccionados.</div>
        ) : (
          Object.entries(grouped).map(([monthKey, items]) => {
            const [y, m] = monthKey.split('-').map(Number)
            return (
              <div key={monthKey} className="cal-month-group">
                <div className="cal-month-header">
                  {MONTHS_ES[m - 1]} {y}
                  <span className="cal-month-count">{items.length} entrada{items.length !== 1 ? 's' : ''}</span>
                </div>
                {items.map(entry => {
                  const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.suspension
                  const editable = isEditable(entry.type)
                  return (
                    <div key={entry.id} className="cal-entry"
                      style={{ borderLeftColor: cfg.text, background: cfg.color }}>
                      <div className="cal-entry-left">
                        <div className="cal-entry-emoji">{cfg.emoji}</div>
                        <div>
                          <div className="cal-entry-name">{entry.name}</div>
                          <div className="cal-entry-meta">
                            <span>{formatDateES(entry.date)}</span>
                            <span className="cal-entry-type-badge"
                              style={{ background: cfg.text, color: '#fff' }}>
                              {cfg.label}
                            </span>
                            {!entry.is_school_day && (
                              <span className="cal-entry-type-badge" style={{ background: '#888', color: '#fff' }}>
                                Sin clases
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {editable && (
                        <div className="cal-entry-actions">
                          {deleteId === entry.id ? (
                            <>
                              <span style={{ fontSize: '11px', color: '#cc3333', fontWeight: 700 }}>¿Eliminar?</span>
                              <button className="btn-cal-confirm" onClick={() => handleDelete(entry.id)}>Sí</button>
                              <button className="btn-cal-cancel"  onClick={() => setDeleteId(null)}>No</button>
                            </>
                          ) : (
                            <button className="btn-icon-danger" onClick={() => setDeleteId(entry.id)}
                              title="Eliminar">🗑</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
