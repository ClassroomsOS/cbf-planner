// ── eval-notify ───────────────────────────────────────────────────────────────
// Sends the corrected exam (institutional CBF-G AC-01 format) to the student's
// email and/or the representative via Resend.
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
  multiple_choice:  'Selección múltiple',
  true_false:       'Verdadero / Falso',
  fill_blank:       'Completar',
  short_answer:     'Respuesta corta',
  development:      'Desarrollo',
  vocab_match:      'Vocabulario: Emparejar',
  vocab_image:      'Vocabulario: Imagen',
  vocab_cloze:      'Vocabulario: Completar',
  vocab_listening:  'Vocabulario: Dictado',
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
  answer: { text?: string; selected?: string } | string | null
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

    const isOpen    = q.question_type === 'short_answer' || q.question_type === 'development'
    const score     = isOpen ? r.ai_score : r.auto_score
    const maxPts    = r.points_possible || q.points || 0
    const correct   = !isOpen && score === maxPts && maxPts > 0
    const wrong     = !isOpen && score === 0 && r.auto_score != null
    const ansObj    = r.answer !== null && typeof r.answer === 'object'
      ? r.answer as { text?: string; selected?: string }
      : null
    const ansText   = ansObj ? (ansObj.text || ansObj.selected || '') : String(r.answer || '')

    const cardBg    = correct ? '#F0FDF4' : wrong ? '#FFF1F2' : '#FAFAFA'
    const border    = correct ? '#16A34A' : wrong ? '#DC2626' : '#E5E7EB'
    const mark      = !isOpen ? (correct ? '✅ ' : wrong ? '❌ ' : '') : ''
    const scoreStr  = score != null ? `${score}/${maxPts}` : `?/${maxPts}`
    const typeLabel = TYPE_LABELS[q.question_type] || q.question_type

    let optionsHtml = ''
    let ansBox = ''

    if (q.question_type === 'vocab_match') {
      // Render vocab_match as word-pair table
      const criteria = (q as any).criteria || {}
      const words: string[] = criteria.words || []
      const defs: string[] = criteria.definitions || []
      const correctLetters = (q.correct_answer || '').split(',').map((l: string) => l.trim().toUpperCase())
      const studentLetters = ansText.split(',').map((l: string) => l.trim().toUpperCase())
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      optionsHtml = words.map((w: string, wi: number) => {
        const isMatch = studentLetters[wi] === correctLetters[wi]
        const bg = isMatch ? '#DCFCE7' : '#FEE2E2'
        const studentDef = studentLetters[wi] ? defs[letters.indexOf(studentLetters[wi])] || '?' : '—'
        return `<div style="padding:3px 8px;border-radius:4px;margin:2px 0;font-size:12pt;background:${bg};">
          <strong>${esc(w)}</strong> → ${esc(studentDef)} ${isMatch ? '✓' : '✗'}
        </div>`
      }).join('')
    } else if (q.options && q.options.length > 0) {
      // Standard MC / T-F / vocab_image / vocab_listening options
      optionsHtml = q.options.map(opt => {
        const letter    = opt.charAt(0)
        const isCorrect = letter === q.correct_answer
        const isPicked  = ansText === letter || ansText === opt
        const bg = isCorrect ? '#DCFCE7' : (isPicked && !isCorrect) ? '#FEE2E2' : 'transparent'
        return `<div style="padding:3px 8px;border-radius:4px;margin:2px 0;font-size:12pt;background:${bg};">${isPicked ? '● ' : '○ '}${esc(opt)}${isCorrect ? ' ✓' : ''}</div>`
      }).join('')
    } else {
      // Open-ended / fill_blank / vocab_cloze
      ansBox = `
      <div style="margin-top:6px;background:#F3F4F6;border-radius:4px;padding:7px 10px;font-size:12pt;color:#374151;">
        ${esc(ansText) || '<em style="color:#9CA3AF">Sin respuesta</em>'}
      </div>`
    }

    const feedbackHtml = r.ai_feedback ? `
      <div style="margin-top:8px;padding:8px 10px;background:#EDE9FE;border-left:3px solid #8B5CF6;border-radius:0 4px 4px 0;font-size:11pt;color:#4C1D95;">
        <strong>Retroalimentación:</strong> ${esc(r.ai_feedback)}
      </div>` : ''

    return `
<div style="border:1px solid ${border};border-radius:8px;padding:14px 16px;margin-bottom:12px;background:${cardBg};">
  <div style="margin-bottom:8px;">
    <span style="font-weight:700;color:#1F3864;font-size:14px;">${mark}${i + 1}.</span>
    <span style="font-size:11px;background:#E5E7EB;color:#374151;padding:2px 8px;border-radius:10px;margin-left:6px;">${esc(typeLabel)}</span>
    <span style="font-size:12px;color:#6B7280;float:right;font-weight:600;">${scoreStr} pts</span>
  </div>
  <div style="font-size:12pt;color:#111;line-height:1.5;margin-bottom:8px;clear:both;">${esc(q.stem)}</div>
  ${optionsHtml}${ansBox}${feedbackHtml}
</div>`
  }).join('')
}

function buildEmailHtml(params: {
  studentName: string; studentSection: string; examTitle: string; subject: string
  grade: number; totalScore: number; maxScore: number
  questions: Question[]; responses: Response[]
  schoolName: string; shortName: string; dane: string; nit: string; isBest: boolean
  logoUrl: string; teacherName: string; submittedAt: string; date: string
}): string {
  const { studentName, studentSection, examTitle, subject, grade, totalScore, maxScore,
          questions, responses, schoolName, shortName, dane, nit, isBest,
          logoUrl, teacherName, submittedAt, date } = params

  const color = gradeColor(grade)
  const level = gradeLevel(grade)
  const questionsHtml = buildQuestionsHtml(questions, responses)
  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" style="max-height:60px;max-width:80px;object-fit:contain;" />`
    : '📋'

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:Arial,'Segoe UI',sans-serif;font-size:12pt;line-height:1.5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6FB;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Institutional header -->
        <tr>
          <td style="padding:24px 32px 0;">
            ${isBest ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:2px solid #1B3A5C;">
              <tr>
                <td rowspan="2" width="80" style="border:1px solid #1B3A5C;text-align:center;padding:8px;vertical-align:middle;">
                  ${logoHtml}
                </td>
                <td style="border:1px solid #1B3A5C;padding:10px;text-align:center;font-weight:bold;font-size:14px;color:#1B3A5C;">
                  B.E.S.T.<br>BOSTON INTERNATIONAL SCHOOL<br>
                  <span style="font-size:12px;">SATURDAY ENGLISH COURSES</span>
                </td>
              </tr>
              <tr>
                <td style="border:1px solid #1B3A5C;padding:8px;text-align:center;font-size:12px;color:#1B3A5C;">
                  NIT: ${esc(nit)} &mdash; EVALUACIÓN CORREGIDA &mdash; ${esc(date)}
                </td>
              </tr>
            </table>
            ` : `
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:2px solid #1F3864;">
              <tr>
                <td rowspan="3" width="80" style="border:1px solid #1F3864;text-align:center;padding:8px;vertical-align:middle;">
                  ${logoHtml}
                </td>
                <td style="border:1px solid #1F3864;padding:8px;text-align:center;font-weight:bold;font-size:12px;color:#1F3864;">
                  ${esc(schoolName.toUpperCase())}${dane ? ' &mdash; DANE: ' + esc(dane) : ''}
                </td>
                <td width="130" style="border:1px solid #1F3864;padding:8px;text-align:center;font-size:11px;font-weight:bold;">CBF-G AC-01</td>
              </tr>
              <tr>
                <td style="border:1px solid #1F3864;padding:6px 8px;text-align:center;font-size:11px;">PROCESO DE GESTIÓN ACADÉMICA</td>
                <td style="border:1px solid #1F3864;padding:6px 8px;text-align:center;font-size:11px;">Versión: 1</td>
              </tr>
              <tr>
                <td style="border:1px solid #1F3864;padding:6px 8px;text-align:center;font-size:11px;font-weight:bold;">EVALUACIÓN CORREGIDA</td>
                <td style="border:1px solid #1F3864;padding:6px 8px;text-align:center;font-size:11px;">Fecha: ${esc(date)}</td>
              </tr>
            </table>
            `}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:24px 32px;">

            <!-- Student / exam info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #E5E7EB;margin-bottom:20px;font-size:12px;">
              <tr style="background:#F8FAFC;">
                <td style="padding:7px 10px;color:#6B7280;width:110px;border:1px solid #E5E7EB;">Estudiante</td>
                <td style="padding:7px 10px;font-weight:600;border:1px solid #E5E7EB;">${esc(studentName)}${studentSection ? ' · Sección ' + esc(studentSection) : ''}</td>
                <td style="padding:7px 10px;color:#6B7280;width:90px;border:1px solid #E5E7EB;">Materia</td>
                <td style="padding:7px 10px;border:1px solid #E5E7EB;">${esc(subject)}</td>
              </tr>
              <tr>
                <td style="padding:7px 10px;color:#6B7280;border:1px solid #E5E7EB;">Examen</td>
                <td style="padding:7px 10px;border:1px solid #E5E7EB;">${esc(examTitle)}</td>
                <td style="padding:7px 10px;color:#6B7280;border:1px solid #E5E7EB;">Docente</td>
                <td style="padding:7px 10px;border:1px solid #E5E7EB;">${esc(teacherName)}</td>
              </tr>
              <tr style="background:#F8FAFC;">
                <td style="padding:7px 10px;color:#6B7280;border:1px solid #E5E7EB;">Entregado</td>
                <td colspan="3" style="padding:7px 10px;border:1px solid #E5E7EB;">${esc(submittedAt)}</td>
              </tr>
            </table>

            <!-- Grade card -->
            <div style="background:#F8FAFC;border:2px solid ${color};border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
              <div style="font-size:48px;font-weight:800;color:${color};line-height:1;">${grade.toFixed(1)}/5.0</div>
              <div style="font-size:16px;font-weight:600;color:${color};margin:6px 0 8px;">${level.emoji} ${esc(level.label)}</div>
              <div style="font-size:12px;color:#6B7280;">${totalScore} / ${maxScore} puntos</div>
            </div>

            <!-- Questions detail -->
            <p style="font-size:12px;font-weight:700;color:#374151;margin:0 0 12px;text-transform:uppercase;letter-spacing:.5px;">Detalle por pregunta</p>
            ${questionsHtml}

            <p style="font-size:11px;color:#9CA3AF;margin:16px 0 0;text-align:center;">
              Este mensaje fue generado automáticamente por ${isBest ? 'BEST' : 'CBF'} Eval · ${esc(schoolName)}
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F8FAFC;padding:14px 32px;text-align:center;border-top:1px solid #E5E7EB;">
            <p style="margin:0;font-size:11px;color:#9CA3AF;">${isBest ? 'BEST' : 'CBF'} Eval · ${esc(schoolName)} · Barranquilla, Colombia</p>
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

    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // 1. Load instance with session + blueprint
    const { data: inst, error: instErr } = await db
      .from('eval_instances')
      .select('id, student_name, student_section, student_email, session_id, school_id, submitted_at, generated_questions, eval_sessions(title, teacher_id, blueprint_id, eval_blueprints(title, subject))')
      .eq('id', instance_id)
      .single()

    if (instErr || !inst) {
      return new Response(JSON.stringify({ error: 'Instancia no encontrada' }), {
        status: 404, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    const sessionData = inst.eval_sessions as {
      title: string; teacher_id: string; blueprint_id: string;
      eval_blueprints?: { title: string; subject: string } | null
    } | null

    // 2. Representative email
    let representativeEmail: string | null = null
    if (inst.student_email) {
      const { data: student } = await db
        .from('school_students')
        .select('representative_email')
        .eq('email', inst.student_email)
        .eq('school_id', inst.school_id)
        .single()
      representativeEmail = student?.representative_email || null
    }

    const toSet = new Set<string>()
    if (inst.student_email) toSet.add(inst.student_email)
    if (representativeEmail)  toSet.add(representativeEmail)
    const toAddresses = [...toSet]

    if (toAddresses.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay correos registrados para este estudiante ni su representante' }), {
        status: 422, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    // 3. Load result
    const { data: result } = await db
      .from('eval_results')
      .select('colombian_grade, total_score, max_score, correction_status')
      .eq('instance_id', instance_id)
      .single()

    if (!result || result.correction_status !== 'complete') {
      return new Response(JSON.stringify({ error: 'Corrección no completada aún. Revisa el examen antes de enviar.' }), {
        status: 409, headers: { ...corsH, 'Content-Type': 'application/json' },
      })
    }

    // 4. Responses
    const { data: responses } = await db
      .from('eval_responses')
      .select('question_id, question_type, answer, auto_score, ai_score, ai_feedback, ai_correction_status, points_possible')
      .eq('instance_id', instance_id)
      .order('created_at', { ascending: true })

    // 5. Questions with correct_answer from blueprint
    const blueprintId = sessionData?.blueprint_id
    let blueprintQuestions: Question[] = []
    if (blueprintId) {
      const { data: bp } = await db
        .from('eval_blueprints')
        .select('generated_questions')
        .eq('id', blueprintId)
        .single()
      blueprintQuestions = (bp?.generated_questions || []) as Question[]
    }
    const questions: Question[] = blueprintQuestions.length > 0
      ? blueprintQuestions
      : (inst.generated_questions || []) as Question[]

    // 6. Teacher + school
    const teacherId = sessionData?.teacher_id
    const [{ data: teacherRow }, { data: schoolRow }] = await Promise.all([
      db.from('teachers').select('full_name, email').eq('id', teacherId!).single(),
      db.from('schools').select('name, short_name, logo_url, dane, features').eq('id', inst.school_id).single(),
    ])

    const teacherName = teacherRow?.full_name || teacherRow?.email || 'Docente'
    const schoolName  = schoolRow?.name       || 'Institución Educativa'
    const shortName   = schoolRow?.short_name || ''
    const logoUrl     = schoolRow?.logo_url   || ''
    const dane        = schoolRow?.dane       || ''
    const nit         = (schoolRow?.features as any)?.nit || ''
    const isBest      = shortName === 'BEST'
    const subject     = sessionData?.eval_blueprints?.subject || ''
    const examTitle   = sessionData?.eval_blueprints?.title || sessionData?.title || 'Examen'
    const submittedAt = inst.submitted_at
      ? new Date(inst.submitted_at).toLocaleString('es-CO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '—'

    // 7. Build + send
    const grade = parseFloat(String(result.colombian_grade))
    const html  = buildEmailHtml({
      studentName:    inst.student_name    || 'Estudiante',
      studentSection: inst.student_section || '',
      examTitle,
      subject,
      grade,
      totalScore:     result.total_score,
      maxScore:       result.max_score,
      questions,
      responses:      (responses || []) as Response[],
      schoolName,
      shortName,
      dane,
      nit,
      isBest,
      logoUrl,
      teacherName,
      submittedAt,
      date: new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
    })

    const emailRes = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from:    `${isBest ? 'BEST' : 'CBF'} Eval <onboarding@resend.dev>`,
        to:      toAddresses,
        subject: `📋 Examen corregido — ${inst.student_name || 'Estudiante'} — ${examTitle}`,
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
    return new Response(JSON.stringify({
      ok:      true,
      message: `Examen corregido enviado a: ${toAddresses.join(', ')}${noRepNote}`,
    }), { headers: { ...corsH, 'Content-Type': 'application/json' } })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[eval-notify] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
