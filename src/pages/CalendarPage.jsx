import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { LEVEL_LABELS } from '../utils/roles'
import { useToast } from '../context/ToastContext'

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

// ── Colombia national holidays (Ley Emiliani) ──────────────────────────────
function getEasterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day   = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function nextMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  if (day === 1) return d
  d.setDate(d.getDate() + (day === 0 ? 1 : 8 - day))
  return d
}

function colombiaHolidays(year) {
  const easter = getEasterDate(year)
  const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r }
  const iso  = d => d.toISOString().slice(0, 10)
  const pad  = n => String(n).padStart(2, '0')
  const fixed = (m, d) => `${year}-${pad(m)}-${pad(d)}`
  return [
    { date: fixed(1, 1),                                        name: 'Año Nuevo' },
    { date: iso(nextMonday(new Date(year, 0, 6))),               name: 'Reyes Magos' },
    { date: iso(nextMonday(new Date(year, 2, 19))),              name: 'San José' },
    { date: iso(addDays(easter, -3)),                            name: 'Jueves Santo' },
    { date: iso(addDays(easter, -2)),                            name: 'Viernes Santo' },
    { date: fixed(5, 1),                                         name: 'Día del Trabajo' },
    { date: iso(nextMonday(addDays(easter, 39))),                 name: 'Ascensión del Señor' },
    { date: iso(nextMonday(addDays(easter, 59))),                 name: 'Corpus Christi' },
    { date: iso(nextMonday(addDays(easter, 67))),                 name: 'Sagrado Corazón de Jesús' },
    { date: iso(nextMonday(new Date(year, 5, 29))),              name: 'San Pedro y San Pablo' },
    { date: fixed(7, 20),                                        name: 'Día de la Independencia' },
    { date: fixed(8, 7),                                         name: 'Batalla de Boyacá' },
    { date: iso(nextMonday(new Date(year, 7, 15))),              name: 'Asunción de la Virgen' },
    { date: iso(nextMonday(new Date(year, 9, 12))),              name: 'Día de la Raza' },
    { date: iso(nextMonday(new Date(year, 10, 1))),              name: 'Todos los Santos' },
    { date: iso(nextMonday(new Date(year, 10, 11))),             name: 'Independencia de Cartagena' },
    { date: fixed(12, 8),                                        name: 'Inmaculada Concepción' },
    { date: fixed(12, 25),                                       name: 'Navidad' },
  ]
}

function formatDateES(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${d} de ${MONTHS_ES[m - 1]} de ${y}`
}

const LEVEL_OPTIONS = [
  { value: '',            label: 'Todos los niveles' },
  { value: 'elementary',  label: LEVEL_LABELS.elementary },
  { value: 'middle',      label: LEVEL_LABELS.middle },
  { value: 'high',        label: LEVEL_LABELS.high },
]

const BLANK_FORM = {
  date:             '',
  type:             'suspension',
  name:             '',
  is_school_day:    false,
  level:            '',
  affects_planning: false,
}

export default function CalendarPage({ teacher }) {
  const { showToast } = useToast()
  const [entries,    setEntries]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(BLANK_FORM)
  const [saving,     setSaving]     = useState(false)
  const [deleteId,   setDeleteId]   = useState(null)
  const [filterType,  setFilterType]  = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [filterLevel, setFilterLevel] = useState('all')
  const [holidayYear,    setHolidayYear]    = useState(new Date().getFullYear())
  const [holidayPreview, setHolidayPreview] = useState(null) // null=hidden, array=to import
  const [loadingHolidays, setLoadingHolidays] = useState(false)

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
    const { data: saved, error } = await supabase.from('school_calendar').insert({
      school_id:        teacher.school_id,
      date:             form.date,
      type:             form.type,
      name:             form.name.trim(),
      is_school_day:    form.is_school_day,
      level:            form.level || null,
      affects_planning: form.affects_planning,
    }).select().single()
    if (!error && form.affects_planning && saved) {
      await createCalendarAnnouncement(saved)
    }
    setSaving(false)
    if (error) {
      console.error('school_calendar insert error:', error)
      const msg = error.code === '23505'
        ? 'Ya existe una entrada para esa fecha.'
        : `Error ${error.code || ''}: ${error.message || 'desconocido'}`
      showToast(msg, 'error')
      return
    }
    setShowForm(false)
    setForm(BLANK_FORM)
    fetchEntries()
  }

  async function createCalendarAnnouncement(entry) {
    const levelLabel = entry.level ? LEVEL_LABELS[entry.level] : 'todos los niveles'
    const dateStr = formatDateES(entry.date)
    const typeCfg = TYPE_CONFIG[entry.type]
    await supabase.from('announcements').insert({
      school_id:   teacher.school_id,
      author_id:   teacher.id,
      title:       `⚠️ Afecta planificación: ${entry.name}`,
      body:        `El ${dateStr} ha sido marcado como "${typeCfg?.label || entry.type}" (${levelLabel}). Revisa tus guías de esa semana y ajusta el contenido si es necesario.`,
      target_role: 'teacher',
    })
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('school_calendar').delete().eq('id', id)
    if (error) { showToast('Error al eliminar el evento', 'error'); return }
    setDeleteId(null)
    fetchEntries()
  }

  function prepareHolidayImport() {
    const all = colombiaHolidays(holidayYear)
    const existing = new Set(entries.map(e => e.date))
    setHolidayPreview(all.filter(h => !existing.has(h.date)))
  }

  async function confirmHolidayImport() {
    if (!holidayPreview?.length) { setHolidayPreview(null); return }
    setLoadingHolidays(true)
    const rows = holidayPreview.map(h => ({
      school_id:        teacher.school_id,
      date:             h.date,
      type:             'holiday_national',
      name:             h.name,
      is_school_day:    false,
      level:            null,
      affects_planning: false,
    }))
    const { error } = await supabase.from('school_calendar').insert(rows)
    setLoadingHolidays(false)
    if (error) {
      const msg = error.code === '23505'
        ? 'Algunos festivos ya existían. Elimínalos primero e intenta de nuevo.'
        : (error.message || 'Error al importar festivos')
      showToast(msg, 'error')
      return
    }
    showToast(`✓ ${holidayPreview.length} festivos nacionales de ${holidayYear} agregados`, 'success')
    setHolidayPreview(null)
    fetchEntries()
  }

  // Filters
  const filtered = entries.filter(e => {
    const monthMatch = filterMonth === 'all' || e.date.slice(5, 7) === filterMonth
    const typeMatch  = filterType  === 'all' || e.type === filterType
    const levelMatch = filterLevel === 'all' || (e.level || '') === filterLevel
    return monthMatch && typeMatch && levelMatch
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
            <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}>
              <option value="all">Todos los niveles</option>
              {LEVEL_OPTIONS.filter(o => o.value).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={() => { setShowForm(true); setForm(BLANK_FORM) }}>
            + Agregar día especial
          </button>
        </div>

        {/* ── Colombia holidays import ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: '#fff8f0', border: '1px solid #f59e0b40',
          borderRadius: 10, padding: '10px 16px', marginBottom: 14,
        }}>
          <span style={{ fontSize: 20 }}>🇨🇴</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
            Festivos nacionales Colombia
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <button
              onClick={() => setHolidayYear(y => y - 1)}
              style={{ border: '1px solid #d97706', borderRadius: 5, background: 'transparent', color: '#92400e', padding: '3px 8px', cursor: 'pointer', fontWeight: 700 }}>
              ‹
            </button>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#92400e', minWidth: 42, textAlign: 'center' }}>{holidayYear}</span>
            <button
              onClick={() => setHolidayYear(y => y + 1)}
              style={{ border: '1px solid #d97706', borderRadius: 5, background: 'transparent', color: '#92400e', padding: '3px 8px', cursor: 'pointer', fontWeight: 700 }}>
              ›
            </button>
            <button
              onClick={prepareHolidayImport}
              style={{ padding: '5px 14px', borderRadius: 7, border: 'none', background: '#d97706', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Cargar festivos
            </button>
          </div>
        </div>

        {/* Preview panel */}
        {holidayPreview !== null && (
          <div style={{
            background: '#fffbeb', border: '1px solid #f59e0b',
            borderRadius: 10, padding: '14px 16px', marginBottom: 14,
          }}>
            {holidayPreview.length === 0 ? (
              <div style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                ✓ Todos los festivos nacionales de {holidayYear} ya están en el calendario.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e', marginBottom: 10 }}>
                  Se agregarán {holidayPreview.length} festivos de {holidayYear}:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {holidayPreview.map(h => (
                    <span key={h.date} style={{
                      fontSize: 11, background: '#fff0d0', border: '1px solid #f59e0b',
                      borderRadius: 5, padding: '2px 9px', color: '#92400e', fontWeight: 600,
                    }}>
                      🇨🇴 {h.name} · {new Date(h.date + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </span>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {holidayPreview.length > 0 && (
                <button
                  onClick={confirmHolidayImport}
                  disabled={loadingHolidays}
                  style={{ padding: '6px 18px', borderRadius: 7, border: 'none', background: '#d97706', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {loadingHolidays ? '⏳ Importando…' : `✓ Confirmar importación`}
                </button>
              )}
              <button
                onClick={() => setHolidayPreview(null)}
                style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid #d97706', background: 'transparent', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

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
                    .filter(([k]) => k !== 'holiday_national')
                    .map(([k, v]) => (
                      <option key={k} value={k}>{v.emoji} {v.label}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="g2" style={{ marginBottom: '10px' }}>
              <div className="form-field">
                <label>Descripción</label>
                <input type="text" value={form.name}
                  placeholder="Ej: Suspensión de clases por lluvia"
                  onChange={e => handleFormChange('name', e.target.value)} />
              </div>
              <div className="form-field">
                <label>Nivel educativo</label>
                <select value={form.level} onChange={e => handleFormChange('level', e.target.value)}>
                  {LEVEL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={form.is_school_day}
                  onChange={e => handleFormChange('is_school_day', e.target.checked)}
                  style={{ width: 'auto', accentColor: '#9BBB59' }} />
                <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '12px', fontWeight: 600 }}>
                  Es día de clase
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={form.affects_planning}
                  onChange={e => handleFormChange('affects_planning', e.target.checked)}
                  style={{ width: 'auto', accentColor: '#8064A2' }} />
                <span style={{ textTransform: 'none', letterSpacing: 0, fontSize: '12px', fontWeight: 600, color: '#8064A2' }}>
                  ⚠️ Afecta planificación (notifica a docentes)
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
                            {entry.level && (
                              <span className="cal-entry-type-badge" style={{ background: '#4BACC6', color: '#fff' }}>
                                {LEVEL_LABELS[entry.level]}
                              </span>
                            )}
                            {!entry.is_school_day && (
                              <span className="cal-entry-type-badge" style={{ background: '#888', color: '#fff' }}>
                                Sin clases
                              </span>
                            )}
                            {entry.affects_planning && (
                              <span className="cal-entry-type-badge" style={{ background: '#8064A2', color: '#fff' }}>
                                ⚠️ Afecta guías
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
