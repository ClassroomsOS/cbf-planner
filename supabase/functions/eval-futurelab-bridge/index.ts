// eval-futurelab-bridge — Edge Function for CBF Eval
// Queries FutureLab practice data from the dev Supabase and matches
// it against the school_students roster in the prod Supabase.
//
// GET ?grade=8.°                     → group mastery overview
// GET ?grade=8.°&section=Blue        → filtered by section
// GET ?email=gabrieladiaz@...        → individual student profile
//
// Returns unified data: roster identity + FutureLab practice stats.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CBF-EVAL Supabase (prod) — for school_students roster
const EVAL_URL = Deno.env.get('SUPABASE_URL')!
const EVAL_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// FutureLab Supabase (dev) — for futurelab_scores
const FL_URL = 'https://gfjiicfnwpkbkptwgnte.supabase.co'
const FL_KEY = Deno.env.get('FUTURELAB_ANON_KEY') || ''

const SKILL_LABELS: Record<string, string> = {
  'present-simple': 'Present Simple',
  'present-continuous': 'Present Continuous',
  'will': 'Will Future',
  'going-to': 'Going To',
  'future-perfect': 'Future Perfect',
  'fpc': 'Future Perfect Continuous',
  'zero': 'Zero Conditional',
  'first': 'First Conditional',
  'second': 'Second Conditional',
  'third': 'Third Conditional',
  'mixed': 'Mixed Conditional',
  'inversion': 'Inversion',
}

const ALLOWED_ORIGINS = [
  'https://classroomsos.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function corsHeaders(req: Request) {
  const origin  = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

// Normalize name for matching: lowercase, trim, collapse spaces, remove accents
function norm(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ')
}

// Build display name from roster parts (LASTNAME FIRSTNAME format)
function rosterName(r: any): string {
  return [r.first_name, r.first_lastname]
    .filter(Boolean).join(' ')
}

// Build full name for display
function rosterFullName(r: any): string {
  return [r.first_lastname, r.second_lastname, r.first_name, r.second_name]
    .filter(Boolean).join(' ')
}

// Compute skill accuracy from mastery object
function skillAccuracy(mastery: any): any[] {
  if (!mastery) return []
  return Object.entries(mastery).map(([key, val]: [string, any]) => ({
    skill: key,
    label: SKILL_LABELS[key] || key,
    seen: val?.seen || 0,
    correct: val?.correct || 0,
    accuracy: val?.seen > 0 ? Math.round((val.correct / val.seen) * 100) : null,
  }))
}

// Match roster students with FutureLab scores
function matchStudents(roster: any[], flScores: any[]) {
  // Build lookup: normalized FL name → FL record
  const flMap = new Map<string, any>()
  for (const fl of flScores) {
    flMap.set(norm(fl.student_name), fl)
  }

  return roster.map(student => {
    const matchKey = norm(rosterName(student))
    const fl = flMap.get(matchKey) || null

    return {
      // Identity from roster
      name: rosterFullName(student),
      email: student.email,
      grade: student.grade,
      section: student.section,
      // FutureLab data (null if no match)
      futurelab: fl ? {
        xp: fl.xp,
        level: fl.level,
        streak: fl.streak,
        answered: fl.answered,
        correct: fl.correct,
        accuracy: Number(fl.accuracy || 0),
        exam_score: fl.exam_score,
        best_exam_score: fl.best_exam_score,
        badges: fl.badges || [],
        skills: skillAccuracy(fl.mastery),
        last_active: fl.updated_at,
      } : null,
      matched: !!fl,
    }
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) })
  }

  try {
    const url = new URL(req.url)
    const grade    = url.searchParams.get('grade')
    const section  = url.searchParams.get('section')
    const email    = url.searchParams.get('email')
    const schoolId = url.searchParams.get('school_id') || 'a21e681b-5898-4647-8ad9-bdb5f9844094'

    if (!grade && !email) {
      return new Response(
        JSON.stringify({ error: 'Provide ?grade= or ?email=' }),
        { status: 400, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const evalSb = createClient(EVAL_URL, EVAL_KEY)
    const flSb   = createClient(FL_URL, FL_KEY)

    // ── Individual student lookup ──
    if (email) {
      // Find student in roster
      const { data: student } = await evalSb
        .from('school_students')
        .select('first_name, second_name, first_lastname, second_lastname, email, grade, section')
        .eq('email', email)
        .single()

      if (!student) {
        return new Response(
          JSON.stringify({ error: 'Student not found' }),
          { status: 404, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      // Find in FutureLab by name match
      const { data: flScores } = await flSb
        .from('futurelab_scores')
        .select('*')

      const matchKey = norm(rosterName(student))
      const fl = (flScores || []).find(f => norm(f.student_name) === matchKey)

      const result = {
        name: rosterFullName(student),
        email: student.email,
        grade: student.grade,
        section: student.section,
        futurelab: fl ? {
          xp: fl.xp,
          level: fl.level,
          streak: fl.streak,
          answered: fl.answered,
          correct: fl.correct,
          accuracy: Number(fl.accuracy || 0),
          exam_score: fl.exam_score,
          best_exam_score: fl.best_exam_score,
          badges: fl.badges || [],
          skills: skillAccuracy(fl.mastery),
          last_active: fl.updated_at,
        } : null,
        matched: !!fl,
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // ── Group lookup by grade (+ optional section) ──
    let rosterQuery = evalSb
      .from('school_students')
      .select('first_name, second_name, first_lastname, second_lastname, email, grade, section')
      .eq('grade', grade!)
      .eq('school_id', schoolId)
      .order('first_lastname')

    if (section) {
      rosterQuery = rosterQuery.eq('section', section)
    }

    const { data: roster } = await rosterQuery

    // Fetch all FL scores (table is small, ~40 rows)
    const { data: flScores } = await flSb
      .from('futurelab_scores')
      .select('*')

    const students = matchStudents(roster || [], flScores || [])
    const matched  = students.filter(s => s.matched)

    // Group stats
    const groupStats = {
      total_students: students.length,
      matched_students: matched.length,
      avg_accuracy: matched.length > 0
        ? Math.round(matched.reduce((s, m) => s + (m.futurelab?.accuracy || 0), 0) / matched.length)
        : null,
      avg_xp: matched.length > 0
        ? Math.round(matched.reduce((s, m) => s + (m.futurelab?.xp || 0), 0) / matched.length)
        : null,
      avg_level: matched.length > 0
        ? +(matched.reduce((s, m) => s + (m.futurelab?.level || 0), 0) / matched.length).toFixed(1)
        : null,
      // Skill averages across the group
      skill_averages: Object.keys(SKILL_LABELS).map(skill => {
        const withData = matched.filter(m => {
          const sk = m.futurelab?.skills?.find((s: any) => s.skill === skill)
          return sk && sk.seen > 0
        })
        const avg = withData.length > 0
          ? Math.round(withData.reduce((s, m) => {
              const sk = m.futurelab?.skills?.find((s: any) => s.skill === skill)
              return s + (sk?.accuracy || 0)
            }, 0) / withData.length)
          : null
        return {
          skill,
          label: SKILL_LABELS[skill],
          avg_accuracy: avg,
          practiced_by: withData.length,
          total_students: matched.length,
        }
      }),
      // Students at risk (accuracy < 50%)
      at_risk: matched
        .filter(m => (m.futurelab?.accuracy || 0) < 50 && (m.futurelab?.answered || 0) > 0)
        .map(m => ({ name: m.name, accuracy: m.futurelab?.accuracy, answered: m.futurelab?.answered })),
    }

    return new Response(
      JSON.stringify({ group: groupStats, students }),
      { headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
