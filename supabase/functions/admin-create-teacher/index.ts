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

async function sendWelcomeEmail(
  email: string,
  fullName: string,
  recoveryUrl: string,
  schoolName: string,
): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return false

  const firstName = fullName.split(' ')[0]

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1F3864,#2E5598);padding:32px 40px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">📋</div>
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:-.3px;">CBF Planner</h1>
            <p style="color:rgba(255,255,255,.75);margin:4px 0 0;font-size:13px;">${schoolName}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="font-size:16px;color:#1F3864;font-weight:600;margin:0 0 8px;">¡Bienvenido/a, ${firstName}! 🎉</p>
            <p style="font-size:14px;color:#444;line-height:1.6;margin:0 0 24px;">
              Tu cuenta de docente en <strong>CBF Planner</strong> ha sido creada.
              Haz clic en el botón para establecer tu contraseña y comenzar a planificar.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center" style="padding:8px 0 28px;">
                <a href="${recoveryUrl}"
                   style="display:inline-block;background:linear-gradient(135deg,#1F3864,#2E5598);color:#fff;
                          text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;
                          font-weight:700;letter-spacing:-.2px;">
                  🔐 Establecer mi contraseña
                </a>
              </td></tr>
            </table>

            <p style="font-size:12px;color:#888;line-height:1.6;margin:0 0 6px;">
              Si el botón no funciona, copia y pega este enlace en tu navegador:
            </p>
            <p style="font-size:11px;color:#4BACC6;word-break:break-all;margin:0 0 28px;">
              ${recoveryUrl}
            </p>

            <div style="background:#f8faff;border-left:3px solid #2E5598;padding:14px 18px;border-radius:0 8px 8px 0;">
              <p style="margin:0;font-size:12px;color:#555;line-height:1.6;">
                ⚠️ <strong>Este enlace expira en 1 hora.</strong><br>
                Si lo necesitas de nuevo, solicita a tu coordinador que regenere el enlace desde el Panel de Docentes.
              </p>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8faff;padding:20px 40px;border-top:1px solid #eef0f6;text-align:center;">
            <p style="margin:0;font-size:11px;color:#aaa;">
              CBF Planner · ETA Platform · ${schoolName}<br>
              <em>"Nosotros diseñamos. El docente enseña."</em>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    'CBF Planner <onboarding@resend.dev>',
        to:      email,
        subject: `Bienvenido/a a CBF Planner — Establece tu contraseña`,
        html,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { email, full_name, role, level, school_id } = await req.json()

    if (!email || !full_name || !school_id) {
      return new Response(JSON.stringify({ error: 'email, full_name y school_id son requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Validate email domain
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('features, name')
      .eq('id', school_id)
      .single()

    const restrict      = school?.features?.restrict_email_domain !== false
    const allowedDomain: string = school?.features?.email_domain || 'redboston.edu.co'
    const emailDomain   = email.toLowerCase().trim().split('@')[1] || ''

    if (restrict && emailDomain !== allowedDomain) {
      return new Response(JSON.stringify({
        error: `Solo se permiten correos @${allowedDomain}. Desactiva la restricción de dominio en Panel de Control → Seguridad para usar otros correos.`,
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = authData.user.id

    // 3. Build initials
    const initials = full_name
      .split(' ')
      .filter((w: string) => w.length > 0)
      .map((w: string) => w[0].toUpperCase())
      .slice(0, 2)
      .join('')

    // 4. Insert teacher row
    const { error: dbError } = await supabaseAdmin.from('teachers').insert({
      id:        userId,
      email:     email.toLowerCase().trim(),
      full_name: full_name.trim(),
      initials,
      role:      role || 'teacher',
      level:     level || null,
      school_id,
      status:    'approved',
    })

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Generate recovery link
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type:  'recovery',
      email: email.toLowerCase().trim(),
    })

    const recoveryUrl = linkData?.properties?.action_link ?? null

    // 6. Send welcome email via Resend (best-effort — no falla la operación si falla el email)
    const schoolName = school?.name || 'Colegio Boston Flexible'
    const emailSent  = recoveryUrl
      ? await sendWelcomeEmail(email, full_name, recoveryUrl, schoolName)
      : false

    return new Response(JSON.stringify({
      success:      true,
      id:           userId,
      recovery_url: recoveryUrl,
      email_sent:   emailSent,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
