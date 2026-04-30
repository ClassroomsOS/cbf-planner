// ── NewsTimelinePage.jsx ──────────────────────────────────────────────────────
// /news/timeline — Dedicated full-page timeline of all NEWS activities per period.

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import useNewsProjects from '../hooks/useNewsProjects'
import NewsPeriodTimeline from '../components/news/NewsPeriodTimeline'
import NewsEventDetail from '../components/news/NewsEventDetail'
import NewsProjectEditor from '../components/news/NewsProjectEditor'
import useRubricTemplates from '../hooks/useRubricTemplates'
import { supabase } from '../supabase'
import { ACADEMIC_PERIODS } from '../utils/constants'
import { useToast } from '../context/ToastContext'

const PERIODS = ACADEMIC_PERIODS.map((p, i) => ({ value: i + 1, label: `Período ${i + 1}` }))

export default function NewsTimelinePage({ teacher }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const school = teacher.schools || {}
  const [selectedPeriod, setSelectedPeriod] = useState(1)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [monthPrinciple, setMonthPrinciple] = useState(null)

  const { projects, loading, updateProject, fetchProjects } = useNewsProjects(teacher, { period: selectedPeriod })
  const { templates, cloneForProject } = useRubricTemplates(teacher)

  const handleEventClick = useCallback((ev) => {
    setSelectedEvent(prev => prev?.id === ev.id ? null : ev)
  }, [])

  const handleEditProject = useCallback(async (projectId) => {
    const proj = projects.find(p => p.id === projectId)
    if (!proj) return

    // Load month principle for this project
    const targetDate = proj.start_date ? new Date(proj.start_date) : new Date()
    const { data } = await supabase
      .from('school_monthly_principles')
      .select('month_verse, month_verse_ref, indicator_principle')
      .eq('school_id', teacher.school_id)
      .eq('year', targetDate.getFullYear())
      .eq('month', targetDate.getMonth() + 1)
      .maybeSingle()
    if (data) setMonthPrinciple(data)

    setEditingProject(proj)
    setEditorOpen(true)
  }, [projects, teacher.school_id])

  const handleSave = async (data) => {
    if (!editingProject) return
    const result = await updateProject(editingProject.id, data)
    if (!result.error) {
      setEditorOpen(false)
      setEditingProject(null)
      setSelectedEvent(null)
      showToast('Proyecto actualizado', 'success')
    }
    return result
  }

  return (
    <div className="nt-page">
      {/* Header */}
      <div className="nt-page-header">
        <div>
          <button className="nt-back" onClick={() => navigate('/news')}>
            ← Volver a NEWS
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', margin: '12px 0 4px' }}>
            🗓 Timeline del Período
          </h1>
          <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
            Todas las actividades evaluativas del período en una vista cronológica
          </p>
        </div>
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          display: 'flex', background: '#f0f0f0', borderRadius: 10, padding: 3, gap: 2
        }}>
          {PERIODS.map(p => (
            <button key={p.value}
              onClick={() => { setSelectedPeriod(p.value); setSelectedEvent(null) }}
              style={{
                padding: '7px 16px', border: 'none', borderRadius: 8,
                background: selectedPeriod === p.value ? '#1A3A8F' : 'transparent',
                color: selectedPeriod === p.value ? 'white' : '#888',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s'
              }}>
              {p.label}
            </button>
          ))}
        </div>
        {loading && (
          <span style={{ fontSize: 12, color: '#888' }}>Cargando...</span>
        )}
      </div>

      {/* Timeline */}
      <NewsPeriodTimeline
        projects={projects}
        compact={false}
        onEventClick={handleEventClick}
        selectedEventId={selectedEvent?.id}
      />

      {/* Detail panel */}
      {selectedEvent ? (
        <NewsEventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEditProject={handleEditProject}
        />
      ) : (
        <div className="nt-detail nt-detail--collapsed" />
      )}

      {/* Editor modal */}
      {editorOpen && editingProject && (
        <NewsProjectEditor
          key={editingProject.id}
          teacher={teacher}
          school={school}
          project={editingProject}
          templates={templates}
          cloneForProject={cloneForProject}
          onSave={handleSave}
          onClose={() => { setEditorOpen(false); setEditingProject(null) }}
          principles={{
            yearVerse: school.year_verse || '',
            yearVerseRef: school.year_verse_ref || '',
            monthVerse: monthPrinciple?.month_verse || '',
            monthVerseRef: monthPrinciple?.month_verse_ref || '',
            indicatorPrinciple: monthPrinciple?.indicator_principle || ''
          }}
        />
      )}
    </div>
  )
}
