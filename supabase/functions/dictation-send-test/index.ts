// ── dictation-send-test ───────────────────────────────────────────────────────
// Sends a test copy of the dictation access-code email to the teacher's own
// email address(es), so they can verify delivery and formatting before
// sending codes to students.
//
// Creates (or reuses) a dedicated test instance for the teacher in the session.
// The returned access_code is a real, working code the teacher can use to
// preview the student player end-to-end.
//
// Input:  { session_id, extra_email? }   (extra_email = optional secondary address)
// Output: { ok, access_code, sent_to[] }
//
// Deploy: supabase functions deploy dictation-send-test --no-verify-jwt
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

function esc(str: unknown): string {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const PLAYER_URL = 'https://classroomsos.github.io/cbf-planner/eval/dictation'

function buildTestEmailHtml(params: {
  teacherName: string
  sessionTitle: string
  accessCode: string
  durationMinutes: number | null
  schoolName: string
}): string {
  const { teacherName, sessionTitle, accessCode, durationMinutes, schoolName } = params
  const durationLine = durationMinutes
    ? `<tr><td style="padding:4px 0;font-size:12px;color:#6B7280;width:130px;">Duración</td><td style="padding:4px 0;font-size:12px;color:#374151;font-weight:600;">${durationMinutes} minutos</td></tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Test banner -->
        <tr>
          <td style="background:#D97706;padding:8px 40px;text-align:center;">
            <p style="color:#fff;margin:0;font-size:12px;font-weight:700;letter-spacing:0.05em;">
              🧪 CORREO DE PRUEBA — Este es un ejemplo de lo que recibirán tus estudiantes
            </p>
          </td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1F3864,#2E5598);padding:28px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">🎧</div>
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700;">Tu código de acceso</h1>
            <p style="color:rgba(255,255,255,.75);margin:6px 0 0;font-size:13px;">${esc(sessionTitle)}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 40px;">
            <p style="font-size:15px;color:#1F3864;font-weight:600;margin:0 0 6px;">Hola, Estudiante 👋</p>
            <p style="font-size:13px;color:#444;line-height:1.6;margin:0 0 28px;">
              Tu docente ha publicado una evaluación de escucha. Usa el código de abajo para ingresar.
            </p>

            <!-- Code card -->
            <div style="background:#EFF6FF;border:2px dashed #2563EB;border-radius:14px;padding:24px 32px;text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 8px;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Tu código personal</p>
              <div style="font-size:38px;font-weight:800;letter-spacing:0.12em;color:#1D4ED8;font-family:'Courier New',monospace;line-height:1.1;">${esc(accessCode)}</div>
              <p style="margin:10px 0 0;font-size:11px;color:#9CA3AF;">Solo válido para ti — no lo compartas</p>
            </div>

            <!-- CTA button -->
            <div style="text-align:center;margin-bottom:12px;">
              <a href="${PLAYER_URL}"
                style="display:inline-block;background:linear-gradient(135deg,#1F3864,#2E5598);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.02em;">
                🎧 Ingresar a la evaluación →
              </a>
            </div>
            <!-- Visible URL for copy-paste -->
            <div style="text-align:center;margin-bottom:28px;">
              <p style="margin:0 0 4px;font-size:11px;color:#9CA3AF;">O copia y pega este enlace en tu navegador:</p>
              <a href="${PLAYER_URL}" style="font-size:13px;color:#2563EB;word-break:break-all;">${PLAYER_URL}</a>
            </div>

            <!-- Info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#6B7280;width:130px;">Estudiante</td>
                <td style="padding:4px 0;font-size:12px;color:#374151;font-weight:600;">Estudiante Ejemplo</td>
              </tr>
              <tr>
                <td style="padding:4px 0;font-size:12px;color:#6B7280;">Docente</td>
                <td style="padding:4px 0;font-size:12px;color:#374151;">${esc(teacherName)}</td>
              </tr>
              ${durationLine}
            </table>

            <div style="background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
              <p style="margin:0;font-size:12px;color:#92400E;">
                ⚠️ <strong>Importante:</strong> Este código es estrictamente personal. No lo compartas con otros estudiantes — cada uno tiene el suyo.
              </p>
            </div>

            <p style="font-size:12px;color:#9CA3AF;margin:0;">
              Este mensaje fue generado automáticamente por CBF Planner. Por favor no respondas a este correo.
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

// ── nanoid-lite: 8-char alphanumeric code ──────────────────────────────────
function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = 'TEST-'
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, extra_email } = await req.json()
    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
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

    // 1. Load session + teacher + school
    const { data: session, error: sesErr } = await supabase
      .from('dictation_sessions')
      .select('id, title, duration_minutes, teacher_id, school_id')
      .eq('id', session_id)
      .single()

    if (sesErr || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const [{ data: teacher }, { data: school }, { data: blueprint }] = await Promise.all([
      supabase.from('teachers').select('full_name, email').eq('id', session.teacher_id).single(),
      supabase.from('schools').select('name').eq('id', session.school_id).single(),
      supabase
        .from('dictation_sessions')
        .select('blueprint_id')
        .eq('id', session_id)
        .single(),
    ])

    const teacherName = teacher?.full_name || teacher?.email || 'Docente'
    const schoolName  = school?.name || 'Colegio Boston Flexible'
    const teacherEmail = teacher?.email

    if (!teacherEmail) {
      return new Response(JSON.stringify({ error: 'Teacher email not found' }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Find or create a test instance for the teacher
    const TEST_NAME = `TEST — ${teacherName}`
    let { data: existingInst } = await supabase
      .from('dictation_instances')
      .select('id, access_code')
      .eq('session_id', session_id)
      .eq('student_name', TEST_NAME)
      .maybeSingle()

    let accessCode: string

    if (existingInst) {
      accessCode = existingInst.access_code
    } else {
      // Load blueprint questions to populate the test instance
      const bpId = blueprint?.blueprint_id
      let generatedQuestions = null
      if (bpId) {
        const { data: bp } = await supabase
          .from('dictation_blueprints')
          .select('generated_questions')
          .eq('id', bpId)
          .single()
        generatedQuestions = bp?.generated_questions || null
      }

      accessCode = genCode()
      // Ensure uniqueness (retry once on collision — extremely rare)
      const { count } = await supabase
        .from('dictation_instances')
        .select('id', { count: 'exact', head: true })
        .eq('access_code', accessCode)
      if (count && count > 0) accessCode = genCode()

      const { error: insErr } = await supabase
        .from('dictation_instances')
        .insert({
          session_id,
          student_name: TEST_NAME,
          student_section: 'TEST',
          access_code: accessCode,
          instance_status: 'ready',
          generated_questions: generatedQuestions,
        })

      if (insErr) {
        console.error('Test instance insert error:', insErr)
        return new Response(JSON.stringify({ error: 'Could not create test instance' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // 3. Build recipient list
    const recipients: string[] = [teacherEmail]
    if (extra_email && extra_email.trim() && extra_email.trim() !== teacherEmail) {
      recipients.push(extra_email.trim())
    }

    // 4. Send test emails
    const html = buildTestEmailHtml({
      teacherName,
      sessionTitle: session.title || 'Evaluación de Escucha',
      accessCode,
      durationMinutes: session.duration_minutes ?? null,
      schoolName,
    })

    const errors: string[] = []
    for (const email of recipients) {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    'CBF Planner <onboarding@resend.dev>',
          to:      [email],
          subject: `🧪 [PRUEBA] Código de acceso — ${session.title || 'Evaluación de Escucha'}`,
          html,
        }),
      })
      if (!emailRes.ok) {
        const errBody = await emailRes.text()
        console.error(`Resend error for ${email}:`, errBody)
        errors.push(`${email}: ${errBody.slice(0, 80)}`)
      }
    }

    return new Response(JSON.stringify({
      ok: errors.length < recipients.length,
      access_code: accessCode,
      sent_to: recipients,
      errors,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('dictation-send-test error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
