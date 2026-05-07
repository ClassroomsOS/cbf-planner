/**
 * AcademicCalendarPage — Coordinación Académica
 *
 * Acceso: admin, superadmin, rector
 *
 * Pestañas:
 *   1. Períodos  — configura fechas inicio/fin de cada período
 *   2. Cronograma — administra eventos del período seleccionado
 *   3. Comunicado — previsualiza e imprime el comunicado docentes
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { ACADEMIC_PERIODS } from '../utils/constants'

const CURRENT_YEAR = new Date().getFullYear()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function isoToDate(iso) {
  return iso ? new Date(iso + 'T12:00:00') : null
}

function dateToIso(date) {
  if (!date) return ''
  const d = new Date(date + 'T12:00:00')
  return d.toISOString().slice(0, 10)
}

function formatDateEs(iso, { weekday, full } = {}) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  const opts = full
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : weekday
      ? { weekday: 'short', day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'long' }
  return d.toLocaleDateString('es-CO', opts)
}

function formatDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })
}

/** Returns Monday of the week containing `date` */
function weekMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

/** Calculate school weeks for a period, marking holiday interruptions */
function calculateWeeks(startIso, endIso, holidayIsos = []) {
  if (!startIso || !endIso) return []
  const start   = new Date(startIso + 'T12:00:00')
  const end     = new Date(endIso   + 'T12:00:00')
  const holidays = new Set(holidayIsos)

  // Start from the Monday of the period's first week
  const cursor = weekMonday(start)
  const weeks  = []
  let weekNum  = 1

  while (cursor <= end) {
    const monday = new Date(cursor)
    const friday = new Date(cursor)
    friday.setDate(friday.getDate() + 4)

    const weekStart = monday < start ? start : monday
    const weekEnd   = friday > end   ? end   : friday

    // Gather holidays that fall in this week
    const weekHols = []
    for (let d = new Date(monday); d <= friday; d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().slice(0, 10)
      if (holidays.has(iso)) weekHols.push(iso)
    }

    weeks.push({
      weekNum,
      start: monday.toISOString().slice(0, 10),
      end:   friday.toISOString().slice(0, 10),
      displayStart: weekStart.toISOString().slice(0, 10),
      displayEnd:   weekEnd.toISOString().slice(0, 10),
      holidays: weekHols,
      isPartial: monday < start || friday > end,
    })

    weekNum++
    cursor.setDate(cursor.getDate() + 7)
  }

  return weeks
}

/** Current week number within the period */
function currentWeekNum(weeks) {
  const today = new Date().toISOString().slice(0, 10)
  const found = weeks.find(w => w.start <= today && today <= w.end)
  return found?.weekNum ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function AcademicCalendarPage({ teacher }) {
  const { showToast } = useToast()
  const [tab, setTab] = useState('periods')

  // Period configs from DB (one per period)
  const [configs,     setConfigs]     = useState([])   // academic_period_config rows
  const [savingPeriod, setSavingPeriod] = useState(null)

  // Events (school_calendar rows)
  const [selectedPeriod, setSelectedPeriod] = useState(1)
  const [events,   setEvents]   = useState([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Event form
  const [eventForm, setEventForm] = useState(null) // null = closed
  const [savingEvent, setSavingEvent] = useState(false)

  useEffect(() => { fetchConfigs() }, [])
  useEffect(() => { if (tab === 'events' || tab === 'communicado') fetchEvents() }, [tab, selectedPeriod])

  async function fetchConfigs() {
    const { data } = await supabase
      .from('academic_period_config')
      .select('*')
      .eq('school_id', teacher.school_id)
      .eq('year', CURRENT_YEAR)
      .order('period')
    setConfigs(data || [])
  }

  async function fetchEvents() {
    setLoadingEvents(true)
    const { data } = await supabase
      .from('school_calendar')
      .select('*')
      .eq('school_id', teacher.school_id)
      .eq('period', selectedPeriod)
      .order('date')
    setEvents(data || [])
    setLoadingEvents(false)
  }

  // ── Period config save ────────────────────────────────────────────────────

  async function savePeriod(periodNum, fields) {
    setSavingPeriod(periodNum)
    const payload = {
      school_id:   teacher.school_id,
      year:        CURRENT_YEAR,
      period:      periodNum,
      created_by:  teacher.id,
      ...fields,
    }
    const existing = configs.find(c => c.period === periodNum)
    let err
    if (existing) {
      ;({ error: err } = await supabase
        .from('academic_period_config')
        .update(payload)
        .eq('id', existing.id))
    } else {
      ;({ error: err } = await supabase
        .from('academic_period_config')
        .insert(payload))
    }
    if (err) { showToast('Error al guardar el período', 'error') }
    else      { showToast('Período guardado', 'success'); fetchConfigs() }
    setSavingPeriod(null)
  }

  // ── Event CRUD ────────────────────────────────────────────────────────────

  function openEventForm(ev = null) {
    setEventForm(ev ?? {
      name: '', date: '', time_slot: '', organizer: '',
      notes: '', no_class: false, period: selectedPeriod,
    })
  }

  async function saveEvent() {
    if (!eventForm.name || !eventForm.date) {
      showToast('Nombre y fecha son obligatorios', 'error')
      return
    }
    setSavingEvent(true)
    const payload = {
      school_id:  teacher.school_id,
      period:     selectedPeriod,
      name:       eventForm.name,
      date:       eventForm.date,
      time_slot:  eventForm.time_slot || null,
      organizer:  eventForm.organizer || null,
      notes:      eventForm.notes     || null,
      no_class:   eventForm.no_class  ?? false,
      event_type: eventForm.no_class ? 'holiday' : 'event',
      type:       eventForm.no_class ? 'holiday' : 'event',
      is_school_day: !eventForm.no_class,
      affects_planning: true,
      created_by: teacher.id,
    }
    let err
    if (eventForm.id) {
      ;({ error: err } = await supabase
        .from('school_calendar').update(payload).eq('id', eventForm.id))
    } else {
      ;({ error: err } = await supabase
        .from('school_calendar').insert(payload))
    }
    if (err) { showToast('Error al guardar', 'error') }
    else     { showToast('Evento guardado', 'success'); setEventForm(null); fetchEvents() }
    setSavingEvent(false)
  }

  async function deleteEvent(id) {
    if (!window.confirm('¿Eliminar este evento?')) return
    await supabase.from('school_calendar').delete().eq('id', id)
    showToast('Evento eliminado', 'success')
    fetchEvents()
  }

  // ── Derived data for Comunicado ───────────────────────────────────────────

  const activeConfig = configs.find(c => c.period === selectedPeriod)
  const noClassDates = events.filter(e => e.no_class).map(e => e.date)
  const weeks = useMemo(
    () => calculateWeeks(activeConfig?.start_date, activeConfig?.end_date, noClassDates),
    [activeConfig?.start_date, activeConfig?.end_date, noClassDates.join(',')]
  )
  const curWeek = currentWeekNum(weeks)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="acp-page">
      <div className="acp-header">
        <div>
          <h1 className="acp-title">Calendario Académico</h1>
          <p className="acp-subtitle">Coordinación Académica · {CURRENT_YEAR}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="acp-tabs">
        {[
          { key: 'periods',    label: '📅 Períodos'   },
          { key: 'events',     label: '📋 Cronograma' },
          { key: 'communicado',label: '🖨 Comunicado'  },
        ].map(t => (
          <button key={t.key}
            className={`acp-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Períodos ── */}
      {tab === 'periods' && (
        <div className="acp-section">
          <p className="acp-hint">
            Define las fechas de inicio y fin de cada período académico.
            Estas fechas determinan las semanas del comunicado y la vista de progreso del sistema.
          </p>
          <div className="acp-periods-grid">
            {ACADEMIC_PERIODS.map(p => (
              <PeriodCard
                key={p.value}
                period={p}
                config={configs.find(c => c.period === parseInt(p.value))}
                saving={savingPeriod === parseInt(p.value)}
                onSave={(fields) => savePeriod(parseInt(p.value), fields)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Cronograma ── */}
      {tab === 'events' && (
        <div className="acp-section">
          {/* Period selector */}
          <div className="acp-period-tabs">
            {ACADEMIC_PERIODS.map(p => (
              <button key={p.value}
                className={`acp-period-tab ${selectedPeriod === parseInt(p.value) ? 'active' : ''}`}
                onClick={() => setSelectedPeriod(parseInt(p.value))}>
                {p.short}
              </button>
            ))}
            <button className="acp-add-btn" onClick={() => openEventForm()}>
              + Agregar evento
            </button>
          </div>

          {loadingEvents ? (
            <div className="acp-loading">Cargando…</div>
          ) : events.length === 0 ? (
            <div className="acp-empty">
              <p>No hay eventos para {ACADEMIC_PERIODS.find(p => parseInt(p.value) === selectedPeriod)?.label}.</p>
              <button className="acp-add-btn" onClick={() => openEventForm()}>
                + Agregar el primer evento
              </button>
            </div>
          ) : (
            <div className="acp-events-table-wrap">
              <table className="acp-events-table">
                <thead>
                  <tr>
                    <th>Evento / Actividad</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Organiza</th>
                    <th>Observaciones</th>
                    <th>Sin clase</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => (
                    <tr key={ev.id} className={ev.no_class ? 'acp-row-holiday' : ''}>
                      <td className="acp-td-name">{ev.name}</td>
                      <td className="acp-td-date">{formatDateShort(ev.date)}</td>
                      <td>{ev.time_slot || '—'}</td>
                      <td>{ev.organizer || '—'}</td>
                      <td className="acp-td-notes">{ev.notes || '—'}</td>
                      <td>{ev.no_class ? '🚫' : ''}</td>
                      <td className="acp-td-actions">
                        <button className="acp-btn-icon" onClick={() => openEventForm(ev)} title="Editar">✎</button>
                        <button className="acp-btn-icon acp-btn-del" onClick={() => deleteEvent(ev.id)} title="Eliminar">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Comunicado ── */}
      {tab === 'communicado' && (
        <div className="acp-section">
          <div className="acp-period-tabs">
            {ACADEMIC_PERIODS.map(p => (
              <button key={p.value}
                className={`acp-period-tab ${selectedPeriod === parseInt(p.value) ? 'active' : ''}`}
                onClick={() => setSelectedPeriod(parseInt(p.value))}>
                {p.short}
              </button>
            ))}
            <button className="acp-print-btn" onClick={() => window.print()}>
              🖨 Imprimir
            </button>
          </div>

          {!activeConfig ? (
            <div className="acp-empty">
              <p>Primero configura las fechas del período {selectedPeriod} en la pestaña <strong>Períodos</strong>.</p>
            </div>
          ) : (
            <ComunicadoPreview
              period={selectedPeriod}
              config={activeConfig}
              events={events}
              weeks={weeks}
              curWeek={curWeek}
              year={CURRENT_YEAR}
              schoolName={teacher.schools?.name || 'Boston Flex'}
            />
          )}
        </div>
      )}

      {/* ── Event form modal ── */}
      {eventForm && (
        <div className="acp-modal-overlay" onClick={() => setEventForm(null)}>
          <div className="acp-modal" onClick={e => e.stopPropagation()}>
            <div className="acp-modal-header">
              <h3>{eventForm.id ? 'Editar evento' : 'Nuevo evento'}</h3>
              <button className="acp-modal-close" onClick={() => setEventForm(null)}>✕</button>
            </div>
            <div className="acp-modal-body">
              <label>Nombre / Actividad *</label>
              <input
                value={eventForm.name}
                onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ej. Charla de liderazgo — Nadia Arana"
              />
              <div className="acp-form-row">
                <div>
                  <label>Fecha *</label>
                  <input type="date"
                    value={eventForm.date}
                    onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <div>
                  <label>Hora</label>
                  <input
                    value={eventForm.time_slot || ''}
                    onChange={e => setEventForm(f => ({ ...f, time_slot: e.target.value }))}
                    placeholder="ej. 7:00 a.m."
                  />
                </div>
              </div>
              <label>Organiza / Responsable</label>
              <input
                value={eventForm.organizer || ''}
                onChange={e => setEventForm(f => ({ ...f, organizer: e.target.value }))}
                placeholder="ej. Departamento de Bienestar"
              />
              <label>Observaciones</label>
              <textarea rows={3}
                value={eventForm.notes || ''}
                onChange={e => setEventForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Instrucciones adicionales, lugar, audiencia…"
              />
              <label className="acp-checkbox-label">
                <input type="checkbox"
                  checked={eventForm.no_class ?? false}
                  onChange={e => setEventForm(f => ({ ...f, no_class: e.target.checked }))}
                />
                <span>Día sin clase (vacación / festivo)</span>
              </label>
            </div>
            <div className="acp-modal-footer">
              <button className="acp-btn-secondary" onClick={() => setEventForm(null)}>Cancelar</button>
              <button className="acp-btn-primary" onClick={saveEvent} disabled={savingEvent}>
                {savingEvent ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PeriodCard — edits one period's dates and metadata
// ─────────────────────────────────────────────────────────────────────────────

function PeriodCard({ period, config, saving, onSave }) {
  const [editing,  setEditing]  = useState(false)
  const [form,     setForm]     = useState(null)

  function startEdit() {
    setForm({
      start_date:       config?.start_date       || '',
      end_date:         config?.end_date         || '',
      year_theme:       config?.year_theme        || '',
      intro_message:    config?.intro_message     || '',
      director_name:    config?.director_name     || '',
      coordinator_name: config?.coordinator_name  || '',
    })
    setEditing(true)
  }

  async function handleSave() {
    if (!form.start_date || !form.end_date) return
    await onSave(form)
    setEditing(false)
  }

  const weeks = useMemo(() => {
    if (!config?.start_date || !config?.end_date) return []
    return calculateWeeks(config.start_date, config.end_date)
  }, [config?.start_date, config?.end_date])

  const PERIOD_COLORS = { 1: '#C0504D', 2: '#4BACC6', 3: '#9BBB59' }
  const color = PERIOD_COLORS[parseInt(period.value)] || '#888'

  return (
    <div className="acp-period-card">
      <div className="acp-pc-header">
        <div className="acp-pc-badge" style={{ background: color }}>{period.short}</div>
        <div className="acp-pc-meta">
          <div className="acp-pc-period-name">{period.label.replace(` ${new Date().getFullYear()}`, '')}</div>
          <div className="acp-pc-period-year">{new Date().getFullYear()}</div>
        </div>
        {!editing && (
          <button className="acp-pc-edit" onClick={startEdit}>
            {config ? '✎ Editar' : '+ Configurar'}
          </button>
        )}
      </div>

      {config && !editing && (
        <div className="acp-pc-info">
          <div className="acp-pc-dates">
            <span>{formatDateEs(config.start_date)}</span>
            <span className="acp-pc-arrow">→</span>
            <span>{formatDateEs(config.end_date)}</span>
          </div>
          <div className="acp-pc-stats">
            {weeks.length} semanas
            {config.year_theme && <> · "{config.year_theme}"</>}
          </div>
        </div>
      )}

      {!config && !editing && (
        <p className="acp-pc-empty">Sin fechas configuradas</p>
      )}

      {editing && form && (
        <div className="acp-pc-form">
          <div className="acp-form-row">
            <div>
              <label>Inicio *</label>
              <input type="date" value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div>
              <label>Fin *</label>
              <input type="date" value={form.end_date}
                onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
            </div>
          </div>
          <label>Tema del año</label>
          <input type="text" value={form.year_theme}
            onChange={e => setForm(f => ({ ...f, year_theme: e.target.value }))}
            placeholder="ej. YEAR OF THE PURITY" />
          <label>Mensaje de bienvenida</label>
          <textarea rows={3} value={form.intro_message}
            onChange={e => setForm(f => ({ ...f, intro_message: e.target.value }))}
            placeholder="Bienvenidos al período… Como institución educativa…" />
          <div className="acp-form-row">
            <div>
              <label>Director de sede</label>
              <input type="text" value={form.director_name}
                onChange={e => setForm(f => ({ ...f, director_name: e.target.value }))}
                placeholder="Mr. Yair Herrera" />
            </div>
            <div>
              <label>Coordinación académica</label>
              <input type="text" value={form.coordinator_name}
                onChange={e => setForm(f => ({ ...f, coordinator_name: e.target.value }))}
                placeholder="Ms. Sisy Echeverría" />
            </div>
          </div>
          <div className="acp-pc-form-actions">
            <button className="acp-btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
            <button className="acp-btn-primary" onClick={handleSave} disabled={saving || !form.start_date || !form.end_date}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ComunicadoPreview — renders + prints the communicado
// ─────────────────────────────────────────────────────────────────────────────

function ComunicadoPreview({ period, config, events, weeks, curWeek, year, schoolName }) {
  const today = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric'
  })

  const periodLabel = ACADEMIC_PERIODS.find(p => parseInt(p.value) === period)?.label || `Período ${period}`

  // Split events: holidays (no_class) vs cronograma
  const cronograma = events.filter(e => !e.no_class)
  const holidays   = events.filter(e => e.no_class)
  const holidayIsos = new Set(holidays.map(h => h.date))

  return (
    <div className="acp-communicado-wrap">
      {/* Screen note */}
      <p className="acp-print-note">
        Vista previa · Usa el botón <strong>🖨 Imprimir</strong> para generar el PDF
      </p>

      {/* ── Document — this is what prints ── */}
      <div className="comm-doc" id="comm-print-area">

        {/* Header */}
        <div className="comm-header">
          <div className="comm-school">{schoolName}</div>
          <div className="comm-location">Barranquilla, {today}</div>
        </div>

        <p className="comm-salutation">Apreciados Docentes.</p>

        {/* Intro */}
        <p className="comm-intro">
          {config.intro_message ||
            `Bienvenidos al ${periodLabel} ${year}${config.year_theme ? ` "${config.year_theme}"` : ''}. Como institución educativa, gozamos de poder caminar y crecer juntos en este período. El siguiente comunicado tiene la finalidad de desplegar una serie de indicaciones correspondientes al inicio del período académico.`}
        </p>

        {/* División de semanas */}
        <div className="comm-section">
          <h3 className="comm-section-title">
            División de semanas{curWeek ? ` (Estamos en la semana ${curWeek})` : ''}
          </h3>
          <ul className="comm-weeks-list">
            {weeks.map((w, i) => {
              // Collect holidays in this week
              const weekHols = holidays.filter(h => h.date >= w.start && h.date <= w.end)
              const isLast   = i === weeks.length - 1
              const label    = isLast
                ? `Evaluaciones finales: ${formatDateShort(w.displayStart)} - ${formatDateShort(w.displayEnd)}`
                : `Semana ${w.weekNum}: ${formatDateShort(w.displayStart)} - ${formatDateShort(w.displayEnd)}${w.isPartial ? ' (Semana Compuesta)' : ''}`
              return (
                <li key={w.weekNum}>
                  {label}
                  {weekHols.map(h => (
                    <span key={h.id} className="comm-holiday-note">
                      {' · '}{h.name}: {formatDateShort(h.date)}
                    </span>
                  ))}
                </li>
              )
            })}
          </ul>
        </div>

        {/* Documentos */}
        <div className="comm-section">
          <h3 className="comm-section-title">
            Documentos a tener en cuenta: ESTUDIANTES BOSTON FLEX {year}
          </h3>
        </div>

        {/* Cronograma */}
        {cronograma.length > 0 && (
          <div className="comm-section">
            <h3 className="comm-section-title">Cronograma:</h3>
            <table className="comm-table">
              <thead>
                <tr>
                  <th>Evento / Actividad</th>
                  <th>Fecha</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {cronograma.map(ev => (
                  <tr key={ev.id}>
                    <td>
                      {ev.name}
                      {ev.organizer && <div className="comm-organizer">{ev.organizer}</div>}
                    </td>
                    <td className="comm-td-date">
                      {formatDateShort(ev.date)}
                      {ev.time_slot && <div className="comm-time">{ev.time_slot}</div>}
                    </td>
                    <td>{ev.notes || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="comm-footer">
          <p className="comm-closing">Cordialmente,</p>
          <div className="comm-signatures">
            <div className="comm-sig">
              <div className="comm-sig-name">{config.director_name || 'Director de sede'}</div>
              <div className="comm-sig-role">Director de sede</div>
            </div>
            <div className="comm-sig">
              <div className="comm-sig-name">{config.coordinator_name || 'Coordinación Académica'}</div>
              <div className="comm-sig-role">Coordinación Académica</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
