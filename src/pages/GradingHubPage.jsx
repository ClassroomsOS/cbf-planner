// ── GradingHubPage.jsx ───────────────────────────────────────────────────────
// Entry point for live grading. Detects today's activities, lets teacher
// pick one and start a grading session. Mobile-first design.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useTodaysActivities from '../hooks/useTodaysActivities'
import useGradingSession from '../hooks/useGradingSession'
import { useToast } from '../context/ToastContext'

const ACTIVITY_ICONS = {
  dictation: '📝', dict: '📝', quiz: '📋', test: '📋', exam: '📋',
  present: '🎤', exposici: '🎤', recep: '📋', reading: '📖',
  speaking: '🎤', listening: '🎧', writing: '✍️', vocab: '🔤',
}

function getActivityIcon(name) {
  const n = (name || '').toLowerCase()
  for (const [key, icon] of Object.entries(ACTIVITY_ICONS)) {
    if (n.includes(key)) return icon
  }
  return '📊'
}

export default function GradingHubPage({ teacher }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { todayActivities, otherActivities, loading } = useTodaysActivities(teacher)
  const { startSession, loading: starting } = useGradingSession(teacher)
  const [maxScore, setMaxScore] = useState(5)

  async function handleStart(act) {
    const session = await startSession({
      newsProjectId: act.projectId,
      activityId:    act.id,
      activityName:  act.nombre,
      grade:         act.grade,
      section:       act.section,
      subject:       act.subject,
      maxScore,
    })
    if (session) {
      navigate(`/grading/session/${session.id}`)
    } else {
      showToast('No se pudo iniciar la sesión', 'error')
    }
  }

  function ActivityCard({ act, isToday }) {
    return (
      <div className="gh-card" style={{ borderLeft: isToday ? '4px solid #15803D' : '4px solid #d0d5dd' }}>
        <div className="gh-card-header">
          <span className="gh-card-icon">{getActivityIcon(act.nombre)}</span>
          <div className="gh-card-info">
            <strong>{act.nombre}</strong>
            {act.descripcion && <span className="gh-card-desc">{act.descripcion}</span>}
          </div>
          {act.porcentaje > 0 && <span className="gh-card-pct">{act.porcentaje}%</span>}
        </div>
        <div className="gh-card-meta">
          <span>{act.grade} {act.section}</span>
          <span>·</span>
          <span>{act.subject}</span>
          {act.fecha && <><span>·</span><span>{act.fecha}</span></>}
        </div>
        {act.projectTitle && <div className="gh-card-project">📋 {act.projectTitle}</div>}
        <button
          className="gh-start-btn"
          onClick={() => handleStart(act)}
          disabled={starting || !act.id}
        >
          {!act.id ? 'Sin ID (guardar proyecto primero)' : starting ? 'Iniciando...' : '▶ Calificar'}
        </button>
      </div>
    )
  }

  return (
    <div className="gh-page">
      <div className="gh-header">
        <h2>✅ Calificaciones</h2>
        <p>Selecciona una actividad para calificar en vivo</p>
      </div>

      <div className="gh-max-score">
        <label>Puntaje máximo:</label>
        <div className="gh-max-btns">
          {[5, 10, 20, 50, 100].map(v => (
            <button
              key={v}
              className={`gh-max-btn ${maxScore === v ? 'active' : ''}`}
              onClick={() => setMaxScore(v)}
            >{v}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="gh-loading">Cargando actividades...</div>
      ) : (
        <>
          {todayActivities.length > 0 && (
            <div className="gh-section">
              <h3 className="gh-section-title">🔴 Hoy</h3>
              {todayActivities.map((act, i) => <ActivityCard key={act.id || i} act={act} isToday />)}
            </div>
          )}

          {todayActivities.length === 0 && (
            <div className="gh-empty-today">
              No hay actividades programadas para hoy.
              {otherActivities.length > 0 && ' Puedes calificar una actividad del período:'}
            </div>
          )}

          {otherActivities.length > 0 && (
            <div className="gh-section">
              <h3 className="gh-section-title">📅 Otras actividades del período</h3>
              {otherActivities.map((act, i) => <ActivityCard key={act.id || i} act={act} isToday={false} />)}
            </div>
          )}

          {todayActivities.length === 0 && otherActivities.length === 0 && (
            <div className="gh-empty">
              <p>No hay actividades evaluativas registradas.</p>
              <p>Crea un proyecto NEWS con actividades y fechas para empezar a calificar.</p>
            </div>
          )}
        </>
      )}

      <button className="gh-history-link" onClick={() => navigate('/grading/history')}>
        📊 Ver historial de calificaciones
      </button>
    </div>
  )
}
