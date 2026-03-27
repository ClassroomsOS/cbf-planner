import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY not configured')
    }

    const body = await req.json()

    const messages = []
    if (body.system) {
      messages.push({ role: 'system', content: body.system })
    }
    if (body.messages) {
      messages.push(...body.messages)
    } else {
      messages.push({ role: 'user', content: body.message || '' })
    }

    // Use llama-3.1-8b-instant: 20000 TPM free — much higher limits than 70b
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: body.max_tokens || 2000,
        temperature: 0.7,
        messages,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || `Groq error ${response.status}`)
    }

    const text = data.choices?.[0]?.message?.content || ''
    const finish_reason = data.choices?.[0]?.finish_reason || ''

    // Return text + debug info
    return new Response(JSON.stringify({ text, finish_reason, usage: data.usage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
