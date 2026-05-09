/**
 * QADashboardPage — Panel de observabilidad y calidad del sistema
 * Acceso: admin · rector · superadmin
 *
 * Tabs:
 *  1. Errores        — error_log (errores de cliente)
 *  2. Actividad      — activity_log (acciones de usuarios)
 *  3. Sistema        — system_events (cbf-logger Edge Fn)
 *  4. Alertas        — system_alerts
 *  5. IA             — ai_usage (tokens y costo)
 *  6. QA Runs        — qa_runs (historial de verificaciones guiadas)
 *  7. Protocolos     — documentación de módulos del sistema
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { useToast } from '../context/ToastContext'
import { QA_SUITES } from '../qa/suites/index'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtTokens(n) {
  if (!n) return '0'
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function fmtCost(n) {
  if (!n) return '$0.000'
  return `$${Number(n).toFixed(4)}`
}

const SEV_COLOR = {
  info:     '#2563eb',
  warn:     '#d97706',
  error:    '#dc2626',
  critical: '#7c3aed',
}

const SEV_BADGE = {
  info:     { bg: '#eff6ff', text: '#2563eb' },
  warn:     { bg: '#fffbeb', text: '#d97706' },
  error:    { bg: '#fef2f2', text: '#dc2626' },
  critical: { bg: '#f5f3ff', text: '#7c3aed' },
}

function SevBadge({ sev }) {
  const s = SEV_BADGE[sev] || SEV_BADGE.info
  return (
    <span style={{
      background: s.bg, color: s.text,
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
    }}>{sev || 'info'}</span>
  )
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94a3b8' }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  )
}

function LoadingRow() {
  return (
    <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
      Cargando…
    </td></tr>
  )
}

// ── PROTOCOLS — documentación estática de módulos ────────────────────────────

const PROTOCOLS = [
  {
    id: 'cascade',
    icon: '🎯',
    name: 'Cascada Pedagógica',
    status: 'active',
    description: 'Núcleo del sistema. Toda la planificación fluye desde aquí.',
    flow: 'Syllabus Topics → Achievement Goal → Achievement Indicators → NEWS Project → Lesson Plan → Checkpoint → Evaluación',
    tables: ['achievement_goals', 'achievement_indicators', 'syllabus_topics', 'news_projects', 'lesson_plans', 'checkpoints'],
    rules: [
      'lesson_plans.grade almacena el label combinado "8.° Blue" (grade + section)',
      'teacher_assignments.grade almacena solo la base "8.°" (sin sección)',
      'Nunca usar grade.split() ni .replace() — usar el combined grade directamente',
      'Queries a lesson_plans: .eq("grade", combinedGrade)',
    ],
  },
  {
    id: 'auth',
    icon: '🔐',
    name: 'Autenticación y Roles',
    status: 'active',
    description: 'Email + contraseña con validación de dominio. Google OAuth configurado pero pendiente activación.',
    flow: 'Login → Supabase Auth → teachers row (status: approved) → DashboardPage',
    tables: ['teachers', 'schools'],
    rules: [
      'Dominio permitido: schools.features.email_domain (default: redboston.edu.co)',
      'schools.features.restrict_email_domain: true → bloquea dominios externos',
      'Admin crea docentes vía Edge Fn admin-create-teacher (service role key)',
      'Docente recibe recovery link → SetPasswordPage → acceso al sistema',
      'Google OAuth pendiente: configurar en Supabase Dashboard → Auth → Providers',
    ],
  },
  {
    id: 'exams',
    icon: '📝',
    name: 'Módulo de Evaluación',
    status: 'active',
    description: 'Blueprints → sessions → instances per student → AI grading → human review.',
    flow: 'ExamCreatorPage → exam_blueprints → exam_sessions → exam_instances → ExamPlayerV2 → exam_responses → AI correction → exam_results',
    tables: ['exam_blueprints', 'exam_sessions', 'exam_instances', 'exam_responses', 'exam_results', 'exam_feedback'],
    rules: [
      'seededShuffle: función canónica en examUtils.js — NUNCA duplicar en componentes',
      'section_name en generated_questions: "" = sin tabs, valores distintos = tabs automáticos',
      'CYCLE_EVENTS (exam_started, exam_resumed, exam_submitted) NO actualizan integrity_flags',
      'Antitrampa 5 capas: multi-evento, canvas watermark, fullscreen, Telegram realtime, matriz pruebas',
      'Telegram: código last-6 de instance_id (nunca PII del estudiante)',
      'ai_correction_status: not_needed | pending | done',
      'requires_human_review: true cuando confianza AI < 0.65',
    ],
  },
  {
    id: 'library',
    icon: '📚',
    name: 'Biblioteca CBF',
    status: 'active',
    description: 'Documentos institucionales y personales con compartición, historial y rollback.',
    flow: 'Subir doc → school_library → [shares] → library_edit_log (trigger automático)',
    tables: ['school_library', 'library_shares', 'library_edit_log'],
    rules: [
      'visibility: "school" = acceso institucional · "personal" = solo dueño + admin oversight',
      'Cuota personal: schools.features.library_quota_gb (default: 2 GB)',
      'Skip-log flag: SET LOCAL app.library_skip_log = "true" evita log duplicado durante rollback',
      'Trigger fn_log_library_edit usa current_setting("app.library_skip_log", TRUE) — el TRUE (missing_ok) es crítico',
      'PDFJS_WORKER_URL hardcodeado: actualizar cuando se actualice pdfjs-dist en package.json',
      'Visores: PDF.js 5 (canvas page-by-page) · WaveSurfer 7 (waveform) · OpenSeadragon 6 (deep zoom)',
    ],
  },
  {
    id: 'psicosocial',
    icon: '🧠',
    name: 'Módulo Psicosocial',
    status: 'active',
    description: 'Perfiles, seguimiento y planes de acomodación. Notas confidenciales restringidas.',
    flow: 'student_psychosocial_profiles → student_observations → student_accommodation_plans',
    tables: ['student_psychosocial_profiles', 'student_observations', 'student_accommodation_plans'],
    rules: [
      'confidential_notes: solo psicopedagoga, rector y admin. Docentes ven teacher_notes solamente.',
      'PIAR sin PII: accommodation plans inyectados en generateGuideStructure sin nombres de estudiantes',
      'ConversationalGuideModal: aviso naranja en paso 3 si hay acomodaciones activas',
    ],
  },
  {
    id: 'ai',
    icon: '🤖',
    name: 'Integración IA',
    status: 'active',
    description: 'Edge Function claude-proxy — passthrough puro a claude-sonnet-4-20250514.',
    flow: 'AIAssistant.js → claude-proxy Edge Fn → Anthropic API → respuesta streamed',
    tables: ['ai_usage'],
    rules: [
      'Modelo: claude-sonnet-4-20250514 — no cambiar sin avisar',
      'Límite mensual por docente: teachers.ai_monthly_limit (0 = ilimitado)',
      'callClaude() lee respuesta como texto primero — evita errores "Unexpected token"',
      'extractJSONArray: JSON.parse → fallback regex /\\[[\\s\\S]*\\]/ para bloques markdown',
      'exam-response-corrector: confianza < 0.65 → requires_human_review=true',
      'CORS whitelist: classroomsos.github.io · localhost:5173 · localhost:4173',
    ],
  },
  {
    id: 'observability',
    icon: '📡',
    name: 'Observabilidad',
    status: 'partial',
    description: 'logger.js en cliente, cbf-logger Edge Fn en servidor. Adopción ~14% de módulos.',
    flow: 'logError/logActivity → error_log/activity_log · cbf-logger → system_events · Telegram alerts',
    tables: ['error_log', 'activity_log', 'system_events', 'system_alerts', 'system_health_snapshots', 'alert_rules'],
    rules: [
      'logError(err, { page, action, entityId }) — nunca lanza excepción propia',
      'logActivity(action, entityType, entityId, description) — fire-and-forget',
      'safeAsync(fn, context) — devuelve { data, error }, nunca lanza',
      'cbf-logger Edge Fn: deploy con --no-verify-jwt',
      'Telegram alertas: configurar TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID en Edge Fn secrets',
    ],
  },
  {
    id: 'rls',
    icon: '🛡️',
    name: 'RLS y Seguridad',
    status: 'active',
    description: 'Row Level Security en todas las tablas. get_my_school_id() SECURITY DEFINER.',
    flow: 'auth.uid() → teachers.school_id (vía get_my_school_id()) → filtra todas las queries',
    tables: ['teachers', 'schools'],
    rules: [
      'NUNCA comparar roles directamente — usar helpers de roles.js',
      'get_my_school_id() es SECURITY DEFINER: no exponer school_id en client',
      'Edge Functions: CORS whitelist explícita — no usar *',
      'innerHTML: NUNCA con datos de usuario/DB — usar DOMPurify.sanitize()',
      'RLS teachers: siempre usar get_my_school_id() SECURITY DEFINER en policies',
      'exam_instances: INSERT sin RLS check desde exam-instance-generator (service role)',
    ],
  },
  {
    id: 'deploy',
    icon: '🚀',
    name: 'Deploy y Entorno',
    status: 'active',
    description: 'GitHub Actions → build → GitHub Pages. Dos bases de datos: prod y dev.',
    flow: 'git push main → GitHub Actions → npm run build → /cbf-planner/ en GitHub Pages',
    tables: [],
    rules: [
      'minify: false en vite.config.js — NUNCA reactivar',
      'Prod: vouxrqsiyoyllxgcriic · Dev: gfjiicfnwpkbkptwgnte',
      'Migraciones a prod: link a vouxrqsiyoyllxgcriic → db push → restaurar link a dev',
      'Edge Functions: siempre deploy con --no-verify-jwt',
      'npm run dev = dev DB · npm run dev:prod = prod DB',
      'supabase.exe en raíz del proyecto, en .gitignore',
    ],
  },
]

// ── TabButton ────────────────────────────────────────────────────────────────

function TabButton({ id, label, icon, active, badge, onClick }) {
  return (
    <button
      className={`qa-dash-tab ${active ? 'qa-dash-tab--active' : ''}`}
      onClick={() => onClick(id)}>
      <span>{icon}</span>
      <span>{label}</span>
      {badge > 0 && <span className="qa-dash-tab-badge">{badge}</span>}
    </button>
  )
}

// ── Tab: ERRORES ─────────────────────────────────────────────────────────────

function ErrorsTab({ teacher }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('error_log')
      .select('*, teacher:user_id(full_name, initials)')
      .order('created_at', { ascending: false })
      .limit(200)
    setRows(data || [])
    setLoading(false)
  }

  const filtered = filter
    ? rows.filter(r =>
        (r.error_message || r.message)?.toLowerCase().includes(filter.toLowerCase()) ||
        r.page?.toLowerCase().includes(filter.toLowerCase()) ||
        r.action?.toLowerCase().includes(filter.toLowerCase()) ||
        r.teacher?.full_name?.toLowerCase().includes(filter.toLowerCase())
      )
    : rows

  return (
    <div className="qa-dash-tab-content">
      <div className="qa-dash-toolbar">
        <input
          className="qa-dash-search"
          placeholder="Filtrar por mensaje, página, acción o docente…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button className="qa-dash-refresh" onClick={load}>↺ Actualizar</button>
        <span className="qa-dash-count">{filtered.length} registros</span>
      </div>

      <div className="qa-dash-table-wrap">
        <table className="qa-dash-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Docente</th>
              <th>Página</th>
              <th>Acción</th>
              <th>Mensaje</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow />}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6}>
                <EmptyState icon="✅" text="Sin errores registrados" />
              </td></tr>
            )}
            {!loading && filtered.map(row => (
              <>
                <tr key={row.id} className="qa-dash-row" onClick={() => setExpanded(expanded === row.id ? null : row.id)}>
                  <td className="qa-dash-cell-mono">{fmtDate(row.created_at)}</td>
                  <td>{row.teacher?.full_name || row.teacher?.initials || <span style={{ color: '#94a3b8' }}>Anónimo</span>}</td>
                  <td><code>{row.page || '—'}</code></td>
                  <td><code>{row.action || '—'}</code></td>
                  <td className="qa-dash-cell-msg">{row.error_message || row.message || '—'}</td>
                  <td>{expanded === row.id ? '▲' : '▼'}</td>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-detail`} className="qa-dash-row-detail">
                    <td colSpan={6}>
                      <pre className="qa-dash-stack">{row.error_stack || row.stack || 'Sin stack trace'}</pre>
                      {row.metadata && <pre className="qa-dash-stack" style={{ marginTop: 6 }}>{JSON.stringify(row.metadata, null, 2)}</pre>}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: ACTIVIDAD ───────────────────────────────────────────────────────────

const ACTION_ICONS = {
  create: '➕', update: '✏️', delete: '🗑️', export: '📤',
  login: '🔑', ai_generate: '🤖', view: '👁', share: '🔗',
}

function ActivityTab({ teacher }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('activity_log')
      .select('*, teacher:user_id(full_name, initials)')
      .order('created_at', { ascending: false })
      .limit(300)
    setRows(data || [])
    setLoading(false)
  }

  const actions = ['all', ...new Set(rows.map(r => r.action).filter(Boolean))]

  const filtered = rows.filter(r => {
    const matchAction = actionFilter === 'all' || r.action === actionFilter
    const matchText = !filter ||
      r.description?.toLowerCase().includes(filter.toLowerCase()) ||
      r.entity_type?.toLowerCase().includes(filter.toLowerCase()) ||
      r.teacher?.full_name?.toLowerCase().includes(filter.toLowerCase())
    return matchAction && matchText
  })

  return (
    <div className="qa-dash-tab-content">
      <div className="qa-dash-toolbar">
        <input
          className="qa-dash-search"
          placeholder="Filtrar por descripción, entidad o docente…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <select className="qa-dash-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          {actions.map(a => (
            <option key={a} value={a}>{a === 'all' ? 'Todas las acciones' : a}</option>
          ))}
        </select>
        <button className="qa-dash-refresh" onClick={load}>↺ Actualizar</button>
        <span className="qa-dash-count">{filtered.length} registros</span>
      </div>

      <div className="qa-dash-table-wrap">
        <table className="qa-dash-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Docente</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow />}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5}>
                <EmptyState icon="📋" text="Sin actividad registrada" />
              </td></tr>
            )}
            {!loading && filtered.map(row => (
              <tr key={row.id} className="qa-dash-row">
                <td className="qa-dash-cell-mono">{fmtDate(row.created_at)}</td>
                <td>{row.teacher?.full_name || row.teacher?.initials || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                <td>
                  <span className="qa-dash-action-chip">
                    {ACTION_ICONS[row.action] || '•'} {row.action || '—'}
                  </span>
                </td>
                <td><code style={{ fontSize: 12 }}>{row.entity_type || '—'}</code></td>
                <td className="qa-dash-cell-msg">{row.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: SISTEMA (system_events) ─────────────────────────────────────────────

function SystemTab({ teacher }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [sevFilter, setSevFilter] = useState('all')
  const [modFilter, setModFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('system_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setEvents(data || [])
    setLoading(false)
  }

  const modules = ['all', ...new Set(events.map(e => e.module).filter(Boolean))]
  const sevs = ['all', 'critical', 'error', 'warn', 'info']

  const filtered = events.filter(e => {
    const matchSev = sevFilter === 'all' || e.severity === sevFilter
    const matchMod = modFilter === 'all' || e.module === modFilter
    return matchSev && matchMod
  })

  const criticalCount = events.filter(e => e.severity === 'critical' || e.severity === 'error').length

  return (
    <div className="qa-dash-tab-content">
      {criticalCount > 0 && (
        <div className="qa-dash-alert-banner">
          ⚠️ {criticalCount} evento{criticalCount !== 1 ? 's' : ''} de nivel error/crítico registrado{criticalCount !== 1 ? 's' : ''}
        </div>
      )}

      <div className="qa-dash-toolbar">
        <select className="qa-dash-select" value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
          {sevs.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'Todas las severidades' : s}</option>
          ))}
        </select>
        <select className="qa-dash-select" value={modFilter} onChange={e => setModFilter(e.target.value)}>
          {modules.map(m => (
            <option key={m} value={m}>{m === 'all' ? 'Todos los módulos' : m}</option>
          ))}
        </select>
        <button className="qa-dash-refresh" onClick={load}>↺ Actualizar</button>
        <span className="qa-dash-count">{filtered.length} eventos</span>
      </div>

      <div className="qa-dash-table-wrap">
        <table className="qa-dash-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Módulo</th>
              <th>Tipo</th>
              <th>Severidad</th>
              <th>Mensaje</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow />}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6}>
                <EmptyState icon="📡" text="Sin eventos del sistema" />
              </td></tr>
            )}
            {!loading && filtered.map(ev => (
              <>
                <tr key={ev.id} className={`qa-dash-row ${ev.severity === 'critical' ? 'qa-dash-row--critical' : ev.severity === 'error' ? 'qa-dash-row--error' : ''}`}
                  onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}>
                  <td className="qa-dash-cell-mono">{fmtDate(ev.created_at)}</td>
                  <td><code>{ev.module || '—'}</code></td>
                  <td><code>{ev.event_type || '—'}</code></td>
                  <td><SevBadge sev={ev.severity} /></td>
                  <td className="qa-dash-cell-msg">{ev.message}</td>
                  <td>{ev.metadata && Object.keys(ev.metadata).length > 0 ? (expanded === ev.id ? '▲' : '▼') : ''}</td>
                </tr>
                {expanded === ev.id && ev.metadata && (
                  <tr key={`${ev.id}-meta`} className="qa-dash-row-detail">
                    <td colSpan={6}>
                      <pre className="qa-dash-stack">{JSON.stringify(ev.metadata, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: ALERTAS ─────────────────────────────────────────────────────────────

function AlertsTab({ teacher }) {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('system_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setAlerts(data || [])
    setLoading(false)
  }

  async function resolve(id) {
    const { error } = await supabase
      .from('system_alerts')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id)
    if (error) {
      showToast('Error al resolver alerta', 'error')
    } else {
      showToast('Alerta marcada como resuelta', 'success')
      load()
    }
  }

  const open = alerts.filter(a => a.status === 'open')
  const resolved = alerts.filter(a => a.status !== 'open')

  return (
    <div className="qa-dash-tab-content">
      {open.length > 0 && (
        <div className="qa-dash-alert-banner">
          ⚠️ {open.length} alerta{open.length !== 1 ? 's' : ''} abierta{open.length !== 1 ? 's' : ''}
        </div>
      )}

      <h3 className="qa-dash-section-title">Alertas abiertas</h3>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Cargando…</div>
      ) : open.length === 0 ? (
        <EmptyState icon="✅" text="Sin alertas abiertas" />
      ) : (
        <div className="qa-dash-alert-list">
          {open.map(a => (
            <div key={a.id} className="qa-dash-alert-card qa-dash-alert-card--open">
              <div className="qa-dash-alert-card-left">
                <SevBadge sev={a.severity} />
                <div>
                  <div className="qa-dash-alert-msg">{a.message}</div>
                  <div className="qa-dash-alert-meta">{fmtDate(a.created_at)}{a.error_code && ` · ${a.error_code}`}</div>
                </div>
              </div>
              <button className="qa-dash-alert-resolve" onClick={() => resolve(a.id)}>
                Resolver ✓
              </button>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <>
          <h3 className="qa-dash-section-title" style={{ marginTop: 24 }}>Resueltas ({resolved.length})</h3>
          <div className="qa-dash-table-wrap">
            <table className="qa-dash-table">
              <thead>
                <tr><th>Fecha</th><th>Severidad</th><th>Código</th><th>Mensaje</th></tr>
              </thead>
              <tbody>
                {resolved.map(a => (
                  <tr key={a.id} className="qa-dash-row" style={{ opacity: 0.6 }}>
                    <td className="qa-dash-cell-mono">{fmtDate(a.created_at)}</td>
                    <td><SevBadge sev={a.severity} /></td>
                    <td><code>{a.error_code || '—'}</code></td>
                    <td className="qa-dash-cell-msg">{a.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab: IA ──────────────────────────────────────────────────────────────────

function AITab({ teacher }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  useEffect(() => { load() }, [period])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('ai_usage')
      .select('*, teacher:teacher_id(full_name, initials)')
      .eq('school_id', teacher.school_id)
      .order('created_at', { ascending: false })
      .limit(500)

    if (period === 'month') {
      const start = new Date()
      start.setDate(1); start.setHours(0, 0, 0, 0)
      q = q.gte('created_at', start.toISOString())
    } else if (period === 'week') {
      const start = new Date()
      const day = start.getDay()
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1))
      start.setHours(0, 0, 0, 0)
      q = q.gte('created_at', start.toISOString())
    }

    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }

  // Aggregate stats
  const totalInput = rows.reduce((s, r) => s + (r.input_tokens || 0), 0)
  const totalOutput = rows.reduce((s, r) => s + (r.output_tokens || 0), 0)
  const totalCost = rows.reduce((s, r) => s + (r.cost_usd || 0), 0)

  // Per-teacher
  const byTeacher = {}
  rows.forEach(r => {
    const name = r.teacher?.full_name || r.teacher?.initials || r.teacher_id?.slice(-6) || '?'
    if (!byTeacher[name]) byTeacher[name] = { input: 0, output: 0, cost: 0, calls: 0 }
    byTeacher[name].input += r.input_tokens || 0
    byTeacher[name].output += r.output_tokens || 0
    byTeacher[name].cost += r.cost_usd || 0
    byTeacher[name].calls++
  })
  const teacherRows = Object.entries(byTeacher).sort((a, b) => b[1].cost - a[1].cost)

  return (
    <div className="qa-dash-tab-content">
      <div className="qa-dash-toolbar">
        <select className="qa-dash-select" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">Todo el historial</option>
          <option value="month">Este mes</option>
          <option value="week">Esta semana</option>
        </select>
        <button className="qa-dash-refresh" onClick={load}>↺ Actualizar</button>
        <span className="qa-dash-count">{rows.length} llamadas</span>
      </div>

      {/* Stats cards */}
      <div className="qa-dash-stat-grid">
        <div className="qa-dash-stat-card">
          <div className="qa-dash-stat-label">Tokens de entrada</div>
          <div className="qa-dash-stat-value">{fmtTokens(totalInput)}</div>
        </div>
        <div className="qa-dash-stat-card">
          <div className="qa-dash-stat-label">Tokens de salida</div>
          <div className="qa-dash-stat-value">{fmtTokens(totalOutput)}</div>
        </div>
        <div className="qa-dash-stat-card">
          <div className="qa-dash-stat-label">Costo estimado</div>
          <div className="qa-dash-stat-value">{fmtCost(totalCost)}</div>
        </div>
        <div className="qa-dash-stat-card">
          <div className="qa-dash-stat-label">Llamadas IA</div>
          <div className="qa-dash-stat-value">{rows.length}</div>
        </div>
      </div>

      {/* Per-teacher */}
      <h3 className="qa-dash-section-title">Uso por docente</h3>
      <div className="qa-dash-table-wrap">
        <table className="qa-dash-table">
          <thead>
            <tr><th>Docente</th><th>Llamadas</th><th>Tokens entrada</th><th>Tokens salida</th><th>Costo</th></tr>
          </thead>
          <tbody>
            {loading && <LoadingRow />}
            {!loading && teacherRows.length === 0 && (
              <tr><td colSpan={5}>
                <EmptyState icon="🤖" text="Sin uso de IA en el período seleccionado" />
              </td></tr>
            )}
            {!loading && teacherRows.map(([name, stats]) => (
              <tr key={name} className="qa-dash-row">
                <td>{name}</td>
                <td style={{ textAlign: 'right' }}>{stats.calls}</td>
                <td style={{ textAlign: 'right' }}>{fmtTokens(stats.input)}</td>
                <td style={{ textAlign: 'right' }}>{fmtTokens(stats.output)}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCost(stats.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: QA RUNS ─────────────────────────────────────────────────────────────

function QARunsTab({ teacher }) {
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('qa_runs')
      .select('*, runner:runner_id(full_name, initials)')
      .eq('school_id', teacher.school_id)
      .order('ran_at', { ascending: false })
      .limit(50)
    setRuns(data || [])
    setLoading(false)
  }

  const passRate = runs.length > 0
    ? Math.round(runs.filter(r => r.failed === 0).length / runs.length * 100)
    : null

  return (
    <div className="qa-dash-tab-content">
      {passRate !== null && (
        <div className="qa-dash-stat-grid" style={{ marginBottom: 16 }}>
          <div className="qa-dash-stat-card">
            <div className="qa-dash-stat-label">Total runs</div>
            <div className="qa-dash-stat-value">{runs.length}</div>
          </div>
          <div className="qa-dash-stat-card">
            <div className="qa-dash-stat-label">% sin fallos</div>
            <div className="qa-dash-stat-value" style={{ color: passRate >= 80 ? '#16a34a' : '#dc2626' }}>
              {passRate}%
            </div>
          </div>
          <div className="qa-dash-stat-card">
            <div className="qa-dash-stat-label">Fallos totales</div>
            <div className="qa-dash-stat-value" style={{ color: '#dc2626' }}>
              {runs.reduce((s, r) => s + r.failed, 0)}
            </div>
          </div>
        </div>
      )}

      <div className="qa-dash-toolbar">
        <button className="qa-dash-refresh" onClick={load}>↺ Actualizar</button>
        <span className="qa-dash-count">{runs.length} runs</span>
      </div>

      <div className="qa-dash-table-wrap">
        <table className="qa-dash-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Suite</th>
              <th>Ejecutado por</th>
              <th>✓ Pass</th>
              <th>✗ Fail</th>
              <th>⏭ Skip</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <LoadingRow />}
            {!loading && runs.length === 0 && (
              <tr><td colSpan={7}>
                <EmptyState icon="🧪" text="Sin runs QA. Inicia una suite desde el botón 🧪 en el sidebar." />
              </td></tr>
            )}
            {!loading && runs.map(run => (
              <>
                <tr key={run.id}
                  className={`qa-dash-row ${run.failed > 0 ? 'qa-dash-row--error' : ''}`}
                  onClick={() => setExpanded(expanded === run.id ? null : run.id)}>
                  <td className="qa-dash-cell-mono">{fmtDate(run.ran_at)}</td>
                  <td>{run.suite_name}</td>
                  <td>{run.runner?.full_name || run.runner?.initials || '—'}</td>
                  <td style={{ color: '#16a34a', textAlign: 'center', fontWeight: 600 }}>{run.passed}</td>
                  <td style={{ color: run.failed > 0 ? '#dc2626' : '#94a3b8', textAlign: 'center', fontWeight: 600 }}>{run.failed}</td>
                  <td style={{ color: '#d97706', textAlign: 'center' }}>{run.skipped}</td>
                  <td>{expanded === run.id ? '▲' : '▼'}</td>
                </tr>
                {expanded === run.id && run.results && (
                  <tr key={`${run.id}-detail`} className="qa-dash-row-detail">
                    <td colSpan={7}>
                      <div className="qa-run-detail-steps">
                        {run.results.map((r, i) => (
                          <div key={r.stepId} className={`qa-run-step ${r.status === 'fail' ? 'qa-run-step--fail' : r.status === 'skip' ? 'qa-run-step--skip' : ''}`}>
                            <span className="qa-run-step-num">{i + 1}</span>
                            <span className="qa-run-step-icon">
                              {r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '⏭'}
                            </span>
                            <span className="qa-run-step-title">{r.title}</span>
                            {r.note && <span className="qa-run-step-note">"{r.note}"</span>}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: PROTOCOLOS ──────────────────────────────────────────────────────────

const STATUS_LABEL = { active: { label: 'Activo', color: '#16a34a', bg: '#f0fdf4' }, partial: { label: 'Parcial', color: '#d97706', bg: '#fffbeb' }, pending: { label: 'Pendiente', color: '#94a3b8', bg: '#f8fafc' } }

function ProtocolsTab() {
  const [selected, setSelected] = useState(PROTOCOLS[0].id)
  const proto = PROTOCOLS.find(p => p.id === selected) || PROTOCOLS[0]
  const s = STATUS_LABEL[proto.status] || STATUS_LABEL.active

  return (
    <div className="qa-dash-tab-content qa-proto-layout">
      {/* Left nav */}
      <div className="qa-proto-nav">
        {PROTOCOLS.map(p => {
          const ps = STATUS_LABEL[p.status] || STATUS_LABEL.active
          return (
            <button
              key={p.id}
              className={`qa-proto-nav-item ${selected === p.id ? 'active' : ''}`}
              onClick={() => setSelected(p.id)}>
              <span>{p.icon}</span>
              <span className="qa-proto-nav-name">{p.name}</span>
              <span className="qa-proto-status-dot" style={{ background: ps.color }} />
            </button>
          )
        })}
      </div>

      {/* Right detail */}
      <div className="qa-proto-detail">
        <div className="qa-proto-header">
          <span className="qa-proto-icon">{proto.icon}</span>
          <div>
            <h2 className="qa-proto-title">{proto.name}</h2>
            <span className="qa-proto-status-badge" style={{ background: s.bg, color: s.color }}>
              {s.label}
            </span>
          </div>
        </div>

        <p className="qa-proto-desc">{proto.description}</p>

        <div className="qa-proto-section">
          <h4>Flujo de datos</h4>
          <code className="qa-proto-flow">{proto.flow}</code>
        </div>

        {proto.tables.length > 0 && (
          <div className="qa-proto-section">
            <h4>Tablas involucradas</h4>
            <div className="qa-proto-tables">
              {proto.tables.map(t => (
                <code key={t} className="qa-proto-table-chip">{t}</code>
              ))}
            </div>
          </div>
        )}

        <div className="qa-proto-section">
          <h4>Reglas críticas</h4>
          <ul className="qa-proto-rules">
            {proto.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* QA suite for this module if it exists */}
        {(() => {
          const suite = QA_SUITES.find(s => s.id === proto.id || s.id.startsWith(proto.id))
          if (!suite) return null
          return (
            <div className="qa-proto-section">
              <h4>Suite de verificación</h4>
              <div className="qa-proto-suite-card">
                <span>{suite.icon}</span>
                <div>
                  <div className="qa-proto-suite-name">{suite.name}</div>
                  <div className="qa-proto-suite-meta">{suite.steps.length} pasos · ~{suite.estimatedMin} min</div>
                  <div className="qa-proto-suite-desc">{suite.description}</div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: 'errors',    label: 'Errores',    icon: '🔴' },
  { id: 'activity',  label: 'Actividad',  icon: '📋' },
  { id: 'system',    label: 'Sistema',    icon: '📡' },
  { id: 'alerts',    label: 'Alertas',    icon: '🚨' },
  { id: 'ai',        label: 'IA',         icon: '🤖' },
  { id: 'qaruns',    label: 'QA Runs',    icon: '🧪' },
  { id: 'protocols', label: 'Protocolos', icon: '📖' },
]

export default function QADashboardPage({ teacher }) {
  const [activeTab, setActiveTab] = useState('errors')
  const [errorCount, setErrorCount] = useState(0)
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    // Load badge counts
    supabase.from('error_log').select('id', { count: 'exact', head: true })
      .then(({ count }) => setErrorCount(count || 0))
    supabase.from('system_alerts').select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .then(({ count }) => setAlertCount(count || 0))
  }, [])

  return (
    <div className="qa-dash-page">
      {/* Header */}
      <div className="qa-dash-header">
        <div className="qa-dash-header-left">
          <h1 className="qa-dash-title">Panel de Observabilidad</h1>
          <p className="qa-dash-subtitle">
            Logs, errores del sistema, uso de IA y protocolos de funcionamiento
          </p>
        </div>
        <div className="qa-dash-header-right">
          <span className="qa-dash-env-badge">
            {import.meta.env.VITE_SUPABASE_URL?.includes('vouxr') ? '🔴 PRODUCCIÓN' : '🟡 DESARROLLO'}
          </span>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="qa-dash-tabs">
        {TABS.map(t => (
          <TabButton
            key={t.id}
            id={t.id}
            label={t.label}
            icon={t.icon}
            active={activeTab === t.id}
            badge={t.id === 'errors' ? errorCount : t.id === 'alerts' ? alertCount : 0}
            onClick={setActiveTab}
          />
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'errors'    && <ErrorsTab    teacher={teacher} />}
      {activeTab === 'activity'  && <ActivityTab  teacher={teacher} />}
      {activeTab === 'system'    && <SystemTab    teacher={teacher} />}
      {activeTab === 'alerts'    && <AlertsTab    teacher={teacher} />}
      {activeTab === 'ai'        && <AITab        teacher={teacher} />}
      {activeTab === 'qaruns'    && <QARunsTab    teacher={teacher} />}
      {activeTab === 'protocols' && <ProtocolsTab />}
    </div>
  )
}
