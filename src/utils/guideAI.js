// ── guideAI.js ────────────────────────────────────────────────────────────────
// AI functions related to guide (lesson plan) generation and analysis.

import { callClaude, extractJSONArray, fmtVerse, biblicalBlock, normalizeSmartBlock } from './aiClient'
import { sanitizeAIInput } from './validationSchemas'
import { MODELO_B_SUBJECTS } from './constants'

// ── Activity archetypes per section — used to force variety on each call ──────
const ACTIVITY_ARCHETYPES = {
  // English / Modelo B
  en: {
    'SYNCHRONIC CLASS · MEET': [
      'a one-sentence announcement of the synchronous session topic',
    ],
    'SUBJECT TO BE WORKED:': [
      'a one-sentence skill/grammar/topic statement for the day',
    ],
    'MOTIVATION': [
      'a provocative real-life question or "Would you rather?" dilemma',
      'a short image/headline prediction activity',
      'a word association chain or brainstorm web',
      'a mystery object or realia reveal',
      'a personal anecdote prompt ("Tell your partner about a time when...")',
      'a quick class poll with hands-up voting and brief justification',
      'a short song lyric or poem excerpt with a guiding question',
      'a "what do you notice?" visual stimulus (photo, infographic, meme)',
      'a true/false warm-up quiz about the topic',
      'a "complete the sentence" prediction game',
    ],
    'SKILLS DEVELOPMENT': [
      'a hot seat roleplay (one student in character, others interview)',
      'a four corners debate using opinion phrases and target grammar',
      'a jigsaw reading where groups reconstruct a story and report back',
      'a collaborative storytelling chain using required vocabulary',
      'an alibi roleplay (pairs create and defend their alibi)',
      'a gallery walk where students annotate posters with grammar structures',
      'a structured debate with argument frames and rebuttal turns',
      'a think-pair-share using sentence starters from the unit',
      'a news broadcast simulation (anchor, reporter, eyewitness roles)',
      'a dictogloss (teacher reads twice; pairs reconstruct the text)',
      'a "speed dating" conversation rotation with a new topic each minute',
      'a peer teaching segment (student A explains to student B, then swap)',
      'a story completion chain where each student adds one sentence',
      'a vocabulary ranking and justification activity',
      'an error correction hunt on a printed or projected paragraph',
    ],
    'CLOSING': [
      'an exit-ticket sentence using the target structure',
      'a "three things I learned / one question I still have" reflection',
      'a pair share: "Explain today\'s grammar rule to your partner in your own words"',
      'a "ticket out the door" — write one sentence connecting today\'s topic to real life',
      'a quick vocabulary recap: partners quiz each other on 5 new words',
      'a silent written reflection on a faith-connection prompt',
      'a "what would I tell a friend about today\'s lesson?" one-sentence summary',
    ],
    'ASSIGNMENT': [
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
    'SYNCHRONIC CLASS · MEET': [
      'una oración que anuncia el tema de la sesión sincrónica del día',
    ],
    'SUBJECT TO BE WORKED:': [
      'una oración que enuncia el tema o habilidad del día',
    ],
    'MOTIVATION': [
      'una pregunta provocadora o dilema de la vida real',
      'una lluvia de ideas cronometrada con una imagen o título',
      'un juego de asociación de palabras o mapa mental rápido',
      'un acertijo o misterio relacionado con el tema',
      'una encuesta rápida con justificación breve',
      'una predicción: ¿qué creen que va a pasar?',
      'una conexión personal: ¿cuándo has vivido algo así?',
      'un video corto o imagen impactante con pregunta guía',
    ],
    'SKILLS DEVELOPMENT': [
      'un roleplay de situación real usando el vocabulario del tema',
      'un debate estructurado con rondas de argumento y réplica',
      'una actividad jigsaw: grupos expertos que enseñan a otros',
      'un proyecto corto de escritura colaborativa en tríos',
      'una galería de ideas donde los grupos anotan y responden',
      'una cadena de historia donde cada estudiante agrega un elemento',
      'una simulación o juego de roles con roles asignados',
      'un análisis de caso con preguntas guía y presentación breve',
      'un taller de corrección entre pares con rúbrica sencilla',
    ],
    'CLOSING': [
      'una pregunta de reflexión que conecte lo aprendido con el principio bíblico',
      'un ticket de salida: una frase que resume el aprendizaje del día',
      'una ronda final: cada estudiante dice una palabra clave aprendida',
      'una conexión personal: ¿dónde aplico esto fuera del aula?',
      'un resumen en cadena: un estudiante comienza, el siguiente continúa',
    ],
    'ASSIGNMENT': [
      'una tarea escrita específica y alcanzable relacionada con el tema',
      'una actividad de investigación breve con entregable concreto',
      'un ejercicio del libro de texto (página y punto específico)',
      'una reflexión escrita de media página con pregunta guía',
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

  const SECTION_LIMITS = {
    'SYNCHRONIC CLASS · MEET': isModeloB
      ? '1 sentence. Announce the synchronous session topic or skill focus.'
      : '1 oración. Anuncia el tema de la sesión sincrónica del día.',
    'SUBJECT TO BE WORKED:': isModeloB
      ? '1 sentence. State the specific language skill or grammar/vocabulary topic of the day.'
      : '1 oración. Enuncia el tema o habilidad del día.',
    'MOTIVATION': isModeloB
      ? '2-3 sentences. Describe an engaging hook: a question, a short game, a visual stimulus, a real-life scenario, or a challenge that activates prior knowledge.'
      : '2-3 oraciones. Describe la actividad de enganche (pregunta, juego corto, imagen, reto).',
    'SKILLS DEVELOPMENT': isModeloB
      ? '4-6 sentences. Describe the main skill-development task in detail — step by step. Make it specific to the grammar point, vocabulary set, or textbook unit. Suggest at least one pair/group dynamic and one concrete language production task.'
      : '4-5 oraciones. Paso a paso de la actividad principal. Esta es la sección más importante.',
    'CLOSING': isModeloB
      ? '2 sentences. Pose a reflection question that connects today\'s language skill to the biblical principle. Then ask students to share one thing they learned today in English.'
      : '1-2 oraciones. Pregunta de reflexión que conecte el aprendizaje del día con el principio bíblico del período.',
    'ASSIGNMENT': isModeloB
      ? '2 sentences. Give a specific, achievable homework task using the studied language. It must produce written or spoken output (e.g. write 5 sentences, record a voice note, complete p.XX of the textbook).'
      : '1-2 oraciones. Tarea específica y alcanzable.',
  }
  const limit = SECTION_LIMITS[section.label] || (isModeloB ? '2-4 sentences.' : '2-3 oraciones.')

  const isClosing = section.label === 'CLOSING'
  const langInstruction = isModeloB
    ? 'You respond ALWAYS in English. This is a bilingual school where language subjects are fully taught in English.'
    : 'Respondes SIEMPRE en español.'

  const system = `Eres un asistente pedagógico experto para colegios bilingües colombianos (CBF — Colegio Boston Flexible).
Generas sugerencias de actividades para guías de aprendizaje autónomo, concretas, variadas y apropiadas para el nivel y la materia.
${langInstruction}
Formato: texto corrido, listo para pegar en la guía. Sin listas, sin viñetas, sin markdown.
Sé específico: menciona el tema gramatical, vocabulario o unidad del libro cuando esté disponible.
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
  grade, subject, objective, unit, activeDays, period, planId, achievementGoal, activeNewsProject, principles, piarData
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

  const system = `Eres un experto en diseño de guías de aprendizaje autónomo para colegios bilingües colombianos CRISTIANOS CONFESIONALES.
Generas estructuras completas de guías semanales siguiendo el modelo CBF con 6 secciones por día.

MANDATO ABSOLUTO: Esta es una escuela cristiana confesional. El principio bíblico NO es un elemento decorativo — es el HILO CONDUCTOR que atraviesa CADA momento de CADA clase, sin importar la materia. Matemáticas, Ciencias, Filosofía, Language Arts: todas tienen el mismo norte espiritual. Nunca generes contenido neutral o secular puro.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECUENCIA DIDÁCTICA — 6 SECCIONES POR DÍA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SUBJECT TO BE WORKED (~8 min) — ENCUADRE
   El docente anuncia el indicador del día y el principio bíblico que guiará la clase.
   Luego pide a un estudiante que ore. Las reglas de clase se muestran aquí.
   → Genera: 1 oración concisa que enuncia el tema/habilidad del día y lo conecta con el principio bíblico.
   → NO incluyas oración ni reglas — esas se insertan automáticamente por el sistema.

2. MOTIVATION (~8 min) — ACTIVACIÓN DE SABERES PREVIOS
   El docente lanza preguntas activadoras que conectan el conocimiento previo del estudiante
   TANTO con el indicador académico COMO con el principio bíblico de la clase.
   Las preguntas deben despertar curiosidad y revelar qué sabe ya el estudiante sobre el tema.
   → Genera: 2-3 preguntas activadoras concretas, no retóricas. Deben estar relacionadas con el contenido del día Y con el principio bíblico.

3. ACTIVITY (~15 min) — DINÁMICA PREPARATORIA
   El docente propone un rompe hielo o dinámica que prepare al estudiante para el contenido.
   Esta actividad conecta directamente con las preguntas de Motivation y sirve de puente
   hacia el Skill Development. Debe tener resonancia con el principio bíblico.
   → Genera: descripción clara de la dinámica (qué hace el estudiante, cómo se desarrolla). 2-3 oraciones.

4. SKILL DEVELOPMENT (~40 min) — DESARROLLO DE LA HABILIDAD
   El núcleo de la clase. El docente explica, modela y guía la práctica de la habilidad.
   Incluye el PRODUCTO que el estudiante genera: escritura en cuaderno, worksheet, exposición,
   dibujos, ejercicios en clase, etc. El principio bíblico debe permear la explicación y los ejemplos.
   → Genera: descripción paso a paso de la actividad principal + el producto esperado. 3-5 oraciones.

5. CLOSING (~8 min) — CIERRE Y VERIFICACIÓN
   El docente hace preguntas de verificación sobre lo trabajado en clase.
   Luego pregunta cómo se sintieron emocionalmente con respecto al tema y qué opinión tienen.
   Finalmente conecta el aprendizaje del día con el principio bíblico como cierre natural.
   → Genera: 1-2 preguntas de verificación académica + 1 pregunta de reflexión emocional/espiritual.

6. ASSIGNMENT (~5 min) — TAREA
   Puede ser: actividad para terminar en casa, preparación para la clase siguiente, o extensión del tema.
   → Genera: 1 oración clara y alcanzable.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROGRESIÓN SEMANAL OBLIGATORIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Los días de la semana deben construir una escalera de aprendizaje. La progresión típica es:
  Día 1 → Introducción y revelación del vocabulario/concepto nuevo
  Día 2 → Comprensión y primeras asociaciones
  Día 3 → Práctica guiada y aplicación
  Día 4 → Práctica independiente y consolidación
  Día 5 → Producción autónoma del estudiante y reflexión final
Cada día debe avanzar desde donde terminó el anterior. El estudiante debe terminar la semana
habiendo apropiado el contenido y siendo capaz de producirlo por cuenta propia.

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

  const message = `Genera una guía de aprendizaje completa con estos datos:

- Grado: ${safeGrade}
- Materia: ${safeSubject}
- Período: ${safePeriod}
- Unidad/Tema: ${safeUnit || 'No especificado'}
- Objetivo del docente: ${safeObjective}
- Días de clase ${activeDays.length > 5 ? 'estas dos semanas' : 'esta semana'}: ${daysStr}
${achievementBlock}
${newsBlock}
${piarBlock}

IDIOMA: Usa inglés para Language Arts. Usa español para todas las demás materias.
FORMATO: Texto plano, sin HTML, sin viñetas, sin listas. Texto corrido, directo al punto.

INSTRUCCIONES DE CONTENIDO POR SECCIÓN:

SUBJECT TO BE WORKED:
  → 1 oración que anuncia el tema/habilidad del día y lo vincula al principio bíblico.
  → No incluyas oración ni reglas de clase (se insertan automáticamente).

MOTIVATION:
  → 2-3 preguntas activadoras concretas. No retóricas.
  → Deben conectar el conocimiento previo del estudiante con el indicador del día Y con el principio bíblico.
  → Ejemplo: "What do you know about X? Have you ever experienced Y? How does this connect to [principio]?"

ACTIVITY:
  → Describe una dinámica de rompe hielo o juego que prepare al estudiante para el contenido.
  → Debe responder a las preguntas de Motivation y hacer el puente hacia Skill Development.
  → El principio bíblico debe resonar en la dinámica. 2-3 oraciones.

SKILL DEVELOPMENT:
  → Describe paso a paso la actividad principal de la clase.
  → Especifica el PRODUCTO que el estudiante genera (qué escribe, hace, presenta o crea).
  → Integra el principio bíblico en los ejemplos o en el contenido mismo. 3-5 oraciones.

CLOSING:
  → 1-2 preguntas de verificación académica sobre lo trabajado.
  → 1 pregunta de reflexión emocional: cómo se sintieron con el tema y qué opinan.
  → Cierra conectando el aprendizaje con el principio bíblico del día.

ASSIGNMENT:
  → 1 tarea concreta: para terminar en casa, preparar la siguiente clase, o profundizar.

PROGRESIÓN SEMANAL: Los días deben avanzar desde la introducción del vocabulario/concepto (Día 1)
hasta la producción autónoma del estudiante (último día). Cada día construye sobre el anterior.`

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

IMPORTANTE: Tu respuesta anterior fue cortada. Sé más breve por sección:
- SUBJECT: 1 oración (tema + vínculo bíblico).
- MOTIVATION: 2 preguntas activadoras (indicador + principio bíblico).
- ACTIVITY: 2 oraciones (dinámica preparatoria).
- SKILL DEVELOPMENT: 3 oraciones (actividad principal + producto del estudiante).
- CLOSING: 1 pregunta de verificación + 1 reflexión emocional/espiritual.
- ASSIGNMENT: 1 oración.
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
