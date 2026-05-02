// ── useTodaysActivities.js ───────────────────────────────────────────────────
// Detects evaluative activities scheduled for today by crossing
// teacher_assignments with news_projects.actividades_evaluativas[].fecha.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function useTodaysActivities(teacher) {
  const [todayActivities, setTodayActivities] = useState([])  // activities matching today
  const [otherActivities, setOtherActivities] = useState([])  // rest of period activities
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!teacher?.id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const today = new Date().toISOString().slice(0, 10)

      // 1. Get teacher's assignments
      const { data: assignments } = await supabase
        .from('teacher_assignments')
        .select('grade, section, subject')
        .eq('teacher_id', teacher.id)

      if (cancelled || !assignments?.length) { setLoading(false); return }

      // 2. Fetch active news projects for this teacher's school
      const { data: projects } = await supabase
        .from('news_projects')
        .select('id, title, grade, section, subject, skill, due_date, actividades_evaluativas, indicator_id, status')
        .eq('school_id', teacher.school_id)
        .in('status', ['draft', 'in_progress', 'active'])

      if (cancelled || !projects?.length) { setLoading(false); return }

      // 3. Match projects to teacher assignments
      const assignmentKeys = new Set(assignments.map(a => `${a.grade}|${a.section}|${a.subject}`))
      const myProjects = projects.filter(p =>
        assignmentKeys.has(`${p.grade}|${p.section}|${p.subject}`)
      )

      // 4. Extract activities, split into today vs other
      const todayList = []
      const otherList = []

      for (const proj of myProjects) {
        const acts = proj.actividades_evaluativas || []
        for (const act of acts) {
          if (!act.nombre) continue
          const item = {
            ...act,
            projectId: proj.id,
            projectTitle: proj.title,
            grade: proj.grade,
            section: proj.section,
            subject: proj.subject,
            skill: proj.skill,
          }
          if (act.fecha === today) {
            todayList.push(item)
          } else {
            otherList.push(item)
          }
        }
      }

      // Sort: today by name, other by fecha ascending (nulls last)
      todayList.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
      otherList.sort((a, b) => {
        if (!a.fecha && !b.fecha) return 0
        if (!a.fecha) return 1
        if (!b.fecha) return -1
        return a.fecha.localeCompare(b.fecha)
      })

      if (!cancelled) {
        setTodayActivities(todayList)
        setOtherActivities(otherList)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [teacher?.id, teacher?.school_id])

  return { todayActivities, otherActivities, loading }
}
