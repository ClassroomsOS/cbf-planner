import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'
import { LEVEL_LABELS, canGiveFeedback } from '../utils/roles'
import FeedbackModal from '../components/FeedbackModal'

// ── DirectorPage ──────────────────────────────────────────────────────────────
// Read-only view for rector and coordinator: see all lesson plans, NEWS projects,
// and weekly agendas in the school, filterable by teacher / grade / status.
// Also allows leaving feedback on any document (rector + coordinator).

export default function DirectorPage({ teacher }) {
  const [activeTab,  setActiveTab]  = useState('guides')
  const [plans,      setPlans]      = useState([])
  const [newsProjs,  setNewsProjs]  = useState([])
  const [agendas,    setAgendas]    = useState([])
  const [teachers,   setTeachers]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [feedback,   setFeedback]   = useState(null) // { entityType, entityId, entityTitle }

  // Filters shared across tabs
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterGrade,   setFilterGrade]   = useState('all')
  const [filterStatus,  setFilterStatus]  = useState('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [
      { data: planData },
      { data: newsData },
      { data: agendaData },
      { data: teacherData },
    ] = await Promise.all([
      supabase.from('lesson_plans')
        .select('id, title, grade, status, created_at, updated_at, teacher_id, content')
        .eq('school_id', teacher.school_id)
        .order('updated_at', { ascending: false })
        .limit(300),
      supabase.from('news_projects')
        .select('id, title, subject, skill, status, due_date, teacher_id, updated_at, news_model')
        .eq('school_id', teacher.school_id)
        .order('updated_at', { ascending: false })
        .limit(200),
      supabase.from('weekly_agendas')
        .select('id, grade, section, week_start, status, updated_at, devotional')
        .eq('school_id', teacher.school_id)
        .order('week_start', { ascending: false })
        .limit(200),
      supabase.from('teachers')
        .select('id, full_name, initials, role, level')
        .eq('school_id', teacher.school_id)
        .eq('status', 'approved'),
    ])
    setPlans(planData    || [])
    setNewsProjs(newsData  || [])
    setAgendas(agendaData || [])
    setTeachers(teacherData || [])
    setLoading(false)
  }

  const teacherMap = useMemo(() => {
    const m = {}; teachers.forEach(t => { m[t.id] = t }); return m
  }, [teachers])

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredPlans = useMemo(() => plans.filter(p => {
    if (filterTeacher !== 'all' && p.teacher_id !== filterTeacher) return false
    if (filterGrade   !== 'all' && p.grade !== filterGrade)         return false
    if (filterStatus  !== 'all' && p.status !== filterStatus)       return false
    return true
  }), [plans, filterTeacher, filterGrade, filterStatus])

  const filteredNews = useMemo(() => newsProjs.filter(p => {
    if (filterTeacher !== 'all' && p.teacher_id !== filterTeacher) return false
    if (filterStatus  !== 'all' && p.status !== filterStatus)       return false
    return true
  }), [newsProjs, filterTeacher, filterStatus])

  const filteredAgendas = useMemo(() => agendas.filter(a => {
    if (filterGrade  !== 'all' && a.grade !== filterGrade)   return false
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    return true
  }), [agendas, filterGrade, filterStatus])

  const gradeOptions = useMemo(() =>
    [...new Set(plans.map(p => p.grade).filter(Boolean))].sort()
  , [plans])

  const canFeedback = canGiveFeedback(teacher.role)

  // ── Status configs ─────────────────────────────────────────────────────────
  const PLAN_STATUS = {
    draft:     { label: 'Borrador',  color: '#888',    bg: '#f5f5f5' },
    complete:  { label: 'Completa',  color: '#4BACC6', bg: '#e8f7fb' },
    submitted: { label: 'Enviada',   color: '#F79646', bg: '#fff3e8' },
    approved:  { label: 'Aprobada',  color: '#9BBB59', bg: '#eef7e0' },
  }
  const NEWS_STATUS = {
    draft:     { label: 'Borrador',   color: '#888',    bg: '#f5f5f5' },
    active:    { label: 'Activo',     color: '#9BBB59', bg: '#eef7e0' },
    completed: { label: 'Completado', color: '#4BACC6', bg: '#e8f7fb' },
  }
  const AGENDA_STATUS = {
    draft:  { label: 'Borrador', color: '#888',    bg: '#f5f5f5'  },
    ready:  { label: 'Lista',    color: '#2E5598', bg: '#eef2fb'  },
    sent:   { label: 'Enviada',  color: '#9BBB59', bg: '#eef7e0'  },
  }
  const SKILL_COLOR = {
    Speaking: '#8064A2', Listening: '#4BACC6', Reading: '#F79646', Writing: '#9BBB59',
  }

  function clearFilters() {
    setFilterTeacher('all'); setFilterGrade('all'); setFilterStatus('all')
  }
  const hasFilters = filterTeacher !== 'all' || filterGrade !== 'all' || filterStatus !== 'all'

  if (loading) return (
    <div className="ge-loading">
      <div className="loading-spinner" />
      <p>Cargando datos…</p>
    </div>
  )

  return (
    <div className="lt-page">

      {/* Top bar */}
      <div className="ge-topbar">
        <div className="ge-topbar-info">
          <span className="ge-guide-title">🎓 Vista Rector</span>
          <span className="ge-guide-dates">
            {teacher.schools?.name || 'Mi Colegio'}
            {teacher.level ? ` · ${LEVEL_LABELS[teacher.level]}` : ''}
          </span>
        </div>
      </div>

      <div className="lt-body">

        {/* ── Tabs ── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px',
          background: '#f0f4ff', borderRadius: '10px', padding: '4px' }}>
          {[
            { key: 'guides',  label: '📝 Guías',        count: filteredPlans.length },
            { key: 'news',    label: '📋 NEWS',          count: filteredNews.length },
            { key: 'agendas', label: '🗓 Agendas',       count: filteredAgendas.length },
          ].map(tab => (
            <button key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '8px 12px', border: 'none', borderRadius: '7px',
                cursor: 'pointer', fontSize: '12px', fontWeight: 700, transition: 'all .15s',
                background: activeTab === tab.key ? '#fff' : 'transparent',
                color:      activeTab === tab.key ? '#1F3864' : '#888',
                boxShadow:  activeTab === tab.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              }}>
              {tab.label}
              <span style={{
                marginLeft: '6px', fontSize: '10px', fontWeight: 800,
                color: activeTab === tab.key ? '#2E5598' : '#bbb',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="lt-filters" style={{ marginBottom: '14px' }}>
          {activeTab !== 'agendas' && (
            <div className="lt-filter-group">
              <label>Docente</label>
              <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)}>
                <option value="all">Todos</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
              </select>
            </div>
          )}
          {activeTab !== 'news' && (
            <div className="lt-filter-group">
              <label>Grado</label>
              <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
                <option value="all">Todos</option>
                {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          <div className="lt-filter-group">
            <label>Estado</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Todos</option>
              {activeTab === 'guides' && Object.entries(PLAN_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
              {activeTab === 'news' && Object.entries(NEWS_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
              {activeTab === 'agendas' && Object.entries(AGENDA_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button className="lt-clear-filters" onClick={clearFilters}>✕ Limpiar</button>
          )}
        </div>

        {/* ── TAB: Guías ── */}
        {activeTab === 'guides' && (
          filteredPlans.length === 0 ? (
            <div className="lt-empty">
              <div className="lt-empty-icon">📝</div>
              <h3>No hay guías</h3>
              <p>Ajusta los filtros o espera a que los docentes creen guías.</p>
            </div>
          ) : (
            <div className="lt-list">
              {filteredPlans.map(plan => {
                const t         = teacherMap[plan.teacher_id]
                const statusCfg = PLAN_STATUS[plan.status] || PLAN_STATUS.draft
                const info      = plan.content?.info || {}
                const updatedAt = plan.updated_at
                  ? new Date(plan.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                  : ''
                return (
                  <div key={plan.id} className="lt-card" style={{ cursor: 'default' }}>
                    <div className="lt-card-header">
                      <div className="lt-card-meta">
                        <span className="lt-meta-pill grade">{plan.grade}</span>
                        {info.asignatura && <span className="lt-meta-pill subject">{info.asignatura}</span>}
                        {info.semana     && <span className="lt-meta-pill period">Sem. {info.semana}</span>}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: statusCfg.bg, color: statusCfg.color,
                          border: `1px solid ${statusCfg.color}33`,
                        }}>{statusCfg.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#aaa' }}>Act. {updatedAt}</span>
                        {canFeedback && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '10px', padding: '2px 8px' }}
                            onClick={() => setFeedback({ entityType: 'guide', entityId: plan.id, entityTitle: plan.title || 'Guía sin título' })}>
                            💬 Feedback
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      {t && (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', background: '#2E5598',
                          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                          {t.initials || t.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1F3864' }}>
                          {plan.title || 'Guía sin título'}
                        </div>
                        {t && <div style={{ fontSize: 11, color: '#888' }}>{t.full_name}</div>}
                      </div>
                    </div>
                    {plan.content?.objetivo?.general && (
                      <p style={{
                        margin: '8px 0 0', fontSize: 12, color: '#555', lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        🎯 {plan.content.objetivo.general}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── TAB: NEWS ── */}
        {activeTab === 'news' && (
          filteredNews.length === 0 ? (
            <div className="lt-empty">
              <div className="lt-empty-icon">📋</div>
              <h3>No hay proyectos NEWS</h3>
              <p>Ajusta los filtros.</p>
            </div>
          ) : (
            <div className="lt-list">
              {filteredNews.map(proj => {
                const t         = teacherMap[proj.teacher_id]
                const statusCfg = NEWS_STATUS[proj.status] || NEWS_STATUS.draft
                const skillColor = SKILL_COLOR[proj.skill] || '#2E5598'
                const updatedAt = proj.updated_at
                  ? new Date(proj.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                  : ''
                const dueDate = proj.due_date
                  ? new Date(proj.due_date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                  : null
                return (
                  <div key={proj.id} className="lt-card" style={{ cursor: 'default' }}>
                    <div className="lt-card-header">
                      <div className="lt-card-meta">
                        {proj.subject && <span className="lt-meta-pill subject">{proj.subject}</span>}
                        {proj.skill && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: skillColor + '18', color: skillColor,
                            border: `1px solid ${skillColor}50`,
                          }}>{proj.skill}</span>
                        )}
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: statusCfg.bg, color: statusCfg.color,
                          border: `1px solid ${statusCfg.color}33`,
                        }}>{statusCfg.label}</span>
                        {dueDate && (
                          <span style={{ fontSize: 10, color: '#888' }}>🏁 {dueDate}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#aaa' }}>Act. {updatedAt}</span>
                        {canFeedback && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '10px', padding: '2px 8px' }}
                            onClick={() => setFeedback({ entityType: 'news', entityId: proj.id, entityTitle: proj.title || 'Proyecto NEWS' })}>
                            💬 Feedback
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      {t && (
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: skillColor, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                          {t.initials || t.full_name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1F3864' }}>
                          {proj.title || 'Proyecto sin título'}
                        </div>
                        {t && <div style={{ fontSize: 11, color: '#888' }}>{t.full_name}</div>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* ── TAB: Agendas ── */}
        {activeTab === 'agendas' && (
          filteredAgendas.length === 0 ? (
            <div className="lt-empty">
              <div className="lt-empty-icon">🗓</div>
              <h3>No hay agendas</h3>
              <p>Ajusta los filtros.</p>
            </div>
          ) : (
            <div className="lt-list">
              {filteredAgendas.map(ag => {
                const statusCfg = AGENDA_STATUS[ag.status] || AGENDA_STATUS.draft
                const weekLabel = ag.week_start
                  ? (() => {
                      const d = new Date(ag.week_start + 'T12:00:00')
                      const end = new Date(d); end.setDate(d.getDate() + 4)
                      const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
                      if (d.getMonth() === end.getMonth())
                        return `${d.getDate()}–${end.getDate()} ${MONTHS[d.getMonth()]}`
                      return `${d.getDate()} ${MONTHS[d.getMonth()]}–${end.getDate()} ${MONTHS[end.getMonth()]}`
                    })()
                  : ''
                const updatedAt = ag.updated_at
                  ? new Date(ag.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                  : ''
                return (
                  <div key={ag.id} className="lt-card" style={{ cursor: 'default' }}>
                    <div className="lt-card-header">
                      <div className="lt-card-meta">
                        <span className="lt-meta-pill grade">{ag.grade}</span>
                        <span className="lt-meta-pill subject">{ag.section}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                          background: statusCfg.bg, color: statusCfg.color,
                          border: `1px solid ${statusCfg.color}33`,
                        }}>{statusCfg.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: '#aaa' }}>Act. {updatedAt}</span>
                        {canFeedback && (
                          <button
                            className="btn-secondary"
                            style={{ fontSize: '10px', padding: '2px 8px' }}
                            onClick={() => setFeedback({ entityType: 'agenda', entityId: ag.id, entityTitle: `Agenda ${ag.grade} ${ag.section} — ${weekLabel}` })}>
                            💬 Feedback
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '8px', background: '#f0f4ff',
                        color: '#2E5598', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16, flexShrink: 0,
                      }}>🗓</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1F3864' }}>
                          {ag.grade} {ag.section}
                        </div>
                        <div style={{ fontSize: 11, color: '#888' }}>
                          Semana del {weekLabel}
                        </div>
                      </div>
                      {ag.devotional && (
                        <div style={{
                          marginLeft: 'auto', fontSize: '10px', color: '#2E5598',
                          background: '#eef2ff', borderRadius: '4px', padding: '2px 8px',
                          maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          ✝ {ag.devotional.split('\n')[0]}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Feedback modal */}
      {feedback && (
        <FeedbackModal
          entityType={feedback.entityType}
          entityId={feedback.entityId}
          entityTitle={feedback.entityTitle}
          teacher={teacher}
          onClose={() => setFeedback(null)}
        />
      )}
    </div>
  )
}
