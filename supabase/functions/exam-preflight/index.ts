// ============================================================
// CBF PLANNER — exam-preflight
// Supabase Edge Function (Deno)
// Versión: 1.0.0 — 2026-04-22
//
// Responsabilidades:
//   1. Verificar que todos los componentes están listos antes de un examen
//   2. Auto-reparar lo que sea reparable (instancias faltantes, PDFs, etc.)
//   3. Reportar por Telegram al docente con veredicto claro
//   4. Guardar log forense en exam_preflight_log
//
// Puede ser llamada por:
//   - pg_cron (automático, noche anterior al examen)
//   - El docente manualmente desde ExamDashboard
//   - exam-preflight-scheduler (revisa sesiones programadas)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Tipos ───────────────────────────────────────────────────

interface CheckResult {
  ok: boolean;
  latency_ms?: number;
  warning?: string;
  error?: string;
  detail?: Record<string, unknown>;
}

interface PreflightResults {
  checked_at: string;
  session_id: string;
  checks: {
    supabase: CheckResult;
    claude_proxy: CheckResult;
    storage: CheckResult;
    instances: CheckResult;
    pdfs: CheckResult;
    ai_corrector: CheckResult;
  };
  verdict: "passed" | "passed_with_warnings" | "failed";
  warnings: string[];
  critical_failures: string[];
  auto_repair_attempted: boolean;
  auto_repair_results: Record<string, unknown>;
  telegram_sent: boolean;
}

interface PreflightRequest {
  session_id: string;
  triggered_by: "cron" | "manual" | "pre_exam_auto";
  school_id?: string; // opcional — se infiere de la sesión si no viene
}

// ─── Constantes ──────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID") ?? "2041749428";

// Umbrales de performance
const THRESHOLDS = {
  supabase_latency_warn_ms: 500,
  supabase_latency_fail_ms: 2000,
  claude_proxy_latency_warn_ms: 3000,
  claude_proxy_latency_fail_ms: 8000,
  storage_latency_warn_ms: 1000,
  storage_latency_fail_ms: 3000,
  ai_corrector_latency_warn_ms: 5000,
  ai_corrector_latency_fail_ms: 15000,
};

// ─── Handler principal ────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS para llamadas desde el frontend
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: PreflightRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { session_id, triggered_by } = body;

  if (!session_id || !triggered_by) {
    return jsonResponse({ error: "session_id and triggered_by are required" }, 400);
  }

  // Cliente con service role — preflight necesita ver todo
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const results = await runPreflight(supabase, session_id, triggered_by);
    return jsonResponse(results, 200);
  } catch (err) {
    await cbfLog(supabase, {
      module: "EXAM",
      function_name: "exam-preflight",
      message: `Error crítico en preflight: ${err.message}`,
      severity: "critical",
      error_code: "CBF-EXAM-PRE-001",
      payload_out: { error: err.message, stack: err.stack },
    });
    return jsonResponse({ error: err.message }, 500);
  }
});

// ─── Orquestador principal ────────────────────────────────────

async function runPreflight(
  supabase: ReturnType<typeof createClient>,
  session_id: string,
  triggered_by: "cron" | "manual" | "pre_exam_auto"
): Promise<PreflightResults> {

  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  const criticalFailures: string[] = [];
  const autoRepairResults: Record<string, unknown> = {};
  let autoRepairAttempted = false;

  // ── 0. Cargar sesión ─────────────────────────────────────
  const { data: session, error: sessionError } = await supabase
    .from("exam_sessions")
    .select(`
      *,
      exam_blueprints (
        id, title, subject, total_points, sections,
        delivery_modes, teacher_id
      )
    `)
    .eq("id", session_id)
    .single();

  if (sessionError || !session) {
    throw new Error(`Sesión no encontrada: ${session_id}`);
  }

  const blueprint = session.exam_blueprints;

  // Marcar preflight como en ejecución
  await supabase
    .from("exam_sessions")
    .update({ preflight_status: "running", preflight_last_run: startedAt })
    .eq("id", session_id);

  // ── 1. CHECK: Supabase ───────────────────────────────────
  const checkSupabase = await checkSupabaseLatency(supabase);
  if (!checkSupabase.ok) {
    criticalFailures.push("Supabase no responde dentro del límite aceptable");
  } else if (checkSupabase.warning) {
    warnings.push(`Supabase latencia alta: ${checkSupabase.latency_ms}ms`);
  }

  // ── 2. CHECK: claude-proxy ───────────────────────────────
  const checkClaude = await checkClaudeProxy();
  if (!checkClaude.ok) {
    criticalFailures.push("claude-proxy no disponible — generación IA bloqueada");
  } else if (checkClaude.warning) {
    warnings.push(`claude-proxy latencia alta: ${checkClaude.latency_ms}ms — corrección puede ser lenta`);
  }

  // ── 3. CHECK: Storage ────────────────────────────────────
  const checkStorage = await checkSupabaseStorage(supabase, session.school_id);
  if (!checkStorage.ok) {
    criticalFailures.push("Supabase Storage no accesible — PDFs y assets bloqueados");
  } else if (checkStorage.warning) {
    warnings.push(`Storage latencia alta: ${checkStorage.latency_ms}ms`);
  }

  // ── 4. CHECK: Instancias generadas ──────────────────────
  const checkInstances = await checkExamInstances(supabase, session_id);

  if (!checkInstances.ok) {
    // AUTO-REPARACIÓN: intentar generar instancias faltantes
    autoRepairAttempted = true;
    const repairResult = await repairMissingInstances(
      supabase, session_id, session.school_id, blueprint.id,
      checkInstances.detail as { missing_codes: string[] }
    );
    autoRepairResults.instances = repairResult;

    // Re-verificar después de reparación
    const recheckInstances = await checkExamInstances(supabase, session_id);
    if (!recheckInstances.ok) {
      criticalFailures.push(
        `Instancias incompletas: ${recheckInstances.detail?.missing} estudiantes sin examen generado`
      );
    } else {
      warnings.push("Instancias faltantes reparadas automáticamente durante preflight");
      checkInstances.ok = true;
      checkInstances.warning = "Reparado automáticamente";
    }
  }

  // ── 5. CHECK: PDFs pre-generados ────────────────────────
  const checkPdfs = await checkPreGeneratedPdfs(supabase, session_id);

  if (!checkPdfs.ok && checkStorage.ok) {
    // AUTO-REPARACIÓN: generar PDFs faltantes
    autoRepairAttempted = true;
    const pdfRepair = await repairMissingPdfs(supabase, session_id);
    autoRepairResults.pdfs = pdfRepair;

    if (!pdfRepair.success) {
      warnings.push("PDFs no se pudieron pre-generar — disponibles en modo digital");
    } else {
      warnings.push("PDFs generados automáticamente durante preflight");
    }
  } else if (!checkPdfs.ok && !checkStorage.ok) {
    warnings.push("PDFs no disponibles (Storage caído) — solo modo digital");
  }

  // ── 6. CHECK: AI Corrector ───────────────────────────────
  const checkAiCorrector = await checkAiCorrectorFunction();
  if (!checkAiCorrector.ok) {
    warnings.push("exam-ai-corrector lento — correcciones diferidas post-examen");
    // No es crítico — el examen corre, la corrección es asíncrona
  } else if (checkAiCorrector.warning) {
    warnings.push(`AI corrector latencia alta: ${checkAiCorrector.latency_ms}ms`);
  }

  // ── Veredicto ────────────────────────────────────────────
  const verdict: PreflightResults["verdict"] =
    criticalFailures.length > 0
      ? "failed"
      : warnings.length > 0
      ? "passed_with_warnings"
      : "passed";

  // Determinar modo de resiliencia recomendado
  const resilienceMode = determineResilienceMode(
    criticalFailures, warnings, checkClaude.ok, checkStorage.ok
  );

  const preflightResults: PreflightResults = {
    checked_at: startedAt,
    session_id,
    checks: {
      supabase: checkSupabase,
      claude_proxy: checkClaude,
      storage: checkStorage,
      instances: checkInstances,
      pdfs: checkPdfs,
      ai_corrector: checkAiCorrector,
    },
    verdict,
    warnings,
    critical_failures: criticalFailures,
    auto_repair_attempted: autoRepairAttempted,
    auto_repair_results: autoRepairResults,
    telegram_sent: false,
  };

  // ── Actualizar exam_sessions ─────────────────────────────
  await supabase
    .from("exam_sessions")
    .update({
      preflight_status: verdict === "failed" ? "failed" : verdict === "passed_with_warnings" ? "warned" : "passed",
      preflight_last_run: startedAt,
      preflight_results: preflightResults,
      resilience_mode: resilienceMode,
      status: verdict === "failed" ? "preparing" : "ready",
    })
    .eq("id", session_id);

  // ── Guardar log forense ──────────────────────────────────
  await supabase.from("exam_preflight_log").insert({
    school_id: session.school_id,
    session_id,
    triggered_by,
    triggered_at: startedAt,
    check_supabase: checkSupabase,
    check_claude_proxy: checkClaude,
    check_storage: checkStorage,
    check_instances: checkInstances,
    check_pdfs: checkPdfs,
    check_ai_corrector: checkAiCorrector,
    verdict,
    warnings,
    critical_failures: criticalFailures,
    auto_repair_attempted: autoRepairAttempted,
    auto_repair_results: autoRepairResults,
  });

  // ── Notificación Telegram ────────────────────────────────
  const teacherId = blueprint.teacher_id;
  const telegramMessage = buildTelegramMessage(
    session, blueprint, preflightResults, resilienceMode
  );
  const telegramSent = await sendTelegram(telegramMessage);
  preflightResults.telegram_sent = telegramSent;

  // ── cbf-logger ───────────────────────────────────────────
  await cbfLog(supabase, {
    module: "EXAM",
    function_name: "exam-preflight",
    message: `Preflight ${verdict} — sesión: ${session.title}`,
    severity: verdict === "failed" ? "critical" : verdict === "passed_with_warnings" ? "warn" : "info",
    error_code: verdict === "failed" ? "CBF-EXAM-PRE-001" : verdict === "passed_with_warnings" ? "CBF-EXAM-PRE-002" : undefined,
    school_id: session.school_id,
    duration_ms: Date.now() - new Date(startedAt).getTime(),
    payload_out: { verdict, warnings, criticalFailures },
  });

  return preflightResults;
}

// ─── Checks individuales ──────────────────────────────────────

async function checkSupabaseLatency(
  supabase: ReturnType<typeof createClient>
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const { error } = await supabase.from("schools").select("id").limit(1);
    const latency = Date.now() - start;
    if (error) return { ok: false, latency_ms: latency, error: error.message };
    if (latency > THRESHOLDS.supabase_latency_fail_ms) {
      return { ok: false, latency_ms: latency, error: "Latencia crítica" };
    }
    if (latency > THRESHOLDS.supabase_latency_warn_ms) {
      return { ok: true, latency_ms: latency, warning: "latency_high" };
    }
    return { ok: true, latency_ms: latency };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: err.message };
  }
}

async function checkClaudeProxy(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/claude-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 10,
        messages: [{ role: "user", content: "ping" }],
      }),
      signal: AbortSignal.timeout(THRESHOLDS.claude_proxy_latency_fail_ms),
    });
    const latency = Date.now() - start;
    if (!res.ok) {
      return { ok: false, latency_ms: latency, error: `HTTP ${res.status}` };
    }
    if (latency > THRESHOLDS.claude_proxy_latency_warn_ms) {
      return { ok: true, latency_ms: latency, warning: "latency_high" };
    }
    return { ok: true, latency_ms: latency };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: err.message };
  }
}

async function checkSupabaseStorage(
  supabase: ReturnType<typeof createClient>,
  schoolId: string
): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Intenta listar el bucket de exámenes
    const { error } = await supabase.storage
      .from("exam-assets")
      .list(`${schoolId}/`, { limit: 1 });
    const latency = Date.now() - start;
    if (error) return { ok: false, latency_ms: latency, error: error.message };
    if (latency > THRESHOLDS.storage_latency_warn_ms) {
      return { ok: true, latency_ms: latency, warning: "latency_high" };
    }
    return { ok: true, latency_ms: latency };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: err.message };
  }
}

async function checkExamInstances(
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<CheckResult> {
  try {
    const { data, error } = await supabase
      .from("exam_instances")
      .select("id, student_code, instance_status, generated_questions")
      .eq("session_id", sessionId);

    if (error) return { ok: false, error: error.message };

    const total = data?.length ?? 0;
    const generated = data?.filter(
      (i) => i.generated_questions && Array.isArray(i.generated_questions) && i.generated_questions.length > 0
    ).length ?? 0;
    const missing = total - generated;
    const missingCodes = data
      ?.filter((i) => !i.generated_questions || i.generated_questions.length === 0)
      .map((i) => i.student_code) ?? [];

    if (total === 0) {
      return {
        ok: false,
        error: "No hay instancias registradas para esta sesión",
        detail: { total: 0, generated: 0, missing: 0, missing_codes: [] },
      };
    }

    if (missing > 0) {
      return {
        ok: false,
        error: `${missing} estudiante(s) sin examen generado`,
        detail: { total, generated, missing, missing_codes: missingCodes },
      };
    }

    return {
      ok: true,
      detail: { total, generated, missing: 0, missing_codes: [] },
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkPreGeneratedPdfs(
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<CheckResult> {
  try {
    const { data, error } = await supabase
      .from("exam_instances")
      .select("id, student_code, pdf_url")
      .eq("session_id", sessionId);

    if (error) return { ok: false, error: error.message };

    const total = data?.length ?? 0;
    const withPdf = data?.filter((i) => !!i.pdf_url).length ?? 0;
    const missing = total - withPdf;

    if (missing > 0) {
      return {
        ok: false,
        error: `${missing} PDFs no generados`,
        detail: { total, with_pdf: withPdf, missing },
      };
    }

    return { ok: true, detail: { total, with_pdf: withPdf, missing: 0 } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function checkAiCorrectorFunction(): Promise<CheckResult> {
  const start = Date.now();
  try {
    // Ping liviano — no procesa nada real
    const res = await fetch(`${SUPABASE_URL}/functions/v1/exam-ai-corrector`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ ping: true }),
      signal: AbortSignal.timeout(THRESHOLDS.ai_corrector_latency_fail_ms),
    });
    const latency = Date.now() - start;
    // 200 o 400 (ping rechazado correctamente) = función viva
    if (!res.ok && res.status !== 400) {
      return { ok: false, latency_ms: latency, error: `HTTP ${res.status}` };
    }
    if (latency > THRESHOLDS.ai_corrector_latency_warn_ms) {
      return { ok: true, latency_ms: latency, warning: "latency_high" };
    }
    return { ok: true, latency_ms: latency };
  } catch (err) {
    return { ok: false, latency_ms: Date.now() - start, error: err.message };
  }
}

// ─── Auto-reparación ─────────────────────────────────────────

async function repairMissingInstances(
  supabase: ReturnType<typeof createClient>,
  sessionId: string,
  schoolId: string,
  blueprintId: string,
  detail: { missing_codes: string[] }
): Promise<Record<string, unknown>> {
  if (!detail.missing_codes || detail.missing_codes.length === 0) {
    return { skipped: true, reason: "No missing codes provided" };
  }

  try {
    // Llamar al generador de instancias para las que faltan
    const res = await fetch(`${SUPABASE_URL}/functions/v1/exam-instance-generator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        school_id: schoolId,
        blueprint_id: blueprintId,
        student_codes: detail.missing_codes, // solo genera las que faltan
        triggered_by: "preflight_repair",
      }),
      signal: AbortSignal.timeout(60000), // 60s para regenerar
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err, codes_attempted: detail.missing_codes };
    }

    const result = await res.json();
    return { success: true, generated: result.generated, codes_attempted: detail.missing_codes };
  } catch (err) {
    return { success: false, error: err.message, codes_attempted: detail.missing_codes };
  }
}

async function repairMissingPdfs(
  supabase: ReturnType<typeof createClient>,
  sessionId: string
): Promise<Record<string, unknown>> {
  try {
    const { data: instances } = await supabase
      .from("exam_instances")
      .select("id, student_code")
      .eq("session_id", sessionId)
      .is("pdf_url", null);

    if (!instances || instances.length === 0) {
      return { success: true, generated: 0, message: "No missing PDFs" };
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/exam-pdf-generator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        instance_ids: instances.map((i) => i.id),
      }),
      signal: AbortSignal.timeout(120000), // 2 min para generar todos los PDFs
    });

    if (!res.ok) {
      const err = await res.text();
      return { success: false, error: err, attempted: instances.length };
    }

    const result = await res.json();
    return { success: true, generated: result.generated, attempted: instances.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Modo de resiliencia ──────────────────────────────────────

function determineResilienceMode(
  criticalFailures: string[],
  warnings: string[],
  claudeOk: boolean,
  storageOk: boolean
): string {
  if (criticalFailures.length === 0 && warnings.length === 0) return "full";

  if (!claudeOk && storageOk) return "no_realtime_ai";
  if (!storageOk && claudeOk) return "offline_sync";
  if (!claudeOk && !storageOk) return "pdf_fallback";

  // Solo warnings — el sistema funciona pero monitorear
  return "full";
}

// ─── Mensaje Telegram ─────────────────────────────────────────

function buildTelegramMessage(
  session: Record<string, unknown>,
  blueprint: Record<string, unknown>,
  results: PreflightResults,
  resilienceMode: string
): string {
  const emoji = {
    passed: "✅",
    passed_with_warnings: "⚠️",
    failed: "🚨",
  }[results.verdict];

  const modeLabel = {
    full: "Sistema completo",
    no_realtime_ai: "Sin IA en tiempo real — corrección diferida",
    offline_sync: "Modo offline activo",
    pdf_fallback: "Modo papel disponible",
  }[resilienceMode] ?? resilienceMode;

  const scheduledAt = new Date(session.scheduled_at as string);
  const dateStr = scheduledAt.toLocaleDateString("es-CO", {
    weekday: "long", month: "long", day: "numeric",
  });
  const timeStr = scheduledAt.toLocaleTimeString("es-CO", {
    hour: "2-digit", minute: "2-digit",
  });

  let message = `${emoji} *PREFLIGHT — ${results.verdict.toUpperCase().replace("_", " ")}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📋 *${session.title}*\n`;
  message += `📅 ${dateStr} · ${timeStr}\n`;
  message += `📊 ${blueprint.subject} · ${session.duration_minutes}min\n\n`;

  // Checks
  message += `*Verificaciones:*\n`;
  message += `${results.checks.supabase.ok ? "🟢" : "🔴"} Base de datos`;
  if (results.checks.supabase.latency_ms) message += ` (${results.checks.supabase.latency_ms}ms)`;
  message += `\n`;

  message += `${results.checks.claude_proxy.ok ? "🟢" : "🔴"} IA (claude-proxy)`;
  if (results.checks.claude_proxy.latency_ms) message += ` (${results.checks.claude_proxy.latency_ms}ms)`;
  message += `\n`;

  message += `${results.checks.storage.ok ? "🟢" : "🔴"} Storage`;
  if (results.checks.storage.latency_ms) message += ` (${results.checks.storage.latency_ms}ms)`;
  message += `\n`;

  const instanceDetail = results.checks.instances.detail as Record<string, number>;
  message += `${results.checks.instances.ok ? "🟢" : "🔴"} Instancias: `;
  message += instanceDetail
    ? `${instanceDetail.generated}/${instanceDetail.total} generadas`
    : "sin datos";
  message += `\n`;

  const pdfDetail = results.checks.pdfs.detail as Record<string, number>;
  message += `${results.checks.pdfs.ok ? "🟢" : "🟡"} PDFs: `;
  message += pdfDetail
    ? `${pdfDetail.with_pdf}/${pdfDetail.total} listos`
    : "sin datos";
  message += `\n`;

  message += `${results.checks.ai_corrector.ok ? "🟢" : "🟡"} Corrector IA\n\n`;

  // Modo activo
  message += `🔧 *Modo:* ${modeLabel}\n`;

  // Auto-reparación
  if (results.auto_repair_attempted) {
    message += `🔄 *Reparación automática ejecutada*\n`;
  }

  // Warnings
  if (results.warnings.length > 0) {
    message += `\n⚠️ *Advertencias:*\n`;
    results.warnings.forEach((w) => { message += `• ${w}\n`; });
  }

  // Fallas críticas
  if (results.critical_failures.length > 0) {
    message += `\n🚨 *Fallas críticas:*\n`;
    results.critical_failures.forEach((f) => { message += `• ${f}\n`; });
    message += `\n_Ingresa al sistema para ver opciones de contingencia._`;
  }

  if (results.verdict === "passed") {
    message += `\n_El examen puede correr. Nada más que hacer._`;
  }

  return message;
}

async function sendTelegram(message: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// ─── cbf-logger ───────────────────────────────────────────────

async function cbfLog(
  supabase: ReturnType<typeof createClient>,
  params: {
    module: string;
    function_name: string;
    message: string;
    severity: string;
    error_code?: string;
    school_id?: string;
    duration_ms?: number;
    payload_in?: unknown;
    payload_out?: unknown;
  }
): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/cbf-logger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(params),
    });
  } catch {
    // cbf-logger nunca debe romper el flujo principal
  }
}

// ─── Utilidades ───────────────────────────────────────────────

function jsonResponse(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
