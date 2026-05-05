// ── guideAI.js ────────────────────────────────────────────────────────────────
// AI functions related to guide (lesson plan) generation and analysis.

import { callClaude, extractJSONArray, fmtVerse, biblicalBlock, normalizeSmartBlock, fetchImageBlock } from './aiClient'
import { sanitizeAIInput } from './validationSchemas'
import { MODELO_B_SUBJECTS } from './constants'

// ── Activity archetypes per section — used to force variety on each call ──────
// Keys match SECTIONS[].label from constants.js (ABC del Encuentro Didáctico)
const ACTIVITY_ARCHETYPES = {
  // English / Modelo B
  en: {
    'ENCUENTRO · VOCABULARY LIST': [
      'Day index: Biblical Principle introduction · Unit first encounter + vocabulary presentation · Vocabulary: 8 key words',
      'Day index: Biblical Principle deepening (connection to real life) · Unit grammar exploration · Vocabulary: practice game',
      'Day index: Biblical Principle application (how do I live this?) · Unit reading + comprehension · Vocabulary: in context use',
      'Day index: Biblical Principle reflection (how does this shape me?) · Unit writing production · Vocabulary: dictation',
      'Day index: Biblical Principle synthesis (sharing with others) · Unit review + consolidation · Vocabulary: presentation day',
    ],
    'TEMA DEL DÍA': [
      'a one-sentence board announcement connecting today\'s topic to the biblical principle',
      'state the learning goal in student-friendly language: "Today we will… so that we can…"',
      'a brief agenda preview: topic, objective, biblical connection — one sentence each',
    ],
    'MOTIVACIÓN': [
      'a think-pair-share connecting prior knowledge to today\'s topic: "What do you already know about…? Tell your partner."',
      'a prediction activity: show an image/headline and ask "What do you think this is about? Why?" — bridge to the lesson',
      'a KWL opener: "What do you KNOW? What do you WANT to know?" — then the lesson answers the W',
      'a personal connection prompt: "Tell your partner about a time when…" — linking lived experience to the new content',
      'a provocative dilemma or "Would you rather?" that surfaces prior beliefs about the topic',
      'a quick class poll with justification: "Raise your hand if… Now tell us WHY you think that"',
      'a brainstorm web: students share everything they associate with [key concept] — teacher maps connections',
      'a "what do you notice?" visual stimulus (photo, infographic) with a guiding question that bridges to today',
      'a true/false warm-up that reveals misconceptions the lesson will address',
      'a recall challenge: "With your partner, list 3 things we learned last class about… How might that connect to today?"',
    ],
    'DESARROLLO DE HABILIDADES': [
      'a pattern discovery: students observe 4-5 examples and INFER the rule together before teacher confirms',
      'a jigsaw reading: groups explore different parts, then teach each other — constructing full understanding collaboratively',
      'a hypothesis-testing activity: students predict → read/listen → verify → reformulate their understanding',
      'a gallery walk where students annotate posters with guiding questions, then synthesize findings',
      'a think-pair-share: individual reflection → partner discussion → class construction of meaning',
      'a dictogloss: teacher reads twice, pairs reconstruct — comparing versions reveals understanding gaps',
      'a peer teaching segment: student A explains to student B, then swap — teaching deepens comprehension',
      'a compare-and-contrast exploration: students find similarities/differences and formulate a conclusion',
      'an error correction hunt: students identify patterns in mistakes and explain WHY they are wrong',
      'a concept mapping activity: students build visual connections between ideas from the text',
      'a guided discovery from textbook examples: "What do you notice?" → formulate rule → apply',
      'a collaborative problem-solving task where groups propose solutions and justify their reasoning',
      'a Socratic questioning sequence: teacher poses layered questions, students build understanding step by step',
      'a structured debate where students must construct arguments using evidence from the text',
      'a "teach-back" challenge: after exploration, student explains the concept to a partner in their own words',
    ],
    'CIERRE Y REFLEXIÓN': [
      'an exit-ticket sentence using the target structure + one faith-connection sentence',
      'a "three things I learned / one question I still have" reflection',
      'a pair share: "Explain today\'s grammar rule to your partner in your own words"',
      'a "ticket out the door" — write one sentence connecting today\'s topic to the biblical principle',
      'a quick vocabulary recap: partners quiz each other on 5 words from today',
      'a silent written reflection on a faith-connection prompt',
      'a "what would I tell a friend about today\'s lesson?" one-sentence summary',
    ],
    'TAREA / ASSIGNMENT': [
      'a written production task (5-8 sentences using target grammar)',
      'a voice recording assignment (1-minute monologue or dialogue)',
      'a textbook exercise on the grammar point (specific page)',
      'a vocabulary study task using a chosen strategy (flashcards, sentences, diagram)',
      'a "find 3 real examples" research task (news, ads, songs)',
      'a reading comprehension from the textbook with written answers',
      'a creative writing prompt using vocabulary from the unit',
    ],
  },
  // Spanish
  es: {
    'ENCUENTRO · VOCABULARY LIST': [
      'Índice del día: Principio Bíblico — introducción · Unidad — primer encuentro + vocabulario · Vocabulario: presentación de palabras clave',
      'Índice del día: Principio Bíblico — profundización (conexión con la vida real) · Unidad — exploración gramatical · Vocabulario: juego de práctica',
      'Índice del día: Principio Bíblico — aplicación (¿cómo lo vivo?) · Unidad — lectura y comprensión · Vocabulario: uso en contexto',
      'Índice del día: Principio Bíblico — reflexión (¿cómo me forma?) · Unidad — producción escrita · Vocabulario: dictado',
      'Índice del día: Principio Bíblico — síntesis (¿cómo lo comparto?) · Unidad — revisión y consolidación · Vocabulario: día de presentación',
    ],
    'TEMA DEL DÍA': [
      'una oración que enuncia el tema del día y lo conecta con el principio bíblico del mes',
      'anuncia el objetivo en lenguaje amigable: "Hoy vamos a… para poder…"',
      'resumen de la agenda del día: tema, objetivo, conexión bíblica — una oración por ítem',
    ],
    'MOTIVACIÓN': [
      'un think-pair-share: "¿Qué ya sabes sobre [tema]? Cuéntale a tu compañero" — puente hacia lo nuevo',
      'una predicción con imagen o titular: "¿De qué crees que se trata? ¿Por qué?" — conecta con la lección',
      'un KWL: "¿Qué SABES? ¿Qué QUIERES saber?" — la lección responderá la Q',
      'una conexión personal: "¿Cuándo has vivido algo parecido?" — vincular experiencia con contenido nuevo',
      'un dilema provocador que revele creencias previas sobre el tema',
      'una encuesta rápida con justificación: "Levanta la mano si… Ahora explica POR QUÉ piensas eso"',
      'una lluvia de ideas: los alumnos comparten todo lo que asocian con [concepto clave] — el docente mapea conexiones',
      'un "¿qué notas?" con estímulo visual y pregunta guía que conecte con lo que van a aprender',
      'un verdadero/falso que revele conceptos erróneos que la lección va a corregir',
      'un reto de recuerdo: "Con tu compañero, lista 3 cosas de la clase pasada. ¿Cómo se conectan con hoy?"',
    ],
    'DESARROLLO DE HABILIDADES': [
      'un descubrimiento de patrones: los alumnos observan 4-5 ejemplos e INFIEREN la regla antes de que el docente confirme',
      'una actividad jigsaw: grupos exploran partes distintas y se enseñan mutuamente — construcción colaborativa',
      'una hipótesis-verificación: los alumnos predicen → leen → verifican → reformulan su comprensión',
      'una galería con preguntas guía: los grupos anotan respuestas y luego sintetizan hallazgos colectivamente',
      'un think-pair-share: reflexión individual → discusión en parejas → construcción colectiva de significado',
      'un análisis de caso: el alumno lee, identifica un problema, propone una solución y la justifica',
      'un mapeo de conceptos: los alumnos construyen conexiones visuales entre las ideas del texto',
      'un descubrimiento guiado desde el libro: "¿Qué notas?" → formula la regla → aplica con un compañero',
      'una resolución colaborativa: grupos proponen soluciones y justifican su razonamiento al resto',
      'un "enseña-lo-aprendido": después de explorar, el alumno explica el concepto a un compañero en sus palabras',
    ],
    'CIERRE Y REFLEXIÓN': [
      'una pregunta de reflexión que conecte lo aprendido con el principio bíblico + ticket de salida',
      'ronda de cierre: cada estudiante dice una palabra clave aprendida hoy',
      'pregunta emocional: ¿cómo se sintieron con el tema? + conexión bíblica como cierre',
      'una conexión personal: ¿dónde aplico esto fuera del aula?',
      'un resumen en cadena: un estudiante comienza la frase, el siguiente la continúa',
    ],
    'TAREA / ASSIGNMENT': [
      'una tarea escrita específica y alcanzable relacionada con el tema del día',
      'una actividad de investigación breve con entregable concreto para la siguiente clase',
      'un ejercicio del libro de texto (página y punto específico)',
      'una reflexión escrita de media página con pregunta guía relacionada con el principio bíblico',
    ],
  },
}

// ── Punto 1: Sugerir actividad para una sección ───────────────────────────────
export async function suggestSectionActivity({
  section, grade, subject, objective, unit, dayName, existingContent, planId, principles, newsProject, variantSeed
}) {
  const isModeloB = MODELO_B_SUBJECTS.includes(subject)

  // Pick an activity archetype based on the random seed — forces variety each call
  const lang = isModeloB ? 'en' : 'es'
  const archetypeList = ACTIVITY_ARCHETYPES[lang][section.label] || []
  const archetype = archetypeList.length
    ? archetypeList[(variantSeed || Math.floor(Math.random() * 10000)) % archetypeList.length]
    : null

  // Limits per section — constructivist approach: guide questions, exploration, construction.
  const SECTION_LIMITS = {
    'ENCUENTRO · VOCABULARY LIST': isModeloB
      ? 'Brief consecutive daily index — 3 lines: what moment of the Biblical Principle (intro/deepening/application/reflection), what moment of the Unit (intro/practice/analysis/production), what moment of Vocabulary (presentation/game/in-context use/dictation). Never repeat "intro" two days in a row — always scales on the previous day. Max 50 words.'
      : 'Índice breve y consecutivo del día — 3 líneas: qué momento del Principio Bíblico (intro/profundización/aplicación/reflexión), qué momento de la Unidad (intro/práctica/análisis/producción), qué momento del Vocabulario (presentación/juego/uso en contexto/dictado). Nunca repetir "intro" dos días seguidos. Máx. 50 palabras.',
    'TEMA DEL DÍA': isModeloB
      ? 'Board ritual — written and NOT erased during class: Date | Objective (student-friendly) | Biblical Principle | Topic. If milestone today: open with "⚠️ TODAY: [MILESTONE]". Max 40 words.'
      : 'Ritual del tablero — se escribe y NO se borra durante la clase: Fecha | Objetivo (lenguaje amigable) | Principio Bíblico | Tema. Si hay hito: abrir con "⚠️ HOY: [HITO]". Máx. 40 palabras.',
    'MOTIVACIÓN': isModeloB
      ? '1 guiding question that activates prior knowledge (NOT yes/no — make them think, recall, express opinions) + 1 brief activation dynamic (think-pair-share, prediction, brainstorm). The question bridges what they know with what they will learn. Max 40 words.'
      : '1 pregunta guía que active saberes previos (NO sí/no — que piensen, recuerden, opinen) + 1 dinámica breve de activación (think-pair-share, predicción, lluvia de ideas). La pregunta conecta lo que saben con lo nuevo. Máx. 40 palabras.',
    'DESARROLLO DE HABILIDADES': isModeloB
      ? '4 constructivist MOMENTS (not steps): a) ❓ Guiding question (provokes exploration), b) 🔍 Exploration (observe/read/compare — reference textbook pages), c) 🏗️ Construction (student formulates conclusion, shares with partner), d) ✍️ Product (concrete evidence). Max 80 words.'
      : '4 MOMENTOS constructivistas (no pasos): a) ❓ Pregunta guía (provoca exploración), b) 🔍 Exploración (observa/lee/compara — referencia páginas del libro), c) 🏗️ Construcción (el alumno formula conclusión, comparte con compañero), d) ✍️ Producto (evidencia concreta). Máx. 80 palabras.',
    'CIERRE Y REFLEXIÓN': isModeloB
      ? '1 question where the student EXPLAINS in their own words (not repeating definitions — "Explain to your partner...") + 1 deep biblical reflection. Max 40 words.'
      : '1 pregunta donde el alumno EXPLIQUE EN SUS PALABRAS (no repetir definiciones — "Explica a tu compañero...") + 1 reflexión bíblica profunda. Máx. 40 palabras.',
    'TAREA / ASSIGNMENT': isModeloB
      ? '1 sentence with concrete deliverable. At least once per week include a brief biblical reflection. Max 25 words.'
      : '1 oración con entregable concreto. Al menos 1 vez/semana incluir reflexión bíblica breve. Máx. 25 palabras.',
  }
  const limit = SECTION_LIMITS[section.label] || (isModeloB ? 'Max 40 words. Direct instruction only.' : 'Máx. 40 palabras. Solo instrucción directa.')

  const isClosing = section.label === 'CIERRE Y REFLEXIÓN'
  const langInstruction = isModeloB
    ? 'You respond ALWAYS in English. This is a bilingual school where language subjects are fully taught in English.'
    : 'Respondes SIEMPRE en español.'

  const system = `Eres un asistente pedagógico experto para colegios bilingües colombianos (CBF — Colegio Boston Flexible).
Generas contenido para guías de aprendizaje. Tu salida va DIRECTAMENTE a la guía que el docente usa en clase.
${langInstruction}
MODELO PEDAGÓGICO: Constructivista teocéntrico. El docente FACILITA, el alumno CONSTRUYE.
- Usa PREGUNTAS GUÍA que provoquen pensamiento, no solo instrucciones imperativas.
- En DESARROLLO: el alumno descubre, infiere, propone — no solo obedece pasos.
- En MOTIVACIÓN: activa saberes previos con preguntas que conecten lo anterior con lo nuevo.
- Sin prosa introductoria, sin "Se recomienda…", sin meta-comentarios. Conciso pero pedagógicamente rico.
LÍMITE para esta sección: ${limit}
${biblicalBlock(principles, isClosing
  ? (isModeloB
    ? 'The CLOSING section ALWAYS ends with a question or reflection connecting today\'s learning to this biblical principle. This is the faith-learning integration moment.'
    : 'La sección CLOSING SIEMPRE debe cerrar con una pregunta o reflexión que conecte lo aprendido con este principio bíblico. Es el momento de integración fe-aprendizaje.')
  : (isModeloB
    ? 'Keep this principle in mind when designing the activity. When it feels natural and authentic, weave it in. Never force it artificially, but never ignore it.'
    : 'Ten presente este principio al diseñar la actividad. Cuando sea natural y auténtico, intégralo. No lo fuerces artificialmente, pero nunca lo ignores.')
)}`

  // Sanitize user inputs to prevent prompt injection
  const safeGrade = sanitizeAIInput(grade || '')
  const safeSubject = sanitizeAIInput(subject || '')
  const safeDayName = sanitizeAIInput(dayName || '')
  const safeUnit = sanitizeAIInput(unit || '')
  const safeObjective = sanitizeAIInput(objective || '')
  const safeExisting = existingContent ? sanitizeAIInput(existingContent.replace(/<[^>]+>/g,' ').slice(0,300)) : ''

  // Build textbook/NEWS context block if available
  let textbookBlock = ''
  if (newsProject) {
    const tb = newsProject.textbook_reference || {}
    const lines = []
    if (tb.book)                     lines.push(`- Book: ${sanitizeAIInput(tb.book)}`)
    if (tb.units?.length)            lines.push(`- Units: ${tb.units.map(u => sanitizeAIInput(String(u))).join(', ')}`)
    if (tb.grammar?.length)          lines.push(`- Grammar points: ${tb.grammar.map(g => sanitizeAIInput(String(g))).join(' · ')}`)
    if (tb.vocabulary?.length)       lines.push(`- Vocabulary: ${tb.vocabulary.map(v => sanitizeAIInput(String(v))).join(' · ')}`)
    if (tb.pages?.student)           lines.push(`- Student Book pages: ${sanitizeAIInput(tb.pages.student)}`)
    if (tb.pages?.workbook)          lines.push(`- Workbook pages: ${sanitizeAIInput(tb.pages.workbook)}`)
    if (tb.unitDetails?.length) {
      tb.unitDetails.forEach(ud => {
        const parts = [`  Unit ${sanitizeAIInput(String(ud.unit || '?'))}`]
        if (ud.studentPages) parts.push(`SB p.${sanitizeAIInput(ud.studentPages)}`)
        if (ud.workbookPages) parts.push(`WB p.${sanitizeAIInput(ud.workbookPages)}`)
        if (ud.lessons?.length) parts.push(`(${ud.lessons.map(l => sanitizeAIInput(String(l))).join(', ')})`)
        lines.push(parts.join(' · '))
      })
    }
    if (newsProject.title)           lines.push(`- NEWS Project: ${sanitizeAIInput(newsProject.title)}`)
    if (newsProject.description)     lines.push(`- Project description: ${sanitizeAIInput(newsProject.description.slice(0,200))}`)
    if (newsProject.skill)           lines.push(`- Focus skill: ${sanitizeAIInput(newsProject.skill)}`)
    if (lines.length) {
      textbookBlock = isModeloB
        ? `\n📚 TEXTBOOK & PROJECT CONTEXT (use this to make your suggestion specific and relevant):\n${lines.join('\n')}`
        : `\n📚 CONTEXTO DEL LIBRO Y PROYECTO (úsalo para hacer la sugerencia específica y relevante):\n${lines.join('\n')}`
    }
  }

  const intro = isModeloB
    ? `I am writing the "${section.label}" section of a weekly learning guide.`
    : `Estoy escribiendo la sección "${section.label}" de una guía de aprendizaje.`

  const message = `${intro}
${textbookBlock}
${isModeloB ? 'Context' : 'Contexto'}:
- ${isModeloB ? 'Grade' : 'Grado'}: ${safeGrade}
- ${isModeloB ? 'Subject' : 'Materia'}: ${safeSubject}
- ${isModeloB ? 'Day' : 'Día'}: ${safeDayName}
- ${isModeloB ? 'Unit/Topic' : 'Unidad/Tema'}: ${safeUnit || (isModeloB ? 'Not specified' : 'No especificado')}
- ${isModeloB ? 'Weekly objective' : 'Objetivo de la semana'}: ${safeObjective || (isModeloB ? 'Not specified' : 'No especificado')}
- ${isModeloB ? 'Estimated time for this section' : 'Tiempo estimado de esta sección'}: ${section.time}
${existingContent ? `- ${isModeloB ? 'What I already have' : 'Lo que ya tengo escrito'}: "${safeExisting}"` : ''}

${archetype
  ? (isModeloB
    ? `Design the "${section.label}" as: **${archetype}**. Be concrete — use the grammar points, vocabulary, and textbook unit listed above. Respect the length limit: ${limit}`
    : `Diseña la sección "${section.label}" como: **${archetype}**. Sé concreto — usa el vocabulario y temas listados. Respeta el límite: ${limit}`)
  : (isModeloB
    ? `Suggest a specific, engaging activity for "${section.label}". Be concrete — use the grammar points, vocabulary, and textbook unit listed above. Respect the length limit: ${limit}`
    : `Sugiere una actividad para "${section.label}". Respeta el límite: ${limit}`)
}`

  return callClaude({ type: 'suggest', system, message, planId, maxTokens: 2500 })
}

// ── Punto 1b: Sugerir SmartBlock para una sección ────────────────────────────
export async function suggestSmartBlock({
  sectionMeta, grade, subject, objective, unit, dayName,
  existingContent, existingBlocks, planId, principles
}) {
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

  const system = `Eres un experto pedagógico para colegios bilingües colombianos (metodología CBF).
Tu tarea: sugerir UN SmartBlock apropiado para una sección de guía.
Responde SOLO con JSON válido. Sin markdown, sin texto adicional.
Estructura exacta: {"type":"...","model":"...","data":{...}}
Los datos deben estar en inglés (colegio bilingüe) y ser realistas y listos para usar.
${biblicalBlock(principles,
  'Cuando el tipo de bloque lo permita de manera natural (especialmente READING, EXIT_TICKET, SPEAKING, NOTICE), el contenido puede reflejar o conectar con el principio bíblico del período. No lo fuerces en todos los bloques — solo cuando enriquezca genuinamente la actividad.'
)}`

  // Sanitize user inputs
  const safeGrade = sanitizeAIInput(grade || '')
  const safeSubject = sanitizeAIInput(subject || '')
  const safeDayName = sanitizeAIInput(dayName || '')
  const safeUnit = sanitizeAIInput(unit || '')
  const safeObjective = sanitizeAIInput(objective || '')
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
  const _v = fmtVerse(principles?.monthVerse) || fmtVerse(content.verse)

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
  grade, subject, objective, unit, activeDays, period, planId, achievementGoal, activeNewsProject, principles, piarData,
  _focusHints, checkpointData
}) {
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

  const system = `Eres un experto en diseño de guías de aprendizaje para colegios bilingües colombianos CRISTIANOS CONFESIONALES.
Generas estructuras completas de guías semanales siguiendo el modelo CBF con 6 secciones por día.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MODELO PEDAGÓGICO — CONSTRUCTIVISTA TEOCÉNTRICO (NO CONDUCTISTA)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRINCIPIO RECTOR: "Nosotros diseñamos. El docente enseña."
El docente es FACILITADOR. El estudiante CONSTRUYE el conocimiento.
NO generes listas de instrucciones que el alumno solo obedece.
SÍ genera preguntas guía, momentos de exploración, y espacios donde el alumno
descubre, infiere, propone y construye — con la guía del docente.

REGLA DE FORMATO:
- El contenido va a la guía que el docente usa en clase para facilitar el aprendizaje.
- Usa preguntas guía (❓) para provocar pensamiento, no solo imperativos.
- Alterna entre: pregunta → exploración → construcción → producto.
- Sin prosa introductoria, sin "Se recomienda…", sin meta-comentarios.
- Mantén cada sección concisa pero pedagógicamente rica.

MANDATO ABSOLUTO: Esta es una escuela cristiana confesional. El principio bíblico NO es un elemento decorativo — es el HILO CONDUCTOR que atraviesa CADA momento de CADA clase, sin importar la materia. Matemáticas, Ciencias, Filosofía, Language Arts: todas tienen el mismo norte espiritual. Nunca generes contenido neutral o secular puro.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABC DEL ENCUENTRO DIDÁCTICO — 6 SECCIONES POR DÍA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HILO BÍBLICO TRANSVERSAL: Presente en CADA sección, no solo inicio/cierre. Es la lente natural del contenido.

1. ENCUENTRO — SUBJECT TO BE WORKED (~5 min) — key: "subject"
   → NO es lista de vocabulario ni actividad.
   → Es un ÍNDICE BREVE y CONSECUTIVO de lo que se trabajará ese día:
     qué momento del Principio Bíblico (intro / profundización / aplicación / reflexión),
     qué momento de la Unidad (intro / práctica / análisis / producción),
     qué momento del Vocabulario (presentación / juego / uso en contexto / dictado).
   → CONSECUTIVIDAD OBLIGATORIA: lo que se introdujo ayer, hoy se profundiza.
     Nunca repetir "intro" dos días seguidos. Cada día escala sobre el anterior.
   → Formato: 3 líneas breves. Sin oraciones largas. Solo el índice del día.
   → Ejemplo Día 1: "📖 Biblical Principle: Introduction — Genesis 1:27 | 📚 Unit 3: First encounter — Vocabulary | 🔤 Vocabulary: Presentation of 8 key words"
   → Ejemplo Día 2: "📖 Biblical Principle: Deepening — How does it connect to identity? | 📚 Unit 3: Grammar exploration | 🔤 Vocabulary: Practice — matching game"
   → NO incluyas oración ni reglas — se insertan automáticamente.
   Máx. 50 palabras.

2. TEMA DEL DÍA (~5 min) — key: "motivation"
   📋 RITUAL DEL TABLERO — Se escribe y NO SE BORRA durante toda la clase:
   📅 Date: [fecha] | 🎯 Objective: [indicador en lenguaje amigable] | 📖 Biblical Principle: [principio] | 📚 Topic: [tema del día]
   → Si hay hito evaluativo: abrir con "⚠️ TODAY: [HITO]" antes del ritual.
   Máx. 40 palabras.

3. MOTIVACIÓN (~10 min) — key: "activity"
   OBJETIVO: Activar saberes previos y conectar con la clase anterior.
   FORMATO OBLIGATORIO:
   - 1 pregunta guía que provoque al alumno a expresar lo que YA sabe sobre el tema
     (no una pregunta con respuesta sí/no — una que invite a pensar, recordar, opinar)
   - 1 dinámica breve de activación (think-pair-share, lluvia de ideas, predicción, encuesta rápida)
   - La pregunta debe tender un PUENTE entre lo que ya saben y lo que van a aprender hoy.
   Máx. 40 palabras.

4. DESARROLLO DE HABILIDADES (~25 min) — key: "skill"
   MODELO CONSTRUCTIVISTA — El alumno construye conocimiento, el docente facilita:
   📐 Si hay gramática: el alumno OBSERVA ejemplos → INFIERE la regla → VERIFICA con el docente → PRACTICA.

   ESTRUCTURA OBLIGATORIA (4 momentos, no "pasos"):
   a) ❓ PREGUNTA GUÍA — Una pregunta que oriente la exploración ("¿Qué patrones notas en...?", "¿Por qué crees que...?", "¿Qué pasaría si...?")
   b) 🔍 EXPLORACIÓN — El alumno observa, lee, compara, escucha (referencia a páginas del libro). Puede ser individual, en parejas, o en tríos.
   c) 🏗️ CONSTRUCCIÓN — El alumno formula una respuesta, conclusión o hipótesis. Comparte con un compañero. El docente guía sin dar la respuesta directa.
   d) ✍️ PRODUCTO — Evidencia concreta de lo construido (escribe, presenta, dibuja, completa).

   🎯 Habilidad del día (L/R/W/S) + referencia a páginas del libro cuando sea posible.
   Máx. 80 palabras.

5. CIERRE Y REFLEXIÓN (~5 min) — key: "closing"
   - 1 pregunta de verificación donde el alumno explique EN SUS PROPIAS PALABRAS lo aprendido
     (no "¿qué es X?" sino "Explica a tu compañero cómo/por qué…")
   - 1 reflexión bíblica significativa (no "¿qué dice el versículo?" sino "¿Cómo cambia tu forma de ver [tema] a la luz de [principio]?")
   Máx. 40 palabras.

6. TAREA / ASSIGNMENT (~3 min) — key: "assignment"
   1 tarea concreta con entregable específico. Al menos 1 vez/semana incluir mini-reflexión bíblica.
   Máx. 25 palabras.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROGRESIÓN SEMANAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

La semana se orienta por HITOS EVALUATIVOS. Días antes = preparación. Días después = transición.
Sin hitos → Habilidades de Pensamiento BF: Recuperar → Comprender → Analizar → Aplicar → Evaluar → Crear/Divulgar.
Habilidades L/R/W/S rotan sin repetir días consecutivos. Libro de texto = referencia obligatoria.
Checkpoint anterior tiene precedencia sobre progresión estándar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HITOS EVALUATIVOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DICTATION → SKILL = dictado + SmartBlock DICTATION. Día siguiente = vocab nuevo.
QUIZ → SKILL = evaluación + SmartBlock QUIZ. Día siguiente = unidad nueva.
RECEPCIÓN → ensayo + PEER_REVIEW. PRESENTACIÓN → momento cumbre + SPEAKING rubric.
Cada hito: "⚠️ TODAY: [HITO]" en TEMA DEL DÍA. Detalles específicos en el MAPA DE LA SEMANA.

${pBlock}

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
Usa inglés en los datos del bloque (colegio bilingüe). Si no hay un bloque claramente apropiado para una sección, omite "smartBlock".

IMÁGENES DEL TEXTBOOK: Si el mensaje incluye imágenes (fotos de páginas del libro), ÚSALAS
como referencia directa. Identifica: ejercicios, textos de lectura, gramática, vocabulario,
y referencia las páginas y ejercicios EXACTOS que ves en las imágenes (ej. "Exercise 3, p.45").
Las actividades de cada día deben estar ancladas a contenido REAL del libro visible en las fotos.`

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

  // NEWS project ref — needed by dayPlan, newsBlock, and milestonesBlock
  const np = activeNewsProject

  // ── DAY PLANNER — compute 5 coordinates per day ──────────────────────────────
  // Each day gets: bloom, skill (L/R/W/S), grammarPhase, hitoLabel, hitoType
  const dayPlan = (() => {
    const plan = {} // ISO → { bloom, skill, grammarPhase, grammarPoint, hitoLabel, hitoType }
    const daySet = new Set(activeDays)

    // 1. Detect milestones from NEWS activities
    const milestoneMap = {} // ISO → { type, name }
    if (np?.actividades_evaluativas?.length) {
      for (const act of np.actividades_evaluativas) {
        if (!act.fecha || !daySet.has(act.fecha)) continue
        const n = (act.nombre || '').toLowerCase()
        let type = 'OTHER'
        if (/dict/i.test(n))                  type = 'DICTATION'
        else if (/quiz|test|exam/i.test(n))   type = 'QUIZ'
        else if (/present|exposici/i.test(n)) type = 'PRESENTATION'
        else if (/recep|revis|draft/i.test(n)) type = 'RECEPTION'
        milestoneMap[act.fecha] = { type, name: act.nombre || '' }
      }
    }
    if (np?.due_date && daySet.has(np.due_date) && !milestoneMap[np.due_date]) {
      milestoneMap[np.due_date] = { type: 'PRESENTATION', name: np.title || 'NEWS Project' }
    }

    // 2. Grammar points from textbook_reference
    const grammarPlan = np?.textbook_reference?.grammarPlan || []
    const grammarPoints = np?.textbook_reference?.grammar || []
    // Build a map of day → grammar event
    const grammarDayMap = {} // ISO → { point, phase: 'present'|'practice'|'use', pages }
    if (grammarPlan.length) {
      // Teacher has scheduled grammar explicitly
      for (const gp of grammarPlan) {
        if (gp.presentDay && daySet.has(gp.presentDay)) {
          grammarDayMap[gp.presentDay] = { point: gp.point, phase: 'present', pages: gp.pages || '' }
          // Auto-assign practice to the next day
          const idx = activeDays.indexOf(gp.presentDay)
          if (idx >= 0 && idx + 1 < activeDays.length && !grammarDayMap[activeDays[idx + 1]]) {
            grammarDayMap[activeDays[idx + 1]] = { point: gp.point, phase: 'practice', pages: gp.pages || '' }
          }
          // Use in context on the day after that
          if (idx >= 0 && idx + 2 < activeDays.length && !grammarDayMap[activeDays[idx + 2]]) {
            grammarDayMap[activeDays[idx + 2]] = { point: gp.point, phase: 'use', pages: '' }
          }
        }
      }
    } else if (grammarPoints.length) {
      // Fallback: auto-distribute grammar points across the week
      const perPoint = Math.max(2, Math.floor(activeDays.length / grammarPoints.length))
      grammarPoints.forEach((gp, gi) => {
        const startIdx = gi * perPoint
        const phases = ['present', 'practice', 'use']
        phases.forEach((phase, pi) => {
          const dayIdx = startIdx + pi
          if (dayIdx < activeDays.length && !milestoneMap[activeDays[dayIdx]]) {
            grammarDayMap[activeDays[dayIdx]] = { point: gp, phase, pages: '' }
          }
        })
      })
    }

    // 3. Habilidades de Pensamiento BF — progresión cognitiva (adapta alrededor de hitos)
    const BLOOM_STANDARD = ['Recuperar', 'Comprender', 'Analizar', 'Aplicar', 'Evaluar', 'Crear/Divulgar']
    const BLOOM_HITO = { DICTATION: 'Aplicar', QUIZ: 'Evaluar', PRESENTATION: 'Crear/Divulgar', RECEPTION: 'Analizar' }

    // 4. Skill rotation (L/R/W/S) — never repeat same skill consecutive days
    const SKILLS = ['Listening', 'Reading', 'Writing', 'Speaking']
    const SKILL_HITO = { DICTATION: 'Writing', QUIZ: null, PRESENTATION: 'Speaking', RECEPTION: 'Speaking' }

    let bloomIdx = 0
    let skillIdx = 0
    let lastSkill = null

    for (let i = 0; i < activeDays.length; i++) {
      const iso = activeDays[i]
      const milestone = milestoneMap[iso]
      const grammar = grammarDayMap[iso]

      // Bloom
      let bloom
      if (milestone) {
        bloom = BLOOM_HITO[milestone.type] || BLOOM_STANDARD[Math.min(bloomIdx, BLOOM_STANDARD.length - 1)]
        // Post-milestone: reset bloom
        bloomIdx = 0
      } else {
        bloom = BLOOM_STANDARD[Math.min(bloomIdx, BLOOM_STANDARD.length - 1)]
        bloomIdx++
      }

      // Skill
      let skill
      if (milestone && SKILL_HITO[milestone.type]) {
        skill = SKILL_HITO[milestone.type]
      } else {
        // Rotate, skipping last used skill
        skill = SKILLS[skillIdx % SKILLS.length]
        if (skill === lastSkill) { skillIdx++; skill = SKILLS[skillIdx % SKILLS.length] }
        skillIdx++
      }
      lastSkill = skill

      plan[iso] = {
        bloom,
        skill,
        grammarPhase: grammar?.phase || null,
        grammarPoint: grammar?.point || null,
        grammarPages: grammar?.pages || '',
        hitoType: milestone?.type || null,
        hitoLabel: milestone?.name || null,
      }
    }
    return plan
  })()

  // Build the per-day instruction block
  const dayPlanBlock = (() => {
    const names = ['Lunes','Martes','Miércoles','Jueves','Viernes','Lunes','Martes','Miércoles','Jueves','Viernes']
    const SKILL_ICONS = { Listening: '🎧', Reading: '📖', Writing: '✍️', Speaking: '🎤' }
    const GRAMMAR_PHASE_ES = { present: '📐 PRESENTAR gramática', practice: '📐 PRACTICAR gramática', use: '📐 USAR gramática en contexto' }
    const HITO_ICONS = { DICTATION: '📝', QUIZ: '📋', PRESENTATION: '🎤', RECEPTION: '📋', OTHER: '⚠️' }

    const lines = [
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'MAPA DE LA SEMANA — COORDENADAS POR DÍA (OBLIGATORIO)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      'Cada día tiene coordenadas FIJAS. La IA DEBE respetar TODAS las coordenadas de cada día.',
      'No cambiar el orden, no saltarse una habilidad, no ignorar el grammar.',
      '',
    ]

    activeDays.forEach((iso, i) => {
      const dp = dayPlan[iso]
      const d = new Date(iso + 'T12:00:00')
      const dayName = names[i] || names[d.getDay() - 1] || iso

      const coords = []
      coords.push(`Habilidad de Pensamiento: **${dp.bloom}**`)
      coords.push(`${SKILL_ICONS[dp.skill] || ''} Habilidad: **${dp.skill}**`)
      if (dp.grammarPhase) {
        coords.push(`${GRAMMAR_PHASE_ES[dp.grammarPhase]}${dp.grammarPoint ? `: "${sanitizeAIInput(dp.grammarPoint)}"` : ''}${dp.grammarPages ? ` (p.${sanitizeAIInput(dp.grammarPages)})` : ''}`)
      }
      if (dp.hitoType) {
        coords.push(`${HITO_ICONS[dp.hitoType] || '⚠️'} HITO: **${sanitizeAIInput(dp.hitoLabel || dp.hitoType)}**`)
      }

      lines.push(`📅 Día ${i + 1} — ${dayName} (${iso}):`)
      coords.forEach(c => lines.push(`   ${c}`))

      // Special instructions per hito
      if (dp.hitoType === 'DICTATION') {
        lines.push(`   → La sección SKILL = dictado. SmartBlock DICTATION obligatorio.`)
        lines.push(`   → TEMA DEL DÍA abre con: "⚠️📝 TODAY: DICTATION"`)
      } else if (dp.hitoType === 'QUIZ') {
        lines.push(`   → La sección SKILL = evaluación. SmartBlock QUIZ obligatorio.`)
        lines.push(`   → TEMA DEL DÍA abre con: "⚠️📋 TODAY: QUIZ"`)
      } else if (dp.hitoType === 'PRESENTATION') {
        lines.push(`   → SKILL = presentaciones. SmartBlock SPEAKING rubric obligatorio.`)
        lines.push(`   → TEMA DEL DÍA abre con: "⚠️🎤 TODAY: PRESENTATION DAY"`)
      } else if (dp.hitoType === 'RECEPTION') {
        lines.push(`   → SKILL = revisión de documentos + ensayo. SmartBlock PEER_REVIEW.`)
        lines.push(`   → TEMA DEL DÍA abre con: "⚠️📋 TODAY: PROJECT DOCUMENT DUE"`)
      }

      // Grammar phase instructions
      if (dp.grammarPhase === 'present') {
        lines.push(`   → GRAMMAR: El estudiante COPIA la regla en su cuaderno. El docente explica con ejemplos del libro${dp.grammarPages ? ` (p.${sanitizeAIInput(dp.grammarPages)})` : ''}. SmartBlock GRAMMAR (fill-blank) para primera práctica guiada.`)
      } else if (dp.grammarPhase === 'practice') {
        lines.push(`   → GRAMMAR: Ejercicios del libro${dp.grammarPages ? ` (p.${sanitizeAIInput(dp.grammarPages)})` : ''}. SmartBlock GRAMMAR (choose o fill-blank). Práctica independiente.`)
      } else if (dp.grammarPhase === 'use') {
        lines.push(`   → GRAMMAR: NO se enseña — se USA dentro de la actividad principal. El estudiante produce oraciones/texto usando la gramática aprendida.`)
      }

      lines.push('')
    })

    // Post-milestone transitions
    for (let i = 0; i < activeDays.length; i++) {
      const dp = dayPlan[activeDays[i]]
      if (dp.hitoType === 'DICTATION' && i + 1 < activeDays.length) {
        lines.push(`🔄 Día ${i + 2}: Post-dictation → VOCABULARIO NUEVO (nuevo ciclo).`)
      }
      if (dp.hitoType === 'QUIZ' && i + 1 < activeDays.length) {
        lines.push(`🔄 Día ${i + 2}: Post-quiz → UNIDAD/TEMA NUEVA (nuevo ciclo).`)
      }
    }

    return lines.join('\n')
  })()

  // Build achievement_goal context block
  const achievementBlock = achievementGoal ? (() => {
    const lines = []
    if (achievementGoal.text) lines.push(`- Logro del período: "${sanitizeAIInput(achievementGoal.text)}"`)
    if (achievementGoal.period) lines.push(`- Período: ${achievementGoal.period}`)
    const inds = achievementGoal.indicators || []
    if (inds.length) {
      lines.push(`- Indicadores de logro del período (${inds.length} total):`)
      inds.forEach((ind, i) => {
        const dim = ind.dimension ? `[${ind.dimension}]` : ''
        const skill = ind.skill_area ? `[${ind.skill_area}]` : ''
        lines.push(`  ${i+1}. ${dim}${skill} ${sanitizeAIInput(ind.text || '')}`)
      })
    }
    if (safeObjective) lines.push(`- Indicador específico de esta guía: "${safeObjective}"`)
    return lines.length ? `\n🎯 LOGRO E INDICADORES DEL PERÍODO (contexto curricular obligatorio):\n${lines.join('\n')}\nTODA la guía debe construir hacia estos indicadores. El estudiante debe terminar la semana más cerca de demostrar este logro.` : ''
  })() : ''

  // Build NEWS project context block
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
      // Pages — critical for AI to reference specific exercises
      if (tb.pages?.student) lines.push(`- Páginas del Student Book: ${sanitizeAIInput(tb.pages.student)}`)
      if (tb.pages?.workbook) lines.push(`- Páginas del Workbook: ${sanitizeAIInput(tb.pages.workbook)}`)
      // Per-unit lesson details (if available)
      if (tb.unitDetails?.length) {
        lines.push(`- Detalle por unidad:`)
        tb.unitDetails.forEach(ud => {
          const parts = [`  Unit ${sanitizeAIInput(ud.unit || '?')}`]
          if (ud.studentPages) parts.push(`Student Book p.${sanitizeAIInput(ud.studentPages)}`)
          if (ud.workbookPages) parts.push(`Workbook p.${sanitizeAIInput(ud.workbookPages)}`)
          if (ud.lessons?.length) parts.push(`Lessons: ${ud.lessons.map(l => sanitizeAIInput(l)).join(', ')}`)
          lines.push(parts.join(' · '))
        })
      }
      // Textbook images
      if (tb.images?.length) {
        const sent = Math.min(tb.images.length, 4)
        lines.push(`- 📸 ${tb.images.length} foto(s) de páginas del libro (${sent} enviadas como imágenes adjuntas — ÚSALAS para referenciar ejercicios y páginas exactas)`)
      }
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

  // ── Build MILESTONES block — day-by-day activity map with transition rules ──
  const milestonesBlock = (() => {
    const daySet = new Set(activeDays)
    const dayIndex = {} // ISO → index in activeDays (0-based)
    activeDays.forEach((iso, i) => { dayIndex[iso] = i })

    // Detect activity type from name
    function detectType(nombre) {
      const n = (nombre || '').toLowerCase()
      if (/dict/i.test(n))                     return 'DICTATION'
      if (/quiz|test|exam/i.test(n))           return 'QUIZ'
      if (/present|exposici|oral/i.test(n))    return 'PROJECT_PRESENTATION'
      if (/recep|revis|draft|gui[oó]n|script|document/i.test(n)) return 'PROJECT_RECEPTION'
      if (/reading|lectura|plan lector/i.test(n)) return 'READING'
      if (/speaking/i.test(n))                 return 'SPEAKING'
      if (/listening/i.test(n))                return 'LISTENING'
      if (/writing|escrit/i.test(n))           return 'WRITING'
      if (/vocab/i.test(n))                    return 'VOCAB'
      return 'OTHER'
    }

    // Collect all activities for this week from NEWS project
    const milestones = [] // { date, type, name, desc, pct }
    if (np?.actividades_evaluativas?.length) {
      for (const act of np.actividades_evaluativas) {
        if (!act.fecha || !daySet.has(act.fecha)) continue
        milestones.push({
          date: act.fecha,
          type: detectType(act.nombre),
          name: act.nombre || '',
          desc: act.descripcion || '',
          pct: act.porcentaje || null,
        })
      }
    }
    // Also check if NEWS due_date falls in this week → project presentation
    if (np?.due_date && daySet.has(np.due_date)) {
      const hasPresentation = milestones.some(m => m.type === 'PROJECT_PRESENTATION' && m.date === np.due_date)
      if (!hasPresentation) {
        milestones.push({
          date: np.due_date,
          type: 'PROJECT_PRESENTATION',
          name: `Presentación: ${np.title || 'Proyecto NEWS'}`,
          desc: 'Fecha de entrega del proyecto NEWS',
          pct: null,
        })
      }
    }

    if (!milestones.length) return ''

    // Sort by date
    milestones.sort((a, b) => a.date.localeCompare(b.date))

    const lines = [
      '',
      '🚨 HITOS EVALUATIVOS DE LA SEMANA:',
    ]

    for (const m of milestones) {
      const idx = dayIndex[m.date]
      const nextDay = idx + 1 < activeDays.length ? activeDays[idx + 1] : null

      lines.push(`  📢 ${m.date} → ${m.type}: "${sanitizeAIInput(m.name)}"${m.desc ? ` — ${sanitizeAIInput(m.desc)}` : ''}${m.pct ? ` (${m.pct}%)` : ''}`)

      if (m.type === 'DICTATION' && nextDay) {
        lines.push(`     🔄 ${nextDay}: VOCABULARIO NUEVO (nuevo ciclo)`)
      }
      if (m.type === 'QUIZ' && nextDay) {
        lines.push(`     🔄 ${nextDay}: UNIDAD NUEVA (nuevo ciclo)`)
      }
    }

    return lines.join('\n')
  })()


  // Build PIAR block
  const piarBlock = (piarData?.studentCount > 0 && piarData?.byCategory) ? (() => {
    const lines = [
      `\n♿ PIAR — PLAN INDIVIDUAL DE AJUSTE RAZONABLE (${piarData.studentCount} estudiante${piarData.studentCount !== 1 ? 's' : ''} en este grupo requiere${piarData.studentCount === 1 ? '' : 'n'} acomodaciones):`,
      '',
      'MANDATO: Diseña CADA actividad, instrucción y producto de esta guía integrando estas acomodaciones de forma natural e inclusiva.',
      'No las menciones explícitamente como "acomodaciones" — simplemente diseña la clase para que funcionen.',
      'Principios de diseño inclusivo que deben reflejarse en la guía:',
      '- Instrucciones claras, paso a paso, sin múltiples consignas simultáneas',
      '- Actividades que permitan diferentes formas de participación y demostración',
      '- Tiempo y espacio para verificar comprensión individual antes de avanzar',
      '',
    ]
    Object.entries(piarData.byCategory).forEach(([cat, items]) => {
      lines.push(`${cat.toUpperCase()}:`)
      items.forEach(item => lines.push(`  - ${sanitizeAIInput(item)}`))
    })
    return lines.join('\n')
  })() : ''

  // Build focus hints block (eleot domains, skill emphasis, preferred blocks)
  const focusBlock = (_focusHints?.length) ? (() => {
    const lines = [
      '\n🎯 FOCO PEDAGÓGICO DEL DOCENTE (priorizar en el diseño):',
      ...(_focusHints.map(h => `  - ${sanitizeAIInput(h)}`)),
    ]
    return lines.join('\n')
  })() : ''

  // Build checkpoint block (previous week achievement data)
  const checkpointBlock = checkpointData ? (() => {
    const { achievement, notes, indicatorText, weekNumber } = checkpointData
    const STRATEGY = {
      most: {
        label: '🟢 >70% logró',
        instruction: `Escalar nivel cognitivo: arrancar donde terminó la semana pasada. Mayor autonomía, productos más elaborados.`,
      },
      some: {
        label: '🟡 30-70% logró',
        instruction: `Días 1-2: reforzar con estrategia DIFERENTE. Días 3+: avanzar al siguiente nivel. Actividades diferenciadas.`,
      },
      few: {
        label: '🔴 <30% logró',
        instruction: `Reteach con enfoque diferente (visual→kinestésico, individual→grupal). No escalar hasta consolidar. Más EXIT_TICKET y SELF_ASSESSMENT.`,
      },
    }
    const strat = STRATEGY[achievement]
    if (!strat) return ''
    const lines = [
      `\n🔄 CHECKPOINT DE LA SEMANA ${weekNumber || 'ANTERIOR'} — DATO REAL DEL DOCENTE:`,
      `Resultado: ${strat.label}`,
    ]
    if (indicatorText) lines.push(`Indicador evaluado: "${sanitizeAIInput(indicatorText)}"`)
    if (notes) lines.push(`Observaciones del docente: "${sanitizeAIInput(notes)}"`)
    lines.push('')
    lines.push(`ESTRATEGIA OBLIGATORIA PARA ESTA SEMANA:`)
    lines.push(strat.instruction)
    return lines.join('\n')
  })() : ''

  // Build 2-week cognitive progression differentiation
  const isTwoWeeks = activeDays.length > 5
  const twoWeekBloomBlock = isTwoWeeks ? (() => {
    const midpoint = Math.ceil(activeDays.length / 2)
    const week1Days = activeDays.slice(0, midpoint).join(', ')
    const week2Days = activeDays.slice(midpoint).join(', ')
    return `
2 SEMANAS: Semana 1 (${week1Days}) = Recuperar→Analizar→Aplicar. Semana 2 (${week2Days}) = Evaluar→Crear→Divulgar.
Semana 2 NO repite Semana 1 — escala cognitiva evidente. Producto Sem.1 = parcial, Sem.2 = completo.`
  })() : ''

  const message = `Genera una guía de aprendizaje completa con estos datos:

- Grado: ${safeGrade}
- Materia: ${safeSubject}
- Período: ${safePeriod}
- Unidad/Tema: ${safeUnit || 'No especificado'}
- Objetivo del docente: ${safeObjective}
- Días de clase ${isTwoWeeks ? 'estas dos semanas' : 'esta semana'}: ${daysStr}
${achievementBlock}
${newsBlock}
${dayPlanBlock}
${milestonesBlock}
${checkpointBlock}
${focusBlock}
${piarBlock}

IDIOMA: Usa inglés para Language Arts. Usa español para todas las demás materias.
FORMATO: Texto plano, sin HTML. Conciso pero pedagógicamente rico.

INSTRUCCIONES DE CONTENIDO POR SECCIÓN — CONSTRUCTIVISTA (NO CONDUCTISTA):

ENCUENTRO — SUBJECT TO BE WORKED (key: subject) — máx. 50 palabras:
  → ÍNDICE BREVE y CONSECUTIVO del día. 3 líneas:
    qué momento del Principio Bíblico (intro/profundización/aplicación/reflexión),
    qué momento de la Unidad (intro/práctica/análisis/producción),
    qué momento del Vocabulario (presentación/juego/uso en contexto/dictado).
  → NUNCA repetir "intro" dos días seguidos — escala sobre el día anterior.
  → NO incluyas oración ni reglas (se insertan automáticamente).
  → Ej. Día 1: "📖 Biblical Principle: Introduction | 📚 Unit 3: First encounter + vocabulary | 🔤 Vocabulary: Presentation"
  → Ej. Día 2: "📖 Biblical Principle: Deepening | 📚 Unit 3: Grammar exploration | 🔤 Vocabulary: Practice"

TEMA DEL DÍA (key: motivation) — máx. 40 palabras:
  → RITUAL DEL TABLERO — se escribe y NO SE BORRA durante toda la clase:
    📅 Date | 🎯 Objective (lenguaje amigable) | 📖 Biblical Principle | 📚 Topic
  → Si hay hito evaluativo: abrir con "⚠️ TODAY: [HITO]" antes del ritual.

MOTIVACIÓN (key: activity) — máx. 40 palabras:
  → 1 PREGUNTA GUÍA que active saberes previos (NO sí/no — que invite a pensar, recordar, opinar).
  → 1 dinámica de activación (think-pair-share, predicción, encuesta rápida, lluvia de ideas).
  → La pregunta tiende un PUENTE entre lo que ya saben y lo nuevo.
  → Ejemplo: "Think-pair-share: What do you already know about ecosystems? Tell your partner 2 things. — What do you WANT to know?"

DESARROLLO DE HABILIDADES (key: skill) — máx. 80 palabras, 4 MOMENTOS constructivistas:
  → a) ❓ PREGUNTA GUÍA — provoca exploración ("What patterns do you notice?", "¿Por qué crees que...?")
  → b) 🔍 EXPLORACIÓN — observa, lee, compara (referencia páginas del libro). Individual o en parejas.
  → c) 🏗️ CONSTRUCCIÓN — el alumno formula su conclusión/hipótesis. Comparte con compañero. Docente guía sin dar la respuesta.
  → d) ✍️ PRODUCTO — evidencia concreta (escribe, presenta, completa).
  → Si hay gramática: OBSERVAR ejemplos → INFERIR la regla → VERIFICAR → PRACTICAR.
  → Ejemplo: "❓ Look at sentences a-d on p.45. What do they have in common? 🔍 In pairs, underline the verb patterns. 🏗️ Write YOUR rule for Present Perfect. Share with another pair. ✍️ Write 3 sentences about your own experiences using this pattern."

CIERRE Y REFLEXIÓN (key: closing) — máx. 40 palabras:
  → 1 pregunta donde el alumno EXPLIQUE EN SUS PALABRAS (no repita definiciones — "Explain to your partner...")
  → 1 reflexión bíblica profunda ("¿Cómo cambia tu perspectiva sobre [tema] a la luz de [principio]?")

TAREA / ASSIGNMENT (key: assignment) — máx. 25 palabras:
  → 1 tarea concreta con entregable. Al menos 1 vez/semana incluir reflexión bíblica.
  → Ejemplo: "Write 5 sentences about a challenge you overcame — use Past Simple. Reflect: how did God guide you?"
${isTwoWeeks ? twoWeekBloomBlock : `
PROGRESIÓN SEMANAL: Los días avanzan desde exploración guiada (Día 1) hasta producción autónoma (último día).
Cada día el alumno construye sobre el descubrimiento anterior. El docente retira andamiaje progresivamente.`}`

  // Fetch textbook images for multimodal context (max 4, parallel, non-blocking failures)
  let imageBlocks = undefined
  const tbImages = activeNewsProject?.textbook_reference?.images
  if (tbImages?.length) {
    const urls = tbImages.slice(0, 4).map(img => typeof img === 'string' ? img : img.url).filter(Boolean)
    if (urls.length) {
      const results = await Promise.all(urls.map(u => fetchImageBlock(u)))
      const valid = results.filter(Boolean)
      if (valid.length) imageBlocks = valid
    }
  }

  const raw = await callClaude({ type: 'generate', system, message, planId, maxTokens: 16000, imageBlocks })

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
      // SUBJECT: prayer first, then class rules, then AI content
      const subj = day.sections.subject
      if (subj) {
        const aiHtml = toHtml(stripPrayer(stripRules(subj.content)))
        subj.content = PRAYER_TEXT + CLASS_RULES + (aiHtml ? aiHtml : '')
      }
      // MOTIVATION: only AI content (no rules injection here)
      const motiv = day.sections.motivation
      if (motiv) {
        const aiHtml = toHtml(stripRules(motiv.content))
        motiv.content = aiHtml
      }
    })
    return parsed
  }

  const result = tryParseJSON(raw)
  if (result) return injectFixedTexts(result)

  // Retry: ask for more compact content
  const retryMessage = `${message}

IMPORTANTE: Tu respuesta anterior fue cortada. Sé MÁS CONCISO pero mantén el enfoque constructivista:
- subject: 5 palabras + actividad (máx. 50 palabras).
- motivation: ritual del tablero + conexión (máx. 60 palabras).
- activity: pregunta guía + dinámica (máx. 40 palabras).
- skill: 4 momentos (❓🔍🏗️✍️) más breves (máx. 80 palabras).
- closing: 1 pregunta de explicación + 1 reflexión bíblica (máx. 40 palabras).
- assignment: 1 tarea con entregable (máx. 25 palabras).
Responde SOLO con el JSON, sin texto antes ni después.`

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
- Tener 5 niveles: Superior (4.50–5.00) / Alto (4.00–4.49) / Básico (3.50–3.99) / Bajo (2.00–3.49) / Muy Bajo (1.00–1.99)
- Escala Boston Flex: 1.0–5.0 · fórmula (puntaje/total)×4+1 · el nivel 5 = cumplimiento pleno del indicador
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
