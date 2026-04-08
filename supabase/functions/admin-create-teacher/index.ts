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

    // 1. Validate email domain if restriction is enabled for this school
    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('features')
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

    // 2. Create auth user (email pre-confirmed — no confirmation required)
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

    // 3. Build initials from full_name
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
      // Rollback auth user so we don't leave orphans
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: dbError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Generate password-recovery link (so teacher can set their own password)
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type:  'recovery',
      email: email.toLowerCase().trim(),
    })

    return new Response(JSON.stringify({
      success:      true,
      id:           userId,
      recovery_url: linkData?.properties?.action_link ?? null,
      email_sent:   false,
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
