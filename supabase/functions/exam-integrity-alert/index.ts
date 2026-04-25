// ============================================================
// CBF PLANNER — exam-integrity-alert
// Supabase Edge Function (Deno) — Sesión L / M
//
// Recibe eventos desde ExamPlayerV2Page y:
//   1. Actualiza integrity_flags en exam_instances (solo violaciones)
//   2. Envía mensaje Telegram al docente con formato según tipo de evento:
//      • Violaciones de integridad → ALERTA ⚠️ 🚨
//      • Notificaciones de ciclo  → INFO 🟢 ✅
//
// Throttle: el frontend controla la frecuencia de violaciones (1/60s).
// Notificaciones (exam_started, exam_submitted) no tienen throttle.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

const ALLOWED_ORIGINS = [
  "https://classroomsos.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
];

function getCorsOrigin(req: Request): string {
  const origin = req.headers.get("Origin") || "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

// ── Eventos de integridad (violaciones) ──────────────────────────────────────
const INTEGRITY_LABELS: Record<string, string> = {
  tab_switch:         "cambió de pestaña / bloqueó la pantalla",
  window_blur:        "perdió el foco de ventana",
  fullscreen_exit:    "salió de pantalla completa",
  fullscreen_declined:"rechazó el fullscreen al iniciar",
  devtools_open:      "abrió DevTools",
  blocked_key:        "intentó tecla bloqueada (F12/Ctrl+U/etc.)",
  beforeunload:       "intentó cerrar la página",
  context_menu:       "click derecho",
  copy_attempt:       "intentó copiar/cortar",
  pagehide:           "ocultó la página (iOS Home / app switcher)",
};

// ── Eventos de ciclo (no son violaciones) ────────────────────────────────────
const CYCLE_EVENTS = new Set(["exam_started", "exam_resumed", "exam_submitted"]);

const CYCLE_META: Record<string, { emoji: string; verb: string }> = {
  exam_started:  { emoji: "🟢", verb: "INICIÓ el examen" },
  exam_resumed:  { emoji: "🔄", verb: "REANUDÓ el examen" },
  exam_submitted:{ emoji: "✅", verb: "ENVIÓ el examen" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function bogotaTime(): string {
  return new Date().toLocaleTimeString("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return false;
  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    },
  );
  return res.ok;
}

// ── Handler principal ─────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const origin = getCorsOrigin(req);
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const {
      session_id,
      instance_id,
      student_name,
      student_section,
      exam_title,
      event_type,
      count,
      start_time,
      submit_time,
      score_info,
    } = await req.json();

    if (!instance_id) return json({ error: "instance_id requerido" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const isCycleEvent = CYCLE_EVENTS.has(event_type);

    // ── 1. Actualizar integrity_flags (solo violaciones) ─────────────────────
    if (!isCycleEvent) {
      await supabase.from("exam_instances").update({
        tab_switches: count,
        integrity_flags: {
          high_risk: count >= 3,
          last_event: event_type,
          violation_count: count,
          updated_at: new Date().toISOString(),
        },
      }).eq("id", instance_id);
    }

    // ── 2. Obtener teacher_id desde exam_sessions ─────────────────────────────
    if (!session_id) return json({ ok: true, telegram: false });

    const { data: sess } = await supabase
      .from("exam_sessions")
      .select("teacher_id, title")
      .eq("id", session_id)
      .maybeSingle();

    const teacherId = sess?.teacher_id;
    if (!teacherId) return json({ ok: true, telegram: false });

    // ── 3. Obtener telegram_chat_id del docente ───────────────────────────────
    const { data: teacher } = await supabase
      .from("teachers")
      .select("telegram_chat_id, full_name")
      .eq("id", teacherId)
      .maybeSingle();

    if (!teacher?.telegram_chat_id || !TELEGRAM_BOT_TOKEN) {
      return json({ ok: true, telegram: false });
    }

    // ── 4. Construir mensaje según tipo de evento ─────────────────────────────
    const title    = exam_title || sess?.title || "Examen";
    const student  = student_name  || "Estudiante";
    const section  = student_section || "—";
    const timeStr  = start_time || submit_time || bogotaTime();

    let msgLines: string[];

    if (isCycleEvent) {
      // ── Notificación de ciclo ──────────────────────────────────────────────
      const meta = CYCLE_META[event_type];
      msgLines = [
        `${meta.emoji} *${student} ${meta.verb}*`,
        `📝 ${title}`,
        `👤 Sección: ${section}`,
        `🕐 ${timeStr}`,
      ];
      if (score_info) {
        msgLines.push(`📊 Puntaje: ${score_info}`);
      }
      if (event_type === "exam_submitted") {
        msgLines.push("─");
        msgLines.push("_Ver resultados completos en CBF Planner → Módulo de Evaluación_");
      }
    } else {
      // ── Alerta de integridad ───────────────────────────────────────────────
      const riskEmoji = count >= 5 ? "🚨" : count >= 3 ? "⚠️" : "📢";
      const label     = INTEGRITY_LABELS[event_type] || event_type;
      msgLines = [
        `${riskEmoji} *ALERTA DE INTEGRIDAD — CBF*`,
        `👤 *${student}* — Sección: ${section}`,
        `📝 ${title}`,
        `🔍 Evento: ${label}`,
        `📊 Total alertas: *${count}*`,
        `🕐 ${bogotaTime()}`,
      ];
      if (count >= 3) msgLines.push("🔴 *RIESGO ALTO — Revisar manualmente*");
    }

    const telegramOk = await sendTelegram(
      teacher.telegram_chat_id,
      msgLines.join("\n"),
    );

    return json({ ok: true, telegram: telegramOk });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
