// ============================================================
// CBF PLANNER — exam-instance-generator
// Supabase Edge Function (Deno)
// Versión: 1.0.0 — 2026-04-22
//
// Responsabilidades:
//   1. Recibir blueprint_id + session_id + lista de estudiantes
//   2. Generar N versiones de preguntas únicas via Claude Sonnet
//   3. Asignar una versión distinta a cada estudiante (round-robin)
//   4. Guardar exam_instances con generated_questions inmutables
//   5. Armar service_worker_payload en exam_sessions (para modo offline)
//   6. Registrar en cbf-logger
//
// Doctrina:
//   Un blueprint → N versiones únicas → cada estudiante recibe una versión distinta
//   Si el estudiante A tiene "C" como respuesta, el estudiante B tiene preguntas
//   distintas con contextos distintos — copiar es estructuralmente imposible.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Tipos ───────────────────────────────────────────────────

interface Student {
  id?:      string;  // school_students.id
  code:     string;
  name:     string;
  email?:   string;
  section?: string;
}

interface GeneratorRequest {
  blueprint_id:  string;
  session_id:    string;
  school_id:     string;
  // Opción A: pasar roster explícito
  students?:     Student[];
  // Opción B: dejar que el generator consulte school_students por grade+section
  grade?:        string;
  section?:      string;
  version_count?: number; // 1–4, default 3
}

interface GeneratedQuestion {
  id: string;
  section_id: string;
  section_name: string;
  skill: string;
  question_type: string;
  stem: string;
  options?: string[];
  correct_answer?: string;
  points: number;
  rigor_level: "strict" | "flexible" | "conceptual";
  content_type: string;
  response_type: string;
  instructions?: string;
  biblical?: boolean;
  order_position: number;
}

interface Blueprint {
  id: string;
  title: string;
  subject: string;
  grade: string;
  period: number;
  learning_objectives: string[];
  skills_targeted: string[];
  vocabulary_scope: string | null;
  grammar_scope: string | null;
  content_topics: string[];
  biblical_connection: string | null;
  cefr_level: string | null;
  difficulty_profile: string;
  total_points: number;
  estimated_minutes: number;
  sections: BlueprintSection[];
  news_project_id: string | null;
}

interface BlueprintSection {
  id: string;
  name: string;
  skill: string;
  question_types: string[];
  content_types: string[];
  response_types: string[];
  points: number;
  question_count: number;
  instructions: string;
  biblical_min_pct?: number;
}

// ─── Constantes ──────────────────────────────────────────────

const SUPABASE_URL       = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLAUDE_PROXY_URL   = `${SUPABASE_URL}/functions/v1/claude-proxy`;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const TELEGRAM_CHAT_ID   = Deno.env.get("TELEGRAM_CHAT_ID") ?? "2041749428";

const VERSION_LABELS = ["A", "B", "C", "D"];

// Materias Modelo B (Language Arts) — responden en inglés
const MODELO_B_SUBJECTS = [
  "language arts", "language_arts", "social studies", "social_studies",
  "science", "lingua skill", "lingua_skill",
];

// ─── Handler principal ────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(null, 204, corsHeaders());
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: GeneratorRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { blueprint_id, session_id, school_id, students: explicitStudents,
          grade, section, version_count = 3 } = body;

  if (!blueprint_id || !session_id || !school_id) {
    return jsonResponse({
      error: "blueprint_id, session_id y school_id son requeridos"
    }, 400);
  }
  if (!explicitStudents?.length && (!grade || !section)) {
    return jsonResponse({
      error: "Debes pasar 'students[]' o 'grade' + 'section' para obtener el roster"
    }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const versions = Math.min(Math.max(version_count, 1), 4);

  try {
    // Resolver roster: explícito o desde school_students
    let students: Student[];
    if (explicitStudents?.length) {
      students = explicitStudents;
    } else {
      const { data: roster, error: rErr } = await supabase
        .from("school_students")
        .select("id, student_code, name, email, section")
        .eq("school_id", school_id)
        .eq("grade", grade!)
        .eq("section", section!)
        .order("name");

      if (rErr) throw new Error(`Error al leer roster: ${rErr.message}`);
      if (!roster?.length) {
        return jsonResponse({
          error: `No hay estudiantes registrados en ${grade} ${section}. Carga el roster primero.`
        }, 400);
      }
      students = roster.map(s => ({
        id:      s.id,
        code:    s.student_code,
        name:    s.name,
        email:   s.email,
        section: s.section,
      }));
    }

    const result = await generateInstances(supabase, {
      blueprint_id, session_id, school_id, students, version_count: versions,
    });
    return jsonResponse(result, 200);
  } catch (err) {
    await cbfLog(supabase, {
      module: "EXAM", function_name: "exam-instance-generator",
      message: `Error crítico en generación de instancias: ${err.message}`,
      severity: "critical", error_code: "CBF-EXAM-GEN-001",
      payload_out: { error: err.message, session_id },
    });
    await notifyTelegram(
      `🚨 ERROR GENERACIÓN EXAMEN\nSesión: ${session_id}\n${err.message}`
    );
    return jsonResponse({ error: err.message }, 500);
  }
});

// ─── Generación principal ─────────────────────────────────────

async function generateInstances(
  supabase: ReturnType<typeof createClient>,
  body: { blueprint_id: string; session_id: string; school_id: string; students: Student[]; version_count: number }
): Promise<Record<string, unknown>> {
  const { blueprint_id, session_id, school_id, students, version_count } = body;
  const startedAt = Date.now();

  await cbfLog(supabase, {
    module: "EXAM", function_name: "exam-instance-generator",
    message: `Iniciando generación: ${students.length} estudiantes, ${version_count} versiones`,
    severity: "info", payload_in: { blueprint_id, session_id, version_count },
  });

  // 1. Cargar el blueprint
  const { data: blueprint, error: bpError } = await supabase
    .from("exam_blueprints")
    .select("*")
    .eq("id", blueprint_id)
    .eq("school_id", school_id)
    .single();

  if (bpError || !blueprint) {
    throw new Error(`Blueprint no encontrado: ${bpError?.message}`);
  }

  // 2. Cargar contexto NEWS si existe
  let newsContext = "";
  if (blueprint.news_project_id) {
    const { data: news } = await supabase
      .from("news_projects")
      .select("title, skill, textbook_reference, actividades_evaluativas, biblical_principle")
      .eq("id", blueprint.news_project_id)
      .single();
    if (news) newsContext = buildNewsContext(news);
  }

  // 3. Generar N versiones de preguntas via Claude
  const versionQuestions: GeneratedQuestion[][] = [];
  for (let v = 0; v < version_count; v++) {
    const label = VERSION_LABELS[v];
    await cbfLog(supabase, {
      module: "EXAM", function_name: "exam-instance-generator",
      message: `Generando Versión ${label}...`,
      severity: "info", payload_in: { session_id, version: label },
    });

    const questions = await generateVersion(blueprint, label, v, newsContext);
    versionQuestions.push(questions);
  }

  // 4. Crear exam_instances para cada estudiante
  const instances = [];
  const errors = [];

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const vIdx = i % version_count;
    const vLabel = VERSION_LABELS[vIdx];
    const questions = versionQuestions[vIdx];

    const { data: instance, error: instError } = await supabase
      .from("exam_instances")
      .insert({
        session_id,
        school_id,
        student_code:        student.code,
        student_name:        student.name,
        student_email:       student.email   ?? null,
        student_id:          student.id      ?? null,
        student_section:     student.section ?? null,
        generated_questions: questions,
        version_label:       vLabel,
        instance_status:     "ready",
        delivery_mode:       "digital",
      })
      .select("id")
      .single();

    if (instError) {
      errors.push({ student: student.code, error: instError.message });
    } else {
      instances.push({ id: instance.id, student: student.code, version: vLabel });
    }
  }

  // 5. Armar service_worker_payload para modo offline
  const swPayload = buildServiceWorkerPayload(blueprint, versionQuestions, instances);

  await supabase
    .from("exam_sessions")
    .update({
      service_worker_payload: swPayload,
      total_students: students.length,
    })
    .eq("id", session_id);

  // 6. Actualizar estado del blueprint
  await supabase
    .from("exam_blueprints")
    .update({ status: "ready" })
    .eq("id", blueprint_id);

  const elapsed = Date.now() - startedAt;
  const success = instances.length;
  const failed  = errors.length;

  await cbfLog(supabase, {
    module: "EXAM", function_name: "exam-instance-generator",
    message: `Generación completa: ${success} instancias OK, ${failed} errores. ${elapsed}ms`,
    severity: failed > 0 ? "warn" : "info",
    payload_out: { success, failed, elapsed_ms: elapsed, errors },
  });

  // 7. Notificar si hay errores
  if (failed > 0) {
    const sectionInfo = students[0]?.section ? ` · Sección: ${students[0].section}` : '';
    await notifyTelegram(
      `⚠️ GENERACIÓN CON ERRORES\n` +
      `Sesión: ${session_id}${sectionInfo}\n` +
      `✅ ${success} instancias OK\n` +
      `❌ ${failed} fallidas\n` +
      `Tiempo: ${elapsed}ms`
    );
  }

  if (elapsed > 15000) {
    await cbfLog(supabase, {
      module: "EXAM", function_name: "exam-instance-generator",
      message: `Generación lenta: ${elapsed}ms`,
      severity: "warn", error_code: "CBF-EXAM-GEN-002",
    });
  }

  return {
    ok: failed === 0,
    instances_created: success,
    instances_failed: failed,
    versions_generated: version_count,
    elapsed_ms: elapsed,
    errors,
  };
}

// ─── Generación de una versión via Claude ─────────────────────

async function generateVersion(
  blueprint: Blueprint,
  versionLabel: string,
  versionIndex: number,
  newsContext: string
): Promise<GeneratedQuestion[]> {
  const isModeloB = MODELO_B_SUBJECTS.includes(blueprint.subject.toLowerCase());
  const lang = isModeloB ? "English" : "Spanish";

  const prompt = buildGenerationPrompt(blueprint, versionLabel, versionIndex, newsContext, lang);

  const response = await fetch(CLAUDE_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude proxy error: ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text ?? "";

  return parseQuestions(text, blueprint);
}

// ─── Construcción del prompt ──────────────────────────────────

function buildGenerationPrompt(
  bp: Blueprint,
  versionLabel: string,
  versionIndex: number,
  newsContext: string,
  lang: string
): string {
  const sections = bp.sections
    .map((s, i) =>
      `Section ${i + 1}: "${s.name}" (skill: ${s.skill})
   - Question types: ${s.question_types.join(", ")}
   - Question count: ${s.question_count}
   - Points: ${s.points}
   - Instructions: ${s.instructions || "Standard"}
   - Biblical minimum: ${s.biblical_min_pct ?? 20}% of questions`
    )
    .join("\n\n");

  // Semilla de variación por versión — misma estructura, contextos distintos
  const variationHints = [
    "Use scenario A: classroom/school context. Choose characters named Sofía and Daniel.",
    "Use scenario B: community/neighborhood context. Choose characters named Valentina and Mateo.",
    "Use scenario C: nature/environment context. Choose characters named Isabella and Sebastián.",
    "Use scenario D: technology/future context. Choose characters named Luciana and Santiago.",
  ];

  return `You are an expert exam generator for Colegio Boston Flexible (CBF) in Barranquilla, Colombia.
Generate exam VERSION ${versionLabel} — a UNIQUE version with different passages, contexts, and scenarios from other versions.

${variationHints[versionIndex] ?? variationHints[0]}

━━━ BLUEPRINT ━━━
Subject: ${bp.subject}
Grade: ${bp.grade}
Period: ${bp.period}
Difficulty: ${bp.difficulty_profile}
Total points: ${bp.total_points}
Duration: ${bp.estimated_minutes} minutes
${bp.cefr_level ? `CEFR Level: ${bp.cefr_level}` : ""}

Learning objectives:
${bp.learning_objectives.map(o => `• ${o}`).join("\n")}

Skills targeted: ${bp.skills_targeted.join(", ")}
${bp.vocabulary_scope ? `\nVocabulary scope:\n${bp.vocabulary_scope}` : ""}
${bp.grammar_scope ? `\nGrammar scope:\n${bp.grammar_scope}` : ""}
${bp.content_topics.length ? `\nContent topics: ${bp.content_topics.join(", ")}` : ""}
${bp.biblical_connection ? `\nBiblical connection: ${bp.biblical_connection}` : ""}

━━━ SECTIONS TO GENERATE ━━━
${sections}

${newsContext ? `━━━ NEWS PROJECT CONTEXT ━━━\n${newsContext}\n` : ""}

━━━ GENERATION RULES ━━━
1. Language: Generate questions and answers in ${lang}.
2. VERSION UNIQUENESS: This is Version ${versionLabel}. Use DIFFERENT:
   - Reading passages (different texts, same topic)
   - Characters and names
   - Numerical values (if any)
   - Specific scenarios
   This prevents students from copying — adjacent students have different versions.
3. BIBLICAL REQUIREMENT: At least 20% of questions must connect to a biblical principle
   from Genesis 1:27-28a (TLA) — "AÑO DE LA PUREZA" theme.
4. rigor_level MUST be exactly one of: "strict" | "flexible" | "conceptual". No other values.
5. For multiple_choice: always provide 4 options (A, B, C, D) and correct_answer as the letter.
6. Points per question must sum exactly to ${bp.total_points}.
7. Context-unique questions: use the scenario hint above so answers differ by version.

━━━ OUTPUT FORMAT ━━━
Return ONLY a valid JSON array. No markdown, no explanation, no code fences.
Each question object:
{
  "id": "q_[section_index]_[question_index]",
  "section_id": "[section.id from blueprint]",
  "section_name": "[section name]",
  "skill": "[skill]",
  "question_type": "multiple_choice|short_answer|fill_blank|true_false|matching",
  "stem": "[question text]",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "correct_answer": "A|B|C|D",
  "points": [number],
  "rigor_level": "strict|flexible|conceptual",
  "content_type": "text|passage|image_description",
  "response_type": "selection|written|numeric",
  "instructions": "[optional section instructions]",
  "biblical": true|false,
  "order_position": [sequential number starting at 1]
}

For non-MC questions, omit "options" and "correct_answer".
Generate exactly ${bp.total_points > 0 ? "the required" : "20"} total points across all sections.`;
}

// ─── Parser de respuesta Claude ───────────────────────────────

function parseQuestions(text: string, blueprint: Blueprint): GeneratedQuestion[] {
  // Extraer JSON del texto (puede venir con markdown)
  let jsonText = text.trim();
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();
  const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
  if (arrayMatch) jsonText = arrayMatch[0];

  let questions: GeneratedQuestion[];
  try {
    questions = JSON.parse(jsonText);
  } catch {
    throw new Error("Claude no devolvió JSON válido para las preguntas");
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("Claude devolvió una lista vacía de preguntas");
  }

  // Sanitizar rigor_level
  const validRigor = ["strict", "flexible", "conceptual"];
  return questions.map((q, i) => ({
    ...q,
    rigor_level: validRigor.includes(q.rigor_level) ? q.rigor_level : "flexible",
    order_position: i + 1,
    id: q.id || `q_${i + 1}`,
  }));
}

// ─── Service Worker Payload ───────────────────────────────────

function buildServiceWorkerPayload(
  blueprint: Blueprint,
  versionQuestions: GeneratedQuestion[][],
  instances: { id: string; student: string; version: string }[]
): Record<string, unknown> {
  // El payload permite al Service Worker cargar el examen completo offline
  return {
    blueprint_title:    blueprint.title,
    subject:            blueprint.subject,
    grade:              blueprint.grade,
    estimated_minutes:  blueprint.estimated_minutes,
    total_points:       blueprint.total_points,
    // Mapa student_code → version_index (para offline assignment)
    student_version_map: Object.fromEntries(
      instances.map(inst => [inst.student, inst.version])
    ),
    // Preguntas por versión (el SW cachea todas para asignar offline)
    versions: VERSION_LABELS.slice(0, versionQuestions.length).map((label, i) => ({
      label,
      question_count: versionQuestions[i].length,
    })),
    generated_at: new Date().toISOString(),
    cache_version: 1,
  };
}

// ─── Contexto NEWS ────────────────────────────────────────────

function buildNewsContext(news: Record<string, unknown>): string {
  const ref = news.textbook_reference as Record<string, unknown> | null;
  return [
    `NEWS Project: ${news.title}`,
    `Skill: ${news.skill}`,
    ref?.book ? `Textbook: ${ref.book}` : "",
    ref?.units ? `Units: ${(ref.units as string[]).join(", ")}` : "",
    ref?.grammar ? `Grammar: ${(ref.grammar as string[]).join(", ")}` : "",
    ref?.vocabulary ? `Vocabulary: ${(ref.vocabulary as string[]).join(", ")}` : "",
    news.biblical_principle ? `Biblical principle: ${news.biblical_principle}` : "",
  ].filter(Boolean).join("\n");
}

// ─── Utilidades ───────────────────────────────────────────────

async function cbfLog(
  supabase: ReturnType<typeof createClient>,
  log: {
    module: string;
    function_name: string;
    message: string;
    severity: string;
    error_code?: string;
    payload_in?: unknown;
    payload_out?: unknown;
  }
) {
  try {
    await supabase.from("system_events").insert({
      module:      log.module,
      event_type:  log.function_name,
      severity:    log.severity,
      message:     log.message,
      metadata:    {
        error_code:  log.error_code,
        payload_in:  log.payload_in,
        payload_out: log.payload_out,
      },
    });
  } catch { /* no bloquear por error de log */ }
}

async function notifyTelegram(message: string) {
  try {
    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
      }
    );
  } catch { /* no bloquear por error de Telegram */ }
}

function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
