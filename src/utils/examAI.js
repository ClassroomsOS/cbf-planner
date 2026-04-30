// ── examAI.js ─────────────────────────────────────────────────────────────────
// AI functions for exam generation (CBF exam module).

import { callClaude } from './aiClient'
import { sanitizeAIInput } from './validationSchemas'

const _EXAM_BIBLICAL_KEYS = ['biblical_reflection','verse_analysis','principle_application']

function parseExamJSON(raw) {
  try { const p = JSON.parse(raw); if (p && Array.isArray(p.questions)) return p } catch { /* not valid JSON, try regex */ }
  const match = raw.match(/\{[\s\S]*\}/)
  if (match) {
    try { const p = JSON.parse(match[0]); if (p && Array.isArray(p.questions)) return p } catch { /* not valid JSON */ }
  }
  if (raw.includes('"questions"')) {
    throw new Error('La respuesta de la IA fue cortada. Reduce el número de preguntas e intenta de nuevo.')
  }
  throw new Error('Error al procesar la respuesta de la IA. Intenta de nuevo.')
}

function buildExamPrompt({ subject, grade, indicator, biblicalContext, syllabusTopics, typeCounts, lang, batchLabel, startPos, sectionName, examType, examPreset }) {
  const total      = Object.values(typeCounts).reduce((s, v) => s + v, 0)
  const hasBiblical = _EXAM_BIBLICAL_KEYS.some(k => (typeCounts[k] || 0) > 0)

  const distLines = Object.entries(typeCounts)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `  ${v} × ${k}`)
    .join('\n')

  return `Diseña ${batchLabel} — Colegio Boston Flexible, Colombia (escala 1.0–5.0).
MATERIA: ${sanitizeAIInput(subject)} | GRADO: ${sanitizeAIInput(grade)} | IDIOMA: ${lang}${sectionName ? `\n📌 SECCIÓN: "${sanitizeAIInput(sectionName)}" — las preguntas deben enfocarse en el tema de esta sección.` : ''}

🎯 INDICADOR DE LOGRO EVALUADO:
"${sanitizeAIInput(indicator?.text || 'Contenidos del período')}"
Dimensión: ${indicator?.dimension || 'cognitivo'} | Habilidad: ${indicator?.skill_area || 'general'}

📚 TEMAS DEL SYLLABUS:
${(syllabusTopics || []).slice(0, 6).map(t => `• ${sanitizeAIInput(String(t.content || t))}`).join('\n') || '• Contenidos del período evaluado'}
${examType === 'final' ? `
📋 TIPO: EXAMEN FINAL DEL PERÍODO
- Este es un examen comprehensivo del período completo
- Las preguntas deben cubrir todos los temas del syllabus de forma equilibrada
- Las preguntas bíblicas deben apuntar a pensamiento crítico y argumentación, NO memoria
- Incluir una pregunta reflexiva como última pregunta
- Total esperado: ${examPreset?.baseQuestions || ''} preguntas base${examPreset?.hasExtraPoints ? ' + 5 Extra Points de listening' : ''}${examPreset?.requiredComponents ? `\n- Componentes requeridos: ${examPreset.requiredComponents.join(', ')}` : ''}` : `
📝 TIPO: QUIZ (EVALUACIÓN PARCIAL)
- Evaluación parcial enfocada en temas específicos recientes
- Preguntas directas y concisas
- Las preguntas bíblicas apuntan a aplicación práctica`}
${hasBiblical ? `
✝️ PRINCIPIO BÍBLICO (obligatorio en preguntas bíblicas):
Principio: "${sanitizeAIInput(biblicalContext?.principle || '')}"
Versículo: ${sanitizeAIInput(biblicalContext?.verse_ref || '')}
Reflexión esperada: "${sanitizeAIInput(biblicalContext?.reflection || '')}"` : ''}

DISTRIBUCIÓN EXACTA — ${total} preguntas (posiciones ${startPos}–${startPos + total - 1}):
${distLines}

INSTRUCCIONES POR TIPO (usar question_type exacto):
IMPORTANTE — rigor_level SOLO puede ser uno de estos tres valores exactos: "strict" | "flexible" | "conceptual". Cualquier otro valor rompe la base de datos.
• multiple_choice → options:["A) txt","B) txt","C) txt","D) txt"], correct_answer:"A"|"B"|"C"|"D", criteria:null, points:2
• true_false → options:["Verdadero","Falso"], correct_answer:"Verdadero"|"Falso", criteria:null, points:1
• fill_blank → stem con ___ donde va la respuesta, correct_answer:"texto exacto", criteria:{model_answer,key_concepts,bloom_level,rigor_level:"flexible"}, points:2
• matching → options:{"col_a":["t1","t2","t3"],"col_b":["d1","d2","d3"]}, correct_answer:{"t1":"d1","t2":"d2","t3":"d3"}, criteria:null, points:3
• short_answer → criteria:{model_answer,key_concepts,bloom_level:"apply",rigor_level:"flexible"}, points:3
• error_correction → stem contiene texto con errores intencionados, correct_answer:"versión corregida completa", criteria:{model_answer,key_concepts,bloom_level:"analyze",rigor_level:"strict"}, points:3
• sequencing → options:["pasoB","pasoA","pasoD","pasoC"] (desordenados), correct_answer:["pasoA","pasoB","pasoC","pasoD"] (orden correcto), criteria:null, points:3
• open_development → criteria:{model_answer,key_concepts,bloom_level:"evaluate",rigor_level:"conceptual"}, points:5
• biblical_reflection → pregunta abierta sobre cómo el principio/versículo aplica a la vida, criteria:{model_answer,key_concepts,bloom_level:"apply",rigor_level:"flexible"}, points:4
• verse_analysis → analiza el significado profundo del versículo en el contexto de la materia, criteria:{model_answer,key_concepts,bloom_level:"analyze",rigor_level:"conceptual"}, points:4
• principle_application → presenta una situación concreta y pide aplicar el principio bíblico, criteria:{model_answer,key_concepts,bloom_level:"evaluate",rigor_level:"flexible"}, points:4

RESPONDE SOLO JSON VÁLIDO — sin markdown, sin texto adicional:
{"title":"…","instructions":"…","questions":[{"position":${startPos},"stem":"…","question_type":"…","points":N,"options":…,"correct_answer":…,"criteria":…},…]}

REGLA CRÍTICA: Genera EXACTAMENTE ${total} preguntas con los tipos indicados. SOLO JSON.`
}

// ── Private: generate one section (handles single/multi-batch internally) ─────
async function generateSingleSection({
  subject, grade, indicator, biblicalContext, syllabusTopics,
  typeCounts, lang, system, sectionName, examType, examPreset,
}) {
  const total = Object.values(typeCounts).reduce((s, v) => s + v, 0)
  const BATCH_SIZE = 25

  if (total <= BATCH_SIZE) {
    const msg = buildExamPrompt({
      subject, grade, indicator, biblicalContext, syllabusTopics,
      typeCounts, lang, sectionName, examType, examPreset,
      batchLabel: `un examen completo de ${total} preguntas`,
      startPos: 1,
    })
    const raw = await callClaude({ type: 'exam_generate', system, message: msg, maxTokens: 9000 })
    const parsed = parseExamJSON(raw)
    if (!parsed.questions.length) throw new Error('El examen no contiene preguntas. Intenta de nuevo.')
    return parsed
  }

  // Multi-batch (>25): biblical always in batch 1
  const biblicalTypes = {}
  const academicTypes = {}
  for (const [k, v] of Object.entries(typeCounts)) {
    if (v <= 0) continue
    if (_EXAM_BIBLICAL_KEYS.includes(k)) biblicalTypes[k] = v
    else academicTypes[k] = v
  }

  const academicTotal = Object.values(academicTypes).reduce((s, v) => s + v, 0)
  const half1 = Math.ceil(academicTotal / 2)
  const half2 = academicTotal - half1

  function splitAcademic(target) {
    const entries = Object.entries(academicTypes).filter(([,v]) => v > 0)
    const result = {}
    let placed = 0
    for (const [k, v] of entries) {
      const share = Math.round((v / academicTotal) * target)
      result[k] = share
      placed += share
    }
    const diff = target - placed
    if (diff !== 0 && entries.length) result[entries[0][0]] = (result[entries[0][0]] || 0) + diff
    return result
  }

  const b1Types = { ...splitAcademic(half1), ...biblicalTypes }
  const b2Types = { ...splitAcademic(half2) }
  const b1Total = Object.values(b1Types).reduce((s, v) => s + v, 0)

  const [raw1, raw2] = await Promise.all([
    callClaude({
      type: 'exam_generate', system, maxTokens: 9000,
      message: buildExamPrompt({
        subject, grade, indicator, biblicalContext, syllabusTopics,
        typeCounts: b1Types, lang, sectionName, examType, examPreset,
        batchLabel: `la primera parte del examen (${b1Total} preguntas, incluye preguntas bíblicas)`,
        startPos: 1,
      }),
    }),
    callClaude({
      type: 'exam_generate', system, maxTokens: 9000,
      message: buildExamPrompt({
        subject, grade, indicator, biblicalContext: null, syllabusTopics,
        typeCounts: b2Types, lang, sectionName, examType, examPreset,
        batchLabel: `la segunda parte del examen (${Object.values(b2Types).reduce((s,v)=>s+v,0)} preguntas, continuación)`,
        startPos: b1Total + 1,
      }),
    }),
  ])

  const p1 = parseExamJSON(raw1)
  const p2 = parseExamJSON(raw2)
  const merged = [
    ...p1.questions,
    ...p2.questions.map((q, i) => ({ ...q, position: p1.questions.length + i + 1 })),
  ]
  if (!merged.length) throw new Error('No se generaron preguntas. Intenta de nuevo.')
  return { title: p1.title || p2.title || '', instructions: p1.instructions || '', questions: merged }
}

// ── generateExamQuestions ─────────────────────────────────────────────────────
// Generates a CBF exam with pedagogical context, 11 question types, and
// mandatory biblical principle questions (min 3).
// Returns: { title, instructions, questions: [...] }
export async function generateExamQuestions({
  subject, grade,
  indicator,        // { text, dimension, skill_area }
  biblicalContext,  // { principle, verse_ref, reflection }
  syllabusTopics,   // [{ week, content }] or [string]
  sections,         // [{ id, name, types }] — preferred
  questionTypes,    // legacy flat object — used if sections not provided
  additionalContext,// optional extra text appended to indicator
  examType,         // 'quiz' | 'final'
  examPreset,       // preset object from EXAM_PRESETS
}) {
  const isEnglish = ['Language Arts','Social Studies','Science','Lingua Skill'].includes(subject)
  const lang = isEnglish ? 'English' : 'español'

  const system = `Eres un experto en diseño de evaluaciones para educación básica y media colombiana (Colegio Boston Flexible).
Diseñas exámenes pedagógicamente sólidos según la Taxonomía de Bloom, conectados al indicador de logro y al principio bíblico institucional.
SIEMPRE responde con JSON válido, sin markdown ni texto extra.`

  const enrichedIndicator = additionalContext
    ? { ...indicator, text: [indicator?.text, additionalContext].filter(Boolean).join('\n') }
    : indicator

  // Normalize: sections array takes precedence over legacy questionTypes
  const secList = sections
    ? sections.filter(s => Object.values(s.types || {}).reduce((a, b) => a + b, 0) > 0)
    : [{ id: 1, name: '', types: questionTypes || {} }]

  if (secList.length === 0) throw new Error('Agrega al menos una pregunta.')

  // ── Single section: use existing single/multi-batch logic ─────────────────
  if (secList.length === 1) {
    const sec = secList[0]
    const sectionName = sec.name || ''
    const result = await generateSingleSection({
      subject, grade, indicator: enrichedIndicator, biblicalContext, syllabusTopics,
      typeCounts: sec.types, lang, system, sectionName, examType, examPreset,
    })
    result.questions = result.questions.map(q => ({ ...q, section_name: sectionName }))
    return result
  }

  // ── Multiple sections: one generation call per section, then merge ─────────
  let allQuestions = []
  let titleResult = ''
  let instructionsResult = ''
  let posOffset = 0

  for (const sec of secList) {
    const sectionName = sec.name || ''
    const result = await generateSingleSection({
      subject, grade, indicator: enrichedIndicator, biblicalContext, syllabusTopics,
      typeCounts: sec.types, lang, system, sectionName, examType, examPreset,
    })
    const tagged = result.questions.map((q, i) => ({
      ...q,
      section_name: sectionName,
      position: posOffset + i + 1,
    }))
    if (!titleResult && result.title) titleResult = result.title
    if (!instructionsResult && result.instructions) instructionsResult = result.instructions
    allQuestions = [...allQuestions, ...tagged]
    posOffset += tagged.length
  }

  if (!allQuestions.length) throw new Error('No se generaron preguntas. Intenta de nuevo.')
  return { title: titleResult, instructions: instructionsResult, questions: allQuestions }
}
