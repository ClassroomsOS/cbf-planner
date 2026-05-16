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
  useEffect(() => { if (tab === 'events' || tab === 'communicado') fetchEvents() }, [tab, selectedPeriod, configs])

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
    const config = configs.find(c => c.period === selectedPeriod)

    const [{ data: periodData }, { data: holidayData }] = await Promise.all([
      supabase.from('school_calendar').select('*')
        .eq('school_id', teacher.school_id)
        .eq('period', selectedPeriod)
        .order('date'),
      config?.start_date && config?.end_date
        ? supabase.from('school_calendar').select('*')
            .eq('school_id', teacher.school_id)
            .is('period', null)
            .gte('date', config.start_date)
            .lte('date', config.end_date)
            .order('date')
        : Promise.resolve({ data: [] }),
    ])

    const seen = new Set()
    const all = [...(periodData || []), ...(holidayData || [])]
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
      .sort((a, b) => a.date.localeCompare(b.date))
    setEvents(all)
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

  function openEventForm(ev = null, prefillDate = '') {
    setEventForm(ev ?? {
      name: '', date: prefillDate, time_slot: '', organizer: '',
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
          {/* Period selector + global add */}
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

          {!activeConfig && (
            <div className="acp-empty">
              <p>Primero configura las fechas del período {selectedPeriod} en la pestaña <strong>Períodos</strong>.</p>
            </div>
          )}

          {activeConfig && loadingEvents && (
            <div className="acp-loading">Cargando…</div>
          )}

          {activeConfig && !loadingEvents && (
            <div className="acp-weeks-view">
              {weeks.length === 0 && (
                <div className="acp-empty">
                  <p>No se pudieron calcular las semanas. Verifica las fechas del período.</p>
                </div>
              )}
              {weeks.map((week, i) => {
                const isLast    = i === weeks.length - 1
                const weekLabel = isLast
                  ? `Evaluaciones finales`
                  : `Semana ${week.weekNum}${week.isPartial ? ' — Compuesta' : ''}`
                const dateRange = `${formatDateEs(week.displayStart, { weekday: true })} al ${formatDateEs(week.displayEnd, { weekday: true })}`
                const weekEvents = events.filter(e => e.date >= week.start && e.date <= week.end)
                const isCurrentWeek = curWeek === week.weekNum

                return (
                  <div key={week.weekNum}
                    className={`acp-week-group ${isCurrentWeek ? 'acp-week-current' : ''} ${isLast ? 'acp-week-final' : ''}`}>
                    <div className="acp-week-header">
                      <div className="acp-week-label">
                        {isCurrentWeek && <span className="acp-week-now">Semana actual</span>}
                        <strong>{weekLabel}</strong>
                        <span className="acp-week-dates">{dateRange}</span>
                        {week.holidays?.length > 0 && (
                          <span className="acp-week-hols">
                            🚫 {week.holidays.map(d => {
                              const ev = events.find(e => e.date === d)
                              return ev ? ev.name : d
                            }).join(', ')}
                          </span>
                        )}
                      </div>
                      <button
                        className="acp-week-add"
                        onClick={() => openEventForm(null, week.displayStart)}
                        title="Agregar evento en esta semana"
                      >
                        + Evento
                      </button>
                    </div>

                    {weekEvents.length === 0 ? (
                      <div className="acp-week-empty">Sin eventos registrados</div>
                    ) : (
                      <table className="acp-events-table">
                        <tbody>
                          {weekEvents.map(ev => (
                            <tr key={ev.id} className={ev.no_class ? 'acp-row-holiday' : ev.affects_planning ? 'acp-row-important' : ''}>
                              <td className="acp-td-date-narrow">
                                {formatDateEs(ev.date, { weekday: true })}
                                {ev.time_slot && <div className="acp-td-time">{ev.time_slot}</div>}
                              </td>
                              <td className="acp-td-name">
                                <div>{ev.no_class && '🚫 '}{ev.affects_planning && !ev.no_class ? '⚑ ' : ''}{ev.name}</div>
                                {ev.organizer && <div className="acp-td-org">{ev.organizer}</div>}
                                {ev.notes && <div className="acp-td-notes-inline">{ev.notes}</div>}
                              </td>
                              {ev.period === selectedPeriod && (
                                <td className="acp-td-actions">
                                  <button className="acp-btn-icon" onClick={() => openEventForm(ev)} title="Editar">✎</button>
                                  <button className="acp-btn-icon acp-btn-del" onClick={() => deleteEvent(ev.id)} title="Eliminar">✕</button>
                                </td>
                              )}
                              {ev.period === null && (
                                <td className="acp-td-national">Festivo nacional</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
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

  // Total pages estimate (rough: 1 page per ~20 events)
  const cronograma = events.filter(e => !e.no_class && e.period !== null)
  const holidays   = events.filter(e => e.no_class)

  return (
    <div className="acp-communicado-wrap">
      <p className="acp-print-note">
        Vista previa del formato institucional · <strong>🖨 Imprimir</strong> genera el PDF
      </p>

      {/* ── Document ── */}
      <div className="comm-doc" id="comm-print-area">

        {/* ── Encabezado institucional CBF (formato oficial) ── */}
        <table className="comm-cbf-header">
          <tbody>
            <tr>
              <td className="comm-cbf-logo" rowSpan={4}>
                <img src="/assets/logo-bf.png" alt="Boston Flex" />
              </td>
              <td className="comm-cbf-school-name" colSpan={2}>
                COLEGIO BOSTON FLEXIBLE
              </td>
              <td className="comm-cbf-code" rowSpan={2}>CÓD: CBF-G AC-01</td>
            </tr>
            <tr>
              <td className="comm-cbf-dane" colSpan={2}>
                DANE: 308001800455 — RESOLUCIÓN 09685 DE 2019
              </td>
            </tr>
            <tr>
              <td className="comm-cbf-proceso" colSpan={2}>
                <strong>PROCESO: Comunicado a Docentes</strong>
              </td>
              <td className="comm-cbf-version">Versión 02: Mayo 2019</td>
            </tr>
            <tr>
              <td colSpan={2}></td>
              <td className="comm-cbf-page">Página 1 de 2</td>
            </tr>
          </tbody>
        </table>

        {/* ── Fecha y saludo ── */}
        <p className="comm-location">Barranquilla, {today}</p>
        <p className="comm-salutation">Apreciados Docentes.</p>

        {/* ── Bienvenida ── */}
        <p className="comm-intro">
          {config.intro_message ||
            `Bienvenidos al año ${year}${config.year_theme ? ` "${config.year_theme}"` : ''}. Como institución educativa, gozamos de poder caminar y crecer juntos en este nuevo tiempo. El siguiente comunicado tiene la finalidad de desplegar una serie de indicaciones correspondientes al inicio del período académico.`}
        </p>

        {/* ── 1. División de semanas ── */}
        <div className="comm-section">
          <p className="comm-section-title">
            <strong>1. División de semanas{curWeek ? ` (Estamos en la semana ${curWeek})` : ''}</strong>
          </p>
          <ul className="comm-weeks-list">
            {weeks.map((w, i) => {
              const weekHols = holidays.filter(h => h.date >= w.start && h.date <= w.end)
              const isLast   = i === weeks.length - 1
              const isCur    = curWeek === w.weekNum
              const label    = isLast
                ? `Evaluaciones finales: ${formatDateShort(w.displayStart)} al ${formatDateShort(w.displayEnd)}`
                : `Semana ${w.weekNum}: ${formatDateShort(w.displayStart)} - ${formatDateShort(w.displayEnd)}${w.isPartial ? ' (Semana Compuesta)' : ''}`
              return (
                <li key={w.weekNum} className={isCur ? 'comm-week-current' : isLast ? 'comm-week-final' : ''}>
                  <span className="comm-week-bullet">-</span> {label}
                  {weekHols.map(h => (
                    <div key={h.id} className="comm-holiday-note">
                      &emsp;{h.name}: {formatDateShort(h.date)} al {formatDateShort(h.date)}
                    </div>
                  ))}
                </li>
              )
            })}
          </ul>
        </div>

        {/* ── 2. Documentos ── */}
        <div className="comm-section">
          <p className="comm-section-title">
            <strong>2. Documentos a tener en cuenta:</strong><br />
            <span className="comm-docs-link">📎 ESTUDIANTES BOSTON FLEX {year}</span>
          </p>
        </div>

        {/* ── 3. Cronograma ── */}
        <div className="comm-section">
          <p className="comm-section-title"><strong>3. Cronograma:</strong></p>
          {cronograma.length === 0 ? (
            <p style={{ fontStyle: 'italic', color: '#888', fontSize: '11pt' }}>
              No hay eventos registrados para este período.
            </p>
          ) : (
            <table className="comm-table">
              <thead>
                <tr>
                  <th style={{ width: '48%' }}></th>
                  <th style={{ width: '18%' }}></th>
                  <th style={{ width: '34%' }}>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {cronograma.map(ev => (
                  <tr key={ev.id}>
                    <td>
                      <div style={{ fontWeight: ev.affects_planning ? '700' : '400' }}>{ev.name}</div>
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
          )}
        </div>

        {/* ── Cierre y firmas ── */}
        <div className="comm-footer">
          <p className="comm-closing">Cordialmente,</p>
          <div className="comm-signatures">
            <div className="comm-sig">
              <div className="comm-sig-name">{config.director_name || 'Director de sede'}</div>
              <div className="comm-sig-role">Director de sede</div>
            </div>
            <div className="comm-sig">
              <div className="comm-sig-name">{config.coordinator_name || 'Coordinación Académico.'}</div>
              <div className="comm-sig-role">Coordinación Académico.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
