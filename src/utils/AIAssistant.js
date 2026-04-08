// ── AIAssistant.js ────────────────────────────────────────────────────────────
// Central utility for all AI calls in CBF Planner.
// Calls the Supabase Edge Function (claude-proxy) — API key stays on the server.

import { supabase } from '../supabase'
import { sanitizeAIInput } from './validationSchemas'
import { MODELO_B_SUBJECTS } from './constants'

// ── AI context (set once at login) ───────────────────────────────────────────
// schoolId + teacherId needed for usage logging and limit enforcement.
let _aiSchoolId   = null
let _aiTeacherId  = null
let _aiMonthLimit = 0   // 0 = unlimited

export function setAIContext({ schoolId, teacherId, monthlyLimit = 0 }) {
  _aiSchoolId   = schoolId
  _aiTeacherId  = teacherId
  _aiMonthLimit = monthlyLimit || 0
}

// Pricing: claude-sonnet-4 (approximate, $/token)
const COST_INPUT  = 3  / 1_000_000   // $3 per million input tokens
const COST_OUTPUT = 15 / 1_000_000   // $15 per million output tokens

// ── Normalize SmartBlock data returned by AI ─────────────────────────────────
// Fixes common structural variations so stored blocks always use canonical keys.
function normalizeSmartBlock(block) {
  if (!block?.data) return block
  const { type, data } = block

  if (type === 'VOCAB') {
    // Try every key the AI might use for the words array
    const raw = data.words || data.vocabulary || data.word_list || data.items
      || data.terms || data.vocab || data.vocabulary_list || []
    block.data.words = (Array.isArray(raw) ? raw : []).map(wd => {
      if (typeof wd === 'string') return { w: wd, d: '', e: '' }
      return {
        w: wd.w || wd.term        || wd.word    || wd.en          || wd.english || '',
        d: wd.d || wd.definition  || wd.meaning || wd.desc        || wd.spanish || '',
        e: wd.e || wd.example     || wd.context || wd.in_context  || wd.sentence || '',
      }
    })
  }

  if (type === 'QUIZ') {
    if (Array.isArray(data.topics)) {
      // Convert topic objects to plain strings
      block.data.topics = data.topics
        .filter(Boolean)
        .map(t => typeof t === 'string' ? t : (t.topic || t.name || t.text || t.item || t.title || ''))
        .filter(Boolean)
    } else if (typeof data.topics !== 'string') {
      block.data.topics = ''
    }
  }

  return block
}

// ── Core caller ───────────────────────────────────────────────────────────────
async function callClaude({ type, system, message, planId, maxTokens }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa.')

  // ── Check monthly token limit ─────────────────────────────
  if (_aiMonthLimit > 0 && _aiTeacherId) {
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
    const { data: rows } = await supabase
      .from('ai_usage')
      .select('input_tokens, output_tokens')
      .eq('teacher_id', _aiTeacherId)
      .gte('created_at', start)
      .lt('created_at', end)
    const used = (rows || []).reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0)
    if (used >= _aiMonthLimit) {
      throw new Error(`Límite mensual de IA alcanzado (${_aiMonthLimit.toLocaleString()} tokens). Habla con el coordinador.`)
    }
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-proxy`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        type,
        system,
        message,
        plan_id:    planId    || null,
        max_tokens: maxTokens || 2000,
      }),
    }
  )

  const text = await response.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Error del servidor de IA: ${text.slice(0, 120)}`)
  }
  if (data.error) throw new Error(data.error)

  // ── Log usage to ai_usage (fire & forget) ────────────────
  if (data.usage && _aiSchoolId && _aiTeacherId) {
    const inp = data.usage.input_tokens  || 0
    const out = data.usage.output_tokens || 0
    supabase.from('ai_usage').insert({
      school_id:     _aiSchoolId,
      teacher_id:    _aiTeacherId,
      type:          type || 'unknown',
      input_tokens:  inp,
      output_tokens: out,
      cost_usd:      parseFloat((inp * COST_INPUT + out * COST_OUTPUT).toFixed(6)),
    }).then(() => {})
  }

  return data.text || ''
}

// ── JSON array extractor — handles markdown fences and surrounding text ────────
function extractJSONArray(text) {
  if (!text) return null
  // Try direct parse first
  try { const p = JSON.parse(text); if (Array.isArray(p)) return p } catch {}
  // Extract first [...] block from the response
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return null
  try { const p = JSON.parse(match[0]); if (Array.isArray(p)) return p } catch {}
  return null
}

// ── Verse formatter ───────────────────────────────────────────────────────────
function fmtVerse(verse) {
  if (!verse?.text) return null
  const text = verse.text.replace(/<[^>]+>/g, '').trim()
  if (!text) return null
  return verse.ref ? `"${text}" — ${verse.ref}` : `"${text}"`
}

// ── Biblical principles block ─────────────────────────────────────────────────
// principles = { yearVerse: {text, ref}, monthVerse: {text, ref}, indicatorPrinciple: string }
// Injected into every AI prompt. All three are non-negotiable.
function biblicalBlock(principles, specificInstruction) {
  const year  = fmtVerse(principles?.yearVerse)
  const month = fmtVerse(principles?.monthVerse)
  const indic = principles?.indicatorPrinciple?.trim()
  if (!year && !month && !indic) return ''
  const lines = []
  if (year)  lines.push(`📖 Versículo del Año:        ${year}`)
  if (month) lines.push(`🗓 Versículo del Mes:        ${month}`)
  if (indic) lines.push(`✝️  Principio del Indicador: "${indic}"`)
  return `
⛪ PRINCIPIO RECTOR — ESCUELA CRISTIANA CONFESIONAL:
Este colegio es una institución cristiana confesional. TODO el aprendizaje, toda actividad,
todo logro y toda evaluación giran en torno a estos principios. No son opcionales ni decorativos
— son la razón de ser de la institución y el norte de toda planificación.
${lines.join('\n')}
${specificInstruction}`
}

// ── Punto 1: Sugerir actividad para una sección ───────────────────────────────
export async function suggestSectionActivity({
  section, grade, subject, objective, unit, dayName, existingContent, planId, learningTarget, principles
}) {
  const SECTION_LIMITS = {
    'SUBJECT TO BE WORKED': '1 oración. Enuncia el tema o habilidad del día.',
    'MOTIVATION':           '1-2 oraciones. Describe la actividad de enganche (pregunta, juego corto, imagen, reto).',
    'ACTIVITY':             '2-3 oraciones. Instrucción clara de la actividad práctica con un ejemplo concreto.',
    'SKILL DEVELOPMENT':    '3-4 oraciones. Paso a paso de la actividad principal. Esta es la sección más importante.',
    'CLOSING':              '1 oración. Pregunta de reflexión que conecte el aprendizaje del día con el principio bíblico del período.',
    'ASSIGNMENT':           '1 oración. Tarea específica y alcanzable.',
  }
  const limit = SECTION_LIMITS[section.label] || '2-3 oraciones.'

  const isClosing = section.label === 'CLOSING'

  const system = `Eres un asistente pedagógico experto para colegios bilingües colombianos.
Generas sugerencias de actividades para guías de aprendizaje autónomo (CBF).
Respondes SIEMPRE en español, con actividades concretas, prácticas y apropiadas para el nivel.
Formato: texto corrido, listo para pegar en la guía. Sin listas, sin viñetas, sin markdown.
LÍMITE ESTRICTO para esta sección: ${limit}
${learningTarget ? `
IMPORTANTE: Esta guía tiene un OBJETIVO DE DESEMPEÑO vinculado. Tu sugerencia DEBE estar alineada
a este desempeño observable. No generes actividades genéricas — genera actividades que lleven
al estudiante a demostrar este desempeño específico.` : ''}
${biblicalBlock(principles, isClosing
  ? 'La sección CLOSING SIEMPRE debe cerrar con una pregunta o reflexión que conecte lo aprendido con este principio bíblico. Es el momento de integración fe-aprendizaje.'
  : 'Ten presente este principio al diseñar la actividad. Cuando sea natural y auténtico, intégralo. No lo fuerces artificialmente, pero nunca lo ignores.'
)}`

  const TAXONOMY_DESC = { recognize: 'Reconocer (identificar, recordar, nombrar)', apply: 'Aplicar (usar, demostrar, resolver)', produce: 'Producir (crear, diseñar, componer)' }

  // Sanitize user inputs to prevent prompt injection
  const safeGrade = sanitizeAIInput(grade || '')
  const safeSubject = sanitizeAIInput(subject || '')
  const safeDayName = sanitizeAIInput(dayName || '')
  const safeUnit = sanitizeAIInput(unit || '')
  const safeObjective = sanitizeAIInput(objective || '')
  const safeExisting = existingContent ? sanitizeAIInput(existingContent.replace(/<[^>]+>/g,' ').slice(0,200)) : ''
  const safeLTDesc = learningTarget?.description ? sanitizeAIInput(learningTarget.description) : ''

  const message = `Estoy escribiendo la sección "${section.label}" de una guía de aprendizaje.

Contexto:
- Grado: ${safeGrade}
- Materia: ${safeSubject}
- Día: ${safeDayName}
- Unidad/Tema: ${safeUnit || 'No especificado'}
- Objetivo de la semana: ${safeObjective || 'No especificado'}
- Tiempo estimado de esta sección: ${section.time}
${learningTarget ? `
🎯 OBJETIVO DE DESEMPEÑO VINCULADO:
- Desempeño: ${safeLTDesc}
- Nivel taxonómico: ${TAXONOMY_DESC[learningTarget.taxonomy] || learningTarget.taxonomy}
- La actividad debe contribuir directamente a que el estudiante logre este desempeño.` : ''}
${existingContent ? `- Lo que ya tengo escrito: "${safeExisting}"` : ''}

Sugiere una actividad para "${section.label}". Respeta el límite: ${limit}`

  return callClaude({ type: 'suggest', system, message, planId })
}

// ── Punto 1b: Sugerir SmartBlock para una sección ────────────────────────────
export async function suggestSmartBlock({
  sectionMeta, grade, subject, objective, unit, dayName,
  existingContent, existingBlocks, learningTarget, planId, principles
}) {
  const TAXONOMY_DESC = { recognize: 'Reconocer', apply: 'Aplicar', produce: 'Producir' }

  const blockTypes = `Usa EXACTAMENTE esta estructura JSON según el tipo. NO inventes campos nuevos.

VOCAB cards: {"type":"VOCAB","model":"cards","data":{"words":[{"w":"habitat","d":"natural home of organism","e":"Bears live in forest habitats"},{"w":"ecosystem","d":"community of living things","e":"A pond is a small ecosystem"}]}}
VOCAB matching: {"type":"VOCAB","model":"matching","data":{"words":[{"w":"habitat","d":"natural home of organism","e":"Bears live in forest habitats"},{"w":"ecosystem","d":"community of living things","e":"A pond is a small ecosystem"}]}}
QUIZ topic-card: {"type":"QUIZ","model":"topic-card","data":{"date":"Friday","unit":"Unit 3","topics":["Subject-Verb Agreement","Simple Present vs Present Continuous","Vocabulary: ecosystem terms"]}}
QUIZ format-box: {"type":"QUIZ","model":"format-box","data":{"date":"Friday","unit":"Unit 3","topics":["Grammar: 20 pts","Vocabulary: 30 pts","Reading: 50 pts"],"format":"Written test","note":"Bring dictionary"}}
DICTATION word-grid: {"type":"DICTATION","model":"word-grid","data":{"words":["habitat","ecosystem","producer","consumer","decomposer"],"instructions":"Listen and write each word in the correct column."}}
GRAMMAR fill-blank: {"type":"GRAMMAR","model":"fill-blank","data":{"grammar_point":"Simple Present","instructions":"Complete with the correct form.","sentences":[{"sent":"Producers ___ their own food.","answer":"make"},{"sent":"The sun ___ energy to plants.","answer":"gives"}]}}
READING comprehension: {"type":"READING","model":"comprehension","data":{"passage":"Rainforests cover 6% of Earth...","questions":[{"q":"What percentage of Earth do rainforests cover?","lines":2},{"q":"Name two animals from the text.","lines":2}]}}
READING true-false: {"type":"READING","model":"true-false","data":{"passage":"Rainforests cover 6% of Earth...","statements":[{"s":"Rainforests cover more than 10% of Earth."},{"s":"Many species live in rainforests."}]}}
EXIT_TICKET can-do: {"type":"EXIT_TICKET","model":"can-do","data":{"skills":["I can identify producers and consumers","I can explain the food chain","I can use ecosystem vocabulary"]}}
WORKSHOP stations: {"type":"WORKSHOP","model":"stations","data":{"stations":[{"name":"Reading","time":"10 min","desc":"Read the text and highlight key terms"},{"name":"Writing","time":"10 min","desc":"Answer the comprehension questions"}]}}
SPEAKING rubric: {"type":"SPEAKING","model":"rubric","data":{"criteria":[{"name":"Pronunciation","pts":10},{"name":"Fluency","pts":10},{"name":"Content","pts":10}]}}
NOTICE banner: {"type":"NOTICE","model":"banner","data":{"title":"Important","message":"Bring your textbook tomorrow","icon":"📢","priority":"info"}}
WRITING guided: {"type":"WRITING","model":"guided","data":{"prompt":"Write a paragraph about a time you helped someone.","sentence_starters":["One time, I helped…","I decided to… because…"],"checklist":["I used past tense","I included a conclusion"]}}
WRITING free: {"type":"WRITING","model":"free","data":{"topic":"My favorite place in Colombia","word_count":"80–100 words","instructions":"Use present tense"}}
SELF_ASSESSMENT checklist: {"type":"SELF_ASSESSMENT","model":"checklist","data":{"skills":["use past tense to describe events","understand the main idea of a text","write a coherent paragraph"]}}
SELF_ASSESSMENT reflection: {"type":"SELF_ASSESSMENT","model":"reflection","data":{"questions":["What was the most challenging part of today?","What strategy helped you most?"]}}
PEER_REVIEW rubric: {"type":"PEER_REVIEW","model":"rubric","data":{"criteria":[{"name":"Content & Ideas","pts":"10"},{"name":"Language Use","pts":"10"},{"name":"Organization","pts":"10"}]}}
PEER_REVIEW stars: {"type":"PEER_REVIEW","model":"stars","data":{"stars_prompt":"What did your peer do well?","wishes_prompt":"What could your peer improve?"}}
DIGITAL_RESOURCE link: {"type":"DIGITAL_RESOURCE","model":"link","data":{"title":"Khan Academy — Present Perfect","url":"https://www.khanacademy.org","instructions":"Watch the video and take notes on the 3 main uses."}}
DIGITAL_RESOURCE platform: {"type":"DIGITAL_RESOURCE","model":"platform","data":{"platform_name":"Cambridge One","activity":"Unit 4 — Listening Practice (15 min)","instructions":"Take a screenshot of your score when done."}}
COLLABORATIVE_TASK jigsaw: {"type":"COLLABORATIVE_TASK","model":"jigsaw","data":{"groups":[{"name":"Expert Group A","topic":"Causes of climate change"},{"name":"Expert Group B","topic":"Effects on ecosystems"},{"name":"Expert Group C","topic":"Possible solutions"}]}}
COLLABORATIVE_TASK think_pair: {"type":"COLLABORATIVE_TASK","model":"think_pair","data":{"prompt":"Think of a situation in your daily life where you use English.","pair_time":"3 min","share_time":"5 min"}}
REAL_LIFE_CONNECTION scenario: {"type":"REAL_LIFE_CONNECTION","model":"scenario","data":{"context":"Imagine you are applying for a part-time job at a local café.","questions":["What skills would you need?","How would you describe yourself in English?"]}}
REAL_LIFE_CONNECTION connection: {"type":"REAL_LIFE_CONNECTION","model":"connection","data":{"prompt":"Think of a situation in your daily life where you could use today's grammar.","example":"When I go shopping, I could say…"}}
TEACHER_NOTE observation: {"type":"TEACHER_NOTE","model":"observation","data":{"note":"Model the process before students work in pairs. Nivel Azul may use dictionary.","for_level":"all"}}
TEACHER_NOTE adaptation: {"type":"TEACHER_NOTE","model":"adaptation","data":{"adaptations":[{"student":"Nivel Azul","note":"Use bilingual dictionary and sentence frames"},{"student":"Nivel Rojo","note":"Extension: write a second paragraph"}]}}`

  const taxonomy = learningTarget?.taxonomy
  const taxHint = taxonomy === 'recognize'
    ? 'Nivel RECONOCER: prefiere VOCAB matching, QUIZ topic-card, READING true-false, SELF_ASSESSMENT checklist.'
    : taxonomy === 'apply'
    ? 'Nivel APLICAR: prefiere DICTATION, GRAMMAR fill-blank, WORKSHOP stations, READING comprehension, COLLABORATIVE_TASK, REAL_LIFE_CONNECTION.'
    : taxonomy === 'produce'
    ? 'Nivel PRODUCIR: prefiere SPEAKING rubric, WRITING guided, PEER_REVIEW rubric, EXIT_TICKET can-do, WORKSHOP roles.'
    : ''

  const system = `Eres un experto pedagógico para colegios bilingües colombianos (metodología CBF).
Tu tarea: sugerir UN SmartBlock apropiado para una sección de guía.
Responde SOLO con JSON válido. Sin markdown, sin texto adicional.
Estructura exacta: {"type":"...","model":"...","data":{...}}
Los datos deben estar en inglés (colegio bilingüe) y ser realistas y listos para usar.
${taxHint}
${biblicalBlock(principles,
  'Cuando el tipo de bloque lo permita de manera natural (especialmente READING, EXIT_TICKET, SPEAKING, NOTICE), el contenido puede reflejar o conectar con el principio bíblico del período. No lo fuerces en todos los bloques — solo cuando enriquezca genuinamente la actividad.'
)}`

  // Sanitize user inputs
  const safeGrade = sanitizeAIInput(grade || '')
  const safeSubject = sanitizeAIInput(subject || '')
  const safeDayName = sanitizeAIInput(dayName || '')
  const safeUnit = sanitizeAIInput(unit || '')
  const safeObjective = sanitizeAIInput(objective || '')
  const safeLTDesc = learningTarget?.description ? sanitizeAIInput(learningTarget.description) : ''
  const safeExisting = existingContent ? sanitizeAIInput(existingContent.replace(/<[^>]+>/g,' ').slice(0,200)) : '(vacío)'

  const ALL_TYPES = [
    'DICTATION','QUIZ','VOCAB','WORKSHOP','SPEAKING','NOTICE',
    'READING','GRAMMAR','EXIT_TICKET',
    'WRITING','SELF_ASSESSMENT','PEER_REVIEW','DIGITAL_RESOURCE',
    'COLLABORATIVE_TASK','REAL_LIFE_CONNECTION','TEACHER_NOTE',
  ]
  const existingTypes = new Set((existingBlocks || []).map(b => b.type))
  const availableTypes = ALL_TYPES.filter(t => !existingTypes.has(t))
  const noRepeatRule = existingTypes.size
    ? `REGLA OBLIGATORIA: Ya existen bloques de tipo ${[...existingTypes].join(', ')}. Debes elegir ÚNICAMENTE entre estos tipos disponibles: ${availableTypes.join(', ')}. NO uses ningún otro tipo.`
    : ''

  const message = `Sección: ${sectionMeta?.label} (${sectionMeta?.time})
Grado: ${safeGrade} | Materia: ${safeSubject} | Día: ${safeDayName || ''}
Unidad: ${safeUnit || 'no especificada'}
Objetivo semanal: ${safeObjective || 'no especificado'}
${learningTarget ? `Desempeño observable: ${safeLTDesc} (${TAXONOMY_DESC[learningTarget.taxonomy] || ''})` : ''}
Contenido ya escrito: ${safeExisting}
${noRepeatRule}

Tipos disponibles (copia el ejemplo exacto y reemplaza los datos):
${blockTypes}

Sugiere el bloque más pedagógicamente apropiado. Incluye datos completos y realistas en inglés.`

  const raw = await callClaude({ type: 'suggest', system, message, planId, maxTokens: 1200 })
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('La IA no devolvió un bloque válido.')
  try {
    return normalizeSmartBlock(JSON.parse(match[0].trim()))
  } catch {
    throw new Error('No se pudo leer el bloque sugerido.')
  }
}

// ── Punto 2: Análisis completo de la guía ────────────────────────────────────
export async function analyzeGuide(content, planId, principles) {
  const v = fmtVerse(principles?.monthVerse) || fmtVerse(content.verse)

  const pBlock = biblicalBlock(principles,
    'Evalúa específicamente qué tan bien la guía conectó el contenido académico con cada uno de estos principios.'
  )
  const system = `Eres un asesor pedagógico experto en diseño curricular para colegios bilingües colombianos.
Analizas guías de aprendizaje autónomo y das retroalimentación constructiva y específica.
Respondes en español. Sé directo, práctico y amable.
${pBlock}
Estructura tu respuesta con estas secciones exactas (usa estos emojis como títulos):
✅ Fortalezas
⚠️ Alertas
💡 Sugerencias
📊 Balance de tiempos
🙏 Integración del principio bíblico`

  const i = content.info    || {}
  const o = content.objetivo || {}
  const days = Object.entries(content.days || {})
    .filter(([,d]) => d.active !== false)
    .map(([iso, d]) => ({
      date: d.date_label || iso,
      unit: d.unit || '',
      sections: Object.entries(d.sections || {}).map(([key, s]) => ({
        name:    key,
        time:    s.time || '',
        content: (s.content || '').replace(/<[^>]+>/g,' ').slice(0, 300),
        hasSmartBlocks: (s.smartBlocks || []).length > 0,
        hasImages:      (s.images || []).length > 0,
      }))
    }))

  // Sanitize user inputs
  const safeGrado = sanitizeAIInput(i.grado || '')
  const safeAsignatura = sanitizeAIInput(i.asignatura || '')
  const safeSemana = sanitizeAIInput(i.semana || '')
  const safePeriodo = sanitizeAIInput(i.periodo || '')
  const safeFechas = sanitizeAIInput(i.fechas || '')
  const safeGeneral = sanitizeAIInput((o.general || '').replace(/<[^>]+>/g,' '))
  const safeIndicadores = (o.indicadores?.filter(Boolean) || (o.indicador ? [o.indicador] : []))
    .map(ind => sanitizeAIInput(ind.replace(/<[^>]+>/g,' ')))
    .join(' | ') || 'No especificado'
  const safePrincipio = sanitizeAIInput(o.principio || '')
  const safeDone = sanitizeAIInput((content.summary?.done || '').replace(/<[^>]+>/g,' ').slice(0,200))
  const safeNext = sanitizeAIInput((content.summary?.next || '').replace(/<[^>]+>/g,' ').slice(0,200))

  const message = `Analiza esta guía de aprendizaje:

ENCABEZADO:
- Grado: ${safeGrado} | Materia: ${safeAsignatura} | Semana: ${safeSemana}
- Período: ${safePeriodo} | Fechas: ${safeFechas}

LOGRO Y PRINCIPIO:
- Logro general: ${safeGeneral || 'No especificado'}
- Indicadores: ${safeIndicadores}
- Principio institucional: ${safePrincipio}

DÍAS Y ACTIVIDADES:
${days.map(d => `
📅 ${sanitizeAIInput(d.date)}${d.unit ? ` — ${sanitizeAIInput(d.unit)}` : ''}
${d.sections.map(s => `  [${s.name}] ${s.time}: ${sanitizeAIInput(s.content || '(vacío)')} ${s.hasSmartBlocks?'[+bloques]':''} ${s.hasImages?'[+imágenes]':''}`).join('\n')}`).join('\n')}

RESUMEN:
- Lo trabajado: ${safeDone || 'No especificado'}
- Próxima semana: ${safeNext || 'No especificado'}

Dame un análisis pedagógico completo. En la sección 🙏 evalúa específicamente: ¿en qué momentos la guía conectó con el principio bíblico? ¿Dónde se perdió esa oportunidad? ¿Cómo mejorar esa integración?`

  return callClaude({ type: 'analyze', system, message, planId, maxTokens: 4000 })
}

// ── Punto 3: Generar estructura completa desde objetivo ───────────────────────
export async function generateGuideStructure({
  grade, subject, objective, unit, activeDays, period, planId, learningTarget, activeNewsProject, principles
}) {
  const TAXONOMY_DESC = { recognize: 'Reconocer (identificar, recordar, nombrar)', apply: 'Aplicar (usar, demostrar, resolver)', produce: 'Producir (crear, diseñar, componer)' }
  const v = fmtVerse(principles?.monthVerse) || fmtVerse(principles?.yearVerse)

  const isEnglishSubject = MODELO_B_SUBJECTS.includes(subject)

  const PRAYER_TEXT = isEnglishSubject
    ? `<p>🙏 <em>Before starting the class, the teacher asks a student to give thanks to the Lord, because He is our guide and helps us understand our path.</em></p><p>The teacher then explains the class rules to the students, establishing what is allowed and what is not.</p>`
    : `<p>🙏 <em>Antes de iniciar la clase, el docente pide a un estudiante que dé gracias al Señor, porque Él es nuestro guía y nos ayuda a entender nuestro camino.</em></p><p>El docente luego recuerda a los estudiantes las normas de la clase, estableciendo qué está permitido y qué no.</p>`

  const CLASS_RULES = `<p><strong>📋 Class Rules:</strong></p><p>Rule 1: Listen when your teacher is talking<br>Rule 2: Follow directions quickly<br>Rule 3: Respect others. Respect yourself. Respect your school<br>Rule 4: Raise your hand to speak or stand<br>Rule 5: Be safe, Be kind, Be honest for the glory of God<br>Rule 6: Use English at all times, it is the only way to improve.<br>Rule 7: Do not translate what your teacher says, please.</p>`

  const pBlock = biblicalBlock(principles, `OBLIGATORIO — SIN EXCEPCIÓN:
- TODO el contenido de CADA sección de CADA día tiene orientación cristiana confesional.
  No importa qué tan secular sea el indicador o la materia — el enfoque bíblico es
  el NORTE INAMOVIBLE de esta institución y debe impregnar TODA la planificación.
- La sección CLOSING de CADA día DEBE terminar con una pregunta o reflexión que conecte
  lo aprendido ese día con estos principios. No como un añadido artificial, sino como
  el cierre natural de la experiencia de aprendizaje.
- La semana tiene un arco espiritual además del académico. El estudiante debe terminar
  la semana con una conexión más profunda entre su aprendizaje y su fe.`)

  const system = `Eres un experto en diseño de guías de aprendizaje autónomo para colegios bilingües colombianos CRISTIANOS CONFESIONALES.
Generas estructuras completas de guías semanales siguiendo el modelo CBF con 6 secciones por día.
MANDATO ABSOLUTO: Esta es una escuela cristiana. El enfoque bíblico es OBLIGATORIO en TODA sección,
sin importar la materia ni el indicador. Nunca generes contenido neutral o secular puro.

Secciones por día:
1. SUBJECT TO BE WORKED (~8 min): 1 oración que enuncia el tema o habilidad del día.
2. MOTIVATION (~8 min): 1-2 oraciones que describen la actividad de enganche (pregunta, juego corto, imagen, reto). NO incluyas reglas de clase ni textos de oración — eso se maneja por separado.

3. ACTIVITY (~15 min): actividad principal de práctica con conexión al valor cristiano del día
4. SKILL DEVELOPMENT (~40 min): desarrollo profundo de la habilidad — la sección más importante
5. CLOSING (~8 min): cierre con reflexión bíblica — SIEMPRE conecta con los principios rectores
6. ASSIGNMENT (~5 min): tarea o extensión
${pBlock}
${learningTarget ? `
PRINCIPIO PEDAGÓGICO CENTRAL:
Esta guía tiene un OBJETIVO DE DESEMPEÑO específico vinculado. Todo el contenido que generes
debe estar diseñado para que el estudiante progrese hacia ese desempeño observable.
Nivel taxonómico del objetivo: ${TAXONOMY_DESC[learningTarget.taxonomy] || learningTarget.taxonomy}.
- Si el nivel es "Reconocer": enfoca las actividades en identificación, clasificación, y recuerdo activo.
- Si el nivel es "Aplicar": enfoca en práctica guiada, resolución de problemas, y uso contextualizado.
- Si el nivel es "Producir": enfoca en creación, composición, y producción autónoma.
Las actividades deben progresar durante la semana HACIA el desempeño, no solo "cubrir el tema".` : ''}

Respondes ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown.
El JSON debe tener exactamente esta estructura:
{
  "days": {
    "YYYY-MM-DD": {
      "unit": "string",
      "sections": {
        "subject":    {"content": "string"},
        "motivation": {"content": "string"},
        "activity":   {"content": "string", "smartBlock": {"type":"...","model":"...","data":{}}},
        "skill":      {"content": "string", "smartBlock": {"type":"...","model":"...","data":{}}},
        "closing":    {"content": "string"},
        "assignment": {"content": "string"}
      }
    }
  },
  "objetivo": {
    "general":     "string",
    "indicadores": ["string"]
  },
  "summary": {
    "next": "string"
  }
}
El campo "smartBlock" es OPCIONAL y solo debe incluirse en las secciones "activity" y "skill" cuando
sea pedagógicamente relevante (máximo 1 bloque por sección, máximo 2 bloques por día).
Tipos de SmartBlock disponibles:
- VOCAB: cards {words:[{w,d,e}]} | matching {words:[{w,d,e}]}
- DICTATION: word-grid {words:string[],instructions:string} | sentences {words:string[],instructions:string}
- GRAMMAR: fill-blank {grammar_point,instructions,sentences:[{sent,answer}]} | choose {grammar_point,instructions,items:[{sentence,options:[],answer}]}
- READING: comprehension {passage,questions:[{q,lines}]} | true-false {passage,statements:[{s}]}
- SPEAKING: rubric {criteria:[{name,pts}],date?} | prep {steps:string[],date?}
- EXIT_TICKET: can-do {skills:string[],date?} | rating {statements:string[],date?}
- QUIZ: topic-card {unit,date,topics,note?} | format-box {unit,date,topics,format,note?}
- NOTICE: banner {title,message,icon} | alert {title,message,icon,priority}
Usa inglés en los datos del bloque (colegio bilingüe). Si no hay un bloque claramente apropiado para una sección, omite "smartBlock".`

  const daysStr = activeDays.map((iso, i) => {
    const d = new Date(iso + 'T12:00:00')
    const names = ['Lunes','Martes','Miércoles','Jueves','Viernes']
    return `Día ${i+1} (${names[d.getDay()-1]}, ${iso})`
  }).join(', ')

  // Sanitize user inputs
  const safeGrade = sanitizeAIInput(grade || '')
  const safeSubject = sanitizeAIInput(subject || '')
  const safePeriod = sanitizeAIInput(period || '')
  const safeUnit = sanitizeAIInput(unit || '')
  const safeObjective = sanitizeAIInput(objective || '')
  const safeLTDesc = learningTarget?.description ? sanitizeAIInput(learningTarget.description) : ''

  // Build NEWS project context block
  const np = activeNewsProject
  const newsBlock = np ? (() => {
    const lines = []
    if (np.title)       lines.push(`- Proyecto NEWS: "${sanitizeAIInput(np.title)}"`)
    if (np.description) lines.push(`- Descripción: ${sanitizeAIInput(np.description)}`)
    if (np.conditions)  lines.push(`- Condiciones de entrega: ${sanitizeAIInput(np.conditions)}`)
    if (np.due_date)    lines.push(`- Fecha de entrega: ${np.due_date}`)
    const tb = np.textbook_reference
    if (tb) {
      if (tb.book)        lines.push(`- Libro de texto: ${sanitizeAIInput(tb.book)}`)
      if (tb.units?.length) lines.push(`- Unidades: ${tb.units.map(u => sanitizeAIInput(u)).join(', ')}`)
      if (tb.grammar?.length) lines.push(`- Gramática: ${tb.grammar.map(g => sanitizeAIInput(g)).join(', ')}`)
      if (tb.vocabulary?.length) lines.push(`- Vocabulario: ${tb.vocabulary.map(v => sanitizeAIInput(v)).join(', ')}`)
    }
    if (np.competencias?.length) lines.push(`- Competencias: ${np.competencias.map(c => sanitizeAIInput(typeof c === 'string' ? c : c.nombre || '')).join(', ')}`)
    if (np.operadores_intelectuales?.length) lines.push(`- Operadores intelectuales: ${np.operadores_intelectuales.map(o => sanitizeAIInput(typeof o === 'string' ? o : o.nombre || '')).join(', ')}`)
    if (np.habilidades?.length) lines.push(`- Habilidades a desarrollar: ${np.habilidades.map(h => sanitizeAIInput(typeof h === 'string' ? h : h.nombre || '')).join(', ')}`)
    if (np.biblical_principle) lines.push(`- Principio bíblico del proyecto: ${sanitizeAIInput(np.biblical_principle)}`)
    if (np.biblical_reflection) lines.push(`- Reflexión bíblica requerida: ${sanitizeAIInput(np.biblical_reflection)}`)
    const acts = (np.actividades_evaluativas || []).filter(a => a.fecha)
    if (acts.length) {
      const daySet = new Set(activeDays)
      const thisWeek = acts.filter(a => daySet.has(a.fecha))
      const upcoming = acts.filter(a => !daySet.has(a.fecha) && a.fecha > (activeDays[activeDays.length - 1] || ''))
      if (thisWeek.length) lines.push(`- ⚠️ Actividades evaluativas ESTA SEMANA: ${thisWeek.map(a => `${a.nombre}${a.descripcion ? ' — ' + sanitizeAIInput(a.descripcion) : ''} (${a.fecha}${a.porcentaje ? ', ' + a.porcentaje + '%' : ''})`).join(' | ')}`)
      if (upcoming.length) lines.push(`- Próximas actividades: ${upcoming.map(a => `${a.nombre} (${a.fecha})`).join(', ')}`)
    }
    return lines.length ? `\n📋 CONTEXTO DEL PROYECTO NEWS (usa esto para alinear todo el contenido):\n${lines.join('\n')}` : ''
  })() : ''

  const message = `Genera una guía de aprendizaje completa con estos datos:

- Grado: ${safeGrade}
- Materia: ${safeSubject}
- Período: ${safePeriod}
- Unidad/Tema: ${safeUnit || 'No especificado'}
- Objetivo del docente: ${safeObjective}
- Días de clase ${activeDays.length > 5 ? 'estas dos semanas' : 'esta semana'}: ${daysStr}
${learningTarget ? `
🎯 OBJETIVO DE DESEMPEÑO VINCULADO:
- Desempeño observable: ${safeLTDesc}
- Nivel taxonómico: ${TAXONOMY_DESC[learningTarget.taxonomy] || learningTarget.taxonomy}
- TODA la semana debe construir hacia este desempeño. El viernes (o último día), el estudiante
  debería estar en capacidad de demostrar este desempeño.` : ''}
${newsBlock}

Genera contenido específico, concreto y apropiado para el nivel.
Las actividades deben progresar lógicamente durante la semana.
El contenido debe estar en el idioma apropiado para la materia (inglés para Language Arts, español para otras).
Usa texto plano, no HTML.

LÍMITES DE EXTENSIÓN POR SECCIÓN (sé conciso y específico):
- SUBJECT (~8 min): 1 oración clara que enuncia el tema o habilidad del día.
- MOTIVATION (~8 min): 1-2 oraciones que describen la actividad de enganche (pregunta, juego corto, imagen, reto).
- ACTIVITY (~15 min): 2-3 oraciones. Actividad práctica con conexión al valor cristiano.
- SKILL DEVELOPMENT (~40 min): 3-4 oraciones. Paso a paso de la actividad principal. La más importante.
- CLOSING (~8 min): 1 oración. Reflexión que conecte el aprendizaje con el principio bíblico del día.
- ASSIGNMENT (~5 min): 1 oración. Tarea específica y alcanzable.
No uses listas con viñetas dentro del contenido. Texto corrido, directo al punto.`

  const raw = await callClaude({ type: 'generate', system, message, planId, maxTokens: 16000 })

  // Try to parse JSON, if truncated retry once with concise instruction
  function tryParseJSON(text) {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0].trim())
    } catch {
      return null
    }
  }

  // Converts plain text to a <p> block; leaves existing HTML untouched
  function toHtml(text) {
    const t = (text || '').trim()
    if (!t) return ''
    return t.startsWith('<') ? t : `<p>${t}</p>`
  }

  // Strips any class rules the AI may have included (defensive, prevents duplicates)
  function stripRules(text) {
    if (!text) return ''
    return text
      .replace(/📋\s*Class Rules:?\s*/gi, '')
      .replace(/Rule\s+\d+\s*:[^\n<]*/gi, '')
      .replace(/,\s*(?=Rule\s+\d+)/gi, '')
      .replace(/^[\s,;.]+/, '')
      .trim()
  }

  // Strips any prayer/thanksgiving text the AI may have included (defensive)
  function stripPrayer(text) {
    if (!text) return ''
    return text
      .replace(/🙏[^\n<]*/gi, '')
      .replace(/before starting the class[^.]*\./gi, '')
      .replace(/the teacher (then )?explains the class rules[^.]*\./gi, '')
      .replace(/antes de iniciar la clase[^.]*\./gi, '')
      .replace(/el docente (luego )?recuerda[^.]*\./gi, '')
      .replace(/^[\s,;.]+/, '')
      .trim()
  }

  // Post-process: prepend fixed texts to whatever the AI generated
  function injectFixedTexts(parsed) {
    if (!parsed?.days) return parsed
    Object.values(parsed.days).forEach(day => {
      if (!day?.sections) return
      const subj = day.sections.subject
      if (subj) {
        const aiHtml = toHtml(stripPrayer(subj.content))
        subj.content = PRAYER_TEXT + (aiHtml ? aiHtml : '')
      }
      const motiv = day.sections.motivation
      if (motiv) {
        const aiHtml = toHtml(stripRules(motiv.content))
        motiv.content = CLASS_RULES + (aiHtml ? aiHtml : '')
      }
    })
    return parsed
  }

  const result = tryParseJSON(raw)
  if (result) return injectFixedTexts(result)

  // Retry: ask for more compact content
  const retryMessage = `${message}

IMPORTANTE: Tu respuesta anterior fue cortada. Sé más breve:
- SUBJECT: 1 oración con el tema del día. MOTIVATION: 1-2 oraciones con la actividad de enganche.
- CLOSING, ASSIGNMENT: 1 oración cada uno. ACTIVITY: 2 oraciones. SKILL DEVELOPMENT: 3 oraciones.
- Responde SOLO con el JSON, sin texto antes ni después.`

  const retryRaw = await callClaude({ type: 'generate', system, message: retryMessage, planId, maxTokens: 16000 })
  const retryResult = tryParseJSON(retryRaw)
  if (retryResult) return injectFixedTexts(retryResult)

  throw new Error(`No se pudo generar la guía. Intenta con menos días o un objetivo más específico.`)
}

// ── Punto 6: Generar rúbrica completa para proyecto NEWS ─────────────────────
// Genera criterios + 5 niveles por criterio basado en los indicadores de logro.
// levels[0]=score5 (Excellent) … levels[4]=score1 (Beginning)
export async function generateRubric({
  projectTitle, projectDescription, subject, grade, skill, indicadores, principles
}) {
  const system = `Eres un experto en evaluación educativa para colegios bilingües colombianos.
Diseñas rúbricas analíticas para proyectos NEWS. La rúbrica CBF tiene EXACTAMENTE 8 criterios × 5 niveles.

COMPOSICIÓN OBLIGATORIA (8 criterios exactos, en este orden):
1. Cognitivo 1 — Comprensión conceptual del tema central del proyecto
2. Cognitivo 2 — Aplicación y uso del conocimiento en el producto final
3. Cognitivo 3 — Análisis, argumentación o pensamiento crítico evidenciado
4. Comunicativo 1 — Claridad, precisión y coherencia en la expresión oral o escrita
5. Comunicativo 2 — Organización, estructura y presentación del trabajo
6. Actitudinal — Responsabilidad, participación activa y trabajo colaborativo
7. Bíblico/Valorativo — Integración del principio bíblico o versículo en el trabajo/reflexión
8. Técnico específico — Dominio del skill o habilidad técnica central de ESTE proyecto (p.ej. Speaking fluency, cálculo, interpretación de datos)

Cada criterio debe:
- Tener 5 niveles: Superior (5) / Alto (4) / Básico (3) / Bajo (2) / Muy Bajo (1)
- El nivel 5 = cumplimiento pleno del indicador (eso es el 100%)
- Descriptores observables, en inglés, tercera persona, verbos de acción, 1-2 oraciones por nivel
${biblicalBlock(principles,
  'El criterio 7 (Bíblico/Valorativo) DEBE conectar directamente con el principio del indicador o versículo recibido. Es tan evaluable como los criterios académicos.'
)}
Responde ÚNICAMENTE con JSON válido. Sin markdown, sin texto adicional.
Estructura exacta: [{"name":"string","desc":"string","levels":["nivel5","nivel4","nivel3","nivel2","nivel1"]},...]
GENERA EXACTAMENTE 8 OBJETOS en el array.`

  // Sanitize user inputs
  const safeTitle = sanitizeAIInput(projectTitle || 'Proyecto sin título')
  const safeDesc = sanitizeAIInput(projectDescription || 'Sin descripción')
  const safeSubject = sanitizeAIInput(subject || '')
  const safeGrade = sanitizeAIInput(grade || '')
  const safeSkill = skill ? sanitizeAIInput(skill) : ''
  const safeIndStr = (indicadores || [])
    .filter(Boolean)
    .map(ind => sanitizeAIInput(ind))
    .join('\n- ')

  const message = `Genera la rúbrica CBF (exactamente 8 criterios) para este proyecto NEWS:

Título: ${safeTitle}
Descripción: ${safeDesc}
Materia: ${safeSubject} | Grado: ${safeGrade}${safeSkill ? ` | Skill: ${safeSkill}` : ''}
${safeIndStr ? `\nIndicadores de logro (esto es el nivel 5 — el 100%):\n- ${safeIndStr}` : ''}

Recuerda: el criterio 8 (Técnico específico) debe evaluar la habilidad central de ESTE proyecto${safeSkill ? ` (${safeSkill})` : ''}.
Genera EXACTAMENTE 8 criterios en el orden indicado.`

  const raw = await callClaude({ type: 'generate_rubric', system, message, maxTokens: 4000 })
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('La IA no devolvió una rúbrica válida.')
  let parsed
  try { parsed = JSON.parse(match[0].trim()) } catch { throw new Error('No se pudo leer la rúbrica generada.') }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('La rúbrica generada está vacía.')
  if (parsed.length !== 8) throw new Error(`La rúbrica debe tener 8 criterios. La IA generó ${parsed.length}.`)
  // Ensure each criterion has exactly 5 levels
  return parsed.map(c => ({
    name:   c.name   || '',
    desc:   c.desc   || '',
    levels: Array.isArray(c.levels) ? [...c.levels, '', '', '', '', ''].slice(0, 5) : ['','','','',''],
  }))
}

// ── Punto 5: Generar indicadores de logro ────────────────────────────────────
// Modos de operación:
//   Modelo A + tematicaNames → 1 indicador string por Temática
//   Modelo A sin tematicaNames → 3 indicadores string genéricos (backward compat)
//   Modelo B (isModeloB=true) → 4 objetos {habilidad, texto_en, texto_es, principio_biblico}
export async function generateIndicadores({
  description, taxonomy, subject, grade, principles,
  tematicaNames, isModeloB
}) {
  const TAXONOMY_MAP = {
    recognize: 'Reconocer (identificar, recordar, nombrar, clasificar)',
    apply:     'Aplicar (usar, demostrar, resolver, ejecutar)',
    produce:   'Producir (crear, diseñar, componer, generar autónomamente)',
  }

  const safeDescription = sanitizeAIInput(description || '')
  const safeSubject     = sanitizeAIInput(subject || '')
  const safeGrade       = sanitizeAIInput(grade || '')

  // ── MODELO B ──────────────────────────────────────────────────────────────
  if (isModeloB) {
    const system = `Eres un experto en diseño curricular bilingüe (colombiano).
Diseñas indicadores de logro para materias en inglés (Modelo B: Language Arts, Social Studies, Science, Lingua Skill).
Cada indicador corresponde a una habilidad: Speaking, Listening, Reading, Writing.
${biblicalBlock(principles,
  'Cada indicador del Modelo B tiene su propio principio bíblico — un versículo específico que conecta esa habilidad con la fe. No uses el mismo versículo para las 4 habilidades.'
)}
Responde ÚNICAMENTE con un array JSON de exactamente 4 objetos. Sin texto adicional.
Estructura de cada objeto:
{
  "habilidad": "Speaking|Listening|Reading|Writing",
  "texto_en": "The student... (in English, observable, 1-2 lines)",
  "texto_es": "El estudiante... (traducción al español)",
  "principio_biblico": {
    "titulo": "Thematic title for the biblical connection",
    "referencia": "Book Chapter:Verse (NIV/NVI)",
    "cita": "Exact verse text"
  }
}`

    const message = `Genera indicadores Modelo B para:
Logro: ${safeDescription}
Materia: ${safeSubject} | Grado: ${safeGrade}
Nivel taxonómico: ${TAXONOMY_MAP[taxonomy] || taxonomy}`

    const raw = await callClaude({ type: 'generate_indicadores', system, message, maxTokens: 2000 })
    const parsed = extractJSONArray(raw)
    if (!Array.isArray(parsed) || parsed.length !== 4) throw new Error('La IA no devolvió los 4 indicadores Modelo B.')
    return parsed
  }

  // ── MODELO A — con Temáticas ───────────────────────────────────────────────
  const hasTematicas = Array.isArray(tematicaNames) && tematicaNames.some(Boolean)
  const n = hasTematicas ? tematicaNames.filter(Boolean).length : 3

  const system = `Eres un experto en diseño curricular para colegios bilingües colombianos.
Generas indicadores de logro precisos y medibles para un logro de aprendizaje.
Los indicadores deben:
- Ser observables y verificables en el aula
- Usar verbos de acción concretos acordes al nivel taxonómico
- Estar redactados en tercera persona ("El estudiante...")
- Ser concisos (máximo 2 líneas cada uno)
${biblicalBlock(principles,
  `OBLIGATORIO: Exactamente uno de los ${n} indicadores DEBE reflejar la dimensión formativa espiritual — cómo el logro académico se conecta con el Principio del Indicador y el Versículo del Mes. Debe ser tan observable y medible como los demás.`
)}
Responde ÚNICAMENTE con un array JSON de exactamente ${n} strings. Sin texto adicional, sin markdown.`

  const tematicasBlock = hasTematicas
    ? `\nTemáticas (genera exactamente 1 indicador por Temática, en el mismo orden):\n${
        tematicaNames.filter(Boolean).map((t, i) => `${i + 1}. ${sanitizeAIInput(t)}`).join('\n')
      }`
    : ''

  const message = `Genera ${n} indicadores de logro para:

Logro: ${safeDescription}
Nivel taxonómico: ${TAXONOMY_MAP[taxonomy] || taxonomy}
Asignatura: ${safeSubject}
Grado: ${safeGrade}${tematicasBlock}`

  const raw = await callClaude({ type: 'generate_indicadores', system, message, maxTokens: 1500 })
  const parsed = extractJSONArray(raw)
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('La IA no devolvió indicadores válidos.')
  return parsed
}

// ── Importar guía desde .docx ─────────────────────────────────────────────────
// Recibe el texto extraído de un .docx (via mammoth) y devuelve un content JSON
// listo para insertar en lesson_plans.content.
// maxTokens 8000 — el docx puede ser largo pero la respuesta es JSON estructurado.
export async function importGuideFromDocx({ docxText, grade, subject, principles }) {
  const safeText    = sanitizeAIInput(docxText || '').slice(0, 8000) // trim very long docs
  const safeGrade   = sanitizeAIInput(grade   || '')
  const safeSubject = sanitizeAIInput(subject || '')

  const system = `Eres un experto en el sistema pedagógico CBF (Boston Flex).
Tu tarea es parsear una guía de aprendizaje existente (texto extraído de un .docx)
y devolver un objeto JSON con la estructura interna del sistema CBF.

ESTRUCTURA REQUERIDA (devuelve SOLO JSON válido, sin markdown, sin texto extra):
{
  "info": {
    "grado": "string",
    "asignatura": "string",
    "semana": "string",
    "periodo": "string",
    "fechas": "string",
    "docente": "string"
  },
  "objetivo": {
    "general": "string (logro/objetivo de la guía)",
    "indicador": "string",
    "principio": "string"
  },
  "verse": { "text": "string", "ref": "string" },
  "days": {
    "lunes": {
      "active": true,
      "sections": {
        "subject":    { "content": "texto HTML simple" },
        "motivation": { "content": "texto HTML simple" },
        "activity":   { "content": "texto HTML simple" },
        "skill":      { "content": "texto HTML simple" },
        "closing":    { "content": "texto HTML simple" },
        "assignment": { "content": "texto HTML simple" }
      }
    }
  },
  "summary": { "done": "", "next": "" }
}

REGLAS:
- days usa nombres en español: "lunes", "martes", "miercoles", "jueves", "viernes"
- Si el documento no tiene separación por días, pon todo en "lunes"
- Mapea lo que encuentres a las 6 secciones CBF (subject/motivation/activity/skill/closing/assignment)
- Si no hay información para una sección, deja content vacío ""
- El content de cada sección puede ser HTML simple: <p>, <ul>, <li>, <strong>
- NO inventes información que no esté en el documento
${biblicalBlock(principles, '')}`

  const message = `Parsea esta guía de aprendizaje al formato JSON CBF:

DATOS DE CONTEXTO:
- Grado esperado: ${safeGrade || 'detectar del documento'}
- Materia esperada: ${safeSubject || 'detectar del documento'}

TEXTO DEL DOCUMENTO:
${safeText}`

  const raw = await callClaude({ type: 'import_docx', system, message, maxTokens: 8000 })
  let parsed
  try { parsed = JSON.parse(raw) } catch { parsed = null }
  if (!parsed || typeof parsed !== 'object') throw new Error('No se pudo parsear el documento. Verifica que sea una guía de aprendizaje CBF.')
  return parsed
}

// ── Punto 8: Análisis de cobertura eleot® + agenda de sesión ─────────────────
// Returns: text analysis (markdown-like)
export async function analyzeGuideCoverage({ content, indicator, principles }) {
  const system = `Eres un asesor pedagógico experto en el marco de observación eleot® (Cognia).
Analizas guías de aprendizaje autónomo y determines qué dominios eleot® están bien cubiertos y cuáles necesitan atención.
Respondes en español con análisis concreto y accionable.
${biblicalBlock(principles, 'Incorpora la perspectiva cristiana en el análisis, especialmente en la dimensión actitudinal (dominios A y C).')}
Estructura tu respuesta con estas secciones:
📊 COBERTURA eleot®
⚠️ DOMINIOS DÉBILES
💡 SUGERENCIAS DE BLOQUES
📋 AGENDA SUGERIDA`

  const allBlocks = []
  if (content?.days) {
    for (const day of Object.values(content.days)) {
      if (day?.active === false) continue
      for (const sec of Object.values(day?.sections || {})) {
        allBlocks.push(...(sec.smartBlocks || []))
      }
    }
  }
  const blockSummary = allBlocks.length
    ? allBlocks.map(b => `${b.type}/${b.model}`).join(', ')
    : 'Ningún Smart Block aún'

  const safeIndicator = indicator ? sanitizeAIInput(
    typeof indicator === 'string' ? indicator : (indicator.text || indicator.texto_en || '')
  ) : 'No especificado'

  const message = `Analiza la cobertura eleot® de esta guía:

INDICADOR DE LOGRO: ${safeIndicator}
SMART BLOCKS EN LA GUÍA: ${blockSummary}
DÍAS ACTIVOS: ${Object.keys(content?.days || {}).filter(k => content.days[k]?.active !== false).length}

Dominios eleot®:
A. Equitable Learning  B. High Expectations  C. Supportive Learning
D. Active Learning     E. Progress Monitoring  F. Well-Managed Learning  G. Digital Learning

Con los bloques presentes, identifica:
1. Qué dominios están bien cubiertos
2. Qué dominios están débiles o ausentes
3. Qué 2-3 bloques adicionales mejorarían la cobertura (de: WRITING, SELF_ASSESSMENT, PEER_REVIEW, DIGITAL_RESOURCE, COLLABORATIVE_TASK, REAL_LIFE_CONNECTION, TEACHER_NOTE, EXIT_TICKET, SPEAKING)
4. Una agenda típica de 84 minutos con estos bloques`

  return callClaude({ type: 'analyze_coverage', system, message, maxTokens: 1800 })
}

// ── Punto 9: Generar rúbrica versión estudiante (A2) ─────────────────────────
export async function generateStudentRubric({ rubric, projectTitle, grade, subject, principles }) {
  if (!rubric?.length) throw new Error('No hay rúbrica para convertir.')

  const system = `Eres un experto en diseño de instrumentos de evaluación para colegios bilingües colombianos.
Tu tarea: convertir una rúbrica de docente (técnica) en una versión para estudiantes — lenguaje A2, claro, amigable y accionable.
El estudiante debe poder leer la rúbrica y entender exactamente qué necesita hacer para obtener cada nivel.
Responde con HTML simple: tablas, <strong>, <p>. Sin CSS en línea.
${biblicalBlock(principles, 'Incluye una sección breve de motivación antes de la rúbrica que recuerde al estudiante que su esfuerzo tiene propósito más allá de la nota.')}`

  const criteriaText = rubric.slice(0, 8).map((c, i) =>
    `${i+1}. ${sanitizeAIInput(c.criterion || c.name || '')}: ${(c.levels || []).map((l, li) => `Nivel ${5-li}: ${sanitizeAIInput(l.description || '')}`).join(' | ')}`
  ).join('\n')

  const message = `Convierte esta rúbrica en versión para estudiantes:

Proyecto: ${sanitizeAIInput(projectTitle || '')}
Materia: ${sanitizeAIInput(subject || '')} | Grado: ${sanitizeAIInput(grade || '')}

CRITERIOS:
${criteriaText}

Crea una tabla clara donde el estudiante pueda:
1. Entender qué se espera en cada nivel (lenguaje sencillo A2)
2. Autoevaluarse antes de entregar`

  return callClaude({ type: 'student_rubric', system, message, maxTokens: 3000 })
}

