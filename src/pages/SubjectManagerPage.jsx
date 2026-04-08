// ── SubjectManagerPage.jsx ─────────────────────────────────────────────────────
// Admin view: all teacher_assignments grouped by subject → grade/section.
// Read-only overview complementing AdminTeachersPage (which is teacher-centric).

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const DAY_LABELS = { mon: 'L', tue: 'M', wed: 'X', thu: 'J', fri: 'V' }

function scheduleChips(schedule) {
  if (!schedule || typeof schedule !== 'object') return null
  return Object.entries(schedule).map(([day, periods]) => {
    if (!periods?.length) return null
    return (
      <span key={day} style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        background: '#EEF2FF', color: '#2E5598', borderRadius: 4,
        padding: '1px 5px', fontSize: 11, fontWeight: 600, marginRight: 3,
      }}>
        {DAY_LABELS[day]} {periods.join(',')}
      </span>
    )
  })
}

export default function SubjectManagerPage({ teacher }) {
  const [assignments, setAssignments] = useState([])
  const [teachers,    setTeachers]    = useState({})
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [expanded,    setExpanded]    = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: rows }, { data: trows }] = await Promise.all([
      supabase
        .from('teacher_assignments')
        .select('*')
        .eq('school_id', teacher.school_id)
        .order('subject').order('grade').order('section'),
      supabase
        .from('teachers')
        .select('id, full_name, initials, role')
        .eq('school_id', teacher.school_id),
    ])
    const tmap = {}
    for (const t of trows || []) tmap[t.id] = t
    setTeachers(tmap)
    setAssignments(rows || [])
    setLoading(false)
    // Expand first subject by default
    if (rows?.length) {
      const first = rows[0].subject
      setExpanded({ [first]: true })
    }
  }

  // Group: subject → [ assignment, ... ]
  const bySubject = {}
  for (const a of assignments) {
    ;(bySubject[a.subject] = bySubject[a.subject] || []).push(a)
  }

  const subjects = Object.keys(bySubject)
    .filter(s => !search || s.toLowerCase().includes(search.toLowerCase()))
    .sort()

  function toggle(subj) {
    setExpanded(prev => ({ ...prev, [subj]: !prev[subj] }))
  }

  const totalSubjects = subjects.length
  const totalRows     = subjects.reduce((n, s) => n + bySubject[s].length, 0)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, color: '#1F3864', fontWeight: 700 }}>
          📊 Gestión de Materias
        </h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>
          {totalSubjects} materias · {totalRows} asignaciones en el colegio
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 18 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar materia..."
          style={{
            padding: '8px 12px', borderRadius: 8, border: '1px solid #D0D5DD',
            fontSize: 13, width: '100%', maxWidth: 340, boxSizing: 'border-box',
          }}
        />
      </div>

      {loading && (
        <p style={{ color: '#888', fontStyle: 'italic' }}>Cargando asignaciones…</p>
      )}

      {!loading && subjects.length === 0 && (
        <div style={{
          background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8,
          padding: '16px 20px', color: '#7A6200',
        }}>
          No hay materias registradas aún. Crea asignaciones en{' '}
          <strong>Docentes → Asignaciones</strong>.
        </div>
      )}

      {/* Subject cards */}
      {subjects.map(subject => {
        const rows = bySubject[subject]
        const isOpen = !!expanded[subject]
        // unique teacher count
        const teacherIds = new Set(rows.map(r => r.teacher_id))

        return (
          <div key={subject} style={{
            background: '#fff', border: '1px solid #E2E8F0',
            borderRadius: 10, marginBottom: 10, overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          }}>
            {/* Subject header */}
            <button
              onClick={() => toggle(subject)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '12px 16px',
                background: 'none', border: 'none', cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  background: '#EEF2FF', color: '#2E5598', borderRadius: 6,
                  padding: '3px 10px', fontSize: 13, fontWeight: 700,
                }}>
                  {subject}
                </span>
                <span style={{ color: '#888', fontSize: 12 }}>
                  {rows.length} grupo{rows.length !== 1 ? 's' : ''} ·{' '}
                  {teacherIds.size} docente{teacherIds.size !== 1 ? 's' : ''}
                </span>
              </div>
              <span style={{ color: '#999', fontSize: 16, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                ›
              </span>
            </button>

            {/* Assignment rows */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #F0F0F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Grado', 'Sección', 'Docente', 'Salón', 'Horario'].map(h => (
                        <th key={h} style={{
                          padding: '8px 12px', textAlign: 'left',
                          fontWeight: 600, color: '#64748B', fontSize: 12,
                          borderBottom: '1px solid #E8EFF6',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a, i) => {
                      const t = teachers[a.teacher_id]
                      return (
                        <tr key={a.id} style={{
                          background: i % 2 === 0 ? '#fff' : '#FAFBFD',
                          borderBottom: '1px solid #F0F4F8',
                        }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{a.grade}</td>
                          <td style={{ padding: '8px 12px' }}>{a.section}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {t ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  background: '#2E5598', color: '#fff',
                                  borderRadius: '50%', width: 24, height: 24,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                                }}>
                                  {t.initials || t.full_name?.[0] || '?'}
                                </span>
                                {t.full_name}
                              </span>
                            ) : (
                              <span style={{ color: '#bbb', fontStyle: 'italic' }}>Sin asignar</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#666' }}>
                            {a.classroom || <span style={{ color: '#ccc' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {scheduleChips(a.schedule)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
