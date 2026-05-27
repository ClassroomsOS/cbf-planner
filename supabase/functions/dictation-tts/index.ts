// ============================================================
// CBF PLANNER — dictation-tts
// Supabase Edge Function (Deno)
//
// Convierte texto a audio usando Azure Cognitive Services TTS.
// Sube los archivos MP3 resultantes a Supabase Storage
// (bucket: dictation-audio).
//
// Input:  { texts[], voice_id, speed?, blueprint_id, school_id, section }
// Output: { ok, audio_urls[] }
//
// Deploy: supabase functions deploy dictation-tts --no-verify-jwt
// Secrets: AZURE_TTS_KEY, AZURE_TTS_REGION
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AZURE_TTS_KEY    = Deno.env.get("AZURE_TTS_KEY") || "";
const AZURE_TTS_REGION = Deno.env.get("AZURE_TTS_REGION") || "eastus";

const ALLOWED_ORIGINS = [
  "https://classroomsos.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

const BUCKET = "dictation-audio";

// ── Azure TTS — synthesize text to MP3 ────────────────────────────────────
async function synthesize(
  text: string,
  voiceId: string,
  speed: number = 1.0
): Promise<Uint8Array> {
  const endpoint = `https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  // SSML with prosody for speed control
  const ssml = `
<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
  <voice name='${voiceId}'>
    <prosody rate='${speed >= 1 ? "+" : ""}${Math.round((speed - 1) * 100)}%'>
      ${escapeXml(text)}
    </prosody>
  </voice>
</speak>`.trim();

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_TTS_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
    },
    body: ssml,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure TTS error ${res.status}: ${errText}`);
  }

  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsOrigin = getCorsOrigin(req);
  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      texts,
      voice_id = "en-US-JennyNeural",
      speed = 1.0,
      blueprint_id,
      school_id,
      section = "audio",
    } = body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: "texts[] is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!AZURE_TTS_KEY) {
      return new Response(
        JSON.stringify({ error: "AZURE_TTS_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client (service role for Storage uploads)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const audioUrls: string[] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text || !text.trim()) {
        audioUrls.push("");
        continue;
      }

      // Synthesize audio
      const audioBytes = await synthesize(text, voice_id, speed);

      // Upload to Storage
      const path = `${school_id}/${blueprint_id}/${section}_${String(i).padStart(3, "0")}.mp3`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, audioBytes, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadErr) {
        console.error(`Upload error for ${path}:`, uploadErr);
        audioUrls.push("");
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path);

      audioUrls.push(urlData?.publicUrl || "");
    }

    return new Response(
      JSON.stringify({ ok: true, audio_urls: audioUrls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("dictation-tts error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
