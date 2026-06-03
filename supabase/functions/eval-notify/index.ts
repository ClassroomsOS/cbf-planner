// ── eval-notify ───────────────────────────────────────────────────────────────
// Sends a corrected exam result email to the student's representative via Resend.
//
// Input:  POST { instance_id: string }
// Output: { ok, message } | { error }
//
// Deploy: .\supabase.exe functions deploy eval-notify --no-verify-jwt --project-ref vouxrqsiyoyllxgcriic
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
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function esc(str: unknown): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function gradeColor(g: number): string {
  if (g >= 4.5) return '#15803D'
  if (g >= 4.0) return '#1D4ED8'
  if (g >= 3.5) return '#D97706'
  return '#DC2626'
}

function gradeLevel(g: number): { label: string; emoji: string } {
  if (g >= 4.5) return { label: 'Superior', emoji: '⭐' }
  if (g >= 4.0) return { label: 'Alto',     emoji: '✅' }
  if (g >= 3.5) return { label: 'Básico',   emoji: '📘' }
  return            { label: 'Bajo',      emoji: '❗' }
}

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Selección múltiple',
  true_false:      'Verdadero / Falso',
  fill_blank:      'Completar',
  short_answer:    'Respuesta corta',
  development:     'Desarrollo',
}

interface Question {
  id: string
  stem: string
  question_type: string
  points: number
  options?: string[]
  correct_answer?: string
}

interface Response {
  question_id: string
  question_type: string
  answer: { text?: string; selected?: string } | null
  auto_score: number | null
  ai_score: number | null
  ai_feedback: string | null
  ai_correction_status: string
  points_possible: number
}

function buildQuestionsHtml(questions: Question[], responses: Response[]): string {
  const respMap: Record<string, Response> = {}
  for (const r of responses) respMap[r.question_id] = r

  return (questions || []).map((q, i) => {
    const r = respMap[String(q.id)]
    if (!r) return ''

    const isOpen  = q.question_type === 'short_answer' || q.question_type === 'development'
    const score   = isOpen ? r.ai_score : r.auto_score
    const maxPts  = r.points_possible || q.points || 0
    const correct = !isOpen && score === maxPts
    const wrong   = !isOpen && score === 0 && r.auto_score != null
    const ansText = r.answer !== null && typeof r.answer === 'object'
      ? (r.answer.text || r.answer.selected || '')
      : String(r.answer || '')

    const rowBg   = isOpen ? '#FAFAFA' : correct ? '#F0FDF4' : wrong ? '#FFF1F2' : '#FAFAFA'
    const mark    = isOpen ? '' : correct ? '✅ ' : wrong ? '❌ ' : ''
    const scoreStr = score != null ? `${score}/${maxPts}` : `?/${maxPts}`

    // MC options
    const optionsHtml = q.options ? q.options.map(opt => {
      const letter    = opt.charAt(0)
      const isCorrect = letter === q.correct_answer
      const isPickd   = ansText === letter || ansText === opt
      const bg = isCorrect ? '#DCFCE7' : (isPickd && !isCorrect) ? '#FEE2E2' : 'transparent'
      return `<div style="padding:3px 8px;border-radius:4px;margin:2px 0;font-size:12px;background:${bg};">${isPickd ? '● ' : '○ '}${esc(opt)}${isCorrect ? ' ✓' : ''}</div>`
    }).join('') : ''

    // Answer box for open-ended
    const ansBox = !q.options ? `
      <div style="margin-top:6px;background:#F3F4F6;border-radius:4px;padding:7px 10px;font-size:12px;color:#374151;">
        ${esc(ansText) || '<em style="color:#9CA3AF">Sin respuesta</em>'}
      </div>` : ''

    // AI feedback
    const feedbackHtml = r.ai_feedback ? `
      <div style="margin-top:8px;padding:8px 10px;background:#EDE9FE;border-left:3px solid #8B5CF6;border-radius:0 4px 4px 0;font-size:11px;color:#4C1D95;">
        <strong>Retroalimentación IA:</strong> ${esc(r.ai_feedback)}
      </div>` : ''

    return `
<div style="margin-bottom:12px;padding:12px 14px;border:1px solid #E5E7EB;border-radius:6px;background:${rowBg};">
  <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
    <span style="font-weight:700;color:#1F3864;font-size:13px;">${mark}${i + 1}.</span>
    <span style="font-size:11px;background:#E5E7EB;color:#374151;padding:1px 7px;border-radius:10px;">${esc(TYPE_LABELS[q.question_type] || q.question_type)}</span>
    <span style="font-size:11px;color:#6B7280;margin-left:auto;">${scoreStr} pts</span>
  </div>
  <div style="font-size:12px;color:#111;line-height:1.5;margin-bottom:6px;">${esc(q.stem)}</div>
  ${optionsHtml}
  ${ansBox}
  ${feedbackHtml}
</div>`
  }).join('')
}

function buildEmailHtml(params: {
  studentName: string
  studentSection: string
  examTitle: string
  grade: number
  totalScore: number
  maxScore: number
  questions: Question[]
  responses: Response[]
  schoolName: string
  teacherName: string
  date: string
}): string {
  const { studentName, studentSection, examTitle, grade, totalScore, maxScore, questions, responses, schoolName, teacherName, date } = params
  const color = gradeColor(grade)
  const level = gradeLevel(grade)
  const firstName = studentName.split(' ')[0] || studentName

  const questionsHtml = buildQuestionsHtml(questions, responses)

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1F3864,#2E5598);padding:28px 40px;text-align:center;">
            <div style="font-size:28px;margin-bottom:6px;">📋</div>
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Examen Corregido</h1>
            <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:12px;">${esc(schoolName)}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="font-size:15px;color:#1F3864;font-weight:600;margin:0 0 6px;">Estimado representante,</p>
            <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 24px;">
              Le compartimos el resultado corregido del examen de <strong>${esc(firstName)}</strong>: <em>${esc(examTitle)}</em>.
            </p>

            <!-- Grade card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;text-align:center;margin-bottom:24px;">
              <div style="font-size:48px;font-weight:800;color:${color};line-height:1;">${grade.toFixed(1)}/5.0</div>
              <div style="font-size:16px;font-weight:600;color:${color};margin:4px 0 8px;">${level.emoji} ${esc(level.label)}</div>
              <div style="font-size:12px;color:#6B7280;">${totalScore} / ${maxScore} puntos</div>
            </div>

            <!-- Info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#6B7280;width:120px;">Estudiante</td>
                <td style="padding:4px 0;font-size:12px;color:#374151;font-weight:600;">${esc(studentName)}${studentSection ? ' · ' + esc(studentSection) : ''}</td>
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

            <!-- Questions -->
            <p style="font-size:13px;font-weight:600;color:#374151;margin:0 0 12px;">Detalle por pregunta:</p>
            ${questionsHtml}

            <p style="font-size:12px;color:#9CA3AF;margin:16px 0 0;">
              Este mensaje fue generado automáticamente por CBF Eval. Por favor no responda a este correo.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;">CBF Eval · ${esc(schoolName)} · Barranquilla, Colombia</p>
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
  const corsH = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsH })

  try {
    const { instance_id } = await req.json()
    if (!instance_id) {
      return new Response(JSON.stringify({ error: 'instance_id requerido' }), {
        status: 400, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 503, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Load instance with session + blueprint
    const { data: inst, error: instErr } = await supabase
      .from('eval_instances')
      .select('id, student_name, student_section, student_email, session_id, school_id, generated_questions, eval_sessions(title, teacher_id, blueprint_id)')
      .eq('id', instance_id)
      .single()

    if (instErr || !inst) {
      return new Response(JSON.stringify({ error: 'Instancia no encontrada' }), {
        status: 404, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    const session = inst.eval_sessions as { title: string; teacher_id: string; blueprint_id: string } | null

    // 2. Get representative_email from school_students via student_email
    let representativeEmail: string | null = null
    if (inst.student_email) {
      const { data: student } = await supabase
        .from('school_students')
        .select('representative_email')
        .eq('email', inst.student_email)
        .eq('school_id', inst.school_id)
        .single()
      representativeEmail = student?.representative_email || null
    }

    // Build recipient list: student + representative (deduplicated, no nulls)
    const toSet = new Set<string>()
    if (inst.student_email) toSet.add(inst.student_email)
    if (representativeEmail) toSet.add(representativeEmail)
    const toAddresses = [...toSet]

    if (toAddresses.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay correos registrados para este estudiante ni su representante' }), {
        status: 422, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    // 3. Load result
    const { data: result } = await supabase
      .from('eval_results')
      .select('colombian_grade, total_score, max_score, correction_status')
      .eq('instance_id', instance_id)
      .single()

    if (!result || result.correction_status !== 'complete') {
      return new Response(JSON.stringify({ error: 'Corrección no completada aún' }), {
        status: 409, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    // 4. Load responses
    const { data: responses } = await supabase
      .from('eval_responses')
      .select('question_id, question_type, answer, auto_score, ai_score, ai_feedback, ai_correction_status, points_possible')
      .eq('instance_id', instance_id)
      .order('created_at', { ascending: true })

    // 5. Question list with correct_answer (from blueprint, for teacher reference)
    const questions: Question[] = (inst.generated_questions || []).map((q: Question) => ({
      id:            q.id,
      stem:          q.stem,
      question_type: q.question_type,
      points:        q.points,
      options:       q.options,
      correct_answer: q.correct_answer,
    }))

    // 6. Teacher name + school name
    const teacherId = session?.teacher_id
    const [{ data: teacher }, { data: teacherSchool }] = await Promise.all([
      supabase.from('teachers').select('full_name, email').eq('id', teacherId!).single(),
      supabase.from('teachers').select('schools(name)').eq('id', teacherId!).single(),
    ])

    const teacherName = teacher?.full_name || teacher?.email || 'Docente'
    const schoolName  = (teacherSchool?.schools as { name?: string } | null)?.name || 'Colegio Boston Flexible'

    // 7. Build + send email
    const grade    = parseFloat(String(result.colombian_grade))
    const html     = buildEmailHtml({
      studentName:    inst.student_name    || 'Estudiante',
      studentSection: inst.student_section || '',
      examTitle:      session?.title        || 'Examen',
      grade,
      totalScore:     result.total_score,
      maxScore:       result.max_score,
      questions,
      responses:      (responses || []) as Response[],
      schoolName,
      teacherName,
      date: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
    })

    const emailRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    'CBF Eval <onboarding@resend.dev>',
        to:      toAddresses,
        subject: `📋 Examen corregido — ${inst.student_name || 'Estudiante'} — ${session?.title || 'Examen'}`,
        html,
      }),
    })

    if (!emailRes.ok) {
      const detail = await emailRes.text()
      console.error('[eval-notify] Resend error:', detail)
      return new Response(JSON.stringify({ error: 'Email delivery failed', detail }), {
        status: 502, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    const noRepNote = !representativeEmail ? ' (sin correo de representante registrado)' : ''
    return new Response(JSON.stringify({ ok: true, message: `Resultado enviado a: ${toAddresses.join(', ')}${noRepNote}` }), {
      headers: { ...corsH, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[eval-notify] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
