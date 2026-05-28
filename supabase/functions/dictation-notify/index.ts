// ── dictation-notify ─────────────────────────────────────────────────────────
// Sends a result email to the student's representative via Resend.
//
// Input:  { instance_id }
// Output: { ok, message }
//
// Deploy: supabase functions deploy dictation-notify --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://classroomsos.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(req: Request) {
  const origin  = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function gradeColor(g: number): string {
  if (g >= 4.5) return '#15803D'
  if (g >= 4.0) return '#1D4ED8'
  if (g >= 3.5) return '#D97706'
  return '#DC2626'
}

function gradeEmoji(level: string): string {
  return level === 'Superior' ? '⭐' : level === 'Alto' ? '✅' : level === 'Básico' ? '📘' : '❗'
}

function esc(str: unknown): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SECTION_LABELS: Record<string, string> = {
  listen_type:     '🎧 Listen & Type',
  listen_identify: '🔍 Listen & Identify',
  matching:        '🔗 Matching',
  fill_blank:      '✏️ Fill in the Blank',
  writing:         '✍️ Writing',
}

async function buildEmailHtml(params: {
  studentName: string
  studentSection: string
  studentCode: string
  sessionTitle: string
  grade: number
  level: string
  totalScore: number
  maxScore: number
  sectionScores: Record<string, { score: number; max: number; correct: number; total: number }>
  schoolName: string
  teacherName: string
  date: string
}): Promise<string> {
  const { studentName, studentSection, sessionTitle, grade, level, totalScore, maxScore, sectionScores, schoolName, teacherName, date } = params
  const color  = gradeColor(grade)
  const emoji  = gradeEmoji(level)
  const firstName = studentName.split(' ')[0] || studentName

  const sectionsHtml = Object.entries(sectionScores || {}).map(([type, s]) => {
    const label = SECTION_LABELS[type] || type
    const pct   = s.max > 0 ? Math.round((s.score / s.max) * 100) : 0
    return `
      <tr>
        <td style="padding:6px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6">${esc(label)}</td>
        <td style="padding:6px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;text-align:center">${s.correct}/${s.total}</td>
        <td style="padding:6px 12px;font-size:13px;font-weight:700;color:${gradeColor(s.max > 0 ? (s.score / s.max) * 4 + 1 : 1)};border-bottom:1px solid #f3f4f6;text-align:center">${pct}%</td>
      </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1F3864,#2E5598);padding:28px 40px;text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">🎧</div>
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Resultado de Evaluación</h1>
            <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:12px;">${esc(schoolName)}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="font-size:15px;color:#1F3864;font-weight:600;margin:0 0 6px;">Estimado representante,</p>
            <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 24px;">
              Le informamos que <strong>${esc(firstName)}</strong> ha completado la siguiente evaluación de ${esc(sessionTitle)}.
            </p>

            <!-- Grade card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:24px;">
              <div style="font-size:48px;font-weight:800;color:${color};line-height:1;">${grade}/5.0</div>
              <div style="font-size:16px;font-weight:600;color:${color};margin:4px 0 8px;">${emoji} ${esc(level)}</div>
              <div style="font-size:12px;color:#6B7280;">${totalScore} / ${maxScore} puntos</div>
            </div>

            <!-- Section breakdown -->
            ${sectionsHtml ? `
            <p style="font-size:13px;font-weight:600;color:#374151;margin:0 0 8px;">Desglose por sección:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f9fafb;">
                <th style="padding:6px 12px;font-size:11px;color:#6B7280;text-align:left;font-weight:600;">Sección</th>
                <th style="padding:6px 12px;font-size:11px;color:#6B7280;text-align:center;font-weight:600;">Correctas</th>
                <th style="padding:6px 12px;font-size:11px;color:#6B7280;text-align:center;font-weight:600;">%</th>
              </tr>
              ${sectionsHtml}
            </table>` : ''}

            <!-- Info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#6B7280;width:120px;">Estudiante</td>
                <td style="padding:4px 0;font-size:12px;color:#374151;font-weight:600;">${esc(studentName)} · ${esc(studentSection)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#6B7280;">Docente</td>
                <td style="padding:4px 0;font-size:12px;color:#374151;">${esc(teacherName)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#6B7280;">Fecha</td>
                <td style="padding:4px 0;font-size:12px;color:#374151;">${esc(date)}</td>
              </tr>
            </table>

            <p style="font-size:12px;color:#9CA3AF;margin:0;">
              Este mensaje fue generado automáticamente por CBF Planner. Por favor no responda a este correo.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;">CBF Planner · ${esc(schoolName)} · Barranquilla, Colombia</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { instance_id } = await req.json()
    if (!instance_id) {
      return new Response(JSON.stringify({ error: 'instance_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'Email not configured (no RESEND_API_KEY)' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Load instance with session
    const { data: inst, error: instErr } = await supabase
      .from('dictation_instances')
      .select('id, student_name, student_section, student_code, student_id, session_id, dictation_sessions(title, teacher_id)')
      .eq('id', instance_id)
      .single()

    if (instErr || !inst) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get representative_email from school_students
    let representativeEmail: string | null = null
    if (inst.student_id) {
      const { data: student } = await supabase
        .from('school_students')
        .select('representative_email')
        .eq('id', inst.student_id)
        .single()
      representativeEmail = student?.representative_email || null
    }

    if (!representativeEmail) {
      return new Response(JSON.stringify({ error: 'No representative email on file for this student' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Load result
    const { data: result } = await supabase
      .from('dictation_results')
      .select('colombian_grade, grade_level, total_score, max_score, section_scores')
      .eq('instance_id', instance_id)
      .single()

    if (!result) {
      return new Response(JSON.stringify({ error: 'Result not found — correction may still be pending' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Load teacher name + school name
    const session = inst.dictation_sessions as { title: string; teacher_id: string } | null
    const teacherId = session?.teacher_id

    const [{ data: teacher }, { data: teacherSchool }] = await Promise.all([
      supabase.from('teachers').select('full_name, email, school_id').eq('id', teacherId!).single(),
      supabase.from('teachers').select('schools(name)').eq('id', teacherId!).single(),
    ])

    const teacherName = teacher?.full_name || teacher?.email || 'Docente'
    const schoolName  = (teacherSchool?.schools as { name?: string } | null)?.name || 'Colegio Boston Flexible'

    // 5. Build + send email
    const html = await buildEmailHtml({
      studentName:    inst.student_name    || 'Estudiante',
      studentSection: inst.student_section || '',
      studentCode:    inst.student_code    || '',
      sessionTitle:   session?.title       || 'Dictado',
      grade:          parseFloat(result.colombian_grade),
      level:          result.grade_level,
      totalScore:     result.total_score,
      maxScore:       result.max_score,
      sectionScores:  result.section_scores || {},
      schoolName,
      teacherName,
      date: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
    })

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'CBF Planner <noreply@redboston.edu.co>',
        to:      [representativeEmail],
        subject: `📊 Resultado Evaluación — ${inst.student_name || 'Estudiante'} — ${session?.title || 'Dictado'}`,
        html,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.text()
      console.error('Resend error:', errBody)
      return new Response(JSON.stringify({ error: 'Email delivery failed', detail: errBody }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, message: `Email sent to ${representativeEmail}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('dictation-notify error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
