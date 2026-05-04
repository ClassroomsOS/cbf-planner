// ── useStudentTasks.js ────────────────────────────────────────────────────────
// Aggregates tasks from NEWS activities, exams, and micro-activities into a
// unified list for a single student. Used by StudentDetailPage.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

const SOURCE_LABELS = { news: 'NEWS', exam: 'Examen', micro: 'Micro-actividad' }

export { SOURCE_LABELS }

export default function useStudentTasks({ teacher, studentId, grade, section }) {
  const [tasks, setTasks] = useState([])
  const [counts, setCounts] = useState({ pending: 0, inProgress: 0, completed: 0, late: 0 })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!teacher?.id || !studentId || !grade || !section) return
    setLoading(true)

    const [newsRes, instancesRes, microRes, gradesRes] = await Promise.all([
      // 1. NEWS projects for this teacher's grade/section
      supabase.from('news_projects')
        .select('id, title, grade, section, subject, skill, due_date, actividades_evaluativas, status')
        .eq('school_id', teacher.school_id)
        .eq('grade', grade)
        .eq('section', section)
        .in('status', ['draft', 'in_progress', 'active']),

      // 2. Exam instances for this student
      supabase.from('exam_instances')
        .select('id, session_id, instance_status, submitted_at, version_label, exam_sessions(id, title, subject, ended_at, status)')
        .eq('student_id', studentId),

      // 3. Micro-activities for this grade/section by any teacher at school
      supabase.from('micro_activities')
        .select('id, name, description, category, activity_date, status, teacher_id, created_at')
        .eq('school_id', teacher.school_id)
        .eq('grade', grade)
        .eq('section', section),

      // 4. Student's grades (to determine completion)
      supabase.from('student_activity_grades')
        .select('id, news_project_id, activity_id, micro_activity_id, colombian_grade, graded_at')
        .eq('student_id', studentId),
    ])

    const newsProjects = newsRes.data || []
    const instances = instancesRes.data || []
    const micros = microRes.data || []
    const studentGrades = gradesRes.data || []

    // Build grade lookup maps
    const actGradeMap = {} // key: `${news_project_id}|${activity_id}`
    const microGradeMap = {} // key: micro_activity_id
    for (const g of studentGrades) {
      if (g.news_project_id && g.activity_id) {
        actGradeMap[`${g.news_project_id}|${g.activity_id}`] = g
      }
      if (g.micro_activity_id) {
        microGradeMap[g.micro_activity_id] = g
      }
    }

    const allTasks = []

    // ── NEWS activities ─────────────────────────────────────────────────────────
    for (const proj of newsProjects) {
      const acts = proj.actividades_evaluativas || []
      for (const act of acts) {
        if (!act.nombre) continue
        const gradeRow = actGradeMap[`${proj.id}|${act.id}`]
        let status = 'pending'
        if (gradeRow) {
          status = 'completed'
          if (act.fecha && gradeRow.graded_at && gradeRow.graded_at.slice(0, 10) > act.fecha) {
            status = 'late'
          }
        }
        allTasks.push({
          id: `news-${proj.id}-${act.id || act.nombre}`,
          name: act.nombre,
          description: act.descripcion || '',
          source: 'news',
          sourceId: proj.id,
          sourceTitle: proj.title,
          category: act.categoria || 'cognitiva',
          dueDate: act.fecha || null,
          createdAt: null,
          status,
          colombianGrade: gradeRow?.colombian_grade || null,
          subject: proj.subject,
        })
      }
    }

    // ── Exams ──────────────────────────────────────────────────────────────────
    for (const inst of instances) {
      const session = inst.exam_sessions
      if (!session) continue
      // Only include active/completed sessions
      if (!['active', 'completed'].includes(session.status)) continue

      let status = 'pending'
      if (inst.instance_status === 'started') status = 'inProgress'
      else if (inst.instance_status === 'submitted') {
        status = 'completed'
        if (session.ended_at && inst.submitted_at && inst.submitted_at > session.ended_at) {
          status = 'late'
        }
      }

      allTasks.push({
        id: `exam-${inst.id}`,
        name: session.title || 'Examen',
        description: `Versión ${inst.version_label || 'A'}`,
        source: 'exam',
        sourceId: inst.session_id,
        sourceTitle: session.title,
        category: 'cognitiva',
        dueDate: session.ended_at?.slice(0, 10) || null,
        createdAt: null,
        status,
        colombianGrade: null, // exam grades come from exam_results, not here
        subject: session.subject,
      })
    }

    // ── Micro-activities ────────────────────────────────────────────────────────
    for (const micro of micros) {
      const gradeRow = microGradeMap[micro.id]
      let status = 'pending'
      if (gradeRow) {
        status = 'completed'
        if (micro.activity_date && gradeRow.graded_at && gradeRow.graded_at.slice(0, 10) > micro.activity_date) {
          status = 'late'
        }
      }
      if (micro.status === 'closed' && !gradeRow) status = 'pending' // closed but ungraded

      allTasks.push({
        id: `micro-${micro.id}`,
        name: micro.name,
        description: micro.description || '',
        source: 'micro',
        sourceId: micro.id,
        sourceTitle: micro.name,
        category: micro.category || 'general',
        dueDate: micro.activity_date || null,
        createdAt: micro.created_at?.slice(0, 10) || null,
        status,
        colombianGrade: gradeRow?.colombian_grade || null,
        subject: null,
      })
    }

    // Sort: pending first, then by dueDate ascending
    const statusOrder = { pending: 0, inProgress: 1, late: 2, completed: 3 }
    allTasks.sort((a, b) => {
      const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
      if (so !== 0) return so
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (!a.dueDate) return 1
      return -1
    })

    // Counts
    const c = { pending: 0, inProgress: 0, completed: 0, late: 0 }
    for (const t of allTasks) c[t.status] = (c[t.status] || 0) + 1

    setTasks(allTasks)
    setCounts(c)
    setLoading(false)
  }, [teacher?.id, teacher?.school_id, studentId, grade, section])

  useEffect(() => { load() }, [load])

  return { tasks, counts, loading, refresh: load }
}
