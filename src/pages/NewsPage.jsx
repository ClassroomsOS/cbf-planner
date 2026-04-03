import { useState, useMemo, useEffect } from 'react'
import useNewsProjects from '../hooks/useNewsProjects'
import useRubricTemplates from '../hooks/useRubricTemplates'
import NewsProjectEditor from '../components/news/NewsProjectEditor'
import NewsProjectCard from '../components/news/NewsProjectCard'
import NewsTimeline from '../components/news/NewsTimeline'
import { supabase } from '../supabase'
import { ACADEMIC_PERIODS } from '../utils/constants'

// Map to legacy format for this component
const PERIODS = ACADEMIC_PERIODS.map((p, i) => ({
  value: i + 1,
  label: `Período ${i + 1}`
}))

export default function NewsPage({ teacher }) {
  const school = teacher.schools || {}
  const [selectedPeriod, setSelectedPeriod] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [filterSubject, setFilterSubject] = useState('')
  const [monthPrinciple, setMonthPrinciple] = useState(null)

  useEffect(() => {
    const now = new Date()
    supabase
      .from('school_monthly_principles')
      .select('month_verse, month_verse_ref, indicator_principle')
      .eq('school_id', teacher.school_id)
      .eq('year',  now.getFullYear())
      .eq('month', now.getMonth() + 1)
      .maybeSingle()
      .then(({ data }) => { if (data) setMonthPrinciple(data) })
  }, [teacher.school_id])

  const { 
    projects, loading, error,
    createProject, updateProject, deleteProject, updateStatus, fetchProjects 
  } = useNewsProjects(teacher, { period: selectedPeriod })

  const { templates, cloneForProject } = useRubricTemplates(teacher)

  // Get unique subjects from projects
  const subjects = useMemo(() => {
    const set = new Set(projects.map(p => p.subject))
    return Array.from(set).sort()
  }, [projects])

  // Filtered projects
  const filteredProjects = useMemo(() => {
    if (!filterSubject) return projects
    return projects.filter(p => p.subject === filterSubject)
  }, [projects, filterSubject])

  // Group by subject + grade/section
  const groupedProjects = useMemo(() => {
    const groups = {}
    filteredProjects.forEach(p => {
      const key = `${p.subject} · ${p.grade} ${p.section}`
      if (!groups[key]) groups[key] = []
      groups[key].push(p)
    })
    return groups
  }, [filteredProjects])

  const handleNew = () => {
    setEditingProject(null)
    setEditorOpen(true)
  }

  const handleEdit = (project) => {
    setEditingProject(project)
    setEditorOpen(true)
  }

  const handleSave = async (data) => {
    let result
    if (editingProject) {
      result = await updateProject(editingProject.id, data)
    } else {
      result = await createProject(data)
    }
    if (!result.error) {
      setEditorOpen(false)
      setEditingProject(null)
    }
    return result
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proyecto NEWS? Las guías vinculadas no se borrarán.')) return
    await deleteProject(id)
  }

  const handleStatusChange = async (id, newStatus) => {
    await updateStatus(id, newStatus)
  }

  const statusCounts = useMemo(() => {
    const counts = { draft: 0, published: 0, in_progress: 0, completed: 0 }
    projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1 })
    return counts
  }, [projects])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: 24, flexWrap: 'wrap', gap: 16
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', margin: 0 }}>
            📋 NEWS Projects
          </h1>
          <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Define los proyectos que guiarán la planificación de cada período
          </p>
        </div>
        <button onClick={handleNew} style={styles.btnPrimary}>
          + Nuevo Proyecto NEWS
        </button>
      </div>

      {/* Period tabs + filters */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center'
      }}>
        <div style={styles.tabGroup}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setSelectedPeriod(p.value)}
              style={{
                ...styles.tab,
                ...(selectedPeriod === p.value ? styles.tabActive : {})
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {subjects.length > 1 && (
          <select
            value={filterSubject}
            onChange={e => setFilterSubject(e.target.value)}
            style={styles.select}
          >
            <option value="">Todas las materias</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Status summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { key: 'draft', label: 'Borrador', color: '#888', bg: '#f5f5f5' },
          { key: 'published', label: 'Publicado', color: '#1A3A8F', bg: '#EEF2FB' },
          { key: 'in_progress', label: 'En curso', color: '#B8860B', bg: '#FFFDF0' },
          { key: 'completed', label: 'Completado', color: '#1A6B3A', bg: '#EEFBF0' }
        ].map(s => (
          <div key={s.key} style={{
            padding: '6px 14px', borderRadius: 8,
            background: s.bg, color: s.color,
            fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: s.color, display: 'inline-block'
            }} />
            {s.label}: {statusCounts[s.key]}
          </div>
        ))}
      </div>

      {/* Timeline */}
      {filteredProjects.length > 0 && (
        <NewsTimeline projects={filteredProjects} onEdit={handleEdit} />
      )}

      {/* Loading / Error / Empty */}
      {loading && (
        <div style={styles.emptyState}>
          <div className="loading-spinner" style={{ width: 32, height: 32 }} />
          <p>Cargando proyectos...</p>
        </div>
      )}

      {error && (
        <div style={{ ...styles.emptyState, color: '#CC1F27' }}>
          <p>Error: {error}</p>
          <button onClick={fetchProjects} style={styles.btnSecondary}>Reintentar</button>
        </div>
      )}

      {!loading && !error && projects.length === 0 && (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <h3 style={{ margin: '0 0 8px', fontWeight: 700 }}>
            Sin proyectos NEWS en Período {selectedPeriod}
          </h3>
          <p style={{ color: '#888', fontSize: 13, maxWidth: 400, lineHeight: 1.5 }}>
            Los proyectos NEWS son el norte de tu planificación. 
            Defínelos primero y cada guía semanal sabrá hacia dónde apuntar.
          </p>
          <button onClick={handleNew} style={{ ...styles.btnPrimary, marginTop: 16 }}>
            + Crear primer proyecto
          </button>
        </div>
      )}

      {/* Project cards grouped */}
      {!loading && Object.keys(groupedProjects).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.entries(groupedProjects).map(([groupLabel, groupProjects]) => (
            <div key={groupLabel}>
              <h3 style={{
                fontSize: 13, fontWeight: 800, color: '#1A3A8F',
                textTransform: 'uppercase', letterSpacing: '0.5px',
                marginBottom: 12, paddingBottom: 8,
                borderBottom: '2px solid #EEF2FB'
              }}>
                {groupLabel}
              </h3>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320, 1fr))',
                gap: 16
              }}>
                {groupProjects.map(project => (
                  <NewsProjectCard
                    key={project.id}
                    project={project}
                    onEdit={() => handleEdit(project)}
                    onDelete={() => handleDelete(project.id)}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editorOpen && (
        <NewsProjectEditor
          teacher={teacher}
          project={editingProject}
          initialPeriod={selectedPeriod}
          templates={templates}
          cloneForProject={cloneForProject}
          onSave={handleSave}
          onClose={() => { setEditorOpen(false); setEditingProject(null) }}
          yearVerse={{ text: school.year_verse || '', ref: school.year_verse_ref || '' }}
          monthVerse={{ text: monthPrinciple?.month_verse || '', ref: monthPrinciple?.month_verse_ref || '' }}
        />
      )}
    </div>
  )
}

const styles = {
  btnPrimary: {
    padding: '10px 20px', border: 'none', borderRadius: 10,
    background: '#1A3A8F', color: 'white',
    fontSize: 13, fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.18s'
  },
  btnSecondary: {
    padding: '8px 16px', border: '1.5px solid #ddd', borderRadius: 8,
    background: 'white', color: '#555',
    fontSize: 12, fontWeight: 700, cursor: 'pointer'
  },
  tabGroup: {
    display: 'flex', background: '#f0f0f0', borderRadius: 10,
    padding: 3, gap: 2
  },
  tab: {
    padding: '7px 16px', border: 'none', borderRadius: 8,
    background: 'transparent', color: '#888',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    transition: 'all 0.18s'
  },
  tabActive: {
    background: '#1A3A8F', color: 'white'
  },
  select: {
    padding: '7px 12px', border: '1.5px solid #ddd', borderRadius: 8,
    fontSize: 12, fontWeight: 600, color: '#555',
    background: 'white', cursor: 'pointer'
  },
  emptyState: {
    textAlign: 'center', padding: '48px 24px',
    background: 'white', borderRadius: 16,
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)'
  }
}
